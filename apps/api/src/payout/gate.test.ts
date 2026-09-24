import { randomUUID } from "node:crypto";
import type { RewardPurpose, Rubric } from "@hyphae/core";
import {
  communities,
  type Db,
  epochs,
  holdChecks,
  linkSessions,
  members,
  memberWalletLinks,
  rewardDecisions,
  rewardSnapshotEntries,
  rewardSnapshotMembers,
  rulesTestPasses,
  walletProofRequests,
} from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedAuditDemo } from "../http/demo-seed.js";
import { readLeaderboard } from "../http/read-service.js";
import { closeEpoch } from "../rewards/close.js";
import { buildRewardConfigPayload, latestEpoch } from "../rewards/config.js";
import { runEvaluation } from "../rewards/evaluation.js";
import { at, createTestDb, later, rubric, seedRewardLane, T0 } from "../rewards/test-db.js";
import { evaluatePayoutGate } from "./gate.js";
import type { RulesTest } from "./rules-test.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const MIN = 60_000;
const WEEK = 7 * 86_400_000;
const NOW = new Date("2026-11-20T12:00:00.000Z");
const THRESHOLD = "100000000000";

const DEMO_TEST: RulesTest = {
  id: "demo-rules-1",
  covers: [{ community: "DEMO", version: "1.2.0" }],
  questions: [{ text: "?", options: ["a", "b"], answer: 0, why: "because" }],
};
const tests = [DEMO_TEST];

async function epochOf(communityId: string, index: number) {
  const [row] = await t.db
    .select()
    .from(epochs)
    .where(and(eq(epochs.communityId, communityId), eq(epochs.index, index)));
  if (!row) throw new Error(`no epoch ${index}`);
  return row;
}

const holder = (o: {
  communityId: string;
  epochId: string;
  memberId: string;
  wallet: string;
  mint: string;
  observedAt: Date;
}) => ({
  ...o,
  thresholdRaw: THRESHOLD,
  checkRound: randomUUID(),
  status: "holder" as const,
  attempts: 1,
  rawAmount: "150000000000",
  decimals: 6,
  provider: "consensus",
  slot: "321",
});

// The demo's closed epoch with every payout precondition met for its signed member.
async function cleanDemo() {
  const demo = await seedAuditDemo(t.db, NOW);
  const e1 = await epochOf(demo.communityId, 1);
  await t.db
    .update(communities)
    .set({ firstPaidEpoch: 1 })
    .where(eq(communities.id, demo.communityId));
  await t.db.insert(rulesTestPasses).values({
    communityId: demo.communityId,
    memberId: demo.members.signed,
    testId: DEMO_TEST.id,
    passedAt: new Date(e1.closesAt.getTime() - MIN),
  });
  await t.db.insert(holdChecks).values(
    holder({
      communityId: demo.communityId,
      epochId: e1.id,
      memberId: demo.members.signed,
      wallet: demo.signedWallet,
      mint: demo.mint,
      observedAt: new Date(e1.closesAt.getTime() + 5 * MIN),
    }),
  );
  return { demo, e1, ref: { communityId: demo.communityId, epochId: e1.id } };
}

