// Production checks and the 0013+0014 migration for the 2026-10-05 API rollout plan
// (docs/demo/2026-10-05-api-rollout-plan.md).
//
// Run from the exact-source worktree's packages/db, so the migrations folder and drivers are the
// ones the image was built from:
//   node --env-file=<repo>/.env <repo>/scripts/rollout/db.mjs precheck > pre.json
//   node --env-file=<repo>/.env <repo>/scripts/rollout/db.mjs migrate
//   node --env-file=<repo>/.env <repo>/scripts/rollout/db.mjs postcheck pre.json
//
// The URL is read from DATABASE_URL and never printed. The Neon "-pooler" host is swapped for the
// direct host and lock_timeout=3s is sent as a startup option, so a migration that cannot get its
// locks fails fast instead of queueing member writes behind it.
//
// Exit codes: 0 pass/applied, 1 fail or unexpected error (stop), 2 lock timeout (nothing applied).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const MINT = "HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg";
const PUBLIC_API = "https://hyphae-api.fly.dev";
const NEW_MIGRATIONS = {
  "0013_raid_alerts": "7e0f951e3548d335dd8f299390daba14f6d8a6a3f79277a2068b2ecd4cc4b022",
  "0014_member_journey": "fa479c949a4c2c96234be8ddb2034c8ddaec00df836bcc8e14e199cc743e5485",
};
const NEW_TABLES = [
  "raid_announcements",
  "raid_deliveries",
  "raid_subscriptions",
  "raid_lifecycle_events",
  "raid_submission_receipts",
  "raid_submission_sessions",
  "submission_issues",
];
const NEW_ENUM = "raid_delivery_status";
const COUNTED_TABLES = [
  "members",
  "contributions",
  "reward_intakes",
  "reward_decisions",
  "epochs",
  "tasks",
  "reward_snapshot_entries",
  "leaves",
];

const dbDir = process.cwd();
const migrationsFolder = join(dbDir, "drizzle");
// pg is a peer of drizzle-orm, not a dependency of packages/db, so it resolves from drizzle-orm's
// own location. This is the same driver and migrator that `drizzle-kit migrate` picks first.
const requireOrm = createRequire(createRequire(join(dbDir, "package.json")).resolve("drizzle-orm"));
const pg = requireOrm("pg");
const { drizzle } = requireOrm("drizzle-orm/node-postgres");
const { migrate } = requireOrm("drizzle-orm/node-postgres/migrator");

function expectedJournal() {
  const journal = JSON.parse(readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8"));
  return journal.entries.map((e) => ({
    tag: e.tag,
    created_at: String(e.when),
    hash: createHash("sha256")
      .update(readFileSync(join(migrationsFolder, `${e.tag}.sql`)))
      .digest("hex"),
  }));
}

function connectionTarget() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set (pass the .env with node --env-file)");
  const url = new URL(raw);
  url.hostname = url.hostname.replace("-pooler.", ".");
  url.searchParams.set("options", "-c lock_timeout=3000");
  return {
    url: url.toString(),
    host: url.hostname,
    database: url.pathname.slice(1),
    pooledHostGiven: url.hostname !== new URL(raw).hostname,
  };
}

