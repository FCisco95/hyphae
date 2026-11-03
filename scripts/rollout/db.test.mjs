// Rehearses scripts/rollout/db.mjs against disposable local Postgres databases (never Neon).
// Each database is migrated to 0022 and seeded to the shape production has: Hyphae Lab, epochs 1
// to 6, frozen evidence for epochs 4 and 5, a live reward-recovery queue. The shipped pins are
// production's, so a copy of the script is pinned to the seed's digests instead. The copy keeps
// every check; besides those pins it only moves the base deadline later, so the pass cases do not
// depend on today's date (the deadline cases bring it earlier with ROLLOUT_DEADLINE).
//
// Run: pnpm test:rollout (starts a postgres:18 container on a free loopback port; needs Docker).
// ROLLOUT_TEST_PG_URL=<url of a loopback superuser connection> uses an existing server instead.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dbDir = join(here, "../../packages/db");
const SCRIPT = join(here, "db.mjs");
const requireOrm = createRequire(createRequire(join(dbDir, "package.json")).resolve("drizzle-orm"));
const pg = requireOrm("pg");
const { drizzle } = requireOrm("drizzle-orm/node-postgres");
const { migrate } = requireOrm("drizzle-orm/node-postgres/migrator");

const MINT = "HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg";
const RELEASE_TAG = "0023_payout_policies_and_distributions";
const PAYOUT_TABLES = [
  "distribution_publication_epoch_members",
  "distribution_publication_members",
  "distribution_publications",
  "epoch_payout_decisions",
  "hold_rulings",
  "payout_policies",
];
const FROZEN_KEYS = [
  "reward_config_id",
  "prompt_version",
  "snapshot_closed_at",
  "snapshot_entries",
  "snapshot_members",
  "snapshot_digest",
  "hold_checks",
  "hold_holder",
  "hold_in_window",
  "hold_digest",
  "clearances",
  "clearance_digest",
  "config_digest",
];

const work = mkdtempSync(join(tmpdir(), "rollout-db-"));
let container = null;
let adminUrl;
let dbCounter = 0;
let pinnedScript;

async function waitForServer(url) {
  for (let i = 0; i < 120; i++) {
    const c = new pg.Client({ connectionString: url });
    try {
      await c.connect();
      await c.query("select 1");
      await c.end();
      return;
    } catch {
      await c.end().catch(() => {});
      await sleep(500);
    }
  }
  throw new Error("local Postgres did not start");
}

async function admin(sql, values) {
  const c = new pg.Client({ connectionString: adminUrl });
  await c.connect();
  try {
    return await c.query(sql, values);
  } finally {
    await c.end();
  }
}

const urlFor = (name) => {
  const u = new URL(adminUrl);
  u.pathname = `/${name}`;
  return u.toString();
};

async function sql(name, text, values) {
  const c = new pg.Client({ connectionString: urlFor(name) });
  await c.connect();
  try {
    return await c.query(text, values);
  } finally {
    await c.end();
  }
}

