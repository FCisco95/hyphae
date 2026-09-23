import { communities, contributions, rewardNominations } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { bot } from "../bot/index.js";
import { db } from "../db.js";
import { env } from "../env.js";
import { type EvaluationTarget, type RunResult, runEvaluation } from "../rewards/evaluation.js";
import { strandedWork } from "../rewards/recovery.js";
import { recordRetrieval } from "../rewards/slots.js";
import { defaultModel } from "../scoring/default-model.js";
import { callRewardModel, REWARD_CALL_TIMEOUT_MS } from "../scoring/run.js";
import { captureLimitations, fetchPost } from "../x/oembed.js";
import { boss, QUEUES } from "./queue.js";
import { type RewardOutcome, rewardMessage } from "./reward-message.js";

export interface RewardEvaluationJob {
  communityId: string;
  target: EvaluationTarget;
}
export interface RewardRetrievalJob {
  communityId: string;
  nominationId: string;
  round: number;
}
export interface RewardNotifyJob {
  communityId: string;
  contributionId: string;
  text: string;
}

// Longer than one provider call can take, so an older dispatch cannot be a live call.
const RECONCILIATION_HORIZON_MS = REWARD_CALL_TIMEOUT_MS + 3.5 * 60_000;
// O2: round 2 one minute after round 1, round 3 five minutes after round 2.
export const RETRIEVAL_DELAY_SECONDS: Record<number, number> = { 2: 60, 3: 300 };

// Duplicate jobs are harmless: the dispatch and retrieval rows, not the queue, make these
// idempotent, so the queues keep pg-boss's standard policy.
export const sendEvaluation = (job: RewardEvaluationJob, startAfter?: number) =>
  boss.send(QUEUES.rewardEvaluation, job, startAfter ? { startAfter } : {});

export const sendRetrieval = (job: RewardRetrievalJob) =>
  boss.send(QUEUES.rewardRetrieval, job, {
    startAfter: RETRIEVAL_DELAY_SECONDS[job.round] ?? 60,
  });

async function contributionOf(target: EvaluationTarget): Promise<string> {
  if ("contributionId" in target) return target.contributionId;
  const [row] = await db
    .select({ contributionId: rewardNominations.contributionId })
    .from(rewardNominations)
    .where(eq(rewardNominations.id, target.nominationId));
  if (!row) throw new Error(`reward: nomination ${target.nominationId} missing`);
  return row.contributionId;
}

function outcomeOf(result: RunResult): RewardOutcome | null {
  if (result.status === "completed") return result.created ? result : null;
  if (result.status === "pending_evidence") return result;
  if (result.status === "pending_reconciliation") return { status: "pending_reconciliation" };
  return null;
}

export async function evaluateReward(job: RewardEvaluationJob): Promise<void> {
  const result = await runEvaluation(db, job, {
    model: defaultModel.id,
    horizonMs: RECONCILIATION_HORIZON_MS,
    call: (prompt, purpose) => callRewardModel(prompt, purpose, defaultModel),
  });
  console.log(JSON.stringify({ job: "reward-evaluation", ...job, status: result.status }));
  if (result.status === "in_flight") {
    await sendEvaluation(job, Math.ceil(result.recheckAfterMs / 1000));
    return;
  }
  const outcome = outcomeOf(result);
  if (!outcome) return;
  const contributionId = await contributionOf(job.target);
  await boss.send(QUEUES.rewardNotify, {
    communityId: job.communityId,
    contributionId,
    text: rewardMessage(outcome, `${env.PUBLIC_WEB_URL}/x/${contributionId}`),
  } satisfies RewardNotifyJob);
}

export async function retrieveEvidence(job: RewardRetrievalJob): Promise<void> {
  const [row] = await db
    .select({ url: contributions.url })
    .from(rewardNominations)
    .innerJoin(contributions, eq(contributions.id, rewardNominations.contributionId))
    .where(eq(rewardNominations.id, job.nominationId));
  if (!row) throw new Error(`reward: nomination ${job.nominationId} missing`);
  const limitations = row.url ? captureLimitations(await fetchPost(row.url)) : [];
  const result = await recordRetrieval(db, { ...job, limitations });
  console.log(JSON.stringify({ job: "reward-retrieval", ...job, status: result.status }));
  if (result.status === "ready") {
    await sendEvaluation({
      communityId: job.communityId,
      target: { nominationId: job.nominationId },
    });
  } else if (result.status === "pending" && result.nextRound) {
    await sendRetrieval({ ...job, round: result.nextRound });
  }
}

// Longer than the reconciliation horizon and the last retrieval delay, so the sweep does not
// duplicate a job that is merely waiting.
const RECOVERY_GRACE_MS = 10 * 60_000;

// Scheduled sweep: re-queues work whose queue insert was lost after its commit (F1, F2). The
// jobs it sends are sent without delay; each one re-checks its state under the community lock.
export async function recoverRewardWork(): Promise<void> {
  const work = await strandedWork(db, { now: new Date(), graceMs: RECOVERY_GRACE_MS });
  for (const job of work.evaluations) await sendEvaluation(job);
  for (const job of work.retrievals) await boss.send(QUEUES.rewardRetrieval, job);
  console.log(
    JSON.stringify({
      job: "reward-recovery",
      evaluations: work.evaluations.length,
      retrievals: work.retrievals.length,
    }),
  );
}

export async function notifyReward(job: RewardNotifyJob): Promise<void> {
  const [row] = await db
    .select({
      chatId: communities.telegramChatId,
      messageId: contributions.telegramMessageId,
    })
    .from(contributions)
    .innerJoin(communities, eq(communities.id, contributions.communityId))
    .where(eq(contributions.id, job.contributionId));
  if (!row) throw new Error(`reward: contribution ${job.contributionId} missing`);
  await bot.api.sendMessage(Number(row.chatId), job.text, {
    reply_parameters: { message_id: row.messageId, allow_sending_without_reply: true },
    link_preview_options: { is_disabled: true },
  });
}
