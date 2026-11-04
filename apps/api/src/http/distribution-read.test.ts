import {
  claimInstruction,
  epochAddress,
  HYPHAE_PROGRAM_ID,
  type ListedInstruction,
  publishEpochInstruction,
  ReadApiV1,
  receiptAddress,
  vaultAddress,
} from "@hyphae/core";
import {
  distributionPublicationEpochMembers,
  epochPublications,
  epochs,
  payoutPolicies,
} from "@hyphae/db";
import { sha256 } from "@noble/hashes/sha2.js";
import { hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { address, createNoopSigner, getAddressEncoder, type Instruction } from "@solana/kit";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type DistributionIntent, loadDistributionIntent } from "../payout/distribution-intent.js";
import { settleCommunity } from "../payout/distribution-settle.js";
import { loadIntent } from "../payout/intent.js";
import { type PublishChain, planPublication } from "../payout/publish.js";
import { randomAddress } from "../payout/ready-seed.js";
import { seedRolloverLane } from "../payout/rollover-seed.js";
import { FAKE_FEE_RECIPIENT, fakeSettleChain } from "../payout/settle-fake.js";
import { createTestDb } from "../rewards/test-db.js";
import {
  readClaim,
  readCommunity,
  readEpoch,
  readWalletClaims,
  readWalletRecord,
} from "./read-service.js";
import { EpochSchema } from "./schemas.js";
import type { SettlementReader } from "./settlement.js";

// The read API over the settle loop's records (Organic design 2026-11-03, §11): a distribution
// published under an epoch's index is that epoch's settlement, read against the chain exactly as
// an epoch's own publication is, and every decided epoch says what the loop did with it.

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-11-20T12:00:00.000Z");
const SOL = 1_000_000_000n;
const PUBLISH_TX = `5${"D".repeat(86)}`;
const CLAIM_TX = `4${"E".repeat(86)}`;

function account(name: string, length: number, fill: (v: DataView, b: Uint8Array) => void) {
  const out = new Uint8Array(length);
  out.set(sha256(utf8ToBytes(`account:${name}`)).subarray(0, 8));
  fill(new DataView(out.buffer), out);
  return out;
}
const key = (a: string) => new Uint8Array(getAddressEncoder().encode(address(a)));
const listed = (i: Instruction): ListedInstruction => ({
  program: i.programAddress,
  accounts: (i.accounts ?? []).map((a) => a.address),
  data: i.data as Uint8Array,
});

