import type { Prompt, RewardPurpose } from "@hyphae/core";
import { rewardDecisions } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appendCorrection } from "./decisions.js";
import {
  beginDispatch,
  type EvaluationDeps,
  recordNotSentProven,
  runEvaluation,
} from "./evaluation.js";
import { decisionNotified, markNotified, NOTIFY_WINDOW_MS, strandedWork } from "./recovery.js";
import { nominate, recordRetrieval, withdrawNomination } from "./slots.js";
import { createTestDb, later, seedRewardLane, T0 } from "./test-db.js";

const MIN = 60_000;
const WEEK_MS = 7 * 86_400_000;
const GRACE = 10 * MIN;
// seedRewardLane admits at T0 + 1 min; nominations below happen at T0 + 90 s.
const AFTER_GRACE = new Date(T0.getTime() + 2 * MIN + GRACE);

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const quality = {
  score: 85,
  rubricHits: [{ key: "context_fit", met: true, note: "specific" }],
  flags: [],
  aiSlop: { patterns: [], templateRhythm: false },
  reasoning: "Specific to the post.",
};
const effort = (missing: string | null = null) => ({
  originalSubstance: { met: true, note: "own test" },
  inspectableWork: { met: true, note: "steps" },
  communityContribution: { met: true, note: "useful" },
  missingEssentialEvidence: missing,
  explanation: "You posted checked work others can inspect.",
});

function model(answer: (purpose: RewardPurpose) => unknown = () => quality) {
  const calls: RewardPurpose[] = [];
  return {
    calls,
    call: async (_prompt: Prompt, purpose: RewardPurpose) => {
      calls.push(purpose);
      return { output: answer(purpose), latencyMs: 5, costMicroUsd: 100 };
    },
  };
}
const failing: EvaluationDeps["call"] = async () => {
  throw new Error("provider timeout");
};
const deps = (call: EvaluationDeps["call"], clockMs = 2 * MIN): EvaluationDeps => ({
  model: "test:fake",
  call,
  horizonMs: 5 * MIN,
  clock: later(clockMs),
});

async function lane() {
  const s = await seedRewardLane(t.db);
  const communityId = s.community.id;
  const nom = async (contributionId: string, key: string) => {
    const r = await nominate(
      t.db,
      { communityId, memberId: s.member.id, contributionId, idempotencyKey: key },
      { clock: later(90_000) },
    );
    if (r.status !== "nominated") throw new Error(`nominate: ${r.status}`);
    return r.nomination;
  };
  const run = (target: { nominationId: string } | { contributionId: string }, d: EvaluationDeps) =>
    runEvaluation(t.db, { communityId, target }, d);
  // The sweep spans every community; each test reads only its own.
  const sweep = async (now = AFTER_GRACE) => {
    const work = await strandedWork(t.db, { now, graceMs: GRACE });
    return {
      evaluations: work.evaluations.filter((j) => j.communityId === communityId),
      retrievals: work.retrievals.filter((j) => j.communityId === communityId),
      notifications: work.notifications.filter((j) => j.communityId === communityId),
    };
  };
  return { ...s, communityId, nom, run, sweep };
}

const media = {
  source: "x_oembed" as const,
  capturedAt: T0.toISOString(),
  limitations: ["media_not_captured"],
};