// A migrations folder that ends at 0022, as production's journal does before this release.
function folderAt0022() {
  const dir = join(work, "drizzle-0022");
  cpSync(join(dbDir, "drizzle"), dir, { recursive: true });
  const journalPath = join(dir, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  assert.equal(journal.entries.at(-1).tag, RELEASE_TAG);
  journal.entries = journal.entries.slice(0, -1);
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

const C = "00000000-0000-4000-8000-0000000000c1";
const M1 = "00000000-0000-4000-8000-0000000000a1";
const M2 = "00000000-0000-4000-8000-0000000000a2";
const CONFIG_OLD = "d265af98-202c-4425-9d7b-dfdd5d5715fa";
const CONFIG_NEW = "bd8e5f63-6010-4f0f-8872-476d8323efc4";
const epochId = (i) => `00000000-0000-4000-8000-00000000e00${i}`;
const snapId = (i) => `00000000-0000-4000-8000-00000000500${i}`;
const WINDOWS = {
  1: ["2026-09-25", "2026-10-02"],
  2: ["2026-10-02", "2026-10-10"],
  3: ["2026-10-10", "2026-10-17"],
  4: ["2026-10-17", "2026-10-24"],
  5: ["2026-10-24", "2026-10-31"],
  6: ["2026-10-31", "2026-11-07"],
};
const STATUS = { 1: "closed", 2: "published", 3: "published", 4: "closed", 5: "closed", 6: "open" };

// Every value is fixed, timestamps included, so each fresh database has the same digests.
async function seed(name) {
  const stmts = [
    `insert into communities (id, mint, name, telegram_chat_id, admin_telegram_user_id,
       rubric_version, rubric, publisher_pubkey, chain_address, first_paid_epoch, created_at)
     values ('${C}', '${MINT}', 'Hyphae Lab', -1001, 7, 'v1', '{"rules": []}', 'pub', 'chain', 2,
       '2026-09-20T00:00:00Z')`,
    ...[
      [CONFIG_OLD, "a"],
      [CONFIG_NEW, "b"],
    ].map(
      ([id, d]) => `insert into reward_configs (id, community_id, payload_version, payload, digest,
         config_hash, created_at)
       values ('${id}', '${C}', 1, '{"scoring": {"promptVersion": "reward-eval/2"}}', '${d}',
         '${d.repeat(64)}', '2026-09-21T00:00:00Z')`,
    ),
    ...Object.entries(WINDOWS).map(
      ([i, [opens, closes]]) => `insert into epochs (id, community_id, index, status, opens_at,
         closes_at, root, publish_tx, reward_config_id)
       values ('${epochId(i)}', '${C}', ${i}, '${STATUS[i]}', '${opens}T00:00:00Z',
         '${closes}T00:00:00Z', ${STATUS[i] === "published" ? `'${"r".repeat(64)}'` : "null"},
         ${STATUS[i] === "published" ? `'tx${i}'` : "null"},
         '${i === "6" ? CONFIG_NEW : CONFIG_OLD}')`,
    ),
    ...[1, 2, 3, 4, 5].map(
      (i) => `insert into reward_epoch_snapshots (id, community_id, epoch_id, closes_at, closed_at,
         cutoff_assumption)
       values ('${snapId(i)}', '${C}', '${epochId(i)}', '${WINDOWS[i][1]}T00:00:00Z',
         '${WINDOWS[i][1]}T00:00:15.5Z', 'scheduled')`,
    ),
    `insert into members (id, community_id, telegram_user_id, linked_at)
     values ('${M1}', '${C}', 11, null), ('${M2}', '${C}', 12, null)`,
    `insert into reward_snapshot_members (id, snapshot_id, member_id, point_units, whole_points)
     values ('00000000-0000-4000-8000-0000000000b4', '${snapId(4)}', '${M1}', 150000000, 2),
       ('00000000-0000-4000-8000-0000000000b5', '${snapId(5)}', '${M2}', 90000000, 1)`,
    `insert into hold_checks (id, community_id, epoch_id, member_id, wallet, mint, threshold_raw,
       check_round, status, reason, attempts, raw_amount, decimals, provider, slot, observed_at,
       checked_at, created_at)
     values ('00000000-0000-4000-8000-0000000000d4', '${C}', '${epochId(4)}', '${M1}', 'w1',
       '${MINT}', 1000, '00000000-0000-4000-8000-0000000000f4', 'holder', null, 1, 5000, 6,
       'helius', 123, '2026-10-24T01:00:00Z', '2026-10-24T01:00:00Z', '2026-10-24T00:30:00Z'),
       ('00000000-0000-4000-8000-0000000000d5', '${C}', '${epochId(5)}', '${M2}', 'w2',
       '${MINT}', 1000, '00000000-0000-4000-8000-0000000000f5', 'uncertain', 'outage', 22, null,
       null, null, null, null, '2026-10-31T23:55:00Z', '2026-10-31T00:30:00Z')`,
    `insert into shared_handle_clearances (id, community_id, epoch_id, member_id, note, cleared_at)
     values ('00000000-0000-4000-8000-0000000000c4', '${C}', '${epochId(4)}', '${M1}', 'own member',
       '2026-10-29T12:00:00Z')`,
    // pgboss.job carries only the columns the script reads.
    "create schema pgboss",
    `create table pgboss.job (name text not null, state text not null,
       created_on timestamptz not null default now(), completed_on timestamptz)`,
    recovery,
  ];
  for (const s of stmts) await sql(name, s);
}

const recovery =
  "insert into pgboss.job (name, state, completed_on) values ('reward-recovery', 'completed', now())";

// A fresh database at 0022, seeded.
async function freshDb() {
  const name = `rollout_${process.pid}_${++dbCounter}`;
  await admin(`create database ${name}`);
  const pool = new pg.Pool({ connectionString: urlFor(name), max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: folderAt0022() });
  } finally {
    await pool.end();
  }
  await seed(name);
  return name;
}

// What the live API would serve for this seed.
function liveFixture() {
  const epochs = Object.entries(WINDOWS).map(([i, [opens, closes]]) => ({
    index: Number(i),
    opens_at: `${opens}T00:00:00.000Z`,
    closes_at: `${closes}T00:00:00.000Z`,
    status: STATUS[i] === "open" ? "open" : "closed",
  }));
  const detail = (i) => ({
    ...epochs[i - 1],
    closed: STATUS[i] !== "open",
    final: i !== 6,
    config: { id: i === 6 ? CONFIG_NEW : CONFIG_OLD, prompt_version: "reward-eval/2" },
    amendments: [],
    settlement:
      i === 3 ? { allocation: { status: "published", publish_tx: "tx3" } } : { allocation: null },
  });
  const path = join(work, "live.json");
  writeFileSync(
    path,
    JSON.stringify({
      community: { name: "Hyphae Lab", reward_intake: "open", epochs },
      epoch3: detail(3),
      epoch4: detail(4),
      epoch5: detail(5),
      epoch6: detail(6),
    }),
  );
  return path;
}

function run(script, name, mode, arg, extraEnv = {}) {
  const env = { ...process.env, DATABASE_URL: urlFor(name), ROLLOUT_LIVE_FIXTURE: liveFixture() };
  delete env.ROLLOUT_DEADLINE;
  Object.assign(env, extraEnv);
  const res = spawnSync(process.execPath, [script, mode, ...(arg ? [arg] : [])], {
    cwd: dbDir,
    env,
    encoding: "utf8",
  });
  const out = { code: res.status, stdout: res.stdout, stderr: res.stderr };
  if (mode !== "migrate" && res.stdout.trim().startsWith("{")) out.report = JSON.parse(res.stdout);
  return out;
}

function precheckFile(name, script = pinnedScript, extraEnv) {
  const res = run(script, name, "precheck", undefined, extraEnv);
  const path = join(work, `${name}-pre.json`);
  writeFileSync(path, res.stdout);
  return { ...res, path };
}

// A copy of the script with production's frozen pins swapped for the seed's, and (unless
// `deadline` is kept) a later base deadline, so the pass cases do not depend on today's date.
function pinnedCopy(state, { keepDeadline = false, mutate = (s) => s } = {}) {
  let src = readFileSync(SCRIPT, "utf8");
  const swap = (re, text) => {
    assert.match(src, re);
    src = src.replace(re, text);
  };
  const frozen = {};
  for (const i of [4, 5]) {
    const e = state.epochs.find((x) => x.index === i);
    frozen[i] = Object.fromEntries(FROZEN_KEYS.map((k) => [k, e[k]]));
  }
  const e6 = state.epochs.find((x) => x.index === 6);
  swap(/const FROZEN = \{[\s\S]*?\n\};/, `const FROZEN = ${JSON.stringify(frozen)};`);
  swap(
    /const EPOCH6 = \{[\s\S]*?\n\};/,
    `const EPOCH6 = ${JSON.stringify({
      reward_config_id: e6.reward_config_id,
      prompt_version: e6.prompt_version,
      config_digest: e6.config_digest,
    })};`,
  );
  swap(
    /const COMMUNITY_RULES_DIGEST = "[0-9a-f]{64}";/,
    `const COMMUNITY_RULES_DIGEST = "${state.communities[0].rules_digest}";`,
  );
  if (!keepDeadline)
    swap(/const RELEASE_DEADLINE = .*;/, 'const RELEASE_DEADLINE = "2099-01-01T00:00:00.000Z";');
  src = mutate(src);
  const path = join(work, `db-pinned-${++dbCounter}.mjs`);
  writeFileSync(path, src);
  return path;
}

before(async () => {
  if (process.env.ROLLOUT_TEST_PG_URL) {
    adminUrl = process.env.ROLLOUT_TEST_PG_URL;
  } else {
    container = `hyphae-rollout-test-${process.pid}`;
    execFileSync("docker", [
      "run",
      "-d",
      "--rm",
      "--name",
      container,
      "-p",
      // Docker picks a free port, so a parallel run or another container cannot collide.
      "127.0.0.1::5432",
      "-e",
      "POSTGRES_PASSWORD=test",
      "postgres:18",
    ]);
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" })
      .trim()
      .split("\n")[0]
      .split(":")
      .at(-1);
    adminUrl = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
  }
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(adminUrl).hostname), "loopback only");
  await waitForServer(adminUrl);
  // The shipped pins read the seed; the copy is pinned to what they read.
  const name = await freshDb();
  const shipped = run(SCRIPT, name, "precheck");
  assert.ok(shipped.report, shipped.stderr);
  pinnedScript = pinnedCopy(shipped.report.state);
});

