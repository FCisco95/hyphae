import { communities, epochs, payoutPolicies } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../rewards/test-db.js";
import { settleCommunity } from "./distribution-settle.js";
import { dueGateReady, epochStillPending, notifiable } from "./gate-ready.js";
import { MYCEL_MINT } from "./holds.js";
import { randomAddress, seedReadyEpoch } from "./ready-seed.js";
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

describe("epochStillPending", () => {
  it("is true for a decided epoch, false once it is published", async () => {
    const { seed } = await rolledOver();
    const ref = { communityId: seed.communityId, epochId: seed.epochId };
    expect(await epochStillPending(t.db, ref)).toBe(true);
    await t.db
      .update(epochs)
      .set({ status: "published", root: "ab".repeat(32), publishTx: "sig", publishedAt: NOW })
      .where(eq(epochs.id, seed.epochId));
    expect(await epochStillPending(t.db, ref)).toBe(false);
  });

  it("is false for a community under a recorded hold, and the message stops too", async () => {
    const { seed, fake } = await rolledOver();
    const ref = { communityId: seed.communityId, epochId: seed.epochId };
    // Decided and ready: it is reported while no hold applies.
    expect(await due(seed.communityId, fake.chain)).toHaveLength(1);
    await t.db
      .update(communities)
      .set({ mint: MYCEL_MINT })
      .where(eq(communities.id, seed.communityId));
    expect(await epochStillPending(t.db, ref)).toBe(false);
    expect(await due(seed.communityId, fake.chain)).toEqual([]);
  });
});
