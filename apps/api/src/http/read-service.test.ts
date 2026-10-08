import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { promptTemplateHash, ReadApiV1, ReadApiV1Loose } from "@hyphae/core";
import {
  communities,
  type Db,
  epochs,
  holdChecks,
  members,
  memberWalletLinks,
  rulesTestPasses,
  schema,
} from "@hyphae/db";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomAddress } from "../payout/ready-seed.js";
import { amendEpochPrompt } from "../rewards/amendment.js";
import { closeEpoch } from "../rewards/close.js";
import { buildRewardConfigPayload } from "../rewards/config.js";
import { beginDispatch, completeDispatch, runEvaluation } from "../rewards/evaluation.js";
import { at, createTestDb, later, rubric, seedRewardLane, T0 } from "../rewards/test-db.js";
import { type AuditDemo, fakeModel, seedAuditDemo, seedSignedLink } from "./demo-seed.js";
import {
  readCommunity,
  readContribution,
  readContributions,
  readEpoch,
  readLeaderboard,
  readWalletRecord,
} from "./read-service.js";

const NOW = new Date("2026-11-20T12:00:00.000Z");

let t: Awaited<ReturnType<typeof createTestDb>>;
let demo: AuditDemo;
beforeAll(async () => {
  t = await createTestDb();
  demo = await seedAuditDemo(t.db, NOW);
});
afterAll(async () => {
  await t.close();
});

const epochClose = async (index: number) => {
  const [row] = await t.db
    .select()
    .from(epochs)
    .where(and(eq(epochs.communityId, demo.communityId), eq(epochs.index, index)));
  if (!row) throw new Error("no epoch");
  return row.closesAt;
};
const strict = <T>(schema: { parse: (v: unknown) => T }, v: unknown) => schema.parse(v);

describe("readCommunity", () => {
  it("lists pinned epochs newest first and names the current one", async () => {
    const c = strict(ReadApiV1.community, await readCommunity(t.db, demo.mint, NOW));
    expect(c.name).toBe("Hyphae Demo");
    expect(c.reward_intake).toBe("open");
    expect(c.current_epoch).toBe(2);
    expect(c.epochs.map((e) => [e.index, e.status])).toEqual([
      [2, "open"],
      [1, "closed"],
    ]);
    expect(c.as_of).toBe("2026-11-20T12:00:00.000000Z");
    // Without a chain reader the vault cannot be confirmed, so it is unavailable, never guessed.
    expect(c.vault).toEqual({ status: "unavailable", reason: "chain_unconfigured" });
  });

  it("returns null for an unknown mint", async () => {
    expect(await readCommunity(t.db, "NoSuchMint", NOW)).toBeNull();
  });

  it("shows an epoch that has not opened yet as scheduled, with no current epoch", async () => {
    const lane = await seedRewardLane(t.db);
    const c = strict(
      ReadApiV1.community,
      await readCommunity(t.db, lane.community.mint, new Date("2026-09-30T00:00:00Z")),
    );
    expect(c.current_epoch).toBeNull();
    expect(c.epochs.map((e) => e.status)).toEqual(["scheduled"]);
  });
});

