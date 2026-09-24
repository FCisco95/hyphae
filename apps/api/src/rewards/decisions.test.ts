import type { RewardPurpose } from "@hyphae/core";
import { epochs, rewardDecisions, rewardSlots } from "@hyphae/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appendCorrection, type CorrectionInput } from "./decisions.js";
import { effectiveResults } from "./effective.js";
import { runEvaluation } from "./evaluation.js";
import { nominate } from "./slots.js";
import { createTestDb, later, seedRewardLane } from "./test-db.js";

const MIN = 60_000;
const WEEK_MS = 7 * 86_400_000;

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const quality = (score: number, flags: string[] = []) => ({
  score,
  rubricHits: [{ key: "context_fit", met: true, note: "specific" }],
  flags,
  aiSlop: { patterns: [], templateRhythm: false },
  reasoning: "Specific to the post and checked.",
});
const effort = (met: boolean) => ({
  originalSubstance: { met, note: "own test" },
  inspectableWork: { met, note: "steps and output" },
  communityContribution: { met, note: "useful to holders" },
  missingEssentialEvidence: null,
  explanation: "You ran the flow and posted the result.",
});
const model = (output: (purpose: RewardPurpose) => unknown) => ({
  model: "test:fake",
  horizonMs: 5 * MIN,
  clock: later(2 * MIN),
  call: async (_prompt: unknown, purpose: RewardPurpose) => ({
    output: output(purpose),
    latencyMs: 5,
    costMicroUsd: 100,
  }),
});

async function scored(output: (purpose: RewardPurpose) => unknown = () => quality(85)) {
  const l = await seedRewardLane(t.db);
  const intake = await l.admitOne();
  await runEvaluation(
    t.db,
    { communityId: l.community.id, target: { contributionId: intake.contributionId } },
    model(output),
  );
  const correct = (input: Partial<CorrectionInput>, clockMs = 10 * MIN) =>
    appendCorrection(
      t.db,
      {
        communityId: l.community.id,
        contributionId: intake.contributionId,
        expectedRevision: 1,
        changes: { rawQuality: 70 },
        reason: "The reply misread the thread; it restates the post.",
        evidenceRefs: ["https://x.com/a/status/1"],
        actor: "script:reward-correct",
        idempotencyKey: "c1",
        ...input,
      },
      { clock: later(clockMs) },
    );
  const lineage = () =>
    t.db
      .select()
      .from(rewardDecisions)
      .where(eq(rewardDecisions.contributionId, intake.contributionId))
      .orderBy(asc(rewardDecisions.revision));
  return { ...l, intake, correct, lineage };
}

