import { PgBoss } from "pg-boss";
import { env } from "../env.js";

export const QUEUES = { score: "score" } as const;

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
  return boss;
}
