import type { PayoutV1, RewardPurpose } from "@hyphae/core";
import {
  communities,
  contributions,
  epochs,
  members,
  memberWalletLinks,
  rulesTestPasses,
  scoringRuns,
} from "@hyphae/db";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedSignedLink } from "../../http/demo-seed.js";
import { evaluatePayoutGate } from "../../payout/gate.js";
import { closeEpoch } from "../../rewards/close.js";
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
  // The verdict's wallet is the member's signed one unless a test says otherwise.
  const checklist = (
    c: Omit<Parameters<typeof payoutChecklist>[0], "wallet"> & { wallet?: string | null },
  ) =>
    payoutChecklist({
      wallet: c.member.linkMethod === "signature" ? c.member.wallet : null,
      ...c,
    });

  it("before the close: three checks, the hold left to after the close, and the one next step", () => {
    expect(
      checklist({
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
      checklist({
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
    const { lines } = checklist({
      ...open,
      member: pasted,
      payout: v("not_payable", ["no_verified_wallet"], "at_close"),
    });
    expect(lines[1]).toBe("❌ Wallet: AbCd…WxYz is pasted, not signed");
  });

  it("with wallet and rules test done, nothing to do before the close, and never says the hold is met", () => {
    const { lines, step } = checklist({
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
    const { lines, step } = checklist({
      ...open,
      member: signed,
      payout: v("not_payable", ["no_points"], "at_close"),
    });
    expect(step).toBeNull();
    expect(lines.at(-1)).toBe("Next: earn points by replying to a raid.");
  });

  it("names the minimum without an amount when it cannot be read, and none when the rules set none", () => {
    const unknown = checklist({
      ...open,
      holdMin: null,
      member: signed,
      payout: v("held", ["hold_pending"], "at_close"),
    });
    expect(unknown.lines[3]).toBe(
      "⏳ Hold: read once after the close; needs the minimum balance set in the rules in that wallet",
    );
    const free = checklist({
      ...open,
      member: signed,
      payout: v("payable", [], "not_required"),
    });
    expect(free.lines[3]).toBe("✅ Hold: none required");
  });

  it("after the close: the gate's result and no next step", () => {
    const closed = { ...open, closed: true };
    const at = (member: typeof signed | typeof none, p: PayoutV1) =>
      checklist({ ...closed, member, payout: p });
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
    expect(at(signed, v("not_payable", ["below_hold"], "below")).lines.slice(3)).toEqual([
      "❌ Hold: under 100,000 MYCEL after the close",
      "Not payable: the wallet held less than the minimum after the close.",
    ]);
    expect(at(none, v("not_payable", ["no_verified_wallet"], "not_checked"))).toEqual({
      lines: [
        "To be paid for epoch 3 (closed):",
        "❌ Wallet: none signed by the close",
        "✅ Rules test: passed",
        "➖ Hold: not checked, since the wallet or rules test was missing",
        "Not payable: no wallet was signed by the close.",
      ],
      step: null,
    });
  });

  it("after the close, a member with no points is told so, never shown an all-green list", () => {
    const closed = { ...open, closed: true, member: signed };
    expect(
      checklist({ ...closed, payout: v("not_payable", ["no_points"], "not_checked") }),
    ).toEqual({
      lines: [
        "To be paid for epoch 3 (closed):",
        "✅ Wallet: AbCd…WxYz, signed",
        "✅ Rules test: passed",
        "➖ Hold: not checked, since there were no points",
        "Not payable: no points.",
      ],
      step: null,
    });
    // A rubric with no hold: every check is met, and the verdict still says why it does not pay.
    expect(
      checklist({ ...closed, payout: v("not_payable", ["no_points"], "not_required") }).lines,
    ).toEqual([
      "To be paid for epoch 3 (closed):",
      "✅ Wallet: AbCd…WxYz, signed",
      "✅ Rules test: passed",
      "✅ Hold: none required",
      "Not payable: no points.",
    ]);
    expect(
      checklist({
        ...closed,
        member: none,
        payout: v(
          "not_payable",
          ["no_points", "no_verified_wallet", "no_rules_test"],
          "not_checked",
        ),
      }).lines,
    ).toEqual([
      "To be paid for epoch 3 (closed):",
      "❌ Wallet: none signed by the close",
      "❌ Rules test: not passed by the close",
      "➖ Hold: not checked, since the wallet or rules test was missing",
      "Not payable: no wallet was signed by the close; the rules test was not passed by the close; no points.",
    ]);
    expect(
      checklist({
        ...closed,
        payout: v("not_payable", ["no_points", "no_rules_test"], "not_checked"),
      }).lines.slice(2),
    ).toEqual([
      "❌ Rules test: not passed by the close",
      "➖ Hold: not checked, since the wallet or rules test was missing",
      "Not payable: the rules test was not passed by the close; no points.",
    ]);
  });

  it("after the close, names the wallet signed at the close, and a later link apart from it", () => {
    const other = "BbBb2222222222222222222222222222ZzZz";
    const closed = { ...open, closed: true };
    expect(
      checklist({
        ...closed,
        wallet,
        member: { wallet: other, linkMethod: "signature" },
        payout: v("payable", [], "holder"),
      }).lines,
    ).toEqual([
      "To be paid for epoch 3 (closed):",
      "✅ Wallet: AbCd…WxYz, signed",
      "Current link: BbBb…ZzZz, signed",
      "✅ Rules test: passed",
      "✅ Hold: confirmed",
    ]);
    expect(
      checklist({
        ...closed,
        wallet: null,
        member: { wallet: other, linkMethod: "paste" },
        payout: v("not_payable", ["no_verified_wallet"], "not_checked"),
      }).lines.slice(1, 3),
    ).toEqual(["❌ Wallet: none signed by the close", "Current link: BbBb…ZzZz, pasted"]);
  });

  it("an epoch that pays no one, or is published, says so instead of a checklist", () => {
    expect(checklist({ ...open, member: signed, payout: { status: "unpaid_epoch" } })).toEqual({
      lines: ["Wallet AbCd…WxYz (verified)", "Epoch 3 has no payout."],
      step: null,
    });
    expect(
      checklist({ ...open, closed: true, member: none, payout: { status: "published" } }),
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
    const pasted = { wallet: l.member.wallet, linkMethod: "paste" };
    expect(await mePayout(t.db, input, deps)).toEqual({
      epochIndex: 1,
      closed: false,
      payout: { status: "unpaid_epoch" },
      wallet: null,
      member: pasted,
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
      wallet: null,
      member: pasted,
      holdMin: "100,000 MYCEL",
    });
    expect(
      (await mePayout(t.db, input, { ...deps, decimals: async () => undefined }))?.holdMin,
    ).toBeNull();
    expect((await mePayout(t.db, input, { ...deps, clock: later(WEEK_MS) }))?.payout).toMatchObject(
      { hold: "not_checked" },
    );
  });

  // The lane's member signs A, passes the rules test and scores; it then relinks to `relinkTo` at
  // `relinkAt`, which ends A's link where the new one starts.
  async function relinked(o: {
    signedA: boolean;
    relinkTo: "signature" | "paste";
    relinkAt: number;
  }) {
    const l = await seedRewardLane(t.db);
    const communityId = l.community.id;
    await t.db
      .update(communities)
      .set({ firstPaidEpoch: 1 })
      .where(eq(communities.id, communityId));
    const A = `AAAA${communityId.slice(0, 8)}AAAA`;
    const B = `BBBB${communityId.slice(0, 8)}BBBB`;
    if (o.signedA) {
      await seedSignedLink(t.db, {
        communityId,
        memberId: l.member.id,
        telegramUserId: 42n,
        wallet: A,
        tokenDigest: `me-a-${communityId}`,
        linkedAt: T0,
      });
      await t.db
        .update(members)
        .set({ wallet: A, linkMethod: "signature" })
        .where(eq(members.id, l.member.id));
    }
    await t.db.insert(rulesTestPasses).values({
      communityId,
      memberId: l.member.id,
      testId: "mycel-rules-1",
      passedAt: new Date(T0.getTime() + MIN),
    });
    const scored = await l.admitOne();
    await runEvaluation(
      t.db,
      { communityId, target: { contributionId: scored.contributionId } },
      { model: "test:fake", call: answer(85), horizonMs: 5 * MIN, clock: later(2 * MIN) },
    );
    const relinkAt = new Date(T0.getTime() + o.relinkAt);
    await t.db
      .update(memberWalletLinks)
      .set({ validTo: relinkAt })
      .where(and(eq(memberWalletLinks.memberId, l.member.id), isNull(memberWalletLinks.validTo)));
    if (o.relinkTo === "signature") {
      await seedSignedLink(t.db, {
        communityId,
        memberId: l.member.id,
        telegramUserId: 42n,
        wallet: B,
        tokenDigest: `me-b-${communityId}`,
        linkedAt: relinkAt,
      });
    }
    await t.db
      .update(members)
      .set({ wallet: B, linkMethod: o.relinkTo })
      .where(eq(members.id, l.member.id));
    return { l, A, B, input: { communityId, memberId: l.member.id } };
  }

  it("after the close, names the wallet signed at the close, not one linked since", async () => {
    const { l, A, B, input } = await relinked({
      signedA: true,
      relinkTo: "signature",
      relinkAt: WEEK_MS + MIN,
    });
    const deps = { clock: later(WEEK_MS + 2 * MIN), decimals: async () => 6 };
    // Past the close, before the close worker has frozen the epoch, then after it.
    const before = await mePayout(t.db, input, deps);
    expect(before).toMatchObject({
      closed: true,
      wallet: A,
      member: { wallet: B, linkMethod: "signature" },
    });
    expect(before && payoutChecklist(before).lines.slice(0, 3)).toEqual([
      "To be paid for epoch 1 (closed):",
      `✅ Wallet: ${A.slice(0, 4)}…${A.slice(-4)}, signed`,
      `Current link: ${B.slice(0, 4)}…${B.slice(-4)}, signed`,
    ]);
    const [epoch] = await t.db
      .select()
      .from(epochs)
      .where(eq(epochs.communityId, input.communityId));
    if (!epoch) throw new Error("no epoch");
    await closeEpoch(
      t.db,
      { communityId: l.community.id, epochId: epoch.id },
      { clock: later(WEEK_MS + 2 * MIN) },
    );
    // The gate pays epoch 1 to A; /me has moved on to epoch 2, whose wallet is the current B.
    const gate = await evaluatePayoutGate(t.db, { communityId: l.community.id, epochId: epoch.id });
    expect(gate.members.map((m) => m.wallet)).toEqual([A]);
    expect(await mePayout(t.db, input, deps)).toMatchObject({
      epochIndex: 2,
      closed: false,
      wallet: B,
      member: { wallet: B, linkMethod: "signature" },
    });
  });

  it("after the close, with no wallet signed by it, names none and the current link apart", async () => {
    const { B, input } = await relinked({
      signedA: false,
      relinkTo: "signature",
      relinkAt: WEEK_MS + MIN,
    });
    const status = await mePayout(t.db, input, {
      clock: later(WEEK_MS + 2 * MIN),
      decimals: async () => 6,
    });
    expect(status).toMatchObject({ wallet: null, member: { wallet: B, linkMethod: "signature" } });
    expect(status && payoutChecklist(status).lines.slice(0, 3)).toEqual([
      "To be paid for epoch 1 (closed):",
      "❌ Wallet: none signed by the close",
      `Current link: ${B.slice(0, 4)}…${B.slice(-4)}, signed`,
    ]);
  });

  it("while open, the verdict's wallet is the current signed link", async () => {
    const { B, input } = await relinked({
      signedA: true,
      relinkTo: "signature",
      relinkAt: 10 * MIN,
    });
    const status = await mePayout(t.db, input, { clock: later(20 * MIN), decimals: async () => 6 });
    expect(status).toMatchObject({
      closed: false,
      wallet: B,
      member: { wallet: B, linkMethod: "signature" },
    });
    expect(status && payoutChecklist(status).lines.slice(1, 3)).toEqual([
      `✅ Wallet: ${B.slice(0, 4)}…${B.slice(-4)}, signed`,
      "✅ Rules test: passed",
    ]);
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
