import { communityAddress, HYPHAE_PROGRAM_ID, vaultAddress } from "@hyphae/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { address, getAddressEncoder, type Rpc, type SolanaRpcApi } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { GENESIS } from "./chain.js";
import { randomAddress } from "./ready-seed.js";
import { settleChain } from "./settle-chain.js";

// The settle adapter over a controlled transport (review round 2, P2): the community account and
// the vault must come from one getMultipleAccounts response, so the outstanding figure and the
// balance belong to the same bank state.

const RENT = 953_520n;
const discriminator = (name: string) => sha256(utf8ToBytes(`account:${name}`)).slice(0, 8);
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

// The program's Community layout: discriminator, mint, admin, fee recipient, outstanding (u64 LE),
// bump, vault bump.
function communityBytes(o: {
  mint: string;
  admin: string;
  feeRecipient: string;
  outstanding: bigint;
}): Uint8Array {
  const encode = (a: string) => new Uint8Array(getAddressEncoder().encode(address(a)));
  const out = new Uint8Array(8 + 32 * 3 + 8 + 2);
  out.set(discriminator("Community"), 0);
  out.set(encode(o.mint), 8);
  out.set(encode(o.admin), 40);
  out.set(encode(o.feeRecipient), 72);
  new DataView(out.buffer).setBigUint64(104, o.outstanding, true);
  out[112] = 255;
  out[113] = 254;
  return out;
}
const vaultBytes = () => {
  const out = new Uint8Array(9);
  out.set(discriminator("Vault"), 0);
  out[8] = 254;
  return out;
};

// A transport that moves on with every request after the first, as a publication would between
// two reads (fee 1 lamport leaves the vault, 49 are reserved as outstanding). It records every
// request and the (vault, outstanding) pair each account response was served from.
function fakeTransport(o: {
  mint: string;
  admin: string;
  feeRecipient: string;
  community: string;
  vault: string;
  vaultLamports: bigint;
  outstanding: bigint;
}) {
  const state = {
    vault: o.vaultLamports,
    outstanding: o.outstanding,
    requests: [] as string[],
    served: [] as { vault: bigint; outstanding: bigint }[],
  };
  const account = (at: string) => {
    if (at === o.community) {
      state.served.push({ vault: state.vault, outstanding: state.outstanding });
      const data = communityBytes({ ...o, outstanding: state.outstanding });
      return {
        owner: HYPHAE_PROGRAM_ID,
        executable: false,
        lamports: 1_500_000n,
        data: [base64(data), "base64"],
      };
    }
    if (at === o.vault) {
      state.served.push({ vault: state.vault, outstanding: state.outstanding });
      return {
        owner: HYPHAE_PROGRAM_ID,
        executable: false,
        lamports: state.vault,
        data: [base64(vaultBytes()), "base64"],
      };
    }
    return null;
  };
  const request = <T>(name: string, run: () => T) => ({
    send: async () => {
      if (state.requests.length > 0) {
        state.vault -= 50n;
        state.outstanding += 49n;
      }
      state.requests.push(name);
      return run();
    },
  });
  const rpc = {
    getGenesisHash: () => request("getGenesisHash", () => GENESIS["solana:devnet"]),
    getMultipleAccounts: (addresses: readonly string[]) =>
      request(`getMultipleAccounts:${addresses.join(",")}`, () => ({
        context: { slot: 1n },
        value: addresses.map(account),
      })),
    getAccountInfo: (at: string) =>
      request(`getAccountInfo:${at}`, () => ({ context: { slot: 1n }, value: account(at) })),
    getMinimumBalanceForRentExemption: (length: bigint) =>
      request("getMinimumBalanceForRentExemption", () => (length === 9n ? RENT : 0n)),
  };
  return { rpc: rpc as unknown as Rpc<SolanaRpcApi>, state };
}

async function setup(outstanding = 100n, vaultLamports = RENT + 100n + 1_000_000n) {
  const mint = randomAddress();
  const admin = randomAddress();
  const feeRecipient = randomAddress();
  const community = await communityAddress(HYPHAE_PROGRAM_ID, address(mint), address(admin));
  const vault = await vaultAddress(HYPHAE_PROGRAM_ID, community);
  const transport = fakeTransport({
    mint,
    admin,
    feeRecipient,
    community,
    vault,
    vaultLamports,
    outstanding,
  });
  const chain = await settleChain({
    rpcUrl: "https://rpc.test",
    wsUrl: "wss://rpc.test",
    network: "solana:devnet",
    rpc: transport.rpc,
  });
  return { mint, admin, feeRecipient, community, vault, chain, ...transport };
}

describe("settleChain.readCommunity", () => {
  it("reads the community and the vault in one getMultipleAccounts request", async () => {
    const t = await setup();
    const snapshot = await t.chain.readCommunity({ mint: t.mint, address: t.community });
    if (!snapshot) throw new Error("no snapshot");
    const multiple = t.state.requests.filter((r) => r.startsWith("getMultipleAccounts"));
    expect(multiple).toEqual([`getMultipleAccounts:${t.community},${t.vault}`]);
    expect(t.state.requests.filter((r) => r.startsWith("getAccountInfo"))).toEqual([]);
    expect(snapshot).toMatchObject({
      address: t.community,
      admin: t.admin,
      feeRecipient: t.feeRecipient,
      rentExemptMinimum: RENT,
    });
    // Both figures come from the one response: the pair served for the community equals the
    // pair served for the vault, and the free balance follows from that pair alone.
    const [forCommunity, forVault] = t.state.served;
    expect(forCommunity).toEqual(forVault);
    expect(snapshot.outstandingLamports).toBe(forCommunity?.outstanding);
    expect(snapshot.vaultLamports).toBe(forCommunity?.vault);
    expect(snapshot.vaultLamports - snapshot.rentExemptMinimum - snapshot.outstandingLamports).toBe(
      (forCommunity?.vault as bigint) - RENT - (forCommunity?.outstanding as bigint),
    );
  });

  it("would pair a balance with a stale outstanding figure if the accounts were read one by one", async () => {
    const t = await setup();
    // Two sequential reads over the same transport straddle a publication: the free balance is
    // off by the 50 lamports that publication moved. This is the hazard the single request avoids.
    const first = await t.rpc.getAccountInfo(address(t.community)).send();
    const second = await t.rpc.getAccountInfo(address(t.vault)).send();
    expect(first.value).not.toBeNull();
    expect(second.value).not.toBeNull();
    const [a, b] = t.state.served;
    expect(b?.vault).toBe((a?.vault as bigint) - 50n);
    expect(b?.outstanding).toBe((a?.outstanding as bigint) + 49n);
    const sequential = (b?.vault as bigint) - RENT - (a?.outstanding as bigint);
    const consistent = (b?.vault as bigint) - RENT - (b?.outstanding as bigint);
    expect(sequential - consistent).toBe(49n);
  });

  it("returns null for an account that is not this mint's community at the bound address", async () => {
    const t = await setup();
    expect(await t.chain.readCommunity({ mint: randomAddress(), address: t.community })).toBeNull();
    expect(await t.chain.readCommunity({ mint: t.mint, address: randomAddress() })).toBeNull();
  });
});
