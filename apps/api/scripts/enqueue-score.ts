// Usage: node --env-file=<abs .env> --import tsx scripts/enqueue-score.ts <contributionId> [--force]
// Re-queues scoring for one contribution. Without --force the job skips contributions that
// already have a run (safe after an outage). With --force a new run is added next to the old
// one, e.g. after a rubric change; the audit trail shows both.
import { QUEUES, startQueue } from "../src/jobs/queue.js";

const [contributionId, flag] = process.argv.slice(2);
if (!contributionId) throw new Error("usage: enqueue-score <contributionId> [--force]");
const force = flag === "--force";
const boss = await startQueue();
const id = await boss.send(
  QUEUES.score,
  { contributionId, force },
  { singletonKey: force ? `${contributionId}:force` : contributionId },
);
console.log(id ? `queued job ${id}${force ? " (force)" : ""}` : "already queued");
await boss.stop({ close: true });
process.exit(0);