describe("readEpoch", () => {
  it("a final epoch reads its snapshot: every close reason, and settlement unavailable", async () => {
    const e = strict(ReadApiV1.epoch, await readEpoch(t.db, demo.mint, 1, NOW));
    expect([e.status, e.closed, e.final]).toEqual(["closed", true, true]);
    expect(e.counts).toEqual({
      contributions: 5,
      members: 2,
      counted: 2,
      pending: 0,
      pending_at_close: 1,
      pending_reconciliation: 1,
      excluded: 1,
    });
    expect(e.totals).toEqual({ point_units: "25500000000", points: "255" });
    expect(e.snapshot.status).toBe("frozen");
    expect(e.allocation).toEqual({ status: "unavailable", reason: "no_settlement" });
    expect(e.payment).toEqual({ status: "unavailable", reason: "no_settlement" });
    expect(e.config.rubric_version).toBe("1.2.0");
    expect(e.config.effort_multiplier_bps).toBe(30000);
  });

  it("an open epoch is provisional", async () => {
    const e = strict(ReadApiV1.epoch, await readEpoch(t.db, demo.mint, 2, NOW));
    expect([e.status, e.closed, e.final]).toEqual(["open", false, false]);
    expect(e.counts.counted).toBe(1);
    expect(e.counts.pending).toBe(1);
    expect(e.snapshot).toEqual({ status: "not_frozen" });
  });

  it("past closes_at without a snapshot is closing", async () => {
    const after = new Date((await epochClose(2)).getTime() + 60_000);
    const e = strict(ReadApiV1.epoch, await readEpoch(t.db, demo.mint, 2, after));
    expect([e.status, e.closed, e.final]).toEqual(["closing", true, false]);
  });

  it("returns null for an unknown index", async () => {
    expect(await readEpoch(t.db, demo.mint, 9, NOW)).toBeNull();
  });
});

describe("readContributions", () => {
  it("lists audit rows in intake order with the state and selected revision", async () => {
    const r = strict(
      ReadApiV1.contributions,
      await readContributions(t.db, demo.mint, 1, { offset: 0, limit: 50 }, NOW),
    );
    expect(r.total_contributions).toBe(5);
    const byId = new Map(r.contributions.map((c) => [c.id, c]));
    const c = demo.contributions;
    expect(r.contributions.map((x) => x.id)).toEqual([
      c.upgraded,
      c.offTopic,
      c.pendingAtClose,
      c.reconciling,
      c.late,
    ]);
    expect(byId.get(c.upgraded)?.selected).toMatchObject({
      revision: 2,
      raw_quality: 85,
      effort: "eligible",
      multiplier_bps: 30000,
      point_units: "25500000000",
      points: "255",
      corrected: false,
    });
    expect(byId.get(c.offTopic)?.selected).toMatchObject({
      revision: 1,
      raw_quality: 84,
      credited_quality: 0,
      credit_rule: "hard_zero",
      flags: ["off_topic"],
    });
    expect(byId.get(c.offTopic)?.kind).toBe("text");
    expect(byId.get(c.pendingAtClose)?.state).toBe("pending_at_close");
    expect(byId.get(c.reconciling)?.state).toBe("pending_reconciliation");
    expect(byId.get(c.late)?.state).toBe("excluded");
    expect(byId.get(c.late)?.selected).toBeNull();
  });

  it("serves a wallet only when it was signed at the close", async () => {
    const r = strict(
      ReadApiV1.contributions,
      await readContributions(t.db, demo.mint, 1, { offset: 0, limit: 50 }, NOW),
    );
    const signed = r.contributions.find((x) => x.member_id === demo.members.signed);
    const pasted = r.contributions.find((x) => x.member_id === demo.members.pasted);
    expect([signed?.wallet, signed?.wallet_status]).toEqual([demo.signedWallet, "verified"]);
    expect([pasted?.wallet, pasted?.wallet_status]).toEqual([null, "unverified"]);
  });

  it("filters by member and pages", async () => {
    const page = await readContributions(
      t.db,
      demo.mint,
      1,
      { offset: 1, limit: 2, member: demo.members.pasted },
      NOW,
    );
    expect(page?.total_contributions).toBe(3);
    expect(page?.contributions.map((x) => x.id)).toEqual([
      demo.contributions.reconciling,
      demo.contributions.late,
    ]);
  });

  it("while closing, rows already read as what the close will write", async () => {
    const after = new Date((await epochClose(2)).getTime() + 60_000);
    const r = await readContributions(t.db, demo.mint, 2, { offset: 0, limit: 50 }, after);
    expect(r?.epoch).toEqual({ index: 2, closed: true, final: false });
    expect(r?.contributions.map((x) => x.state)).toEqual(["counted", "pending_at_close"]);
  });

  it("while closing, an unresolved model call reads as pending_reconciliation, and a late-only decision as excluded", async () => {
    const lane = await seedRewardLane(t.db);
    const fails = await lane.admitOne();
    const late = await lane.admitOne();
    const clock = async () => new Date(T0.getTime() + 2 * 60_000);
    await runEvaluation(
      t.db,
      { communityId: lane.community.id, target: { contributionId: fails.contributionId } },
      {
        model: "m",
        call: async () => {
          throw new Error("timeout");
        },
        horizonMs: 300_000,
        clock,
      },
    );
    const [epoch] = await t.db
      .select()
      .from(epochs)
      .where(eq(epochs.communityId, lane.community.id));
    if (!epoch) throw new Error("epoch");
    const begun = await beginDispatch(
      t.db,
      {
        communityId: lane.community.id,
        target: { contributionId: late.contributionId },
        model: "m",
      },
      { clock },
    );
    if (begun.status !== "begun") throw new Error(begun.status);
    const done = await completeDispatch(
      t.db,
      {
        communityId: lane.community.id,
        dispatchId: begun.dispatch.id,
        fence: begun.dispatch.fence,
        output: {
          score: 80,
          rubricHits: [{ key: "context_fit", met: true, note: "specific" }],
          flags: [],
          aiSlop: { patterns: [], templateRhythm: false },
          reasoning: "Specific to the post and its claim.",
        },
        latencyMs: 1,
        costMicroUsd: 1,
      },
      { clock: async () => new Date(epoch.closesAt.getTime() + 1_000) },
    );
    expect(done.status).toBe("completed");
    const after = new Date(epoch.closesAt.getTime() + 60_000);
    const r = await readContributions(
      t.db,
      lane.community.mint,
      1,
      { offset: 0, limit: 50 },
      after,
    );
    // Both were admitted at the same instant, so intake order falls back to the random ids.
    expect(new Map(r?.contributions.map((x) => [x.id, x.state]))).toEqual(
      new Map([
        [fails.contributionId, "pending_reconciliation"],
        [late.contributionId, "excluded"],
      ]),
    );
    const e = await readEpoch(t.db, lane.community.mint, 1, after);
    expect(e?.counts).toMatchObject({ pending: 0, pending_reconciliation: 1, excluded: 1 });
  });
});