describe("payout gate on the demo's closed epoch", () => {
  it("is ready when every precondition holds, and lists every member with its reasons", async () => {
    const { demo, ref } = await cleanDemo();
    const gate = await evaluatePayoutGate(t.db, ref, { tests });
    const byId = (id: string) => gate.members.find((m) => m.memberId === id);
    expect(gate.status).toBe("ready");
    expect(gate).toMatchObject({
      epochIndex: 1,
      testId: DEMO_TEST.id,
      hold: { mint: demo.mint, thresholdRaw: 100_000_000_000n },
    });
    expect(gate.status === "ready" && gate.payable).toBe(1);
    expect(byId(demo.members.signed)).toEqual({
      memberId: demo.members.signed,
      pointUnits: "25500000000",
      wholePoints: "255",
      wallet: demo.signedWallet,
      status: "payable",
      reasons: [],
    });
    expect(byId(demo.members.pasted)).toEqual({
      memberId: demo.members.pasted,
      pointUnits: "0",
      wholePoints: "0",
      wallet: null,
      status: "not_payable",
      reasons: ["no_points", "no_verified_wallet", "no_rules_test"],
    });
    expect(gate.members.map((m) => m.memberId)).toEqual(
      [demo.members.signed, demo.members.pasted].sort(),
    );
  });

  it("agrees with the audit site on points and verified wallets", async () => {
    const { demo, ref } = await cleanDemo();
    const gate = await evaluatePayoutGate(t.db, ref, { tests });
    const board = await readLeaderboard(t.db, demo.mint, 1, { offset: 0, limit: 100 }, NOW);
    expect(board?.entries).toHaveLength(gate.members.length);
    for (const entry of board?.entries ?? []) {
      const verdict = gate.members.find((m) => m.memberId === entry.member_id);
      expect(verdict?.pointUnits).toBe(entry.point_units);
      expect(verdict?.wholePoints).toBe(entry.whole_points);
      expect(verdict?.wallet).toBe(entry.wallet);
      expect(verdict?.reasons.includes("no_verified_wallet")).toBe(
        entry.wallet_status !== "verified",
      );
    }
  });

  it("blocks a legacy epoch, a published one and an open one before looking at members", async () => {
    const { demo, e1 } = await cleanDemo();
    const [legacy] = await t.db
      .insert(epochs)
      .values({
        communityId: demo.communityId,
        index: 90,
        status: "closed",
        opensAt: new Date(NOW.getTime() - 2 * WEEK),
        closesAt: new Date(NOW.getTime() - WEEK),
      })
      .returning();
    const blockers = async (epochId: string) => {
      const gate = await evaluatePayoutGate(
        t.db,
        { communityId: demo.communityId, epochId },
        { tests },
      );
      return gate.status === "blocked" ? [gate.blockers, gate.members] : gate.status;
    };
    expect(await blockers(legacy?.id ?? "")).toEqual([["legacy_epoch"], []]);
    expect(await blockers((await epochOf(demo.communityId, 2)).id)).toEqual([["not_final"], []]);
    await t.db.update(epochs).set({ status: "published" }).where(eq(epochs.id, e1.id));
    expect(await blockers(e1.id)).toEqual([["already_published"], []]);
  });

  it("blocks until the first paid epoch is recorded and reached (P12)", async () => {
    const { demo, ref } = await cleanDemo();
    for (const firstPaidEpoch of [null, 2]) {
      await t.db
        .update(communities)
        .set({ firstPaidEpoch })
        .where(eq(communities.id, demo.communityId));
      expect(await evaluatePayoutGate(t.db, ref, { tests })).toMatchObject({
        status: "blocked",
        blockers: ["before_first_paid_epoch"],
        members: [],
      });
    }
  });

  it("blocks when no rules test covers the pinned rubric", async () => {
    const { ref } = await cleanDemo();
    expect(await evaluatePayoutGate(t.db, ref)).toMatchObject({
      status: "blocked",
      blockers: ["no_rules_test_defined"],
      testId: null,
      members: [],
    });
  });
});

