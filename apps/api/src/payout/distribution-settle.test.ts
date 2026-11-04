import { HYPHAE_PROGRAM_ID, TAGS, taggedHash } from "@hyphae/core";
import {
  distributionPublicationEpochMembers,
  distributionPublicationMembers,
  distributionPublications,
  epochPayoutDecisions,
  epochs,
  holdChecks,
  leaves,
  payoutPolicies,
} from "@hyphae/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../rewards/test-db.js";
import { loadDistributionIntent } from "./distribution-intent.js";
import { type SettleChain, type SettleOutcome, settleCommunity } from "./distribution-settle.js";
import { buildPublication } from "./publication.js";
import { type PublishArgs, type PublishChain, publishEpoch } from "./publish.js";
import { randomAddress, seedReadyEpoch } from "./ready-seed.js";
import { seedRolloverLane } from "./rollover-seed.js";
import { FAKE_FEE_RECIPIENT, fakeSettleChain } from "./settle-fake.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-11-20T12:00:00.000Z");
const SOL = 1_000_000_000n;
const FEE_RECIPIENT = FAKE_FEE_RECIPIENT;
const SETTINGS = {
  network: "solana:devnet" as const,
  programId: HYPHAE_PROGRAM_ID,
  feeRecipient: FEE_RECIPIENT,
};
const fakeChain = fakeSettleChain;

const policyFor = async (
  communityId: string,
  over: Partial<typeof payoutPolicies.$inferInsert> = {},
) => {
  const [row] = await t.db
    .insert(payoutPolicies)
    .values({
      communityId,
      effectiveFromIndex: 1,
      thresholdVolumeLamports: 100n * SOL,
      basis: "cumulative",
      // 1% of each traded lamport reaches the vault: 1 SOL of accrual is 100 SOL of volume.
      rewardBpsOfVolume: 100,
      autoPublish: true,
      ...over,
    })
    .returning();
  if (!row) throw new Error("policy");
  return row;
};

async function ready() {
  const chainAddress = randomAddress();
  const seed = await seedReadyEpoch(t.db, { now: NOW, chainAddress });
  return { seed, chainAddress, input: { communityId: seed.communityId } };
}
const settle = (chain: SettleChain, communityId: string) =>
  settleCommunity(t.db, chain, { communityId }, { clock: () => NOW });
const epochRow = async (id: string) =>
  (await t.db.select().from(epochs).where(eq(epochs.id, id)))[0];
const leafRows = (id: string) => t.db.select().from(leaves).where(eq(leaves.epochId, id));
const decisionRows = (communityId: string) =>
  t.db
    .select({ decision: epochPayoutDecisions, index: epochs.index })
    .from(epochPayoutDecisions)
    .innerJoin(epochs, eq(epochs.id, epochPayoutDecisions.epochId))
    .where(eq(epochPayoutDecisions.communityId, communityId))
    .orderBy(asc(epochs.index));
const intentOf = async (epochId: string) => {
  const [publication] = await t.db
    .select()
    .from(distributionPublications)
    .where(eq(distributionPublications.epochId, epochId));
  const members = publication
    ? await t.db
        .select()
        .from(distributionPublicationMembers)
        .where(eq(distributionPublicationMembers.publicationId, publication.id))
    : [];
  return { publication, members };
};
function published(out: SettleOutcome) {
  if (out.status !== "published") throw new Error(`not published: ${JSON.stringify(out)}`);
  return out;
}

