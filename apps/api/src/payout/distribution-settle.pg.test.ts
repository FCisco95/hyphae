import { fileURLToPath } from "node:url";
import { TAGS, taggedHash } from "@hyphae/core";
import {
  createDb,
  distributionPublications,
  epochPayoutDecisions,
  epochs,
  leaves,
  payoutPolicies,
} from "@hyphae/db";
import { asc, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type SettleChain, type SettleOutcome, settleCommunity } from "./distribution-settle.js";
import { randomAddress, seedReadyEpoch } from "./ready-seed.js";
import { seedRolloverLane } from "./rollover-seed.js";
import { fakeSettleChain } from "./settle-fake.js";

// The settle loop on Postgres 17 through postgres-js, the production driver (scripts/test-pg.sh):
// bigint decision columns, the tagged-hash CHECKs of migration 0023, and two workers at once.
const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
const pools = Array.from({ length: 2 }, () => createDb(url));
const [a, b] = pools as [ReturnType<typeof createDb>, ReturnType<typeof createDb>];

beforeAll(async () => {
  await migrate(a, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await Promise.all(pools.map((p) => p.$client.end()));
});

const NOW = new Date("2026-11-20T12:00:00.000Z");
const SOL = 1_000_000_000n;

const policyFor = (communityId: string, autoPublish = true) =>
  a.insert(payoutPolicies).values({
    communityId,
    effectiveFromIndex: 1,
    thresholdVolumeLamports: 100n * SOL,
    basis: "cumulative",
    rewardBpsOfVolume: 100,
    autoPublish,
  });
const settle = (db: typeof a, chain: SettleChain, communityId: string) =>
  settleCommunity(db, chain, { communityId }, { clock: () => NOW });
const decisionRows = (communityId: string) =>
  a
    .select({ decision: epochPayoutDecisions, index: epochs.index })
    .from(epochPayoutDecisions)
    .innerJoin(epochs, eq(epochs.id, epochPayoutDecisions.epochId))
    .where(eq(epochPayoutDecisions.communityId, communityId))
    .orderBy(asc(epochs.index));
const leafRows = (epochId: string) => a.select().from(leaves).where(eq(leaves.epochId, epochId));
function published(out: SettleOutcome) {
  if (out.status !== "published") throw new Error(`not published: ${JSON.stringify(out)}`);
  return out;
}

describe("settleCommunity on Postgres", () => {
  it("publishes an epoch that meets the threshold and stores the intent the database checks", async () => {
    const chainAddress = randomAddress();
    const seed = await seedReadyEpoch(a, { now: NOW, chainAddress });
    await policyFor(seed.communityId);
    const fake = fakeSettleChain({ community: chainAddress, free: 2n * SOL });
    const out = published(await settle(a, fake.chain, seed.communityId));
    expect(out).toMatchObject({ epochIndex: 1, grossLamports: 2n * SOL, leaves: 3 });
    expect(fake.calls.publish).toHaveLength(1);
    expect(fake.calls.publish[0]).toMatchObject({ index: 1n, grossLamports: 2n * SOL });
    expect(await leafRows(seed.epochId)).toHaveLength(3);
    const [row] = await a
      .select()
      .from(distributionPublications)
      .where(eq(distributionPublications.epochId, seed.epochId));
    expect(taggedHash(TAGS.distributionAudit, row?.auditManifest as string)).toBe(out.auditHash);
    const violates = (error: unknown) =>
      (error as { cause?: { code?: string } }).cause?.code === "23514";
    await expect(
      a
        .update(distributionPublications)
        .set({ auditManifest: `${row?.auditManifest} ` })
        .where(eq(distributionPublications.id, row?.id as string)),
    ).rejects.toSatisfy(violates);
    expect((await decisionRows(seed.communityId)).map((d) => d.decision.outcome)).toEqual([
      "distributed",
    ]);
  });

  it("rolls over an epoch below the threshold without a send", async () => {
    const chainAddress = randomAddress();
    const seed = await seedReadyEpoch(a, { now: NOW, chainAddress });
    await policyFor(seed.communityId);
    const fake = fakeSettleChain({ community: chainAddress, free: SOL / 4n });
    expect(await settle(a, fake.chain, seed.communityId)).toEqual({
      status: "rolled_over",
      epochIndex: 1,
      reason: "below_threshold",
      accrualLamports: SOL / 4n,
      volumeLamports: 25n * SOL,
    });
    expect(fake.calls.publish).toHaveLength(0);
    expect(await leafRows(seed.epochId)).toHaveLength(0);
    expect((await decisionRows(seed.communityId))[0]?.decision).toMatchObject({
      outcome: "rolled_over",
      freeLamports: SOL / 4n,
      accrualLamports: SOL / 4n,
      volumeLamports: 25n * SOL,
    });
  });

  it("pays three rolled-over epochs and the fourth in one distribution, one leaf per wallet", async () => {
    const chainAddress = randomAddress();
    const seed = await seedRolloverLane(a, {
      now: NOW,
      chainAddress,
      plan: [["ordinary"], [], ["effort", "floor"]],
    });
    await policyFor(seed.communityId);
    const fake = fakeSettleChain({ community: chainAddress, free: 0n });
    const outcomes: SettleOutcome[] = [];
    for (let i = 1; i <= 4; i++) {
      fake.state.free = BigInt(i) * (3n * (SOL / 10n));
      outcomes.push(await settle(a, fake.chain, seed.communityId));
    }
    expect(outcomes.slice(0, 3).map((o) => o.status)).toEqual([
      "rolled_over",
      "rolled_over",
      "rolled_over",
    ]);
    const out = published(outcomes[3] as SettleOutcome);
    expect(out).toMatchObject({ epochIndex: 4, grossLamports: 12n * (SOL / 10n), epochs: 4 });
    expect(fake.calls.publish).toHaveLength(1);
    const last = seed.epochs[3];
    if (!last) throw new Error("epoch 4");
    const recorded = await leafRows(last.id);
    expect(recorded.map((l) => l.wallet).sort()).toEqual(
      [seed.wallets.effort, seed.wallets.ordinary, seed.wallets.floor].sort(),
    );
    expect(recorded.reduce((s, l) => s + l.amountLamports, 0n)).toBe(out.allocatedLamports);
    const decisions = await decisionRows(seed.communityId);
    expect(
      decisions.map((d) => [d.index, d.decision.outcome, d.decision.distributionEpochId]),
    ).toEqual([1, 2, 3, 4].map((i) => [i, "distributed", last.id]));
    expect(decisions.reduce((s, d) => s + d.decision.accrualLamports, 0n)).toBe(out.grossLamports);
  });

  it("recovers a run that stopped after its send without a second send", async () => {
    const chainAddress = randomAddress();
    const seed = await seedReadyEpoch(a, { now: NOW, chainAddress });
    await policyFor(seed.communityId);
    const fake = fakeSettleChain({ community: chainAddress, free: 2n * SOL });
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
    await expect(settle(a, landsThenStops, seed.communityId)).rejects.toThrow(/killed/);
    expect(await leafRows(seed.epochId)).toHaveLength(0);
    const out = published(await settle(a, fake.chain, seed.communityId));
    expect(out).toMatchObject({ recovered: true, signature: "sig-found-on-chain" });
    expect(fake.calls.publish).toHaveLength(1);
    expect(await leafRows(seed.epochId)).toHaveLength(3);
  });

  it("two workers settling one community at once send once and record once", async () => {
    const chainAddress = randomAddress();
    const seed = await seedReadyEpoch(a, { now: NOW, chainAddress });
    await policyFor(seed.communityId);
    const fake = fakeSettleChain({ community: chainAddress, free: 2n * SOL });
    const results = await Promise.allSettled([
      settle(a, fake.chain, seed.communityId),
      settle(b, fake.chain, seed.communityId),
    ]);
    // The queue's exclusive policy keeps this from happening; the rows keep it harmless anyway:
    // one run stores the intent and sends, the other fails on the unique decision or finds the
    // work done, and nothing is sent twice.
    expect(fake.calls.publish).toHaveLength(1);
    const outcomes = results.filter((r) => r.status === "fulfilled").map((r) => r.value.status);
    expect(outcomes).toContain("published");
    expect(await leafRows(seed.epochId)).toHaveLength(3);
    expect(await decisionRows(seed.communityId)).toHaveLength(1);
    expect((await decisionRows(seed.communityId))[0]?.decision.outcome).toBe("distributed");
  });

  // Review (2026-11-03) P1: worker A passes the planned check; worker B then plans epoch 2 with
  // epoch 1 inside; A resumes, selects epoch 3 and still finds epoch 1 rolled over. Without the
  // lock it would store a second distribution that pays epoch 1 again and counts epoch 2 twice.
  it("aborts a run whose selection another run overtook, instead of overlapping distributions", async () => {
    const chainAddress = randomAddress();
    const seed = await seedRolloverLane(a, {
      now: NOW,
      chainAddress,
      plan: [["ordinary"], ["effort", "floor"]],
    });
    const [e1, e2, e3] = seed.epochs;
    if (!e1 || !e2 || !e3) throw new Error("epochs");
    // auto_publish off: the planned distribution stays stored, which is the review's window.
    await policyFor(seed.communityId, false);
    const fake = fakeSettleChain({ community: chainAddress, free: 3n * (SOL / 10n) });
    expect(await settle(a, fake.chain, seed.communityId)).toMatchObject({
      status: "rolled_over",
      epochIndex: 1,
    });
    fake.state.free = 12n * (SOL / 10n);

    let release: () => void = () => undefined;
    const resume = new Promise<void>((r) => {
      release = r;
    });
    let reached: () => void = () => undefined;
    const paused = new Promise<void>((r) => {
      reached = r;
    });
    // A pauses at its chain read, after the planned check and before selecting its epoch.
    const pausing: SettleChain = {
      ...fake.chain,
      readCommunity: async (i) => {
        reached();
        await resume;
        return fake.chain.readCommunity(i);
      },
    };
    const runA = settle(a, pausing, seed.communityId);
    await paused;
    expect(await settle(b, fake.chain, seed.communityId)).toMatchObject({
      status: "planned",
      epochIndex: 2,
      epochs: 2,
    });
    release();
    await expect(runA).rejects.toThrow(/another run/);

    const intents = await a
      .select({ epochId: distributionPublications.epochId })
      .from(distributionPublications)
      .where(eq(distributionPublications.communityId, seed.communityId));
    expect(intents.map((i) => i.epochId)).toEqual([e2.id]);
    expect(
      (await decisionRows(seed.communityId)).map((d) => [d.index, d.decision.outcome]),
    ).toEqual([
      [1, "rolled_over"],
      [2, "distribution_planned"],
    ]);
    expect(fake.calls.publish).toHaveLength(0);
  });

  it("does nothing for a community without a policy", async () => {
    const chainAddress = randomAddress();
    const seed = await seedReadyEpoch(a, { now: NOW, chainAddress });
    const fake = fakeSettleChain({ community: chainAddress, free: 2n * SOL });
    expect(await settle(a, fake.chain, seed.communityId)).toEqual({ status: "no_policy" });
    expect(fake.calls).toEqual({ read: 0, publish: [], found: [] });
    expect(await decisionRows(seed.communityId)).toHaveLength(0);
  });
});
