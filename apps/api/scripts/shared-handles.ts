// Usage: node --env-file=<abs .env> --import tsx scripts/shared-handles.ts <mint> <epoch-index> list
//        node --env-file=<abs .env> --import tsx scripts/shared-handles.ts <mint> <epoch-index> clear <member-id> "<note>"
// Members sharing a bound X handle are not paid for an epoch until cleared for it (ruled
// 2026-10-21). `list` reads only; `clear` writes one insert-only row. Output is private: it pairs
// members with X handles.
import { communities, epochs } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db.js";
import { clearSharedHandle, sharedHandleReport } from "../src/payout/shared-handles.js";

const [mint, index, action, memberId, note] = process.argv.slice(2);
if (!mint || !index || (action !== "list" && action !== "clear")) {
  throw new Error('usage: shared-handles <mint> <epoch-index> list | clear <member-id> "<note>"');
}
const community = await db.query.communities.findFirst({ where: eq(communities.mint, mint) });
if (!community) throw new Error(`no community with mint ${mint}`);
const epoch = await db.query.epochs.findFirst({
  where: and(eq(epochs.communityId, community.id), eq(epochs.index, Number(index))),
});
if (!epoch) throw new Error(`no epoch ${index} in ${community.name}`);
const ref = { communityId: community.id, epochId: epoch.id };

if (action === "list") {
  const { groups, cleared } = await sharedHandleReport(db, ref);
  console.log(`${community.name}, epoch ${epoch.index} (${epoch.status}): ${groups.length} shared`);
  for (const g of groups) console.log(`  @${g.handle}: ${g.memberIds.join(", ")}`);
  for (const [id, why] of cleared) console.log(`  cleared ${id}: ${why}`);
} else {
  if (!memberId || !note) throw new Error('usage: ... clear <member-id> "<note>"');
  const result = await clearSharedHandle(db, { ...ref, memberId, note });
  console.log(`${memberId}, epoch ${epoch.index}: ${result.status}`);
  if (result.status !== "cleared" && result.status !== "already_cleared") process.exit(1);
}
process.exit(0);