describe("settleCommunity: one epoch", () => {
  it("publishes an epoch that meets the threshold, with its accrual as the gross", async () => {
    const { seed, chainAddress, input } = await ready();
    await policyFor(seed.communityId);
    const fake = fakeChain({ community: chainAddress, free: 2n * SOL });
    // The single-epoch allocation of the same pot: a one-epoch distribution pays the same.
    const single = await buildPublication(
      t.db,
      { communityId: seed.communityId, epochId: seed.epochId },
      { ...SETTINGS, grossLamports: 2n * SOL },
    );
    if (single.status !== "ready") throw new Error("not ready");

    const out = published(await settle(fake.chain, input.communityId));
    expect(out).toMatchObject({
      epochIndex: 1,
      grossLamports: 2n * SOL,
      epochs: 1,
      leaves: 3,
      recovered: false,
      signature: "sig-publish",
    });
    expect(fake.calls.publish).toHaveLength(1);
    expect(fake.calls.publish[0]).toMatchObject({
      community: chainAddress,
      index: 1n,
      grossLamports: 2n * SOL,
      allocatedLamports: single.allocation.allocatedLamports,
      feeRecipient: FEE_RECIPIENT,
      root: out.root,
      auditHash: out.auditHash,
    });
    expect(await epochRow(seed.epochId)).toMatchObject({
      status: "published",
      root: out.root,
      potLamports: 2n * SOL,
      publishTx: "sig-publish",
    });
    const recorded = await leafRows(seed.epochId);
    const amountByWallet = (rows: { wallet: string; amountLamports: bigint }[]) =>
      new Map(rows.map((l) => [l.wallet, l.amountLamports]));
    expect(amountByWallet(recorded)).toEqual(amountByWallet(single.leaves));
    const decisions = await decisionRows(seed.communityId);
    expect(decisions.map((d) => [d.index, d.decision.outcome])).toEqual([[1, "distributed"]]);
    expect(decisions[0]?.decision).toMatchObject({
      freeLamports: 2n * SOL,
      accrualLamports: 2n * SOL,
      volumeLamports: 200n * SOL,
      distributionEpochId: seed.epochId,
    });
    // The intent was stored with the bytes that were sent.
    const { publication } = await intentOf(seed.epochId);
    expect(publication).toMatchObject({ root: out.root, auditHash: out.auditHash });
    expect(taggedHash(TAGS.distributionAudit, publication?.auditManifest as string)).toBe(
      out.auditHash,
    );
  });

  it("rolls over an epoch below the threshold: a decision row, and nothing sent", async () => {
    const { seed, chainAddress, input } = await ready();
    await policyFor(seed.communityId);
    const fake = fakeChain({ community: chainAddress, free: SOL / 2n });
    expect(await settle(fake.chain, input.communityId)).toEqual({
      status: "rolled_over",
      epochIndex: 1,
      reason: "below_threshold",
      accrualLamports: SOL / 2n,
      volumeLamports: 50n * SOL,
    });
    expect(fake.calls.publish).toHaveLength(0);
    expect(fake.calls.found).toHaveLength(0);
    expect(await leafRows(seed.epochId)).toHaveLength(0);
    expect(await epochRow(seed.epochId)).toMatchObject({ status: "closed", root: null });
    expect((await intentOf(seed.epochId)).publication).toBeUndefined();
    const [decision] = await decisionRows(seed.communityId);
    expect(decision?.decision).toMatchObject({
      outcome: "rolled_over",
      reason: "below_threshold",
      freeLamports: SOL / 2n,
      accrualLamports: SOL / 2n,
      volumeLamports: 50n * SOL,
      distributionEpochId: null,
    });
    // Decided once: the next run finds nothing due and writes nothing.
    expect(await settle(fake.chain, input.communityId)).toEqual({ status: "nothing_due" });
    expect(fake.calls).toMatchObject({ publish: [], found: [] });
    expect(await decisionRows(seed.communityId)).toHaveLength(1);
  });

  it("stores a fee-derived volume past 2^63 exactly, and settles on it", async () => {
    const { seed, chainAddress, input } = await ready();
    // One basis point of each traded lamport reaches the vault: 10^15 lamports of accrual is
    // 10^19 of volume, past a signed 64-bit integer (review, 2026-11-03).
    await policyFor(seed.communityId, { rewardBpsOfVolume: 1 });
    const fake = fakeChain({ community: chainAddress, free: 10n ** 15n });
    const out = published(await settle(fake.chain, input.communityId));
    expect(out.grossLamports).toBe(10n ** 15n);
    const [decision] = await decisionRows(seed.communityId);
    expect(10n ** 19n > 2n ** 63n).toBe(true);
    expect(decision?.decision.volumeLamports).toBe(10n ** 19n);
    const { publication } = await intentOf(seed.epochId);
    const audit = JSON.parse(publication?.auditManifest as string) as {
      distribution: { volume_lamports: string };
    };
    expect(audit.distribution.volume_lamports).toBe((10n ** 19n).toString());
  });

  it("decides on one snapshot of the vault balance and the outstanding figure", async () => {
    const { seed, chainAddress, input } = await ready();
    await policyFor(seed.communityId);
    const fake = fakeChain({ community: chainAddress, free: SOL / 2n, outstanding: 100n });
    // Every chain read lands right after another publication (fee 1, allocation 49). Paired from
    // two reads, the balance of one would meet the outstanding figure of the other and the free
    // balance would be off by a publication (review 2026-11-03, P1).
    const read = fake.chain.readCommunity;
    const drifting: SettleChain = {
      ...fake.chain,
      readCommunity: async (i) => {
        fake.state.free -= 50n;
        fake.state.outstanding += 49n;
        return read(i);
      },
    };
    expect(await settle(drifting, input.communityId)).toMatchObject({
      status: "rolled_over",
      accrualLamports: SOL / 2n - 50n,
    });
    expect(fake.calls.read).toBe(1);
    expect((await decisionRows(seed.communityId))[0]?.decision).toMatchObject({
      freeLamports: SOL / 2n - 50n,
      accrualLamports: SOL / 2n - 50n,
    });
  });

  it("refuses a free balance past the decision column's signed 64-bit range, with a clear error", async () => {
    const { seed, chainAddress, input } = await ready();
    await policyFor(seed.communityId);
    // 2^63 fits a u64 but not a Postgres bigint; the whole SOL supply is near 5.8e17, so this is
    // a broken read, refused before any write (review round 2, P2).
    const fake = fakeChain({ community: chainAddress, free: 2n ** 63n });
    await expect(settle(fake.chain, input.communityId)).rejects.toThrow(/signed 64-bit/);
    expect(fake.calls.publish).toHaveLength(0);
    expect(await decisionRows(seed.communityId)).toHaveLength(0);
    expect((await intentOf(seed.epochId)).publication).toBeUndefined();
  });

  it("rolls over, with the accrual kept, when the reward share is unknown", async () => {
    const { seed, chainAddress, input } = await ready();
    await policyFor(seed.communityId, { rewardBpsOfVolume: null });
    const fake = fakeChain({ community: chainAddress, free: 2n * SOL });
    expect(await settle(fake.chain, input.communityId)).toMatchObject({
      status: "rolled_over",
      reason: "volume_unknown",
      accrualLamports: 2n * SOL,
      volumeLamports: null,
    });
    expect((await decisionRows(seed.communityId))[0]?.decision).toMatchObject({
      accrualLamports: 2n * SOL,
      volumeLamports: null,
    });
  });

  it("does nothing for a community without a policy; the operator's publish still works", async () => {
    const { seed, chainAddress, input } = await ready();
    const fake = fakeChain({ community: chainAddress, free: 2n * SOL });
    expect(await settle(fake.chain, input.communityId)).toEqual({ status: "no_policy" });
    expect(fake.calls).toMatchObject({ publish: [], found: [] });
    expect(await decisionRows(seed.communityId)).toHaveLength(0);

    const manual: PublishChain = {
      network: SETTINGS.network,
      programId: SETTINGS.programId,
      readCommunity: async () => ({ address: chainAddress, feeRecipient: FEE_RECIPIENT }),
      readEpoch: async () => null,
      publishEpoch: async () => "sig-manual",
      publishSignature: async () => "sig-manual",
    };
    expect(
      await publishEpoch(t.db, manual, {
        communityId: seed.communityId,
        epochId: seed.epochId,
        grossLamports: SOL,
      }),
    ).toMatchObject({ status: "published", signature: "sig-manual", leaves: 3 });
  });

  it("refuses a community that is not bound to its on-chain account", async () => {
    const unbound = await seedReadyEpoch(t.db, { now: NOW, chainAddress: null });
    await policyFor(unbound.communityId);
    const fake = fakeChain({ community: randomAddress(), free: 2n * SOL });
    expect(await settle(fake.chain, unbound.communityId)).toEqual({
      status: "refused",
      reason: "community_not_on_chain",
    });
    const other = await ready();
    await policyFor(other.seed.communityId);
    expect(await settle(fake.chain, other.input.communityId)).toEqual({
      status: "refused",
      reason: "community_not_on_chain",
    });
    expect(fake.calls).toMatchObject({ publish: [], found: [] });
  });

  it("recovers a run that stopped after its send, without sending again", async () => {
    const { seed, chainAddress, input } = await ready();
    await policyFor(seed.communityId);
    const fake = fakeChain({ community: chainAddress, free: 2n * SOL });
    const publisher = fake.chain.publisher as NonNullable<SettleChain["publisher"]>;
    const landsThenStops: SettleChain = {
      ...fake.chain,
      publisher: {
        address: publisher.address,
        publishEpoch: async (i) => {
          await publisher.publishEpoch(i);
          throw new Error("process killed after the send");
        },
      },
    };
    await expect(settle(landsThenStops, input.communityId)).rejects.toThrow(/killed/);
    expect(await leafRows(seed.epochId)).toHaveLength(0);
    expect((await decisionRows(seed.communityId))[0]?.decision.outcome).toBe(
      "distribution_planned",
    );
    const { publication } = await intentOf(seed.epochId);

    const out = published(await settle(fake.chain, input.communityId));
    expect(out).toMatchObject({
      recovered: true,
      signature: "sig-found-on-chain",
      root: publication?.root,
      auditHash: publication?.auditHash,
    });
    expect(fake.calls.publish).toHaveLength(1);
    expect(fake.calls.found).toHaveLength(1);
    expect(await leafRows(seed.epochId)).toHaveLength(3);
    expect((await decisionRows(seed.communityId))[0]?.decision).toMatchObject({
      outcome: "distributed",
      distributionEpochId: seed.epochId,
    });
    expect((await epochRow(seed.epochId))?.publishTx).toBe("sig-found-on-chain");
  });

  it("stops when the on-chain epoch commits to something else", async () => {
    const { seed, chainAddress, input } = await ready();
    await policyFor(seed.communityId);
    const fake = fakeChain({ community: chainAddress, free: 2n * SOL });
    fake.state.onChain.set(1n, {
      root: "ab".repeat(32),
      auditHash: "cd".repeat(32),
      grossLamports: 2n * SOL,
      allocatedLamports: 1n,
    });
    await expect(settle(fake.chain, input.communityId)).rejects.toThrow(/differs/);
    expect(fake.calls.publish).toHaveLength(0);
    expect(await leafRows(seed.epochId)).toHaveLength(0);
  });
});

