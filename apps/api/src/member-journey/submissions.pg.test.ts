import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  communities,
  contributions,
  createDb,
  type Db,
  members,
  raidDeliveries,
  raidLifecycleEvents,
  raidSubmissionReceipts,
} from "@hyphae/db";
import { count, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  claimRaidAlert,
  deliverRaidAlert,
  MAX_OPEN_RAIDS,
  openRaid,
  setRaidSubscription,
} from "../raid-alerts/alerts.js";
import { withCommunityLock } from "../rewards/config.js";
import { rubric } from "../rewards/test-db.js";
import { transitionRaid } from "./lifecycle.js";
import { submissionQueueDb } from "./queue-db.js";
import { acceptSubmission, beginSubmission, queueSubmission } from "./submissions.js";

const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("Use disposable test:pg runner");
const a = createDb(url);
const b = createDb(url);
const queue = new PgBoss({
  connectionString: url,
  schema: "journey_jobs",
  supervise: false,
  schedule: false,
});
beforeAll(async () => {
  await migrate(a, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
  await queue.start();
  await queue.createQueue("score");
});
afterAll(async () => {
  await queue.stop();
  await Promise.all([a.$client.end(), b.$client.end()]);
});
const post = { id: "1", handle: "target", text: "Target", url: "https://x.com/target/status/1" };
const evidence = {
  id: "222",
  handle: "member",
  text: "Reply",
  url: "https://x.com/member/status/222",
};
const deps = { membership: async () => true, fetchPost: async () => evidence };
async function seedJourneyCommunity() {
  const [community] = await a
    .insert(communities)
    .values({
      mint: `Journey${randomUUID()}`,
      name: "Journey test",
      telegramChatId: -BigInt(`8${Date.now()}`),
      adminTelegramUserId: 7n,
      rubricVersion: rubric.version,
      rubric,
    })
    .returning();
  if (!community) throw new Error("community");
  const [member] = await a
    .insert(members)
    .values({
      communityId: community.id,
      telegramUserId: 42n,
      wallet: randomUUID(),
      linkMethod: "paste",
    })
    .returning();
  if (!member) throw new Error("member");
  return { community, member };
}
async function setup() {
  // This suite shares the disposable database with existing reward tests.
  const { community, member } = await seedJourneyCommunity();
  await a.update(members).set({ wallet: randomUUID() }).where(eq(members.id, member.id));
  const input = {
    communityId: community.id,
    chatId: community.telegramChatId,
    actorId: 7n,
    messageId: 1,
    post,
    hours: 1,
    brief: "Explain",
  };
  const opened = await openRaid(a, input);
  if (opened.status !== "created") throw new Error("raid");
  const begun = await beginSubmission(a, opened.task.id, member.telegramUserId, "reply", deps);
  if (!("session" in begun)) throw new Error("prompt");
  return {
    community,
    member,
    task: opened.task,
    input,
    submit: { sessionId: begun.session.id, userId: member.telegramUserId, url: evidence.url },
  };
}
function barrier() {
  let enter = () => {};
  let release = () => {};
  const entered = new Promise<void>((r) => {
    enter = r;
  });
  const wait = new Promise<void>((r) => {
    release = r;
  });
  return { enter, release, entered, wait };
}
async function waitForLock(table: "tasks" | "communities") {
  for (let i = 0; i < 100; i++) {
    const [row] = await a
      .select({ n: count() })
      .from(sql`pg_stat_activity`)
      .where(
        sql`datname = current_database() and wait_event_type = 'Lock' and query like ${`%from "${table}"%`}`,
      );
    if ((row?.n ?? 0) > 0) return;
    await a.execute(sql`select pg_sleep(0.01)`);
  }
  throw new Error(`Expected a transaction waiting on ${table}`);
}

describe("private journey on two real PostgreSQL pools", () => {
  it("concurrent retries create one contribution and one exact receipt", async () => {
    const { submit, community } = await setup();
    const results = await Promise.all([
      acceptSubmission(a, submit, deps),
      acceptSubmission(b, submit, deps),
    ]);
    const ids = results.map((r) => ("receipt" in r ? r.receipt.id : r.error));
    expect(new Set(ids).size).toBe(1);
    expect(
      await a
        .select()
        .from(raidSubmissionReceipts)
        .where(eq(raidSubmissionReceipts.communityId, community.id)),
    ).toHaveLength(1);
    expect(
      await a.select().from(contributions).where(eq(contributions.communityId, community.id)),
    ).toHaveLength(1);
  });
  it("racing distinct create events cannot exceed the open raid limit", async () => {
    const { community } = await seedJourneyCommunity();
    const input = {
      communityId: community.id,
      chatId: community.telegramChatId,
      actorId: 7n,
      messageId: 1,
      post,
      hours: 1,
      brief: "Explain",
    };
    const results = await Promise.all(
      Array.from({ length: MAX_OPEN_RAIDS + 2 }, (_, i) =>
        openRaid(i % 2 ? b : a, { ...input, messageId: i + 1 }),
      ),
    );
    expect(results.filter((r) => r.status === "created")).toHaveLength(MAX_OPEN_RAIDS);
    expect(results.filter((r) => r.status === "limit_reached")).toHaveLength(2);
    expect(
      await a
        .select()
        .from(raidLifecycleEvents)
        .where(eq(raidLifecycleEvents.communityId, community.id)),
    ).toHaveLength(MAX_OPEN_RAIDS);
  });
  it("close wins over an evidence fetch still in progress", async () => {
    const { submit, input, task } = await setup();
    const gate = barrier();
    const accepting = acceptSubmission(a, submit, {
      ...deps,
      fetchPost: async () => {
        gate.enter();
        await gate.wait;
        return evidence;
      },
    });
    await gate.entered;
    try {
      expect(
        (
          await transitionRaid(b, {
            communityId: input.communityId,
            chatId: input.chatId,
            actorId: input.actorId,
            messageId: 2,
            taskId: task.id,
            action: "closed",
            reason: "Done",
          })
        ).status,
      ).toBe("changed");
    } finally {
      gate.release();
    }
    expect(await accepting).toEqual({ error: "task_closed" });
  });
  it("cancel waits for an already-started private alert and then suppresses later sends", async () => {
    const { community } = await seedJourneyCommunity();
    await setRaidSubscription(a, community.id, 42n, true);
    const input = {
      communityId: community.id,
      chatId: community.telegramChatId,
      actorId: 7n,
      messageId: 1,
      post,
      hours: 1,
      brief: "Explain",
    };
    const opened = await openRaid(a, input);
    if (opened.status !== "created") throw new Error("raid");
    const job = await claimRaidAlert(a);
    if (!job) throw new Error("delivery");
    const gate = barrier();
    const sending = deliverRaidAlert(a, job.id, {
      membership: async () => true,
      send: async () => {
        gate.enter();
        await gate.wait;
      },
    });
    await gate.entered;
    let cancelled = false;
    const cancellation = transitionRaid(b, {
      communityId: input.communityId,
      chatId: input.chatId,
      actorId: input.actorId,
      messageId: 2,
      taskId: opened.task.id,
      action: "cancelled",
      reason: "Stop future intake",
    }).then((r) => {
      cancelled = true;
      return r;
    });
    try {
      await waitForLock("tasks");
      expect(cancelled).toBe(false);
      // The closer is waiting on the sending task, not holding the community's reward lock.
      await b.transaction(async (tx) => {
        await tx.execute(
          sql`select id from communities where id = ${community.id} for no key update nowait`,
        );
      });
    } finally {
      gate.release();
    }
    expect(await sending).toBe("sent");
    expect((await cancellation).status).toBe("changed");
    // A queued second recipient is held after the same recorded terminal transition.
    const [other] = await a
      .insert(raidDeliveries)
      .values({
        announcementId: job.announcementId,
        telegramUserId: 99n,
        subscriptionRevision: 1,
        nextAttemptAt: new Date(),
      })
      .returning();
    if (!other) throw new Error("delivery");
    await setRaidSubscription(a, community.id, 99n, true);
    await claimRaidAlert(a);
    const send = vi.fn(async () => undefined);
    expect(await deliverRaidAlert(a, other.id, { membership: async () => true, send })).toBe(
      "skipped",
    );
    expect(send).not.toHaveBeenCalled();
  });
  it("slow post-fetch membership does not hold the reward lock and a concurrent close still wins", async () => {
    const { submit, community, task, input } = await setup();
    const gate = barrier();
    let calls = 0;
    const accepting = acceptSubmission(a, submit, {
      ...deps,
      membership: async () => {
        if (++calls === 2) {
          gate.enter();
          await gate.wait;
        }
        return true;
      },
    });
    await gate.entered;
    try {
      const independent = await b.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout = '500ms'`);
        return withCommunityLock(tx, community.id, {}, async () => "lock available");
      });
      expect(independent).toBe("lock available");
      const closed = await transitionRaid(b, {
        communityId: input.communityId,
        chatId: input.chatId,
        actorId: input.actorId,
        messageId: 2,
        taskId: task.id,
        action: "closed",
        reason: "Closed during membership lookup",
      });
      expect(closed.status).toBe("changed");
    } finally {
      gate.release();
      await accepting;
    }
    expect(await accepting).toEqual({ error: "task_closed" });
  });
  it("demonstrates singletonKey alone is not unique in the unchanged standard queue", async () => {
    const key = randomUUID();
    const first = await queue.send("score", { proof: key }, { singletonKey: key });
    const second = await queue.send("score", { proof: key }, { singletonKey: key });
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
  });
  it("commits one real job with its receipt across concurrent stale retries", async () => {
    const { submit } = await setup();
    const accepted = await acceptSubmission(a, submit, deps);
    if (!("receipt" in accepted)) throw new Error("receipt");
    const receipt = accepted.receipt;
    const enqueue = (tx: Db) =>
      queue.send(
        "score",
        { contributionId: receipt.contributionId },
        { id: receipt.id, db: submissionQueueDb(tx) },
      );
    expect(
      await Promise.all([
        queueSubmission(a, receipt, enqueue),
        queueSubmission(b, receipt, enqueue),
      ]),
    ).toEqual([true, true]);
    const [jobs] = await a
      .select({ n: count() })
      .from(sql`journey_jobs.job`)
      .where(sql`id = ${receipt.id}::uuid`);
    expect(jobs?.n).toBe(1);
    expect(
      (
        await a.query.raidSubmissionReceipts.findFirst({
          where: eq(raidSubmissionReceipts.id, receipt.id),
        })
      )?.queueStatus,
    ).toBe("queued");
  });
  it("rolls a real job back if receipt confirmation fails, then retries exactly once", async () => {
    const { submit } = await setup();
    const accepted = await acceptSubmission(a, submit, deps);
    if (!("receipt" in accepted)) throw new Error("receipt");
    const receipt = accepted.receipt;
    const enqueue = (tx: Db) =>
      queue.send(
        "score",
        { contributionId: receipt.contributionId },
        { id: receipt.id, db: submissionQueueDb(tx) },
      );
    expect(
      await queueSubmission(a, receipt, async (tx) => {
        await enqueue(tx);
        throw new Error("simulated receipt write failure");
      }),
    ).toBe(false);
    const [before] = await a
      .select({ n: count() })
      .from(sql`journey_jobs.job`)
      .where(sql`id = ${receipt.id}::uuid`);
    expect(before?.n).toBe(0);
    expect(
      (
        await a.query.raidSubmissionReceipts.findFirst({
          where: eq(raidSubmissionReceipts.id, receipt.id),
        })
      )?.queueStatus,
    ).toBe("pending");
    expect(await queueSubmission(b, receipt, enqueue)).toBe(true);
    const [after] = await a
      .select({ n: count() })
      .from(sql`journey_jobs.job`)
      .where(sql`id = ${receipt.id}::uuid`);
    expect(after?.n).toBe(1);
  });
  it("a lost commit acknowledgement resolves from the receipt without another job", async () => {
    const { submit } = await setup();
    const accepted = await acceptSubmission(a, submit, deps);
    if (!("receipt" in accepted)) throw new Error("receipt");
    const receipt = accepted.receipt;
    const enqueue = vi.fn((tx: Db) =>
      queue.send(
        "score",
        { contributionId: receipt.contributionId },
        { id: receipt.id, db: submissionQueueDb(tx) },
      ),
    );
    const lost = {
      transaction: async (fn: (tx: Db) => Promise<unknown>) => {
        await a.transaction(fn);
        throw new Error("lost commit ack");
      },
    } as unknown as Db;
    expect(await queueSubmission(lost, receipt, enqueue)).toBe(false);
    expect(await queueSubmission(b, receipt, enqueue)).toBe(true);
    expect(enqueue).toHaveBeenCalledTimes(1);
    const [jobs] = await a
      .select({ n: count() })
      .from(sql`journey_jobs.job`)
      .where(sql`id = ${receipt.id}::uuid`);
    expect(jobs?.n).toBe(1);
  });
  it("revoked authority is rechecked after a closer waits on an alert", async () => {
    const { community, input, task } = await setup();
    await setRaidSubscription(a, community.id, 42n, true);
    const [announcement] = await a
      .select({ id: sql<string>`id` })
      .from(sql`raid_announcements`)
      .where(sql`task_id = ${task.id}::uuid`);
    if (!announcement) throw new Error("announcement");
    await a.insert(raidDeliveries).values({
      announcementId: announcement.id,
      telegramUserId: 42n,
      subscriptionRevision: 1,
      nextAttemptAt: new Date(),
    });
    const job = await claimRaidAlert(a);
    if (!job) throw new Error("job");
    const gate = barrier();
    const sending = deliverRaidAlert(a, job.id, {
      membership: async () => true,
      send: async () => {
        gate.enter();
        await gate.wait;
      },
    });
    await gate.entered;
    const cancelling = transitionRaid(b, {
      communityId: community.id,
      taskId: task.id,
      chatId: input.chatId,
      actorId: 7n,
      messageId: 2,
      action: "cancelled",
      reason: "Wait then revoke",
    });
    try {
      await waitForLock("tasks");
      await a.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout = '500ms'`);
        await tx
          .update(communities)
          .set({ adminTelegramUserId: 999n })
          .where(eq(communities.id, community.id));
      });
    } finally {
      gate.release();
      await sending;
    }
    expect((await cancelling).status).toBe("unauthorized");
  });
  it("a task close waiting for the reward lock permits foreign-key inserts for admitted work", async () => {
    const { community, member, task, input } = await setup();
    const held = barrier();
    let insert = () => {};
    const insertNow = new Promise<void>((r) => {
      insert = r;
    });
    const holder = withCommunityLock(a, community.id, {}, async (tx) => {
      held.enter();
      await insertNow;
      await tx.execute(sql`set local lock_timeout = '500ms'`);
      await tx.insert(contributions).values({
        communityId: community.id,
        memberId: member.id,
        taskId: task.id,
        kind: "reply",
        text: "Already admitted while holding reward lock",
        url: evidence.url,
        telegramMessageId: 1,
      });
    });
    await held.entered;
    const cancelling = transitionRaid(b, {
      communityId: community.id,
      taskId: task.id,
      chatId: input.chatId,
      actorId: 7n,
      messageId: 2,
      action: "closed",
      reason: "Finish accepted work first",
    });
    await waitForLock("communities");
    insert();
    await holder;
    expect((await cancelling).status).toBe("changed");
    expect(
      await a.select().from(contributions).where(eq(contributions.taskId, task.id)),
    ).toHaveLength(1);
  });
});