after(() => {
  if (container) spawnSync("docker", ["stop", container]);
  rmSync(work, { recursive: true, force: true });
});

const problemsOf = (res) => res.report?.problems ?? [];

test("the shipped pins refuse the seed on exactly the frozen production facts", async () => {
  const name = await freshDb();
  // A later override cannot extend the shipped deadline.
  const res = run(SCRIPT, name, "precheck", undefined, {
    ROLLOUT_DEADLINE: "2099-01-01T00:00:00Z",
  });
  assert.equal(res.code, 1);
  assert.equal(res.report.deadline, "2026-11-06T22:00:00.000Z");
  const problems = problemsOf(res).filter((p) => !p.includes("is past 2026-11-06T22:00:00.000Z"));
  assert.deepEqual(problems, [
    "community rubric, publisher or chain address differs from the one read on 2026-11-02",
    "epoch 4 differs from its frozen 2026-11-02 state: snapshot_closed_at, snapshot_entries, snapshot_members, snapshot_digest, hold_checks, hold_holder, hold_in_window, hold_digest, clearance_digest, config_digest",
    "epoch 5 differs from its frozen 2026-11-02 state: snapshot_closed_at, snapshot_entries, snapshot_members, snapshot_digest, hold_checks, hold_digest, config_digest",
    `epoch 6 is not on config ${CONFIG_NEW} with no amendment`,
  ]);
});

