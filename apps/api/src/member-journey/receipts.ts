import type { ContributionV1 } from "@hyphae/core";
import {
  communities,
  contributions,
  type Db,
  epochs,
  leaves,
  members,
  raidLifecycleEvents,
  raidSubmissionReceipts,
  raidSubmissionSessions,
  rewardIntakes,
  scoringRuns,
  submissionIssues,
  tasks,
} from "@hyphae/db";
import { and, desc, eq } from "drizzle-orm";
import { readContribution } from "../http/read-service.js";
import { dbClock, type RewardDeps } from "../rewards/config.js";
import { raidState } from "./lifecycle.js";

export const RECEIPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ISSUE_MAX_LENGTH = 1_000;
export const ISSUE_MAX_REPORTS = 3;
export const ISSUE_COOLDOWN_MS = 60_000;

// The receipt ID is a reference, never a credential. Check all immutable links as well as the
// current caller so a malformed cross-community row cannot disclose another member's work.
async function ownedReceipt(db: Db, receiptId: string, telegramUserId: bigint) {
  if (!RECEIPT_ID.test(receiptId) || telegramUserId <= 0n) return null;
  const [row] = await db
    .select({
      receipt: raidSubmissionReceipts,
      community: { name: communities.name, mint: communities.mint },
      task: tasks,
      contribution: { kind: contributions.kind, url: contributions.url },
      walletMethod: members.linkMethod,
    })
    .from(raidSubmissionReceipts)
    .innerJoin(
      members,
      and(
        eq(members.id, raidSubmissionReceipts.memberId),
        eq(members.communityId, raidSubmissionReceipts.communityId),
        eq(members.telegramUserId, telegramUserId),
      ),
    )
    .innerJoin(communities, eq(communities.id, raidSubmissionReceipts.communityId))
    .innerJoin(
      tasks,
      and(
        eq(tasks.id, raidSubmissionReceipts.taskId),
        eq(tasks.communityId, raidSubmissionReceipts.communityId),
      ),
    )
    .innerJoin(
      contributions,
      and(
        eq(contributions.id, raidSubmissionReceipts.contributionId),
        eq(contributions.communityId, raidSubmissionReceipts.communityId),
        eq(contributions.memberId, raidSubmissionReceipts.memberId),
        eq(contributions.taskId, raidSubmissionReceipts.taskId),
      ),
    )
    .innerJoin(
      raidSubmissionSessions,
      and(
        eq(raidSubmissionSessions.id, raidSubmissionReceipts.sessionId),
        eq(raidSubmissionSessions.communityId, raidSubmissionReceipts.communityId),
        eq(raidSubmissionSessions.taskId, raidSubmissionReceipts.taskId),
        eq(raidSubmissionSessions.telegramUserId, telegramUserId),
      ),
    )
    .where(eq(raidSubmissionReceipts.id, receiptId));
  return row ?? null;
}

export async function loadReceipt(
  db: Db,
  receiptId: string,
  telegramUserId: bigint,
  deps: RewardDeps = {},
) {
  const row = await ownedReceipt(db, receiptId, telegramUserId);
  if (!row) return null;
  const now = await (deps.clock ?? dbClock)(db, row.receipt.communityId);
  const audit = await readContribution(db, row.receipt.contributionId, now);
  if (
    audit &&
    (audit.member_id !== row.receipt.memberId || audit.community.mint !== row.community.mint)
  ) {
    throw new Error("receipt: reward intake disagrees with receipt scope");
  }
  const [legacy] = audit
    ? []
    : await db
        .select({ score: scoringRuns.score, reasoning: scoringRuns.reasoning })
        .from(scoringRuns)
        .where(eq(scoringRuns.contributionId, row.receipt.contributionId))
        .orderBy(desc(scoringRuns.createdAt), desc(scoringRuns.id))
        .limit(1);
  const [allocation] = audit
    ? await db
        .select({ amountLamports: leaves.amountLamports })
        .from(rewardIntakes)
        .innerJoin(
          epochs,
          and(
            eq(epochs.id, rewardIntakes.epochId),
            eq(epochs.communityId, row.receipt.communityId),
          ),
        )
        .innerJoin(
          leaves,
          and(eq(leaves.epochId, epochs.id), eq(leaves.memberId, row.receipt.memberId)),
        )
        .where(
          and(
            eq(rewardIntakes.contributionId, row.receipt.contributionId),
            eq(rewardIntakes.communityId, row.receipt.communityId),
            eq(rewardIntakes.memberId, row.receipt.memberId),
          ),
        )
    : [];
  const [cancelled] = await db
    .select({ action: raidLifecycleEvents.action })
    .from(raidLifecycleEvents)
    .where(
      and(
        eq(raidLifecycleEvents.taskId, row.task.id),
        eq(raidLifecycleEvents.communityId, row.receipt.communityId),
        eq(raidLifecycleEvents.action, "cancelled"),
      ),
    )
    .limit(1);
  return {
    ...row,
    raidState: raidState(row.task, cancelled, now),
    audit,
    legacy: legacy ?? null,
    allocation: allocation ?? null,
  };
}

