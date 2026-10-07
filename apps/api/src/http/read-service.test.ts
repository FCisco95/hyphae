import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { promptTemplateHash, ReadApiV1 } from "@hyphae/core";
import { epochs, members, schema } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { amendEpochPrompt } from "../rewards/amendment.js";
import { buildRewardConfigPayload } from "../rewards/config.js";
import { beginDispatch, completeDispatch, runEvaluation } from "../rewards/evaluation.js";
import { createTestDb, later, rubric, seedRewardLane, T0 } from "../rewards/test-db.js";
import { type AuditDemo, seedAuditDemo } from "./demo-seed.js";
import {
  readCommunity,
  readContribution,
  readContributions,
  readEpoch,
  readLeaderboard,
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
    queries.length = 0;
    await readCommunity(db, d.mint, NOW);
    await readEpoch(db, d.mint, 2, NOW);
    await readContributions(db, d.mint, 2, { offset: 0, limit: 50 }, NOW);
    await readLeaderboard(db, d.mint, 2, { offset: 0, limit: 50 }, NOW);
    await readContribution(db, d.contributions.openCounted, NOW);
    expect(queries.length).toBeGreaterThan(5);
    expect(
      queries.filter((q) => /\bfor (update|share|no key update|key share)\b/i.test(q)),
    ).toEqual([]);
    await client.close();
  }, 30_000);
});
