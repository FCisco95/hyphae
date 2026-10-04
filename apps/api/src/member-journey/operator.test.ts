import { randomUUID } from "node:crypto";
import {
  communities,
  contributions,
  raidAnnouncements,
  raidDeliveries,
  raidLifecycleEvents,
  raidSubmissionReceipts,
  raidSubmissionSessions,
  rewardDispatches,
  rewardNominations,
  scoringRuns,
  submissionIssues,
  tasks,
} from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nominate } from "../rewards/slots.js";
import {
  createTestDb,
  later,
  seedCommunity,
  seedRewardLane,
  seedTask,
  T0,
} from "../rewards/test-db.js";
import { operatorMessage, readOperatorSummary } from "./operator.js";
import { reportSubmissionIssue } from "./receipts.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
  await t.db.execute(sql`create schema pgboss`);
  await t.db.execute(sql`create table pgboss.job (
    id uuid primary key default gen_random_uuid(), name text not null,
    state text not null, data jsonb, retry_count int not null default 0
  )`);
});
afterAll(async () => {
  await t.close();
});

type Seed = Awaited<ReturnType<typeof seedCommunity>>;
const required = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error("Missing fixture");
  return value;
};
async function contribution(seed: Seed, taskId?: string) {
  return required(
    (
      await t.db
        .insert(contributions)
        .values({
          communityId: seed.community.id,
          memberId: seed.member.id,
          taskId,
          kind: "reply",
          text: "A specific contribution",
          telegramMessageId: 1,
        })
        .returning()
    )[0],
  );
}
async function score(contributionId: string, costMicroUsd: number) {
  await t.db.insert(scoringRuns).values({
    contributionId,
    model: "test:fixture", // Fixture ledger row; no provider is called.
    rubricVersion: "1.2.0",
    promptHash: "fixture",
    input: {},
    output: {},
    score: 80,
    timingMultiplier: 10_000,
    flags: [],
    reasoning: "Specific",
    latencyMs: 1,
    costMicroUsd,
    evidenceHash: randomUUID(),
  });
}
async function receipt(seed: Seed) {
  const task = await seedTask(t.db, seed.community.id, T0);
  const c = await contribution(seed, task.id);
  const [session] = await t.db
    .insert(raidSubmissionSessions)
    .values({
      communityId: seed.community.id,
      taskId: task.id,
      telegramUserId: seed.member.telegramUserId,
      kind: "reply",
      expiresAt: new Date(T0.getTime() + 3_600_000),
    })
    .returning();
  return required(
    (
      await t.db
        .insert(raidSubmissionReceipts)
        .values({
          sessionId: required(session).id,
          communityId: seed.community.id,
          memberId: seed.member.id,
          taskId: task.id,
          contributionId: c.id,
          artifactKey: `x:status:${randomUUID()}`,
        })
        .returning()
    )[0],
  );
}
async function dispatch(
  seed: Seed,
  cost: number | null,
  state: "completed" | "dispatched" | "not_sent_proven",
) {
  const c = await contribution(seed);
  await t.db.insert(rewardDispatches).values({
    communityId: seed.community.id,
    contributionId: c.id,
    purpose: "quality",
    fence: 1,
    idempotencyKey: randomUUID(),
    state,
    model: "test:fixture", // Fixture ledger row; no provider is called.
    promptVersion: "fixture",
    promptHash: "fixture",
    inputHash: "fixture",
    input: {},
    costMicroUsd: cost,
    dispatchedAt: T0,
  });
}
async function job(name: string, state: string, data: Record<string, unknown>, retries = 0) {
  await t.db.execute(sql`insert into pgboss.job (name, state, data, retry_count)
    values (${name}, ${state}, ${JSON.stringify(data)}::jsonb, ${retries})`);
}
async function summary(seed: Seed) {
  const result = await readOperatorSummary(
    t.db,
    { communityId: seed.community.id, actorId: 7n },
    T0,
  );
  if (result.status !== "ok") throw new Error("Expected operator summary");
  return result.summary;
}

