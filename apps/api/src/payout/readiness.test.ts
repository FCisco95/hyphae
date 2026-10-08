import { randomUUID } from "node:crypto";
import { type PayoutV1, ReadApiV1, ReadApiV1Loose } from "@hyphae/core";
import {
  communities,
  epochs,
  holdChecks,
  members,
  rewardEpochSnapshots,
  rulesTestPasses,
} from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fakeModel, seedSignedLink } from "../http/demo-seed.js";
import { closeEpoch } from "../rewards/close.js";
import { buildRewardConfigPayload } from "../rewards/config.js";
import { runEvaluation } from "../rewards/evaluation.js";
import { at, createTestDb, later, rubric, seedRewardLane, T0 } from "../rewards/test-db.js";
import { evaluatePayoutGate } from "./gate.js";
import { epochPayouts, nextStep, payoutOf } from "./readiness.js";
import { RULES_TESTS } from "./rules-test.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const MIN = 60_000;
const TEST_ID = "mycel-rules-1";

type Combo = { wallet: boolean; rules: boolean; points: boolean };
const COMBOS: Combo[] = [false, true].flatMap((wallet) =>
  [false, true].flatMap((rules) => [false, true].map((points) => ({ wallet, rules, points }))),
);
const complete = { wallet: true, rules: true, points: true };
const missing = (c: Combo) => [
  ...(c.points ? [] : ["no_points"]),
  ...(c.wallet ? [] : ["no_verified_wallet"]),
  ...(c.rules ? [] : ["no_rules_test"]),
];

let telegramSeq = 5_000n;

// A paid epoch 1 with one member per combination of signed wallet, rules test passed before the
// close and points, plus `extra` more members who meet all three.
async function seedCombos(o: { minHoldUnits?: string; extra?: number } = {}) {
  const lane = await seedRewardLane(
    t.db,
    buildRewardConfigPayload({ ...rubric, minHoldUnits: o.minHoldUnits ?? rubric.minHoldUnits }),
  );
  const communityId = lane.community.id;
  await t.db.update(communities).set({ firstPaidEpoch: 1 }).where(eq(communities.id, communityId));
  const [epoch] = await t.db
    .select()
    .from(epochs)
    .where(and(eq(epochs.communityId, communityId), eq(epochs.index, 1)));
  if (!epoch) throw new Error("no epoch 1");

  const seeded: { combo: Combo; memberId: string; wallet: string }[] = [];
  for (const combo of [...COMBOS, ...Array.from({ length: o.extra ?? 0 }, () => complete)]) {
    telegramSeq += 1n;
    const wallet = `Signed${telegramSeq}Wallet`;
    const [member] = await t.db
      .insert(members)
      .values(
        combo.wallet
          ? { communityId, telegramUserId: telegramSeq, wallet, linkMethod: "signature" }
          : { communityId, telegramUserId: telegramSeq, linkedAt: null },
      )
      .returning();
    if (!member) throw new Error("seed: member");
    if (combo.wallet) {
      await seedSignedLink(t.db, {
        communityId,
        memberId: member.id,
        telegramUserId: telegramSeq,
        wallet,
        tokenDigest: `readiness-${randomUUID()}`,
        linkedAt: new Date(T0.getTime() - 60 * MIN),
      });
    }
    if (combo.rules) {
      await t.db.insert(rulesTestPasses).values({
        communityId,
        memberId: member.id,
        testId: TEST_ID,
        passedAt: new Date(T0.getTime() + 60 * MIN),
      });
    }
    const intake = await lane.admitOne(undefined, member.id);
    // 40 is under the floor of 60: scored, and worth no points.
    const scored = await runEvaluation(
      t.db,
      { communityId, target: { contributionId: intake.contributionId } },
      {
        model: "test:fake",
        call: fakeModel(combo.points ? 85 : 40),
        horizonMs: 5 * MIN,
        clock: later(2 * MIN),
      },
    );
    if (scored.status !== "completed") throw new Error(`seed: evaluate ${scored.status}`);
    seeded.push({ combo, memberId: member.id, wallet });
  }

  const community = { mint: lane.community.mint, firstPaidEpoch: 1 };
  const memberIds = seeded.map((s) => s.memberId);
  const close = async () => {
    const closed = await closeEpoch(
      t.db,
      { communityId, epochId: epoch.id },
      { clock: at(new Date(epoch.closesAt.getTime() + MIN)) },
    );
    if (closed.status !== "closed") throw new Error("seed: close");
    const [row] = await t.db.select().from(epochs).where(eq(epochs.id, epoch.id));
    const [snapshot] = await t.db
      .select({ id: rewardEpochSnapshots.id })
      .from(rewardEpochSnapshots)
      .where(eq(rewardEpochSnapshots.epochId, epoch.id));
    if (!row || !snapshot) throw new Error("seed: snapshot");
    return { epoch: row, snapshotId: snapshot.id };
  };
  const hold = (memberId: string, status: "holder" | "below" | "uncertain", wallet?: string) => {
    const s = seeded.find((m) => m.memberId === memberId);
    if (!s) throw new Error("hold: unknown member");
    return t.db.insert(holdChecks).values({
      communityId,
      epochId: epoch.id,
      memberId,
      wallet: wallet ?? s.wallet,
      mint: lane.community.mint,
      thresholdRaw: rubric.minHoldUnits,
      checkRound: randomUUID(),
      status,
      attempts: 1,
      ...(status === "uncertain"
        ? { reason: "outage" }
        : {
            rawAmount: status === "holder" ? "150000000000" : "1",
            decimals: 6,
            provider: "consensus",
            slot: "321",
            observedAt: new Date(epoch.closesAt.getTime() + 5 * MIN),
          }),
    });
  };
  return { communityId, community, epoch, seeded, memberIds, close, hold };
}