test("the shipped script is pinned to 0023 with the 2026-11-06T22:00Z deadline", () => {
  const src = readFileSync(SCRIPT, "utf8");
  const sha = execFileSync(process.execPath, [
    "-e",
    `process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync(${JSON.stringify(
      join(dbDir, "drizzle", `${RELEASE_TAG}.sql`),
    )})).digest("hex"))`,
  ]).toString();
  assert.match(src, new RegExp(`"${RELEASE_TAG}":\\s*"${sha}"`));
  assert.match(src, /const EPOCH6_CLOSES_AT = "2026-11-07T00:00:00.000Z";/);
  assert.match(
    src,
    /const RELEASE_DEADLINE = new Date\(Date\.parse\(EPOCH6_CLOSES_AT\) - 2 \* 60 \* 60_000\)/,
  );
});

test("a database at 0022 passes precheck, migrates to 0023 and passes postcheck", async () => {
  const name = await freshDb();
  const pre = precheckFile(name);
  assert.deepEqual(problemsOf(pre), []);
  assert.equal(pre.code, 0);
  assert.equal(pre.report.verdict, "PASS");
  assert.equal(pre.report.state.journal.length, 23);

  // No reward-recovery newer than the baseline yet: nothing is applied.
  const early = run(pinnedScript, name, "migrate", pre.path);
  assert.equal(early.code, 1);
  assert.match(early.stderr, /NOT MIGRATING \(nothing changed\)/);
  assert.match(early.stderr, /no reward-recovery completion newer than the baseline/);
  const [{ n }] = (await sql(name, "select count(*)::int as n from drizzle.__drizzle_migrations"))
    .rows;
  assert.equal(n, 23);

  await sql(name, recovery);
  const applied = run(pinnedScript, name, "migrate", pre.path);
  assert.equal(applied.code, 0, applied.stderr);
  assert.match(applied.stderr, /APPLIED: journal 23 -> 24 rows, ending 0023_payout/);

  const post = run(pinnedScript, name, "postcheck", pre.path);
  assert.deepEqual(problemsOf(post), []);
  assert.equal(post.code, 0);
  assert.equal(post.report.liveness, true);
  for (const [t, d] of Object.entries(post.report.count_deltas)) assert.equal(d, 0, t);
  for (const t of PAYOUT_TABLES) assert.equal(post.report.count_deltas[t], 0, t);

  // A second apply is refused: the journal is past 0022 and 0023's tables exist.
  const again = run(pinnedScript, name, "migrate", pre.path);
  assert.equal(again.code, 1);
  assert.match(again.stderr, /NOT MIGRATING/);
  assert.match(again.stderr, /payout_policies already exists/);
});