describe("community operator summary", () => {
  it("requires the current designated admin and revokes access on the next read", async () => {
    const a = await seedCommunity(t.db);
    const b = await seedCommunity(t.db);
    await t.db
      .update(communities)
      .set({ adminTelegramUserId: 9n })
      .where(eq(communities.id, b.community.id));
    for (const input of [
      { communityId: a.community.id, actorId: 42n },
      { communityId: b.community.id, actorId: 7n },
      { communityId: a.community.id, actorId: 0n },
      { communityId: "not-a-community", actorId: 7n },
      { communityId: randomUUID(), actorId: 7n },
    ])
      expect(await readOperatorSummary(t.db, input, T0)).toEqual({ status: "unauthorized" });
    expect((await summary(a)).communityId).toBe(a.community.id);
    await t.db
      .update(communities)
      .set({ adminTelegramUserId: 9n })
      .where(eq(communities.id, a.community.id));
    expect(
      await readOperatorSummary(t.db, { communityId: a.community.id, actorId: 7n }, T0),
    ).toEqual({ status: "unauthorized" });
    expect(
      (await readOperatorSummary(t.db, { communityId: a.community.id, actorId: 9n }, T0)).status,
    ).toBe("ok");
  });

  it("shows active, expired, closed and cancelled raids without leaking other communities", async () => {
    const a = await seedCommunity(t.db);
    const b = await seedCommunity(t.db);
    const active = await seedTask(t.db, a.community.id, T0);
    await seedTask(t.db, a.community.id, new Date(T0.getTime() - 48 * 3_600_000));
    const closed = await seedTask(t.db, a.community.id, T0);
    const cancelled = await seedTask(t.db, a.community.id, T0);
    await t.db.update(tasks).set({ status: "closed" }).where(eq(tasks.id, closed.id));
    await t.db.update(tasks).set({ status: "closed" }).where(eq(tasks.id, cancelled.id));
    await t.db.insert(raidLifecycleEvents).values({
      communityId: a.community.id,
      taskId: cancelled.id,
      actorTelegramUserId: 7n,
      action: "cancelled",
      reason: "Wrong target",
      telegramMessageId: 2,
    });
    await seedTask(t.db, b.community.id, T0);
    const s = await summary(a);
    expect(s.raids).toEqual(
      expect.arrayContaining([
        { state: "active", count: 1 },
        { state: "expired", count: 1 },
        { state: "closed", count: 1 },
        { state: "cancelled", count: 1 },
      ]),
    );
    expect(s.raids).toHaveLength(4);
    expect(s.activeRaids.map((r) => r.id)).toEqual([active.id]);
    expect(operatorMessage(s)).toContain("expired 1, closed 1, cancelled 1");
  });

  it("scopes delivery failures and uncertain sends through their community announcement", async () => {
    const a = await seedCommunity(t.db);
    const b = await seedCommunity(t.db);
    for (const seed of [a, b]) {
      const task = await seedTask(t.db, seed.community.id, T0);
      const announcement = required(
        (
          await t.db
            .insert(raidAnnouncements)
            .values({
              communityId: seed.community.id,
              taskId: task.id,
              telegramChatId: seed.community.telegramChatId,
              telegramMessageId: 1,
            })
            .returning()
        )[0],
      );
      for (const [index, status] of (["failed", "uncertain", "pending"] as const).entries())
        await t.db.insert(raidDeliveries).values({
          announcementId: announcement.id,
          telegramUserId: BigInt(40 + index),
          subscriptionRevision: 1,
          status,
          nextAttemptAt: T0,
          reason: seed === a ? "send_unknown" : "OTHER_PRIVATE_REASON",
        });
    }
    const s = await summary(a);
    expect(s.deliveries).toEqual(
      expect.arrayContaining([
        { status: "failed", count: 1 },
        { status: "uncertain", count: 1 },
        { status: "pending", count: 1 },
      ]),
    );
    expect(s.deliveryProblems).toHaveLength(2);
    expect(operatorMessage(s)).not.toContain("OTHER_PRIVATE_REASON");
    expect(operatorMessage(s)).toContain("Uncertain sends may have arrived");
  });

  it("reports unscored work and queue-confirmation gaps independently", async () => {
    const a = await seedCommunity(t.db);
    const b = await seedCommunity(t.db);
    const task = await seedTask(t.db, a.community.id, T0);
    const pending = await contribution(a, task.id);
    const scored = await contribution(a, task.id);
    await score(scored.id, 100);
    await contribution(b);
    const session = required(
      (
        await t.db
          .insert(raidSubmissionSessions)
          .values({
            communityId: a.community.id,
            taskId: task.id,
            telegramUserId: a.member.telegramUserId,
            kind: "reply",
            expiresAt: new Date(T0.getTime() + 3_600_000),
          })
          .returning()
      )[0],
    );
    await t.db.insert(raidSubmissionReceipts).values({
      sessionId: session.id,
      communityId: a.community.id,
      memberId: a.member.id,
      taskId: task.id,
      contributionId: pending.id,
      artifactKey: `x:status:${randomUUID()}`,
    });
    const s = await summary(a);
    expect(s.unscoredContributions).toBe(1);
    expect(s.unqueuedReceipts).toBe(1);
  });

  it("reads retained failed/retrying jobs by canonical community, excluding global jobs", async () => {
    const a = await seedCommunity(t.db);
    const b = await seedCommunity(t.db);
    const c = await contribution(a);
    const other = await contribution(b);
    await job("score", "failed", { contributionId: c.id });
    await job("score", "retry", { contributionId: c.id }, 2);
    await job("reward-evaluation", "failed", { communityId: a.community.id });
    await job("reward-recovery", "failed", {});
    await job("score", "failed", { contributionId: other.id, communityId: a.community.id });
    await job("reward-evaluation", "failed", { communityId: b.community.id });
    const s = await summary(a);
    expect(s.jobs).toEqual({
      status: "available",
      groups: expect.arrayContaining([
        { name: "score", state: "failed", count: 1 },
        { name: "score", state: "retry", count: 1 },
        { name: "reward-evaluation", state: "failed", count: 1 },
      ]),
      legacyJobsWithUnknownAttempts: 2,
    });
    if (s.jobs.status === "available") expect(s.jobs.groups).toHaveLength(3);
  });

  it("keeps pending effort visible even when the contribution already has a quality score", async () => {
    const a = await seedRewardLane(t.db);
    const b = await seedRewardLane(t.db);
    for (const seed of [a, b]) {
      const intake = await seed.admitOne();
      const n = await nominate(
        t.db,
        {
          communityId: seed.community.id,
          memberId: seed.member.id,
          contributionId: intake.contributionId,
          idempotencyKey: randomUUID(),
        },
        { clock: later(120_000) },
      );
      expect(n.status).toBe("nominated");
      await score(intake.contributionId, 100);
    }
    const s = await summary(a);
    expect(s.unscoredContributions).toBe(0);
    expect(s.pendingNominations).toEqual([{ state: "ready", count: 1 }]);
    await t.db
      .update(rewardNominations)
      .set({ state: "completed_eligible" })
      .where(eq(rewardNominations.communityId, a.community.id));
    expect((await summary(a)).pendingNominations).toEqual([]);
  });

  it("sums each call once across both ledgers and preserves unknown usage", async () => {
    const a = await seedCommunity(t.db);
    const b = await seedCommunity(t.db);
    const c = await contribution(a);
    await score(c.id, 1_000);
    await score(c.id, 2_000);
    await score(c.id, 0);
    await dispatch(a, 4_000, "completed");
    await dispatch(a, null, "dispatched");
    await dispatch(a, 99_000, "not_sent_proven");
    await score((await contribution(b)).id, 800_000);
    await dispatch(b, 900_000, "completed");
    const s = await summary(a);
    expect(s.spend).toEqual({
      scoringMicroUsd: 3_000n,
      rewardMicroUsd: 4_000n,
      recordedMicroUsd: 7_000n,
      unresolvedRewardCalls: 1,
      zeroCostRecords: 1,
    });
    expect(operatorMessage(s)).toContain("Recorded model cost estimate: $0.007000");
    expect(operatorMessage(s)).toContain(
      "1 unresolved reward calls; 1 zero-cost records may lack usage",
    );
  });

  it("can run repeatedly in a database read-only transaction without mutations", async () => {
    const a = await seedCommunity(t.db);
    await seedTask(t.db, a.community.id, T0);
    const read = () =>
      t.db.transaction(
        (tx) =>
          readOperatorSummary(
            tx,
            {
              communityId: a.community.id,
              actorId: 7n,
            },
            T0,
          ),
        { accessMode: "read only" },
      );
    expect(await read()).toEqual(await read());
    expect((await read()).status).toBe("ok");
  });

  it("surfaces a member's issue with its original receipt without changing scores or duplicating retries", async () => {
    const a = await seedCommunity(t.db);
    const r = await receipt(a);
    await score(r.contributionId, 100);
    const before = await t.db
      .select()
      .from(scoringRuns)
      .where(eq(scoringRuns.contributionId, r.contributionId));
    const input = {
      receiptId: r.id,
      telegramUserId: a.member.telegramUserId,
      telegramMessageId: 61,
      text: "The score missed my example.\nPlease review it.",
    };
    const reported = await reportSubmissionIssue(t.db, input);
    expect(reported.status).toBe("recorded");
    expect((await reportSubmissionIssue(t.db, input)).status).toBe("duplicate");
    if (reported.status !== "recorded") throw new Error("Expected report");
    const s = await summary(a);
    expect(s.issues).toEqual({
      count: 1,
      recent: [
        {
          id: reported.issueId,
          receiptId: r.id,
          reason: input.text,
        },
      ],
    });
    expect(operatorMessage(s)).toContain(
      `Issue ${reported.issueId} · receipt ${r.id}: The score missed my example. Please review it.`,
    );
    expect(operatorMessage(s)).toContain("Reports do not change scores");
    expect(
      await t.db.select().from(scoringRuns).where(eq(scoringRuns.contributionId, r.contributionId)),
    ).toEqual(before);
    await t.db
      .update(communities)
      .set({ adminTelegramUserId: 9n })
      .where(eq(communities.id, a.community.id));
    expect(
      await readOperatorSummary(t.db, { communityId: a.community.id, actorId: 7n }, T0),
    ).toEqual({ status: "unauthorized" });
  });

  it("counts only consistent community reports and returns the latest three short reasons", async () => {
    const a = await seedCommunity(t.db);
    const b = await seedCommunity(t.db);
    const r = await receipt(a);
    const other = await receipt(b);
    const ids: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const [row] = await t.db
        .insert(submissionIssues)
        .values({
          receiptId: r.id,
          communityId: a.community.id,
          memberId: a.member.id,
          telegramMessageId: i + 1,
          text: `Reason ${i} ${"x".repeat(200)}`,
          createdAt: new Date(T0.getTime() + i * 1_000),
        })
        .returning();
      ids.push(required(row).id);
    }
    for (const [i, communityId] of [b.community.id, a.community.id].entries())
      await t.db.insert(submissionIssues).values({
        receiptId: other.id,
        communityId,
        memberId: b.member.id,
        telegramMessageId: 10 + i,
        text: "OTHER_COMMUNITY_PRIVATE_REASON",
      });
    const s = await summary(a);
    expect(s.issues.count).toBe(4);
    expect(s.issues.recent.map((issue) => issue.id)).toEqual(ids.slice(1).reverse());
    expect(s.issues.recent.every((issue) => issue.reason.length === 80)).toBe(true);
    expect(
      s.issues.recent.every(
        (issue) => Object.keys(issue).sort().join(",") === "id,reason,receiptId",
      ),
    ).toBe(true);
    expect(operatorMessage(s)).not.toContain("OTHER_COMMUNITY_PRIVATE_REASON");
    expect(operatorMessage(s)).not.toContain(other.id);
  });

  it("keeps the full bounded summary within Telegram's message limit", async () => {
    const a = await seedCommunity(t.db);
    const s = await summary(a);
    s.communityName = "Long community\n".repeat(30);
    s.raids = [{ state: "active", count: 6 }];
    s.activeRaids = Array.from({ length: 5 }, () => ({
      id: randomUUID(),
      targetUrl: `https://x.com/${"a".repeat(500)}`,
      closesAt: T0,
    }));
    s.deliveryProblems = Array.from({ length: 5 }, () => ({
      status: "uncertain",
      reason: "Long reason\n".repeat(30),
      count: 999_999,
    }));
    s.issues = {
      count: 999_999,
      recent: Array.from({ length: 3 }, () => ({
        id: randomUUID(),
        receiptId: randomUUID(),
        reason: "Long reason\n".repeat(30),
      })),
    };
    s.jobs = {
      status: "available",
      legacyJobsWithUnknownAttempts: 999_999,
      groups: [
        "score",
        "reward-evaluation",
        "reward-retrieval",
        "reward-notify",
        "reward-close",
        "hold-check",
      ].flatMap((name) =>
        ["failed", "retry", "created", "active", "completed"].map((state) => ({
          name,
          state,
          count: 999_999,
        })),
      ),
    };
    const text = operatorMessage(s);
    expect(text.length).toBeLessThan(4096);
    expect(text).toContain("Showing the five most recent active raids");
    expect(text).toContain("Recorded model cost estimate");
    expect(text).not.toContain("Long community\n");
  });

  it("labels missing queue telemetry as unknown, without leaking the database error", async () => {
    const a = await seedCommunity(t.db);
    await t.db.execute(sql`alter table pgboss.job rename to unavailable_job`);
    try {
      const s = await summary(a);
      expect(s.jobs).toEqual({ status: "unavailable" });
      expect(operatorMessage(s)).toContain("Failed-job count is unknown");
      expect(operatorMessage(s)).not.toContain("does not exist");
    } finally {
      await t.db.execute(sql`alter table pgboss.unavailable_job rename to job`);
    }
  });
});
