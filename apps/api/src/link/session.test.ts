import { linkSessions } from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity } from "../rewards/test-db.js";
import { digestToken, findLinkSession, openLinkSession, resolveLinkSession } from "./session.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const open = (communityId: string, telegramUserId: bigint) =>
  openLinkSession(t.db, { communityId, telegramUserId, telegramUsername: null });

describe("link sessions", () => {
  it("stores only the digest and resolves the raw token", async () => {
    const { community } = await seedCommunity(t.db);
    const token = await openLinkSession(t.db, {
      communityId: community.id,
      telegramUserId: 42n,
      telegramUsername: "ana",
    });
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const rows = await t.db
      .select()
      .from(linkSessions)
      .where(eq(linkSessions.tokenDigest, digestToken(token)));
    expect(rows).toHaveLength(1);
    expect(
      JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    ).not.toContain(token);
    const found = await resolveLinkSession(t.db, token);
    expect(found?.community.id).toBe(community.id);
    expect(found?.session.telegramUserId).toBe(42n);
  });

  it("expires 15 minutes after it opens, on the database clock", async () => {
    const { community } = await seedCommunity(t.db);
    const token = await open(community.id, 3n);
    const [row] = await t.db
      .select({
        lifetime: sql<string>`(${linkSessions.expiresAt} - ${linkSessions.createdAt})::text`,
      })
      .from(linkSessions)
      .where(eq(linkSessions.tokenDigest, digestToken(token)));
    expect(row?.lifetime).toMatch(/^00:1[45]:/);
  });

  it("refuses malformed, unknown, used and expired tokens", async () => {
    const { community } = await seedCommunity(t.db);
    expect(await resolveLinkSession(t.db, "short")).toBeUndefined();
    expect(await resolveLinkSession(t.db, "A".repeat(43))).toBeUndefined();
    const used = await open(community.id, 1n);
    await t.db
      .update(linkSessions)
      .set({ usedAt: sql`clock_timestamp()` })
      .where(eq(linkSessions.tokenDigest, digestToken(used)));
    expect(await resolveLinkSession(t.db, used)).toBeUndefined();
    expect((await findLinkSession(t.db, used))?.session.usedAt).not.toBeNull();
    const expired = await open(community.id, 2n);
    await t.db
      .update(linkSessions)
      .set({ expiresAt: sql`clock_timestamp() - interval '1 second'` })
      .where(eq(linkSessions.tokenDigest, digestToken(expired)));
    expect(await resolveLinkSession(t.db, expired)).toBeUndefined();
  });
});