// Each case changes one fact on a seeded 0022 database; precheck must name it.
const PRE_TAMPERS = [
  [
    "a 0023 table already exists",
    "create table hold_rulings (id uuid)",
    "hold_rulings already exists",
  ],
  [
    "a 0023 index name already exists",
    "create index payout_policies_community_from on members (telegram_user_id)",
    "payout_policies_community_from already exists",
  ],
  [
    "an extra table",
    "create table public.payout_extra (id int)",
    "public has table(s) this release does not expect: payout_extra",
  ],
  [
    "an extra view",
    "create view public.payout_view as select 1 as x",
    "public has table(s) this release does not expect: payout_view",
  ],
  [
    "a frozen epoch 4 hold row changed",
    "update hold_checks set attempts = attempts + 1 where epoch_id = '00000000-0000-4000-8000-00000000e004'",
    "epoch 4 differs from its frozen 2026-11-02 state: hold_digest",
  ],
  [
    "a frozen epoch 4 snapshot total changed",
    "update reward_snapshot_members set point_units = 160000000 where snapshot_id = '00000000-0000-4000-8000-000000005004'",
    "epoch 4 differs from its frozen 2026-11-02 state: snapshot_digest",
  ],
  [
    "a frozen epoch 4 clearance changed",
    "update shared_handle_clearances set note = 'other'",
    "epoch 4 differs from its frozen 2026-11-02 state: clearance_digest",
  ],
  [
    "a frozen epoch 5 hold row changed",
    "update hold_checks set reason = 'decided' where epoch_id = '00000000-0000-4000-8000-00000000e005'",
    "epoch 5 differs from its frozen 2026-11-02 state: hold_digest",
  ],
  [
    "an epoch 5 clearance added",
    "insert into shared_handle_clearances (community_id, epoch_id, member_id, note) values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000e005', '00000000-0000-4000-8000-0000000000a2', 'x')",
    "epoch 5 differs from its frozen 2026-11-02 state: clearances, clearance_digest",
  ],
  [
    "0022's check weakened",
    "alter table integration_raid_requests drop constraint integration_raid_requests_role, add constraint integration_raid_requests_role check (actor_role in ('admin', 'steward', 'member'))",
    "integration_raid_requests is not exactly 0022's table",
  ],
];