describe("strandedWork: admitted work whose evaluation was never queued (F2)", () => {
  it("re-queues ordinary quality for an admitted intake with no decision and no dispatch", async () => {
    const s = await lane();
    const intake = await s.admitOne();
    expect(await s.sweep()).toEqual({
      evaluations: [
        { communityId: s.communityId, target: { contributionId: intake.contributionId } },
      ],
      retrievals: [],
      notifications: [],
    });
  });

  it("leaves work alone inside the grace period, where its own job may still be queued", async () => {
    const s = await lane();
    const intake = await s.admitOne();
    const admittedAt = intake.acceptedAt.getTime();
    expect((await s.sweep(new Date(admittedAt + GRACE - 1))).evaluations).toEqual([]);
    expect((await s.sweep(new Date(admittedAt + GRACE))).evaluations).toHaveLength(1);
  });

  it("skips decided work and work with a live quality dispatch", async () => {
    const s = await lane();
    const decided = await s.admitOne();
    const done = await s.run({ contributionId: decided.contributionId }, deps(model().call));
    expect(done.status).toBe("completed");
    const uncertain = await s.admitOne();
    expect(await s.run({ contributionId: uncertain.contributionId }, deps(failing))).toEqual({
      status: "pending_reconciliation",
    });
    expect((await s.sweep()).evaluations).toEqual([]);
  });

  it("re-queues quality once an operator proves the only dispatch was never sent", async () => {
    const s = await lane();
    const intake = await s.admitOne();
    await s.run({ contributionId: intake.contributionId }, deps(failing));
    const [dispatch] = await t.db.query.rewardDispatches.findMany({
      where: (d, { eq }) => eq(d.contributionId, intake.contributionId),
    });
    if (!dispatch) throw new Error("no dispatch");
    await recordNotSentProven(
      t.db,
      { communityId: s.communityId, dispatchId: dispatch.id, reason: "usage log empty" },
      { clock: later(3 * MIN) },
    );
    expect((await s.sweep()).evaluations).toEqual([
      { communityId: s.communityId, target: { contributionId: intake.contributionId } },
    ]);
  });

  it("does not queue ordinary quality for live new work, and does after its withdrawal", async () => {
    const s = await lane();
    const intake = await s.admitOne();
    const nomination = await s.nom(intake.contributionId, "n1");
    expect((await s.sweep()).evaluations).toEqual([
      { communityId: s.communityId, target: { nominationId: nomination.id } },
    ]);
    await withdrawNomination(
      t.db,
      { communityId: s.communityId, memberId: s.member.id, nominationId: nomination.id },
      { clock: later(2 * MIN) },
    );
    expect((await s.sweep()).evaluations).toEqual([
      { communityId: s.communityId, target: { contributionId: intake.contributionId } },
    ]);
  });

  it("stops at the origin epoch close", async () => {
    const s = await lane();
    await s.admitOne();
    const closesAt = T0.getTime() + WEEK_MS;
    expect((await s.sweep(new Date(closesAt - 1))).evaluations).toHaveLength(1);
    expect((await s.sweep(new Date(closesAt))).evaluations).toEqual([]);
  });

  it("recovers end to end: one call, one decision, and a repeated sweep job calls nothing", async () => {
    const s = await lane();
    const intake = await s.admitOne();
    const m = model();
    const [job] = (await s.sweep()).evaluations;
    if (!job) throw new Error("nothing re-queued");
    await s.run(job.target, deps(m.call));
    await s.run(job.target, deps(m.call));
    expect(m.calls).toEqual(["quality"]);
    const decisions = await t.db
      .select()
      .from(rewardDecisions)
      .where(eq(rewardDecisions.contributionId, intake.contributionId));
    expect(decisions).toHaveLength(1);
    expect((await s.sweep()).evaluations).toEqual([]);
  });
});

describe("strandedWork: ready nominations with no live dispatch (F1, F2)", () => {
  it("re-queues a nomination an operator returned to ready after a proven non-dispatch", async () => {
    const s = await lane();
    const intake = await s.admitOne();
    const nomination = await s.nom(intake.contributionId, "n1");
    await s.run({ nominationId: nomination.id }, deps(failing));
    expect((await s.sweep()).evaluations).toEqual([]);
    const [dispatch] = await t.db.query.rewardDispatches.findMany({
      where: (d, { eq }) => eq(d.nominationId, nomination.id),
    });
    if (!dispatch) throw new Error("no dispatch");
    await recordNotSentProven(
      t.db,
      { communityId: s.communityId, dispatchId: dispatch.id, reason: "usage log empty" },
      { clock: later(3 * MIN) },
    );
    const reconciledAt = T0.getTime() + 3 * MIN;
    expect((await s.sweep(new Date(reconciledAt + GRACE - 1))).evaluations).toEqual([]);
    expect((await s.sweep(new Date(reconciledAt + GRACE))).evaluations).toEqual([
      { communityId: s.communityId, target: { nominationId: nomination.id } },
    ]);
  });

  it("skips completed nominations", async () => {
    const s = await lane();
    const intake = await s.admitOne();
    const nomination = await s.nom(intake.contributionId, "n1");
    const done = await s.run(
      { nominationId: nomination.id },
      deps(model(() => ({ ...quality, effort: effort() })).call),
    );
    expect(done.status).toBe("completed");
    expect(await s.sweep()).toMatchObject({ evaluations: [], retrievals: [] });
  });
});

describe("strandedWork: retrieval rounds that were never scheduled (F2 for /effort)", () => {
  it("re-queues the next round for pending evidence whose last round is past the grace period", async () => {
    const s = await lane();
    const intake = await s.admitOne(media);
    const nomination = await s.nom(intake.contributionId, "n1");
    expect(await s.sweep()).toEqual({
      evaluations: [],
      retrievals: [{ communityId: s.communityId, nominationId: nomination.id, round: 2 }],
      notifications: [],
    });
  });

  it("stops after the pinned last round", async () => {
    const s = await lane();
    const intake = await s.admitOne(media);
    const nomination = await s.nom(intake.contributionId, "n1");
    for (const round of [2, 3]) {
      await recordRetrieval(
        t.db,
        {
          communityId: s.communityId,
          nominationId: nomination.id,
          round,
          limitations: ["media_not_captured"],
        },
        { clock: later(2 * MIN) },
      );
    }
    expect((await s.sweep()).retrievals).toEqual([]);
  });

  it("never schedules retrieval for a gap the model reported after its dispatch", async () => {
    const s = await lane();
    const intake = await s.admitOne();
    const nomination = await s.nom(intake.contributionId, "n1");
    expect(
      await s.run(
        { nominationId: nomination.id },
        deps(model(() => ({ ...quality, effort: effort("the linked video") })).call),
      ),
    ).toEqual({ status: "pending_evidence", reason: "the linked video" });
    expect(await s.sweep()).toEqual({ evaluations: [], retrievals: [], notifications: [] });
  });
});

