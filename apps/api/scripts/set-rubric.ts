// Usage: node --env-file=<abs .env> --import tsx scripts/set-rubric.ts <mint> <rubric.json>
//        … <mint> <rubric.json> --activate-at <iso>   bootstrap epoch 1 (community has no epochs)
//        … <mint> --cancel                            withdraw the pending proposal
// Updates the community's staging rubric (still read by the legacy score job and /raid) and
// records a reward configuration proposal that activates at the O4 cooldown boundary. The
// pinned configuration of any open epoch never changes here.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { RubricSchema } from "@hyphae/core";
import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { db } from "../src/db.js";
import {
  bootstrapRewardEpochs,
  buildRewardConfigPayload,
  cancelRewardProposal,
  latestEpoch,
  parseActivationTime,
  proposeRewardConfig,
} from "../src/rewards/config.js";

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
await db
  .update(communities)
  .set({ rubric, rubricVersion: rubric.version })
  .where(eq(communities.id, community.id));
console.log(`${community.name}: staging rubric ${rubric.version} (legacy score job and /raid)`);

const payload = buildRewardConfigPayload(rubric);
if (activateAt) {
  const { config, epoch } = await bootstrapRewardEpochs(db, {
    communityId: community.id,
    payload,
    opensAt: activateAt,
    proposedBy,
  });
  console.log(
    `${community.name}: epoch 1 opens ${epoch.opensAt.toISOString()}, closes ${epoch.closesAt.toISOString()}, config ${config.digest}`,
  );
} else if (!(await latestEpoch(db, community.id))) {
  console.log(`${community.name}: no reward epochs yet; bootstrap with --activate-at <iso>`);
} else {
  const proposal = await proposeRewardConfig(db, {
    communityId: community.id,
    payload,
    proposedBy,
  });
  console.log(
    `${community.name}: proposal ${proposal.id} accepted in E${proposal.acceptedInEpoch}, earliest activation E${proposal.earliestActivationEpoch}`,
  );
}
process.exit(0);
