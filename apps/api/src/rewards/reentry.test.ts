import type { RewardPurpose } from "@hyphae/core";
import { contributions, epochs, rewardIntakes, rewardSnapshotEntries } from "@hyphae/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeEpoch } from "./close.js";
import { beginDispatch, markReconciliation, runEvaluation } from "./evaluation.js";
import { admitContribution, type CapturedEvidence } from "./intake.js";
import { nominate } from "./slots.js";
import { createTestDb, later, seedRewardLane, seedTask, T0 } from "./test-db.js";

const MIN = 60_000;
const WEEK_MS = 7 * 86_400_000; // epoch 1 is [T0, T0 + WEEK_MS)
const IN_EPOCH_2 = WEEK_MS + 60 * MIN;

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
  output:
    purpose === "effort"
      ? { effort }
      : purpose === "quality_effort"
        ? { ...quality(score), effort }
        : quality(score),
  latencyMs: 5,
  costMicroUsd: 100,
});

async function lane() {
  const s = await seedRewardLane(t.db);
  const [epoch] = await t.db.select().from(epochs).where(eq(epochs.communityId, s.community.id));
  if (!epoch) throw new Error("no epoch");
  let key = 0;
  const nom = (contributionId: string, clockMs: number, evidence?: CapturedEvidence) => {
    key += 1;
    return nominate(
      t.db,
      {
        communityId: s.community.id,
        memberId: s.member.id,
        contributionId,
        idempotencyKey: `n${key}`,
        ...(evidence ? { evidence } : {}),
      },
      { clock: later(clockMs) },
    );
  };
  const close = () =>
    closeEpoch(t.db, { communityId: s.community.id, epochId: epoch.id }, { clock: later(WEEK_MS) });
  const intakesOf = (artifactKey: string) =>
    t.db
      .select()
      .from(rewardIntakes)
      .where(eq(rewardIntakes.artifactKey, artifactKey))
      .orderBy(asc(rewardIntakes.acceptedAt));
  return { ...s, epoch, nom, close, intakesOf };
}

// The post as it reads when it is nominated again.
const recaptured = (
  text = "edited after close",
  limitations: string[] = ["text_only"],
): CapturedEvidence => ({
  contribution: { url: "https://x.com/a/status/now", text, oembed: null, telegramMessageId: 42 },
  capture: { source: "x_oembed", capturedAt: T0.toISOString(), limitations },
});

