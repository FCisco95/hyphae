import { readFileSync } from "node:fs";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import {
  AccountRole,
  type Address,
  address,
  createKeyPairSignerFromPrivateKeyBytes,
  type Instruction,
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  claimInstruction,
  decodeClaimReceipt,
  decodeCommunity,
  decodeEpoch,
  HYPHAE_PROGRAM_ID,
  initializeCommunityInstruction,
  publishEpochInstruction,
} from "./program.js";

// The shared H-CONTRACT vectors; the Rust tests assert the same bytes against the program.
const vectors = JSON.parse(
  readFileSync(new URL("./test-vectors/h-contract-v1.json", import.meta.url), "utf8"),
);
const ix = vectors.program.instructions;
const acc = vectors.program.accounts;

const signer = await createKeyPairSignerFromPrivateKeyBytes(new Uint8Array(32).fill(9));
const other = (n: number): Address =>
  address(
    [
      "11111111111111111111111111111112",
      "So11111111111111111111111111111111111111112",
      "SysvarRent111111111111111111111111111111111",
      "SysvarC1ock11111111111111111111111111111111",
      "Stake11111111111111111111111111111111111111",
    ][n] as string,
  );

// Role of each account, in order, as the Rust vector test checks against to_account_metas.
const roles = (ixn: Instruction) =>
  (ixn.accounts ?? []).map((a) => ({
    writable: a.role === AccountRole.WRITABLE || a.role === AccountRole.WRITABLE_SIGNER,
    signer: a.role === AccountRole.READONLY_SIGNER || a.role === AccountRole.WRITABLE_SIGNER,
  }));
const expectedRoles = (name: string) =>
  ix[name].accounts.map((a: { writable: boolean; signer: boolean }) => ({
    writable: a.writable,
    signer: a.signer,
  }));

describe("program client bytes (shared vectors)", () => {
  it("encodes initialize_community", () => {
    const i = initializeCommunityInstruction({
      programId: HYPHAE_PROGRAM_ID,
      admin: signer,
      mint: other(1),
      community: other(2),
      vault: other(3),
      feeRecipient: hexToBytes(ix.initialize_community.args.fee_recipient),
    });
    expect(bytesToHex(i.data as Uint8Array)).toBe(ix.initialize_community.data);
    expect(roles(i)).toEqual(expectedRoles("initialize_community"));
  });

  it("encodes publish_epoch", () => {
    const a = ix.publish_epoch.args;
    const i = publishEpochInstruction({
      programId: HYPHAE_PROGRAM_ID,
      admin: signer,
      community: other(1),
      vault: other(2),
      feeRecipient: other(3),
      epoch: other(4),
      index: BigInt(a.index),
      root: hexToBytes(a.root),
      auditHash: hexToBytes(a.audit_hash),
      grossLamports: BigInt(a.gross_lamports),
      allocatedLamports: BigInt(a.allocated_lamports),
    });
    expect(bytesToHex(i.data as Uint8Array)).toBe(ix.publish_epoch.data);
    expect(roles(i)).toEqual(expectedRoles("publish_epoch"));
  });

  it("encodes claim", () => {
    const a = ix.claim.args;
    const i = claimInstruction({
      programId: HYPHAE_PROGRAM_ID,
      claimant: signer,
      community: other(1),
      vault: other(2),
      epoch: other(3),
      receipt: other(4),
      score: BigInt(a.score),
      amount: BigInt(a.amount),
      evidenceHash: hexToBytes(a.evidence_hash),
      proof: a.proof.map(hexToBytes),
    });
    expect(bytesToHex(i.data as Uint8Array)).toBe(ix.claim.data);
    expect(roles(i)).toEqual(expectedRoles("claim"));
  });

  it("decodes the community, epoch and claim receipt accounts", () => {
    const c = decodeCommunity(hexToBytes(acc.community.data));
    expect({
      mint: bytesToHex(c.mint),
      admin: bytesToHex(c.admin),
      fee_recipient: bytesToHex(c.feeRecipient),
      outstanding_lamports: c.outstandingLamports.toString(),
      bump: c.bump,
      vault_bump: c.vaultBump,
    }).toEqual(acc.community.fields);

    const e = decodeEpoch(hexToBytes(acc.epoch.data));
    expect({
      community: bytesToHex(e.community),
      index: e.index.toString(),
      root: bytesToHex(e.root),
      audit_hash: bytesToHex(e.auditHash),
      gross_lamports: e.grossLamports.toString(),
      fee_lamports: e.feeLamports.toString(),
      allocated_lamports: e.allocatedLamports.toString(),
      claimed_lamports: e.claimedLamports.toString(),
      published_at: e.publishedAt.toString(),
      bump: e.bump,
    }).toEqual(acc.epoch.fields);

    const r = decodeClaimReceipt(hexToBytes(acc.claim_receipt.data));
    expect({
      epoch: bytesToHex(r.epoch),
      wallet: bytesToHex(r.wallet),
      score: r.score.toString(),
      amount: r.amount.toString(),
      evidence_hash: bytesToHex(r.evidenceHash),
      claimed_at: r.claimedAt.toString(),
      bump: r.bump,
    }).toEqual(acc.claim_receipt.fields);
  });

  it("refuses bytes that are not the named account", () => {
    expect(() => decodeEpoch(hexToBytes(acc.community.data))).toThrow(/discriminator/);
    expect(() => decodeEpoch(hexToBytes(acc.epoch.data).slice(0, 40))).toThrow(/length/);
  });
});
