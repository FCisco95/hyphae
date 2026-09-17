// Usage: node --env-file=<abs .env> --import tsx scripts/enqueue-score.ts <contributionId>
// Re-queues scoring for one contribution (e.g. after a provider outage). The job skips
// contributions that already have a run, so this is safe to call twice.
import { QUEUES, startQueue } from "../src/jobs/queue.js";

const [contributionId] = process.argv.slice(2);
if (!contributionId) throw new Error("usage: enqueue-score <contributionId>");
const boss = await startQueue();
const id = await boss.send(QUEUES.score, { contributionId }, { singletonKey: contributionId });
console.log(id ? `queued job ${id}` : "already queued");
await boss.stop({ close: true });
process.exit(0);
