// Read-only: the reward configuration proposals and the prompt each epoch has pinned. Writes nothing.
//
// From apps/api: node --env-file=$hyphaeEnv --import tsx ../../docs/demo/proposal-check.mts
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { db } from "../../apps/api/src/db.js";
import { readOnly } from "../../apps/api/src/pg.js";

const apiRequire = createRequire(join(process.cwd(), "package.json"));
const { sql } = await import(pathToFileURL(apiRequire.resolve("drizzle-orm")).href);
const MINT = "HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg";

const out = await readOnly(db, async (tx) => ({
  proposals: await tx.execute(sql`
    select p.status, p.accepted_in_epoch, p.earliest_activation_epoch, p.activated_epoch_index,
           p.proposed_by, p.accepted_at, c.payload->'scoring'->>'promptVersion' as prompt,
           c.payload->'rubric'->>'version' as rubric, left(c.digest, 12) as digest
    from reward_config_proposals p
    join reward_configs c on c.id = p.config_id
    join communities m on m.id = p.community_id
    where m.mint = ${MINT}
    order by p.accepted_at`),
  epochs: await tx.execute(sql`
    select e.index, e.opens_at, e.closes_at, c.payload->'scoring'->>'promptVersion' as prompt,
           c.payload->'rubric'->>'version' as rubric
    from epochs e join reward_configs c on c.id = e.reward_config_id
    join communities m on m.id = e.community_id
    where m.mint = ${MINT}
    order by e.index`),
}));
console.log(JSON.stringify(out, null, 1));
process.exit(0);
