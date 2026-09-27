import {
  claimInstruction,
  epochAddress,
  HYPHAE_PROGRAM_ID,
  type ListedInstruction,
  leafHash,
  publishEpochInstruction,
  ReadApiV1,
  receiptAddress,
  vaultAddress,
  verifyProof,
} from "@hyphae/core";
import { communities, leaves } from "@hyphae/db";
import { sha256 } from "@noble/hashes/sha2.js";
import { hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import {
  type Address,
  address,
  createNoopSigner,
  getAddressEncoder,
  type Instruction,
} from "@solana/kit";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadIntent, type PublicationIntent } from "../payout/intent.js";
import { type PublishChain, publishEpoch } from "../payout/publish.js";
import { type ReadySeed, randomAddress, seedReadyEpoch } from "../payout/ready-seed.js";
import { createTestDb } from "../rewards/test-db.js";
import { readClaim, readEpoch, readWalletClaims } from "./read-service.js";
import { mapLimit, type SettlementReader } from "./settlement.js";

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

// How a confirmed transaction lists an instruction.
const listed = (i: Instruction): ListedInstruction => ({
  program: i.programAddress,
  accounts: (i.accounts ?? []).map((a) => a.address),
  data: i.data as Uint8Array,
});
const transfer = (to: string): ListedInstruction => ({
  program: "11111111111111111111111111111111",
  accounts: [FEE_RECIPIENT, to],
  data: Uint8Array.of(2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0),
});

type Sent = { signature: string; instructions: ListedInstruction[] };

function fakeReader(network: "solana:devnet" | "solana:mainnet" = "solana:devnet") {
  const accounts = new Map<string, Uint8Array>();
  // The successful transactions that touched each account, oldest first.
  const touched = new Map<string, Sent[]>();
  const hints: { at: string; signature?: string | null; blockTime?: bigint }[] = [];
  const state = { down: false, slow: new Set<string>(), inFlight: 0, maxInFlight: 0 };
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
      if (at.some((a) => state.slow.has(a))) await new Promise(() => {});
      return at.map((a) => accounts.get(a) ?? null);
    },
    creation: async (at, matches, hint = {}) => {
      up();
      hints.push({ at, ...hint });
      state.inFlight += 1;
      state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
      if (state.slow.has(at)) await new Promise(() => {});
      await new Promise((resolve) => setTimeout(resolve, 5));
      state.inFlight -= 1;
      return (touched.get(at) ?? []).find((t) => t.instructions.some(matches))?.signature ?? null;
    },
    latestBlockhash: async () => {
      up();
      return { blockhash: BLOCKHASH, lastValidBlockHeight: 1000n };
    },
  };
  return { reader, accounts, touched, hints, state };
}