// The chain as it holds a distribution: the epoch account under the distribution's index with
// the B11 commitments, created by a publish_epoch sent as PUBLISH_TX, and the receipts of the
// claimed leaves, each created by its claim sent as CLAIM_TX.
async function chainHolding(
  community: string,
  index: bigint,
  intent: DistributionIntent,
  claimedWallets: readonly string[],
) {
  const accounts = new Map<string, Uint8Array>();
  const created = new Map<string, { signature: string; instructions: ListedInstruction[] }>();
  const s = intent.audit.settlement;
  const program = HYPHAE_PROGRAM_ID;
  const epoch = await epochAddress(program, address(community), index);
  const vault = await vaultAddress(program, address(community));
  const claimed = intent.leaves
    .filter((l) => claimedWallets.includes(l.wallet))
    .reduce((sum, l) => sum + l.amountLamports, 0n);
  accounts.set(
    epoch,
    account("Epoch", 8 + 32 + 8 + 32 + 32 + 8 * 4 + 8 + 1, (v, b) => {
      b.set(key(community), 8);
      v.setBigUint64(40, index, true);
      b.set(hexToBytes(intent.root), 48);
      b.set(hexToBytes(intent.auditHash), 80);
      v.setBigUint64(112, BigInt(s.gross_lamports), true);
      v.setBigUint64(120, BigInt(s.fee_lamports), true);
      v.setBigUint64(128, BigInt(s.allocated_lamports), true);
      v.setBigUint64(136, claimed, true);
      v.setBigInt64(144, 1_790_000_000n, true);
    }),
  );
  created.set(epoch, {
    signature: PUBLISH_TX,
    instructions: [
      listed(
        publishEpochInstruction({
          programId: program,
          admin: createNoopSigner(address(randomAddress())),
          community: address(community),
          vault,
          feeRecipient: address(s.fee_recipient),
          epoch,
          index,
          root: hexToBytes(intent.root),
          auditHash: hexToBytes(intent.auditHash),
          grossLamports: BigInt(s.gross_lamports),
          allocatedLamports: BigInt(s.allocated_lamports),
        }),
      ),
    ],
  });
  for (const leaf of intent.leaves) {
    if (!claimedWallets.includes(leaf.wallet)) continue;
    const receipt = await receiptAddress(program, epoch, address(leaf.wallet));
    accounts.set(
      receipt,
      account("ClaimReceipt", 8 + 32 + 32 + 8 + 8 + 32 + 8 + 1, (v, b) => {
        b.set(key(epoch), 8);
        b.set(key(leaf.wallet), 40);
        v.setBigUint64(72, leaf.score, true);
        v.setBigUint64(80, leaf.amountLamports, true);
        b.set(hexToBytes(leaf.evidenceHash), 88);
      }),
    );
    created.set(receipt, {
      signature: CLAIM_TX,
      instructions: [
        listed(
          claimInstruction({
            programId: program,
            claimant: createNoopSigner(address(leaf.wallet)),
            community: address(community),
            vault,
            epoch,
            receipt,
            score: leaf.score,
            amount: leaf.amountLamports,
            evidenceHash: hexToBytes(leaf.evidenceHash),
            proof: leaf.proof.map(hexToBytes),
          }),
        ),
      ],
    });
  }
  const reader: SettlementReader = {
    network: async () => "solana:devnet",
    accounts: async (owner, at) => {
      if (owner !== program) throw new Error("another program");
      return at.map((a) => accounts.get(a) ?? null);
    },
    creation: async (at, matches) => {
      const c = created.get(at);
      return c?.instructions.some(matches) ? c.signature : null;
    },
    balance: async () => 0n,
    latestBlockhash: async () => ({
      blockhash: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
      lastValidBlockHeight: 1000n,
    }),
  };
  return { reader, epoch, vault };
}

// A community whose epochs 1 to 3 rolled over and whose epoch 4 published the distribution, as
// the settle loop records it, against a fake settle chain. Without a publisher the distribution
// stays planned.
// With `staleEpochPlan`, the operator planned epoch 4 as a single-epoch publication before the
// policy was bound, and that plan was never sent: its intent stays stored beside the distribution.
async function distributedLane(opts: { autoPublish: boolean; staleEpochPlan?: boolean }) {
  const chainAddress = randomAddress();
  const seed = await seedRolloverLane(t.db, {
    now: NOW,
    chainAddress,
    plan: [["ordinary"], [], ["effort", "floor"]],
  });
  if (opts.staleEpochPlan) {
    const e4 = seed.epochs[3];
    if (!e4) throw new Error("epoch 4");
    const operatorChain: PublishChain = {
      network: "solana:devnet",
      programId: HYPHAE_PROGRAM_ID,
      readCommunity: async () => ({ address: chainAddress, feeRecipient: FAKE_FEE_RECIPIENT }),
      readEpoch: async () => null,
      publishEpoch: async () => {
        throw new Error("the plan is never sent");
      },
      publishSignature: async () => {
        throw new Error("the plan is never sent");
      },
    };
    // The gate reads the wall clock; the fixture's epoch 4 closes in its future.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    try {
      const plan = await planPublication(t.db, operatorChain, {
        communityId: seed.communityId,
        epochId: e4.id,
        grossLamports: SOL,
      });
      if (plan.status !== "planned") throw new Error(`stale plan ${plan.status}`);
    } finally {
      vi.useRealTimers();
    }
    if (!(await loadIntent(t.db, e4.id))) throw new Error("no stale single-epoch intent");
  }
  await t.db.insert(payoutPolicies).values({
    communityId: seed.communityId,
    effectiveFromIndex: 1,
    thresholdVolumeLamports: 100n * SOL,
    basis: "cumulative",
    rewardBpsOfVolume: 100,
    autoPublish: opts.autoPublish,
  });
  const fake = fakeSettleChain({ community: chainAddress, free: 0n });
  const outcomes = [];
  for (const free of [3n, 6n, 9n, 12n].map((x) => (x * SOL) / 10n)) {
    fake.state.free = free;
    outcomes.push(
      await settleCommunity(
        t.db,
        fake.chain,
        { communityId: seed.communityId },
        { clock: () => NOW },
      ),
    );
  }
  const e4 = seed.epochs[3];
  if (!e4) throw new Error("epoch 4");
  const intent = await loadDistributionIntent(t.db, e4.id);
  if (!intent) throw new Error("no distribution intent");
  return { seed, chainAddress, outcomes, intent };
}

