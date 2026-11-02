import { type Db, rewardConfigs, rulesTestPasses } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { rulesTestFor } from "../payout/rules-test.js";
import { isoUs } from "../pg.js";
import { latestEpoch, RewardConfigPayload } from "../rewards/config.js";

// The member's own pass of the test that the rules pinned by the community's latest epoch require,
// the same test /rules hands out; null when those rules have no test. A pass is not a payout
// verdict: the gate also needs it before the epoch's close.
export async function rulesTestStatus(
  db: Db,
  communityId: string,
  memberId: string,
): Promise<{ passed: boolean; passed_at: string | null } | null> {
  const epoch = await latestEpoch(db, communityId);
  if (!epoch?.rewardConfigId) return null;
  const [config] = await db
    .select({ payload: rewardConfigs.payload })
    .from(rewardConfigs)
    .where(eq(rewardConfigs.id, epoch.rewardConfigId));
  const payload = RewardConfigPayload.safeParse(config?.payload);
  const test = payload.success ? rulesTestFor(payload.data.rubric) : undefined;
  if (!test) return null;
  const [pass] = await db
    .select({ passedAt: isoUs(rulesTestPasses.passedAt) })
    .from(rulesTestPasses)
    .where(
      and(
        eq(rulesTestPasses.communityId, communityId),
        eq(rulesTestPasses.memberId, memberId),
        eq(rulesTestPasses.testId, test.id),
      ),
    );
  return pass ? { passed: true, passed_at: pass.passedAt } : { passed: false, passed_at: null };
}
