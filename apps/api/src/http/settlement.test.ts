import {
  epochAddress,
  HYPHAE_PROGRAM_ID,
  leafHash,
  ReadApiV1,
  receiptAddress,
  vaultAddress,
  verifyProof,
} from "@hyphae/core";
import { communities, leaves } from "@hyphae/db";
import { sha256 } from "@noble/hashes/sha2.js";
import { hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { type Address, address, getAddressEncoder } from "@solana/kit";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadIntent, type PublicationIntent } from "../payout/intent.js";
import { type PublishChain, publishEpoch } from "../payout/publish.js";
import { type ReadySeed, randomAddress, seedReadyEpoch } from "../payout/ready-seed.js";
import { createTestDb } from "../rewards/test-db.js";
import { readClaim, readEpoch } from "./read-service.js";
import type { SettlementReader } from "./settlement.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-11-20T12:00:00.000Z");
const FEE_RECIPIENT = "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR";
const PUBLISH_TX = `5${"P".repeat(86)}`;
const CLAIM_TX = `4${"C".repeat(86)}`;
const BLOCKHASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

// Program account bytes, from the layouts the shared vectors pin: an 8-byte discriminator, then
// the fields little-endian in declaration order.
function account(name: string, length: number, fill: (v: DataView, b: Uint8Array) => void) {
  const out = new Uint8Array(length);
  out.set(sha256(utf8ToBytes(`account:${name}`)).subarray(0, 8));
  fill(new DataView(out.buffer), out);
  return out;
}
const key = (a: string) => new Uint8Array(getAddressEncoder().encode(address(a)));

function epochAccount(
  community: string,
  intent: PublicationIntent,
  claimed: bigint,
  over: { root?: string } = {},
) {
  const s = intent.audit.settlement;
  return account("Epoch", 8 + 32 + 8 + 32 + 32 + 8 * 4 + 8 + 1, (v, b) => {
    b.set(key(community), 8);
    v.setBigUint64(40, BigInt(intent.audit.epoch.index), true);
    b.set(hexToBytes(over.root ?? intent.root), 48);
    b.set(hexToBytes(intent.auditHash), 80);
    v.setBigUint64(112, BigInt(s.gross_lamports), true);
    v.setBigUint64(120, BigInt(s.fee_lamports), true);
    v.setBigUint64(128, BigInt(s.allocated_lamports), true);
    v.setBigUint64(136, claimed, true);
    v.setBigInt64(144, 1_790_000_000n, true);
  });
}

function receiptAccount(epoch: string, leaf: PublicationIntent["leaves"][number], amount?: bigint) {
  return account("ClaimReceipt", 8 + 32 + 32 + 8 + 8 + 32 + 8 + 1, (v, b) => {
    b.set(key(epoch), 8);
    b.set(key(leaf.wallet), 40);
    v.setBigUint64(72, leaf.score, true);
    v.setBigUint64(80, amount ?? leaf.amountLamports, true);
    b.set(hexToBytes(leaf.evidenceHash), 88);
  });
}

function fakeReader(network: "solana:devnet" | "solana:mainnet" = "solana:devnet") {
  const accounts = new Map<string, Uint8Array>();
  const signatures = new Map<string, string>();
  const state = { down: false };
  const up = () => {
    if (state.down) throw new Error("rpc down");
  };
  const reader: SettlementReader = {
    network: async () => {
      up();
      return network;
    },
    accounts: async (owner, at) => {
      up();
      expect(owner).toBe(HYPHAE_PROGRAM_ID);
      return at.map((a) => accounts.get(a) ?? null);
    },
    firstSignature: async (at) => {
      up();
      return signatures.get(at) ?? null;
    },
    latestBlockhash: async () => {
      up();
      return { blockhash: BLOCKHASH, lastValidBlockHeight: 1000n };
    },
  };
  return { reader, accounts, signatures, state };
}

// A seeded ready epoch published through the real publish job, as the chain would show it.
async function published(): Promise<{
  seed: ReadySeed;
  intent: PublicationIntent;
  community: string;
  epoch: Address;
}> {
  const community = randomAddress();
  const seed = await seedReadyEpoch(t.db, { now: NOW, chainAddress: community });
  const chain: PublishChain = {
    network: "solana:devnet",
    programId: HYPHAE_PROGRAM_ID,
    readCommunity: async () => ({ address: community, feeRecipient: FEE_RECIPIENT }),
    readEpoch: async () => null,
    publishEpoch: async () => PUBLISH_TX,
    publishSignature: async () => PUBLISH_TX,
  };
  const out = await publishEpoch(t.db, chain, { ...seed, grossLamports: 500_000_000n });
  expect(out.status).toBe("published");
  const intent = await loadIntent(t.db, seed.epochId);
  if (!intent) throw new Error("no intent");
  const epoch = await epochAddress(HYPHAE_PROGRAM_ID, address(community), 1n);
  return { seed, intent, community, epoch };
}

