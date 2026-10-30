import {
  type CopyKey,
  copyKey,
  editCopyVerdict,
  quickCopyVerdict,
  type RewardFlag,
} from "@hyphae/core";
import {
  contributions,
  type Db,
  epochs,
  rewardConfigs,
  rewardDecisions,
  rewardIntakes,
} from "@hyphae/db";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { RewardConfigPayload, type RewardDeps, withCommunityLock } from "./config.js";
import { appendCorrectionIn, baseOf, COPY_ACTOR } from "./decisions.js";
import type { Decision } from "./evaluation.js";

const withSpam = (flags: readonly RewardFlag[]): RewardFlag[] =>
  [...new Set<RewardFlag>([...flags, "spam"])].sort();

interface Post {
  contributionId: string;
  key: CopyKey;
}

// Brings the epoch to the one result the rule defines, whatever order the posts were scored in
// and whatever corrections came since. Walk the epoch's posts in acceptance order (server clock,
// then contribution id: the order the O6 selection uses). A post earns when it would earn without
// the rule (its base decision has points) and is not a copy of an earlier post that earns. Where
// the epoch's decisions differ from that, a successor by COPY_ACTOR zeroes a copy or lifts the zero.
//
// Runs inside a reward write that holds the community lock. Epochs whose pinned configuration has
// no copy rule, and decisions that no longer count toward the allocation, are left alone. Every
// run settles the whole epoch; edit-distance work is capped by the normalized-character limit.
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
  for (const d of decisions) {
    lineages.set(d.contributionId, [...(lineages.get(d.contributionId) ?? []), d]);
  }

  const keepers: Post[] = [];
  const settled: { contributionId: string; lineage: Decision[]; original: string | null }[] = [];
  for (const { contributionId, text } of intakes) {
    const lineage = lineages.get(contributionId);
    const base = lineage && baseOf(lineage);
    if (!lineage || !base) continue; // not scored yet: it earns nothing and blocks nothing
    if (base.pointUnits <= 0n) {
      settled.push({ contributionId, lineage, original: null });
      continue;
    }
    const key = copyKey(text);
    const post: Post = { contributionId, key };
    let original: Post | undefined;
    for (const keeper of keepers) {
      const verdict =
        quickCopyVerdict(post.key, keeper.key, rule.thresholdBps) ??
        editCopyVerdict(post.key, keeper.key, rule.thresholdBps);
      if (verdict) {
        original = keeper;
        break;
      }
    }
    if (!original) keepers.push(post);
    settled.push({ contributionId, lineage, original: original?.contributionId ?? null });
  }

  for (const { contributionId, lineage, original } of settled) {
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
        reason: `Copy: this post is at least ${rule.thresholdBps / 100}% the same as an earlier post of this epoch that earned points. Only the first earns.`,
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
          "Copy rule lifted: the earlier post this one copied no longer earns points, so this post earns its own.",
        evidenceRefs: [`contribution:${contributionId}`],
        actor: COPY_ACTOR,
        idempotencyKey: `copy-rule:${contributionId}:${latest.revision}`,
      });
    }
  }
}

// Open epochs whose pinned configuration carries the copy rule: the recovery sweep reconciles
// them, catching up posts scored before a deployment and sending the members' messages.
export async function openCopyEpochs(db: Db, now: Date) {
  return db
    .select({ communityId: epochs.communityId, epochId: epochs.id })
    .from(epochs)
    .innerJoin(rewardConfigs, eq(rewardConfigs.id, epochs.rewardConfigId))
    .where(
      and(
        eq(epochs.status, "open"),
        gt(epochs.closesAt, now),
        sql`${rewardConfigs.payload} -> 'copy' is not null`,
      ),
    );
}

export const reconcileEpoch = (
  db: Db,
  input: { communityId: string; epochId: string },
  deps: RewardDeps = {},
) =>
  withCommunityLock(db, input.communityId, deps, (tx, _community, now) =>
    reconcileCopies(tx, now, input.communityId, input.epochId),
  );
