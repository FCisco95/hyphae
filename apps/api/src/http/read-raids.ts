import { type PublicRaids, PublicRaidsSchema, publicXPost } from "@hyphae/core";
import { communities, type Db, raidLifecycleEvents, tasks } from "@hyphae/db";
import { and, asc, desc, eq, gt, inArray, lte, or } from "drizzle-orm";
import { isoUs, readOnly } from "../pg.js";

// Only approved raid records and public post snapshots. Never select member IDs,
// chat IDs, message IDs, proposals, moderation reasons or private submission sessions.
export function readRaids(db: Db, mint: string, now: Date): Promise<PublicRaids | null> {
  return readOnly(db, async (tx) => {
    const [community] = await tx
      .select({
        id: communities.id,
        pausedAt: communities.rewardIntakePausedAt,
      })
      .from(communities)
      .where(eq(communities.mint, mint));
    if (!community) return null;
    const columns = {
      id: tasks.id,
      status: tasks.status,
      opens_at: isoUs(tasks.opensAt),
      closes_at: isoUs(tasks.closesAt),
      brief: tasks.brief,
      targetUrl: tasks.targetUrl,
      targetText: tasks.targetText,
    };
    const scope = and(eq(tasks.communityId, community.id), eq(tasks.kind, "raid"));
    const active = await tx
      .select(columns)
      .from(tasks)
      .where(and(scope, eq(tasks.status, "open"), gt(tasks.closesAt, now)))
      .orderBy(asc(tasks.closesAt), asc(tasks.id))
      .limit(20);
    const recent = await tx
      .select(columns)
      .from(tasks)
      .where(
        and(
          scope,
          or(eq(tasks.status, "closed"), and(eq(tasks.status, "open"), lte(tasks.closesAt, now))),
        ),
      )
      .orderBy(desc(tasks.closesAt), asc(tasks.id))
      .limit(6);
    const rows = [...active, ...recent];
    const cancelled = rows.length
      ? await tx
          .select({ taskId: raidLifecycleEvents.taskId })
          .from(raidLifecycleEvents)
          .where(
            and(
              eq(raidLifecycleEvents.communityId, community.id),
              eq(raidLifecycleEvents.action, "cancelled"),
              inArray(
                raidLifecycleEvents.taskId,
                rows.map((row) => row.id),
              ),
            ),
          )
      : [];
    const cancelledIds = new Set(cancelled.map((event) => event.taskId));
    return PublicRaidsSchema.parse({
      community: { mint },
      reward_intake: community.pausedAt ? "paused" : "open",
      raids: rows.map((row) => {
        const post = publicXPost(row.targetUrl);
        return {
          id: row.id,
          status: cancelledIds.has(row.id)
            ? "cancelled"
            : row.status === "closed" || Date.parse(row.closes_at) <= now.getTime()
              ? "closed"
              : Date.parse(row.opens_at) > now.getTime()
                ? "scheduled"
                : "open",
          opens_at: row.opens_at,
          closes_at: row.closes_at,
          brief: row.brief.slice(0, 2000),
          post: post ? { ...post, text: row.targetText?.slice(0, 1500) ?? null } : null,
        };
      }),
      as_of: now.toISOString(),
    });
  });
}
