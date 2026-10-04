import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { communities, createDb, raidDeliveries, raidSubscriptions } from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { dbClock } from "../rewards/config.js";
import { rubric } from "../rewards/test-db.js";
import { claimRaidAlert, deliverRaidAlert, openRaid, setRaidSubscription } from "./alerts.js";

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Expected fixture/claimed delivery");
  return value;
}

const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("Use the disposable test:pg runner");
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
async function setup() {
  const [community] = await a
    .insert(communities)
    .values({
      mint: `Alert${randomUUID()}`,
      name: "Notification test",
      telegramChatId: -BigInt(Date.now()),
      adminTelegramUserId: 7n,
      rubricVersion: rubric.version,
      rubric,
    })
    .returning();
  if (!community) throw new Error("community");
  await setRaidSubscription(a, community.id, 42n, true);
  const input = {
    communityId: community.id,
    chatId: community.telegramChatId,
    actorId: 7n,
    messageId: 1,
    post: { id: "1", handle: "owner", text: "target", url: "https://x.com/owner/status/1" },
    hours: 1,
    brief: "Explain",
  };
  return { community, input };
}
describe("raid alerts on two real Postgres pools", () => {
  it("racing webhook requests create one task/event/delivery and one claimant", async () => {
    const { input } = await setup();
    const results = await Promise.all([openRaid(a, input), openRaid(b, input)]);
    expect(results.map((r) => r.status).sort()).toEqual(["created", "existing"]);
    const jobs = await Promise.all([claimRaidAlert(a), claimRaidAlert(b)]);
    expect(jobs.filter(Boolean)).toHaveLength(1);
    const id = required(jobs.find(Boolean)).id;
    const send = vi.fn(async () => undefined);
    const done = await Promise.all([
      deliverRaidAlert(a, id, { membership: async () => true, send }),
      deliverRaidAlert(b, id, { membership: async () => true, send }),
    ]);
    expect(done).toContain("sent");
    expect(done.every((x) => x === "sent" || x === "sending")).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("Stop waits for an already in-flight send; after its confirmation no alert can send", async () => {
    const { community, input } = await setup();
    await openRaid(a, input);
    const job = required(await claimRaidAlert(a));
    let release!: () => void;
    let entered!: () => void;
    const inSend = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const delivery = deliverRaidAlert(a, job.id, {
      membership: async () => true,
      send: async () => {
        entered();
        await barrier;
      },
    });
    await inSend;
    let stopped = false;
    const stop = setRaidSubscription(b, community.id, 42n, false).then(() => {
      stopped = true;
    });
    await b.execute(sql`select pg_sleep(0.05)`);
    expect(stopped).toBe(false);
    release();
    expect(await delivery).toBe("sent");
    await stop;
    expect(
      (
        await a
          .select()
          .from(raidSubscriptions)
          .where(eq(raidSubscriptions.communityId, community.id))
      )[0]?.enabled,
    ).toBe(false);
    const send = vi.fn(async () => undefined);
    await openRaid(a, { ...input, messageId: 2 });
    expect(await claimRaidAlert(a)).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
  it("an interrupted claimed send is recorded as uncertain and is never automatically reissued", async () => {
    const { community, input } = await setup();
    await openRaid(a, input);
    const now = await dbClock(a, community.id);
    const job = required(await claimRaidAlert(a, now));
    // A claim consumed into dispatch is ambiguous; claiming alone is safe to recover.
    await a
      .update(raidDeliveries)
      .set({ dispatchStarted: true })
      .where(eq(raidDeliveries.id, job.id));
    expect(await claimRaidAlert(b, new Date(now.getTime() + 61_000))).toBeUndefined();
    const [row] = await a.select().from(raidDeliveries).where(eq(raidDeliveries.id, job.id));
    expect(row?.status).toBe("uncertain");
    expect(row?.reason).toBe("interrupted_send");
    const send = vi.fn(async () => undefined);
    expect(await deliverRaidAlert(a, job.id, { membership: async () => true, send })).toBe(
      "uncertain",
    );
    expect(send).not.toHaveBeenCalled();
  });
  it("opening another raid does not wait on a subscriber's in-flight send", async () => {
    const { input } = await setup();
    await openRaid(a, input);
    const job = required(await claimRaidAlert(a));
    let release = () => {};
    let entered = () => {};
    const inSend = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sending = deliverRaidAlert(a, job.id, {
      membership: async () => true,
      send: async () => {
        entered();
        await barrier;
      },
    });
    await inSend;
    try {
      const second = await b.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout = '500ms'`);
        return openRaid(tx, { ...input, messageId: 2 });
      });
      expect(second.status).toBe("created");
    } finally {
      release();
      await sending;
    }
    const pending = required(await claimRaidAlert(a));
    await deliverRaidAlert(a, pending.id, {
      membership: async () => true,
      send: async () => undefined,
    });
  });
  it("a stale claim whose dispatch never started can safely recover once", async () => {
    const { community, input } = await setup();
    await openRaid(a, input);
    const now = await dbClock(a, community.id);
    const first = required(await claimRaidAlert(a, now));
    const recovered = required(await claimRaidAlert(b, new Date(now.getTime() + 61_000)));
    expect(recovered.id).toBe(first.id);
    const send = vi.fn(async () => undefined);
    const outcomes = await Promise.all([
      deliverRaidAlert(a, first.id, { membership: async () => true, send }),
      deliverRaidAlert(b, recovered.id, { membership: async () => true, send }),
    ]);
    expect(outcomes).toContain("sent");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