describe("readLeaderboard", () => {
  it("ranks the snapshot's member totals with whole points", async () => {
    const r = strict(
      ReadApiV1.leaderboard,
      await readLeaderboard(t.db, demo.mint, 1, { offset: 0, limit: 50 }, NOW),
    );
    expect([r.closed, r.final, r.total_entries, r.total_contributions]).toEqual([true, true, 2, 5]);
    expect(
      r.entries.map((e) => [e.rank, e.member_id, e.points, e.whole_points, e.counted, e.pending]),
    ).toEqual([
      [1, demo.members.signed, "255", "255", 2, 0],
      [2, demo.members.pasted, "0", "0", 0, 0],
    ]);
    expect(r.entries[1]?.contributions).toBe(3);
    expect(r.entries[1]?.wallet).toBeNull();
  });

  it("ranks an open epoch from the live selection, and ties share a rank", async () => {
    const r = strict(
      ReadApiV1.leaderboard,
      await readLeaderboard(t.db, demo.mint, 2, { offset: 0, limit: 1 }, NOW),
    );
    expect([r.final, r.total_entries, r.entries.length]).toEqual([false, 2, 1]);
    expect(r.entries[0]).toMatchObject({ rank: 1, points: "70", whole_points: "70", pending: 0 });
  });
});

