import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  communities,
  contributions,
  createDb,
  members,
  raidDeliveries,
  raidLifecycleEvents,
  raidSubmissionReceipts,
} from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  claimRaidAlert,
  deliverRaidAlert,
  openRaid,
  setRaidSubscription,
} from "../raid-alerts/alerts.js";
import { rubric } from "../rewards/test-db.js";
import { transitionRaid } from "./lifecycle.js";
import { acceptSubmission, beginSubmission } from "./submissions.js";

const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("Use disposable test:pg runner");
const a = createDb(url);
const b = createDb(url);
beforeAll(async () => {
  await migrate(a, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
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
  it("racing distinct create events cannot open two active briefs", async () => {
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
    const results = await Promise.all([
      openRaid(a, input),
      openRaid(b, { ...input, messageId: 2 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["active_exists", "created"]);
    expect(
      await a
        .select()
        .from(raidLifecycleEvents)
        .where(eq(raidLifecycleEvents.communityId, community.id)),
    ).toHaveLength(1);
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
      await a.execute(sql`select pg_sleep(0.05)`);
      expect(cancelled).toBe(false);
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
});