// A seeded ready epoch published through the real publish job, as the chain would show it.
async function published(wallets: Partial<ReadySeed["wallets"]> = {}): Promise<{
  seed: ReadySeed;
  intent: PublicationIntent;
  community: string;
  epoch: Address;
}> {
  const community = randomAddress();
  const seed = await seedReadyEpoch(t.db, { now: NOW, chainAddress: community, wallets });
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

type Published = Awaited<ReturnType<typeof published>>;

// The publication as the chain holds it: the epoch account, created by a publish_epoch sent as
// `signature` with exactly the intent's commitments.
async function onChain(p: Published, claimed = 0n, signature = PUBLISH_TX, fake = fakeReader()) {
  fake.accounts.set(p.epoch, epochAccount(p.community, p.intent, claimed));
  const s = p.intent.audit.settlement;
  const community = address(p.community);
  const publish = publishEpochInstruction({
    programId: HYPHAE_PROGRAM_ID,
    admin: createNoopSigner(address(randomAddress())),
    community,
    vault: await vaultAddress(HYPHAE_PROGRAM_ID, community),
    feeRecipient: address(s.fee_recipient),
    epoch: p.epoch,
    index: 1n,
    root: hexToBytes(p.intent.root),
    auditHash: hexToBytes(p.intent.auditHash),
    grossLamports: BigInt(s.gross_lamports),
    allocatedLamports: BigInt(s.allocated_lamports),
  });
  fake.touched.set(p.epoch, [
    { signature: `2${"T".repeat(86)}`, instructions: [transfer(p.epoch)] },
    { signature, instructions: [listed(publish)] },
  ]);
  return fake;
}

type Leaf = PublicationIntent["leaves"][number];

// A leaf claimed on-chain: its receipt, created by a claim sent as CLAIM_TX, after a transfer to
// the receipt's address that is not the claim.
async function claimed(fake: ReturnType<typeof fakeReader>, p: Published, leaf: Leaf) {
  const receipt = await receiptAddress(HYPHAE_PROGRAM_ID, p.epoch, address(leaf.wallet));
  fake.accounts.set(receipt, receiptAccount(p.epoch, leaf));
  const community = address(p.community);
  const claim = claimInstruction({
    programId: HYPHAE_PROGRAM_ID,
    claimant: createNoopSigner(address(leaf.wallet)),
    community,
    vault: await vaultAddress(HYPHAE_PROGRAM_ID, community),
    epoch: p.epoch,
    receipt,
    score: leaf.score,
    amount: leaf.amountLamports,
    evidenceHash: hexToBytes(leaf.evidenceHash),
    proof: leaf.proof.map(hexToBytes),
  });
  fake.touched.set(receipt, [
    { signature: `3${"T".repeat(86)}`, instructions: [transfer(receipt)] },
    { signature: CLAIM_TX, instructions: [listed(claim)] },
  ]);
  return receipt;
}

const epochOf = async (seed: ReadySeed, reader?: SettlementReader, deadlineMs?: number) => {
  const e = await readEpoch(t.db, seed.mint, 1, NOW, reader, deadlineMs);
  if (!e) throw new Error("no epoch");
  const parsed = ReadApiV1.epoch.parse(e);
  const { settlement } = parsed;
  if (!settlement) throw new Error("no settlement");
  // A4: the first v1 fields stay `unavailable`, pointing to `settlement` once it has more.
  const firstV1 = (x: { status: string }) =>
    x.status === "unavailable" ? x : { status: "unavailable", reason: "see_settlement" };
  expect(parsed.allocation).toEqual(firstV1(settlement.allocation));
  expect(parsed.payment).toEqual(firstV1(settlement.payment));
  return settlement;
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
    const fake = await onChain(p);
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
      // The second the epoch account records, not when the database recorded the publication
      // (a recovery can record it much later).
      published_at: "2026-09-21T14:13:20.000000Z",
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
    // The recorded signature is only a hint, tried with the second the epoch account records.
    expect(fake.hints).toContainEqual({
      at: p.epoch,
      signature: PUBLISH_TX,
      blockTime: 1_790_000_000n,
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

  it("shows the publish transaction the chain proves, never the recorded one unproven", async () => {
    const p = await published();
    const proven = `6${"R".repeat(86)}`;
    const elsewhere = await onChain(p, 0n, proven);
    expect((await epochOf(p.seed, elsewhere.reader)).allocation).toMatchObject({
      status: "published",
      publish_tx: proven,
    });
    // An unrelated transaction recorded as the publication, and no publish_epoch on-chain.
    const unproven = await onChain(p);
    unproven.touched.set(p.epoch, [{ signature: PUBLISH_TX, instructions: [transfer(p.epoch)] }]);
    const e = await epochOf(p.seed, unproven.reader);
    const missing = { status: "unavailable", reason: "chain_transaction_missing" };
    expect([e.allocation, e.payment]).toEqual([missing, missing]);
  });

  it("a receipt on-chain is paid, with the claim transaction that created it", async () => {
    const p = await published();
    const leaf = p.intent.leaves.find((l) => l.memberId === p.seed.members.effort);
    if (!leaf) throw new Error("no effort leaf");
    const fake = await onChain(p, leaf.amountLamports);
    const receipt = await claimed(fake, p, leaf);
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
    // The receipt records the second it was claimed; the lookup tries that second first.
    expect(fake.hints).toContainEqual({ at: receipt, blockTime: 0n });
  });

  it("a transaction that touched a receipt but is not its claim is not shown as one", async () => {
    const p = await published();
    const leaf = p.intent.leaves.find((l) => l.memberId === p.seed.members.effort);
    if (!leaf) throw new Error("no effort leaf");
    const fake = await onChain(p, leaf.amountLamports);
    const receipt = await claimed(fake, p, leaf);
    fake.touched.set(receipt, [{ signature: CLAIM_TX, instructions: [transfer(receipt)] }]);
    const missing = { status: "unavailable", reason: "chain_transaction_missing" };
    expect((await epochOf(p.seed, fake.reader)).payment).toEqual(missing);
    const c = await readClaim(t.db, p.seed.mint, 1, leaf.wallet, NOW, fake.reader);
    expect(c?.payment).toEqual(missing);
  });

  it("a receipt for another amount, or a claimed total the receipts do not explain, is a mismatch", async () => {
    const p = await published();
    const leaf = p.intent.leaves[0];
    if (!leaf) throw new Error("no leaf");
    const wrongAmount = await onChain(p, 1n);
    const receipt = await claimed(wrongAmount, p, leaf);
    wrongAmount.accounts.set(receipt, receiptAccount(p.epoch, leaf, 1n));
    expect((await epochOf(p.seed, wrongAmount.reader)).payment).toEqual({
      status: "unavailable",
      reason: "chain_mismatch",
    });
    const unexplained = await onChain(p, 5n);
    const e = await epochOf(p.seed, unexplained.reader);
    expect(e.allocation.status).toBe("published");
    expect(e.payment).toEqual({ status: "unavailable", reason: "chain_mismatch" });
  });

  it("looks up the receipts' transactions several at a time", async () => {
    const p = await published();
    const total = p.intent.leaves.reduce((sum, l) => sum + l.amountLamports, 0n);
    const fake = await onChain(p, total);
    for (const leaf of p.intent.leaves) await claimed(fake, p, leaf);
    const e = await epochOf(p.seed, fake.reader);
    expect(e.payment.status).toBe("available");
    expect(fake.state.maxInFlight).toBeGreaterThan(1);
  });

  it("gives up on a slow chain by the deadline, keeping a published allocation when only payments are slow", async () => {
    const p = await published();
    const leaf = p.intent.leaves[0];
    if (!leaf) throw new Error("no leaf");
    const fake = await onChain(p, leaf.amountLamports);
    const receipt = await claimed(fake, p, leaf);
    fake.state.slow.add(receipt);
    const started = Date.now();
    const e = await epochOf(p.seed, fake.reader, 200);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(e.allocation.status).toBe("published");
    expect(e.payment).toEqual({ status: "unavailable", reason: "chain_unavailable" });
    // Another member's claim does not wait on that receipt.
    const other = p.intent.leaves[1];
    if (!other) throw new Error("no second leaf");
    const c = await readClaim(t.db, p.seed.mint, 1, other.wallet, NOW, fake.reader, 200);
    expect(c?.payment.status).toBe("claimable");
    const mine = await readClaim(t.db, p.seed.mint, 1, leaf.wallet, NOW, fake.reader, 200);
    expect(mine?.payment).toEqual({ status: "unavailable", reason: "chain_unavailable" });
    fake.state.slow.add(p.epoch);
    const stuck = await epochOf(p.seed, fake.reader, 200);
    const down = { status: "unavailable", reason: "chain_unavailable" };
    expect([stuck.allocation, stuck.payment]).toEqual([down, down]);
  });
});

describe("mapLimit", () => {
  it("runs at most `limit` at a time and keeps the order", async () => {
    let inFlight = 0;
    let most = 0;
    const out = await mapLimit(
      Array.from({ length: 20 }, (_, i) => i),
      8,
      async (i) => {
        inFlight += 1;
        most = Math.max(most, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 2));
        inFlight -= 1;
        return i * 2;
      },
    );
    expect(out).toEqual(Array.from({ length: 20 }, (_, i) => i * 2));
    expect(most).toBe(8);
  });
});

describe("a wallet's claims", () => {
  const all = { offset: 0, limit: 50 };
  const leafOf = (p: Published, wallet: string) => {
    const leaf = p.intent.leaves.find((l) => l.wallet === wallet);
    if (!leaf) throw new Error("no leaf for the wallet");
    return leaf;
  };

  it("lists its leaves in every community, newest publication first, each with a proof of the on-chain root", async () => {
    const wallet = randomAddress();
    const first = await published({ ordinary: wallet });
    const second = await published({ floor: wallet });
    const fake = await onChain(first, leafOf(first, wallet).amountLamports);
    await onChain(second, 0n, PUBLISH_TX, fake);
    await claimed(fake, first, leafOf(first, wallet));

    const w = ReadApiV1.walletClaims.parse(
      await readWalletClaims(t.db, wallet, all, NOW, fake.reader),
    );
    expect(w).toMatchObject({ wallet, total_claims: 2, offset: 0, limit: 50 });
    // Claimable says so without a blockhash: signing reads the epoch's claim route again.
    expect(w.claims.map((c) => [c.community.mint, c.epoch.index, c.payment])).toEqual([
      [second.seed.mint, 1, { status: "claimable" }],
      [first.seed.mint, 1, { status: "paid", claim_tx: CLAIM_TX }],
    ]);
    const [newest] = w.claims;
    expect(newest).toMatchObject({
      network: "solana:devnet",
      program_id: HYPHAE_PROGRAM_ID,
      community_address: second.community,
      epoch_address: second.epoch,
      receipt_address: await receiptAddress(HYPHAE_PROGRAM_ID, second.epoch, address(wallet)),
      amount_lamports: leafOf(second, wallet).amountLamports.toString(),
      root: second.intent.root,
    });
    for (const c of w.claims) {
      const leaf = leafHash({
        wallet: key(wallet),
        epochIndex: BigInt(c.epoch.index),
        score: BigInt(c.score),
        amount: BigInt(c.amount_lamports),
        evidenceHash: hexToBytes(c.evidence_hash),
      });
      expect(verifyProof(hexToBytes(c.root), leaf, c.proof.map(hexToBytes))).toBe(true);
    }
  });

  it("pages in that order, counting every claim", async () => {
    const wallet = randomAddress();
    const first = await published({ effort: wallet });
    const second = await published({ effort: wallet });
    const fake = await onChain(first);
    await onChain(second, 0n, PUBLISH_TX, fake);
    const page = await readWalletClaims(t.db, wallet, { offset: 1, limit: 1 }, NOW, fake.reader);
    expect(page).toMatchObject({ total_claims: 2, offset: 1, limit: 1 });
    expect(page.claims.map((c) => c.community.mint)).toEqual([first.seed.mint]);
  });

  it("leaves out unpublished and retained epochs, and is empty, not missing, for an unknown wallet", async () => {
    const wallet = randomAddress();
    await seedReadyEpoch(t.db, { now: NOW, wallets: { floor: wallet } });
    const retained = await published({ floor: wallet });
    await t.db
      .update(communities)
      .set({ firstPaidEpoch: 2 })
      .where(eq(communities.id, retained.seed.communityId));
    const fake = await onChain(retained);
    expect(await readWalletClaims(t.db, wallet, all, NOW, fake.reader)).toMatchObject({
      total_claims: 0,
      claims: [],
    });
    const nobody = await readWalletClaims(t.db, randomAddress(), all, NOW, fake.reader);
    expect(ReadApiV1.walletClaims.parse(nobody).claims).toEqual([]);
  });

  it("serves every leaf when the chain cannot be read, each payment unavailable with its reason", async () => {
    const wallet = randomAddress();
    const p = await published({ ordinary: wallet });
    const fake = await onChain(p);
    fake.state.down = true;
    const down = await readWalletClaims(t.db, wallet, all, NOW, fake.reader);
    expect(down.claims.map((c) => c.payment)).toEqual([
      { status: "unavailable", reason: "chain_unavailable" },
    ]);
    expect(down.claims[0]?.proof.length).toBeGreaterThan(0);
    const unconfigured = await readWalletClaims(t.db, wallet, all, NOW);
    expect(unconfigured.claims.map((c) => c.payment)).toEqual([
      { status: "unavailable", reason: "chain_unconfigured" },
    ]);
  });

  it("gives up on a slow chain by one deadline for the whole list", async () => {
    const wallet = randomAddress();
    const fake = fakeReader();
    for (let i = 0; i < 3; i += 1) {
      const p = await published({ effort: wallet });
      await onChain(p, 0n, PUBLISH_TX, fake);
      fake.state.slow.add(p.epoch);
    }
    const started = Date.now();
    const w = await readWalletClaims(t.db, wallet, all, NOW, fake.reader, 200);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(w.claims.map((c) => c.payment.status)).toEqual([
      "unavailable",
      "unavailable",
      "unavailable",
    ]);
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
    await claimed(fake, p, leaf);
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