describe("readLeaderboard ties", () => {
  it("members with equal points share a rank, across pages", async () => {
    const lane = await seedRewardLane(t.db);
    const [second] = await t.db
      .insert(members)
      .values({
        communityId: lane.community.id,
        telegramUserId: 777_001n,
        wallet: "TieWallet2",
        linkMethod: "paste",
      })
      .returning();
    if (!second) throw new Error("member");
    await lane.admitOne();
    await lane.admitOne(undefined, second.id);
    const at = new Date(T0.getTime() + 5 * 60_000);
    const first = await readLeaderboard(t.db, lane.community.mint, 1, { offset: 0, limit: 1 }, at);
    const next = await readLeaderboard(t.db, lane.community.mint, 1, { offset: 1, limit: 1 }, at);
    expect([first?.entries[0]?.rank, next?.entries[0]?.rank]).toEqual([1, 1]);
    expect(next?.entries[0]?.pending).toBe(1);
  });
});

describe("a pilot amendment", () => {
  const HOUR = 3_600_000;
  const pin = (version: string) => ({
    prompt_version: version,
    prompt_template_hash: promptTemplateHash(version),
  });

  it("is listed on its epoch, and a contribution admitted under it says so", async () => {
    const lane = await seedRewardLane(t.db, {
      ...buildRewardConfigPayload(rubric),
      scoring: {
        promptVersion: "reward-eval/1",
        promptTemplateHash: promptTemplateHash("reward-eval/1") as string,
      },
    });
    const earlier = await lane.admitOne();
    const amendment = await amendEpochPrompt(
      t.db,
      {
        communityId: lane.community.id,
        epochIndex: 1,
        promptVersion: "reward-eval/2",
        effectiveAt: new Date(T0.getTime() + 2 * HOUR),
        actor: "Cisco (founder)",
        reason: "Pilot testing phase: scoring is less strict.",
      },
      { clock: later(30 * 60_000) },
    );
    const amended = await lane.admitOne(undefined, undefined, later(2 * HOUR + 60_000));
    const now = new Date(T0.getTime() + 3 * HOUR);

    const e = strict(ReadApiV1.epoch, await readEpoch(t.db, lane.community.mint, 1, now));
    expect(e.config.prompt_version).toBe("reward-eval/1");
    expect(e.amendments).toEqual([
      {
        effective_at: "2026-10-01T02:00:00.000000Z",
        recorded_at: "2026-10-01T00:30:00.000000Z",
        actor: "Cisco (founder)",
        reason: "Pilot testing phase: scoring is less strict.",
        from: { config_id: amendment.fromConfigId, ...pin("reward-eval/1") },
        to: { config_id: amendment.toConfigId, ...pin("reward-eval/2") },
      },
    ]);

    const before = strict(
      ReadApiV1.contribution,
      await readContribution(t.db, earlier.contributionId, now),
    );
    expect(before.amendment).toBeNull();
    const under = strict(
      ReadApiV1.contribution,
      await readContribution(t.db, amended.contributionId, now),
    );
    expect(under.amendment).toEqual({
      effective_at: "2026-10-01T02:00:00.000000Z",
      prompt_version: "reward-eval/2",
    });
  });

  it("an epoch without one lists none", async () => {
    const e = strict(ReadApiV1.epoch, await readEpoch(t.db, demo.mint, 1, NOW));
    expect(e.amendments).toEqual([]);
  });
});

