// Production checks and one pinned migration release. Current release: migration 0017 for the
// Jev live scorer release plan (docs/demo/2026-10-07-jev-live-release-plan.md). The pilot amendment
// release used it for 0016, the earn-first release for 0015 and the 2026-10-05 API rollout for
// 0013+0014 (see those plans and git history).
//
// Run from the exact-source worktree's packages/db, so the migrations folder and drivers are the
// ones the image was built from:
//   node --env-file=<repo>/.env <repo>/scripts/rollout/db.mjs precheck > pre.json
//   node --env-file=<repo>/.env <repo>/scripts/rollout/db.mjs migrate pre.json
//   node --env-file=<repo>/.env <repo>/scripts/rollout/db.mjs postcheck pre.json
//
// The URL is read from DATABASE_URL and never printed. The Neon "-pooler" host is swapped for the
// direct host and lock_timeout=3s is sent as a startup option, so a migration that cannot get its
// locks fails fast instead of queueing member writes behind it.
//
// Matching public data only shows consistency: a recent Neon branch or copy would match too. The
// identity proof is liveness: migrate and postcheck require a reward-recovery completion newer
// than the precheck's, which only the database the live worker writes to can show.
//
// Rehearsal: against a loopback database only, ROLLOUT_LIVE_FIXTURE=<json> replaces the live API
// reads with a file, so a disposable Postgres can be checked and migrated. A non-loopback target
// always reads the live API.
//
// Exit codes: 0 pass/applied, 1 fail or unexpected error (stop), 2 lock timeout (nothing applied).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";

const MINT = "HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg";
const PUBLIC_API = "https://hyphae-api.fly.dev";
// The migrations this release applies, in order, pinned by the SHA-256 of their SQL files.
const NEW_MIGRATIONS = {
  "0017_reward_amendment_chain":
    "d630d663625392762f3889eb6dfe78966840651fbd16ae68cf1c02bd03dfc3fe",
};
// 0015 is applied before and after: the three member columns are nullable and the check exists.
const NULLABLE_COLUMNS = ["wallet", "link_method", "linked_at"];
const MEMBERS_CHECK = "members_wallet_link_together";
// What 0017 changes, read from the catalog: the amendments table keeps its three checks and its
// rows (the epoch 2 amendment recorded on 2026-10-07) and swaps its unique index from "one per
// epoch" to "one per (epoch, from config)". Only the amend-epoch step records a second row, after
// the new image runs.
const NEW_TABLE = "reward_config_amendments";
const NEW_TABLE_CHECKS = [
  "reward_config_amendments_future",
  "reward_config_amendments_changes",
  "reward_config_amendments_hash_format",
];
const OLD_INDEX = "reward_config_amendments_epoch";
const NEW_INDEX = "reward_config_amendments_epoch_from";
const COUNTED_TABLES = [
  "members",
  "contributions",
  "reward_intakes",
  "reward_decisions",
  "epochs",
  "tasks",
  "reward_config_amendments",
  "reward_snapshot_entries",
  "leaves",
];
// Any other query parameter (host, hostaddr, port, options, ...) could redirect the connection
// away from the host this script reports, so it is refused.
const ALLOWED_URL_PARAMS = new Set(["sslmode", "channel_binding"]);
const BASELINE_MAX_AGE_MS = 2 * 60 * 60_000;

const dbDir = process.cwd();
const migrationsFolder = join(dbDir, "drizzle");
// pg is a peer of drizzle-orm, not a dependency of packages/db, so it resolves from drizzle-orm's
// own location. This is the same driver and migrator that `drizzle-kit migrate` picks first.
const requireOrm = createRequire(createRequire(join(dbDir, "package.json")).resolve("drizzle-orm"));
const pg = requireOrm("pg");
const { drizzle } = requireOrm("drizzle-orm/node-postgres");
const { migrate } = requireOrm("drizzle-orm/node-postgres/migrator");