export type MemberReceipt = NonNullable<Awaited<ReturnType<typeof loadReceipt>>>;

const clip = (value: string, limit: number) => {
  const text = value.replace(/[\p{Cc}\p{Cf}]/gu, " ");
  if (text.length <= limit) return text;
  let clipped = "";
  // Keep the UTF-16 length bound without splitting a supplementary Unicode character.
  for (const character of text) {
    if (clipped.length + character.length > limit - 1) break;
    clipped += character;
  }
  return `${clipped}…`;
};

function resultLines(audit: ContributionV1): string[] {
  const selected = audit.selected;
  const latest = audit.revisions.at(-1);
  const late =
    latest?.status === "late"
      ? [
          `Scored after cutoff: revision ${latest.revision}, quality ${latest.credited_quality}/100. This later result does not change the epoch's counted points.`,
        ]
      : [];
  if (selected) {
    const creditReason = {
      none: "",
      hard_zero: "A disqualifying guideline, spam or off-topic flag sets credit to zero.",
      ai_cap_mild: "AI-writing pattern flags limited the credited quality.",
      ai_cap_strong: "AI-writing pattern flags reduced quality below the credit floor.",
      below_floor: "Quality was below the minimum credit floor.",
    }[selected.credit_rule];
    return [
      `Scored: quality ${selected.credited_quality}/100 (raw ${selected.raw_quality}), revision ${selected.revision}.`,
      `Points: ${selected.points} ${audit.epoch.final ? "frozen" : audit.epoch.closed ? "at the scheduled cutoff; snapshot pending" : "provisional"}. Points are not SOL.`,
      selected.point_units === "0"
        ? "Scored; excluded from positive point credit (zero points). The decision remains in the epoch audit."
        : `Counted in ${audit.epoch.final ? "the frozen" : "the current"} epoch result; payout eligibility is separate.`,
      `Reason: ${clip(selected.explanation, 400)}${creditReason ? ` ${creditReason}` : ""}`,
      ...(selected.timing_bps < 10_000
        ? [`Timing multiplier: ${selected.timing_bps / 10_000}×.`]
        : []),
      ...late,
    ];
  }
  const reason =
    audit.state === "pending_reconciliation"
      ? "the evaluation was unresolved at the epoch cutoff and held for review"
      : audit.state === "excluded"
        ? "no scoring decision was accepted before the epoch cutoff"
        : audit.state === "pending_at_close"
          ? "scoring was still pending at the epoch cutoff"
          : "no accepted scoring decision yet";
  return [
    `${audit.epoch.closed ? "Excluded from this epoch's points" : "Pending scoring"}: ${reason}.`,
    ...(audit.epoch.final
      ? ["The frozen result is preserved; later scoring cannot change it."]
      : []),
    ...late,
  ];
}