describe("readContribution", () => {
  it("shows the lineage with selected, superseded and late revisions and their provenance", async () => {
    const up = strict(
      ReadApiV1.contribution,
      await readContribution(t.db, demo.contributions.upgraded, NOW),
    );
    expect(up.revisions.map((r) => [r.revision, r.status, r.source, r.points])).toEqual([
      [1, "superseded", "model", "85"],
      [2, "selected", "model", "255"],
    ]);
    expect(up.revisions[1]?.model).toMatchObject({ model: "demo:fake-model", latency_ms: 4200 });
    expect(up.revisions[1]?.effort_criteria?.original_substance.met).toBe(true);
    expect(up.nomination).toEqual({ kind: "upgrade", state: "completed_eligible" });
    expect(up.capture.source).toBe("x_oembed");
    expect(up.community.mint).toBe(demo.mint);

    const off = strict(
      ReadApiV1.contribution,
      await readContribution(t.db, demo.contributions.offTopic, NOW),
    );
    expect(off.revisions.map((r) => [r.status, r.affects_allocation, r.credit_rule])).toEqual([
      ["selected", true, "hard_zero"],
      ["late", false, "none"],
    ]);
    expect(off.revisions[1]?.correction).toEqual({
      actor: "admin:cisco",
      authority: "community_admin",
      reason: "On review the reply is about the raid's theme; recorded after the close.",
      evidence_refs: ["https://x.com/demo/status/raid"],
    });
    expect(off.selected?.revision).toBe(1);
  });

  it("a pending contribution has no revisions; an unknown id is null", async () => {
    const p = strict(
      ReadApiV1.contribution,
      await readContribution(t.db, demo.contributions.pendingAtClose, NOW),
    );
    expect([p.state, p.revisions.length, p.selected]).toEqual(["pending_at_close", 0, null]);
    expect(await readContribution(t.db, "00000000-0000-4000-8000-000000000000", NOW)).toBeNull();
  });
});

// A paid epoch 1 under the MYCEL rubric: `ready` signed a wallet and passed the rules test,
// `unlinked` has only a pasted wallet and no pass. Both have 85-point replies.
async function seedPaidLane(db: Db) {
  const lane = await seedRewardLane(db);
  const communityId = lane.community.id;
  await db.update(communities).set({ firstPaidEpoch: 1 }).where(eq(communities.id, communityId));
  const [epoch] = await db
    .select()
    .from(epochs)
    .where(and(eq(epochs.communityId, communityId), eq(epochs.index, 1)));
  if (!epoch) throw new Error("no epoch 1");
  const wallet = `ReadyWallet${communityId.slice(0, 8)}`;
  const [ready] = await db
    .insert(members)
    .values({ communityId, telegramUserId: 77n, wallet, linkMethod: "signature" })
    .returning();
  if (!ready) throw new Error("seed: member");
  await seedSignedLink(db, {
    communityId,
    memberId: ready.id,
    telegramUserId: 77n,
    wallet,
    tokenDigest: `paid-${communityId}`,
    linkedAt: T0,
  });
  await db.insert(rulesTestPasses).values({
    communityId,
    memberId: ready.id,
    testId: "mycel-rules-1",
    passedAt: new Date(T0.getTime() + 60_000),
  });
  const contributions: Record<"ready" | "unlinked", string> = { ready: "", unlinked: "" };
  for (const [label, memberId] of [
    ["ready", ready.id],
    ["unlinked", lane.member.id],
  ] as const) {
    const intake = await lane.admitOne(undefined, memberId);
    await runEvaluation(
      db,
      { communityId, target: { contributionId: intake.contributionId } },
      { model: "test:fake", call: fakeModel(85), horizonMs: 300_000, clock: later(120_000) },
    );
    contributions[label] = intake.contributionId;
  }
  return {
    communityId,
    mint: lane.community.mint,
    epoch,
    members: { ready: ready.id, unlinked: lane.member.id },
    wallet,
    contributions,
  };
}

