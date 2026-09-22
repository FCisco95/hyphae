import {
  communities,
  contributions,
  epochs,
  rewardConfigProposals,
  rewardIntakes,
} from "@hyphae/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bootstrapRewardEpochs,
  buildRewardConfigPayload,
  cancelRewardProposal,
  configDigest,
  dbClock,
  materializeEpochs,
  proposeRewardConfig,
  setRewardIntakePaused,
} from "./config.js";
import { type AdmitInput, admitContribution, artifactKeyFor } from "./intake.js";
import { at, createTestDb, rubric, seedCommunity, seedTask } from "./test-db.js";

const T0 = new Date("2026-10-01T00:00:00.000Z");
const WEEK = 7 * 86_400;
const plus = (base: Date, seconds: number) => new Date(base.getTime() + seconds * 1000);
const plusMs = (base: Date, ms: number) => new Date(base.getTime() + ms);

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const payloadA = buildRewardConfigPayload(rubric);
const boot = (communityId: string, payload = payloadA) =>
  bootstrapRewardEpochs(
    t.db,
    { communityId, payload, opensAt: T0, proposedBy: "test" },
    { clock: at(plus(T0, -3600)) },
  );
const admit = (
  over: Partial<AdmitInput> & Pick<AdmitInput, "communityId" | "memberId">,
): AdmitInput => ({
  taskId: null,
  contribution: {
    kind: "reply",
    url: "https://x.com/a/status/100",
    text: "a real take",
    oembed: null,
    telegramMessageId: 1,
  },
  artifactKey: "x:status:100",
  idempotencyKey: "tg:-1:1",
  capture: { source: "x_oembed", capturedAt: T0.toISOString(), limitations: ["text_only"] },
  ...over,
});