describe("settleCommunity: a planned distribution", () => {
  it("stores the intent and sends nothing while auto_publish is off; a later run sends it as stored", async () => {
    const { seed, chainAddress, input } = await ready();
    const policy = await policyFor(seed.communityId, { autoPublish: false });
    const fake = fakeChain({ community: chainAddress, free: 2n * SOL });
    const notified: SettleOutcome[] = [];
    const out = await settleCommunity(t.db, fake.chain, input, {
      clock: () => NOW,
      notify: async (p) => {
        notified.push(p);
      },
    });
    expect(out).toMatchObject({
      status: "planned",
      reason: "auto_publish_off",
      epochIndex: 1,
      grossLamports: 2n * SOL,
      leaves: 3,
    });
    expect(notified).toEqual([out]);
    expect(fake.calls.publish).toHaveLength(0);
    expect(await leafRows(seed.epochId)).toHaveLength(0);
    expect((await epochRow(seed.epochId))?.status).toBe("closed");
    const { publication, members } = await intentOf(seed.epochId);
    if (out.status !== "planned") throw new Error("planned");
    expect(publication).toMatchObject({ root: out.root, auditHash: out.auditHash });
    expect(members).toHaveLength(3);
    for (const m of members) {
      expect(taggedHash(TAGS.memberDistribution, m.manifest)).toBe(m.manifestHash);
    }
    expect((await decisionRows(seed.communityId))[0]?.decision).toMatchObject({
      outcome: "distribution_planned",
      distributionEpochId: seed.epochId,
    });
    // Planned again, not rebuilt: the same intent row, no second decision.
    expect(await settle(fake.chain, input.communityId)).toMatchObject({ status: "planned" });
    expect((await intentOf(seed.epochId)).publication?.id).toBe(publication?.id);
    expect(await decisionRows(seed.communityId)).toHaveLength(1);

    await t.db
      .update(payoutPolicies)
      .set({ autoPublish: true })
      .where(eq(payoutPolicies.id, policy.id));
    const sent = published(await settle(fake.chain, input.communityId));
    expect(sent).toMatchObject({ recovered: false, root: publication?.root });
    expect(fake.calls.publish[0]).toMatchObject({
      root: publication?.root,
      auditHash: publication?.auditHash,
      grossLamports: 2n * SOL,
    });
    expect((await decisionRows(seed.communityId))[0]?.decision.outcome).toBe("distributed");
  });

  it("plans when no publisher is configured, or when the publisher is not the admin", async () => {
    const none = await ready();
    await policyFor(none.seed.communityId);
    const noKey = fakeChain({ community: none.chainAddress, free: 2n * SOL, publisher: null });
    expect(await settle(noKey.chain, none.input.communityId)).toMatchObject({
      status: "planned",
      reason: "no_publisher",
    });
    const other = await ready();
    await policyFor(other.seed.communityId);
    const stranger = fakeChain({
      community: other.chainAddress,
      free: 2n * SOL,
      publisher: randomAddress(),
    });
    expect(await settle(stranger.chain, other.input.communityId)).toMatchObject({
      status: "planned",
      reason: "publisher_not_admin",
    });
    expect(stranger.calls.publish).toHaveLength(0);
  });

  it("the database refuses distribution bytes and hashes that disagree", async () => {
    const { seed, chainAddress, input } = await ready();
    await policyFor(seed.communityId, { autoPublish: false });
    await settle(fakeChain({ community: chainAddress, free: 2n * SOL }).chain, input.communityId);
    const { publication, members } = await intentOf(seed.epochId);
    const violates = (error: unknown) =>
      (error as { cause?: { code?: string } }).cause?.code === "23514";
    await expect(
      t.db
        .update(distributionPublications)
        .set({ auditManifest: `${publication?.auditManifest} ` })
        .where(eq(distributionPublications.id, publication?.id as string)),
    ).rejects.toSatisfy(violates);
    await expect(
      t.db
        .update(distributionPublicationMembers)
        .set({ manifestHash: "0".repeat(64) })
        .where(eq(distributionPublicationMembers.id, members[0]?.id as string)),
    ).rejects.toSatisfy(violates);
  });
});

