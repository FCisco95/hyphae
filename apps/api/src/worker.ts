import { QUEUES, startQueue } from "./jobs/queue.js";
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

console.log(`worker: consuming ${Object.values(QUEUES).join(", ")}`);

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.once(sig, async () => {
    await boss.stop({ graceful: true, timeout: 20_000 });
    process.exit(0);
  });
}
