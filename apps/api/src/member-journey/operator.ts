import {
  communities,
  contributions,
  type Db,
  raidAnnouncements,
  raidDeliveries,
  raidLifecycleEvents,
  raidSubmissionReceipts,
  rewardDecisions,
  rewardDispatches,
  rewardNominations,
  scoringRuns,
  submissionIssues,
  tasks,
} from "@hyphae/db";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { COMMUNITY_ID } from "../raid-alerts/alerts.js";
import type { RaidState } from "./lifecycle.js";

export type OperatorSummary = {
  communityId: string;
  communityName: string;
  observedAt: Date;
  raids: { state: RaidState; count: number }[];
  activeRaids: { id: string; targetUrl: string | null; closesAt: Date }[];
  deliveries: { status: string; count: number }[];
  deliveryProblems: { status: string; reason: string | null; count: number }[];
  unscoredContributions: number;
  unqueuedReceipts: number;
  pendingNominations: { state: string; count: number }[];
  issues: {
    count: number;
    recent: { id: string; receiptId: string; reason: string }[];
  };
  jobs:
    | { status: "unavailable" }
    | {
        status: "available";
        groups: { name: string; state: string; count: number }[];
        legacyJobsWithUnknownAttempts: number;
      };
  spend: {
    scoringMicroUsd: bigint;
    rewardMicroUsd: bigint;
    recordedMicroUsd: bigint;
    unresolvedRewardCalls: number;
    zeroCostRecords: number;
  };
};

// The queue has retention, and legacy scoring has no pre-call dispatch ledger. These rows
// can identify operational trouble, but cannot reconstruct a complete provider invoice.
async function readJobs(db: Db, communityId: string): Promise<OperatorSummary["jobs"]> {
  const scope = sql`(
    (j.name = 'score' and exists (
      select 1 from ${contributions} c
      where c.id::text = j.data->>'contributionId' and c.community_id = ${communityId}
    )) or (
      j.name in ('reward-evaluation', 'reward-retrieval', 'reward-notify', 'reward-close', 'hold-check')
      and j.data->>'communityId' = ${communityId}
    )
  )`;
  try {
    // Nested transactions use a savepoint, so optional telemetry cannot abort the caller's
    // transaction. Direct calls get a read-only transaction for these two queue reads.
    return await db.transaction(
      async (tx) => {
        const groups = await tx
          .select({
            name: sql<string>`j.name`,
            state: sql<string>`j.state::text`,
            count: count(),
          })
          .from(sql`pgboss.job j`)
          .where(scope)
          .groupBy(sql`j.name`, sql`j.state`);
        const [uncertain] = await tx
          .select({ count: count() })
          .from(sql`pgboss.job j`)
          .where(
            sql`${scope} and j.name = 'score' and (j.retry_count > 0 or j.state::text in ('active', 'failed'))`,
          );
        return {
          status: "available" as const,
          groups,
          legacyJobsWithUnknownAttempts: uncertain?.count ?? 0,
        };
      },
      { accessMode: "read only" },
    );
  } catch {
    // Missing queue schema, permissions or a query outage must never look like zero failures.
    return { status: "unavailable" };
  }
}