describe("appendCorrection", () => {
  it("appends a full successor, re-derives points and records the audit fields", async () => {
    const s = await scored();
    const result = await s.correct({});
    const [r1, r2] = await s.lineage();
    expect(result).toEqual({ status: "appended", decision: r2, created: true });
    expect(r2).toMatchObject({
      revision: 2,
      predecessorId: r1?.id,
      dispatchId: null,
      rawQuality: 70,
      creditedQuality: 70,
      timingBps: 10_000,
      multiplierBps: 10_000,
      pointUnits: 7_000_000_000n,
      effort: "not_nominated",
      affectsAllocation: true,
      correctionActor: "script:reward-correct",
      correctionReason: "The reply misread the thread; it restates the post.",
      correctionEvidence: ["https://x.com/a/status/1"],
      idempotencyKey: "c1",
    });
    expect(r1).toMatchObject({ revision: 1, rawQuality: 85, pointUnits: 8_500_000_000n });
  });

  it("refuses a stale expected revision; after a reload the correction applies", async () => {
    const s = await scored();
    await s.correct({});
    const stale = await s.correct({ changes: { rawQuality: 90 }, idempotencyKey: "c2" });
    expect(stale).toMatchObject({ status: "stale_revision", current: { revision: 2 } });
    expect(await s.lineage()).toHaveLength(2);

    const reloaded = await s.correct({
      changes: { rawQuality: 90 },
      idempotencyKey: "c2",
      expectedRevision: 2,
    });
    expect(reloaded).toMatchObject({ status: "appended", decision: { revision: 3 } });
  });

  it("returns the same revision for a repeated idempotency key", async () => {
    const s = await scored();
    const first = await s.correct({});
    const again = await s.correct({});
    expect(again).toEqual({
      status: "appended",
      decision: first.status === "appended" ? first.decision : null,
      created: false,
    });
    expect(await s.lineage()).toHaveLength(2);

    const other = await s.admitOne();
    await expect(s.correct({ contributionId: other.contributionId })).rejects.toThrow(
      /names other work/,
    );
  });

  it("cannot credit work while a hard flag stays asserted", async () => {
    const s = await scored(() => quality(90, ["spam"]));
    await s.correct({ changes: { rawQuality: 95 } });
    expect((await s.lineage())[1]).toMatchObject({ creditedQuality: 0, pointUnits: 0n });

    await s.correct({ changes: { flags: [] }, expectedRevision: 2, idempotencyKey: "c2" });
    expect((await s.lineage())[2]).toMatchObject({
      rawQuality: 95,
      creditedQuality: 95,
      flags: [],
      pointUnits: 9_500_000_000n,
    });
  });

  it("refuses an effort correction on work that never used an effort slot", async () => {
    const s = await scored();
    expect(await s.correct({ changes: { effort: "eligible" } })).toEqual({
      status: "effort_not_nominated",
    });
    expect(await s.lineage()).toHaveLength(1);
  });

  it("corrects the effort of consumed nominated work without restoring the slot", async () => {
    const l = await seedRewardLane(t.db);
    const intake = await l.admitOne();
    const n = await nominate(
      t.db,
      {
        communityId: l.community.id,
        memberId: l.member.id,
        contributionId: intake.contributionId,
        idempotencyKey: "n1",
      },
      { clock: later(90_000) },
    );
    if (n.status !== "nominated") throw new Error(n.status);
    await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { nominationId: n.nomination.id } },
      model(() => ({ ...quality(85), effort: effort(false) })),
    );
    const result = await appendCorrection(
      t.db,
      {
        communityId: l.community.id,
        contributionId: intake.contributionId,
        expectedRevision: 1,
        changes: { effort: "eligible" },
        reason: "The linked repository shows the work the model could not open.",
        evidenceRefs: ["https://github.com/example/repo"],
        actor: "script:reward-correct",
        idempotencyKey: "e1",
      },
      { clock: later(10 * MIN) },
    );
    expect(result).toMatchObject({
      status: "appended",
      decision: {
        revision: 2,
        effort: "eligible",
        multiplierBps: 30_000,
        pointUnits: 25_500_000_000n,
      },
    });
    const [slot] = await t.db
      .select()
      .from(rewardSlots)
      .where(eq(rewardSlots.id, n.nomination.slotId));
    expect(slot).toMatchObject({ state: "consumed", candidatesUsed: 1 });
  });

  it("keeps a correction accepted at closesAt out of the allocation", async () => {
    const s = await scored();
    const late = await s.correct({}, WEEK_MS);
    expect(late).toMatchObject({ status: "appended", decision: { affectsAllocation: false } });

    const [epoch] = await t.db.select().from(epochs).where(eq(epochs.communityId, s.community.id));
    const r = await effectiveResults(
      t.db,
      { communityId: s.community.id, epochId: epoch?.id ?? "" },
      { clock: later(WEEK_MS + MIN) },
    );
    expect(r.entries[0]).toMatchObject({ revision: 1, pointUnits: "8500000000" });
  });

  it("refuses work without a decision and input without substance", async () => {
    const l = await seedRewardLane(t.db);
    const intake = await l.admitOne();
    const base: CorrectionInput = {
      communityId: l.community.id,
      contributionId: intake.contributionId,
      expectedRevision: 1,
      changes: { rawQuality: 70 },
      reason: "Misread.",
      evidenceRefs: ["https://x.com/a/status/1"],
      actor: "script:reward-correct",
      idempotencyKey: "k",
    };
    expect(await appendCorrection(t.db, base, { clock: later(10 * MIN) })).toEqual({
      status: "no_decision",
    });
    await expect(appendCorrection(t.db, { ...base, reason: " " })).rejects.toThrow(/reason/);
    await expect(appendCorrection(t.db, { ...base, evidenceRefs: [] })).rejects.toThrow(/evidence/);
    await expect(appendCorrection(t.db, { ...base, changes: {} })).rejects.toThrow(/change/);
  });
});
