import { randomUUID } from "node:crypto";
import { PublicRaidSchema } from "@hyphae/core";
import {
  communities,
  integrationRaidRequests,
  raidAnnouncements,
  raidDeliveries,
  raidLifecycleEvents,
  raidSubscriptions,
  tasks,
} from "@hyphae/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity, seedRewardLane, T0 } from "../rewards/test-db.js";
import type { XPost } from "../x/oembed.js";
import { organicSignature } from "./hmac.js";
import { type PostRaidDeps, postRaid } from "./raids.js";
import { integrationRoutes } from "./routes.js";

const KEY = { id: "organic-test", secret: "k".repeat(48) };
const NOW = new Date(T0.getTime() + 3_600_000);
const BOT_ID = 9_000_001n;
const POST: XPost = {
  id: "1850000000000000001",
  handle: "owner",
  text: "A public post worth raiding",
  url: "https://x.com/owner/status/1850000000000000001",
};

let t: Awaited<ReturnType<typeof createTestDb>>;
let lane: Awaited<ReturnType<typeof seedRewardLane>>;
beforeAll(async () => {
  t = await createTestDb();
  lane = await seedRewardLane(t.db);
});
afterAll(async () => t.close());

interface Fake {
  announced: { taskId: string; hours: number; chatId: bigint }[];
  failAnnounce: boolean;
}
let fake: Fake;
// Telegram message ids are unique in a chat, so the fake never repeats one.
let message = 500;
beforeEach(() => {
  fake = { announced: [], failAnnounce: false };
});

function app(key: typeof KEY | null = KEY, nowMs = NOW.getTime()) {
  const deps: PostRaidDeps = {
    db: t.db,
    fetchPost: async (url) => (url === POST.url ? POST : null),
    botId: async () => BOT_ID,
    announce: async (community, _post, task, hours) => {
      if (fake.failAnnounce) throw new Error("telegram down");
      fake.announced.push({ taskId: task.id, hours, chatId: community.telegramChatId });
      message += 1;
      return message;
    },
    clock: async () => NOW,
  };
  return new Hono().route(
    "/v1/integrations",
    integrationRoutes({
      key,
      postRaid: (mint, keyId, request) => postRaid(deps, mint, keyId, request),
      now: () => nowMs,
    }),
  );
}