describe("snapshot_mismatch: no correction outstanding, epoch closed cleanly", () => {
  const decision = (o: {
    communityId: string;
    contributionId: string;
    epochId: string;
    configId: string;
    revision: number;
    predecessorId?: string;
    acceptedAt: Date;
    affectsAllocation: boolean;
  }) => ({
    ...o,
    rawQuality: 90,
    creditedQuality: 90,
    flags: [],
    effort: "not_nominated" as const,
    timingBps: 10_000,
    multiplierBps: 10_000,
    pointUnits: 9_000_000_000n,
    explanation: "inserted behind the snapshot",
  });

  const expectMismatch = async (ref: { communityId: string; epochId: string }) =>
    expect(await evaluatePayoutGate(t.db, ref, { tests })).toMatchObject({
      status: "blocked",
      blockers: ["snapshot_mismatch"],
      members: [],
    });

  it("a decision accepted before the close that the snapshot never saw", async () => {
    const { demo, e1, ref } = await cleanDemo();
    await t.db.insert(rewardDecisions).values(
      decision({
        communityId: demo.communityId,
        contributionId: demo.contributions.pendingAtClose,
        epochId: e1.id,
        configId: e1.rewardConfigId ?? "",
        revision: 1,
        acceptedAt: new Date(e1.closesAt.getTime() - MIN),
        affectsAllocation: true,
      }),
    );
    await expectMismatch(ref);
  });

  it("a late decision that claims to affect the allocation", async () => {
    const { demo, ref } = await cleanDemo();
    await t.db
      .update(rewardDecisions)
      .set({ affectsAllocation: true })
      .where(eq(rewardDecisions.contributionId, demo.contributions.late));
    await expectMismatch(ref);
  });

  it("a member total that is not the sum of its entries", async () => {
    const { demo, ref } = await cleanDemo();
    await t.db
      .update(rewardSnapshotMembers)
      .set({ pointUnits: 25_600_000_000n, wholePoints: 256n })
      .where(eq(rewardSnapshotMembers.memberId, demo.members.signed));
    await expectMismatch(ref);
  });

  it("an admitted contribution missing from the snapshot", async () => {
    const { demo, ref } = await cleanDemo();
    await t.db
      .delete(rewardSnapshotEntries)
      .where(eq(rewardSnapshotEntries.contributionId, demo.contributions.pendingAtClose));
    await expectMismatch(ref);
  });

  it("an entry excluded as late whose contribution has no decision at all", async () => {
    const { demo, ref } = await cleanDemo();
    await t.db
      .update(rewardSnapshotEntries)
      .set({ reason: "excluded" })
      .where(eq(rewardSnapshotEntries.contributionId, demo.contributions.pendingAtClose));
    await expectMismatch(ref);
  });

  it("an entry whose selected points differ from its decision", async () => {
    const { demo, ref } = await cleanDemo();
    await t.db
      .update(rewardSnapshotEntries)
      .set({ pointUnits: 8_500_000_000n })
      .where(eq(rewardSnapshotEntries.contributionId, demo.contributions.upgraded));
    await expectMismatch(ref);
  });
});

