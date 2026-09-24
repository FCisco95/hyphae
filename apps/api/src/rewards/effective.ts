import { aggregatePointUnits, type PointUnits, wholePoints } from "@hyphae/core";
import { communities, type Db, epochs, rewardDecisions, rewardIntakes } from "@hyphae/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { dbClock, type RewardDeps } from "./config.js";

export interface EffectiveEntry {
  contributionId: string;
  memberId: string;
  // scored: a revision was accepted before the cutoff (possibly worth 0 points).
  // pending: no decision yet. late: every decision was accepted at or after the cutoff.
  state: "scored" | "pending" | "late";
  decisionId: string | null;
  revision: number | null;
  pointUnits: string;
}

export interface EffectiveResults {
  epochId: string;
  closesAt: Date;
  cutoff: Date;
  // The scheduled close has passed by the database clock: nothing can still change the allocation.
  closed: boolean;
  // Every admitted contribution in scope, including pending and zero-point ones.
  totalEntries: number;
  entries: EffectiveEntry[];
  // Exact units per member; whole points are rounded once, after aggregation (O5).
  totals: { memberId: string; pointUnits: string; wholePoints: string }[];
}

export interface EffectiveQuery {
  communityId: string;
  epochId: string;
  memberId?: string;
  cutoff?: Date;
}

// The O6 selection: per admitted contribution, the last revision accepted strictly before the
// cutoff (default: the epoch's scheduled closesAt). Superseded revisions, decisions accepted at or
// after the cutoff, and legacy scoring_runs never contribute.
export async function effectiveResults(
  db: Db,
  query: EffectiveQuery,
  deps: RewardDeps = {},
): Promise<EffectiveResults> {
  return db.transaction(async (tx) => {
    // SHARE waits for an in-flight reward writer (NO KEY UPDATE) to commit, so once the clock
    // below reads >= closesAt, no decision accepted before close can still appear.
    await tx
      .select({ id: communities.id })
      .from(communities)
      .where(eq(communities.id, query.communityId))
      .for("share");
    const now = await (deps.clock ?? dbClock)(tx, query.communityId);
    const [epoch] = await tx
      .select()
      .from(epochs)
      .where(and(eq(epochs.id, query.epochId), eq(epochs.communityId, query.communityId)));
    if (!epoch) {
      throw new Error(`reward: epoch ${query.epochId} is not in community ${query.communityId}`);
    }
    const cutoff = query.cutoff ?? epoch.closesAt;

    const intakes = await tx
      .select({ contributionId: rewardIntakes.contributionId, memberId: rewardIntakes.memberId })
      .from(rewardIntakes)
      .where(
        and(
          eq(rewardIntakes.epochId, epoch.id),
          query.memberId ? eq(rewardIntakes.memberId, query.memberId) : undefined,
        ),
      )
      .orderBy(asc(rewardIntakes.acceptedAt), asc(rewardIntakes.contributionId));
    const decisions = intakes.length
      ? await tx
          .select({
            id: rewardDecisions.id,
            contributionId: rewardDecisions.contributionId,
            revision: rewardDecisions.revision,
            pointUnits: rewardDecisions.pointUnits,
            acceptedAt: rewardDecisions.acceptedAt,
          })
          .from(rewardDecisions)
          .where(
            inArray(
              rewardDecisions.contributionId,
              intakes.map((i) => i.contributionId),
            ),
          )
          .orderBy(asc(rewardDecisions.revision))
      : [];

    const byContribution = new Map<string, typeof decisions>();
    for (const d of decisions) {
      byContribution.set(d.contributionId, [...(byContribution.get(d.contributionId) ?? []), d]);
    }
    const units = new Map<string, PointUnits[]>();
    const entries = intakes.map((intake): EffectiveEntry => {
      const lineage = byContribution.get(intake.contributionId) ?? [];
      const selected = lineage.findLast((d) => d.acceptedAt.getTime() < cutoff.getTime());
      const memberUnits = units.get(intake.memberId) ?? [];
      units.set(intake.memberId, memberUnits);
      if (selected) memberUnits.push(selected.pointUnits as PointUnits);
      return {
        ...intake,
        state: selected ? "scored" : lineage.length ? "late" : "pending",
        decisionId: selected?.id ?? null,
        revision: selected?.revision ?? null,
        pointUnits: (selected?.pointUnits ?? 0n).toString(),
      };
    });
    const totals = [...units]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([memberId, values]) => {
        const total = aggregatePointUnits(values);
        return {
          memberId,
          pointUnits: total.toString(),
          wholePoints: wholePoints(total).toString(),
        };
      });

    return {
      epochId: epoch.id,
      closesAt: epoch.closesAt,
      cutoff,
      closed: now.getTime() >= epoch.closesAt.getTime(),
      totalEntries: entries.length,
      entries,
      totals,
    };
  });
}