async function readState(client, journalExpected) {
  const one = async (text, values) => (await client.query(text, values)).rows;
  const s = {};
  s.read_only = (await one("show transaction_read_only"))[0].transaction_read_only;
  s.lock_timeout = (await one("show lock_timeout"))[0].lock_timeout;
  s.server = (await one("select current_database() as db, version() as version"))[0];
  s.journal = (
    await one(
      "select id, hash, created_at::text as created_at from drizzle.__drizzle_migrations order by created_at",
    )
  ).map((r, i) => ({
    tag: journalExpected[i]?.tag ?? null,
    created_at: r.created_at,
    hash: r.hash,
  }));
  s.new_tables = {};
  for (const t of NEW_TABLES) {
    const [{ exists }] = await one("select to_regclass($1) is not null as exists", [`public.${t}`]);
    s.new_tables[t] = exists
      ? Number((await one(`select count(*)::int as n from public.${t}`))[0].n)
      : null;
  }
  s.new_enum_exists =
    (await one("select count(*)::int as n from pg_type where typname = $1", [NEW_ENUM]))[0].n > 0;
  s.communities = await one(
    `select id, mint, name, telegram_chat_id::text, admin_telegram_user_id::text, first_paid_epoch,
            reward_intake_paused_at from communities order by created_at`,
  );
  s.epochs = await one(
    `select e.index, e.status::text, e.opens_at, e.closes_at, e.reward_config_id,
            (select count(*)::int from reward_epoch_snapshots r where r.epoch_id = e.id) as snapshots
       from epochs e join communities c on c.id = e.community_id
      where c.mint = $1 order by e.index`,
    [MINT],
  );
  s.counts = {};
  for (const t of COUNTED_TABLES) {
    s.counts[t] = (await one(`select count(*)::int as n from public.${t}`))[0].n;
  }
  s.long_transactions = await one(
    `select pid, state, backend_type, now() - xact_start as age from pg_stat_activity
      where xact_start < now() - interval '5 seconds' and pid <> pg_backend_pid()
        and backend_type = 'client backend'`,
  );
  const [{ boss }] = await one("select to_regclass('pgboss.job') is not null as boss");
  s.queue = boss
    ? {
        by_state: await one(
          `select name, state::text, count(*)::int as n, min(created_on) as oldest
             from pgboss.job group by name, state order by name, state`,
        ),
        stale_pending: (
          await one(
            `select count(*)::int as n from pgboss.job
              where state in ('created', 'retry') and created_on < now() - interval '10 minutes'`,
          )
        )[0].n,
        last_reward_recovery_completed: (
          await one(
            "select max(completed_on) as at from pgboss.job where name = 'reward-recovery' and state = 'completed'",
          )
        )[0].at,
      }
    : null;
  s.reference = (await one("select now() as at, pg_current_wal_lsn()::text as lsn"))[0];
  return s;
}

async function publicReads() {
  const get = async (path) => {
    const res = await fetch(`${PUBLIC_API}${path}`);
    if (!res.ok) throw new Error(`GET ${path} returned ${res.status}`);
    return res.json();
  };
  return {
    community: await get(`/v1/communities/${MINT}`),
    epoch2: await get(`/v1/communities/${MINT}/epochs/2`),
  };
}

function checkState(s, live, journalExpected, phase) {
  const problems = [];
  const fail = (msg) => problems.push(msg);
  const applied = phase === "pre" ? journalExpected.length - 2 : journalExpected.length;
  const want = journalExpected.slice(0, applied);

  if (s.read_only !== "on") fail(`transaction_read_only is ${s.read_only}`);
  if (s.lock_timeout !== "3s") fail(`lock_timeout is ${s.lock_timeout}, not 3s`);
  if (s.journal.length !== want.length)
    fail(`journal has ${s.journal.length} rows, expected ${want.length}`);
  want.forEach((w, i) => {
    const got = s.journal[i];
    if (!got || got.hash !== w.hash || got.created_at !== w.created_at)
      fail(`journal row ${i} differs from ${w.tag}`);
  });
  for (const [t, n] of Object.entries(s.new_tables)) {
    if (phase === "pre" && n !== null) fail(`${t} already exists`);
    if (phase === "post" && n !== 0) fail(`${t} is ${n === null ? "missing" : `not empty (${n})`}`);
  }
  if (s.new_enum_exists !== (phase === "post")) fail(`enum ${NEW_ENUM} presence is wrong`);

  if (s.communities.length !== 1) fail(`communities has ${s.communities.length} rows, expected 1`);
  const lab = s.communities[0];
  if (lab?.mint !== MINT || lab?.name !== "Hyphae Lab") fail("community is not Hyphae Lab");
  if (lab?.first_paid_epoch !== 2) fail(`first_paid_epoch is ${lab?.first_paid_epoch}`);
  if (lab?.reward_intake_paused_at !== null) fail("reward intake is paused");

  const e1 = s.epochs.find((e) => e.index === 1);
  const e2 = s.epochs.find((e) => e.index === 2);
  if (e1?.status !== "closed" || e1?.snapshots !== 1) fail("epoch 1 is not closed with 1 snapshot");
  if (e2?.status !== "open" || e2?.closes_at?.toISOString() !== "2026-10-09T00:00:00.000Z")
    fail("epoch 2 is not open until 2026-10-09T00:00Z");

  // The DB behind this URL must be the one the live API reads: Fly secrets cannot be read back.
  if (live.community.name !== lab?.name) fail("public name differs");
  const intake = lab?.reward_intake_paused_at === null ? "open" : "paused";
  if (live.community.reward_intake !== intake) fail("public intake state differs");
  const ms = (v) => new Date(v).getTime();
  for (const pe of live.community.epochs) {
    const de = s.epochs.find((e) => e.index === pe.index);
    if (
      !de ||
      de.status !== pe.status ||
      ms(de.opens_at) !== ms(pe.opens_at) ||
      ms(de.closes_at) !== ms(pe.closes_at)
    )
      fail(`public epoch ${pe.index} differs`);
  }
  if (live.community.epochs.length !== s.epochs.length) fail("public epoch count differs");
  if (live.epoch2.config?.id !== e2?.reward_config_id) fail("public epoch 2 reward config differs");

  if (s.long_transactions.length > 0)
    fail(`${s.long_transactions.length} other transaction(s) older than 5 s`);
  if (!s.queue) fail("pgboss.job is missing");
  else {
    const failed = s.queue.by_state
      .filter((r) => r.state === "failed")
      .reduce((a, r) => a + r.n, 0);
    if (failed !== 0) fail(`${failed} failed queue job(s)`);
    if (s.queue.stale_pending !== 0)
      fail(`${s.queue.stale_pending} queue job(s) pending over 10 min`);
    const last = s.queue.last_reward_recovery_completed;
    if (!last || Date.now() - ms(last) > 10 * 60_000)
      fail("reward-recovery has not completed in the last 10 min");
  }
  return problems;
}