describe("re-entry of an expired artifact (O3)", () => {
  it("nominates it in the next epoch as new linked work, leaving the frozen entry alone", async () => {
    const l = await lane();
    const original = await l.admitOne();
    const first = await l.nom(original.contributionId, 3 * MIN);
    if (first.status !== "nominated") throw new Error(first.status);
    const closed = await l.close();

    const again = await l.nom(original.contributionId, IN_EPOCH_2, recaptured());
    if (again.status !== "nominated") throw new Error(again.status);
    const [, reentry] = await l.intakesOf(original.artifactKey);
    expect(reentry).toMatchObject({ reentryOf: original.id, taskId: original.taskId });
    expect(reentry?.epochId).not.toBe(l.epoch.id);
    expect(reentry?.contributionId).not.toBe(original.contributionId);
    expect(again.nomination).toMatchObject({
      contributionId: reentry?.contributionId,
      epochId: reentry?.epochId,
      kind: "new_work",
      state: "ready",
    });
    expect(again.nomination.slotId).not.toBe(first.nomination.slotId);

    if (closed.status !== "closed") throw new Error(closed.status);
    const frozen = await t.db
      .select()
      .from(rewardSnapshotEntries)
      .where(eq(rewardSnapshotEntries.snapshotId, closed.snapshot.id));
    expect(frozen).toEqual(closed.entries);
  });

  it("asks for evidence captured now and admits nothing without it", async () => {
    const l = await lane();
    const original = await l.admitOne();
    await l.nom(original.contributionId, 3 * MIN);
    await l.close();

    expect((await l.nom(original.contributionId, IN_EPOCH_2)).status).toBe("needs_evidence");
    expect(await l.intakesOf(original.artifactKey)).toHaveLength(1);
  });

  it("judges the post as it reads now, not the capture frozen with the old epoch", async () => {
    const l = await lane();
    const original = await l.admitOne();
    await l.nom(original.contributionId, 3 * MIN);
    await l.close();
    const now = recaptured("pic.x.com/abc added", ["text_only", "media_not_captured"]);

    const again = await l.nom(original.contributionId, IN_EPOCH_2, now);
    if (again.status !== "nominated") throw new Error(again.status);
    const [kept, reentry] = await l.intakesOf(original.artifactKey);
    expect(kept?.capture).toEqual(original.capture);
    expect(reentry?.capture).toEqual(now.capture);
    const [work] = await t.db
      .select()
      .from(contributions)
      .where(eq(contributions.id, again.nomination.contributionId));
    expect(work).toMatchObject({ text: "pic.x.com/abc added", url: "https://x.com/a/status/now" });
    expect(again.nomination).toMatchObject({
      state: "pending_evidence",
      pendingReason: "media_not_captured",
    });
  });

  it("names the new work when the same artifact is nominated again", async () => {
    const l = await lane();
    const original = await l.admitOne();
    await l.nom(original.contributionId, 3 * MIN);
    await l.close();
    const again = await l.nom(original.contributionId, IN_EPOCH_2, recaptured());
    if (again.status !== "nominated") throw new Error(again.status);

    const third = await l.nom(original.contributionId, IN_EPOCH_2 + MIN, recaptured());
    expect(third).toMatchObject({
      status: "already_nominated",
      nomination: { id: again.nomination.id },
    });
    expect(await l.intakesOf(original.artifactKey)).toHaveLength(2);

    const resubmitted = await admitContribution(
      t.db,
      {
        communityId: l.community.id,
        memberId: l.member.id,
        contribution: {
          kind: "post",
          url: "https://x.com/a/status/again",
          text: "again",
          oembed: null,
          telegramMessageId: 7,
        },
        artifactKey: original.artifactKey,
        idempotencyKey: "tg:-1:resubmitted",
        capture: { source: "x_oembed", capturedAt: T0.toISOString(), limitations: [] },
      },
      { clock: later(IN_EPOCH_2 + 2 * MIN) },
    );
    expect(resubmitted).toMatchObject({
      status: "duplicate_artifact",
      intake: { id: original.id },
    });
  });

  it("admits nothing when the current epoch's slot is already used", async () => {
    const l = await lane();
    const original = await l.admitOne();
    await l.nom(original.contributionId, 3 * MIN);
    await l.close();
    const other = await admitContribution(
      t.db,
      {
        communityId: l.community.id,
        memberId: l.member.id,
        contribution: {
          kind: "post",
          url: "https://x.com/a/status/other",
          text: "other",
          oembed: null,
          telegramMessageId: 8,
        },
        artifactKey: `x:status:other-${l.community.id}`,
        idempotencyKey: "tg:-1:other",
        capture: { source: "x_oembed", capturedAt: T0.toISOString(), limitations: [] },
      },
      { clock: later(IN_EPOCH_2) },
    );
    if (other.status !== "admitted") throw new Error(other.status);
    expect((await l.nom(other.intake.contributionId, IN_EPOCH_2)).status).toBe("nominated");

    expect((await l.nom(original.contributionId, IN_EPOCH_2 + MIN, recaptured())).status).toBe(
      "slot_in_use",
    );
    expect(await l.intakesOf(original.artifactKey)).toHaveLength(1);
  });

  it("waits for the close to be recorded", async () => {
    const l = await lane();
    const original = await l.admitOne();
    await l.nom(original.contributionId, 3 * MIN);

    expect((await l.nom(original.contributionId, IN_EPOCH_2, recaptured())).status).toBe(
      "epoch_closed",
    );
  });

  it("stays blocked while an earlier model request is unresolved", async () => {
    const l = await lane();
    const original = await l.admitOne();
    const first = await l.nom(original.contributionId, 3 * MIN);
    if (first.status !== "nominated") throw new Error(first.status);
    const begun = await beginDispatch(
      t.db,
      { communityId: l.community.id, target: { nominationId: first.nomination.id }, model: "m" },
      { clock: later(4 * MIN) },
    );
    if (begun.status !== "begun") throw new Error(begun.status);
    await markReconciliation(
      t.db,
      { communityId: l.community.id, dispatchId: begun.dispatch.id, error: "timeout" },
      { clock: later(5 * MIN) },
    );
    await l.close();

    expect((await l.nom(original.contributionId, IN_EPOCH_2, recaptured())).status).toBe(
      "reentry_blocked",
    );
  });

  it("is refused once any evaluation of the artifact completed", async () => {
    const l = await lane();
    const original = await l.admitOne();
    await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: original.contributionId } },
      { model: "m", call: answer(85), horizonMs: 5 * MIN, clock: later(2 * MIN) },
    );
    await l.nom(original.contributionId, 3 * MIN); // an upgrade left pending at close
    await l.close();

    expect((await l.nom(original.contributionId, IN_EPOCH_2, recaptured())).status).toBe(
      "epoch_closed",
    );
  });

  it("times the new attempt from the original submission, not the re-entry", async () => {
    const l = await lane();
    const task = await seedTask(t.db, l.community.id, T0);
    const admitted = await admitContribution(
      t.db,
      {
        communityId: l.community.id,
        memberId: l.member.id,
        taskId: task.id,
        contribution: {
          kind: "reply",
          url: "https://x.com/a/status/timed",
          text: "timed",
          oembed: null,
          telegramMessageId: 9,
        },
        artifactKey: `x:status:timed-${l.community.id}`,
        idempotencyKey: "tg:-1:timed",
        capture: { source: "x_oembed", capturedAt: T0.toISOString(), limitations: [] },
      },
      { clock: later(MIN) },
    );
    if (admitted.status !== "admitted") throw new Error(admitted.status);
    await l.nom(admitted.intake.contributionId, 3 * MIN);
    await l.close();
    const again = await l.nom(admitted.intake.contributionId, IN_EPOCH_2, recaptured());
    if (again.status !== "nominated") throw new Error(again.status);

    const result = await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { nominationId: again.nomination.id } },
      { model: "m", call: answer(85), horizonMs: 5 * MIN, clock: later(IN_EPOCH_2 + MIN) },
    );
    expect(result).toMatchObject({
      status: "completed",
      decision: { timingBps: 10_000, pointUnits: 25_500_000_000n, affectsAllocation: true },
    });
  });
});
