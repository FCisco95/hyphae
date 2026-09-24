import type { RewardPurpose } from "@hyphae/core";
import { contributions, epochs, members, scoringRuns } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { effectiveResults } from "./effective.js";
import { beginDispatch, completeDispatch, runEvaluation } from "./evaluation.js";
import { nominate } from "./slots.js";
import { createTestDb, later, seedRewardLane, T0 } from "./test-db.js";

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
  const upgrade = async (contributionId: string, completeAtMs: number) => {
    const n = await nominate(
      t.db,
      { communityId: s.community.id, memberId: s.member.id, contributionId, idempotencyKey: "u" },
      { clock: later(3 * MIN) },
    );
    if (n.status !== "nominated") throw new Error(n.status);
    const begun = await beginDispatch(
      t.db,
      {
        communityId: s.community.id,
        target: { nominationId: n.nomination.id },
        model: "test:fake",
      },
      { clock: later(4 * MIN) },
    );
    if (begun.status !== "begun") throw new Error(begun.status);
    return completeDispatch(
      t.db,
      {
        communityId: s.community.id,
        dispatchId: begun.dispatch.id,
        fence: begun.dispatch.fence,
        output: { effort },
        latencyMs: 5,
        costMicroUsd: 100,
      },
      { clock: later(completeAtMs) },
    );
  };
  const read = (opts: { memberId?: string; cutoff?: Date } = {}, clockMs = 10 * MIN) =>
    effectiveResults(
      t.db,
      { communityId: s.community.id, epochId: epoch.id, ...opts },
      { clock: later(clockMs) },
    );
  return { ...s, epoch, score, upgrade, read };
}

describe("effectiveResults", () => {
  it("an upgrade selects revision 2 at 255, never 85 + 255", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    await l.score(intake.contributionId, 85);
    await l.upgrade(intake.contributionId, 5 * MIN);

    const r = await l.read();
    expect(r.entries).toEqual([
      expect.objectContaining({
        contributionId: intake.contributionId,
        state: "scored",
        revision: 2,
        pointUnits: "25500000000",
      }),
    ]);
    expect(r.totals).toEqual([
      { memberId: l.member.id, pointUnits: "25500000000", wholePoints: "255" },
    ]);
  });

  it("ignores a revision accepted at closesAt; the earlier one stays selected", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    await l.score(intake.contributionId, 85);
    const late = await l.upgrade(intake.contributionId, WEEK_MS);
    expect(late).toMatchObject({ decision: { revision: 2, affectsAllocation: false } });

    const r = await l.read({}, WEEK_MS + MIN);
    expect(r.entries[0]).toMatchObject({ state: "scored", revision: 1, pointUnits: "8500000000" });
  });

  it("marks work whose only decision was accepted after close as late, with no points", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const begun = await beginDispatch(
      t.db,
      {
        communityId: l.community.id,
        target: { contributionId: intake.contributionId },
        model: "test:fake",
      },
      { clock: later(2 * MIN) },
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
      { clock: later(WEEK_MS + 1) },
    );

    const r = await l.read({}, WEEK_MS + MIN);
    expect(r.entries[0]).toMatchObject({ state: "late", decisionId: null, pointUnits: "0" });
    expect(r.totalEntries).toBe(1);
    expect(r.totals[0]).toMatchObject({ pointUnits: "0", wholePoints: "0" });
  });

  it("ignores legacy scoring runs and contributions outside the reward lane", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    await l.score(intake.contributionId, 85);
    const [legacy] = await t.db
      .insert(contributions)
      .values({
        communityId: l.community.id,
        memberId: l.member.id,
        kind: "text",
        text: "legacy submit",
        telegramMessageId: 9_999,
      })
      .returning();
    for (const contributionId of [intake.contributionId, legacy?.id ?? ""]) {
      await t.db.insert(scoringRuns).values({
        contributionId,
        model: "legacy",
        rubricVersion: "1.2.0",
        promptHash: "p",
        input: {},
        output: {},
        score: 99,
        timingMultiplier: 10_000,
        flags: [],
        reasoning: "legacy",
        latencyMs: 1,
        costMicroUsd: 1,
        evidenceHash: `legacy-${contributionId}`,
      });
    }

    const r = await l.read();
    expect(r.totalEntries).toBe(1);
    expect(r.totals[0]).toMatchObject({ pointUnits: "8500000000", wholePoints: "85" });
  });

  it("counts pending and zero-point entries in totalEntries", async () => {
    const l = await lane();
    const [scored, zero, pending] = [await l.admitOne(), await l.admitOne(), await l.admitOne()];
    await l.score(scored.contributionId, 85);
    await l.score(zero.contributionId, 59);

    const r = await l.read();
    expect(r.totalEntries).toBe(3);
    const state = (id: string) => r.entries.find((e) => e.contributionId === id);
    expect(state(scored.contributionId)).toMatchObject({
      state: "scored",
      pointUnits: "8500000000",
    });
    expect(state(zero.contributionId)).toMatchObject({ state: "scored", pointUnits: "0" });
    expect(state(pending.contributionId)).toMatchObject({
      state: "pending",
      decisionId: null,
      revision: null,
    });
    expect(r.totals[0]).toMatchObject({ wholePoints: "85" });
  });

  it("flips closed exactly at closesAt by the injected database clock", async () => {
    const l = await lane();
    expect((await l.read({}, WEEK_MS - 1)).closed).toBe(false);
    expect((await l.read({}, WEEK_MS)).closed).toBe(true);
  });

  it("reads one member and rounds whole points half-up once, after aggregation", async () => {
    const l = await lane();
    const [other] = await t.db
      .insert(members)
      .values({
        communityId: l.community.id,
        telegramUserId: 43n,
        wallet: `Other${l.community.id}`,
        linkMethod: "paste",
      })
      .returning();
    if (!other) throw new Error("no member");
    await l.score((await l.admitOne()).contributionId, 85);
    await l.score((await l.admitOne(undefined, other.id)).contributionId, 90);

    const mine = await l.read({ memberId: l.member.id });
    expect(mine.totalEntries).toBe(1);
    expect(mine.totals).toEqual([
      { memberId: l.member.id, pointUnits: "8500000000", wholePoints: "85" },
    ]);
    expect((await l.read()).totalEntries).toBe(2);
  });

  it("selects the last revision accepted before an explicit cutoff", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    await l.score(intake.contributionId, 85);
    await l.upgrade(intake.contributionId, 5 * MIN);

    const r = await l.read({ cutoff: new Date(T0.getTime() + 5 * MIN) });
    expect(r.entries[0]).toMatchObject({ state: "scored", revision: 1, pointUnits: "8500000000" });
  });
});