describe("strandedWork: dispatches whose recheck was never queued", () => {
  it("re-queues a dispatch left without an outcome; the re-run reconciles without a call", async () => {
    const s = await lane();
    const intake = await s.admitOne();
    const nomination = await s.nom(intake.contributionId, "n1");
    const begun = await beginDispatch(
      t.db,
      { communityId: s.communityId, target: { nominationId: nomination.id }, model: "test:fake" },
      { clock: later(2 * MIN) },
    );
    expect(begun.status).toBe("begun");
    expect((await s.sweep(new Date(AFTER_GRACE.getTime() - 1))).evaluations).toEqual([]);
    const { evaluations } = await s.sweep();
    expect(evaluations).toEqual([
      { communityId: s.communityId, target: { nominationId: nomination.id } },
    ]);
    const m = model();
    const [job] = evaluations;
    if (!job) throw new Error("nothing re-queued");
    expect(await s.run(job.target, deps(m.call, 12 * MIN))).toEqual({
      status: "pending_reconciliation",
    });
    expect(m.calls).toEqual([]);
    expect((await s.sweep()).evaluations).toEqual([]);
  });

  it("re-queues an ordinary quality dispatch the same way", async () => {
    const s = await lane();
    const intake = await s.admitOne();
    const begun = await beginDispatch(
      t.db,
      {
        communityId: s.communityId,
        target: { contributionId: intake.contributionId },
        model: "test:fake",
      },
      { clock: later(2 * MIN) },
    );
    expect(begun.status).toBe("begun");
    expect((await s.sweep()).evaluations).toEqual([
      { communityId: s.communityId, target: { contributionId: intake.contributionId } },
    ]);
  });
});

describe("strandedWork: decisions whose message was never sent (F3)", () => {
  // Completion runs at T0 + 2 min, so the decision's acceptedAt is T0 + 2 min.
  const decided = async () => {
    const s = await lane();
    const intake = await s.admitOne();
    const result = await s.run({ contributionId: intake.contributionId }, deps(model().call));
    if (result.status !== "completed") throw new Error(`run: ${result.status}`);
    return { s, decision: result.decision };
  };

  it("re-queues the message for a completed decision not marked notified, after the grace", async () => {
    const { s, decision } = await decided();
    expect((await s.sweep(new Date(AFTER_GRACE.getTime() - 1))).notifications).toEqual([]);
    const { notifications } = await s.sweep();
    expect(notifications.map((n) => [n.contributionId, n.decision.id])).toEqual([
      [decision.contributionId, decision.id],
    ]);
  });

  it("marks a decision notified once, and the sweep then leaves it alone", async () => {
    const { s, decision } = await decided();
    expect(await decisionNotified(t.db, decision.id)).toBe(false);
    expect(await markNotified(t.db, decision.id, AFTER_GRACE)).toBe(true);
    expect(await markNotified(t.db, decision.id, AFTER_GRACE)).toBe(false);
    expect(await decisionNotified(t.db, decision.id)).toBe(true);
    expect((await s.sweep()).notifications).toEqual([]);
  });

  it("gives up on a message still unsent after the notify window", async () => {
    const { s, decision } = await decided();
    const acceptedAt = decision.acceptedAt.getTime();
    expect((await s.sweep(new Date(acceptedAt + NOTIFY_WINDOW_MS - 1))).notifications).toHaveLength(
      1,
    );
    expect((await s.sweep(new Date(acceptedAt + NOTIFY_WINDOW_MS))).notifications).toEqual([]);
  });

  it("never treats an operator correction as a lost evaluation message", async () => {
    const { s, decision } = await decided();
    await markNotified(t.db, decision.id, AFTER_GRACE);
    const corrected = await appendCorrection(
      t.db,
      {
        communityId: s.communityId,
        contributionId: decision.contributionId,
        expectedRevision: 1,
        changes: { rawQuality: 70 },
        reason: "Restates the post.",
        evidenceRefs: ["https://x.com/a/status/1"],
        actor: "script:reward-correct",
        idempotencyKey: "c1",
      },
      { clock: later(3 * MIN) },
    );
    expect(corrected.status).toBe("appended");
    const past = new Date(AFTER_GRACE.getTime() + MIN);
    expect((await s.sweep(past)).notifications).toEqual([]);
  });
});
