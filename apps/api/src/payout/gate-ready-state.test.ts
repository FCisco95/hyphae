import { communities, epochs, payoutPolicies } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../rewards/test-db.js";
import { settleCommunity } from "./distribution-settle.js";
import { currentGateReadyNote, dueGateReady, notifiable } from "./gate-ready.js";
import { MYCEL_MINT } from "./holds.js";
import { randomAddress, seedReadyEpoch } from "./ready-seed.js";
import { seedRolloverLane } from "./rollover-seed.js";
import { fakeSettleChain } from "./settle-fake.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-11-20T12:00:00.000Z");
const SOL = 1_000_000_000n;

async function rolledOver(free = 4n * (SOL / 10n)) {
  const chainAddress = randomAddress();
  const seed = await seedReadyEpoch(t.db, { now: NOW, chainAddress });
  await t.db.insert(payoutPolicies).values({
    communityId: seed.communityId,
    effectiveFromIndex: 1,
    thresholdVolumeLamports: 100n * SOL,
    basis: "cumulative",
    rewardBpsOfVolume: 100,
    autoPublish: false,
  });
  const fake = fakeSettleChain({ community: chainAddress, free });
  const out = await settleCommunity(
    t.db,
    fake.chain,
    { communityId: seed.communityId },
    { clock: () => NOW },
  );
  expect(out).toMatchObject({ status: "rolled_over" });
  return { seed, fake };
}
const due = (communityId: string, chain: ReturnType<typeof fakeSettleChain>["chain"]) =>
  dueGateReady(t.db, chain, { communityId }, { clock: () => NOW });

describe("notifiable", () => {
  const rows = [
    { id: "a", index: 1, outcome: "rolled_over" as const },
    { id: "b", index: 2, outcome: "rolled_over" as const },
  ];
  it("keeps every rollover while no distribution is planned", () => {
    expect(notifiable(rows)).toEqual(rows);
  });
  it("keeps only the planned distribution, which pays every rolled-over epoch", () => {
    const planned = { id: "c", index: 3, outcome: "distribution_planned" as const };
    expect(notifiable([...rows, planned])).toEqual([planned]);
  });
});

describe("the top-up follows the next decision's policy", () => {
  it("uses the policy in force for the next epoch, not the rolled-over one", async () => {
    const { seed, fake } = await rolledOver();
    // From epoch 2 the threshold doubles: 40 SOL pending, 160 SOL more needed, 1.6 SOL at 100 bps.
    await t.db.insert(payoutPolicies).values({
      communityId: seed.communityId,
      effectiveFromIndex: 2,
      thresholdVolumeLamports: 200n * SOL,
      basis: "cumulative",
      rewardBpsOfVolume: 100,
      autoPublish: false,
    });
    const notes = await due(seed.communityId, fake.chain);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.topUpLamports).toBe(16n * (SOL / 10n));
  });
});

describe("currentGateReadyNote: the message is rebuilt from current state at delivery", () => {
  const ref = (seed: { communityId: string; epochId: string }) => ({
    communityId: seed.communityId,
    epochId: seed.epochId,
  });
  const current = (
    seed: { communityId: string; epochId: string },
    chain: ReturnType<typeof fakeSettleChain>["chain"],
  ) => currentGateReadyNote(t.db, chain, ref(seed), { clock: () => NOW });

  it("returns the epoch's current note, and nothing once it is published", async () => {
    const { seed, fake } = await rolledOver();
    expect(await current(seed, fake.chain)).toMatchObject({
      epochIndex: 1,
      outcome: "rolled_over",
    });
    await t.db
      .update(epochs)
      .set({ status: "published", root: "ab".repeat(32), publishTx: "sig", publishedAt: NOW })
      .where(eq(epochs.id, seed.epochId));
    expect(await current(seed, fake.chain)).toBeNull();
  });

  it("returns nothing for a community under a recorded hold", async () => {
    const { seed, fake } = await rolledOver();
    expect(await current(seed, fake.chain)).not.toBeNull();
    await t.db
      .update(communities)
      .set({ mint: MYCEL_MINT })
      .where(eq(communities.id, seed.communityId));
    expect(await current(seed, fake.chain)).toBeNull();
  });

  it("returns fresh numbers, not the queued ones, when the vault changed", async () => {
    const { seed, fake } = await rolledOver();
    const before = await current(seed, fake.chain);
    expect(before?.topUpLamports).toBe(6n * (SOL / 10n));
    // 0.2 SOL more reached the vault since the note was queued.
    fake.state.free += SOL / 5n;
    const after = await current(seed, fake.chain);
    expect(after?.topUpLamports).toBe(4n * (SOL / 10n));
  });
});

describe("a planned distribution", () => {
  it("is the only alert, counts the stored intent's recipients, and supersedes the rollover", async () => {
    const chainAddress = randomAddress();
    // Epoch 1: effort, ordinary, floor (3 payable). Epoch 2: only ordinary (1 payable).
    const seed = await seedRolloverLane(t.db, { now: NOW, chainAddress, plan: [["ordinary"]] });
    await t.db.insert(payoutPolicies).values({
      communityId: seed.communityId,
      effectiveFromIndex: 1,
      thresholdVolumeLamports: 100n * SOL,
      basis: "cumulative",
      rewardBpsOfVolume: 100,
      autoPublish: false,
    });
    const fake = fakeSettleChain({ community: chainAddress, free: SOL / 2n });
    const settle = () =>
      settleCommunity(t.db, fake.chain, { communityId: seed.communityId }, { clock: () => NOW });
    expect(await settle()).toMatchObject({ status: "rolled_over", epochIndex: 1 });
    // The rollover is reported while it is the latest decision.
    expect(await due(seed.communityId, fake.chain)).toMatchObject([{ outcome: "rolled_over" }]);
    fake.state.free = SOL;
    expect(await settle()).toMatchObject({ status: "planned", epochIndex: 2, epochs: 2 });
    const notes = await due(seed.communityId, fake.chain);
    // One alert, for the planned distribution; the index epoch alone has 1 payable member, the
    // distribution pays the 3 members of both epochs.
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ epochIndex: 2, outcome: "planned", payable: 3 });
  });

  it("is not reported once its epoch account exists on-chain, whatever the database says", async () => {
    const { seed, fake } = await plannedOnly();
    expect(await due(seed.communityId, fake.chain)).toHaveLength(1);
    // The send landed and the process died before the record: the chain knows, the database not yet.
    fake.state.onChain.set(1n, {
      root: "ab".repeat(32),
      auditHash: "cd".repeat(32),
      grossLamports: 2n * SOL,
      allocatedLamports: 1n,
    });
    expect(await due(seed.communityId, fake.chain)).toEqual([]);
  });
});

async function plannedOnly() {
  const chainAddress = randomAddress();
  const seed = await seedReadyEpoch(t.db, { now: NOW, chainAddress });
  await t.db.insert(payoutPolicies).values({
    communityId: seed.communityId,
    effectiveFromIndex: 1,
    thresholdVolumeLamports: 100n * SOL,
    basis: "cumulative",
    rewardBpsOfVolume: 100,
    autoPublish: false,
  });
  const fake = fakeSettleChain({ community: chainAddress, free: 2n * SOL });
  const out = await settleCommunity(
    t.db,
    fake.chain,
    { communityId: seed.communityId },
    { clock: () => NOW },
  );
  expect(out).toMatchObject({ status: "planned" });
  return { seed, fake };
}
