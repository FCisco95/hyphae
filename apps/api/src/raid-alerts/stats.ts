import {
  contributions,
  type Db,
  epochs,
  rewardDecisions,
  rewardEpochSnapshots,
  rewardIntakes,
  rewardSnapshotEntries,
  tasks,
} from "@hyphae/db";
import { and, asc, eq, inArray } from "drizzle-orm";

export interface RaidStats {
  members: number;
  replies: number;
  quotes: number;
  credited: number;
  // Rounded mean credited quality of the credited work; null when nothing is credited.
  averageCredited: number | null;
  // In an open epoch with no selected decision yet, so it may still be credited.
  scoring: number;
  epochs: number[];
}

const empty = (): RaidStats => ({
  members: 0,
  replies: 0,
  quotes: 0,
  credited: 0,
  averageCredited: null,
  scoring: 0,
  epochs: [],
});

// Credited means the decision the read API selects (the snapshot's once frozen, else the last
// revision accepted before the epoch cutoff) has positive points, as the member receipt says.
export async function raidStats(
  db: Db,
  taskIds: string[],
  now: Date,
): Promise<Map<string, RaidStats>> {
  const stats = new Map(taskIds.map((id) => [id, empty()]));
  if (!taskIds.length) return stats;
  const rows = await db
    .select({
      taskId: tasks.id,
      contributionId: contributions.id,
      memberId: contributions.memberId,
      kind: contributions.kind,
      epochIndex: epochs.index,
      epochClosesAt: epochs.closesAt,
      snapshotId: rewardEpochSnapshots.id,
      frozenDecisionId: rewardSnapshotEntries.decisionId,
      frozenPointUnits: rewardSnapshotEntries.pointUnits,
    })
    .from(contributions)
    .innerJoin(
      tasks,
      and(eq(tasks.id, contributions.taskId), eq(tasks.communityId, contributions.communityId)),
    )
    .leftJoin(
      rewardIntakes,
      and(
        eq(rewardIntakes.contributionId, contributions.id),
        eq(rewardIntakes.communityId, contributions.communityId),
      ),
    )
    .leftJoin(epochs, eq(epochs.id, rewardIntakes.epochId))
    .leftJoin(rewardEpochSnapshots, eq(rewardEpochSnapshots.epochId, epochs.id))
    .leftJoin(
      rewardSnapshotEntries,
      and(
        eq(rewardSnapshotEntries.snapshotId, rewardEpochSnapshots.id),
        eq(rewardSnapshotEntries.contributionId, contributions.id),
      ),
    )
    .where(
      and(inArray(contributions.taskId, taskIds), inArray(contributions.kind, ["reply", "quote"])),
    );
  const decisions = rows.length
    ? await db
        .select({
          id: rewardDecisions.id,
          contributionId: rewardDecisions.contributionId,
          acceptedAt: rewardDecisions.acceptedAt,
          creditedQuality: rewardDecisions.creditedQuality,
          pointUnits: rewardDecisions.pointUnits,
        })
        .from(rewardDecisions)
        .where(
          inArray(
            rewardDecisions.contributionId,
            rows.map((r) => r.contributionId),
          ),
        )
        .orderBy(asc(rewardDecisions.revision))
    : [];
  const byId = new Map(decisions.map((d) => [d.id, d]));
  const lineages = new Map<string, typeof decisions>();
  for (const d of decisions)
    lineages.set(d.contributionId, [...(lineages.get(d.contributionId) ?? []), d]);

  const members = new Map<string, Set<string>>();
  const qualitySum = new Map<string, number>();
  for (const r of rows) {
    const s = stats.get(r.taskId);
    if (!s) continue;
    if (r.kind === "reply") s.replies += 1;
    else s.quotes += 1;
    members.set(r.taskId, (members.get(r.taskId) ?? new Set()).add(r.memberId));
    if (r.epochIndex !== null && !s.epochs.includes(r.epochIndex)) s.epochs.push(r.epochIndex);
    const cutoff = r.epochClosesAt?.getTime();
    if (cutoff === undefined) continue;
    const frozen = r.snapshotId !== null;
    const selected = frozen
      ? byId.get(r.frozenDecisionId ?? "")
      : lineages.get(r.contributionId)?.findLast((d) => d.acceptedAt.getTime() < cutoff);
    const points = frozen ? (r.frozenPointUnits ?? 0n) : (selected?.pointUnits ?? 0n);
    if (selected && points > 0n) {
      s.credited += 1;
      qualitySum.set(r.taskId, (qualitySum.get(r.taskId) ?? 0) + selected.creditedQuality);
    } else if (!selected && !frozen && now.getTime() < cutoff) s.scoring += 1;
  }
  for (const [id, s] of stats) {
    s.members = members.get(id)?.size ?? 0;
    s.averageCredited = s.credited ? Math.round((qualitySum.get(id) ?? 0) / s.credited) : null;
    s.epochs.sort((a, b) => a - b);
  }
  return stats;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "5h 12m", "12h", "42m"; under a minute reads as such rather than "0m".
export function span(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "under a minute";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export const statsLine = (s: RaidStats) =>
  [
    `Replies ${s.replies}`,
    `Quotes ${s.quotes}`,
    `Credited ${s.credited}`,
    ...(s.averageCredited === null ? [] : [`Avg credited score ${s.averageCredited}`]),
  ].join(" · ");