async function onChain(p: Awaited<ReturnType<typeof published>>, claimed = 0n) {
  const fake = fakeReader();
  fake.accounts.set(p.epoch, epochAccount(p.community, p.intent, claimed));
  return fake;
}

const epochOf = async (seed: ReadySeed, reader?: SettlementReader) => {
  const e = await readEpoch(t.db, seed.mint, 1, NOW, reader);
  if (!e) throw new Error("no epoch");
  return ReadApiV1.epoch.parse(e);
};

describe("P14 allocation and payment", () => {
  it("an epoch before the first paid epoch is retained, never zero", async () => {
    const seed = await seedReadyEpoch(t.db, { now: NOW });
    await t.db
      .update(communities)
      .set({ firstPaidEpoch: 2 })
      .where(eq(communities.id, seed.communityId));
    const e = await epochOf(seed, fakeReader().reader);
    const retained = { status: "unavailable", reason: "before_first_paid_epoch" };
    expect([e.allocation, e.payment]).toEqual([retained, retained]);
  });

  it("an epoch not yet published has no settlement", async () => {
    const seed = await seedReadyEpoch(t.db, { now: NOW });
    const e = await epochOf(seed, fakeReader().reader);
    expect(e.allocation).toEqual({ status: "unavailable", reason: "no_settlement" });
  });

  it("a published epoch is unavailable without a chain reader for its network", async () => {
    const p = await published();
    const none = await epochOf(p.seed);
    expect(none.allocation).toEqual({ status: "unavailable", reason: "chain_unconfigured" });
    const mainnet = fakeReader("solana:mainnet");
    const other = await epochOf(p.seed, mainnet.reader);
    expect(other.payment).toEqual({ status: "unavailable", reason: "chain_unconfigured" });
  });

  it("an unreadable chain is unavailable, never zero", async () => {
    const p = await published();
    const fake = await onChain(p);
    fake.state.down = true;
    const e = await epochOf(p.seed, fake.reader);
    const down = { status: "unavailable", reason: "chain_unavailable" };
    expect([e.allocation, e.payment]).toEqual([down, down]);
  });

  it("an epoch account that is missing or commits to another root is a mismatch", async () => {
    const p = await published();
    const missing = await epochOf(p.seed, fakeReader().reader);
    expect(missing.allocation).toEqual({ status: "unavailable", reason: "chain_mismatch" });
    const fake = fakeReader();
    fake.accounts.set(p.epoch, epochAccount(p.community, p.intent, 0n, { root: "ab".repeat(32) }));
    const other = await epochOf(p.seed, fake.reader);
    expect(other.allocation).toEqual({ status: "unavailable", reason: "chain_mismatch" });
    expect(other.payment).toEqual({ status: "unavailable", reason: "chain_mismatch" });
  });

  it("a verified publication shows every number with its transaction, and nothing as paid without a receipt", async () => {
    const p = await published();
    const fake = await onChain(p);
    // A claim transaction string in the database is not evidence of payment (P13).
    await t.db
      .update(leaves)
      .set({ claimTx: CLAIM_TX })
      .where(and(eq(leaves.epochId, p.seed.epochId), eq(leaves.memberId, p.seed.members.effort)));
    const e = await epochOf(p.seed, fake.reader);
    expect(e.allocation).toEqual({
      status: "published",
      network: "solana:devnet",
      program_id: HYPHAE_PROGRAM_ID,
      community_address: p.community,
      vault_address: await vaultAddress(HYPHAE_PROGRAM_ID, address(p.community)),
      epoch_address: p.epoch,
      publish_tx: PUBLISH_TX,
      published_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/),
      root: p.intent.root,
      audit_hash: p.intent.auditHash,
      gross_lamports: "500000000",
      fee_bps: "300",
      fee_lamports: "15000000",
      fee_recipient: FEE_RECIPIENT,
      net_lamports: "485000000",
      allocated_lamports: "304603658",
      cap_remainder_lamports: "180396341",
      dust_lamports: "1",
      payable_members: "3",
    });
    if (e.payment.status !== "available") throw new Error(e.payment.reason);
    expect(e.payment.claimed_lamports).toBe("0");
    expect(e.payment.unclaimed_lamports).toBe("304603658");
    expect(e.payment.claims.map((c) => [c.status, c.claim_tx])).toEqual([
      ["claimable", null],
      ["claimable", null],
      ["claimable", null],
    ]);
  });

  it("a receipt on-chain is paid, with the transaction that created it", async () => {
    const p = await published();
    const leaf = p.intent.leaves.find((l) => l.memberId === p.seed.members.effort);
    if (!leaf) throw new Error("no effort leaf");
    const fake = await onChain(p, leaf.amountLamports);
    const receipt = await receiptAddress(HYPHAE_PROGRAM_ID, p.epoch, address(leaf.wallet));
    fake.accounts.set(receipt, receiptAccount(p.epoch, leaf));
    fake.signatures.set(receipt, CLAIM_TX);
    const e = await epochOf(p.seed, fake.reader);
    if (e.payment.status !== "available") throw new Error(e.payment.reason);
    expect(e.payment.claimed_lamports).toBe(leaf.amountLamports.toString());
    expect(e.payment.unclaimed_lamports).toBe((304_603_658n - leaf.amountLamports).toString());
    expect(e.payment.claims.find((c) => c.member_id === leaf.memberId)).toEqual({
      member_id: leaf.memberId,
      wallet: leaf.wallet,
      amount_lamports: leaf.amountLamports.toString(),
      status: "paid",
      receipt_address: receipt,
      claim_tx: CLAIM_TX,
    });
  });

  it("a receipt for another amount, or a claimed total the receipts do not explain, is a mismatch", async () => {
    const p = await published();
    const leaf = p.intent.leaves[0];
    if (!leaf) throw new Error("no leaf");
    const receipt = await receiptAddress(HYPHAE_PROGRAM_ID, p.epoch, address(leaf.wallet));
    const wrongAmount = await onChain(p, 1n);
    wrongAmount.accounts.set(receipt, receiptAccount(p.epoch, leaf, 1n));
    wrongAmount.signatures.set(receipt, CLAIM_TX);
    expect((await epochOf(p.seed, wrongAmount.reader)).payment).toEqual({
      status: "unavailable",
      reason: "chain_mismatch",
    });
    const unexplained = await onChain(p, 5n);
    const e = await epochOf(p.seed, unexplained.reader);
    expect(e.allocation.status).toBe("published");
    expect(e.payment).toEqual({ status: "unavailable", reason: "chain_mismatch" });
  });
});