// pg 8.23 treats channel binding as a preference and ignores channel_binding=require. This client
// refuses any authentication that cannot bind the TLS channel, and refuses to become ready unless
// a SCRAM-SHA-256-PLUS exchange was verified (a trust login would otherwise skip SASL entirely).
class ChannelBoundClient extends pg.Client {
  _handleAuthSASL(msg) {
    if (!msg.mechanisms.includes("SCRAM-SHA-256-PLUS")) {
      this.connection.emit("error", new Error("channel_binding=require: server offered no -PLUS"));
      return;
    }
    super._handleAuthSASL(msg);
  }
  _handleAuthSASLFinal(msg) {
    const plus = this.saslSession?.mechanism === "SCRAM-SHA-256-PLUS";
    super._handleAuthSASLFinal(msg);
    // pg clears the session only after the server signature verifies.
    if (plus && this.saslSession === null) this.channelBound = true;
  }
  _handleReadyForQuery(msg) {
    if (this._connecting && !this.channelBound) {
      this.connection.emit("error", new Error("channel_binding=require: no verified -PLUS login"));
      return;
    }
    super._handleReadyForQuery(msg);
  }
  _handleAuthCleartextPassword() {
    this.connection.emit("error", new Error("channel_binding=require: password auth refused"));
  }
  _handleAuthMD5Password() {
    this.connection.emit("error", new Error("channel_binding=require: md5 auth refused"));
  }
}

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
  for (const key of url.searchParams.keys()) {
    if (!ALLOWED_URL_PARAMS.has(key)) throw new Error(`DATABASE_URL has unsupported param ${key}`);
  }
  const pooledHost = url.hostname;
  url.hostname = url.hostname.replace("-pooler.", ".");
  url.searchParams.set("options", "-c lock_timeout=3000");
  const channelBinding = url.searchParams.get("channel_binding") === "require";
  const config = {
    connectionString: url.toString(),
    enableChannelBinding: channelBinding,
    ...(channelBinding ? { Client: ChannelBoundClient } : {}),
  };
  const target = {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.slice(1)),
    pooledHostGiven: url.hostname !== pooledHost,
    sslmode: url.searchParams.get("sslmode"),
    channelBinding,
  };
  // What pg will actually connect to must be what this script reports.
  const effective = new pg.Client(config);
  if (
    effective.host !== target.host ||
    effective.port !== target.port ||
    effective.database !== target.database
  )
    throw new Error("pg's effective connection target differs from the reported one");
  return { config, target };
}

function newClient({ config }) {
  const Client = config.Client ?? pg.Client;
  return new Client(config);
}

async function readJournal(client) {
  return (
    await client.query(
      "select hash, created_at::text as created_at from drizzle.__drizzle_migrations order by created_at",
    )
  ).rows.map((r) => ({ created_at: r.created_at, hash: r.hash }));
}

const journalMatches = (rows, expected) =>
  isDeepStrictEqual(
    rows,
    expected.map(({ created_at, hash }) => ({ created_at, hash })),
  );

async function lastRecovery(client) {
  const [{ boss }] = (await client.query("select to_regclass('pgboss.job') is not null as boss"))
    .rows;
  if (!boss) return null;
  return (
    await client.query(
      "select max(completed_on) as at from pgboss.job where name = 'reward-recovery' and state = 'completed'",
    )
  ).rows[0].at;
}

