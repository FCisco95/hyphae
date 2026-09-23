import type { Prompt, RewardPurpose } from "@hyphae/core";
import { rewardDecisions, rewardDispatches, rewardNominations, rewardSlots } from "@hyphae/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildRewardConfigPayload } from "./config.js";
import {
  beginDispatch,
  completeDispatch,
  type EvaluationDeps,
  recordNotSentProven,
  runEvaluation,
} from "./evaluation.js";
import { nominate, withdrawNomination } from "./slots.js";
import { createTestDb, later, rubric, seedRewardLane } from "./test-db.js";

const WEEK_MS = 7 * 86_400_000;
const MIN = 60_000;
const HORIZON = 5 * MIN;

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
  reasoning: "Specific to the post and adds a checked result.",
});
const effort = (met: boolean, missing: string | null = null) => ({
  originalSubstance: { met, note: "own test" },
  inspectableWork: { met, note: "steps and output" },
  communityContribution: { met, note: "useful to holders" },
  missingEssentialEvidence: missing,
  explanation: "You ran the flow and posted the result, which others can check.",
});

// A fake provider that counts calls and records the purpose of each.
function fakeModel(answer: (purpose: RewardPurpose) => unknown) {
  const calls: { purpose: RewardPurpose; prompt: Prompt }[] = [];
  return {
    calls,
    call: async (prompt: Prompt, purpose: RewardPurpose) => {
      calls.push({ purpose, prompt });
      return { output: answer(purpose), latencyMs: 5, costMicroUsd: 100 };
    },
  };
}
const failing = () => {
  const calls: RewardPurpose[] = [];
  return {
    calls,
    call: async (_prompt: Prompt, purpose: RewardPurpose) => {
      calls.push(purpose);
      throw new Error("provider timeout");
    },
  };
};

const deps = (call: EvaluationDeps["call"], clockMs = 2 * MIN): EvaluationDeps => ({
  model: "test:fake",
  call,
  horizonMs: HORIZON,
  clock: later(clockMs),
});

async function lane(payload = buildRewardConfigPayload(rubric)) {
  const s = await seedRewardLane(t.db, payload);
  const nom = async (contributionId: string, key: string, clockMs = 90_000) => {
    const r = await nominate(
      t.db,
      { communityId: s.community.id, memberId: s.member.id, contributionId, idempotencyKey: key },
      { clock: later(clockMs) },
    );
    if (r.status !== "nominated") throw new Error(`nominate: ${r.status}`);
    return r.nomination;
  };
  const run = (target: { nominationId: string } | { contributionId: string }, d: EvaluationDeps) =>
    runEvaluation(t.db, { communityId: s.community.id, target }, d);
  return { ...s, nom, run };
}

const decisionsOf = (contributionId: string) =>
  t.db
    .select()
    .from(rewardDecisions)
    .where(eq(rewardDecisions.contributionId, contributionId))
    .orderBy(asc(rewardDecisions.revision));
const slotOf = async (slotId: string) =>
  (await t.db.select().from(rewardSlots).where(eq(rewardSlots.id, slotId)))[0];
const nominationOf = async (id: string) =>
  (await t.db.select().from(rewardNominations).where(eq(rewardNominations.id, id)))[0];