describe("payout status", () => {
  const page = { offset: 0, limit: 50 };

  // Every read names the same status for a member: rows, leaderboard entries, the contribution.
  const statusesAt = async (lane: Awaited<ReturnType<typeof seedPaidLane>>, now: Date) => {
    const list = strict(
      ReadApiV1.contributions,
      await readContributions(t.db, lane.mint, 1, page, now),
    );
    const board = strict(
      ReadApiV1.leaderboard,
      await readLeaderboard(t.db, lane.mint, 1, page, now),
    );
    const out: Record<string, unknown> = {};
    for (const label of ["ready", "unlinked"] as const) {
      const memberId = lane.members[label];
      const one = strict(
        ReadApiV1.contribution,
        await readContribution(t.db, lane.contributions[label], now),
      );
      const row = list.contributions.find((r) => r.member_id === memberId);
      const entry = board.entries.find((e) => e.member_id === memberId);
      expect(row?.payout).toEqual(one.payout);
      expect(entry?.payout).toEqual(one.payout);
      out[label] = one.payout;
    }
    return out;
  };

  it("an open paid epoch: what each member still needs, with the hold left to the close", async () => {
    const lane = await seedPaidLane(t.db);
    expect(await statusesAt(lane, new Date(T0.getTime() + 3_600_000))).toEqual({
      ready: { status: "held", reasons: ["hold_pending"], hold: "at_close" },
      unlinked: {
        status: "not_payable",
        reasons: ["no_verified_wallet", "no_rules_test"],
        hold: "at_close",
      },
    });
  });

  it("after the close: the hold check, then its result, and the settlement once published", async () => {
    const lane = await seedPaidLane(t.db);
    const after = new Date(lane.epoch.closesAt.getTime() + 60_000);
    const closing = {
      ready: { status: "held", reasons: ["hold_pending"], hold: "pending" },
      unlinked: {
        status: "not_payable",
        reasons: ["no_verified_wallet", "no_rules_test"],
        hold: "not_checked",
      },
    };
    expect(await statusesAt(lane, after)).toEqual(closing);
    await closeEpoch(
      t.db,
      { communityId: lane.communityId, epochId: lane.epoch.id },
      { clock: at(after) },
    );
    expect(await statusesAt(lane, after)).toEqual(closing);
    await t.db.insert(holdChecks).values({
      communityId: lane.communityId,
      epochId: lane.epoch.id,
      memberId: lane.members.ready,
      wallet: lane.wallet,
      mint: lane.mint,
      thresholdRaw: rubric.minHoldUnits,
      checkRound: "11111111-1111-4111-8111-111111111111",
      status: "holder",
      attempts: 1,
      rawAmount: "150000000000",
      decimals: 6,
      provider: "consensus",
      slot: "321",
      observedAt: new Date(after.getTime() + 60_000),
    });
    expect(await statusesAt(lane, after)).toEqual({
      ...closing,
      ready: { status: "payable", reasons: [], hold: "holder" },
    });
    await t.db.update(epochs).set({ status: "published" }).where(eq(epochs.id, lane.epoch.id));
    expect(await statusesAt(lane, after)).toEqual({
      ready: { status: "published" },
      unlinked: { status: "published" },
    });
  });

  it("a clock taken before the close, read after the hold check: the hold still waits for the close", async () => {
    const lane = await seedPaidLane(t.db);
    const after = new Date(lane.epoch.closesAt.getTime() + 60_000);
    await closeEpoch(
      t.db,
      { communityId: lane.communityId, epochId: lane.epoch.id },
      { clock: at(after) },
    );
    await t.db.insert(holdChecks).values({
      communityId: lane.communityId,
      epochId: lane.epoch.id,
      memberId: lane.members.ready,
      wallet: lane.wallet,
      mint: lane.mint,
      thresholdRaw: rubric.minHoldUnits,
      checkRound: "22222222-2222-4222-8222-222222222222",
      status: "holder",
      attempts: 1,
      rawAmount: "150000000000",
      decimals: 6,
      provider: "consensus",
      slot: "321",
      observedAt: new Date(after.getTime() + 60_000),
    });
    const before = new Date(lane.epoch.closesAt.getTime() - 1);
    expect(await statusesAt(lane, before)).toEqual({
      ready: { status: "held", reasons: ["hold_pending"], hold: "at_close" },
      unlinked: {
        status: "not_payable",
        reasons: ["no_verified_wallet", "no_rules_test"],
        hold: "at_close",
      },
    });
    for (const [schema, body] of [
      [ReadApiV1Loose.contributions, await readContributions(t.db, lane.mint, 1, page, before)],
      [ReadApiV1Loose.leaderboard, await readLeaderboard(t.db, lane.mint, 1, page, before)],
    ] as const) {
      expect(schema.safeParse(body).success).toBe(true);
    }
  });

  it("an epoch of a community with no paid epoch pays no one", async () => {
    const rows = strict(
      ReadApiV1.contributions,
      await readContributions(t.db, demo.mint, 2, page, NOW),
    ).contributions;
    expect(rows.map((r) => r.payout)).toEqual(rows.map(() => ({ status: "unpaid_epoch" })));
  });
});