async function readShape(client) {
  const nullable = {};
  for (const { column_name, is_nullable } of (
    await client.query(
      `select column_name, is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'members' and column_name = any($1)`,
      [NULLABLE_COLUMNS],
    )
  ).rows)
    nullable[column_name] = is_nullable === "YES";
  const check = (
    await client.query(
      `select count(*)::int as n from pg_constraint
        where conname = $1 and conrelid = 'public.members'::regclass and contype = 'c'`,
      [MEMBERS_CHECK],
    )
  ).rows[0].n;
  const [{ exists }] = (
    await client.query("select to_regclass($1) is not null as exists", [`public.${NEW_TABLE}`])
  ).rows;
  const table = exists
    ? {
        checks: (
          await client.query(
            `select conname from pg_constraint
              where conrelid = $1::regclass and contype = 'c' order by conname`,
            [`public.${NEW_TABLE}`],
          )
        ).rows.map((r) => r.conname),
        // Every unique index on the table with its column list, so a swap is seen exactly.
        unique_indexes: (
          await client.query(
            `select c.relname as name,
                    (select string_agg(a.attname, ',' order by k.ord)
                       from unnest(x.indkey) with ordinality as k(attnum, ord)
                       join pg_attribute a on a.attrelid = x.indrelid and a.attnum = k.attnum) as columns
               from pg_index x join pg_class c on c.oid = x.indexrelid
              where x.indrelid = $1::regclass and x.indisunique and not x.indisprimary
              order by c.relname`,
            [`public.${NEW_TABLE}`],
          )
        ).rows.map((r) => `${r.name}(${r.columns})`),
        rows: (await client.query(`select count(*)::int as n from public.${NEW_TABLE}`)).rows[0].n,
      }
    : null;
  return { nullable, members_check_exists: check === 1, amendments_table: table };
}

const has0015 = (shape) =>
  NULLABLE_COLUMNS.every((c) => shape.nullable[c] === true) && shape.members_check_exists;
const withIndexes = (shape, indexes) =>
  has0015(shape) &&
  shape.amendments_table !== null &&
  isDeepStrictEqual(shape.amendments_table.checks, [...NEW_TABLE_CHECKS].sort()) &&
  isDeepStrictEqual(shape.amendments_table.unique_indexes, indexes);
// 0016's table, with its one-per-epoch unique index, is the state before; 0017 swaps the index.
const untouched = (shape) => withIndexes(shape, [`${OLD_INDEX}(epoch_id)`]);
const applied = (shape) => withIndexes(shape, [`${NEW_INDEX}(epoch_id,from_config_id)`]);

