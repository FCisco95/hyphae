import { type CopyKey, copyKey, isCopyKey, type RewardFlag, sha256Hex } from "@hyphae/core";
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

// A pair of posts is compared once per process: the answer depends on the two texts and the
// threshold only. Keyed by the hash of each normalized text, never by the text.
const PAIR_CACHE_LIMIT = 50_000;
const verdicts = new Map<string, boolean>();

interface Post {
  contributionId: string;
  key: CopyKey;
  hash: string;
}

// The most time one reconciliation spends comparing posts while it holds the community lock. It
// stops between pairs, never inside one, and always completes at least one new pair, so repeated
// runs make progress and finish.
export const RECONCILE_BUDGET_MS = 2_000;

// Brings the epoch to the one result the rule defines, whatever order the posts were scored in
// and whatever corrections came since. Walk the epoch's posts in acceptance order (server clock,
// then contribution id: the order the O6 selection uses). A post earns when it would earn without
// the rule (its base decision has points) and is not a copy of an earlier post that earns. Where
// the epoch's decisions differ from that, a successor by COPY_ACTOR zeroes a copy or lifts the zero.
//
// Runs inside a reward write that holds the community lock. Epochs whose pinned configuration has
// no copy rule, and decisions that no longer count toward the allocation, are left alone. When the
// comparison budget runs out the posts reached so far are settled and the rest wait for the next
// run (every reward write runs one, and so does the recovery sweep).
export async function reconcileCopies(
  tx: Db,
  now: Date,
  communityId: string,
  epochId: string,
  options: { budgetMs?: number } = {},
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

  const deadline = Date.now() + (options.budgetMs ?? RECONCILE_BUDGET_MS);
  let compared = 0;
  const keepers: Post[] = [];
  const settled: { contributionId: string; lineage: Decision[]; original: string | null }[] = [];
  walk: for (const { contributionId, text } of intakes) {
    const lineage = lineages.get(contributionId);
    const base = lineage && baseOf(lineage);
    if (!lineage || !base) continue; // not scored yet: it earns nothing and blocks nothing
    if (base.pointUnits <= 0n) {
      settled.push({ contributionId, lineage, original: null });
      continue;
    }
    const key = copyKey(text);
    const post: Post = { contributionId, key, hash: sha256Hex(key.text) };
    let original: Post | undefined;
    for (const keeper of keepers) {
      const cacheKey = `${post.hash}:${keeper.hash}:${rule.thresholdBps}`;
      let verdict = verdicts.get(cacheKey);
      if (verdict === undefined) {
        if (compared > 0 && Date.now() >= deadline) break walk;
        compared++;
        verdict = isCopyKey(post.key, keeper.key, rule.thresholdBps);
        if (verdicts.size >= PAIR_CACHE_LIMIT) verdicts.clear();
        verdicts.set(cacheKey, verdict);
      }
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
// them, which settles whatever a budget-limited run left and sends the members' messages.
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
