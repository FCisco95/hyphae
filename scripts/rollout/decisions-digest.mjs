// Read-only fingerprint of an epoch's scoring history, for proving a release left it untouched.
// Prints, per table, the row count and the SHA-256 of every row's full text in id order: the
// epoch's intakes, the decisions on them, and every dispatch (model call) on those contributions.
//
//   node --env-file=<repo>/.env <repo>/scripts/rollout/decisions-digest.mjs <mint> <epoch> [<before-iso>]
//
// With <before-iso>, only rows accepted (intakes, decisions) or dispatched before that instant are
// fingerprinted, so a later run can show that everything from before a time is unchanged while new
// rows were added. A dispatch still in flight at the first run may legitimately complete later.
// Run it from packages/db (pg resolves through drizzle-orm, as in db.mjs).
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";

const [mint, epochArg, before] = process.argv.slice(2);
if (!mint || !/^[1-9]\d*$/.test(epochArg ?? "")) {
  console.error("usage: decisions-digest.mjs <mint> <epoch> [<before-iso>]");
  process.exit(1);
}
const requireOrm = createRequire(
  createRequire(join(process.cwd(), "package.json")).resolve("drizzle-orm"),
);
const pg = requireOrm("pg");
const url = new URL(process.env.DATABASE_URL ?? "");
url.hostname = url.hostname.replace("-pooler.", ".");
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  await client.query("begin transaction isolation level repeatable read read only");
  const cutoff = before ?? "infinity";
  const [epoch] = (
    await client.query(
      `select e.id from epochs e join communities c on c.id = e.community_id
        where c.mint = $1 and e.index = $2`,
      [mint, Number(epochArg)],
    )
  ).rows;
  if (!epoch) throw new Error(`no epoch ${epochArg} for ${mint}`);
  const tables = {
    reward_intakes: `select i.*::text as row from reward_intakes i
      where i.epoch_id = $1 and i.accepted_at < $2::timestamptz order by i.id`,
    reward_decisions: `select d.*::text as row from reward_decisions d
      where d.epoch_id = $1 and d.accepted_at < $2::timestamptz order by d.id`,
    // Every model call on the epoch's contributions, decided or not: an unresolved one counts too.
    reward_dispatches: `select x.*::text as row from reward_dispatches x
      join reward_intakes i on i.contribution_id = x.contribution_id
      where i.epoch_id = $1 and x.dispatched_at < $2::timestamptz order by x.id`,
  };
  const out = { mint, epoch: Number(epochArg), before: before ?? null, tables: {} };
  for (const [name, text] of Object.entries(tables)) {
    const rows = (await client.query(text, [epoch.id, cutoff])).rows.map((r) => r.row);
    out.tables[name] = {
      rows: rows.length,
      sha256: createHash("sha256").update(rows.join("\n")).digest("hex"),
    };
  }
  console.log(JSON.stringify(out, null, 2));
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