describe("readWalletRecord", () => {
  const all = { offset: 0, limit: 50 };
  const DAY = 86_400_000;

  // A member's open link ends where the next one starts, as a relink records it.
  async function relink(
    lane: AuditDemo,
    member: "signed" | "pasted",
    wallet: string,
    at: Date,
    telegramUserId: bigint,
  ) {
    await t.db
      .update(memberWalletLinks)
      .set({ validTo: at })
      .where(
        and(
          eq(memberWalletLinks.memberId, lane.members[member]),
          isNull(memberWalletLinks.validTo),
        ),
      );
    await seedSignedLink(t.db, {
      communityId: lane.communityId,
      memberId: lane.members[member],
      telegramUserId,
      wallet,
      tokenDigest: `relink-${wallet}`,
      linkedAt: at,
    });
  }

  it("lists every epoch that shows the wallet, newest first, each contribution with its state", async () => {
    const r = strict(
      ReadApiV1.walletRecord,
      await readWalletRecord(t.db, demo.signedWallet, all, NOW),
    );
    expect([r.wallet, r.as_of, r.total_epochs]).toEqual([
      demo.signedWallet,
      "2026-11-20T12:00:00.000000Z",
      2,
    ]);
    expect(r.epochs.map((e) => [e.community.mint, e.index, e.status, e.member_id])).toEqual([
      [demo.mint, 2, "open", demo.members.signed],
      [demo.mint, 1, "closed", demo.members.signed],
    ]);
    const [open, closed] = r.epochs;
    expect(
      closed?.contributions.map((c) => [c.id, c.kind, c.state, c.credited_quality, c.points]),
    ).toEqual([
      [demo.contributions.upgraded, "post", "counted", 85, "255"],
      [demo.contributions.offTopic, "text", "counted", 0, "0"],
    ]);
    expect(closed?.totals).toEqual({
      contributions: 2,
      counted: 2,
      credited: 1,
      average_credited_quality: 42.5,
      point_units: "25500000000",
      points: "255",
    });
    expect(open?.totals).toMatchObject({ contributions: 1, counted: 1, credited: 1, points: "70" });
    // Neither epoch has a recorded publication, so neither shows a payout.
    expect(r.epochs.map((e) => e.payout)).toEqual([
      { status: "unavailable", reason: "no_settlement" },
      { status: "unavailable", reason: "no_settlement" },
    ]);
    const totals = {
      contributions: 3,
      counted: 3,
      credited: 2,
      average_credited_quality: 51.67,
      point_units: "32500000000",
      points: "325",
    };
    expect(r.totals).toEqual({ communities: 1, epochs: 2, ...totals });
    expect(r.communities).toEqual([
      { mint: demo.mint, name: "Hyphae Demo", totals: { epochs: 2, ...totals } },
    ]);
  });

  it("pages the epochs and keeps the totals of all of them", async () => {
    const r = strict(
      ReadApiV1.walletRecord,
      await readWalletRecord(t.db, demo.signedWallet, { offset: 1, limit: 1 }, NOW),
    );
    expect([r.total_epochs, r.offset, r.limit, r.totals.points]).toEqual([2, 1, 1, "325"]);
    expect(r.epochs.map((e) => e.index)).toEqual([1]);
  });

  it("lists pending, unresolved and late contributions without a score", async () => {
    const lane = await seedAuditDemo(t.db, NOW);
    const wallet = randomAddress();
    // Signed before epoch 1 opened: both epochs show it.
    await relink(
      lane,
      "pasted",
      wallet,
      new Date(NOW.getTime() - 8 * DAY - 30 * 60_000),
      987654321988n,
    );
    const r = strict(ReadApiV1.walletRecord, await readWalletRecord(t.db, wallet, all, NOW));
    const closed = r.epochs.find((e) => e.index === 1);
    expect(closed?.contributions.map((c) => [c.state, c.credited_quality, c.point_units])).toEqual([
      ["pending_at_close", null, null],
      ["pending_reconciliation", null, null],
      ["excluded", null, null],
    ]);
    expect(closed?.totals).toMatchObject({
      contributions: 3,
      counted: 0,
      credited: 0,
      average_credited_quality: null,
      points: "0",
    });
    expect(r.epochs.find((e) => e.index === 2)?.contributions.map((c) => c.state)).toEqual([
      "pending",
    ]);
  });

  it("an epoch belongs to the wallet signed at its close, or now while it is open", async () => {
    const lane = await seedAuditDemo(t.db, NOW);
    const next = randomAddress();
    await relink(lane, "signed", next, new Date(NOW.getTime() - 60_000), 987654321987n);
    const before = await readWalletRecord(t.db, lane.signedWallet, all, NOW);
    expect(before?.epochs.map((e) => e.index)).toEqual([1]);
    const after = await readWalletRecord(t.db, next, all, NOW);
    expect(after?.epochs.map((e) => e.index)).toEqual([2]);
  });

  it("has no record for an unknown wallet, a pasted one, or a signed one without contributions", async () => {
    expect(await readWalletRecord(t.db, randomAddress(), all, NOW)).toBeNull();
    expect(await readWalletRecord(t.db, demo.pastedWallet, all, NOW)).toBeNull();
    const lane = await seedRewardLane(t.db);
    const quiet = randomAddress();
    await seedSignedLink(t.db, {
      communityId: lane.community.id,
      memberId: lane.member.id,
      telegramUserId: 42n,
      wallet: quiet,
      tokenDigest: `quiet-${lane.community.mint}`,
      linkedAt: T0,
    });
    expect(await readWalletRecord(t.db, quiet, all, NOW)).toBeNull();
  });
});