for (const [label, tamper, message] of PRE_TAMPERS) {
  test(`precheck refuses: ${label}`, async () => {
    const name = await freshDb();
    await sql(name, tamper);
    const res = run(pinnedScript, name, "precheck");
    assert.equal(res.code, 1);
    assert.ok(problemsOf(res).includes(message), JSON.stringify(problemsOf(res)));
  });
}

test("precheck and migrate refuse past the deadline", async () => {
  const name = await freshDb();
  const pre = precheckFile(name);
  assert.equal(pre.code, 0, JSON.stringify(problemsOf(pre)));
  const past = { ROLLOUT_DEADLINE: "2026-01-01T00:00:00Z" };
  const late = run(pinnedScript, name, "precheck", undefined, past);
  assert.equal(late.code, 1);
  assert.ok(
    problemsOf(late).some((p) =>
      /^at the state read, .* is past 2026-01-01T00:00:00.000Z$/.test(p),
    ),
  );
  await sql(name, recovery);
  const migrate = run(pinnedScript, name, "migrate", pre.path, past);
  assert.equal(migrate.code, 1);
  assert.match(migrate.stderr, /NOT MIGRATING \(nothing changed\)/);
  assert.match(migrate.stderr, /is past 2026-01-01T00:00:00.000Z/);
  const [{ n }] = (await sql(name, "select count(*)::int as n from drizzle.__drizzle_migrations"))
    .rows;
  assert.equal(n, 23);
});

