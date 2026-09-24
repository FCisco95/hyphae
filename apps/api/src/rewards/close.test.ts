import type { RewardPurpose } from "@hyphae/core";
import { epochs, members, rewardNominations } from "@hyphae/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeEpoch, dueCloses } from "./close.js";
import {
  beginDispatch,
  completeDispatch,
  markReconciliation,
  recordNotSentProven,
  runEvaluation,
} from "./evaluation.js";
import { admitContribution } from "./intake.js";
import { nominate } from "./slots.js";
import { createTestDb, later, seedCommunity, seedRewardLane, T0 } from "./test-db.js";

const MIN = 60_000;
const WEEK_MS = 7 * 86_400_000; // epoch 1 is [T0, T0 + WEEK_MS)

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const quality = (score: number) => ({
  score,
  rubricHits: [{ key: "context_fit", met: true, note: "specific" }],
  flags: [],
  aiSlop: { patterns: [], templateRhythm: false },
  reasoning: "Specific to the post.",
});
const effort = {
  originalSubstance: { met: true, note: "own test" },
  inspectableWork: { met: true, note: "steps and output" },
  communityContribution: { met: true, note: "useful to holders" },
  missingEssentialEvidence: null,
  explanation: "You ran the flow and posted the result.",
};
const answer = (score: number) => async (_prompt: unknown, purpose: RewardPurpose) => ({
  output: purpose === "effort" ? { effort } : quality(score),
  latencyMs: 5,
  costMicroUsd: 100,
});

let memberSeq = 500n;
async function seedMember(communityId: string) {
  memberSeq += 1n;
  const [row] = await t.db
    .insert(members)
    .values({
      communityId,
      telegramUserId: memberSeq,
      wallet: `W${memberSeq}`,
      linkMethod: "paste",
    })
    .returning();
  if (!row) throw new Error("seed: member");
  return row;
}

async function lane() {
  const s = await seedRewardLane(t.db);
  const [epoch] = await t.db.select().from(epochs).where(eq(epochs.communityId, s.community.id));
  if (!epoch) throw new Error("no epoch");
  const score = (contributionId: string, value: number, clockMs = 2 * MIN) =>
    runEvaluation(
      t.db,
      { communityId: s.community.id, target: { contributionId } },
      { model: "test:fake", call: answer(value), horizonMs: 5 * MIN, clock: later(clockMs) },
    );
  const nominateAt = async (contributionId: string, clockMs = 3 * MIN) => {
    const n = await nominate(
      t.db,
      {
        communityId: s.community.id,
        memberId: s.member.id,
        contributionId,
        idempotencyKey: `n:${contributionId}`,
      },
      { clock: later(clockMs) },
    );
    if (n.status !== "nominated") throw new Error(n.status);
    return n.nomination;
  };
  const begin = async (nominationId: string, clockMs = 4 * MIN) => {
    const begun = await beginDispatch(
      t.db,
      { communityId: s.community.id, target: { nominationId }, model: "test:fake" },
      { clock: later(clockMs) },
    );
    if (begun.status !== "begun") throw new Error(begun.status);
    return begun.dispatch;
  };
  const complete = (dispatch: { id: string; fence: number }, output: unknown, clockMs: number) =>
    completeDispatch(
      t.db,
      {
        communityId: s.community.id,
        dispatchId: dispatch.id,
        fence: dispatch.fence,
        output,
        latencyMs: 5,
        costMicroUsd: 100,
      },
      { clock: later(clockMs) },
    );
  const close = (clockMs = WEEK_MS + MIN) =>
    closeEpoch(t.db, { communityId: s.community.id, epochId: epoch.id }, { clock: later(clockMs) });
  const nominationState = async (id: string) =>
    (await t.db.select().from(rewardNominations).where(eq(rewardNominations.id, id)))[0]?.state;
  return { ...s, epoch, score, nominateAt, begin, complete, close, nominationState };
}

