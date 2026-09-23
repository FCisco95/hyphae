// Usage: node --env-file=<abs .env> --import tsx scripts/set-rubric.ts <mint> <rubric.json>
//        … <mint> <rubric.json> --activate-at <iso>   bootstrap epoch 1 (community has no epochs)
//        … <mint> --cancel                            withdraw the pending proposal
// Records a reward configuration proposal that activates at the O4 cooldown boundary and, in the
// same transaction, updates the community's staging rubric (still read by the legacy score job
// and /raid). A refused reward write changes nothing. Open epochs keep their pinned configuration.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { RubricSchema } from "@hyphae/core";
import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { db } from "../src/db.js";
import { cancelRewardProposal, parseActivationTime } from "../src/rewards/config.js";
import { stageRubric } from "../src/rewards/staging.js";

const usage =
  "usage: set-rubric <mint> <rubric.json> [--activate-at <iso>] | set-rubric <mint> --cancel";
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "activate-at": { type: "string" }, cancel: { type: "boolean" } },
});
const [mint, file] = positionals;
if (!mint) throw new Error(usage);
const community = await db.query.communities.findFirst({ where: eq(communities.mint, mint) });
if (!community) throw new Error(`no community with mint ${mint}`);
const proposedBy = "script:set-rubric";

if (values.cancel) {
  const cancelled = await cancelRewardProposal(db, { communityId: community.id });
  console.log(
    `${community.name}: cancelled proposal ${cancelled.id} (earliest activation was E${cancelled.earliestActivationEpoch})`,
  );
  process.exit(0);
}

if (!file) throw new Error(usage);
const activateAt =
  values["activate-at"] === undefined ? undefined : parseActivationTime(values["activate-at"]);
const rubric = RubricSchema.parse(JSON.parse(readFileSync(file, "utf8")));
const result = await stageRubric(db, {
  communityId: community.id,
  rubric,
  proposedBy,
  ...(activateAt ? { activateAt } : {}),
});
console.log(`${community.name}: staging rubric ${rubric.version} (legacy score job and /raid)`);
if (result.kind === "bootstrapped") {
  console.log(
    `${community.name}: epoch 1 opens ${result.epoch.opensAt.toISOString()}, closes ${result.epoch.closesAt.toISOString()}, config ${result.config.digest}`,
  );
} else if (result.kind === "staged_only") {
  console.log(`${community.name}: no reward epochs yet; bootstrap with --activate-at <iso>`);
} else {
  console.log(
    `${community.name}: proposal ${result.proposal.id} accepted in E${result.proposal.acceptedInEpoch}, earliest activation E${result.proposal.earliestActivationEpoch}`,
  );
}
process.exit(0);