export async function readOperatorSummary(
  db: Db,
  input: { communityId: string; actorId: bigint },
  now = new Date(),
): Promise<{ status: "unauthorized" } | { status: "ok"; summary: OperatorSummary }> {
  if (!COMMUNITY_ID.test(input.communityId) || input.actorId <= 0n)
    return { status: "unauthorized" };
  const authorized = () =>
    db
      .select({ id: communities.id, name: communities.name })
      .from(communities)
      .where(
        and(
          eq(communities.id, input.communityId),
          eq(communities.adminTelegramUserId, input.actorId),
        ),
      );
  const [community] = await authorized();
  if (!community) return { status: "unauthorized" };
  const communityId = community.id;
  const raidState = sql<RaidState>`case
    when exists (select 1 from ${raidLifecycleEvents} e where e.task_id = ${tasks}.${sql.identifier("id")}
      and e.community_id = ${communityId} and e.action = 'cancelled') then 'cancelled'
    when ${tasks.status} = 'closed' then 'closed'
    when ${tasks.status} = 'open' and ${tasks.closesAt} <= ${now.toISOString()}::timestamptz then 'expired'
    when ${tasks.status} = 'open' and ${tasks.opensAt} > ${now.toISOString()}::timestamptz then 'upcoming'
    when ${tasks.status} = 'open' then 'active'
    else ${tasks.status}::text end`;
  const raids = await db
    .select({ state: raidState, count: count() })
    .from(tasks)
    .where(and(eq(tasks.communityId, communityId), eq(tasks.kind, "raid")))
    .groupBy(sql`1`);
  const activeRaids = await db
    .select({ id: tasks.id, targetUrl: tasks.targetUrl, closesAt: tasks.closesAt })
    .from(tasks)
    .where(
      and(eq(tasks.communityId, communityId), eq(tasks.kind, "raid"), sql`${raidState} = 'active'`),
    )
    .orderBy(desc(tasks.createdAt))
    .limit(5);
  const deliveries = await db
    .select({ status: raidDeliveries.status, count: count() })
    .from(raidDeliveries)
    .innerJoin(raidAnnouncements, eq(raidAnnouncements.id, raidDeliveries.announcementId))
    .where(eq(raidAnnouncements.communityId, communityId))
    .groupBy(raidDeliveries.status);
  const deliveryProblems = await db
    .select({ status: raidDeliveries.status, reason: raidDeliveries.reason, count: count() })
    .from(raidDeliveries)
    .innerJoin(raidAnnouncements, eq(raidAnnouncements.id, raidDeliveries.announcementId))
    .where(
      and(
        eq(raidAnnouncements.communityId, communityId),
        sql`${raidDeliveries.status} in ('failed', 'uncertain')`,
      ),
    )
    .groupBy(raidDeliveries.status, raidDeliveries.reason)
    .orderBy(desc(count()))
    .limit(5);
  const [backlog] = await db
    .select({ count: count() })
    .from(contributions)
    .where(
      and(
        eq(contributions.communityId, communityId),
        sql`not exists (select 1 from ${scoringRuns} s where s.contribution_id = ${contributions.id})`,
        sql`not exists (select 1 from ${rewardDecisions} d where d.contribution_id = ${contributions.id}
          and d.community_id = ${communityId})`,
      ),
    );
  const [unqueued] = await db
    .select({ count: count() })
    .from(raidSubmissionReceipts)
    .where(
      and(
        eq(raidSubmissionReceipts.communityId, communityId),
        eq(raidSubmissionReceipts.queueStatus, "pending"),
      ),
    );
  const pendingNominations = await db
    .select({ state: rewardNominations.state, count: count() })
    .from(rewardNominations)
    .where(
      and(
        eq(rewardNominations.communityId, communityId),
        sql`${rewardNominations.state} in ('pending_evidence', 'ready', 'evaluating', 'pending_reconciliation')`,
      ),
    )
    .groupBy(rewardNominations.state);
  const issueReceipt = and(
    eq(raidSubmissionReceipts.id, submissionIssues.receiptId),
    eq(raidSubmissionReceipts.communityId, submissionIssues.communityId),
    eq(raidSubmissionReceipts.memberId, submissionIssues.memberId),
  );
  const [issueCount] = await db
    .select({ count: count() })
    .from(submissionIssues)
    .innerJoin(raidSubmissionReceipts, issueReceipt)
    .where(eq(submissionIssues.communityId, communityId));
  const recentIssues = await db
    .select({
      id: submissionIssues.id,
      receiptId: submissionIssues.receiptId,
      reason: sql<string>`left(${submissionIssues.text}, 80)`,
    })
    .from(submissionIssues)
    .innerJoin(raidSubmissionReceipts, issueReceipt)
    .where(eq(submissionIssues.communityId, communityId))
    .orderBy(desc(submissionIssues.createdAt), desc(submissionIssues.id))
    .limit(3);
  // Aggregate each call ledger independently. Joining runs, dispatches and decisions would
  // multiply costs; a decision/correction is not another model call.
  const [scoringSpend] = await db
    .select({
      cost: sql`coalesce(sum(${scoringRuns.costMicroUsd}), 0)::text`.mapWith(String),
      zero: sql`count(*) filter (where ${scoringRuns.costMicroUsd} = 0)`.mapWith(Number),
    })
    .from(scoringRuns)
    .innerJoin(contributions, eq(contributions.id, scoringRuns.contributionId))
    .where(eq(contributions.communityId, communityId));
  const [rewardSpend] = await db
    .select({
      cost: sql`coalesce(sum(${rewardDispatches.costMicroUsd}), 0)::text`.mapWith(String),
      unknown: sql`count(*) filter (where ${rewardDispatches.costMicroUsd} is null)`.mapWith(
        Number,
      ),
      zero: sql`count(*) filter (where ${rewardDispatches.costMicroUsd} = 0)`.mapWith(Number),
    })
    .from(rewardDispatches)
    .where(
      and(
        eq(rewardDispatches.communityId, communityId),
        sql`${rewardDispatches.state} <> 'not_sent_proven'`,
      ),
    );
  const jobs = await readJobs(db, communityId);
  // A role changed while collecting the summary must not receive the completed response.
  if (!(await authorized())[0]) return { status: "unauthorized" };
  const scoringMicroUsd = BigInt(scoringSpend?.cost ?? "0");
  const rewardMicroUsd = BigInt(rewardSpend?.cost ?? "0");
  return {
    status: "ok",
    summary: {
      communityId,
      communityName: community.name,
      observedAt: now,
      raids,
      activeRaids,
      deliveries,
      deliveryProblems,
      unscoredContributions: backlog?.count ?? 0,
      unqueuedReceipts: unqueued?.count ?? 0,
      pendingNominations,
      issues: { count: issueCount?.count ?? 0, recent: recentIssues },
      jobs,
      spend: {
        scoringMicroUsd,
        rewardMicroUsd,
        recordedMicroUsd: scoringMicroUsd + rewardMicroUsd,
        unresolvedRewardCalls: rewardSpend?.unknown ?? 0,
        zeroCostRecords: (scoringSpend?.zero ?? 0) + (rewardSpend?.zero ?? 0),
      },
    },
  };
}