async function readState(client) {
  const one = async (text, values) => (await client.query(text, values)).rows;
  const s = {};
  s.read_only = (await one("show transaction_read_only"))[0].transaction_read_only;
  s.lock_timeout = (await one("show lock_timeout"))[0].lock_timeout;
  s.server = (await one("select current_database() as db, version() as version"))[0];
  s.journal = await readJournal(client);
  s.shape = await readShape(client);
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
  const last = await lastRecovery(client);
  s.queue =
    last === null
      ? null
      : {
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
          last_reward_recovery_completed: last,
        };
  s.reference = (await one("select now() as at, pg_current_wal_lsn()::text as lsn"))[0];
  return s;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

async function publicReads(target) {
  const fixture = process.env.ROLLOUT_LIVE_FIXTURE;
  if (fixture) {
    if (!LOOPBACK.has(target.host)) throw new Error("ROLLOUT_LIVE_FIXTURE is for loopback only");
    return JSON.parse(readFileSync(fixture, "utf8"));
  }
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

const ms = (v) => new Date(v).getTime();

function checkState(s, live, journalExpected, phase) {
  const problems = [];
  const fail = (msg) => problems.push(msg);
  const newCount = Object.keys(NEW_MIGRATIONS).length;
  const appliedCount = phase === "pre" ? journalExpected.length - newCount : journalExpected.length;

  if (s.read_only !== "on") fail(`transaction_read_only is ${s.read_only}`);
  if (s.lock_timeout !== "3s") fail(`lock_timeout is ${s.lock_timeout}, not 3s`);
  if (!journalMatches(s.journal, journalExpected.slice(0, appliedCount)))
    fail(
      `journal (${s.journal.length} rows) is not exactly the first ${appliedCount} expected entries`,
    );
  if (!has0015(s.shape)) fail("members does not have 0015's shape");
  if (phase === "pre" && !untouched(s.shape)) fail(`${NEW_TABLE} is not exactly 0016's table`);
  if (phase === "post" && !applied(s.shape)) fail(`${NEW_TABLE} is not exactly 0017's table`);

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

  // Consistency with what the live API serves (identity comes from liveness, see the header).
  if (live.community.name !== lab?.name) fail("public name differs");
  const intake = lab?.reward_intake_paused_at === null ? "open" : "paused";
  if (live.community.reward_intake !== intake) fail("public intake state differs");
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

  for (const t of COUNTED_TABLES) {
    if (!Number.isInteger(s.counts[t]) || s.counts[t] < 0) fail(`count of ${t} is invalid`);
  }
  if (s.long_transactions.length > 0)
    fail(`${s.long_transactions.length} other transaction(s) older than 5 s`);
  if (!s.queue) fail("pgboss.job is missing or has no reward-recovery completion");
  else {
    const failed = s.queue.by_state
      .filter((r) => r.state === "failed")
      .reduce((a, r) => a + r.n, 0);
    if (failed !== 0) fail(`${failed} failed queue job(s)`);
    if (s.queue.stale_pending !== 0)
      fail(`${s.queue.stale_pending} queue job(s) pending over 10 min`);
    if (ms(s.reference.at) - ms(s.queue.last_reward_recovery_completed) > 10 * 60_000)
      fail("reward-recovery has not completed in the last 10 min");
  }
  return problems;
}

// The baseline must be a passing precheck of this same target, recent, with valid counts.
function loadBaseline(path, target) {
  if (!path) throw new Error("this mode needs the precheck JSON path");
  const b = JSON.parse(readFileSync(path, "utf8"));
  const problems = [];
  if (b.phase !== "pre" || b.verdict !== "PASS")
    problems.push("baseline is not a passing precheck");
  if (!isDeepStrictEqual(b.target, target)) problems.push("baseline target differs");
  for (const t of COUNTED_TABLES) {
    const n = b.state?.counts?.[t];
    if (!Number.isInteger(n) || n < 0) problems.push(`baseline count of ${t} is invalid`);
  }
  if (!b.state?.queue?.last_reward_recovery_completed)
    problems.push("baseline has no reward-recovery completion");
  return { baseline: b, problems };
}

function compareToBaseline(baseline, state) {
  const problems = [];
  const deltas = {};
  for (const t of COUNTED_TABLES) {
    deltas[t] = state.counts[t] - baseline.state.counts[t];
    if (!(deltas[t] >= 0)) problems.push(`${t} lost rows or is invalid (delta ${deltas[t]})`);
  }
  // This release records no amendment; the second one comes only after the new image runs.
  if (deltas.reward_config_amendments !== 0)
    problems.push(`reward_config_amendments changed by ${deltas.reward_config_amendments}`);
  const age = ms(state.reference.at) - ms(baseline.state.reference.at);
  if (!(age >= 0 && age <= BASELINE_MAX_AGE_MS)) problems.push("baseline is older than 2 hours");
  const last = state.queue?.last_reward_recovery_completed;
  const liveness = Boolean(
    last && ms(last) > ms(baseline.state.queue.last_reward_recovery_completed),
  );
  if (!liveness)
    problems.push(
      "no reward-recovery completion newer than the baseline yet: wait for the next one (about 5 min)",
    );
  return { problems, deltas, liveness };
}

async function withReadOnly(conn, fn) {
  const client = newClient(conn);
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
  const conn = connectionTarget();
  const journalExpected = expectedJournal();
  const state = await withReadOnly(conn, readState);
  const live = await publicReads(conn.target);
  const problems = checkState(state, live, journalExpected, phase);
  const report = { phase, target: conn.target };
  if (phase === "post") {
    const { baseline, problems: bp } = loadBaseline(baselinePath, conn.target);
    problems.push(...bp);
    if (bp.length === 0) {
      const cmp = compareToBaseline(baseline, state);
      problems.push(...cmp.problems);
      report.count_deltas = cmp.deltas;
      report.liveness = cmp.liveness;
    }
  }
  report.verdict = problems.length ? "FAIL" : "PASS";
  report.problems = problems;
  report.state = state;
  console.log(JSON.stringify(report, null, 2));
  return problems.length ? 1 : 0;
}

async function runMigrate(baselinePath) {
  const conn = connectionTarget();
  const journalExpected = expectedJournal();
  for (const [tag, hash] of Object.entries(NEW_MIGRATIONS)) {
    if (journalExpected.find((e) => e.tag === tag)?.hash !== hash)
      throw new Error(`${tag} is missing or its hash differs from the pinned plan`);
  }
  const newCount = Object.keys(NEW_MIGRATIONS).length;
  const beforeCount = journalExpected.length - newCount;
  if (!journalExpected.slice(beforeCount).every((e) => e.tag in NEW_MIGRATIONS))
    throw new Error("the migrations folder does not end with exactly this release's migrations");
  const before = journalExpected.slice(0, beforeCount);
  const lastBefore = before.at(-1)?.tag;
  console.error(`target ${JSON.stringify(conn.target)}`);

  const { baseline, problems } = loadBaseline(baselinePath, conn.target);
  const gate = await withReadOnly(conn, async (c) => ({
    journal: await readJournal(c),
    state: await readState(c),
  }));
  if (problems.length === 0) problems.push(...compareToBaseline(baseline, gate.state).problems);
  // Every precheck condition must still hold now, not only when the baseline was taken.
  problems.push(...checkState(gate.state, await publicReads(conn.target), journalExpected, "pre"));
  if (!journalMatches(gate.journal, before))
    problems.push(`journal is not exactly the ${beforeCount} migrations up to ${lastBefore}`);
  if (problems.length) {
    console.error(`NOT MIGRATING (nothing changed):\n- ${problems.join("\n- ")}`);
    return 1;
  }

  const pool = new pg.Pool({ ...conn.config, max: 1 });
  let failure;
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } catch (err) {
    failure = err;
  } finally {
    await pool.end().catch(() => {});
  }

  const after = await withReadOnly(conn, async (c) => ({
    journal: await readJournal(c),
    state: await readState(c),
  })).catch(() => null);
  const unchanged = after && journalMatches(after.journal, before) && untouched(after.state.shape);
  const done =
    after && journalMatches(after.journal, journalExpected) && applied(after.state.shape);

  if (failure) {
    const code = failure?.cause?.code ?? failure?.code ?? "unknown";
    const message = failure?.cause?.message ?? failure?.message ?? String(failure);
    console.error(`MIGRATE FAILED code=${code} message=${message}`);
    if (code === "55P03" && unchanged) {
      console.error("LOCK TIMEOUT: journal and schema unchanged. Retry per plan Step 5 (max 3).");
      return 2;
    }
    const outcome = !after
      ? "UNKNOWN: the database could not be read back"
      : unchanged
        ? "ROLLED BACK: journal and schema unchanged"
        : done
          ? "COMMITTED: the migrations are applied despite the error"
          : `INCONSISTENT: journal has ${after.journal.length} rows`;
    console.error(`${outcome}. STOP: do not retry; reconcile and ask Cisco.`);
    return 1;
  }
  if (!done) {
    console.error("STOP: migrator returned but the journal or the schema is not as expected");
    return 1;
  }
  console.error(
    `APPLIED: journal ${beforeCount} -> ${journalExpected.length} rows, ending ${journalExpected.at(-1)?.tag}`,
  );
  return 0;
}

const [mode, arg] = process.argv.slice(2);
const run = {
  precheck: () => check("pre"),
  postcheck: () => check("post", arg),
  migrate: () => runMigrate(arg),
};
if (!run[mode]) {
  console.error("usage: db.mjs precheck | migrate <precheck.json> | postcheck <precheck.json>");
  process.exit(1);
}
run[mode]().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`ERROR ${err?.code ?? ""} ${err?.message ?? err}`);
    process.exit(1);
  },
);