const pathOf = (mint: string) => `/v1/integrations/communities/${mint}/raids`;
function body(over: Record<string, unknown> = {}) {
  return {
    idempotency_key: randomUUID(),
    post_url: "https://twitter.com/owner/status/1850000000000000001?s=20",
    brief: "Reply with what you would check first",
    closes_at: new Date(NOW.getTime() + 48 * 3_600_000).toISOString(),
    actor: { organic_user_id: randomUUID(), role: "steward" },
    ...over,
  };
}
function send(
  mint: string,
  payload: unknown,
  opts: { app?: Hono; ts?: number; secret?: string; keyId?: string; sign?: string } = {},
) {
  const raw = JSON.stringify(payload);
  const ts = String(Math.floor((opts.ts ?? NOW.getTime()) / 1000));
  const path = pathOf(mint);
  const sig = organicSignature(opts.secret ?? KEY.secret, "POST", opts.sign ?? path, ts, raw);
  return (opts.app ?? app()).request(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Organic-HMAC keyId=${opts.keyId ?? KEY.id}, ts=${ts}, sig=${sig}`,
    },
    body: raw,
  });
}
async function closeAllRaids() {
  await t.db
    .update(tasks)
    .set({ status: "closed" })
    .where(eq(tasks.communityId, lane.community.id));
}

describe("the signed raid route", () => {
  beforeEach(closeAllRaids);

  it("opens a raid with /raid's records, announces it once and answers 201", async () => {
    await t.db.insert(raidSubscriptions).values({
      communityId: lane.community.id,
      telegramUserId: 4242n,
      enabled: true,
      enabledAt: T0,
    });
    const request = body();
    const r = await send(lane.community.mint, request);
    expect(r.status).toBe(201);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const messageId = message;
    const { raid } = (await r.json()) as { raid: unknown };
    const parsed = PublicRaidSchema.parse(raid);
    expect(parsed).toMatchObject({
      status: "open",
      kind: "raid",
      brief: request.brief,
      post: { url: POST.url, handle: "owner", text: POST.text },
      full_credit_until: new Date(NOW.getTime() + 360 * 60_000).toISOString().replace("Z", "000Z"),
    });
    expect(fake.announced).toEqual([
      { taskId: parsed.id, hours: 48, chatId: lane.community.telegramChatId },
    ]);
    const [task] = await t.db.select().from(tasks).where(eq(tasks.id, parsed.id));
    expect(task).toMatchObject({
      telegramMessageId: messageId,
      targetAuthor: "owner",
      brief: request.brief,
    });
    expect(task?.opensAt).toEqual(NOW);
    const [event] = await t.db
      .select()
      .from(raidLifecycleEvents)
      .where(eq(raidLifecycleEvents.taskId, parsed.id));
    expect(event).toMatchObject({
      action: "opened",
      actorTelegramUserId: BOT_ID,
      telegramMessageId: messageId,
    });
    const [announcement] = await t.db
      .select()
      .from(raidAnnouncements)
      .where(eq(raidAnnouncements.taskId, parsed.id));
    expect(announcement).toMatchObject({
      telegramChatId: lane.community.telegramChatId,
      telegramMessageId: messageId,
    });
    const deliveries = await t.db
      .select()
      .from(raidDeliveries)
      .where(eq(raidDeliveries.announcementId, announcement?.id as string));
    expect(deliveries.map((d) => d.telegramUserId)).toEqual([4242n]);
    const [audit] = await t.db
      .select()
      .from(integrationRaidRequests)
      .where(eq(integrationRaidRequests.taskId, parsed.id));
    expect(audit).toMatchObject({
      keyId: KEY.id,
      actorOrganicUserId: request.actor.organic_user_id,
      actorRole: "steward",
      state: "created",
    });
  });

  it("answers a repeated identical request with the first answer and opens nothing new", async () => {
    const request = body();
    const first = await send(lane.community.mint, request);
    const again = await send(lane.community.mint, request, { ts: NOW.getTime() + 30_000 });
    expect([first.status, again.status]).toEqual([201, 201]);
    expect(await again.json()).toEqual(await first.json());
    expect(fake.announced).toHaveLength(1);
  });

  it("refuses the same idempotency key with a different body: 409", async () => {
    const request = body();
    expect((await send(lane.community.mint, request)).status).toBe(201);
    const r = await send(lane.community.mint, { ...request, brief: "Something else" });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "idempotency_conflict" });
    expect(fake.announced).toHaveLength(1);
  });

  it("refuses a fourth open raid: 409, nothing announced", async () => {
    for (let i = 0; i < 3; i++) expect((await send(lane.community.mint, body())).status).toBe(201);
    const r = await send(lane.community.mint, body());
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "open_raid_limit" });
    expect(fake.announced).toHaveLength(3);
  });

  it("refuses an unregistered or paused community: 403", async () => {
    const unknown = await send("NotACommunity", body());
    expect(unknown.status).toBe(403);
    expect(await unknown.json()).toEqual({ error: "community_not_registered" });
    const paused = await seedRewardLane(t.db);
    await t.db
      .update(communities)
      .set({ rewardIntakePausedAt: T0 })
      .where(eq(communities.id, paused.community.id));
    const r = await send(paused.community.mint, body());
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "intake_paused" });
    expect(fake.announced).toHaveLength(0);
  });

  it("refuses a bad signature, a wrong key id and a request signed for another path: 401", async () => {
    for (const opts of [
      { secret: "x".repeat(48) },
      { keyId: "organic-other" },
      { sign: pathOf("OtherMint") },
    ]) {
      const r = await send(lane.community.mint, body(), opts);
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: "unauthorized" });
    }
    const unsigned = await app().request(pathOf(lane.community.mint), {
      method: "POST",
      body: JSON.stringify(body()),
    });
    expect(unsigned.status).toBe(401);
    expect(fake.announced).toHaveLength(0);
  });

  it("refuses a correctly signed request with a ts older than 60 seconds: 401", async () => {
    const r = await send(lane.community.mint, body(), { ts: NOW.getTime() - 61_000 });
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "stale_request" });
    expect(fake.announced).toHaveLength(0);
  });

  it("fails closed when its key is unset: 503 for every request, signed or not", async () => {
    const r = await send(lane.community.mint, body(), { app: app(null) });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "not_configured" });
    expect(fake.announced).toHaveLength(0);
  });

  it("validates like /raid: a public X post it can read, a window, no scheduling: 400", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ post_url: "https://example.com/owner/status/1" }, "invalid_post_url"],
      [{ post_url: "https://x.com/owner/status/1850000000000000009" }, "post_unreadable"],
      [{ closes_at: new Date(NOW.getTime() + 30_000).toISOString() }, "invalid_window"],
      [{ closes_at: new Date(NOW.getTime() + 31 * 86_400_000).toISOString() }, "invalid_window"],
      [{ opens_at: new Date(NOW.getTime() + 3_600_000).toISOString() }, "scheduling_unsupported"],
    ];
    for (const [over, error] of cases) {
      const r = await send(lane.community.mint, body(over));
      expect(r.status, error).toBe(400);
      expect(await r.json()).toEqual({ error });
    }
    for (const bad of [
      body({ brief: "" }),
      body({ actor: { organic_user_id: randomUUID(), role: "member" } }),
      body({ extra: true }),
      { ...body(), idempotency_key: "not-a-uuid" },
    ]) {
      const r = await send(lane.community.mint, bad);
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ error: "bad_request" });
    }
    const opensNow = await send(lane.community.mint, body({ opens_at: NOW.toISOString() }));
    expect(opensNow.status).toBe(201);
    expect(fake.announced).toHaveLength(1);
  });

  it("undoes the reservation when Telegram refuses, so the same request can be sent again", async () => {
    fake.failAnnounce = true;
    const request = body();
    const r = await send(lane.community.mint, request);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "telegram_unavailable" });
    expect(
      await t.db
        .select()
        .from(integrationRaidRequests)
        .where(eq(integrationRaidRequests.idempotencyKey, request.idempotency_key)),
    ).toEqual([]);
    fake.failAnnounce = false;
    expect((await send(lane.community.mint, request)).status).toBe(201);
    expect(fake.announced).toHaveLength(1);
  });

  it("serves only the raid and an error code: no actor, key, chat or message id", async () => {
    const request = body();
    const created = JSON.stringify(await (await send(lane.community.mint, request)).json());
    const conflict = JSON.stringify(
      await (await send(lane.community.mint, { ...request, brief: "changed" })).json(),
    );
    for (const text of [created, conflict]) {
      for (const secret of [
        request.actor.organic_user_id,
        KEY.id,
        KEY.secret,
        String(lane.community.telegramChatId),
        "telegram",
        "actor",
      ])
        expect(text).not.toContain(secret);
    }
  });

  it("answers 404 for other methods and paths, and 413 for an oversized body", async () => {
    const a = app();
    expect((await a.request(pathOf(lane.community.mint))).status).toBe(404);
    expect((await a.request("/v1/integrations/other", { method: "POST" })).status).toBe(404);
    const big = await send(lane.community.mint, body({ brief: "x".repeat(20_000) }));
    expect(big.status).toBe(413);
  });

  it("serves a null full-credit time for a community with no pinned timing", async () => {
    const bare = await seedCommunity(t.db);
    const r = await send(bare.community.mint, body());
    expect(r.status).toBe(201);
    const { raid } = (await r.json()) as { raid: { full_credit_until: string | null } };
    expect(raid.full_credit_until).toBeNull();
  });
});
