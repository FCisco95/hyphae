import {
  clipRaidText,
  fullCreditUntil,
  type PublicRaid,
  type PublicRaids,
  PublicRaidsSchema,
  publicXPost,
} from "@hyphae/core";
import {
  communities,
  type Db,
  epochs,
  raidLifecycleEvents,
  rewardConfigs,
  tasks,
} from "@hyphae/db";
import { and, asc, desc, eq, gt, inArray, lte, or } from "drizzle-orm";
import { isoUs, readOnly } from "../pg.js";
import { RewardConfigPayload } from "../rewards/config.js";
import type { ReadClock } from "./read-service.js";

export const raidColumns = {
  id: tasks.id,
  kind: tasks.kind,
  status: tasks.status,
  opens_at: isoUs(tasks.opensAt),
  closes_at: isoUs(tasks.closesAt),
  opensAt: tasks.opensAt,
  brief: tasks.brief,
  targetUrl: tasks.targetUrl,
  targetText: tasks.targetText,
};
type RaidRow = {
  id: string;
  kind: "raid" | "open";
  status: string;
  opens_at: string;
  closes_at: string;
  opensAt: Date;
  brief: string;
  targetUrl: string | null;
  targetText: string | null;
};

// The end of each raid's full-credit window, from the timing pinned by the reward configuration of
// the epoch the raid opened in (a prompt amendment never changes timing). Exact unless a raid's
// window runs past its epoch's close into an epoch with different timing; none has so far.
export async function fullCreditClock(
  tx: Db,
  communityId: string,
): Promise<(opensAt: Date) => string | null> {
  const rows = await tx
    .select({ opensAt: epochs.opensAt, closesAt: epochs.closesAt, payload: rewardConfigs.payload })
    .from(epochs)
    .innerJoin(rewardConfigs, eq(rewardConfigs.id, epochs.rewardConfigId))
    .where(eq(epochs.communityId, communityId));
  const windows = rows.map((r) => ({
    opens: r.opensAt.getTime(),
    closes: r.closesAt.getTime(),
    fullMs: RewardConfigPayload.parse(r.payload).timing.fullCreditUntilMs,
  }));
  return (opensAt) => {
    const at = opensAt.getTime();
    const epoch = windows.find((w) => w.opens <= at && at < w.closes);
    return epoch ? fullCreditUntil(opensAt, epoch.fullMs).toISOString().replace("Z", "000Z") : null;
  };
}

// One approved raid as the public reads show it: scheduled and cancelled raids omit post content
// and briefs.
export function publicRaid(
  row: RaidRow,
  now: Date,
  cancelled: boolean,
  fullUntil: (opensAt: Date) => string | null,
): PublicRaid {
  const status = cancelled
    ? "cancelled"
    : row.status === "closed" || Date.parse(row.closes_at) <= now.getTime()
      ? "closed"
      : Date.parse(row.opens_at) > now.getTime()
        ? "scheduled"
        : "open";
  const hidden = status === "cancelled" || status === "scheduled";
  const post = publicXPost(row.targetUrl);
  return {
    id: row.id,
    status,
    kind: row.kind,
    opens_at: row.opens_at,
    closes_at: row.closes_at,
    full_credit_until: status === "cancelled" ? null : fullUntil(row.opensAt),
    brief: hidden ? "" : clipRaidText(row.brief, 2000),
    post:
      !hidden && post
        ? { ...post, text: row.targetText ? clipRaidText(row.targetText, 1500) : null }
        : null,
  };
}

// Only approved raid records and public post snapshots. Never select member IDs,
// chat IDs, message IDs, proposals, moderation reasons or private submission sessions.
export function readRaids(db: Db, mint: string, clock: ReadClock): Promise<PublicRaids | null> {
  return readOnly(db, async (tx) => {
    const now = clock instanceof Date ? clock : await clock(tx);
    const [community] = await tx
      .select({
        id: communities.id,
        pausedAt: communities.rewardIntakePausedAt,
      })
      .from(communities)
      .where(eq(communities.mint, mint));
    if (!community) return null;
    const scope = and(eq(tasks.communityId, community.id), eq(tasks.kind, "raid"));
    const active = await tx
      .select(raidColumns)
      .from(tasks)
      .where(and(scope, eq(tasks.status, "open"), gt(tasks.closesAt, now)))
      .orderBy(asc(tasks.closesAt), asc(tasks.id))
      .limit(20);
    const recent = await tx
      .select(raidColumns)
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
    const fullUntil = await fullCreditClock(tx, community.id);
    return PublicRaidsSchema.parse({
      community: { mint },
      reward_intake: community.pausedAt ? "paused" : "open",
      raids: rows.map((row) => publicRaid(row, now, cancelledIds.has(row.id), fullUntil)),
      as_of: now.toISOString(),
    });
  });
}
