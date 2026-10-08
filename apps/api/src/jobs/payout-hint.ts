import type { PayoutVerdictV1 } from "@hyphae/core";
import {
  communities,
  type Db,
  epochs,
  rewardDecisions,
  rewardEpochSnapshots,
  rewardIntakes,
} from "@hyphae/db";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { epochPayouts } from "../payout/readiness.js";

// Score messages of one member in one epoch go out one at a time, from the hint's read to the
// send's mark, so each sees whether another was sent and the hint rides on one of them only. The
// lock lasts until the caller's transaction ends; that transaction stays read committed, so its
// reads after the wait see the mark.
export async function lockScoreMessages(tx: Db, decisionId: string): Promise<void> {
  const [owner] = await tx
    .select({ memberId: rewardIntakes.memberId, epochId: rewardDecisions.epochId })
    .from(rewardDecisions)
    .innerJoin(rewardIntakes, eq(rewardIntakes.contributionId, rewardDecisions.contributionId))
    .where(eq(rewardDecisions.id, decisionId));
  if (!owner) throw new Error(`reward: decision ${decisionId} missing`);
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`score-hint:${owner.memberId}:${owner.epochId}`}))`,
  );
}

// The payout status to show under a decision's score message: only while its epoch is open and
// pays, and only on the member's first scored message of that epoch, so no one is told twice. A
// message is first until another of the member's messages in the epoch has been sent. closesAt:
// after it, the status's instruction no longer applies.
export async function scoreHint(
  db: Db,
  decisionId: string,
  now: Date,
): Promise<{ payout: PayoutVerdictV1; closesAt: Date } | null> {
  const [found] = await db
    .select({
      affectsAllocation: rewardDecisions.affectsAllocation,
      memberId: rewardIntakes.memberId,
      epoch: epochs,
      community: { mint: communities.mint, firstPaidEpoch: communities.firstPaidEpoch },
    })
    .from(rewardDecisions)
    .innerJoin(rewardIntakes, eq(rewardIntakes.contributionId, rewardDecisions.contributionId))
    .innerJoin(epochs, eq(epochs.id, rewardDecisions.epochId))
    .innerJoin(communities, eq(communities.id, rewardDecisions.communityId))
    .where(eq(rewardDecisions.id, decisionId));
  if (!found) throw new Error(`reward: decision ${decisionId} missing`);
  const { epoch, memberId } = found;
  if (!found.affectsAllocation || now.getTime() >= epoch.closesAt.getTime()) return null;

  const [sent] = await db
    .select({ id: rewardDecisions.id })
    .from(rewardDecisions)
    .innerJoin(rewardIntakes, eq(rewardIntakes.contributionId, rewardDecisions.contributionId))
    .where(
      and(
        eq(rewardDecisions.epochId, epoch.id),
        eq(rewardIntakes.memberId, memberId),
        isNotNull(rewardDecisions.notifiedAt),
        ne(rewardDecisions.id, decisionId),
      ),
    )
    .limit(1);
  if (sent) return null;

  const [snapshot] = await db
    .select({ id: rewardEpochSnapshots.id })
    .from(rewardEpochSnapshots)
    .where(eq(rewardEpochSnapshots.epochId, epoch.id));
  const { members } = await epochPayouts(db, {
    community: found.community,
    epoch,
    snapshotId: snapshot?.id ?? null,
    closed: false,
    memberIds: [memberId],
  });
  const payout = members.get(memberId);
  return payout && "reasons" in payout ? { payout, closesAt: epoch.closesAt } : null;
}
