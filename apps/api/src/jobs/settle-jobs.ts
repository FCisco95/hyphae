import { db } from "../db.js";
import { env } from "../env.js";
import { dueSettles, settleCommunity } from "../payout/distribution-settle.js";
import { settleChainFromEnv } from "../payout/settle-chain.js";
import { boss, QUEUES } from "./queue.js";

// The settle loop's jobs: the recovery sweep queues one payout-settle job per community under a
// payout policy (one at a time per community, the queue's exclusive policy), and each job decides
// that community's next epoch or publishes its planned distribution.

export interface PayoutSettleJob {
  communityId: string;
}

// Built once per process; null leaves every settle job a logged no-op.
const chainOf = settleChainFromEnv(env);

const plain = (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value;

export async function enqueueDueSettles(): Promise<number> {
  const due = await dueSettles(db);
  for (const job of due) {
    await boss.send(QUEUES.payoutSettle, job satisfies PayoutSettleJob, {
      singletonKey: job.communityId,
    });
  }
  return due.length;
}

export async function settlePayouts(job: PayoutSettleJob): Promise<void> {
  if (!chainOf) {
    console.log(JSON.stringify({ job: "payout-settle", ...job, status: "chain_unconfigured" }));
    return;
  }
  const result = await settleCommunity(db, await chainOf(), job, {
    // A distribution that waits for a human is the operator's cue: the stored intent is ready
    // to be sent with the admin key.
    notify: async (planned) =>
      console.log(JSON.stringify({ job: "payout-settle", ...job, ...planned }, plain)),
  });
  console.log(JSON.stringify({ job: "payout-settle", ...job, ...result }, plain));
}