describe("artifactKeyFor", () => {
  it("uses the provider status id, never the URL spelling", () => {
    expect(artifactKeyFor({ statusId: "1234" })).toBe("x:status:1234");
  });
  it("hashes free text", () => {
    expect(artifactKeyFor({ text: "hello" })).toBe(
      "text:sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});

describe("dbClock", () => {
  it("reads the database clock", async () => {
    const { community } = await seedCommunity(t.db);
    const now = await dbClock(t.db, community.id);
    expect(Math.abs(now.getTime() - Date.now())).toBeLessThan(5_000);
  });
});

describe("bootstrapRewardEpochs", () => {
  it("pins epoch 1 to the config and records the initial activation", async () => {
    const { community } = await seedCommunity(t.db);
    const result = await boot(community.id);
    expect(result.epoch).toMatchObject({ index: 1, opensAt: T0, closesAt: plus(T0, WEEK) });
    expect(result.config.digest).toBe(configDigest(payloadA));
    expect(result.epoch.rewardConfigId).toBe(result.config.id);
    expect(result.proposal).toMatchObject({
      status: "activated",
      acceptedInEpoch: null,
      earliestActivationEpoch: 1,
      activatedEpochIndex: 1,
    });
  });

  it("refuses when the community already has epochs", async () => {
    const { community } = await seedCommunity(t.db);
    await boot(community.id);
    await expect(
      bootstrapRewardEpochs(
        t.db,
        {
          communityId: community.id,
          payload: payloadA,
          opensAt: plus(T0, WEEK),
          proposedBy: "test",
        },
        { clock: at(T0) },
      ),
    ).rejects.toThrow(/already has epochs/);
  });

  it("refuses an opening time that is not a future whole second", async () => {
    const { community } = await seedCommunity(t.db);
    const input = { communityId: community.id, payload: payloadA, opensAt: T0, proposedBy: "test" };
    await expect(bootstrapRewardEpochs(t.db, input, { clock: at(T0) })).rejects.toThrow(/future/);
    await expect(
      bootstrapRewardEpochs(
        t.db,
        { ...input, opensAt: plusMs(T0, 500) },
        { clock: at(plus(T0, -1)) },
      ),
    ).rejects.toThrow(/whole second/);
  });
});

describe("admitContribution", () => {
  it("assigns the half-open epoch: closesAt - 1 ms is this epoch, closesAt is the next", async () => {
    const { community, member } = await seedCommunity(t.db);
    await boot(community.id);
    const closesAt = plus(T0, WEEK);
    const first = await admitContribution(
      t.db,
      admit({ communityId: community.id, memberId: member.id }),
      { clock: at(plusMs(closesAt, -1)) },
    );
    if (first.status !== "admitted") throw new Error(first.status);
    expect(first.created).toBe(true);
    expect(first.intake.acceptedAt).toEqual(plusMs(closesAt, -1));

    const second = await admitContribution(
      t.db,
      admit({
        communityId: community.id,
        memberId: member.id,
        artifactKey: "x:status:101",
        idempotencyKey: "tg:-1:2",
      }),
      { clock: at(closesAt) },
    );
    if (second.status !== "admitted") throw new Error(second.status);
    const rows = await t.db
      .select()
      .from(epochs)
      .where(eq(epochs.communityId, community.id))
      .orderBy(asc(epochs.index));
    expect(rows.map((e) => e.index)).toEqual([1, 2]);
    expect(rows[1]?.opensAt).toEqual(closesAt);
    expect(rows[1]?.closesAt).toEqual(plus(closesAt, WEEK));
    expect(first.intake.epochId).toBe(rows[0]?.id);
    expect(second.intake.epochId).toBe(rows[1]?.id);
  });

  it("refuses before epoch 1 opens", async () => {
    const { community, member } = await seedCommunity(t.db);
    await boot(community.id);
    const result = await admitContribution(
      t.db,
      admit({ communityId: community.id, memberId: member.id }),
      { clock: at(plus(T0, -1)) },
    );
    expect(result).toEqual({ status: "not_open" });
  });

  it("refuses while intake is paused and resumes afterwards", async () => {
    const { community, member } = await seedCommunity(t.db);
    await boot(community.id);
    await setRewardIntakePaused(
      t.db,
      { communityId: community.id, paused: true },
      { clock: at(T0) },
    );
    const input = admit({ communityId: community.id, memberId: member.id });
    expect(await admitContribution(t.db, input, { clock: at(plus(T0, 60)) })).toEqual({
      status: "paused",
    });
    await setRewardIntakePaused(
      t.db,
      { communityId: community.id, paused: false },
      { clock: at(T0) },
    );
    const result = await admitContribution(t.db, input, { clock: at(plus(T0, 120)) });
    expect(result.status).toBe("admitted");
  });

  it("maps a redelivered message and a URL alias to the one existing intake", async () => {
    const { community, member } = await seedCommunity(t.db);
    await boot(community.id);
    const input = admit({ communityId: community.id, memberId: member.id });
    const first = await admitContribution(t.db, input, { clock: at(plus(T0, 60)) });
    if (first.status !== "admitted") throw new Error(first.status);
    const redelivered = await admitContribution(t.db, input, { clock: at(plus(T0, 61)) });
    expect(redelivered).toEqual({ status: "admitted", created: false, intake: first.intake });

    const alias = await admitContribution(
      t.db,
      admit({
        communityId: community.id,
        memberId: member.id,
        idempotencyKey: "tg:-1:9",
        contribution: { ...input.contribution, url: "https://twitter.com/a/status/100?s=20" },
      }),
      { clock: at(plus(T0, 62)) },
    );
    expect(alias).toEqual({ status: "duplicate_artifact", intake: first.intake });

    const stored = await t.db
      .select()
      .from(contributions)
      .where(eq(contributions.communityId, community.id));
    expect(stored).toHaveLength(1);
    const intakes = await t.db
      .select()
      .from(rewardIntakes)
      .where(eq(rewardIntakes.communityId, community.id));
    expect(intakes).toHaveLength(1);
  });

  it("refuses intake before the task opens", async () => {
    const { community, member } = await seedCommunity(t.db);
    await boot(community.id);
    const task = await seedTask(t.db, community.id, plus(T0, 3600));
    const early = await admitContribution(
      t.db,
      admit({ communityId: community.id, memberId: member.id, taskId: task.id }),
      { clock: at(plus(T0, 3599)) },
    );
    expect(early).toEqual({ status: "before_task_open" });
    const onTime = await admitContribution(
      t.db,
      admit({ communityId: community.id, memberId: member.id, taskId: task.id }),
      { clock: at(plus(T0, 3600)) },
    );
    if (onTime.status !== "admitted") throw new Error(onTime.status);
    expect(onTime.intake.taskId).toBe(task.id);
  });

  it("rejects a task that belongs to another community", async () => {
    const { community, member } = await seedCommunity(t.db);
    await boot(community.id);
    const other = await seedCommunity(t.db);
    const foreignTask = await seedTask(t.db, other.community.id, T0);
    await expect(
      admitContribution(
        t.db,
        admit({ communityId: community.id, memberId: member.id, taskId: foreignTask.id }),
        { clock: at(plus(T0, 60)) },
      ),
    ).rejects.toThrow(/community/);
    const stored = await t.db
      .select()
      .from(contributions)
      .where(eq(contributions.communityId, community.id));
    expect(stored).toHaveLength(0);
  });

  it("rejects a member that belongs to another community", async () => {
    const { community } = await seedCommunity(t.db);
    await boot(community.id);
    const other = await seedCommunity(t.db);
    await expect(
      admitContribution(
        t.db,
        admit({ communityId: community.id, memberId: other.member.id }),
        { clock: at(plus(T0, 60)) },
      ),
    ).rejects.toThrow(/member .* community/);
    const stored = await t.db
      .select()
      .from(contributions)
      .where(eq(contributions.communityId, community.id));
    expect(stored).toHaveLength(0);
  });

  it("refuses a legacy epoch that carries no pinned configuration", async () => {
    const { community, member } = await seedCommunity(t.db);
    await t.db.insert(epochs).values({
      communityId: community.id,
      index: 1,
      opensAt: T0,
      closesAt: plus(T0, WEEK),
    });
    const result = await admitContribution(
      t.db,
      admit({ communityId: community.id, memberId: member.id }),
      { clock: at(plus(T0, 60)) },
    );
    expect(result).toEqual({ status: "legacy_epoch" });
  });

  it("keeps the pinned config when the community rubric changes later", async () => {
    const { community, member } = await seedCommunity(t.db);
    const booted = await boot(community.id);
    const c1 = await admitContribution(
      t.db,
      admit({ communityId: community.id, memberId: member.id }),
      { clock: at(plus(T0, 60)) },
    );
    if (c1.status !== "admitted") throw new Error(c1.status);
    expect(c1.intake.configId).toBe(booted.config.id);

    // The staging rubric changes and a new bundle is proposed in E1: earliest activation is E3.
    const rubricB = { ...rubric, version: "1.3.0", timing: { fullUntil: 60, zeroAt: 600 } };
    await t.db
      .update(communities)
      .set({ rubric: rubricB, rubricVersion: rubricB.version })
      .where(eq(communities.id, community.id));
    const proposal = await proposeRewardConfig(
      t.db,
      { communityId: community.id, payload: buildRewardConfigPayload(rubricB), proposedBy: "test" },
      { clock: at(plus(T0, 120)) },
    );
    expect(proposal).toMatchObject({
      acceptedInEpoch: 1,
      earliestActivationEpoch: 3,
      status: "pending",
    });

    const c2 = await admitContribution(
      t.db,
      admit({
        communityId: community.id,
        memberId: member.id,
        artifactKey: "x:status:101",
        idempotencyKey: "tg:-1:2",
      }),
      { clock: at(plus(T0, 180)) },
    );
    if (c2.status !== "admitted") throw new Error(c2.status);
    expect(c2.intake.configId).toBe(booted.config.id);
    const [c1Again] = await t.db
      .select()
      .from(rewardIntakes)
      .where(eq(rewardIntakes.id, c1.intake.id));
    expect(c1Again?.configId).toBe(booted.config.id);

    const c3 = await admitContribution(
      t.db,
      admit({
        communityId: community.id,
        memberId: member.id,
        artifactKey: "x:status:102",
        idempotencyKey: "tg:-1:3",
      }),
      { clock: at(plus(T0, 2 * WEEK + 1)) },
    );
    if (c3.status !== "admitted") throw new Error(c3.status);
    expect(c3.intake.configId).toBe(proposal.configId);
    const rows = await t.db
      .select({ index: epochs.index, configId: epochs.rewardConfigId })
      .from(epochs)
      .where(eq(epochs.communityId, community.id))
      .orderBy(asc(epochs.index));
    expect(rows).toEqual([
      { index: 1, configId: booted.config.id },
      { index: 2, configId: booted.config.id },
      { index: 3, configId: proposal.configId },
    ]);
  });
});

describe("configuration cooldown and materialization", () => {
  // 60-second epochs so E11 opens ten minutes after T0. Ei opens at T0 + (i - 1) * 60 s.
  const D = 60;
  const opens = (i: number) => plus(T0, (i - 1) * D);
  const payloadShort = buildRewardConfigPayload(rubric, { epoch: { durationSeconds: D } });
  const payloadB = buildRewardConfigPayload(rubric, {
    epoch: { durationSeconds: D },
    effort: { multiplierBps: 20_000 },
  });
  const payloadC = buildRewardConfigPayload(rubric, {
    epoch: { durationSeconds: D },
    effort: { multiplierBps: 25_000 },
  });
  const payloadD = buildRewardConfigPayload(rubric, { epoch: { durationSeconds: 2 * D } });
  const bootShort = (communityId: string) =>
    bootstrapRewardEpochs(
      t.db,
      { communityId, payload: payloadShort, opensAt: T0, proposedBy: "test" },
      { clock: at(plus(T0, -1)) },
    );

  it("follows E(max(k+1, a+2)), supersedes one pending proposal, keeps windows contiguous", async () => {
    const { community } = await seedCommunity(t.db);
    const id = community.id;
    await bootShort(id);

    // Accepted during E10 with a = 1: earliest E11. E11 then activates B, so a = 11.
    const pB = await proposeRewardConfig(
      t.db,
      { communityId: id, payload: payloadB, proposedBy: "test" },
      { clock: at(plus(opens(10), 5)) },
    );
    expect(pB).toMatchObject({ acceptedInEpoch: 10, earliestActivationEpoch: 11 });
    const e11 = await materializeEpochs(
      t.db,
      { communityId: id },
      { clock: at(plus(opens(11), 5)) },
    );
    expect(e11).toMatchObject({ index: 11, rewardConfigId: pB.configId });

    // Accepted during E11: max(12, 13) = 13.
    const pC = await proposeRewardConfig(
      t.db,
      { communityId: id, payload: payloadC, proposedBy: "test" },
      { clock: at(plus(opens(11), 10)) },
    );
    expect(pC).toMatchObject({ acceptedInEpoch: 11, earliestActivationEpoch: 13 });

    // E12 opens: 13 > 12, so it still pins B.
    const e12 = await materializeEpochs(
      t.db,
      { communityId: id },
      { clock: at(plus(opens(12), 1)) },
    );
    expect(e12).toMatchObject({ index: 12, rewardConfigId: pB.configId });

    // Accepted during E12: max(13, 13) = 13; replaces C; a stays 11.
    const pD = await proposeRewardConfig(
      t.db,
      { communityId: id, payload: payloadD, proposedBy: "test" },
      { clock: at(plus(opens(12), 2)) },
    );
    expect(pD).toMatchObject({ acceptedInEpoch: 12, earliestActivationEpoch: 13 });

    // Accepted exactly at closesAt(E12) = opensAt(E13): belongs to E13, which activates D (a = 13),
    // so the earliest activation is E15. E13 runs 120 s with no gap or overlap.
    const pE = await proposeRewardConfig(
      t.db,
      { communityId: id, payload: payloadC, proposedBy: "test" },
      { clock: at(opens(13)) },
    );
    expect(pE).toMatchObject({ acceptedInEpoch: 13, earliestActivationEpoch: 15 });

    const e14 = await materializeEpochs(
      t.db,
      { communityId: id },
      { clock: at(plus(opens(13), 2 * D)) },
    );
    expect(e14.index).toBe(14);
    const rows = await t.db
      .select()
      .from(epochs)
      .where(eq(epochs.communityId, id))
      .orderBy(asc(epochs.index));
    expect(rows).toHaveLength(14);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]?.opensAt).toEqual(rows[i - 1]?.closesAt);
    }
    expect(rows[12]).toMatchObject({
      index: 13,
      opensAt: opens(13),
      closesAt: plus(opens(13), 2 * D),
      rewardConfigId: pD.configId,
    });
    expect(rows[13]).toMatchObject({
      index: 14,
      opensAt: plus(opens(13), 2 * D),
      closesAt: plus(opens(13), 4 * D),
      rewardConfigId: pD.configId,
    });

    const proposals = await t.db
      .select({
        status: rewardConfigProposals.status,
        activatedEpochIndex: rewardConfigProposals.activatedEpochIndex,
      })
      .from(rewardConfigProposals)
      .where(eq(rewardConfigProposals.communityId, id))
      .orderBy(asc(rewardConfigProposals.acceptedAt));
    expect(proposals.map((p) => [p.status, p.activatedEpochIndex])).toEqual([
      ["activated", 1],
      ["activated", 11],
      ["superseded", null],
      ["activated", 13],
      ["pending", null],
    ]);
  });

  it("rejects a no-op proposal of the pinned configuration", async () => {
    const { community } = await seedCommunity(t.db);
    await bootShort(community.id);
    await expect(
      proposeRewardConfig(
        t.db,
        { communityId: community.id, payload: payloadShort, proposedBy: "test" },
        { clock: at(plus(T0, 5)) },
      ),
    ).rejects.toThrow(/already pinned/);
  });

  it("refuses a proposal before bootstrap", async () => {
    const { community } = await seedCommunity(t.db);
    await expect(
      proposeRewardConfig(
        t.db,
        { communityId: community.id, payload: payloadShort, proposedBy: "test" },
        { clock: at(T0) },
      ),
    ).rejects.toThrow(/bootstrap/);
  });

  it("cancelling a pending proposal keeps the last activation and the current config", async () => {
    const { community } = await seedCommunity(t.db);
    const id = community.id;
    const booted = await bootShort(id);
    await proposeRewardConfig(
      t.db,
      { communityId: id, payload: payloadB, proposedBy: "test" },
      { clock: at(plus(T0, 5)) },
    );
    const cancelled = await cancelRewardProposal(
      t.db,
      { communityId: id },
      { clock: at(plus(T0, 6)) },
    );
    expect(cancelled.status).toBe("cancelled");
    await expect(
      cancelRewardProposal(t.db, { communityId: id }, { clock: at(plus(T0, 7)) }),
    ).rejects.toThrow(/no pending/);

    const e3 = await materializeEpochs(t.db, { communityId: id }, { clock: at(plus(opens(3), 1)) });
    expect(e3).toMatchObject({ index: 3, rewardConfigId: booted.config.id });
    const again = await proposeRewardConfig(
      t.db,
      { communityId: id, payload: payloadB, proposedBy: "test" },
      { clock: at(plus(opens(3), 2)) },
    );
    expect(again).toMatchObject({ acceptedInEpoch: 3, earliestActivationEpoch: 4 });
  });
});