describe("the claim route", () => {
  it("serves a wallet's leaf, with a proof that verifies against the on-chain root", async () => {
    const p = await published();
    const fake = await onChain(p);
    const wallet = p.seed.wallets.floor;
    const c = await readClaim(t.db, p.seed.mint, 1, wallet, NOW, fake.reader);
    if (!c) throw new Error("no claim");
    const claim = ReadApiV1.claim.parse(c);
    expect(claim).toMatchObject({
      wallet,
      network: "solana:devnet",
      program_id: HYPHAE_PROGRAM_ID,
      community_address: p.community,
      epoch_address: p.epoch,
      receipt_address: await receiptAddress(HYPHAE_PROGRAM_ID, p.epoch, address(wallet)),
      root: p.intent.root,
      payment: {
        status: "claimable",
        recent_blockhash: BLOCKHASH,
        last_valid_block_height: "1000",
      },
    });
    const leaf = leafHash({
      wallet: key(wallet),
      epochIndex: 1n,
      score: BigInt(claim.score),
      amount: BigInt(claim.amount_lamports),
      evidenceHash: hexToBytes(claim.evidence_hash),
    });
    expect(verifyProof(hexToBytes(claim.root), leaf, claim.proof.map(hexToBytes))).toBe(true);
  });

  it("shows a claimed leaf as paid, with its transaction", async () => {
    const p = await published();
    const leaf = p.intent.leaves.find((l) => l.memberId === p.seed.members.ordinary);
    if (!leaf) throw new Error("no leaf");
    const fake = await onChain(p, leaf.amountLamports);
    const receipt = await receiptAddress(HYPHAE_PROGRAM_ID, p.epoch, address(leaf.wallet));
    fake.accounts.set(receipt, receiptAccount(p.epoch, leaf));
    fake.signatures.set(receipt, CLAIM_TX);
    const c = await readClaim(t.db, p.seed.mint, 1, leaf.wallet, NOW, fake.reader);
    expect(c?.payment).toEqual({ status: "paid", claim_tx: CLAIM_TX });
  });

  it("finds no leaf for a wallet outside the publication, nor in an unpublished epoch", async () => {
    const p = await published();
    const fake = await onChain(p);
    expect(await readClaim(t.db, p.seed.mint, 1, randomAddress(), NOW, fake.reader)).toBeNull();
    expect(
      await readClaim(t.db, p.seed.mint, 1, p.seed.wallets.unsigned, NOW, fake.reader),
    ).toBeNull();
    expect(
      await readClaim(t.db, p.seed.mint, 2, p.seed.wallets.floor, NOW, fake.reader),
    ).toBeNull();
    const unpublished = await seedReadyEpoch(t.db, { now: NOW });
    expect(
      await readClaim(t.db, unpublished.mint, 1, unpublished.wallets.floor, NOW, fake.reader),
    ).toBeNull();
  });

  it("still serves the leaf when the chain cannot be read, with its payment status unavailable", async () => {
    const p = await published();
    const fake = await onChain(p);
    fake.state.down = true;
    const c = await readClaim(t.db, p.seed.mint, 1, p.seed.wallets.floor, NOW, fake.reader);
    expect(c?.payment).toEqual({ status: "unavailable", reason: "chain_unavailable" });
    expect(c?.proof.length).toBeGreaterThan(0);
  });
});
