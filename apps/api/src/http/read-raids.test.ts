import { PublicRaidsSchema } from "@hyphae/core";
import { communities, raidLifecycleEvents, tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDb, seedCommunity } from "../rewards/test-db.js";
import { readRaids } from "./read-raids.js";
import { readRoutes } from "./routes.js";

const now = new Date("2026-10-09T18:00:00Z");
let t: Awaited<ReturnType<typeof createTestDb>>;
let mint: string;
let communityId: string;
let cancelledId: string;
beforeAll(async () => {
  t = await createTestDb();
  const first = await seedCommunity(t.db);
  const other = await seedCommunity(t.db);
  mint = first.community.mint;
  communityId = first.community.id;
  const base = {
    communityId,
    kind: "raid" as const,
    opensAt: new Date("2026-10-09T17:00:00Z"),
    closesAt: new Date("2026-10-09T20:00:00Z"),
    targetUrl: "https://twitter.com/owner/status/123?s=20",
    targetText: "Actual public post",
    brief: "Explain your approach",
    telegramMessageId: 12345,
    proposalReasoning: "private review",
  };
  const rows = await t.db
    .insert(tasks)
    .values([
      { ...base, status: "open" },
      { ...base, status: "open", opensAt: new Date("2026-10-09T19:00:00Z") },
      { ...base, status: "open", closesAt: now },
      {
        ...base,
        status: "closed",
        targetUrl: "https://x.com/removed/status/999",
        targetText: "Removed content",
        brief: "Removed instructions",
      },
      { ...base, status: "proposed" },
      { ...base, status: "rejected" },
      { ...base, status: "open", kind: "open" },
      { ...base, status: "open", communityId: other.community.id },
      { ...base, status: "open", targetUrl: "javascript:alert(1)" },
    ])
    .returning();
  cancelledId = rows[3]?.id as string;
  await t.db.insert(raidLifecycleEvents).values({
    communityId,
    taskId: cancelledId,
    actorTelegramUserId: 7n,
    action: "cancelled",
    reason: "private cancellation reason",
    telegramMessageId: 9999,
  });
});
afterAll(async () => t.close());

it("serves only this community's approved raids with safe post URLs and no private metadata", async () => {
  const body = PublicRaidsSchema.parse(await readRaids(t.db, mint, now));
  expect(body.raids).toHaveLength(5);
  expect(body.raids.map((raid) => raid.status).sort()).toEqual([
    "cancelled",
    "closed",
    "open",
    "open",
    "scheduled",
  ]);
  expect(body.raids.find((raid) => raid.id === cancelledId)?.status).toBe("cancelled");
  expect(body.raids.find((raid) => raid.id === cancelledId)?.post).toBeNull();
  expect(body.raids.find((raid) => raid.id === cancelledId)?.brief).toBe("");
  expect(body.raids.find((raid) => raid.status === "scheduled")?.post).toBeNull();
  expect(
    body.raids
      .filter((raid) => raid.post !== null)
      .every((raid) => raid.post?.url === "https://x.com/owner/status/123"),
  ).toBe(true);
  expect(body.raids.filter((raid) => raid.post === null)).toHaveLength(3);
  const serialized = JSON.stringify(body);
  for (const privateValue of [
    "telegram",
    "proposal",
    "actor",
    "idempotency",
    "private review",
    "private cancellation",
    "12345",
    "javascript:",
    "Removed content",
    "Removed instructions",
    "removed/status/999",
  ])
    expect(serialized).not.toContain(privateValue);
});
it("applies the normal anonymous per-IP rate limit to the raid route", async () => {
  const app = readRoutes({
    db: t.db,
    clock: async () => now,
    limit: { limit: 1, windowMs: 60_000, now: () => 0 },
  });
  const request = () =>
    app.request(`/communities/${mint}/raids`, { headers: { "fly-client-ip": "192.0.2.1" } });
  expect((await request()).status).toBe(200);
  const limited = await request();
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("60");
});
it("marks expiry at the exact deadline and respects early close/cancellation without writing records", async () => {
  const body = PublicRaidsSchema.parse(
    await readRaids(t.db, mint, new Date("2026-10-09T20:00:00Z")),
  );
  expect(body.raids.every((raid) => raid.status === "closed" || raid.status === "cancelled")).toBe(
    true,
  );
  const records = await t.db
    .select({ status: tasks.status })
    .from(tasks)
    .where(eq(tasks.communityId, communityId));
  expect(records.filter((row) => row.status === "open")).toHaveLength(5);
});
it("distinguishes an unknown community and a pause from an empty raid list", async () => {
  expect(await readRaids(t.db, "UnknownMint", now)).toBeNull();
  await t.db
    .update(communities)
    .set({ rewardIntakePausedAt: now })
    .where(eq(communities.id, communityId));
  expect((await readRaids(t.db, mint, now))?.reward_intake).toBe("paused");
  const empty = await seedCommunity(t.db);
  expect((await readRaids(t.db, empty.community.mint, now))?.raids).toEqual([]);
});
it("publishes a GET-only bounded read route, validates the mint, and returns honest not-found", async () => {
  const app = readRoutes({ db: t.db, clock: async () => now });
  const response = await app.request(`/communities/${mint}/raids`);
  expect(response.status).toBe(200);
  PublicRaidsSchema.parse(await response.json());
  expect(response.headers.get("cache-control")).toBe("public, max-age=15");
  expect((await app.request("/communities/UnknownMint/raids")).status).toBe(404);
  expect((await app.request("/communities/bad-mint/raids")).status).toBe(400);
  expect((await app.request(`/communities/${mint}/raids`, { method: "POST" })).status).toBe(404);
});
