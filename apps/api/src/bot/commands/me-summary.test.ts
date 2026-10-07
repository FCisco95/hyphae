import type { RewardPurpose } from "@hyphae/core";
import { contributions, epochs, scoringRuns } from "@hyphae/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { beginDispatch, completeDispatch, runEvaluation } from "../../rewards/evaluation.js";
import { createTestDb, later, seedCommunity, seedRewardLane, T0 } from "../../rewards/test-db.js";
import { meSummary, walletLines } from "./me-summary.js";

const MIN = 60_000;
const WEEK_MS = 7 * 86_400_000;

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const answer = (score: number) => async (_prompt: unknown, _purpose: RewardPurpose) => ({
  output: {
    score,
    rubricHits: [{ key: "context_fit", met: true, note: "specific" }],
    flags: [],
    aiSlop: { patterns: [], templateRhythm: false },
    reasoning: "Specific to the post and checked.",
  },
  latencyMs: 5,
  costMicroUsd: 100,
});

const legacyRun = (contributionId: string, n: number) =>
  t.db.insert(scoringRuns).values({
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
    evidenceHash: `legacy-${contributionId}-${n}`,
  });

describe("meSummary", () => {
  it("shows the current epoch through the effective read, ignoring legacy runs", async () => {
    const l = await seedRewardLane(t.db);
    const scored = await l.admitOne();
    await l.admitOne(); // stays pending
    await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: scored.contributionId } },
      { model: "test:fake", call: answer(85), horizonMs: 5 * MIN, clock: later(2 * MIN) },
    );
    await legacyRun(scored.contributionId, 1);

    const lines = await meSummary(
      t.db,
      { communityId: l.community.id, memberId: l.member.id },
      { clock: later(10 * MIN) },
    );
    expect(lines).toEqual([
      "Epoch 1, open until 2026-10-08 00:00 UTC",
      "Entries: 2 (1 pending)",
      "Points: 85 (85 whole)",
    ]);
  });

  it("says when the epoch has closed and counts a score accepted after close as late", async () => {
    const l = await seedRewardLane(t.db);
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
    const { output } = await answer(85)(null, "quality");
    await completeDispatch(
      t.db,
      {
        communityId: l.community.id,
        dispatchId: begun.dispatch.id,
        fence: begun.dispatch.fence,
        output,
        latencyMs: 5,
        costMicroUsd: 100,
      },
      { clock: later(WEEK_MS) },
    );

    const lines = await meSummary(
      t.db,
      { communityId: l.community.id, memberId: l.member.id },
      { clock: later(WEEK_MS) },
    );
    expect(lines).toEqual([
      "Epoch 1 closed at 2026-10-08 00:00 UTC; these points no longer change.",
      "Entries: 1 (1 not scored before close)",
      "Points: 0 (0 whole)",
    ]);
  });

  it("stops calling undecided work pending once the epoch has closed", async () => {
    const l = await seedRewardLane(t.db);
    await l.admitOne();
    expect(
      await meSummary(
        t.db,
        { communityId: l.community.id, memberId: l.member.id },
        { clock: later(2 * MIN) },
      ),
    ).toContain("Entries: 1 (1 pending)");
    // Any decision accepted from now on is late, so the entry can no longer add points.
    expect(
      await meSummary(
        t.db,
        { communityId: l.community.id, memberId: l.member.id },
        { clock: later(WEEK_MS) },
      ),
    ).toEqual([
      "Epoch 1 closed at 2026-10-08 00:00 UTC; these points no longer change.",
      "Entries: 1 (1 not scored before close)",
      "Points: 0 (0 whole)",
    ]);
  });

  it("gives a community without reward epochs its scored count and no points line", async () => {
    const { community, member } = await seedCommunity(t.db);
    const [c] = await t.db
      .insert(contributions)
      .values({
        communityId: community.id,
        memberId: member.id,
        kind: "text",
        text: "legacy",
        telegramMessageId: 1,
      })
      .returning();
    if (!c) throw new Error("no contribution");
    await legacyRun(c.id, 1);
    await legacyRun(c.id, 2);

    expect(await meSummary(t.db, { communityId: community.id, memberId: member.id })).toEqual([
      "Scored contributions: 1",
    ]);
  });

  it("treats a community whose only epochs are legacy (unpinned) as legacy", async () => {
    const { community, member } = await seedCommunity(t.db);
    await t.db.insert(epochs).values({
      communityId: community.id,
      index: 1,
      opensAt: T0,
      closesAt: new Date(T0.getTime() + WEEK_MS),
    });
    const [c] = await t.db
      .insert(contributions)
      .values({
        communityId: community.id,
        memberId: member.id,
        kind: "text",
        text: "legacy",
        telegramMessageId: 1,
      })
      .returning();
    if (!c) throw new Error("no contribution");
    await legacyRun(c.id, 1);

    expect(
      await meSummary(
        t.db,
        { communityId: community.id, memberId: member.id },
        { clock: later(10 * MIN) },
      ),
    ).toEqual(["Scored contributions: 1"]);
  });
});

describe("walletLines", () => {
  const wallet = "AbCd1111111111111111111111111111WxYz";

  it("marks a pasted wallet as unverified and unpayable", () => {
    expect(walletLines({ wallet, linkMethod: "paste" })).toEqual([
      "Wallet AbCd…WxYz",
      "Wallet not verified. Send /link to verify it (needed before any payout).",
    ]);
  });

  it("tells a member without a wallet that points count and a signed wallet is needed to be paid", () => {
    expect(walletLines({ wallet: null, linkMethod: null })).toEqual([
      "No wallet yet. Your replies still earn points; to be paid, link a wallet by signing before the epoch closes: send /link.",
    ]);
  });

  it("shows a signed wallet as verified", () => {
    expect(walletLines({ wallet, linkMethod: "signature" })).toEqual([
      "Wallet AbCd…WxYz (verified)",
    ]);
  });
});
