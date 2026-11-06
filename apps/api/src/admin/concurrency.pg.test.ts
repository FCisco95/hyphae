import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { communities, createDb, type Db } from "@hyphae/db";
import { eq, inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withCommunityLock } from "../rewards/config.js";
import { rubric } from "../rewards/test-db.js";
import { AdminError } from "./guard.js";
import { adminRoutes } from "./routes.js";
import { administerCommunity } from "./service.js";

const url = process.env.HYPHAE_TEST_PG_URL;
if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname))
  throw new Error("admin races require a disposable loopback HYPHAE_TEST_PG_URL");
const a = createDb(url);
const b = createDb(url);
const fixtureIds: string[] = [];
async function seedCommunity(db: Db) {
  const unique = randomUUID().replaceAll("-", "");
  const [community] = await db
    .insert(communities)
    .values({
      mint: `Admin${unique}`,
      name: "Admin fixture",
      telegramChatId: -BigInt(`0x${unique.slice(0, 12)}`),
      adminTelegramUserId: 7n,
      rubricVersion: rubric.version,
      rubric,
    })
    .returning();
  if (!community) throw new Error("missing admin fixture");
  fixtureIds.push(community.id);
  return { community };
}
beforeAll(async () => {
  await migrate(a, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  if (fixtureIds.length) await a.delete(communities).where(inArray(communities.id, fixtureIds));
  await Promise.all([a.$client.end(), b.$client.end()]);
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitForBlockedWriter() {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const rows = await b.execute(
      sql`select pid from pg_stat_activity where wait_event_type = 'Lock' and query like '%for no key update%'`,
    );
    if (rows.length) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("admin writer did not reach its community row lock");
}

describe("admin intake on independent Postgres pools", () => {
  it("bounds the initial lookup as well as the row-lock query", async () => {
    const { community } = await seedCommunity(a);
    const held = deferred();
    const entered = deferred();
    const holder = a.transaction(async (tx) => {
      await tx.execute(sql`lock table communities in access exclusive mode`);
      entered.resolve();
      await held.promise;
    });
    await entered.promise;
    const query = administerCommunity(b, {
      mint: community.mint,
      actorId: 7n,
      signal: new AbortController().signal,
      deadline: Date.now() + 100,
      authorize: async () => {},
      update: { paused: true, expected_paused_at: null },
    }).then(
      () => "unexpected write",
      (error: unknown) => error,
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    let outcome: unknown;
    try {
      outcome = await Promise.race([
        query,
        new Promise((resolve) => {
          timer = setTimeout(() => resolve("unbounded lookup"), 500);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      held.resolve();
      await holder;
      await query;
    }
    expect(outcome).not.toBe("unbounded lookup");
    expect(outcome).not.toBe("unexpected write");
    expect(
      (await a.query.communities.findFirst({ where: eq(communities.id, community.id) }))
        ?.rewardIntakePausedAt,
    ).toBeNull();
  });

  it("does not block a designation change during an overview and refuses its result", async () => {
    const { community } = await seedCommunity(a);
    const read = administerCommunity(b, {
      mint: community.mint,
      actorId: 7n,
      signal: new AbortController().signal,
      deadline: Date.now() + 5000,
      authorize: async () => {
        await a
          .update(communities)
          .set({ adminTelegramUserId: 8n })
          .where(eq(communities.id, community.id));
      },
    });
    await expect(read).rejects.toMatchObject({ code: "forbidden", status: 403 });
  });

  it("does not write after the HTTP response times out behind a real row lock", async () => {
    const { community } = await seedCommunity(a);
    const held = deferred();
    const entered = deferred();
    const holder = withCommunityLock(a, community.id, {}, async () => {
      entered.resolve();
      await held.promise;
    });
    await entered.promise;
    let liveReads = 0;
    const app = adminRoutes({
      db: b,
      enabled: true,
      timeoutMs: 200,
      identity: {
        verify: async () => "did:privy:admin",
        currentUser: async () => ({
          id: "did:privy:admin",
          linked_accounts: [{ type: "telegram", telegram_user_id: "7" }],
        }),
      },
      telegramAdmin: async () => {
        liveReads++;
        return true;
      },
    });
    const response = app.request(`/communities/${community.mint}/intake`, {
      method: "PUT",
      headers: {
        authorization: "Bearer fixture.payload.signature",
        "content-type": "application/json",
      },
      body: JSON.stringify({ paused: true, expected_paused_at: null }),
    });
    try {
      await waitForBlockedWriter();
      const timedOut = await response;
      expect(timedOut.status).toBe(503);
      expect(await timedOut.json()).toEqual({ error: "unavailable" });
    } finally {
      held.resolve();
      await holder;
    }
    await withCommunityLock(a, community.id, {}, async (_tx, current) => {
      expect(current.rewardIntakePausedAt).toBeNull();
    });
    expect(liveReads).toBe(0);
  });
  it("never writes after its signal expires while waiting for the community lock", async () => {
    const { community } = await seedCommunity(a);
    const held = deferred();
    const entered = deferred();
    const holder = withCommunityLock(a, community.id, {}, async () => {
      entered.resolve();
      await held.promise;
    });
    await entered.promise;
    const controller = new AbortController();
    let authorized = 0;
    const queued = administerCommunity(b, {
      mint: community.mint,
      actorId: 7n,
      signal: controller.signal,
      deadline: Date.now() + 5000,
      authorize: async () => {
        authorized++;
      },
      update: { paused: true, expected_paused_at: null },
    }).then(
      () => null,
      (error: unknown) => error,
    );
    try {
      await waitForBlockedWriter();
      controller.abort();
    } finally {
      held.resolve();
      await holder;
    }
    const error = await queued;
    expect(error).toBeInstanceOf(AdminError);
    expect(error).toMatchObject({ code: "unavailable", status: 503 });
    expect(authorized).toBe(0);
    expect(
      (await a.query.communities.findFirst({ where: eq(communities.id, community.id) }))
        ?.rewardIntakePausedAt,
    ).toBeNull();
  });

  it("rechecks designation after acquiring a lock that waited behind an admin change", async () => {
    const { community } = await seedCommunity(a);
    const held = deferred();
    const entered = deferred();
    const holder = withCommunityLock(a, community.id, {}, async (tx) => {
      await tx
        .update(communities)
        .set({ adminTelegramUserId: 8n })
        .where(eq(communities.id, community.id));
      entered.resolve();
      await held.promise;
    });
    await entered.promise;
    let authorized = 0;
    const queued = administerCommunity(b, {
      mint: community.mint,
      actorId: 7n,
      signal: new AbortController().signal,
      deadline: Date.now() + 5000,
      authorize: async () => {
        authorized++;
      },
      update: { paused: true, expected_paused_at: null },
    }).then(
      () => null,
      (error: unknown) => error,
    );
    try {
      await waitForBlockedWriter();
    } finally {
      held.resolve();
      await holder;
    }
    expect(await queued).toMatchObject({ code: "forbidden", status: 403 });
    expect(authorized).toBe(0);
    expect(
      (await a.query.communities.findFirst({ where: eq(communities.id, community.id) }))
        ?.rewardIntakePausedAt,
    ).toBeNull();
  });

  it("uses the newly committed group for its live admin check after a chat migration", async () => {
    const { community } = await seedCommunity(a);
    const held = deferred();
    const entered = deferred();
    const newChat = community.telegramChatId - 1_000_000n;
    const holder = withCommunityLock(a, community.id, {}, async (tx) => {
      await tx
        .update(communities)
        .set({ telegramChatId: newChat })
        .where(eq(communities.id, community.id));
      entered.resolve();
      await held.promise;
    });
    await entered.promise;
    const checked: bigint[] = [];
    const queued = administerCommunity(b, {
      mint: community.mint,
      actorId: 7n,
      signal: new AbortController().signal,
      deadline: Date.now() + 5000,
      authorize: async (current) => {
        checked.push(current.telegramChatId);
        throw new AdminError("forbidden", 403);
      },
      update: { paused: true, expected_paused_at: null },
    }).then(
      () => null,
      (error: unknown) => error,
    );
    try {
      await waitForBlockedWriter();
    } finally {
      held.resolve();
      await holder;
    }
    expect(await queued).toMatchObject({ code: "forbidden", status: 403 });
    expect(checked).toEqual([newChat]);
    expect(
      (await a.query.communities.findFirst({ where: eq(communities.id, community.id) }))
        ?.rewardIntakePausedAt,
    ).toBeNull();
  });

  it("serializes stale concurrent edits into one pause and one conflict", async () => {
    const { community } = await seedCommunity(a);
    const request = () => ({
      mint: community.mint,
      actorId: 7n,
      signal: new AbortController().signal,
      deadline: Date.now() + 5000,
      authorize: async () => {},
      update: { paused: true, expected_paused_at: null },
    });
    const result = await Promise.allSettled([
      administerCommunity(a, request()),
      administerCommunity(b, request()),
    ]);
    const winner = result.find((r) => r.status === "fulfilled");
    const loser = result.find((r) => r.status === "rejected");
    expect(winner?.status).toBe("fulfilled");
    expect(loser?.status === "rejected" ? loser.reason : null).toMatchObject({
      code: "conflict",
      status: 409,
    });
    const current = await a.query.communities.findFirst({
      where: eq(communities.id, community.id),
    });
    expect(current?.rewardIntakePausedAt?.toISOString()).toBe(
      winner?.status === "fulfilled" ? winner.value.intake.paused_at : undefined,
    );
  });

  it("bounds a lock wait even when its HTTP cancellation is absent", async () => {
    const { community } = await seedCommunity(a);
    const held = deferred();
    const entered = deferred();
    const holder = withCommunityLock(a, community.id, {}, async () => {
      entered.resolve();
      await held.promise;
    });
    await entered.promise;
    const start = Date.now();
    try {
      await expect(
        administerCommunity(b, {
          mint: community.mint,
          actorId: 7n,
          signal: new AbortController().signal,
          deadline: start + 150,
          authorize: async () => {},
          update: { paused: true, expected_paused_at: null },
        }),
      ).rejects.toBeDefined();
      expect(Date.now() - start).toBeLessThan(3000);
    } finally {
      held.resolve();
      await holder;
    }
    expect(
      (await a.query.communities.findFirst({ where: eq(communities.id, community.id) }))
        ?.rewardIntakePausedAt,
    ).toBeNull();
  });
});
