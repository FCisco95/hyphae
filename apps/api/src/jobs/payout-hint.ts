import { type Db, rewardDecisions, rewardIntakes } from "@hyphae/db";
import { eq, sql } from "drizzle-orm";

// Serialize a member's score sends through their notification mark. Keep the existing lock
// key so old and new workers use the same lock during a rollout.
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
