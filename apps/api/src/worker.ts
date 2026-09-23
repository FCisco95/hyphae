import { QUEUES, startQueue } from "./jobs/queue.js";
import {
  evaluateReward,
  notifyReward,
  type RewardEvaluationJob,
  type RewardNotifyJob,
  type RewardRetrievalJob,
  retrieveEvidence,
} from "./jobs/reward-jobs.js";
import { notifyScoringFailed, type ScoreJob, scoreContribution } from "./jobs/score.js";

const boss = await startQueue();

const workOptions = { batchSize: 1, includeMetadata: true } as const;
await boss.work<ScoreJob, unknown, typeof workOptions>(QUEUES.score, workOptions, async ([job]) => {
  if (!job) return;
  try {
    await scoreContribution(job.data);
  } catch (err) {
    console.error("score: failed", { job: job.id, attempt: job.retryCount + 1, err });
    if (job.retryCount >= job.retryLimit) {
      await notifyScoringFailed(job.data.contributionId).catch(() => {});
    }
    throw err;
  }
});

await boss.work<RewardEvaluationJob>(QUEUES.rewardEvaluation, { batchSize: 1 }, async ([job]) => {
  if (job) await evaluateReward(job.data);
});
await boss.work<RewardRetrievalJob>(QUEUES.rewardRetrieval, { batchSize: 1 }, async ([job]) => {
  if (job) await retrieveEvidence(job.data);
});
await boss.work<RewardNotifyJob>(QUEUES.rewardNotify, { batchSize: 1 }, async ([job]) => {
  if (job) await notifyReward(job.data);
});

console.log(`worker: consuming ${Object.values(QUEUES).join(", ")}`);

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.once(sig, async () => {
    await boss.stop({ graceful: true, timeout: 20_000 });
    process.exit(0);
  });
}
