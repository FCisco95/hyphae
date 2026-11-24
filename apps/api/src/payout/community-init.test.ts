import { communityAddress, HYPHAE_PROGRAM_ID, vaultAddress } from "@hyphae/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { type Address, address, getAddressEncoder } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { planCommunityInit } from "./community-init.js";
import { randomAddress } from "./ready-seed.js";
import { type FakeAccount, fakeRpc } from "./rpc-fake.js";

const SYSTEM = "11111111111111111111111111111111";
const programId = HYPHAE_PROGRAM_ID as Address;

// The Community account's bytes: discriminator, mint, admin, fee recipient, outstanding, bumps.
function communityBytes(mint: string, admin: string, fee: string): Uint8Array {
  const e = getAddressEncoder();
  return Uint8Array.from([
    ...sha256(utf8ToBytes("account:Community")).slice(0, 8),
    ...e.encode(address(mint)),
    ...e.encode(address(admin)),
    ...e.encode(address(fee)),
    ...new Uint8Array(8),
    255,
    254,
  ]);
}

async function world(o: { program?: boolean; fee?: FakeAccount | null; exists?: string } = {}) {
  const target = {
    programId,
    admin: randomAddress(),
    mint: randomAddress(),
    feeRecipient: randomAddress(),
  };
  const accounts = new Map<string, FakeAccount>();
  if (o.program !== false)
    accounts.set(programId, { owner: "BPFLoaderUpgradeab1e", executable: true });
  if (o.fee !== null) accounts.set(target.feeRecipient, o.fee ?? { owner: SYSTEM });
  const community = await communityAddress(programId, address(target.mint), address(target.admin));
  if (o.exists !== undefined) {
    accounts.set(community, {
      owner: programId,
      data: communityBytes(target.mint, target.admin, o.exists),
    });
  }
  const rpc = fakeRpc({ accounts, balances: new Map([[target.admin, 7_000_000n]]) });
  return { target, rpc, community, vault: await vaultAddress(programId, community) };
}

describe("planCommunityInit", () => {
  it("is ready for a deployed program, an absent community and a System-owned fee wallet", async () => {
    const w = await world();
    expect(await planCommunityInit(w.rpc.rpc, w.target)).toEqual({
      status: "ready",
      community: w.community,
      vault: w.vault,
      rentLamports: 890_880n + 114n * 6_960n + 890_880n + 9n * 6_960n,
      adminLamports: 7_000_000n,
    });
  });

  it("refuses a program that is not deployed", async () => {
    const w = await world({ program: false });
    expect(await planCommunityInit(w.rpc.rpc, w.target)).toMatchObject({
      status: "refused",
      reason: "program_missing",
    });
  });

  it("reports an existing community with what the chain holds", async () => {
    const fee = randomAddress();
    const w = await world({ exists: fee });
    expect(await planCommunityInit(w.rpc.rpc, w.target)).toMatchObject({
      status: "exists",
      community: w.community,
      onChain: { mint: w.target.mint, admin: w.target.admin, feeRecipient: fee },
    });
  });

  it("refuses a fee recipient that is missing, program-owned, a program or holds data", async () => {
    for (const fee of [
      null,
      { owner: programId },
      { owner: SYSTEM, executable: true },
      { owner: SYSTEM, data: new Uint8Array([1]) },
    ]) {
      const w = await world({ fee });
      expect(await planCommunityInit(w.rpc.rpc, w.target), JSON.stringify(fee)).toMatchObject({
        status: "refused",
        reason: "fee_recipient_invalid",
      });
    }
  });
});
