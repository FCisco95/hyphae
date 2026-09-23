// Usage: node --env-file=<abs .env> --import tsx scripts/reward-reconcile.ts <dispatch-id> not-sent --reason "<evidence>"
// Records that a dispatch in pending_reconciliation provably never reached the provider (for
// example, the provider's usage log shows no request). Only this frees the slot for one more
// call; without it the work stays pending until the epoch closes. The reason is kept for audit.
import { parseArgs } from "node:util";
import { rewardDispatches } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { db } from "../src/db.js";
import { recordNotSentProven } from "../src/rewards/evaluation.js";

const usage = 'usage: reward-reconcile <dispatch-id> not-sent --reason "<evidence>"';
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { reason: { type: "string" } },
});
const [dispatchId, action] = positionals;
if (!dispatchId || action !== "not-sent" || !values.reason?.trim()) throw new Error(usage);
const [dispatch] = await db
  .select({ communityId: rewardDispatches.communityId })
  .from(rewardDispatches)
  .where(eq(rewardDispatches.id, dispatchId));
if (!dispatch) throw new Error(`no dispatch ${dispatchId}`);
const updated = await recordNotSentProven(db, {
  communityId: dispatch.communityId,
  dispatchId,
  reason: values.reason.trim(),
});
console.log(`dispatch ${updated.id}: not_sent_proven (${updated.reconcileReason})`);
process.exit(0);
