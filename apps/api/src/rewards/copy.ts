import { firstCopyOf, isCopy, type RewardFlag } from "@hyphae/core";
import { contributions, type Db, rewardDecisions, rewardIntakes } from "@hyphae/db";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { appendCorrectionIn } from "./decisions.js";
import type { Decision } from "./evaluation.js";
import type { RewardIntake } from "./intake.js";

export const COPY_ACTOR = "system:copy-rule";

interface EpochPost {
  contributionId: string;
  text: string;
  latest: Decision | undefined;
}

// Every first-time post of the epoch in acceptance order (server clock, then contribution id: the
// order the O6 selection uses) with its latest decision. A re-entry is the same work again, not a
// new post, so it never counts as the original or as a copy.
async function epochPosts(tx: Db, epochId: string): Promise<EpochPost[]> {
  const posts = await tx
    .select({ contributionId: rewardIntakes.contributionId, text: contributions.text })
    .from(rewardIntakes)
    .innerJoin(contributions, eq(contributions.id, rewardIntakes.contributionId))
    .where(and(eq(rewardIntakes.epochId, epochId), isNull(rewardIntakes.reentryOf)))
    .orderBy(asc(rewardIntakes.acceptedAt), asc(rewardIntakes.contributionId));
  const decisions = posts.length
    ? await tx
        .select()
        .from(rewardDecisions)
        .where(
          inArray(
            rewardDecisions.contributionId,
            posts.map((p) => p.contributionId),
          ),
        )
        .orderBy(asc(rewardDecisions.revision))
    : [];
  const latest = new Map(decisions.map((d) => [d.contributionId, d]));
  return posts.map((p) => ({ ...p, latest: latest.get(p.contributionId) }));
}

const earned = (post: EpochPost) => post.latest !== undefined && post.latest.pointUnits > 0n;

// The earlier post of the epoch this one copies, if that post earned points.
export async function originalOf(
  tx: Db,
  intake: RewardIntake,
  thresholdBps: number,
): Promise<{ contributionId: string } | undefined> {
  const posts = await epochPosts(tx, intake.epochId);
  const at = posts.findIndex((p) => p.contributionId === intake.contributionId);
  const self = posts[at];
  if (!self) return undefined;
  return firstCopyOf(self.text, posts.slice(0, at).filter(earned), thresholdBps);
}

export function withSpam(flags: readonly RewardFlag[]): RewardFlag[] {
  return [...new Set<RewardFlag>([...flags, "spam"])].sort();
}

export const copyExplanation = (originalContributionId: string, thresholdBps: number) =>
  `Copy: this post is at least ${thresholdBps / 100}% the same as contribution ${originalContributionId}, accepted earlier in this epoch, which earned points. Only the first earns.`;

// After an original earned points, every later post of the epoch that copies it and also earned
// points loses them, by a hashed correction successor like any other. This covers the case the
// copy was scored first; the other order is settled when the copy itself is scored.
export async function zeroLaterCopies(
  tx: Db,
  now: Date,
  intake: RewardIntake,
  thresholdBps: number,
): Promise<void> {
  const posts = await epochPosts(tx, intake.epochId);
  const at = posts.findIndex((p) => p.contributionId === intake.contributionId);
  const original = posts[at];
  if (!original) return;
  for (const post of posts.slice(at + 1)) {
    if (!earned(post) || !post.latest || !isCopy(post.text, original.text, thresholdBps)) continue;
    await appendCorrectionIn(tx, now, {
      communityId: intake.communityId,
      contributionId: post.contributionId,
      expectedRevision: post.latest.revision,
      changes: { flags: withSpam(post.latest.flags as RewardFlag[]) },
      reason: copyExplanation(original.contributionId, thresholdBps),
      evidenceRefs: [`contribution:${original.contributionId}`],
      actor: COPY_ACTOR,
      idempotencyKey: `copy-rule:${post.contributionId}:${post.latest.revision}`,
    });
  }
}
