import {
  type Db,
  epochs,
  rewardDispatches,
  rewardEpochSnapshots,
  rewardNominations,
  rewardSnapshotEntries,
  rewardSnapshotMembers,
} from "@hyphae/db";
import { and, asc, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { ensureEpochAt, type RewardDeps, withCommunityLock } from "./config.js";
import { selectEffective } from "./effective.js";
import { LIVE_STATES } from "./slots.js";

export type Snapshot = typeof rewardEpochSnapshots.$inferSelect;
export type SnapshotEntry = typeof rewardSnapshotEntries.$inferSelect;
export type SnapshotMember = typeof rewardSnapshotMembers.$inferSelect;

export type CloseResult =
  | {
      status: "closed";
      created: boolean;
      snapshot: Snapshot;
      entries: SnapshotEntry[];
      members: SnapshotMember[];
    }
  | { status: "too_early" };

// P2: recorded with every snapshot, since the cutoff ordering rests on it.
export const CUTOFF_ASSUMPTION =
  "Every reward write and this close hold the community row lock and read clock_timestamp() after taking it; the Postgres server clock does not step backwards across a commit.";

async function load(tx: Db, snapshot: Snapshot, created: boolean): Promise<CloseResult> {
  const entries = await tx
    .select()
    .from(rewardSnapshotEntries)
    .where(eq(rewardSnapshotEntries.snapshotId, snapshot.id))
    .orderBy(asc(rewardSnapshotEntries.contributionId));
  const members = await tx
    .select()
    .from(rewardSnapshotMembers)
    .where(eq(rewardSnapshotMembers.snapshotId, snapshot.id))
    .orderBy(asc(rewardSnapshotMembers.memberId));
  return { status: "closed", created, snapshot, entries, members };
}

// Strict close (O3). Under the community lock, so every decision accepted before closesAt has
// committed and none can be accepted before it any more (P2). Runs once per epoch: a retry
// returns the stored snapshot and never re-reads today's decisions.
export async function closeEpoch(
  db: Db,
  input: { communityId: string; epochId: string },
  deps: RewardDeps = {},
): Promise<CloseResult> {
  return withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    const [epoch] = await tx
      .select()
      .from(epochs)
      .where(and(eq(epochs.id, input.epochId), eq(epochs.communityId, input.communityId)));
    if (!epoch) {
      throw new Error(`reward: epoch ${input.epochId} is not in community ${input.communityId}`);
    }
    if (!epoch.rewardConfigId) throw new Error("reward: a legacy epoch has no reward close");
    if (now.getTime() < epoch.closesAt.getTime()) return { status: "too_early" };

    const [existing] = await tx
      .select()
      .from(rewardEpochSnapshots)
      .where(eq(rewardEpochSnapshots.epochId, epoch.id));
    if (existing) return load(tx, existing, false);

    const { entries, totals } = await selectEffective(tx, epoch.id, epoch.closesAt);
    const undecided = entries.filter((e) => e.state !== "scored").map((e) => e.contributionId);
    const uncertain = new Set(
      undecided.length === 0
        ? []
        : (
            await tx
              .select({ contributionId: rewardDispatches.contributionId })
              .from(rewardDispatches)
              .where(
                and(
                  inArray(rewardDispatches.contributionId, undecided),
                  inArray(rewardDispatches.state, ["dispatched", "pending_reconciliation"]),
                ),
              )
          ).map((d) => d.contributionId),
    );

    const [snapshot] = await tx
      .insert(rewardEpochSnapshots)
      .values({
        communityId: input.communityId,
        epochId: epoch.id,
        closesAt: epoch.closesAt,
        closedAt: now,
        cutoffAssumption: CUTOFF_ASSUMPTION,
      })
      .returning();
    if (!snapshot) throw new Error("reward: snapshot insert returned nothing");
    if (entries.length > 0) {
      await tx.insert(rewardSnapshotEntries).values(
        entries.map((e) => ({
          snapshotId: snapshot.id,
          contributionId: e.contributionId,
          memberId: e.memberId,
          decisionId: e.decisionId,
          revision: e.revision,
          // A late decision is excluded, but an unresolved model request outranks it: the
          // original outcome may still arrive, and it too would be late.
          reason:
            e.state === "scored"
              ? null
              : uncertain.has(e.contributionId)
                ? ("pending_reconciliation" as const)
                : e.state === "late"
                  ? ("excluded" as const)
                  : ("pending_at_close" as const),
          pointUnits: BigInt(e.pointUnits),
        })),
      );
      await tx.insert(rewardSnapshotMembers).values(
        totals.map((m) => ({
          snapshotId: snapshot.id,
          memberId: m.memberId,
          pointUnits: BigInt(m.pointUnits),
          wholePoints: BigInt(m.wholePoints),
        })),
      );
    }

    await tx
      .update(rewardNominations)
      .set({ state: "expired_at_close", updatedAt: now })
      .where(
        and(eq(rewardNominations.epochId, epoch.id), inArray(rewardNominations.state, LIVE_STATES)),
      );
    await tx.update(epochs).set({ status: "closed" }).where(eq(epochs.id, epoch.id));
    // Only the next epoch: a close delayed past several boundaries leaves the later ones to their
    // own closes, which the sweep finds as due in turn.
    await ensureEpochAt(tx, input.communityId, epoch.closesAt, now);
    return load(tx, snapshot, true);
  });
}

// Pinned epochs whose scheduled close has passed and that have no snapshot yet. The sweep sends
// one close job for each; the close itself re-checks under the lock, so a duplicate is harmless.
export async function dueCloses(
  db: Db,
  now: Date,
): Promise<{ communityId: string; epochId: string }[]> {
  return db
    .select({ communityId: epochs.communityId, epochId: epochs.id })
    .from(epochs)
    .where(
      and(eq(epochs.status, "open"), isNotNull(epochs.rewardConfigId), lte(epochs.closesAt, now)),
    )
    .orderBy(asc(epochs.closesAt));
}
