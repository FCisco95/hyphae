import { PgBoss } from "pg-boss";
import { env } from "../env.js";

export const QUEUES = {
  score: "score",
  rewardEvaluation: "reward-evaluation",
  rewardRetrieval: "reward-retrieval",
  rewardNotify: "reward-notify",
  rewardRecovery: "reward-recovery",
  rewardClose: "reward-close",
} as const;

export const boss = new PgBoss({
  connectionString: env.DATABASE_URL,
  schema: "pgboss",
  application_name: "hyphae",
});
boss.on("error", (err) => console.error("pg-boss", err));

export async function startQueue() {
  await boss.start();
  // Every model call is money: few retries, backed off, and a job that hangs on a provider
  // outage is released after two minutes instead of pg-boss's 15-minute default.
  await boss.createQueue(QUEUES.score, {
    retryLimit: 3,
    retryDelay: 5,
    retryBackoff: true,
    expireInSeconds: 120,
  });
  // A reward evaluation job never calls the provider twice (runEvaluation), so pg-boss retries are
  // safe; expiry exceeds the 90 s call timeout so a live call is not failed underneath itself.
  await boss.createQueue(QUEUES.rewardEvaluation, {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 180,
  });
  await boss.createQueue(QUEUES.rewardRetrieval, { retryLimit: 2, expireInSeconds: 60 });
  // Telegram delivery retries on its own; a failed message never re-runs scoring.
  await boss.createQueue(QUEUES.rewardNotify, {
    retryLimit: 5,
    retryDelay: 10,
    retryBackoff: true,
    expireInSeconds: 30,
  });
  // A failed sweep is not retried: the next scheduled run repeats it.
  await boss.createQueue(QUEUES.rewardRecovery, { retryLimit: 0, expireInSeconds: 60 });
  // Close is idempotent and must happen: retry until it does, and the sweep re-sends it anyway.
  await boss.createQueue(QUEUES.rewardClose, {
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 120,
  });
  return boss;
}