describe("ordinary quality evaluation", () => {
  it("writes revision 1 at 1x from one dispatch", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const model = fakeModel(() => quality(85));
    const result = await l.run({ contributionId: intake.contributionId }, deps(model.call));
    expect(result.status).toBe("completed");
    const [d] = await decisionsOf(intake.contributionId);
    expect(d).toMatchObject({
      revision: 1,
      predecessorId: null,
      rawQuality: 85,
      creditedQuality: 85,
      effort: "not_nominated",
      timingBps: 10_000,
      multiplierBps: 10_000,
      pointUnits: 8_500_000_000n,
      affectsAllocation: true,
    });
    expect(model.calls.map((c) => c.purpose)).toEqual(["quality"]);
  });

  it("runs the model once for a repeated job", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const model = fakeModel(() => quality(70));
    await l.run({ contributionId: intake.contributionId }, deps(model.call));
    const again = await l.run({ contributionId: intake.contributionId }, deps(model.call));
    expect(again.status).toBe("already_completed");
    expect(model.calls).toHaveLength(1);
    expect(await decisionsOf(intake.contributionId)).toHaveLength(1);
  });

  it("is refused while the work is nominated as new effort work", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    await l.nom(intake.contributionId, "n1");
    const model = fakeModel(() => quality(70));
    expect(await l.run({ contributionId: intake.contributionId }, deps(model.call))).toEqual({
      status: "not_ready",
      reason: "nominated",
    });
    expect(model.calls).toHaveLength(0);
  });

  it("is refused after the origin epoch closed", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const model = fakeModel(() => quality(70));
    expect(
      await l.run({ contributionId: intake.contributionId }, deps(model.call, WEEK_MS)),
    ).toEqual({ status: "not_ready", reason: "epoch_closed" });
    expect(model.calls).toHaveLength(0);
  });
});

describe("nominated evaluation", () => {
  it("new work eligible for effort: 85 at full timing is 255 points and consumes the slot", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const n = await l.nom(intake.contributionId, "n1");
    const model = fakeModel(() => ({ ...quality(85), effort: effort(true) }));
    expect((await l.run({ nominationId: n.id }, deps(model.call))).status).toBe("completed");
    const [d] = await decisionsOf(intake.contributionId);
    expect(d).toMatchObject({
      revision: 1,
      effort: "eligible",
      multiplierBps: 30_000,
      pointUnits: 25_500_000_000n,
    });
    expect(model.calls.map((c) => c.purpose)).toEqual(["quality_effort"]);
    expect(await nominationOf(n.id)).toMatchObject({ state: "completed_eligible" });
    expect(await slotOf(n.slotId)).toMatchObject({ state: "consumed", consumedDecisionId: d?.id });
  });

  it("an effort rejection consumes the slot at 1x", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const n = await l.nom(intake.contributionId, "n1");
    const model = fakeModel(() => ({ ...quality(85), effort: effort(false) }));
    await l.run({ nominationId: n.id }, deps(model.call));
    expect((await decisionsOf(intake.contributionId))[0]).toMatchObject({
      effort: "ineligible",
      pointUnits: 8_500_000_000n,
    });
    expect(await slotOf(n.slotId)).toMatchObject({ state: "consumed" });
    expect(await nominationOf(n.id)).toMatchObject({ state: "completed_ineligible" });
  });

  it("quality below the floor credits zero and still consumes the slot", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const n = await l.nom(intake.contributionId, "n1");
    const model = fakeModel(() => ({ ...quality(59), effort: effort(true) }));
    await l.run({ nominationId: n.id }, deps(model.call));
    expect((await decisionsOf(intake.contributionId))[0]).toMatchObject({
      creditedQuality: 0,
      pointUnits: 0n,
    });
    expect(await slotOf(n.slotId)).toMatchObject({ state: "consumed" });
  });

  it("an upgrade reuses quality: 85 becomes revision 2 at 255, never 85 + 255", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const model = fakeModel((purpose) =>
      purpose === "effort" ? { effort: effort(true) } : quality(85),
    );
    await l.run({ contributionId: intake.contributionId }, deps(model.call));
    const n = await l.nom(intake.contributionId, "n1", 3 * MIN);
    expect(n.kind).toBe("upgrade");
    await l.run({ nominationId: n.id }, deps(model.call, 4 * MIN));
    const [r1, r2] = await decisionsOf(intake.contributionId);
    expect(r2).toMatchObject({
      revision: 2,
      predecessorId: r1?.id,
      rawQuality: 85,
      creditedQuality: 85,
      effort: "eligible",
      pointUnits: 25_500_000_000n,
    });
    expect(model.calls.map((c) => c.purpose)).toEqual(["quality", "effort"]);
    expect(model.calls[1]?.prompt.user).toContain("raw 85, credited 85");
  });

  it("a model-reported evidence gap spends the dispatch but not the slot", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const n = await l.nom(intake.contributionId, "n1");
    const model = fakeModel(() => ({ ...quality(85), effort: effort(true, "the demo video") }));
    expect(await l.run({ nominationId: n.id }, deps(model.call))).toEqual({
      status: "pending_evidence",
      reason: "the demo video",
    });
    expect(await decisionsOf(intake.contributionId)).toHaveLength(0);
    expect(await nominationOf(n.id)).toMatchObject({
      state: "pending_evidence",
      pendingReason: "the demo video",
    });
    expect(await slotOf(n.slotId)).toMatchObject({ state: "reserved" });
    const again = await l.run({ nominationId: n.id }, deps(model.call, 3 * MIN));
    expect(again.status).toBe("not_ready");
    expect(model.calls).toHaveLength(1);
  });

  it("does not dispatch when the pinned prompt template no longer matches the code", async () => {
    const payload = buildRewardConfigPayload(rubric);
    payload.scoring.promptTemplateHash = "0".repeat(64);
    const l = await lane(payload);
    const intake = await l.admitOne();
    const n = await l.nom(intake.contributionId, "n1");
    const model = fakeModel(() => ({ ...quality(85), effort: effort(true) }));
    expect(await l.run({ nominationId: n.id }, deps(model.call))).toEqual({
      status: "not_ready",
      reason: "prompt_unavailable",
    });
    expect(model.calls).toHaveLength(0);
    expect(
      await t.db.select().from(rewardDispatches).where(eq(rewardDispatches.nominationId, n.id)),
    ).toHaveLength(0);
  });
});

