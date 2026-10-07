import { communityAddress, HYPHAE_PROGRAM_ID, vaultAddress } from "@hyphae/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { address, getAddressEncoder } from "@solana/kit";
import { describe, expect, it } from "vitest";
import type { SettlementReader } from "./settlement.js";
import { readVault } from "./vault.js";

const MINT = "HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg";
const ADMIN = "2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR";
const FEE = "rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK";
const key = (a: string) => new Uint8Array(getAddressEncoder().encode(address(a)));

// A Community account as the program stores it: discriminator, mint, admin, fee recipient,
// outstanding lamports, then the two bumps.
function communityAccount(mint: string, outstanding: bigint) {
  const out = new Uint8Array(8 + 32 * 3 + 8 + 2);
  out.set(sha256(utf8ToBytes("account:Community")).subarray(0, 8));
  out.set(key(mint), 8);
  out.set(key(ADMIN), 40);
  out.set(key(FEE), 72);
  new DataView(out.buffer).setBigUint64(104, outstanding, true);
  return out;
}

function fakeReader(accounts: Map<string, Uint8Array>, balances: Map<string, bigint>) {
  const state = { down: false, hang: false };
  const reader: SettlementReader = {
    network: async () => "solana:mainnet",
    accounts: async (owner, at) => {
      expect(owner).toBe(HYPHAE_PROGRAM_ID);
      if (state.down) throw new Error("rpc down");
      if (state.hang) await new Promise(() => {});
      return at.map((a) => accounts.get(a) ?? null);
    },
    balance: async (at) => balances.get(at) ?? 0n,
    creation: async () => null,
    latestBlockhash: async () => ({ blockhash: "x", lastValidBlockHeight: 0n }),
  };
  return { reader, state };
}

const later = () => Date.now() + 1_000;

describe("readVault", () => {
  it("shows a created community's vault, its balance and what earlier epochs still owe", async () => {
    const community = await communityAddress(HYPHAE_PROGRAM_ID, address(MINT), address(ADMIN));
    const vault = await vaultAddress(HYPHAE_PROGRAM_ID, community);
    const { reader } = fakeReader(
      new Map([[community, communityAccount(MINT, 250_000_000n)]]),
      new Map([[vault, 1_500_000_000n]]),
    );
    expect(await readVault({ mint: MINT, chainAddress: community }, reader, later())).toEqual({
      status: "available",
      network: "solana:mainnet",
      program_id: HYPHAE_PROGRAM_ID,
      community_address: community,
      vault_address: vault,
      admin: ADMIN,
      fee_recipient: FEE,
      balance_lamports: "1500000000",
      outstanding_lamports: "250000000",
    });
  });

  it("says the community is not on chain before the operator binds it", async () => {
    const { reader } = fakeReader(new Map(), new Map());
    expect(await readVault({ mint: MINT, chainAddress: null }, reader, later())).toEqual({
      status: "unavailable",
      reason: "community_not_on_chain",
    });
  });

  it("says the community is not on chain when the bound account does not exist", async () => {
    const community = await communityAddress(HYPHAE_PROGRAM_ID, address(MINT), address(ADMIN));
    const { reader } = fakeReader(new Map(), new Map());
    expect(await readVault({ mint: MINT, chainAddress: community }, reader, later())).toEqual({
      status: "unavailable",
      reason: "community_not_on_chain",
    });
  });

  it("refuses an account that is not this mint's community at its derived address", async () => {
    const community = await communityAddress(HYPHAE_PROGRAM_ID, address(MINT), address(ADMIN));
    const other = "So11111111111111111111111111111111111111112";
    const { reader } = fakeReader(new Map([[community, communityAccount(other, 0n)]]), new Map());
    expect(await readVault({ mint: MINT, chainAddress: community }, reader, later())).toEqual({
      status: "unavailable",
      reason: "chain_mismatch",
    });
  });

  it("is unavailable without a chain reader, when the chain errors, and past the deadline", async () => {
    const community = await communityAddress(HYPHAE_PROGRAM_ID, address(MINT), address(ADMIN));
    const input = { mint: MINT, chainAddress: community };
    expect(await readVault(input, undefined, later())).toEqual({
      status: "unavailable",
      reason: "chain_unconfigured",
    });
    const { reader, state } = fakeReader(new Map(), new Map());
    state.down = true;
    expect(await readVault(input, reader, later())).toEqual({
      status: "unavailable",
      reason: "chain_unavailable",
    });
    state.down = false;
    state.hang = true;
    expect(await readVault(input, reader, Date.now() + 20)).toEqual({
      status: "unavailable",
      reason: "chain_unavailable",
    });
  });
});