// Each lane runs four settles on PGlite, slow under the full parallel suite.
describe("a distributed epoch's public reads", { timeout: 30_000 }, () => {
  it("serve the distribution as the index epoch's settlement, read against the chain", async () => {
    const { seed, chainAddress, outcomes, intent } = await distributedLane({ autoPublish: true });
    expect(outcomes.map((o) => o.status)).toEqual([
      "rolled_over",
      "rolled_over",
      "rolled_over",
      "published",
    ]);
    const paidWallet = seed.wallets.effort;
    const { reader, epoch, vault } = await chainHolding(chainAddress, 4n, intent, [paidWallet]);
    const s = intent.audit.settlement;

    const e4 = EpochSchema.parse(await readEpoch(t.db, seed.mint, 4, NOW, reader));
    expect(e4.payout).toEqual({ status: "distributed", distributed_in: 4 });
    expect(e4.settlement?.allocation).toEqual({
      status: "published",
      network: "solana:devnet",
      program_id: HYPHAE_PROGRAM_ID,
      community_address: chainAddress,
      vault_address: vault,
      epoch_address: epoch,
      publish_tx: PUBLISH_TX,
      published_at: "2026-09-21T14:13:20.000000Z",
      root: intent.root,
      audit_hash: intent.auditHash,
      gross_lamports: (12n * (SOL / 10n)).toString(),
      fee_bps: "300",
      fee_lamports: s.fee_lamports,
      fee_recipient: s.fee_recipient,
      net_lamports: s.net_lamports,
      allocated_lamports: s.allocated_lamports,
      cap_remainder_lamports: s.cap_remainder_lamports,
      dust_lamports: s.dust_lamports,
      // One leaf per member: three people over four epochs.
      payable_members: "3",
    });
    const payment = e4.settlement?.payment;
    if (payment?.status !== "available") throw new Error(`payment ${payment?.status}`);
    const paidLeaf = intent.leaves.find((l) => l.wallet === paidWallet);
    expect(payment.claimed_lamports).toBe(paidLeaf?.amountLamports.toString());
    expect(payment.claims.map((c) => [c.wallet, c.status, c.claim_tx]).sort()).toEqual(
      intent.leaves
        .map((l) => [
          l.wallet,
          l.wallet === paidWallet ? "paid" : "claimable",
          l.wallet === paidWallet ? CLAIM_TX : null,
        ])
        .sort(),
    );

    // The epochs it paid have no settlement of their own and say where they were paid.
    for (const index of [1, 2, 3]) {
      const e = EpochSchema.parse(await readEpoch(t.db, seed.mint, index, NOW, reader));
      expect(e.payout).toEqual({ status: "distributed", distributed_in: 4 });
      expect(e.settlement?.allocation).toEqual({ status: "unavailable", reason: "no_settlement" });
    }
    const c = ReadApiV1.community.parse(await readCommunity(t.db, seed.mint, NOW, reader));
    expect(c.epochs.map((e) => [e.index, e.payout])).toEqual([
      [5, undefined],
      [4, { status: "distributed", distributed_in: 4 }],
      [3, { status: "distributed", distributed_in: 4 }],
      [2, { status: "distributed", distributed_in: 4 }],
      [1, { status: "distributed", distributed_in: 4 }],
    ]);
    expect(c.epochs[0]).not.toHaveProperty("payout");

    // The claim route, the wallet's claims and the wallet's record serve the distribution leaf,
    // whose evidence is the member-distribution manifest hash.
    const claim = ReadApiV1.claim.parse(
      await readClaim(t.db, seed.mint, 4, paidWallet, NOW, reader),
    );
    expect(claim).toMatchObject({
      epoch: { index: 4 },
      community_address: chainAddress,
      epoch_address: epoch,
      amount_lamports: paidLeaf?.amountLamports.toString(),
      evidence_hash: paidLeaf?.evidenceHash,
      root: intent.root,
      payment: { status: "paid", claim_tx: CLAIM_TX },
    });
    const claimable = seed.wallets.ordinary;
    const mine = ReadApiV1.walletClaims.parse(
      await readWalletClaims(t.db, claimable, { offset: 0, limit: 10 }, NOW, reader),
    );
    expect(mine.total_claims).toBe(1);
    expect(mine.claims.map((x) => [x.epoch.index, x.community_address, x.payment])).toEqual([
      [4, chainAddress, { status: "claimable" }],
    ]);
    const r = ReadApiV1.walletRecord.parse(
      await readWalletRecord(t.db, paidWallet, { offset: 0, limit: 10 }, NOW, reader),
    );
    expect(r.epochs.map((e) => [e.index, e.payout.status])).toEqual([
      [4, "allocated"],
      [1, "unavailable"],
    ]);
    expect(r.epochs[0]?.payout).toMatchObject({
      amount_lamports: paidLeaf?.amountLamports.toString(),
      payment: { status: "paid", claim_tx: CLAIM_TX },
    });
  });

  it("show a rolled-over epoch and a planned distribution, each without a settlement", async () => {
    const { seed, outcomes } = await distributedLane({ autoPublish: false });
    expect(outcomes.map((o) => o.status)).toEqual([
      "rolled_over",
      "rolled_over",
      "rolled_over",
      "planned",
    ]);
    const c = ReadApiV1.community.parse(await readCommunity(t.db, seed.mint, NOW));
    expect(c.epochs.map((e) => [e.index, e.payout])).toEqual([
      [5, undefined],
      [4, { status: "distribution_planned", distributed_in: 4 }],
      [3, { status: "rolled_over", distributed_in: null }],
      [2, { status: "rolled_over", distributed_in: null }],
      [1, { status: "rolled_over", distributed_in: null }],
    ]);
    const e4 = EpochSchema.parse(await readEpoch(t.db, seed.mint, 4, NOW));
    expect(e4.payout).toEqual({ status: "distribution_planned", distributed_in: 4 });
    expect(e4.settlement?.allocation).toEqual({ status: "unavailable", reason: "no_settlement" });
    const e1 = EpochSchema.parse(await readEpoch(t.db, seed.mint, 1, NOW));
    expect(e1.payout).toEqual({ status: "rolled_over", distributed_in: null });
    // Nothing is published, so no wallet has a claim yet.
    const mine = await readWalletClaims(t.db, seed.wallets.effort, { offset: 0, limit: 10 }, NOW);
    expect(mine.total_claims).toBe(0);
  });

  // Review F1 (2026-11-03): an unsent single-epoch plan stored before the policy was bound must not
  // stand in for the distribution recorded under the same index.
  it("serve the recorded distribution, not an unsent single-epoch plan of the same index", async () => {
    const { seed, chainAddress, outcomes, intent } = await distributedLane({
      autoPublish: true,
      staleEpochPlan: true,
    });
    expect(outcomes.map((o) => o.status).at(-1)).toBe("published");
    const e4 = seed.epochs[3];
    if (!e4) throw new Error("epoch 4");
    const stale = await loadIntent(t.db, e4.id);
    expect(stale?.root).not.toBe(intent.root);
    const paidWallet = seed.wallets.effort;
    const { reader, epoch } = await chainHolding(chainAddress, 4n, intent, [paidWallet]);

    const read = EpochSchema.parse(await readEpoch(t.db, seed.mint, 4, NOW, reader));
    expect(read.settlement?.allocation).toMatchObject({
      status: "published",
      epoch_address: epoch,
      root: intent.root,
      audit_hash: intent.auditHash,
      payable_members: "3",
    });
    expect(read.settlement?.payment).toMatchObject({ status: "available" });
    const claim = ReadApiV1.claim.parse(
      await readClaim(t.db, seed.mint, 4, paidWallet, NOW, reader),
    );
    expect(claim).toMatchObject({ root: intent.root, payment: { status: "paid" } });

    // The distribution's stored B7 bytes are verified on this path: one missing fails the read.
    const [b7] = await t.db
      .select({ id: distributionPublicationEpochMembers.id })
      .from(distributionPublicationEpochMembers)
      .where(eq(distributionPublicationEpochMembers.epochId, e4.id))
      .limit(1);
    if (!b7) throw new Error("no B7 row for epoch 4");
    await t.db
      .delete(distributionPublicationEpochMembers)
      .where(eq(distributionPublicationEpochMembers.id, b7.id));
    await expect(readEpoch(t.db, seed.mint, 4, NOW, reader)).rejects.toThrow(/inconsistent/);
  });

  // Codex re-review (2026-11-04): when the unsent plan and the distribution both carry the epoch's
  // recorded root, the plan must not win by default. The epoch's recorded pot picks the intent
  // whose gross matches it; a pot that picks none fails closed.
  describe("when the single-epoch plan and the distribution share the recorded root", () => {
    async function sharedRootLane() {
      const lane = await distributedLane({ autoPublish: true, staleEpochPlan: true });
      const e4 = lane.seed.epochs[3];
      if (!e4) throw new Error("epoch 4");
      await t.db
        .update(epochPublications)
        .set({ root: lane.intent.root })
        .where(eq(epochPublications.epochId, e4.id));
      const [row] = await t.db
        .select({ pot: epochs.potLamports, root: epochs.root })
        .from(epochs)
        .where(eq(epochs.id, e4.id));
      expect(row?.root).toBe(lane.intent.root);
      expect(row?.pot).toBe(BigInt(lane.intent.audit.settlement.gross_lamports));
      expect(row?.pot).not.toBe(SOL);
      return { ...lane, e4 };
    }

    it("serves the distribution whose gross matches the recorded pot", async () => {
      const { seed, chainAddress, intent } = await sharedRootLane();
      const { reader, epoch } = await chainHolding(chainAddress, 4n, intent, [seed.wallets.effort]);
      const read = EpochSchema.parse(await readEpoch(t.db, seed.mint, 4, NOW, reader));
      expect(read.settlement?.allocation).toMatchObject({
        status: "published",
        epoch_address: epoch,
        root: intent.root,
        audit_hash: intent.auditHash,
      });
    });

    it("serves no intent when the recorded pot matches neither gross", async () => {
      const { seed, chainAddress, intent, e4 } = await sharedRootLane();
      await t.db.update(epochs).set({ potLamports: 7n }).where(eq(epochs.id, e4.id));
      const { reader } = await chainHolding(chainAddress, 4n, intent, [seed.wallets.effort]);
      const read = EpochSchema.parse(await readEpoch(t.db, seed.mint, 4, NOW, reader));
      expect(read.settlement?.allocation.status).toBe("unavailable");
    });
  });

  // Review F3 (2026-11-03): a member paid by the distribution with no intake in the index epoch
  // still sees that payout in their wallet record, once.
  it("show a distribution leaf in the wallet record of a member idle in the index epoch", async () => {
    const { seed, chainAddress, intent } = await distributedLane({ autoPublish: true });
    const wallet = seed.wallets.ordinary;
    const leaf = intent.leaves.find((l) => l.wallet === wallet);
    if (!leaf) throw new Error("ordinary has no distribution leaf");
    const { reader } = await chainHolding(chainAddress, 4n, intent, []);

    const r = ReadApiV1.walletRecord.parse(
      await readWalletRecord(t.db, wallet, { offset: 0, limit: 10 }, NOW, reader),
    );
    expect(r.epochs.map((e) => [e.index, e.member_id, e.payout.status])).toEqual([
      [4, seed.members.ordinary, "allocated"],
      [2, seed.members.ordinary, "unavailable"],
      [1, seed.members.ordinary, "unavailable"],
    ]);
    expect(r.epochs[0]).toMatchObject({
      contributions: [],
      totals: { contributions: 0, point_units: "0" },
      payout: {
        amount_lamports: leaf.amountLamports.toString(),
        payment: { status: "claimable" },
      },
    });
    const allocated = r.epochs.filter((e) => e.payout.status === "allocated");
    expect(allocated).toHaveLength(1);
    expect(r.total_epochs).toBe(3);
    // The claims list agrees: one claim, under epoch 4.
    const mine = ReadApiV1.walletClaims.parse(
      await readWalletClaims(t.db, wallet, { offset: 0, limit: 10 }, NOW, reader),
    );
    expect(mine.claims.map((c) => [c.epoch.index, c.amount_lamports])).toEqual([
      [4, leaf.amountLamports.toString()],
    ]);
  });
});