describe("member checks (P9)", () => {
  const signedVerdict = async (ref: { communityId: string; epochId: string }, memberId: string) => {
    const gate = await evaluatePayoutGate(t.db, ref, { tests });
    return { gate, verdict: gate.members.find((m) => m.memberId === memberId) };
  };

  it("a pass at exactly closes_at is too late", async () => {
    const { demo, e1, ref } = await cleanDemo();
    await t.db
      .update(rulesTestPasses)
      .set({ passedAt: e1.closesAt })
      .where(eq(rulesTestPasses.memberId, demo.members.signed));
    const { gate, verdict } = await signedVerdict(ref, demo.members.signed);
    expect(verdict).toMatchObject({ status: "not_payable", reasons: ["no_rules_test"] });
    expect(gate).toMatchObject({ status: "blocked", blockers: ["no_payable_members"] });
  });

  it("a signed wallet that was unlinked before the close does not count", async () => {
    const { demo, e1, ref } = await cleanDemo();
    await t.db
      .update(memberWalletLinks)
      .set({ validTo: new Date(e1.closesAt.getTime() - 1) })
      .where(eq(memberWalletLinks.memberId, demo.members.signed));
    const { verdict } = await signedVerdict(ref, demo.members.signed);
    expect(verdict).toMatchObject({
      status: "not_payable",
      wallet: null,
      reasons: ["no_verified_wallet"],
    });
  });

  it("a confirmed balance below the threshold excludes the member", async () => {
    const { demo, ref } = await cleanDemo();
    await t.db
      .update(holdChecks)
      .set({ status: "below", rawAmount: "99999999999" })
      .where(eq(holdChecks.memberId, demo.members.signed));
    const { gate, verdict } = await signedVerdict(ref, demo.members.signed);
    expect(verdict).toMatchObject({ status: "not_payable", reasons: ["below_hold"] });
    expect(gate).toMatchObject({ status: "blocked", blockers: ["no_payable_members"] });
  });

  it("counts a balance only if it was read within 24 hours after closes_at", async () => {
    const cases: [string, number, string][] = [
      ["read before the close", -1, "held"],
      ["read at the close", 0, "payable"],
      ["read 24 hours after", 24 * 60 * MIN, "payable"],
      ["read later than 24 hours after", 24 * 60 * MIN + 1, "held"],
    ];
    for (const [label, offset, status] of cases) {
      const { demo, e1, ref } = await cleanDemo();
      await t.db
        .update(holdChecks)
        .set({ observedAt: new Date(e1.closesAt.getTime() + offset) })
        .where(eq(holdChecks.memberId, demo.members.signed));
      const { verdict } = await signedVerdict(ref, demo.members.signed);
      expect(verdict?.status, label).toBe(status);
    }
  });

  it("holds a candidate whose hold result is missing, pending, uncertain or for other terms", async () => {
    const cases: [string, (memberId: string) => Promise<unknown>][] = [
      ["missing", (m) => t.db.delete(holdChecks).where(eq(holdChecks.memberId, m))],
      [
        "pending",
        (m) =>
          t.db
            .update(holdChecks)
            .set({
              status: "pending",
              rawAmount: null,
              decimals: null,
              provider: null,
              slot: null,
              observedAt: null,
            })
            .where(eq(holdChecks.memberId, m)),
      ],
      [
        "uncertain",
        (m) =>
          t.db
            .update(holdChecks)
            .set({
              status: "uncertain",
              reason: "outage",
              rawAmount: null,
              decimals: null,
              provider: null,
              slot: null,
              observedAt: null,
            })
            .where(eq(holdChecks.memberId, m)),
      ],
      [
        "another wallet",
        (m) =>
          t.db.update(holdChecks).set({ wallet: "SomeoneElse" }).where(eq(holdChecks.memberId, m)),
      ],
      [
        "another threshold",
        (m) => t.db.update(holdChecks).set({ thresholdRaw: "1" }).where(eq(holdChecks.memberId, m)),
      ],
      [
        "another mint",
        (m) => t.db.update(holdChecks).set({ mint: "OtherMint" }).where(eq(holdChecks.memberId, m)),
      ],
    ];
    for (const [label, change] of cases) {
      const { demo, ref } = await cleanDemo();
      await change(demo.members.signed);
      const { gate, verdict } = await signedVerdict(ref, demo.members.signed);
      expect(verdict, label).toMatchObject({ status: "held", reasons: ["hold_pending"] });
      expect(gate, label).toMatchObject({ status: "blocked", blockers: ["hold_checks_pending"] });
    }
  });
});

// A MYCEL community (the registered rules test) with one closed epoch and n clean members.
const quality = {
  score: 85,
  rubricHits: [{ key: "context_fit", met: true, note: "specific" }],
  flags: [],
  aiSlop: { patterns: [], templateRhythm: false },
  reasoning: "Specific to the post.",
};
const fakeModel = async (_prompt: unknown, _purpose: RewardPurpose) => ({
  output: quality,
  latencyMs: 5,
  costMicroUsd: 100,
});

async function signedLink(db: Db, o: { communityId: string; memberId: string; wallet: string }) {
  const from = new Date(T0.getTime() - 60 * MIN);
  const [session] = await db
    .insert(linkSessions)
    .values({
      communityId: o.communityId,
      telegramUserId: 1n,
      tokenDigest: randomUUID(),
      expiresAt: new Date(from.getTime() + 15 * MIN),
      usedAt: from,
    })
    .returning();
  const requestId = randomUUID();
  await db.insert(walletProofRequests).values({
    requestId,
    communityId: o.communityId,
    linkSessionId: session?.id ?? "",
    telegramUserId: "1",
    walletAddress: o.wallet,
    nonceHash: "0".repeat(64),
    origin: "https://hyphae.test",
    chain: "solana:devnet",
    issuedAt: from,
    expiresAt: new Date(from.getTime() + 5 * MIN),
    status: "consumed",
    consumedAt: from,
  });
  await db.insert(memberWalletLinks).values({
    communityId: o.communityId,
    memberId: o.memberId,
    wallet: o.wallet,
    method: "signature",
    proofRequestId: requestId,
    validFrom: from,
  });
}