describe("payoutOf", () => {
  const verdict = (status: "payable" | "held" | "not_payable", reasons: string[]) => ({
    status,
    reasons: reasons as never[],
    holdResult: null,
  });

  it("never names a hold result before the close", () => {
    expect(
      payoutOf(verdict("held", ["hold_pending"]), { closed: false, holdRequired: true }),
    ).toEqual({ status: "held", reasons: ["hold_pending"], hold: "at_close" });
    expect(
      payoutOf(verdict("not_payable", ["no_rules_test"]), { closed: false, holdRequired: true }),
    ).toEqual({ status: "not_payable", reasons: ["no_rules_test"], hold: "at_close" });
  });

  it("after the close: pending for a candidate, not checked for anyone else", () => {
    expect(
      payoutOf(verdict("held", ["hold_pending"]), { closed: true, holdRequired: true }),
    ).toEqual({
      status: "held",
      reasons: ["hold_pending"],
      hold: "pending",
    });
    expect(
      payoutOf(verdict("not_payable", ["no_verified_wallet"]), {
        closed: true,
        holdRequired: true,
      }),
    ).toEqual({ status: "not_payable", reasons: ["no_verified_wallet"], hold: "not_checked" });
  });

  it("names no hold where the rubric sets none", () => {
    for (const closed of [false, true]) {
      expect(payoutOf(verdict("payable", []), { closed, holdRequired: false }).hold).toBe(
        "not_required",
      );
    }
  });

  it("before the close, ignores a hold result already recorded by the time of the read", () => {
    const open = { closed: false, holdRequired: true };
    const result = (status: "holder" | "below") => ({ check: { status } }) as never;
    const holder = payoutOf({ ...verdict("payable", []), holdResult: result("holder") }, open);
    const below = payoutOf(
      { ...verdict("not_payable", ["below_hold"]), holdResult: result("below") },
      open,
    );
    for (const p of [holder, below]) {
      expect(p).toEqual({ status: "held", reasons: ["hold_pending"], hold: "at_close" });
      expect(schemasAccept(false, p)).toEqual([true, true]);
    }
  });
});

