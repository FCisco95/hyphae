// Usage: node --env-file=<abs .env> --import tsx scripts/reward-correct.ts <contribution-id> \
//   --expected-revision <n> --reason "<public reason>" --evidence <ref> [--evidence <ref>…] \
//   [--raw-quality <0-100>] [--flags <a,b>|none] [--effort eligible|ineligible]
// Operator-only O6 correction: appends a full successor decision to the contribution's lineage.
// Credit and points are re-derived from the frozen config; points are never typed. Re-running
// the same command returns the same revision. No route, command or UI writes corrections.
import { rewardIntakes } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { db } from "../src/db.js";
import { appendCorrection } from "../src/rewards/decisions.js";
import { parseCorrectionArgs } from "./reward-correct-args.js";

const input = parseCorrectionArgs(process.argv.slice(2));
const [intake] = await db
  .select({ communityId: rewardIntakes.communityId })
  .from(rewardIntakes)
  .where(eq(rewardIntakes.contributionId, input.contributionId));
if (!intake) throw new Error(`no reward intake for contribution ${input.contributionId}`);

const result = await appendCorrection(db, { ...input, communityId: intake.communityId });
if (result.status === "appended") {
  const d = result.decision;
  console.log(
    `${result.created ? "appended" : "already appended"} revision ${d.revision}: raw ${d.rawQuality}, credited ${d.creditedQuality}, effort ${d.effort}, ${d.pointUnits} point units, affects allocation: ${d.affectsAllocation}`,
  );
} else if (result.status === "stale_revision") {
  console.error(
    `stale: the latest revision is ${result.current.revision} (${result.current.explanation.slice(0, 120)}). Review it and re-run with --expected-revision ${result.current.revision}.`,
  );
  process.exit(1);
} else {
  console.error(`refused: ${result.status}`);
  process.exit(1);
}
process.exit(0);