describe("settleCommunity: several epochs", () => {
  it("pays three rolled-over epochs and the fourth in one distribution under index 4", async () => {
    const chainAddress = randomAddress();
    // Epoch 1: effort, ordinary and floor; 2: ordinary; 3: nobody; 4: effort and floor.
    const seed = await seedRolloverLane(t.db, {
      now: NOW,
      chainAddress,
      plan: [["ordinary"], [], ["effort", "floor"]],
    });
    await policyFor(seed.communityId);
    const fake = fakeChain({ community: chainAddress, free: 0n });
    const accruals = [3n * SOL, 3n * SOL, 3n * SOL, 3n * SOL].map((x) => x / 10n);
    const outcomes: SettleOutcome[] = [];
    let free = 0n;
    for (const accrual of accruals) {
      free += accrual;
      fake.state.free = free;
      outcomes.push(await settle(fake.chain, seed.communityId));
    }
    // 0.3, 0.6 and 0.9 SOL of accrual are 30, 60 and 90 SOL of volume: below 100 each time.
    expect(outcomes.slice(0, 3)).toEqual([
      {
        status: "rolled_over",
        epochIndex: 1,
        reason: "below_threshold",
        accrualLamports: accruals[0],
        volumeLamports: 30n * SOL,
      },
      {
        status: "rolled_over",
        epochIndex: 2,
        reason: "below_threshold",
        accrualLamports: accruals[1],
        volumeLamports: 30n * SOL,
      },
      {
        status: "rolled_over",
        epochIndex: 3,
        reason: "below_threshold",
        accrualLamports: accruals[2],
        volumeLamports: 30n * SOL,
      },
    ]);
    const out = published(outcomes[3] as SettleOutcome);
    expect(out).toMatchObject({ epochIndex: 4, grossLamports: 12n * (SOL / 10n), epochs: 4 });
    expect(fake.calls.publish).toHaveLength(1);
    const sent = fake.calls.publish[0] as PublishArgs;
    expect(sent).toMatchObject({ index: 4n, grossLamports: 12n * (SOL / 10n) });
    expect(sent.allocatedLamports).toBe(out.allocatedLamports);

    const [e1, e2, e3, e4] = seed.epochs;
    if (!e1 || !e2 || !e3 || !e4) throw new Error("epochs");
    // One leaf per wallet: three people over four epochs, every lamport allocated under index 4.
    const recorded = await leafRows(e4.id);
    expect(recorded.map((l) => l.wallet).sort()).toEqual(
      [seed.wallets.effort, seed.wallets.ordinary, seed.wallets.floor].sort(),
    );
    expect(recorded.reduce((s, l) => s + l.amountLamports, 0n)).toBe(out.allocatedLamports);
    for (const e of [e1, e2, e3]) {
      expect(await epochRow(e.id)).toMatchObject({ status: "closed", root: null });
      expect(await leafRows(e.id)).toHaveLength(0);
    }
    expect(await epochRow(e4.id)).toMatchObject({
      status: "published",
      root: out.root,
      potLamports: 12n * (SOL / 10n),
      publishTx: "sig-publish",
    });
    const decisions = await decisionRows(seed.communityId);
    expect(
      decisions.map((d) => [d.index, d.decision.outcome, d.decision.distributionEpochId]),
    ).toEqual([1, 2, 3, 4].map((i) => [i, "distributed", e4.id]));
    expect(decisions.reduce((s, d) => s + d.decision.accrualLamports, 0n)).toBe(out.grossLamports);

    // The audit: every epoch with its accrual, epoch 3's accrual merged into epoch 4's slice.
    const { publication } = await intentOf(e4.id);
    const audit = JSON.parse(publication?.auditManifest as string) as {
      distribution: { index: string; volume_lamports: string };
      epochs: { epoch: { id: string; index: string }; merged_into: string | null }[];
      settlement: { gross_lamports: string };
    };
    expect(audit.distribution).toMatchObject({
      index: "4",
      volume_lamports: (120n * SOL).toString(),
    });
    expect(audit.settlement.gross_lamports).toBe((12n * (SOL / 10n)).toString());
    expect(audit.epochs.map((e) => [e.epoch.id, e.epoch.index, e.merged_into])).toEqual([
      [e1.id, "1", null],
      [e2.id, "2", null],
      [e3.id, "3", "4"],
      [e4.id, "4", null],
    ]);
    expect(await settle(fake.chain, seed.communityId)).toEqual({ status: "nothing_due" });

    // The B7 bytes of every paid epoch are stored with the intent: epoch 1's four members, epoch
    // 2's one, none for epoch 3 (nobody posted) and epoch 4's two, each hashing to the hash the
    // audit and the B10 parts commit to.
    const b7 = await t.db
      .select()
      .from(distributionPublicationEpochMembers)
      .where(eq(distributionPublicationEpochMembers.publicationId, publication?.id as string));
    const byEpoch = (id: string) => b7.filter((r) => r.epochId === id);
    expect([e1, e2, e3, e4].map((e) => byEpoch(e.id).length)).toEqual([4, 1, 0, 2]);
    const fullAudit = JSON.parse(publication?.auditManifest as string) as {
      epochs: { epoch: { id: string }; members: { member_id: string; manifest_hash: string }[] }[];
    };
    for (const e of fullAudit.epochs) {
      const rows = byEpoch(e.epoch.id);
      expect(rows.map((r) => [r.memberId, r.manifestHash]).sort()).toEqual(
        e.members.map((m) => [m.member_id, m.manifest_hash]).sort(),
      );
      for (const r of rows) {
        expect(taggedHash(TAGS.memberEpoch, r.manifest)).toBe(r.manifestHash);
        expect(JSON.parse(r.manifest)).toMatchObject({
          epoch: { id: r.epochId },
          member_id: r.memberId,
        });
      }
    }
    const loaded = await loadDistributionIntent(t.db, e4.id);
    expect(loaded?.epochMembers.map((e) => [e.epochId, e.index, e.members.length])).toEqual([
      [e1.id, "1", 4],
      [e2.id, "2", 1],
      [e3.id, "3", 0],
      [e4.id, "4", 2],
    ]);
    const b7Hashes = new Set(b7.map((r) => r.manifestHash));
    for (const m of loaded?.members ?? []) {
      for (const p of m.parts) expect(b7Hashes.has(p.member_epoch_hash)).toBe(true);
    }
  });

  it("refuses an intent whose stored B7 bytes are missing or altered", async () => {
    const chainAddress = randomAddress();
    const seed = await seedRolloverLane(t.db, { now: NOW, chainAddress, plan: [["ordinary"]] });
    await policyFor(seed.communityId, { autoPublish: false });
    const fake = fakeChain({ community: chainAddress, free: 0n });
    fake.state.free = SOL / 2n;
    expect(await settle(fake.chain, seed.communityId)).toMatchObject({ status: "rolled_over" });
    fake.state.free = SOL;
    expect(await settle(fake.chain, seed.communityId)).toMatchObject({ status: "planned" });
    const e2 = seed.epochs[1];
    if (!e2) throw new Error("epoch 2");
    const { publication } = await intentOf(e2.id);
    const rows = await t.db
      .select()
      .from(distributionPublicationEpochMembers)
      .where(eq(distributionPublicationEpochMembers.publicationId, publication?.id as string));
    expect(rows.length).toBeGreaterThan(1);
    // The row is moved to the other epoch below, so its member must have no row there already:
    // the unique index on (publication, epoch, member) would refuse the move.
    const victim = rows.find(
      (r) => !rows.some((o) => o.memberId === r.memberId && o.epochId !== r.epochId),
    );
    if (!victim) throw new Error("no row whose member is absent from the other epoch");

    // The database refuses bytes that no longer hash to the stored hash.
    const violates = (error: unknown) =>
      (error as { cause?: { code?: string } }).cause?.code === "23514";
    await expect(
      t.db
        .update(distributionPublicationEpochMembers)
        .set({ manifest: `${victim.manifest} ` })
        .where(eq(distributionPublicationEpochMembers.id, victim.id)),
    ).rejects.toSatisfy(violates);

    // A row pointed at another epoch, or missing, no longer matches the audit: the intent is
    // refused rather than sent, and the planned run stops.
    const e1 = seed.epochs[0] as { id: string };
    const other = victim.epochId === e1.id ? e2.id : e1.id;
    await t.db
      .update(distributionPublicationEpochMembers)
      .set({ epochId: other })
      .where(eq(distributionPublicationEpochMembers.id, victim.id));
    await expect(loadDistributionIntent(t.db, e2.id)).rejects.toThrow(/inconsistent/);
    await t.db
      .delete(distributionPublicationEpochMembers)
      .where(eq(distributionPublicationEpochMembers.id, victim.id));
    await expect(loadDistributionIntent(t.db, e2.id)).rejects.toThrow(/inconsistent/);
    await expect(settle(fake.chain, seed.communityId)).rejects.toThrow(/inconsistent/);
    expect(fake.calls.publish).toHaveLength(0);
  });

  it("decides epochs in index order: epoch 2 waits while epoch 1 is not final", async () => {
    const chainAddress = randomAddress();
    const seed = await seedRolloverLane(t.db, { now: NOW, chainAddress, plan: [["ordinary"]] });
    await policyFor(seed.communityId);
    const [e1, e2] = seed.epochs;
    if (!e1 || !e2) throw new Error("epochs");
    // Epoch 1's balances were never read: its candidates are held, and epoch 2, though ready,
    // is not decided before it.
    const checks = await t.db.select().from(holdChecks).where(eq(holdChecks.epochId, e1.id));
    await t.db.delete(holdChecks).where(eq(holdChecks.epochId, e1.id));
    const fake = fakeChain({ community: chainAddress, free: SOL / 10n });
    expect(await settle(fake.chain, seed.communityId)).toEqual({
      status: "waiting",
      epochIndex: 1,
      blockers: ["hold_checks_pending"],
    });
    expect(await settle(fake.chain, seed.communityId)).toMatchObject({ status: "waiting" });
    expect(await decisionRows(seed.communityId)).toHaveLength(0);
    expect(fake.calls).toMatchObject({ publish: [], found: [] });

    await t.db.insert(holdChecks).values(checks);
    expect(await settle(fake.chain, seed.communityId)).toMatchObject({
      status: "rolled_over",
      epochIndex: 1,
    });
    fake.state.free = SOL / 5n;
    expect(await settle(fake.chain, seed.communityId)).toMatchObject({
      status: "rolled_over",
      epochIndex: 2,
      accrualLamports: SOL / 10n,
    });
    expect((await decisionRows(seed.communityId)).map((d) => d.index)).toEqual([1, 2]);
  });

  it("decides an epoch with nobody payable once its hold window is over, not before", async () => {
    const chainAddress = randomAddress();
    const seed = await seedRolloverLane(t.db, { now: NOW, chainAddress, plan: [[]] });
    await policyFor(seed.communityId);
    const [e1, e2] = seed.epochs;
    if (!e1 || !e2) throw new Error("epochs");
    const fake = fakeChain({ community: chainAddress, free: SOL / 10n });
    expect(await settle(fake.chain, seed.communityId)).toMatchObject({
      status: "rolled_over",
      epochIndex: 1,
    });
    const inWindow = new Date(e2.closesAt.getTime() + 3_600_000);
    expect(
      await settleCommunity(
        t.db,
        fake.chain,
        { communityId: seed.communityId },
        { clock: () => inWindow },
      ),
    ).toEqual({ status: "waiting", epochIndex: 2, blockers: ["no_payable_members"] });
    expect(await settle(fake.chain, seed.communityId)).toMatchObject({
      status: "rolled_over",
      epochIndex: 2,
      reason: "below_threshold",
    });
    expect((await decisionRows(seed.communityId)).map((d) => d.index)).toEqual([1, 2]);
  });
});
