import { createHash, randomBytes } from "node:crypto";
import { communities, type Db, linkSessions } from "@hyphae/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export type LinkSession = typeof linkSessions.$inferSelect;

export const digestToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

// Returns the raw token; only its digest is stored, so a database read cannot replay a link.
export async function openLinkSession(
  db: Db,
  input: { communityId: string; telegramUserId: bigint; telegramUsername: string | null },
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(linkSessions).values({
    ...input,
    tokenDigest: digestToken(token),
    expiresAt: sql`clock_timestamp() + interval '15 minutes'`,
  });
  return token;
}

async function lookup(db: Db, token: string, openOnly: boolean) {
  if (!TOKEN.test(token)) return undefined;
  const [row] = await db
    .select({ session: linkSessions, community: communities })
    .from(linkSessions)
    .innerJoin(communities, eq(communities.id, linkSessions.communityId))
    .where(
      and(
        eq(linkSessions.tokenDigest, digestToken(token)),
        ...(openOnly
          ? [isNull(linkSessions.usedAt), gt(linkSessions.expiresAt, sql`clock_timestamp()`)]
          : []),
      ),
    );
  return row;
}

// An open, unexpired session.
export const resolveLinkSession = (db: Db, token: string) => lookup(db, token, true);
// Any session, used or expired; /link/status reconciles against it.
export const findLinkSession = (db: Db, token: string) => lookup(db, token, false);
