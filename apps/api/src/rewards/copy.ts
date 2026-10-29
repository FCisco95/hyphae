import { type CopyKey, copyKey, isCopyKey, type RewardFlag } from "@hyphae/core";
import {
  contributions,
  type Db,
  epochs,
  rewardConfigs,
  rewardDecisions,
  rewardIntakes,
} from "@hyphae/db";
import { asc, eq, inArray } from "drizzle-orm";
import { RewardConfigPayload } from "./config.js";
import { appendCorrectionIn, baseOf, COPY_ACTOR } from "./decisions.js";
import type { Decision } from "./evaluation.js";

const withSpam = (flags: readonly RewardFlag[]): RewardFlag[] =>
  [...new Set<RewardFlag>([...flags, "spam"])].sort();

// Brings the epoch to the one result the rule defines, whatever order the posts were scored in
// and whatever corrections came since. Walk the epoch's posts in acceptance order (server clock,
// then contribution id: the order the O6 selection uses). A post earns when it would earn without
// the rule (its base decision has points) and is not a copy of an earlier post that earns. Where
// the epoch's decisions differ from that, a successor by COPY_ACTOR zeroes a copy or lifts the zero.
//
// Runs inside a reward write that holds the community lock. Epochs whose pinned configuration has
// no copy rule, and decisions that no longer count toward the allocation, are left alone.
export async function reconcileCopies(
  tx: Db,
  now: Date,
  communityId: string,
  epochId: string,
): Promise<void> {
  const [epoch] = await tx
    .select({ closesAt: epochs.closesAt, configId: epochs.rewardConfigId })
    .from(epochs)
    .where(eq(epochs.id, epochId));
  if (!epoch?.configId || now.getTime() >= epoch.closesAt.getTime()) return;
  const [config] = await tx
    .select({ payload: rewardConfigs.payload })
    .from(rewardConfigs)
    .where(eq(rewardConfigs.id, epoch.configId));
  const rule = config && RewardConfigPayload.parse(config.payload).copy;
  if (!rule) return;

  // A re-entry is a post of this epoch like any other: it carries new text and earns points here.
  const intakes = await tx
    .select({ contributionId: rewardIntakes.contributionId, text: contributions.text })
    .from(rewardIntakes)
    .innerJoin(contributions, eq(contributions.id, rewardIntakes.contributionId))
    .where(eq(rewardIntakes.epochId, epochId))
    .orderBy(asc(rewardIntakes.acceptedAt), asc(rewardIntakes.contributionId));
  if (intakes.length === 0) return;
  const decisions = await tx
    .select()
    .from(rewardDecisions)
    .where(
      inArray(
        rewardDecisions.contributionId,
        intakes.map((i) => i.contributionId),
      ),
    )
    .orderBy(asc(rewardDecisions.revision));
  const lineages = new Map<string, Decision[]>();
  for (const d of decisions)
    lineages.set(d.contributionId, [...(lineages.get(d.contributionId) ?? []), d]);

  const keepers: { contributionId: string; key: CopyKey }[] = [];
  const posts: { contributionId: string; lineage: Decision[]; original: string | null }[] = [];
  for (const { contributionId, text } of intakes) {
    const lineage = lineages.get(contributionId);
    const base = lineage && baseOf(lineage);
    if (!lineage || !base) continue; // not scored yet: it earns nothing and blocks nothing
    if (base.pointUnits <= 0n) {
      posts.push({ contributionId, lineage, original: null });
      continue;
    }
    const key = copyKey(text);
    const original = keepers.find((k) => isCopyKey(key, k.key, rule.thresholdBps));
    if (!original) keepers.push({ contributionId, key });
    posts.push({ contributionId, lineage, original: original?.contributionId ?? null });
  }

  for (const { contributionId, lineage, original } of posts) {
    const latest = lineage[lineage.length - 1] as Decision;
    const base = baseOf(lineage) as Decision;
    const zeroed =
      latest.correctionActor === COPY_ACTOR && latest.pointUnits === 0n && base.pointUnits > 0n;
    if (original && !zeroed) {
      await appendCorrectionIn(tx, now, {
        communityId,
        contributionId,
        expectedRevision: latest.revision,
        changes: { flags: withSpam(base.flags as RewardFlag[]) },
        reason: `Copy: this post is at least ${rule.thresholdBps / 100}% the same as contribution ${original}, accepted earlier in this epoch, which earned points. Only the first earns.`,
        evidenceRefs: [`contribution:${original}`],
        actor: COPY_ACTOR,
        idempotencyKey: `copy-rule:${contributionId}:${latest.revision}`,
      });
    } else if (!original && zeroed) {
      await appendCorrectionIn(tx, now, {
        communityId,
        contributionId,
        expectedRevision: latest.revision,
        changes: { flags: base.flags as RewardFlag[] },
        reason:
          "Copy rule lifted: the earlier post this one copied no longer earns points, so this post earns its own points.",
        evidenceRefs: [`contribution:${contributionId}`],
        actor: COPY_ACTOR,
        idempotencyKey: `copy-rule:${contributionId}:${latest.revision}`,
      });
    }
  }
}