describe("closeEpoch", () => {
  it("refuses before the scheduled close and writes nothing", async () => {
    const l = await lane();
    await l.admitOne();

    expect(await l.close(WEEK_MS - 1)).toEqual({ status: "too_early" });
    const [epoch] = await t.db.select().from(epochs).where(eq(epochs.id, l.epoch.id));
    expect(epoch?.status).toBe("open");
  });

  it("a delayed close still cuts at the scheduled closesAt", async () => {
    const l = await lane();
    const onTime = await l.admitOne();
    const lateOne = await l.admitOne();
    await l.score(onTime.contributionId, 85);
    // Dispatched before closesAt; the answer is stored after it, before the delayed close runs.
    const begun = await beginDispatch(
      t.db,
      {
        communityId: l.community.id,
        target: { contributionId: lateOne.contributionId },
        model: "m",
      },
      { clock: later(2 * MIN) },
    );
    if (begun.status !== "begun") throw new Error(begun.status);
    await l.complete(begun.dispatch, quality(90), WEEK_MS + MIN);

    const closed = await l.close(WEEK_MS + 3 * 86_400_000);
    if (closed.status !== "closed") throw new Error(closed.status);
    expect(closed.snapshot.closesAt).toEqual(l.epoch.closesAt);
    expect(closed.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contributionId: onTime.contributionId,
          reason: null,
          pointUnits: 8_500_000_000n,
        }),
        expect.objectContaining({
          contributionId: lateOne.contributionId,
          decisionId: null,
          reason: "excluded",
          pointUnits: 0n,
        }),
      ]),
    );
    expect(closed.members).toEqual([
      expect.objectContaining({
        memberId: l.member.id,
        pointUnits: 8_500_000_000n,
        wholePoints: 85n,
      }),
    ]);
  });

  it("pending new work gets no points and its nomination expires", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const nomination = await l.nominateAt(intake.contributionId);

    const closed = await l.close();
    if (closed.status !== "closed") throw new Error(closed.status);
    expect(closed.entries).toEqual([
      expect.objectContaining({ decisionId: null, reason: "pending_at_close", pointUnits: 0n }),
    ]);
    expect(closed.members[0]).toMatchObject({ pointUnits: 0n, wholePoints: 0n });
    expect(await l.nominationState(nomination.id)).toBe("expired_at_close");
  });

  it("freezes an in-flight or uncertain model request as pending_reconciliation", async () => {
    const l = await lane();
    const inFlight = await l.admitOne();
    const scored = await l.admitOne();
    const untouched = await l.admitOne();
    await l.begin((await l.nominateAt(inFlight.contributionId)).id);
    await l.score(scored.contributionId, 70);

    const reconciling = await l.admitOne();
    const begun = await beginDispatch(
      t.db,
      {
        communityId: l.community.id,
        target: { contributionId: reconciling.contributionId },
        model: "m",
      },
      { clock: later(5 * MIN) },
    );
    if (begun.status !== "begun") throw new Error(begun.status);
    await markReconciliation(
      t.db,
      { communityId: l.community.id, dispatchId: begun.dispatch.id, error: "timeout" },
      { clock: later(6 * MIN) },
    );

    const closed = await l.close();
    if (closed.status !== "closed") throw new Error(closed.status);
    const reasonOf = (id: string) => closed.entries.find((e) => e.contributionId === id)?.reason;
    expect(reasonOf(inFlight.contributionId)).toBe("pending_reconciliation");
    expect(reasonOf(reconciling.contributionId)).toBe("pending_reconciliation");
    expect(reasonOf(untouched.contributionId)).toBe("pending_at_close");
    expect(reasonOf(scored.contributionId)).toBeNull();
  });

  it("a pending upgrade keeps the ordinary 1× result", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    await l.score(intake.contributionId, 85);
    const upgrade = await l.nominateAt(intake.contributionId);
    await l.begin(upgrade.id);

    const closed = await l.close();
    if (closed.status !== "closed") throw new Error(closed.status);
    expect(closed.entries).toEqual([
      expect.objectContaining({ revision: 1, reason: null, pointUnits: 8_500_000_000n }),
    ]);
    expect(await l.nominationState(upgrade.id)).toBe("expired_at_close");
  });

  it("a retry returns the identical snapshot, even after a late completion", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    await l.score(intake.contributionId, 85);
    const upgrade = await l.nominateAt(intake.contributionId);
    const dispatch = await l.begin(upgrade.id);

    const first = await l.close();
    const late = await l.complete(dispatch, { effort }, WEEK_MS + 2 * MIN);
    expect(late).toMatchObject({
      status: "completed",
      decision: { revision: 2, affectsAllocation: false },
    });
    expect(await l.nominationState(upgrade.id)).toBe("completed_after_cutoff");
    const second = await l.close(WEEK_MS + 10 * MIN);

    if (first.status !== "closed" || second.status !== "closed") throw new Error("not closed");
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.entries).toEqual(first.entries);
    expect(second.members).toEqual(first.members);
    expect(second.entries[0]).toMatchObject({ revision: 1, pointUnits: 8_500_000_000n });
  });

  it("after close, a missing-evidence answer or a proven non-dispatch leaves the nomination expired", async () => {
    const l = await lane();
    const answered = await l.admitOne();
    const unsent = await l.admitOne(undefined, (await seedMember(l.community.id)).id);
    const first = await l.nominateAt(answered.contributionId);
    const firstDispatch = await l.begin(first.id);
    const second = await nominate(
      t.db,
      {
        communityId: l.community.id,
        memberId: unsent.memberId,
        contributionId: unsent.contributionId,
        idempotencyKey: "second",
      },
      { clock: later(3 * MIN) },
    );
    if (second.status !== "nominated") throw new Error(second.status);
    const secondDispatch = await l.begin(second.nomination.id);
    await markReconciliation(
      t.db,
      { communityId: l.community.id, dispatchId: secondDispatch.id, error: "timeout" },
      { clock: later(6 * MIN) },
    );
    await l.close();

    await l.complete(
      firstDispatch,
      { ...quality(80), effort: { ...effort, missingEssentialEvidence: "media_not_captured" } },
      WEEK_MS + 2 * MIN,
    );
    await recordNotSentProven(
      t.db,
      { communityId: l.community.id, dispatchId: secondDispatch.id, reason: "provider log" },
      { clock: later(WEEK_MS + 3 * MIN) },
    );
    expect(await l.nominationState(first.id)).toBe("expired_at_close");
    expect(await l.nominationState(second.nomination.id)).toBe("expired_at_close");
  });

  it("closes the epoch and materializes the next contiguous one", async () => {
    const l = await lane();

    await l.close(3 * WEEK_MS);
    const rows = await t.db
      .select()
      .from(epochs)
      .where(eq(epochs.communityId, l.community.id))
      .orderBy(asc(epochs.index));
    expect(rows.map((e) => [e.index, e.status])).toEqual([
      [1, "closed"],
      [2, "open"],
    ]);
    expect(rows[1]?.opensAt).toEqual(l.epoch.closesAt);
  });

  it("an intake exactly at closesAt belongs to the next epoch", async () => {
    const l = await lane();
    const result = await admitContribution(
      t.db,
      {
        communityId: l.community.id,
        memberId: l.member.id,
        contribution: {
          kind: "post",
          url: "https://x.com/a/status/boundary",
          text: "boundary",
          oembed: null,
          telegramMessageId: 1,
        },
        artifactKey: `x:status:boundary-${l.community.id}`,
        idempotencyKey: "tg:-1:boundary",
        capture: { source: "x_oembed", capturedAt: "", limitations: [] },
      },
      { clock: later(WEEK_MS) },
    );
    if (result.status !== "admitted") throw new Error(result.status);
    expect(result.intake.epochId).not.toBe(l.epoch.id);

    const closed = await l.close(WEEK_MS);
    if (closed.status !== "closed") throw new Error(closed.status);
    expect(closed.entries).toEqual([]);
  });
});

describe("dueCloses", () => {
  const due = async (communityId: string, atMs: number) =>
    (await dueCloses(t.db, new Date(T0.getTime() + atMs))).filter(
      (c) => c.communityId === communityId,
    );

  it("lists a pinned epoch from its scheduled close until its snapshot is written", async () => {
    const l = await lane();

    expect(await due(l.community.id, WEEK_MS - 1)).toEqual([]);
    expect(await due(l.community.id, WEEK_MS)).toEqual([
      { communityId: l.community.id, epochId: l.epoch.id },
    ]);
    await l.close(WEEK_MS);
    expect(await due(l.community.id, WEEK_MS + MIN)).toEqual([]);
  });

  it("never lists a legacy epoch", async () => {
    const { community } = await seedCommunity(t.db);
    await t.db.insert(epochs).values({
      communityId: community.id,
      index: 1,
      opensAt: T0,
      closesAt: new Date(T0.getTime() + WEEK_MS),
    });

    expect(await due(community.id, 2 * WEEK_MS)).toEqual([]);
  });
});