describe("uncertainty and recovery", () => {
  it("a provider error leaves the work pending reconciliation and is never re-sent", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const n = await l.nom(intake.contributionId, "n1");
    const bad = failing();
    expect((await l.run({ nominationId: n.id }, deps(bad.call))).status).toBe(
      "pending_reconciliation",
    );
    const good = fakeModel(() => ({ ...quality(85), effort: effort(true) }));
    for (const ms of [3 * MIN, 30 * MIN]) {
      expect((await l.run({ nominationId: n.id }, deps(good.call, ms))).status).toBe(
        "pending_reconciliation",
      );
    }
    expect(bad.calls).toHaveLength(1);
    expect(good.calls).toHaveLength(0);
    expect(await nominationOf(n.id)).toMatchObject({ state: "pending_reconciliation" });
    expect(
      (
        await withdrawNomination(
          t.db,
          { communityId: l.community.id, memberId: l.member.id, nominationId: n.id },
          { clock: later(31 * MIN) },
        )
      ).status,
    ).toBe("dispatched");
  });

  it("a job that finds a fresh dispatch waits instead of calling again", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const n = await l.nom(intake.contributionId, "n1");
    const begun = await beginDispatch(
      t.db,
      { communityId: l.community.id, target: { nominationId: n.id }, model: "test:fake" },
      { clock: later(2 * MIN) },
    );
    expect(begun.status).toBe("begun");
    const model = fakeModel(() => ({ ...quality(85), effort: effort(true) }));
    expect(await l.run({ nominationId: n.id }, deps(model.call, 3 * MIN))).toEqual({
      status: "in_flight",
      recheckAfterMs: 4 * MIN,
    });
    expect(model.calls).toHaveLength(0);
  });

  it("a dispatch with no outcome past the horizon moves to reconciliation without a call", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    await beginDispatch(
      t.db,
      {
        communityId: l.community.id,
        target: { contributionId: intake.contributionId },
        model: "test:fake",
      },
      { clock: later(2 * MIN) },
    );
    const model = fakeModel(() => quality(85));
    expect(
      (await l.run({ contributionId: intake.contributionId }, deps(model.call, 8 * MIN))).status,
    ).toBe("pending_reconciliation");
    expect(model.calls).toHaveLength(0);
  });

  it("the original outcome arriving late still completes with its fence", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const n = await l.nom(intake.contributionId, "n1");
    const begun = await beginDispatch(
      t.db,
      { communityId: l.community.id, target: { nominationId: n.id }, model: "test:fake" },
      { clock: later(2 * MIN) },
    );
    if (begun.status !== "begun") throw new Error(begun.status);
    await l.run({ nominationId: n.id }, deps(fakeModel(() => ({})).call, 8 * MIN));
    const done = await completeDispatch(
      t.db,
      {
        communityId: l.community.id,
        dispatchId: begun.dispatch.id,
        fence: begun.dispatch.fence,
        output: { ...quality(85), effort: effort(true) },
        latencyMs: 400_000,
        costMicroUsd: 100,
      },
      { clock: later(9 * MIN) },
    );
    expect(done.status).toBe("completed");
    expect(await slotOf(n.slotId)).toMatchObject({ state: "consumed" });
  });

  it("a completion accepted after the origin epoch closed does not affect allocation", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const begun = await beginDispatch(
      t.db,
      {
        communityId: l.community.id,
        target: { contributionId: intake.contributionId },
        model: "test:fake",
      },
      { clock: later(WEEK_MS - MIN) },
    );
    if (begun.status !== "begun") throw new Error(begun.status);
    await completeDispatch(
      t.db,
      {
        communityId: l.community.id,
        dispatchId: begun.dispatch.id,
        fence: begun.dispatch.fence,
        output: quality(85),
        latencyMs: 5,
        costMicroUsd: 100,
      },
      { clock: later(WEEK_MS) },
    );
    expect((await decisionsOf(intake.contributionId))[0]).toMatchObject({
      affectsAllocation: false,
    });
  });

  it("only a recorded proven non-dispatch allows one more call, and fences off the old one", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const n = await l.nom(intake.contributionId, "n1");
    await l.run({ nominationId: n.id }, deps(failing().call));
    const [first] = await t.db
      .select()
      .from(rewardDispatches)
      .where(eq(rewardDispatches.nominationId, n.id));
    if (!first) throw new Error("no dispatch");
    await recordNotSentProven(
      t.db,
      { communityId: l.community.id, dispatchId: first.id, reason: "provider log: no request" },
      { clock: later(10 * MIN) },
    );
    const model = fakeModel(() => ({ ...quality(85), effort: effort(true) }));
    expect((await l.run({ nominationId: n.id }, deps(model.call, 11 * MIN))).status).toBe(
      "completed",
    );
    expect(model.calls).toHaveLength(1);
    const stale = await completeDispatch(
      t.db,
      {
        communityId: l.community.id,
        dispatchId: first.id,
        fence: first.fence,
        output: { ...quality(99), effort: effort(true) },
        latencyMs: 5,
        costMicroUsd: 100,
      },
      { clock: later(12 * MIN) },
    );
    expect(stale.status).toBe("stale");
    expect(await decisionsOf(intake.contributionId)).toHaveLength(1);
  });

  it("refuses a completion with a fence the dispatch never held", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const n = await l.nom(intake.contributionId, "n1");
    const begun = await beginDispatch(
      t.db,
      { communityId: l.community.id, target: { nominationId: n.id }, model: "test:fake" },
      { clock: later(2 * MIN) },
    );
    if (begun.status !== "begun") throw new Error(begun.status);
    const result = await completeDispatch(
      t.db,
      {
        communityId: l.community.id,
        dispatchId: begun.dispatch.id,
        fence: begun.dispatch.fence - 1,
        output: { ...quality(85), effort: effort(true) },
        latencyMs: 5,
        costMicroUsd: 100,
      },
      { clock: later(3 * MIN) },
    );
    expect(result.status).toBe("stale");
  });

  it("schema-invalid output is uncertain, not a judgment", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const model = fakeModel(() => ({ score: "high" }));
    expect((await l.run({ contributionId: intake.contributionId }, deps(model.call))).status).toBe(
      "pending_reconciliation",
    );
    const [dispatch] = await t.db
      .select()
      .from(rewardDispatches)
      .where(eq(rewardDispatches.contributionId, intake.contributionId));
    expect(dispatch).toMatchObject({ state: "pending_reconciliation", output: { score: "high" } });
  });
});