function compareCounts(before, after) {
  const problems = [];
  const deltas = {};
  for (const t of COUNTED_TABLES) {
    deltas[t] = after[t] - before[t];
    if (deltas[t] < 0) problems.push(`${t} lost ${-deltas[t]} row(s)`);
  }
  return { problems, deltas };
}

async function withReadOnly(target, fn) {
  const client = new pg.Client({ connectionString: target.url });
  await client.connect();
  try {
    await client.query("begin transaction read only");
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => {});
    await client.end();
  }
}

async function check(phase, baselinePath) {
  const target = connectionTarget();
  const journalExpected = expectedJournal();
  const state = await withReadOnly(target, (c) => readState(c, journalExpected));
  const live = await publicReads();
  const problems = checkState(state, live, journalExpected, phase);
  let deltas;
  if (phase === "post") {
    if (!baselinePath) throw new Error("postcheck needs the precheck JSON path");
    const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
    const cmp = compareCounts(baseline.state.counts, state.counts);
    problems.push(...cmp.problems);
    deltas = cmp.deltas;
  }
  const { url: _url, ...shown } = target;
  const report = { phase, target: shown, verdict: problems.length ? "FAIL" : "PASS", problems };
  if (deltas) report.count_deltas = deltas;
  report.state = state;
  console.log(JSON.stringify(report, null, 2));
  return problems.length ? 1 : 0;
}

async function runMigrate() {
  const target = connectionTarget();
  const journalExpected = expectedJournal();
  for (const [tag, hash] of Object.entries(NEW_MIGRATIONS)) {
    if (journalExpected.find((e) => e.tag === tag)?.hash !== hash)
      throw new Error(`${tag} is missing or its hash differs from the pinned plan`);
  }
  console.error(`target host=${target.host} db=${target.database}`);
  const countJournal = async () =>
    withReadOnly(
      target,
      async (c) =>
        (await c.query("select count(*)::int as n from drizzle.__drizzle_migrations")).rows[0].n,
    );
  const before = await countJournal();
  if (before !== journalExpected.length - 2) {
    console.error(
      `journal has ${before} rows, expected ${journalExpected.length - 2}; not migrating`,
    );
    return 1;
  }
  const pool = new pg.Pool({ connectionString: target.url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } catch (err) {
    const code = err?.cause?.code ?? err?.code ?? "unknown";
    const message = err?.cause?.message ?? err?.message ?? String(err);
    console.error(`MIGRATE FAILED code=${code} message=${message}`);
    const after = await countJournal().catch(() => "unreadable");
    console.error(`journal rows now: ${after}`);
    if (code === "55P03" && after === before) {
      console.error(
        "LOCK TIMEOUT: nothing applied. Retry per plan Step 5 (at most three attempts).",
      );
      return 2;
    }
    console.error("STOP: not a clean lock timeout. Do not retry; read the journal and ask.");
    return 1;
  } finally {
    await pool.end();
  }
  const after = await countJournal();
  console.error(`APPLIED: journal ${before} -> ${after} rows`);
  return after === journalExpected.length ? 0 : 1;
}

const [mode, arg] = process.argv.slice(2);
const run = {
  precheck: () => check("pre"),
  postcheck: () => check("post", arg),
  migrate: runMigrate,
};
if (!run[mode]) {
  console.error("usage: db.mjs precheck | migrate | postcheck <precheck.json>");
  process.exit(1);
}
run[mode]().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`ERROR ${err?.code ?? ""} ${err?.message ?? err}`);
    process.exit(1);
  },
);