const usd = (micro: bigint) =>
  `$${micro / 1_000_000n}.${(micro % 1_000_000n).toString().padStart(6, "0")}`;
const safeLine = (value: string, length: number) => {
  const text = value.replace(/[\p{Cc}\p{Cf}]/gu, " ");
  if (text.length <= length) return text;
  let clipped = "";
  // Preserve the UTF-16 budget without splitting a supplementary Unicode character.
  for (const character of text) {
    if (clipped.length + character.length > length - 1) break;
    clipped += character;
  }
  return `${clipped}…`;
};

export function operatorMessage(s: OperatorSummary): string {
  const countState = (rows: { state: string; count: number }[], state: string) =>
    rows.find((r) => r.state === state)?.count ?? 0;
  const delivery = s.deliveries.map((r) => ({ state: r.status, count: r.count }));
  const jobCount = (state: string) =>
    s.jobs.status === "available"
      ? s.jobs.groups.filter((j) => j.state === state).reduce((n, j) => n + j.count, 0)
      : 0;
  return [
    `Operator view: ${safeLine(s.communityName, 100)}`,
    `Community: ${s.communityId}`,
    `Observed ${s.observedAt.toISOString()} · read only`,
    `Raids: active ${countState(s.raids, "active")}, expired ${countState(s.raids, "expired")}, closed ${countState(s.raids, "closed")}, cancelled ${countState(s.raids, "cancelled")}, upcoming ${countState(s.raids, "upcoming")}.`,
    countState(s.raids, "active") > 1
      ? "Attention: more than one active brief; inspect before opening another."
      : "",
    ...s.activeRaids.map(
      (r) =>
        `Active ${r.id} until ${r.closesAt.toISOString()}\n${safeLine(r.targetUrl ?? "Target unavailable", 200)}`,
    ),
    countState(s.raids, "active") > s.activeRaids.length
      ? "Showing the five most recent active raids."
      : "",
    `Private deliveries: failed ${countState(delivery, "failed")}, uncertain ${countState(delivery, "uncertain")}, pending ${countState(delivery, "pending")}, sending ${countState(delivery, "sending")}, sent ${countState(delivery, "sent")}, skipped ${countState(delivery, "skipped")}.`,
    ...s.deliveryProblems.map(
      (r) => `  ${r.status}: ${safeLine(r.reason ?? "Reason unavailable", 60)} (${r.count})`,
    ),
    "Uncertain sends may have arrived; this view does not resend them.",
    `Scoring backlog: ${s.unscoredContributions} saved contributions without a score/decision; ${s.unqueuedReceipts} private receipts awaiting queue confirmation.`,
    `Effort nominations: evidence pending ${countState(s.pendingNominations, "pending_evidence")}, ready ${countState(s.pendingNominations, "ready")}, evaluating ${countState(s.pendingNominations, "evaluating")}, reconciliation pending ${countState(s.pendingNominations, "pending_reconciliation")}.`,
    `Scoring issue reports: ${s.issues.count} saved; latest ${s.issues.recent.length} shown. Reports do not change scores.`,
    ...s.issues.recent.map(
      (issue) => `Issue ${issue.id} · receipt ${issue.receiptId}: ${safeLine(issue.reason, 80)}`,
    ),
    s.jobs.status === "unavailable"
      ? "Jobs: telemetry unavailable. Failed-job count is unknown."
      : `Retained jobs: failed ${jobCount("failed")}, retrying ${jobCount("retry")}, running ${jobCount("active")}, waiting ${jobCount("created")}.\nFailed by queue: ${
          s.jobs.groups
            .filter((j) => j.state === "failed")
            .map((j) => `${j.name} ${j.count}`)
            .join(", ") || "none retained"
        }.\nLegacy scoring jobs with untracked possible attempts: ${s.jobs.legacyJobsWithUnknownAttempts}.`,
    `Recorded model cost estimate: ${usd(s.spend.recordedMicroUsd)} (scoring ${usd(s.spend.scoringMicroUsd)}, rewards ${usd(s.spend.rewardMicroUsd)}).`,
    `Unknown cost: ${s.spend.unresolvedRewardCalls} unresolved reward calls; ${s.spend.zeroCostRecords} zero-cost records may lack usage.`,
    "All-time database records; jobs cover retained, attributable rows only. Historical attempts and partial usage may be unrecorded. This is not a provider invoice or a spend limit.",
  ]
    .filter(Boolean)
    .join("\n");
}