let laneSeq = 0;
async function closedLane(wallets: string[], laneRubric: Rubric = rubric) {
  const lane = await seedRewardLane(t.db, buildRewardConfigPayload(laneRubric));
  const communityId = lane.community.id;
  const memberIds = [lane.member.id];
  for (let i = 1; i < wallets.length; i++) {
    laneSeq += 1;
    const [m] = await t.db
      .insert(members)
      .values({
        communityId,
        telegramUserId: BigInt(9000 + laneSeq),
        wallet: `Paste${laneSeq}`,
        linkMethod: "paste",
      })
      .returning();
    memberIds.push(m?.id ?? "");
  }
  const epoch = await latestEpoch(t.db, communityId);
  if (!epoch) throw new Error("lane: epoch");
  for (const [i, memberId] of memberIds.entries()) {
    const intake = await lane.admitOne(undefined, memberId);
    const r = await runEvaluation(
      t.db,
      { communityId, target: { contributionId: intake.contributionId } },
      { model: "test:fake", call: fakeModel, horizonMs: 5 * MIN, clock: later(2 * MIN) },
    );
    if (r.status !== "completed") throw new Error(`lane: evaluate ${r.status}`);
    await signedLink(t.db, { communityId, memberId, wallet: wallets[i] ?? "" });
    await t.db.insert(rulesTestPasses).values({
      communityId,
      memberId,
      testId: "mycel-rules-1",
      passedAt: new Date(T0.getTime() + 60 * MIN),
    });
  }
  const closed = await closeEpoch(
    t.db,
    { communityId, epochId: epoch.id },
    { clock: at(new Date(epoch.closesAt.getTime() + MIN)) },
  );
  if (closed.status !== "closed") throw new Error("lane: close");
  await t.db.update(communities).set({ firstPaidEpoch: 1 }).where(eq(communities.id, communityId));
  if (laneRubric.minHoldUnits !== "0") {
    for (const [i, memberId] of memberIds.entries()) {
      await t.db.insert(holdChecks).values(
        holder({
          communityId,
          epochId: epoch.id,
          memberId,
          wallet: wallets[i] ?? "",
          mint: lane.community.mint,
          observedAt: new Date(epoch.closesAt.getTime() + 5 * MIN),
        }),
      );
    }
  }
  return { ref: { communityId, epochId: epoch.id }, memberIds };
}

describe("payout gate on a MYCEL epoch", () => {
  it("uses the registered MYCEL rules test and pays every clean member", async () => {
    const { ref, memberIds } = await closedLane(["LaneWalletA1", "LaneWalletB1"]);
    const gate = await evaluatePayoutGate(t.db, ref);
    expect(gate).toMatchObject({ status: "ready", payable: 2, testId: "mycel-rules-1" });
    expect(gate.members.map((m) => [m.memberId, m.status, m.pointUnits])).toEqual(
      memberIds.sort().map((id) => [id, "payable", "8500000000"]),
    );
  });

  it("blocks two payable members paid to one wallet", async () => {
    const { ref } = await closedLane(["LaneWalletSame", "LaneWalletSame"]);
    expect(await evaluatePayoutGate(t.db, ref)).toMatchObject({
      status: "blocked",
      blockers: ["duplicate_wallet"],
    });
  });

  it("with a zero threshold has no hold condition", async () => {
    const { ref } = await closedLane(["LaneWalletZ1"], { ...rubric, minHoldUnits: "0" });
    expect(await evaluatePayoutGate(t.db, ref)).toMatchObject({
      status: "ready",
      payable: 1,
      hold: { thresholdRaw: 0n },
    });
  });
});