export function receiptText(row: MemberReceipt, webBase = ""): string {
  const { receipt, audit } = row;
  const base = webBase.replace(/\/$/, "");
  return [
    `Received your ${row.contribution.kind} for ${clip(row.community.name, 80)}.`,
    `Receipt: ${receipt.id}`,
    `Received at: ${receipt.receivedAt.toISOString()}`,
    `Raid: ${row.task.id} (${row.raidState})`,
    `Target: ${clip(row.task.targetUrl ?? "not recorded", 250)}`,
    `Your submission: ${clip(row.contribution.url ?? "not recorded", 250)}`,
    "The existing scorer may post this result publicly in the group, replying to the raid message.",
    ...(audit
      ? resultLines(audit)
      : row.legacy
        ? [
            `Scored in the legacy lane: ${row.legacy.score}/100 credited quality.`,
            `Reason: ${clip(row.legacy.reasoning, 400)}`,
            "Reward points: unavailable; this work has no admitted reward epoch.",
          ]
        : [
            receipt.queueStatus === "queued"
              ? "Pending scoring: queue dispatch was requested; no scoring result is recorded."
              : "Pending dispatch: received, but scoring has not been confirmed as queued. Refresh this receipt; retry the same submission if this persists.",
          ]),
    ...(audit?.state === "pending"
      ? [
          receipt.queueStatus === "queued"
            ? "Dispatch requested; this does not confirm scoring completion."
            : "Dispatch has not been confirmed. Retry the same submission if this persists.",
        ]
      : []),
    "Target relation: unverified. The captured post does not prove its reply/quote target.",
    "X account ownership: unverified. A submitted handle or model opinion is not ownership proof.",
    "The approved human authorship attestation for the current payout still applies.",
    `Eligibility: separate wallet, rules, holder, authorship/duplicate and safety checks apply. ${row.walletMethod === "signature" ? "Your current wallet link is verified; eligibility at close is separate." : "Your current wallet link needs signature verification."}`,
    row.allocation
      ? `Recorded allocation for your whole epoch: ${row.allocation.amountLamports} lamports; not a payment confirmation.`
      : "Allocation: no member allocation is recorded for this submission's epoch.",
    "Claimability: not checked here; it requires verified on-chain publication. Payment: not verified here; only a confirmed claim receipt proves payment.",
    ...(base ? [`Audit: ${base}/x/${receipt.contributionId}`] : []),
    `Refresh: /receipt ${receipt.id}`,
    `Scoring issue: /issue ${receipt.id} <what seems wrong>`,
  ].join("\n");
}

export async function reportSubmissionIssue(
  db: Db,
  input: { receiptId: string; telegramUserId: bigint; telegramMessageId: number; text: string },
  deps: RewardDeps = {},
): Promise<
  | { status: "recorded" | "duplicate"; issueId: string }
  | { status: "invalid" }
  | { status: "not_found" }
  | { status: "limit" }
  | { status: "cooldown"; retryAfterSeconds: number }
> {
  const text = input.text.trim();
  if (
    !text ||
    text.length > ISSUE_MAX_LENGTH ||
    !Number.isSafeInteger(input.telegramMessageId) ||
    input.telegramMessageId <= 0
  )
    return { status: "invalid" };
  const owned = await ownedReceipt(db, input.receiptId, input.telegramUserId);
  if (!owned) return { status: "not_found" };
  return db.transaction(async (tx) => {
    // Only lock this receipt. Taking the shared reward/community lock after it would invert
    // private submission's lock order. All report writers serialize here before reading limits.
    await tx
      .select({ id: raidSubmissionReceipts.id })
      .from(raidSubmissionReceipts)
      .where(eq(raidSubmissionReceipts.id, owned.receipt.id))
      .for("update");
    const scoped = await ownedReceipt(tx, input.receiptId, input.telegramUserId);
    if (!scoped) return { status: "not_found" };
    const scope = and(
      eq(submissionIssues.receiptId, scoped.receipt.id),
      eq(submissionIssues.communityId, scoped.receipt.communityId),
      eq(submissionIssues.memberId, scoped.receipt.memberId),
    );
    const [existing] = await tx
      .select({ id: submissionIssues.id })
      .from(submissionIssues)
      .where(and(scope, eq(submissionIssues.telegramMessageId, input.telegramMessageId)));
    if (existing) return { status: "duplicate", issueId: existing.id };
    const reports = await tx
      .select({ createdAt: submissionIssues.createdAt })
      .from(submissionIssues)
      .where(scope)
      .orderBy(desc(submissionIssues.createdAt), desc(submissionIssues.id))
      .limit(ISSUE_MAX_REPORTS);
    if (reports.length >= ISSUE_MAX_REPORTS) return { status: "limit" };
    const now = await (deps.clock ?? dbClock)(tx, scoped.receipt.communityId);
    const latest = reports[0];
    const waitMs = latest ? latest.createdAt.getTime() + ISSUE_COOLDOWN_MS - now.getTime() : 0;
    if (waitMs > 0) return { status: "cooldown", retryAfterSeconds: Math.ceil(waitMs / 1_000) };
    const [created] = await tx
      .insert(submissionIssues)
      .values({
        receiptId: scoped.receipt.id,
        communityId: scoped.receipt.communityId,
        memberId: scoped.receipt.memberId,
        telegramMessageId: input.telegramMessageId,
        text,
        createdAt: now,
      })
      .returning({ id: submissionIssues.id });
    if (!created) throw new Error("issue: insert returned no report");
    return { status: "recorded", issueId: created.id };
  });
}