// Whether the strict schema (this API's output) and the loose one (a consumer's) accept `payout`
// on a leaderboard entry of an epoch read as `closed`.
function schemasAccept(closed: boolean, payout: PayoutV1) {
  const ts = "2026-10-09T00:00:00.000000Z";
  const board = {
    community: { mint: "Mint1" },
    epoch: { index: 1, opens_at: ts, closes_at: ts },
    closed,
    final: false,
    as_of: ts,
    total_entries: 1,
    total_contributions: 1,
    offset: 0,
    limit: 50,
    entries: [
      {
        rank: 1,
        member_id: "00000000-0000-4000-8000-000000000001",
        wallet: null,
        wallet_status: "none",
        point_units: "0",
        points: "0",
        whole_points: "0",
        contributions: 1,
        counted: 1,
        pending: 0,
        payout,
      },
    ],
  };
  return [ReadApiV1.leaderboard, ReadApiV1Loose.leaderboard].map(
    (s) => s.safeParse(board).success,
  );
}

describe("epochPayouts", () => {
  it("before the close: every combination, with the hold left to the close", async () => {
    const s = await seedCombos();
    const { members: got } = await epochPayouts(t.db, {
      community: s.community,
      epoch: s.epoch,
      snapshotId: null,
      closed: false,
      memberIds: s.memberIds,
    });
    for (const { combo, memberId } of s.seeded) {
      const reasons = missing(combo);
      expect(got.get(memberId), JSON.stringify(combo)).toEqual(
        reasons.length === 0
          ? { status: "held", reasons: ["hold_pending"], hold: "at_close" }
          : { status: "not_payable", reasons, hold: "at_close" },
      );
    }
  });

  it("after the close: every combination, then each decided hold result, as the gate judges them", async () => {
    const s = await seedCombos({ extra: 3 });
    const { epoch, snapshotId } = await s.close();
    const judge = async () =>
      (
        await epochPayouts(t.db, {
          community: s.community,
          epoch,
          snapshotId,
          closed: true,
          memberIds: s.memberIds,
        })
      ).members;

    const before = await judge();
    for (const { combo, memberId } of s.seeded) {
      const reasons = missing(combo);
      expect(before.get(memberId), JSON.stringify(combo)).toEqual(
        reasons.length === 0
          ? { status: "held", reasons: ["hold_pending"], hold: "pending" }
          : { status: "not_payable", reasons, hold: "not_checked" },
      );
    }

    const candidates = s.seeded.filter((m) => missing(m.combo).length === 0);
    const [holder, below, uncertain, elsewhere] = candidates.map((c) => c.memberId ?? "");
    await s.hold(holder ?? "", "holder");
    await s.hold(below ?? "", "below");
    await s.hold(uncertain ?? "", "uncertain");
    // A result for another wallet never counts.
    await s.hold(elsewhere ?? "", "holder", "AnotherWallet");
    const after = await judge();
    expect([holder, below, uncertain, elsewhere].map((id) => after.get(id ?? ""))).toEqual([
      { status: "payable", reasons: [], hold: "holder" },
      { status: "not_payable", reasons: ["below_hold"], hold: "below" },
      { status: "held", reasons: ["hold_pending"], hold: "pending" },
      { status: "held", reasons: ["hold_pending"], hold: "pending" },
    ]);

    // The same verdicts the payout gate reaches, member by member.
    const gate = await evaluatePayoutGate(t.db, { communityId: s.communityId, epochId: epoch.id });
    for (const id of s.memberIds) {
      const verdict = gate.members.find((m) => m.memberId === id);
      const payout = after.get(id);
      expect(payout && "reasons" in payout && [payout.status, payout.reasons]).toEqual([
        verdict?.status,
        verdict?.reasons,
      ]);
    }
  });

  it("read as open after the hold check committed: every member still waits for the close", async () => {
    const s = await seedCombos({ extra: 2 });
    const { epoch, snapshotId } = await s.close();
    const [holder, below] = s.seeded
      .filter((m) => missing(m.combo).length === 0)
      .map((c) => c.memberId);
    await s.hold(holder ?? "", "holder");
    await s.hold(below ?? "", "below");
    // A read whose clock was taken before the close and whose snapshot came after the check.
    for (const snapshot of [snapshotId, null]) {
      const { members: got } = await epochPayouts(t.db, {
        community: s.community,
        epoch,
        snapshotId: snapshot,
        closed: false,
        memberIds: s.memberIds,
      });
      for (const { combo, memberId } of s.seeded) {
        const reasons = missing(combo);
        const p = got.get(memberId);
        expect(p, JSON.stringify(combo)).toEqual(
          reasons.length === 0
            ? { status: "held", reasons: ["hold_pending"], hold: "at_close" }
            : { status: "not_payable", reasons, hold: "at_close" },
        );
        expect(p && schemasAccept(false, p)).toEqual([true, true]);
      }
    }
  });

  it("names the epoch, not the member, when it pays no one or is published", async () => {
    const s = await seedCombos();
    const statusOf = async (o: {
      firstPaidEpoch?: number | null;
      tests?: typeof RULES_TESTS;
      published?: boolean;
    }) => {
      const r = await epochPayouts(
        t.db,
        {
          community: {
            ...s.community,
            firstPaidEpoch: o.firstPaidEpoch === undefined ? 1 : o.firstPaidEpoch,
          },
          epoch: { ...s.epoch, ...(o.published ? { status: "published" as const } : {}) },
          snapshotId: null,
          closed: false,
          memberIds: s.memberIds,
        },
        o.tests ? { tests: o.tests } : {},
      );
      return [...new Set([...r.members.values()].map((p) => p.status))];
    };
    expect(await statusOf({ firstPaidEpoch: null })).toEqual(["unpaid_epoch"]);
    expect(await statusOf({ firstPaidEpoch: 2 })).toEqual(["unpaid_epoch"]);
    expect(await statusOf({ tests: [] })).toEqual(["unpaid_epoch"]);
    expect(await statusOf({ published: true })).toEqual(["published"]);
    expect(await statusOf({ tests: RULES_TESTS })).toEqual(["not_payable", "held"]);
  });

  it("with no hold set by the rubric, a member meeting every condition is payable as of now", async () => {
    const s = await seedCombos({ minHoldUnits: "0" });
    const { members: got } = await epochPayouts(t.db, {
      community: s.community,
      epoch: s.epoch,
      snapshotId: null,
      closed: false,
      memberIds: s.memberIds,
    });
    const full = s.seeded.find((m) => missing(m.combo).length === 0);
    expect(got.get(full?.memberId ?? "")).toEqual({
      status: "payable",
      reasons: [],
      hold: "not_required",
    });
    const none = s.seeded.find((m) => missing(m.combo).length === 3);
    expect(got.get(none?.memberId ?? "")).toEqual({
      status: "not_payable",
      reasons: ["no_points", "no_verified_wallet", "no_rules_test"],
      hold: "not_required",
    });
  });
});

describe("nextStep", () => {
  it("is the wallet first, then the rules test, and nothing a link cannot fix", () => {
    const at = (reasons: string[]) =>
      nextStep({ status: "not_payable", reasons: reasons as never[], hold: "at_close" });
    expect(at(["no_verified_wallet", "no_rules_test"])).toBe("wallet");
    expect(at(["no_points", "no_verified_wallet"])).toBe("wallet");
    expect(at(["no_rules_test"])).toBe("rules");
    expect(at(["no_points"])).toBeNull();
    expect(nextStep({ status: "held", reasons: ["hold_pending"], hold: "at_close" })).toBeNull();
    expect(nextStep({ status: "unpaid_epoch" })).toBeNull();
    expect(nextStep({ status: "published" })).toBeNull();
    expect(nextStep(undefined)).toBeNull();
  });
});