test("every mode refuses a migrations folder whose 0023 differs from the pinned hash", async () => {
  const name = await freshDb();
  const wrongHash = pinnedCopy(JSON.parse(readFileSync(precheckFile(name).path, "utf8")).state, {
    mutate: (s) => s.replace(/"df110714[0-9a-f]{56}"/, `"${"0".repeat(64)}"`),
  });
  for (const mode of ["precheck", "migrate", "postcheck"]) {
    const res = run(wrongHash, name, mode, join(work, `${name}-pre.json`));
    assert.equal(res.code, 1);
    assert.match(res.stderr, /does not end with this release's pinned migrations/);
  }
});

// Each case changes one fact after a real apply and reverts it; postcheck must name it.
const POST_TAMPERS = [
  [
    "a weakened 0023 check",
    "alter table payout_policies drop constraint payout_policies_reward_bps, add constraint payout_policies_reward_bps check (reward_bps_of_volume is null or reward_bps_of_volume between 0 and 10000)",
    "alter table payout_policies drop constraint payout_policies_reward_bps, add constraint payout_policies_reward_bps check (reward_bps_of_volume is null or reward_bps_of_volume between 1 and 10000)",
    "payout_policies is not exactly 0023's table",
  ],
  [
    "a weakened 0023 hash check",
    "alter table distribution_publications drop constraint distribution_publications_root_format, add constraint distribution_publications_root_format check (root ~ '^[0-9a-f]+$')",
    "alter table distribution_publications drop constraint distribution_publications_root_format, add constraint distribution_publications_root_format check (root ~ '^[0-9a-f]{64}$')",
    "distribution_publications is not exactly 0023's table",
  ],
  [
    "a dropped 0023 index",
    "drop index epoch_payout_decisions_community",
    "create index epoch_payout_decisions_community on epoch_payout_decisions using btree (community_id)",
    "epoch_payout_decisions_community is not exactly 0023's index",
  ],
  [
    "a 0023 unique index made non-unique",
    "drop index hold_rulings_epoch_member; create index hold_rulings_epoch_member on hold_rulings (epoch_id, member_id)",
    "drop index hold_rulings_epoch_member; create unique index hold_rulings_epoch_member on hold_rulings (epoch_id, member_id)",
    "hold_rulings_epoch_member is not exactly 0023's index",
  ],
  [
    "a dropped 0023 foreign key",
    "alter table hold_rulings drop constraint hold_rulings_member_id_members_id_fk",
    "alter table hold_rulings add constraint hold_rulings_member_id_members_id_fk foreign key (member_id) references public.members(id)",
    "hold_rulings is not exactly 0023's table",
  ],
  [
    "row security on a 0023 table",
    "alter table hold_rulings enable row level security",
    "alter table hold_rulings disable row level security",
    "hold_rulings is not exactly 0023's table",
  ],
  [
    "a trigger on a 0023 table",
    "create function public.noop() returns trigger language plpgsql as $$ begin return new; end $$; create trigger t before insert on payout_policies for each row execute function public.noop()",
    "drop trigger t on payout_policies; drop function public.noop()",
    "payout_policies is not exactly 0023's table",
  ],
  [
    "a 0023 table set unlogged",
    "alter table epoch_payout_decisions set unlogged",
    "alter table epoch_payout_decisions set logged",
    "epoch_payout_decisions is not exactly 0023's table",
  ],
  [
    "an extra table",
    "create table public.payout_extra (id int)",
    "drop table public.payout_extra",
    "public has table(s) this release does not expect: payout_extra",
  ],
  [
    "a row in a 0023 table",
    "insert into payout_policies (community_id, effective_from_index, threshold_volume_lamports, basis) values ('00000000-0000-4000-8000-0000000000c1', 7, 1, 'cumulative')",
    "delete from payout_policies",
    "payout_policies has 1 row(s): it must be empty in this release",
  ],
  [
    "a hold ruling recorded",
    "insert into hold_rulings (epoch_id, member_id, verdict, reason, actor) values ('00000000-0000-4000-8000-00000000e005', '00000000-0000-4000-8000-0000000000a2', 'not_payable', 'outage', 'cisco')",
    "delete from hold_rulings",
    "hold_rulings has 1 row(s): it must be empty in this release",
  ],
  [
    "a frozen epoch 4 row changed",
    "update hold_checks set attempts = attempts + 1 where epoch_id = '00000000-0000-4000-8000-00000000e004'",
    "update hold_checks set attempts = attempts - 1 where epoch_id = '00000000-0000-4000-8000-00000000e004'",
    "epoch 4 differs from its frozen 2026-11-02 state: hold_digest",
  ],
  [
    "a frozen epoch 5 row changed",
    "update hold_checks set attempts = attempts + 1 where epoch_id = '00000000-0000-4000-8000-00000000e005'",
    "update hold_checks set attempts = attempts - 1 where epoch_id = '00000000-0000-4000-8000-00000000e005'",
    "epoch 5 differs from its frozen 2026-11-02 state: hold_digest",
  ],
  [
    "a frozen epoch 4 clearance removed",
    "delete from shared_handle_clearances",
    "insert into shared_handle_clearances (id, community_id, epoch_id, member_id, note, cleared_at) values ('00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000e004', '00000000-0000-4000-8000-0000000000a1', 'own member', '2026-10-29T12:00:00Z')",
    "shared_handle_clearances lost rows or is invalid (delta -1)",
  ],
];

test("postcheck refuses each tampered fact after a real apply", async (t) => {
  const name = await freshDb();
  const pre = precheckFile(name);
  assert.equal(pre.code, 0, JSON.stringify(problemsOf(pre)));
  await sql(name, recovery);
  assert.equal(run(pinnedScript, name, "migrate", pre.path).code, 0);
  assert.equal(run(pinnedScript, name, "postcheck", pre.path).code, 0);
  for (const [label, tamper, revert, message] of POST_TAMPERS) {
    await t.test(label, async () => {
      await sql(name, tamper);
      try {
        const res = run(pinnedScript, name, "postcheck", pre.path);
        assert.equal(res.code, 1);
        assert.ok(problemsOf(res).includes(message), JSON.stringify(problemsOf(res)));
      } finally {
        await sql(name, revert);
      }
      // Reverted, the database passes again, so the next case changes only its own fact.
      const clean = run(pinnedScript, name, "postcheck", pre.path);
      assert.deepEqual(problemsOf(clean), []);
    });
  }
});
