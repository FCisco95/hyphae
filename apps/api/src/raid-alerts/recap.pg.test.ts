import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { communities, contributions, createDb, raidRecaps, schema, tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { GrammyError } from "grammy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedAuditDemo } from "../http/demo-seed.js";
import { readContribution } from "../http/read-service.js";
import { transitionRaid } from "../member-journey/lifecycle.js";
import { at, rubric } from "../rewards/test-db.js";
import { claimRaidRecap, deliverRaidRecap, type RecapClaim } from "./recap.js";
import { raidStats } from "./stats.js";

const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("Use the disposable test:pg runner");
const a = createDb(url);
const b = createDb(url);
const WEB = "https://hyphae.test";
const HOUR = 3_600_000;
beforeAll(async () => {
  await migrate(a, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await Promise.all([a.$client.end(), b.$client.end()]);
});

// Each test owns a far-future instant, so no other suite's raid falls in its recap window.
let slot = 0;
async function endedRaid() {
  slot += 1;
  const now = new Date(Date.UTC(2040, 0, 1) + slot * 10 * 24 * HOUR);
  const [community] = await a
    .insert(communities)
    .values({
      mint: `Recap${randomUUID()}`,
      name: "Recap test",
      telegramChatId: -BigInt(Date.now()) - BigInt(slot),
      adminTelegramUserId: 7n,
      rubricVersion: rubric.version,
      rubric,
    })
    .returning();
  if (!community) throw new Error("community");
  const [task] = await a
    .insert(tasks)
    .values({
      communityId: community.id,
      kind: "raid",
      status: "open",
      targetUrl: "https://x.com/owner/status/1",
      targetAuthor: "owner",
      opensAt: new Date(now.getTime() - 6 * HOUR),
      closesAt: new Date(now.getTime() - 60_000),
    })
    .returning();
  if (!task) throw new Error("task");
  return { now, task, community };
}

const cancel = (
  db: typeof a,
  community: { id: string; telegramChatId: bigint },
  taskId: string,
  now: Date,
) =>
  transitionRaid(
    db,
    {
      communityId: community.id,
      taskId,
      chatId: community.telegramChatId,
      actorId: 7n,
      messageId: 1,
      action: "cancelled",
      reason: "Wrong post",
    },
    at(now),
  );
const recapOf = async (taskId: string) =>
  (await a.select().from(raidRecaps).where(eq(raidRecaps.taskId, taskId)))[0];
const claimed = (claim: RecapClaim | undefined) => {
  if (!claim) throw new Error("claim");
  return claim;
};

// A pool whose recap INSERT waits until `release()`: it pauses a real claim after its candidate
// SELECT, a point no lock can hold it at, since the other claimer runs the same statements.
function pausedClaimer() {
  const base = createDb(url as string);
  let reached!: () => void;
  let release!: () => void;
  const atInsert = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const holdInsert = <T extends Pick<typeof base.$client, "unsafe">>(tx: T) =>
    new Proxy(tx, {
      get: (target, key) =>
        key === "unsafe"
          ? (query: string, params: never[]) => {
              if (!query.startsWith('insert into "raid_recaps"'))
                return target.unsafe(query, params);
              reached();
              return { values: () => released.then(() => target.unsafe(query, params).values()) };
            }
          : Reflect.get(target, key),
    });
  const client = new Proxy(base.$client, {
    get: (target, key) =>
      key === "begin"
        ? (fn: (tx: unknown) => unknown) => target.begin((tx) => fn(holdInsert(tx)))
        : Reflect.get(target, key),
  });
  return { db: drizzle({ client, schema }), atInsert, release, end: () => base.$client.end() };
}

describe("raid recaps on two real Postgres pools", () => {
  it("racing notifiers claim one recap between them", async () => {
    const { now, task } = await endedRaid();
    const claims = await Promise.all([
      claimRaidRecap(a, WEB, now),
      claimRaidRecap(b, WEB, now),
      claimRaidRecap(a, WEB, now),
    ]);
    expect(claims.filter(Boolean).map((c) => c?.taskId)).toEqual([task.id]);
    expect(await claimRaidRecap(b, WEB, now)).toBeUndefined();
  });

  it("skips a raid whose close or cancel is in flight and claims it once that settles", async () => {
    const { now, task } = await endedRaid();
    await b.transaction(async (tx) => {
      await tx.select().from(tasks).where(eq(tasks.id, task.id)).for("no key update");
      expect(await claimRaidRecap(a, WEB, now)).toBeUndefined();
    });
    expect((await claimRaidRecap(a, WEB, now))?.taskId).toBe(task.id);
  });

  it("a cancellation that commits before the send stops the recap", async () => {
    const { now, task, community } = await endedRaid();
    const claim = claimed(await claimRaidRecap(a, WEB, now));
    expect((await cancel(b, community, task.id, now)).status).toBe("changed");
    let sends = 0;
    const send = async () => {
      sends += 1;
      return { message_id: 9 };
    };
    expect(await deliverRaidRecap(a, claim, { send, clock: at(now) })).toBe("skipped");
    expect(sends).toBe(0);
    expect(await recapOf(task.id)).toMatchObject({ status: "skipped", reason: "raid_cancelled" });
  });

  it("a cancellation waits for an in-flight recap send to finish", async () => {
    const { now, task, community } = await endedRaid();
    const claim = claimed(await claimRaidRecap(a, WEB, now));
    let entered!: () => void;
    let answer!: () => void;
    const sending = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const delivered = deliverRaidRecap(a, claim, {
      clock: at(now),
      send: async () => {
        entered();
        await answered;
        return { message_id: 9 };
      },
    });
    await sending;
    let confirmed = false;
    const cancelling = cancel(b, community, task.id, now).then((result) => {
      confirmed = true;
      return result;
    });
    await setTimeout(500);
    expect(confirmed).toBe(false);
    answer();
    expect(await delivered).toBe("sent");
    expect((await cancelling).status).toBe("changed");
    expect(await recapOf(task.id)).toMatchObject({ status: "sent", telegramMessageId: 9 });
  });

  it("a claimer paused before its insert cannot take a recap another process deferred", async () => {
    const { now, task } = await endedRaid();
    const paused = pausedClaimer();
    try {
      const stale = claimRaidRecap(paused.db, WEB, now);
      await paused.atInsert;
      const first = claimed(await claimRaidRecap(a, WEB, now));
      const limited = new GrammyError(
        "Too Many Requests",
        {
          ok: false,
          error_code: 429,
          description: "Too Many Requests",
          parameters: { retry_after: 30 },
        },
        "sendMessage",
        {},
      );
      let sends = 0;
      const deliver = (claim: RecapClaim, when: Date, fail?: unknown) =>
        deliverRaidRecap(a, claim, {
          clock: at(when),
          send: async () => {
            sends += 1;
            if (fail) throw fail;
            return { message_id: 9 };
          },
        });
      expect(await deliver(first, now, limited)).toBe("pending");
      paused.release();
      expect(await stale).toBeUndefined();
      expect(await recapOf(task.id)).toMatchObject({ status: "pending", retryUsed: false });
      expect(await claimRaidRecap(b, WEB, new Date(now.getTime() + 29_999))).toBeUndefined();
      expect(sends).toBe(1);
      const due = new Date(now.getTime() + 30_000);
      const retries = (
        await Promise.all([claimRaidRecap(a, WEB, due), claimRaidRecap(b, WEB, due)])
      ).filter((claim) => claim !== undefined);
      expect(retries.map((claim) => claim.taskId)).toEqual([task.id]);
      expect(await deliver(claimed(retries[0]), due)).toBe("sent");
      expect(sends).toBe(2);
      expect(await recapOf(task.id)).toMatchObject({ status: "sent", retryUsed: true });
    } finally {
      paused.release();
      await paused.end();
    }
  });

  it("counts credited work as the public contribution read selects it", async () => {
    const now = new Date();
    const demo = await seedAuditDemo(a, now);
    const [raid] = await a
      .insert(tasks)
      .values({
        communityId: demo.communityId,
        kind: "raid",
        status: "open",
        opensAt: new Date(now.getTime() - 9 * 24 * HOUR),
        closesAt: new Date(now.getTime() + HOUR),
      })
      .returning();
    if (!raid) throw new Error("raid");
    const ids = Object.values(demo.contributions);
    for (const [i, id] of ids.entries())
      await a
        .update(contributions)
        .set({ taskId: raid.id, kind: i % 2 ? "quote" : "reply" })
        .where(eq(contributions.id, id));
    const reads = await Promise.all(ids.map((id) => readContribution(a, id, now)));
    const credited = reads.filter((r) => r?.selected && r.selected.point_units !== "0");
    expect((await raidStats(b, [raid.id], now)).get(raid.id)).toEqual({
      members: 2,
      replies: 4,
      quotes: 3,
      credited: credited.length,
      averageCredited: 78,
      scoring: 1,
      epochs: [1, 2],
    });
    expect(credited).toHaveLength(2);
  });
});
