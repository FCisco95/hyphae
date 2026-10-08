import type { PayoutV1, RewardPurpose } from "@hyphae/core";
import { communities, contributions, epochs, scoringRuns } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { beginDispatch, completeDispatch, runEvaluation } from "../../rewards/evaluation.js";
import { createTestDb, later, seedCommunity, seedRewardLane, T0 } from "../../rewards/test-db.js";
import { mePayout, meSummary, payoutChecklist, walletLines } from "./me-summary.js";

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

describe("payoutChecklist", () => {
  const wallet = "AbCd1111111111111111111111111111WxYz";
  const signed = { wallet, linkMethod: "signature" as const };
  const none = { wallet: null, linkMethod: null };
  const pasted = { wallet, linkMethod: "paste" as const };
  const open = { epochIndex: 3, closed: false, holdMin: "100,000 MYCEL" };
  const v = (status: "payable" | "held" | "not_payable", reasons: string[], hold: string) =>
    ({ status, reasons, hold }) as PayoutV1;

  it("before the close: three checks, the hold left to after the close, and the one next step", () => {
    expect(
      payoutChecklist({
        ...open,
        member: none,
        payout: v("not_payable", ["no_verified_wallet", "no_rules_test"], "at_close"),
      }),
    ).toEqual({
      lines: [
        "To be paid for epoch 3:",
        "❌ Wallet: none signed yet",
        "❌ Rules test: not passed yet",
        "⏳ Hold: read once after the close; needs at least 100,000 MYCEL in that wallet",
        "Next: link a wallet by signing. It is free and moves no funds.",
      ],
      step: "wallet",
    });
    expect(
      payoutChecklist({
        ...open,
        member: signed,
        payout: v("not_payable", ["no_rules_test"], "at_close"),
      }),
    ).toEqual({
      lines: [
        "To be paid for epoch 3:",
        "✅ Wallet: AbCd…WxYz, signed",
        "❌ Rules test: not passed yet",
        "⏳ Hold: read once after the close; needs at least 100,000 MYCEL in that wallet",
        "Next: take the rules test. Every answer must be right.",
      ],
      step: "rules",
    });
  });

  it("names a pasted wallet as not signed", () => {
    const { lines } = payoutChecklist({
      ...open,
      member: pasted,
      payout: v("not_payable", ["no_verified_wallet"], "at_close"),
    });
    expect(lines[1]).toBe("❌ Wallet: AbCd…WxYz is pasted, not signed");
  });

  it("with wallet and rules test done, nothing to do before the close, and never says the hold is met", () => {
    const { lines, step } = payoutChecklist({
      ...open,
      member: signed,
      payout: v("held", ["hold_pending"], "at_close"),
    });
    expect(step).toBeNull();
    expect(lines.slice(1)).toEqual([
      "✅ Wallet: AbCd…WxYz, signed",
      "✅ Rules test: passed",
      "⏳ Hold: read once after the close; needs at least 100,000 MYCEL in that wallet",
      "Nothing else to do now.",
    ]);
    expect(lines.join("\n")).not.toMatch(/✅ Hold/);
  });

  it("asks for points when they are all that is missing", () => {
    const { lines, step } = payoutChecklist({
      ...open,
      member: signed,
      payout: v("not_payable", ["no_points"], "at_close"),
    });
    expect(step).toBeNull();
    expect(lines.at(-1)).toBe("Next: earn points by replying to a raid.");
  });

  it("names the minimum without an amount when it cannot be read, and none when the rules set none", () => {
    const unknown = payoutChecklist({
      ...open,
      holdMin: null,
      member: signed,
      payout: v("held", ["hold_pending"], "at_close"),
    });
    expect(unknown.lines[3]).toBe(
      "⏳ Hold: read once after the close; needs the minimum balance set in the rules in that wallet",
    );
    const free = payoutChecklist({
      ...open,
      member: signed,
      payout: v("payable", [], "not_required"),
    });
    expect(free.lines[3]).toBe("✅ Hold: none required");
  });

  it("after the close: the gate's result and no next step", () => {
    const closed = { ...open, closed: true };
    const at = (member: typeof signed | typeof none, p: PayoutV1) =>
      payoutChecklist({ ...closed, member, payout: p });
    expect(at(signed, v("payable", [], "holder"))).toEqual({
      lines: [
        "To be paid for epoch 3 (closed):",
        "✅ Wallet: AbCd…WxYz, signed",
        "✅ Rules test: passed",
        "✅ Hold: confirmed",
      ],
      step: null,
    });
    expect(at(signed, v("held", ["hold_pending"], "pending")).lines[3]).toBe(
      "⏳ Hold: being checked",
    );
    expect(at(signed, v("not_payable", ["below_hold"], "below")).lines[3]).toBe(
      "❌ Hold: under 100,000 MYCEL after the close",
    );
    expect(at(none, v("not_payable", ["no_verified_wallet"], "not_checked"))).toEqual({
      lines: [
        "To be paid for epoch 3 (closed):",
        "❌ Wallet: none signed by the close",
        "✅ Rules test: passed",
        "➖ Hold: not checked, since the wallet or rules test was missing",
      ],
      step: null,
    });
  });

  it("an epoch that pays no one, or is published, says so instead of a checklist", () => {
    expect(
      payoutChecklist({ ...open, member: signed, payout: { status: "unpaid_epoch" } }),
    ).toEqual({ lines: ["Wallet AbCd…WxYz (verified)", "Epoch 3 has no payout."], step: null });
    expect(
      payoutChecklist({ ...open, closed: true, member: none, payout: { status: "published" } }),
    ).toEqual({
      lines: [
        "No wallet yet. Your replies still earn points; to be paid, link a wallet by signing before the epoch closes: send /link.",
        "Epoch 3 is published. Its settlement on the site shows each payout.",
      ],
      step: null,
    });
  });
});

describe("mePayout", () => {
  it("reads the gate's status for the epoch /me shows, with the minimum in whole tokens", async () => {
    const l = await seedRewardLane(t.db);
    const scored = await l.admitOne();
    await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: scored.contributionId } },
      { model: "test:fake", call: answer(85), horizonMs: 5 * MIN, clock: later(2 * MIN) },
    );
    const input = { communityId: l.community.id, memberId: l.member.id };
    const deps = { clock: later(10 * MIN), decimals: async () => 6 };
    expect(await mePayout(t.db, input, deps)).toEqual({
      epochIndex: 1,
      closed: false,
      payout: { status: "unpaid_epoch" },
      holdMin: "100,000 MYCEL",
    });
    await t.db
      .update(communities)
      .set({ firstPaidEpoch: 1 })
      .where(eq(communities.id, l.community.id));
    expect(await mePayout(t.db, input, deps)).toEqual({
      epochIndex: 1,
      closed: false,
      // The lane's member has only a pasted wallet.
      payout: {
        status: "not_payable",
        reasons: ["no_verified_wallet", "no_rules_test"],
        hold: "at_close",
      },
      holdMin: "100,000 MYCEL",
    });
    expect(
      (await mePayout(t.db, input, { ...deps, decimals: async () => undefined }))?.holdMin,
    ).toBeNull();
    expect((await mePayout(t.db, input, { ...deps, clock: later(WEEK_MS) }))?.payout).toMatchObject(
      { hold: "not_checked" },
    );
  });

  it("is null before any reward epoch has opened", async () => {
    const l = await seedRewardLane(t.db);
    expect(
      await mePayout(
        t.db,
        { communityId: l.community.id, memberId: l.member.id },
        { clock: later(-60 * MIN), decimals: async () => 6 },
      ),
    ).toBeNull();
  });
});