describe("public reads and the community lock", () => {
  // Migrates a fresh database inside the test, so it gets the 0008 backfill test's timeout.
  it("never lock a row", async () => {
    const client = new PGlite();
    const queries: string[] = [];
    const db = drizzle(client, {
      schema,
      logger: { logQuery: (q) => void queries.push(q) },
    });
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
    });
    const d = await seedAuditDemo(db, NOW);
    const paid = await seedPaidLane(db);
    queries.length = 0;
    await readContributions(db, paid.mint, 1, { offset: 0, limit: 50 }, T0);
    await readLeaderboard(db, paid.mint, 1, { offset: 0, limit: 50 }, T0);
    await readCommunity(db, d.mint, NOW);
    await readEpoch(db, d.mint, 2, NOW);
    await readContributions(db, d.mint, 2, { offset: 0, limit: 50 }, NOW);
    await readLeaderboard(db, d.mint, 2, { offset: 0, limit: 50 }, NOW);
    await readContribution(db, d.contributions.openCounted, NOW);
    await readWalletRecord(db, d.signedWallet, { offset: 0, limit: 50 }, NOW);
    expect(queries.length).toBeGreaterThan(5);
    expect(
      queries.filter((q) => /\bfor (update|share|no key update|key share)\b/i.test(q)),
    ).toEqual([]);
    await client.close();
  }, 30_000);
});
