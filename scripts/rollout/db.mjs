// Production checks and one pinned migration release. Current release: migration 0022 for the
// Organic signed raid route (integration_raid_requests), pinned on 2026-11-02: epochs 4 and 5 are
// closed, unpaid and frozen (snapshot, hold checks and shared-handle clearances pinned, no
// publication intent), epoch 6 is open. The 0021 release (shared-handle clearances, 2026-10-26)
// used it before, the raid cards release for 0020, the 2026-10-11 release for 0018+0019, the Jev
// live scorer release for 0017, the pilot amendment release for 0016, the earn-first release for
// 0015 and the 2026-10-05 API rollout for 0013+0014 (see those plans and git history).
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
// Precheck and migrate refuse once the database clock is past 2 hours before epoch 6's close, so
// the release cannot run into the close and the payout hold window after it. The clock is read
// at the state read, again after the public reads, and inside the migration before every
// statement and the commit; a migration that crosses the deadline rolls back.
//
// Rehearsal: against a loopback database only, ROLLOUT_LIVE_FIXTURE=<json> replaces the live API
// reads with a file and ROLLOUT_DEADLINE=<ISO time> brings the deadline earlier, so a disposable
// Postgres can be checked and migrated. A non-loopback target always reads the live API and keeps
// the pinned deadline.
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
  "0022_integration_raid_requests":
    "20453fbc05f2b54f210c2821f5ffd138a16805c3aa1dd75c422555b7083f7a5c",
};
const EPOCH6_OPENS_AT = "2026-10-31T00:00:00.000Z";
const EPOCH6_CLOSES_AT = "2026-11-07T00:00:00.000Z";
const RELEASE_DEADLINE = new Date(Date.parse(EPOCH6_CLOSES_AT) - 2 * 60 * 60_000).toISOString();
// Every epoch's window to the microsecond, as read on 2026-11-02 (pg's Date keeps milliseconds).
const EPOCH_TIMES = {
  1: ["2026-09-25T00:00:00.000000", "2026-10-02T00:00:00.000000"],
  2: ["2026-10-02T00:00:00.000000", "2026-10-10T00:00:00.000000"],
  3: ["2026-10-10T00:00:00.000000", "2026-10-17T00:00:00.000000"],
  4: ["2026-10-17T00:00:00.000000", "2026-10-24T00:00:00.000000"],
  5: ["2026-10-24T00:00:00.000000", "2026-10-31T00:00:00.000000"],
  6: ["2026-10-31T00:00:00.000000", "2026-11-07T00:00:00.000000"],
};
// Schema-qualified so no function in the session's search_path can stand in for the clock.
const CLOCK = "select pg_catalog.clock_timestamp() as at";
// Microsecond-exact UTC text: pg's JS Date would round a timestamp to milliseconds.
const TS_US = `'YYYY-MM-DD"T"HH24:MI:SS.US'`;
const PAST_DEADLINE = "PAST_DEADLINE";
// Epochs 4 and 5 closed on 2026-10-24 and 2026-10-31 and are not paid (parked by Cisco on
// 2026-11-01 until funds exist). Their evidence is frozen: the release must find it exactly as read
// on 2026-11-02 and leave it exactly so. Counts alone would not notice an edited total, a moved
// observation or a changed clearance, so the evidence itself is pinned as a SHA-256 over every row
// in a fixed order (see readState). Neither epoch has an amendment, so its own config's prompt
// scores it.
const FROZEN = {
  4: {
    reward_config_id: "d265af98-202c-4425-9d7b-dfdd5d5715fa",
    prompt_version: "reward-eval/2",
    snapshot_closed_at: "2026-10-24T00:00:15.543Z",
    snapshot_entries: 178,
    snapshot_members: 17,
    snapshot_digest: "e93d8b40aca66c49ab1cdfc89c965fd24bce837f3f03d38cd44dc6355f9db1b3",
    hold_checks: 14,
    hold_holder: 14,
    hold_in_window: 14,
    hold_digest: "1e2edf9229648a9e0f395b199c22c7fc066aa614cb728a6e31cc27e8c02f972a",
    // Cisco's own member, cleared on 2026-10-29.
    clearances: 1,
    clearance_digest: "6d38932d8e371c329792d08f0d5e9ffae3dbfd313b4008043c3c20f7a52680d8",
    config_digest: "99b367e7cf69f637057dd49a4a949e0b4022f609a04670eda5c7ede53c90a0c6",
  },
  5: {
    reward_config_id: "d265af98-202c-4425-9d7b-dfdd5d5715fa",
    prompt_version: "reward-eval/2",
    snapshot_closed_at: "2026-10-31T00:00:32.985Z",
    snapshot_entries: 133,
    snapshot_members: 14,
    snapshot_digest: "5b3883dd3debbb577d34593f3fdb8fd32dde0ab48d73cfd0c31152c3e9d5a93b",
    // Its 13 reads failed (Helius 429) and the window ended with none decided: the ruling on them
    // is open, and this release must not move them.
    hold_checks: 13,
    hold_holder: 0,
    hold_in_window: 0,
    hold_digest: "8790dfa10c83caca3d24038d4e2b6e25bb07280e5b8f16cd6b47900b34ea4327",
    clearances: 0,
    clearance_digest: "",
    config_digest: "99b367e7cf69f637057dd49a4a949e0b4022f609a04670eda5c7ede53c90a0c6",
  },
};
// Epoch 6 is open and stays on the config it opened with, with no amendment.
const EPOCH6 = {
  reward_config_id: "bd8e5f63-6010-4f0f-8872-476d8323efc4",
  prompt_version: "reward-eval/2",
  config_digest: "06f3d0b4bd567f42b70604e610dddf2497aba8f1e246f1cd47fa3f7b2d3ad2aa",
};
// The community's rubric, publisher and chain address, as read on 2026-11-02.
const COMMUNITY_RULES_DIGEST = "93453dfb2b72b5e54a94d2b4b31e763d25e38e40048589d301fa9b1dc5233c7e";
// payout/gate.ts HOLD_WINDOW_MS: a balance counts only if read within this long after the close.
const HOLD_WINDOW_HOURS = 24;
// 0015 is applied before and after: the three member columns are nullable and the check exists.
const NULLABLE_COLUMNS = ["wallet", "link_method", "linked_at"];
const MEMBERS_CHECK = "members_wallet_link_together";
// 0017 is applied before and after: the amendments table keeps its three checks and its unique
// index per (epoch, from config).
const AMENDMENTS_TABLE = "reward_config_amendments";
const AMENDMENTS_CHECKS = [
  "reward_config_amendments_future",
  "reward_config_amendments_changes",
  "reward_config_amendments_hash_format",
];
const AMENDMENTS_INDEXES = ["reward_config_amendments_epoch_from(epoch_id,from_config_id)"];
// 0019 reuses 0013's enum for a recap's delivery state.
const RAID_STATUS_LABELS = ["pending", "sending", "sent", "skipped", "failed", "uncertain"];
// 0018 and 0019 are applied before and after: exactly the index and the table they create, read
// from the catalog. Types and referenced tables are schema-qualified, so the comparison does not
// depend on the session's search_path.
const WALLET_INDEX = "member_wallet_links_wallet";
const WALLET_INDEX_SHAPE = {
  table: "member_wallet_links",
  method: "btree",
  columns: "wallet",
  attributes: 1,
  key_attributes: 1,
  expressions: false,
  unique: false,
  partial: false,
  valid: true,
};
// Every table this script checks is permanent, owned like members, with no row security, policy,
// trigger or rule.
const PERMANENT_PLAIN_TABLE = {
  persistence: "p",
  row_security: false,
  force_row_security: false,
  owner_is_members_owner: true,
  triggers: [],
  rules: [],
  policies: [],
};
const RAID_RECAPS = "raid_recaps";
const RAID_RECAPS_SHAPE = {
  relation: PERMANENT_PLAIN_TABLE,
  columns: [
    "task_id pg_catalog.uuid not null",
    "community_id pg_catalog.uuid not null",
    "status public.raid_delivery_status not null",
    "next_attempt_at pg_catalog.timestamptz not null",
    "retry_used pg_catalog.bool not null default false",
    "attempted_at pg_catalog.timestamptz not null",
    "sent_at pg_catalog.timestamptz null",
    "telegram_message_id pg_catalog.int4 null",
    "reason pg_catalog.text null",
  ],
  constraints: [
    "raid_recaps_community_id_communities_id_fk f (community_id) -> public.communities(id) a/a",
    "raid_recaps_pkey p (task_id)",
    "raid_recaps_task_id_tasks_id_fk f (task_id) -> public.tasks(id) a/a",
  ],
  indexes: ["raid_recaps_pkey"],
};
// 0020 is applied before and after: exactly its two enums, table and index.
const CARD_ENUMS = {
  raid_card_format: ["photo", "text"],
  raid_card_state: ["open", "ended", "cancelled", "gone"],
};
const RAID_CARDS = "raid_cards";
const RAID_CARDS_SHAPE = {
  relation: PERMANENT_PLAIN_TABLE,
  columns: [
    "task_id pg_catalog.uuid not null",
    "community_id pg_catalog.uuid not null",
    "telegram_chat_id pg_catalog.int8 not null",
    "telegram_message_id pg_catalog.int4 not null",
    "format public.raid_card_format not null",
    "state public.raid_card_state not null",
    "rendered_hash pg_catalog.text not null",
    "next_refresh_at pg_catalog.timestamptz null",
    "hold_until pg_catalog.timestamptz null",
    "pinned_at pg_catalog.timestamptz null",
    "unpinned_at pg_catalog.timestamptz null",
    "pin_error pg_catalog.text null",
    "results_message_id pg_catalog.int4 null",
    "created_at pg_catalog.timestamptz not null default now()",
  ],
  constraints: [
    "raid_cards_community_id_communities_id_fk f (community_id) -> public.communities(id) a/a",
    "raid_cards_pkey p (task_id)",
    "raid_cards_task_id_tasks_id_fk f (task_id) -> public.tasks(id) a/a",
  ],
  indexes: ["raid_cards_due", "raid_cards_pkey"],
};
const CARDS_INDEX = "raid_cards_due";
const CARDS_INDEX_SHAPE = {
  table: RAID_CARDS,
  method: "btree",
  columns: "next_refresh_at",
  attributes: 1,
  key_attributes: 1,
  expressions: false,
  unique: false,
  partial: false,
  valid: true,
};
// 0021 is applied before and after: exactly its table and unique index.
const SHARED = "shared_handle_clearances";
const SHARED_SHAPE = {
  relation: PERMANENT_PLAIN_TABLE,
  columns: [
    "id pg_catalog.uuid not null default gen_random_uuid()",
    "community_id pg_catalog.uuid not null",
    "epoch_id pg_catalog.uuid not null",
    "member_id pg_catalog.uuid not null",
    "note pg_catalog.text not null",
    "cleared_at pg_catalog.timestamptz not null default now()",
  ],
  constraints: [
    "shared_handle_clearances_community_id_communities_id_fk f (community_id) -> public.communities(id) a/a",
    "shared_handle_clearances_epoch_id_epochs_id_fk f (epoch_id) -> public.epochs(id) a/a",
    "shared_handle_clearances_member_id_members_id_fk f (member_id) -> public.members(id) a/a",
    "shared_handle_clearances_pkey p (id)",
  ],
  indexes: ["shared_handle_clearances_epoch_member", "shared_handle_clearances_pkey"],
};
const SHARED_INDEX = "shared_handle_clearances_epoch_member";
const SHARED_INDEX_SHAPE = {
  table: SHARED,
  method: "btree",
  columns: "epoch_id,member_id",
  attributes: 2,
  key_attributes: 2,
  expressions: false,
  unique: true,
  partial: false,
  valid: true,
};
// What 0022 creates. Its checks are compared with their definitions, so a weaker check differs.
const INTEGRATION = "integration_raid_requests";
const INTEGRATION_SHAPE = {
  relation: PERMANENT_PLAIN_TABLE,
  columns: [
    "id pg_catalog.uuid not null default gen_random_uuid()",
    "community_id pg_catalog.uuid not null",
    "idempotency_key pg_catalog.uuid not null",
    "request_hash pg_catalog.text not null",
    "key_id pg_catalog.text not null",
    "actor_organic_user_id pg_catalog.text not null",
    "actor_role pg_catalog.text not null",
    "task_id pg_catalog.uuid not null",
    "state pg_catalog.text not null",
    "response pg_catalog.jsonb null",
    "created_at pg_catalog.timestamptz not null default now()",
    "completed_at pg_catalog.timestamptz null",
  ],
  constraints: [
    "integration_raid_requests_community_id_communities_id_fk f (community_id) -> public.communities(id) a/a",
    "integration_raid_requests_hash c (request_hash) CHECK ((request_hash ~ '^[0-9a-f]{64}$'::text))",
    "integration_raid_requests_pkey p (id)",
    "integration_raid_requests_role c (actor_role) CHECK ((actor_role = ANY (ARRAY['admin'::text, 'steward'::text])))",
    "integration_raid_requests_state c (state,response,completed_at) CHECK ((((state = 'announcing'::text) AND (response IS NULL) AND (completed_at IS NULL)) OR ((state = 'created'::text) AND (response IS NOT NULL) AND (completed_at IS NOT NULL))))",
    "integration_raid_requests_task_id_tasks_id_fk f (task_id) -> public.tasks(id) a/a",
  ],
  indexes: [
    "integration_raid_requests_key",
    "integration_raid_requests_pkey",
    "integration_raid_requests_task",
  ],
};
const INTEGRATION_INDEXES = {
  integration_raid_requests_key: {
    table: INTEGRATION,
    method: "btree",
    columns: "community_id,idempotency_key",
    attributes: 2,
    key_attributes: 2,
    expressions: false,
    unique: true,
    partial: false,
    valid: true,
  },
  integration_raid_requests_task: {
    table: INTEGRATION,
    method: "btree",
    columns: "task_id",
    attributes: 1,
    key_attributes: 1,
    expressions: false,
    unique: true,
    partial: false,
    valid: true,
  },
};
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
  "epoch_publications",
  "hold_checks",
  RAID_RECAPS,
  RAID_CARDS,
  SHARED,
  INTEGRATION,
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

// Every mode refuses a migrations folder that does not end with exactly this release's migrations,
// in order, at their pinned hashes.
function expectedJournal() {
  const journal = JSON.parse(readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8"));
  const entries = journal.entries.map((e) => ({
    tag: e.tag,
    created_at: String(e.when),
    hash: createHash("sha256")
      .update(readFileSync(join(migrationsFolder, `${e.tag}.sql`)))
      .digest("hex"),
  }));
  const tail = entries.slice(-Object.keys(NEW_MIGRATIONS).length);
  if (
    !isDeepStrictEqual(
      tail.map((e) => [e.tag, e.hash]),
      Object.entries(NEW_MIGRATIONS),
    )
  )
    throw new Error(
      `the migrations folder does not end with this release's pinned migrations: it ends with ${tail
        .map((e) => `${e.tag} sha256 ${e.hash}`)
        .join(", ")}`,
    );
  return entries;
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
        where conname = $1 and conrelid = 'public.members'::regclass and contype = 'c'
          and convalidated`,
      [MEMBERS_CHECK],
    )
  ).rows[0].n;
  const exists = async (name) =>
    (await client.query("select to_regclass($1) is not null as e", [`public.${name}`])).rows[0].e;
  const rows = async (text, name) =>
    (await client.query(text, [`public.${name}`])).rows.map((r) => r.v);
  const amendments = (await exists(AMENDMENTS_TABLE))
    ? {
        checks: await rows(
          `select conname || ${constraintFlags("pg_constraint")} as v from pg_constraint
            where conrelid = $1::regclass and contype = 'c' order by conname`,
          AMENDMENTS_TABLE,
        ),
        // Every unique index on the table with its column list, so a change is seen exactly.
        unique_indexes: await rows(
          `select c.relname || '(' || ${columnList("x.indkey", "x.indrelid")} || ')' as v
             from pg_index x join pg_class c on c.oid = x.indexrelid
            where x.indrelid = $1::regclass and x.indisunique and not x.indisprimary
            order by c.relname`,
          AMENDMENTS_TABLE,
        ),
        rows: (await client.query(`select count(*)::int as n from public.${AMENDMENTS_TABLE}`))
          .rows[0].n,
      }
    : null;
  // Null when the enum does not exist.
  const enumLabels = async (name) =>
    (
      await client.query(
        `select array_agg(e.enumlabel::text order by e.enumsortorder) as labels
           from pg_enum e join pg_type t on t.oid = e.enumtypid
           join pg_namespace n on n.oid = t.typnamespace
          where n.nspname = 'public' and t.typname = $1`,
        [name],
      )
    ).rows[0].labels;
  const indexShape = async (name) =>
    (await exists(name))
      ? ((
          await client.query(
            `select t.relname as table, am.amname as method,
                    ${columnList("x.indkey", "x.indrelid")} as columns,
                    x.indnatts as attributes, x.indnkeyatts as key_attributes,
                    x.indexprs is not null as expressions,
                    x.indisunique as unique, x.indpred is not null as partial, x.indisvalid as valid
               from pg_index x join pg_class c on c.oid = x.indexrelid
               join pg_class t on t.oid = x.indrelid join pg_am am on am.oid = c.relam
              where x.indexrelid = $1::regclass`,
            [`public.${name}`],
          )
        ).rows[0] ?? { not_an_index: true })
      : null;
  const tableShape = async (name) =>
    (await exists(name))
      ? {
          // Table-level settings that change what the app can write or read without touching a
          // column: an unlogged table is emptied after a crash; row security, a policy, a
          // trigger or a rule can hide, block or rewrite rows; another owner changes who may
          // write.
          relation: (
            await client.query(
              `select c.relpersistence::text as persistence, c.relrowsecurity as row_security,
                      c.relforcerowsecurity as force_row_security,
                      c.relowner = m.relowner as owner_is_members_owner,
                      array(select g.tgname::text from pg_trigger g
                             where g.tgrelid = c.oid and not g.tgisinternal order by 1) as triggers,
                      array(select w.rulename::text from pg_rewrite w
                             where w.ev_class = c.oid order by 1) as rules,
                      array(select p.polname::text from pg_policy p
                             where p.polrelid = c.oid order by 1) as policies
                 from pg_class c, pg_class m
                where c.oid = $1::regclass and m.oid = 'public.members'::regclass`,
              [`public.${name}`],
            )
          ).rows[0],
          columns: await rows(
            `select a.attname || ' ' || tn.nspname || '.' || t.typname
                    || case when a.atttypmod <> -1 then '(' || a.atttypmod::text || ')' else '' end
                    || case when a.attndims > 0 then '[]' else '' end
                    || case when a.attnotnull then ' not null' else ' null' end
                    || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '') as v
               from pg_attribute a join pg_type t on t.oid = a.atttypid
               join pg_namespace tn on tn.oid = t.typnamespace
               left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
              where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped
              order by a.attnum`,
            name,
          ),
          // Not-null is read from the columns: Postgres 18 also lists it here as contype 'n'.
          constraints: await rows(
            `select k.conname || ' ' || k.contype::text
                    || ' (' || ${columnList("k.conkey", "k.conrelid")} || ')'
                    || case when k.contype = 'f'
                         then ' -> ' || rn.nspname || '.' || r.relname
                              || '(' || ${columnList("k.confkey", "k.confrelid")} || ') '
                              || k.confupdtype::text || '/' || k.confdeltype::text
                         else '' end
                    || case when k.contype = 'c' then ' ' || pg_get_constraintdef(k.oid) else '' end
                    || ${constraintFlags("k")} as v
               from pg_constraint k left join pg_class r on r.oid = k.confrelid
               left join pg_namespace rn on rn.oid = r.relnamespace
              where k.conrelid = $1::regclass and k.contype in ('c', 'f', 'p', 'u', 'x')
              order by k.conname`,
            name,
          ),
          indexes: await rows(
            `select c.relname as v from pg_index x join pg_class c on c.oid = x.indexrelid
              where x.indrelid = $1::regclass order by c.relname`,
            name,
          ),
        }
      : null;
  const cardEnums = {};
  for (const name of Object.keys(CARD_ENUMS)) cardEnums[name] = await enumLabels(name);
  return {
    nullable,
    members_check_exists: check === 1,
    amendments_table: amendments,
    raid_delivery_status: await enumLabels("raid_delivery_status"),
    wallet_index: await indexShape(WALLET_INDEX),
    raid_recaps: await tableShape(RAID_RECAPS),
    card_enums: cardEnums,
    cards_index: await indexShape(CARDS_INDEX),
    raid_cards: await tableShape(RAID_CARDS),
    shared_index: await indexShape(SHARED_INDEX),
    shared: await tableShape(SHARED),
    integration_indexes: Object.fromEntries(
      await Promise.all(
        Object.keys(INTEGRATION_INDEXES).map(async (name) => [name, await indexShape(name)]),
      ),
    ),
    integration: await tableShape(INTEGRATION),
  };
}

// The columns of an index or constraint, by name and in key order. An expression key has
// attribute number 0 and no pg_attribute row, so it is named "(expression)", not dropped.
const columnList = (keys, rel) =>
  `(select string_agg(coalesce(col_att.attname, '(expression)'), ',' order by col_key.ord)
      from unnest(${keys}) with ordinality as col_key(attnum, ord)
      left join pg_attribute col_att
        on col_att.attrelid = ${rel} and col_att.attnum = col_key.attnum)`;

// A constraint that is NOT VALID or deferrable reads with that suffix, so it never equals the
// expected shape, which lists only validated, immediate constraints.
const constraintFlags = (k) =>
  `case when ${k}.convalidated then '' else ' not valid' end
   || case when ${k}.condeferrable then ' deferrable' else '' end
   || case when ${k}.condeferred then ' initially deferred' else '' end`;

// Before and after: 0015, 0017, 0018, 0019, 0020 and 0021 applied. Before: nothing of 0022.
// After: exactly 0022's table and two unique indexes as well.
function shapeProblems(shape, phase) {
  const problems = [];
  if (!NULLABLE_COLUMNS.every((c) => shape.nullable[c] === true) || !shape.members_check_exists)
    problems.push("members does not have 0015's shape");
  if (
    !isDeepStrictEqual(shape.amendments_table?.checks, [...AMENDMENTS_CHECKS].sort()) ||
    !isDeepStrictEqual(shape.amendments_table?.unique_indexes, AMENDMENTS_INDEXES)
  )
    problems.push(`${AMENDMENTS_TABLE} is not exactly 0017's table`);
  if (!isDeepStrictEqual(shape.raid_delivery_status, RAID_STATUS_LABELS))
    problems.push("enum raid_delivery_status is missing or its labels differ");
  if (!isDeepStrictEqual(shape.wallet_index, WALLET_INDEX_SHAPE))
    problems.push(`${WALLET_INDEX} is not exactly 0018's index`);
  if (!isDeepStrictEqual(shape.raid_recaps, RAID_RECAPS_SHAPE))
    problems.push(`${RAID_RECAPS} is not exactly 0019's table`);
  for (const [name, labels] of Object.entries(CARD_ENUMS)) {
    if (!isDeepStrictEqual(shape.card_enums[name], labels))
      problems.push(`enum ${name} is missing or its labels differ`);
  }
  if (!isDeepStrictEqual(shape.cards_index, CARDS_INDEX_SHAPE))
    problems.push(`${CARDS_INDEX} is not exactly 0020's index`);
  if (!isDeepStrictEqual(shape.raid_cards, RAID_CARDS_SHAPE))
    problems.push(`${RAID_CARDS} is not exactly 0020's table`);
  if (!isDeepStrictEqual(shape.shared_index, SHARED_INDEX_SHAPE))
    problems.push(`${SHARED_INDEX} is not exactly 0021's index`);
  if (!isDeepStrictEqual(shape.shared, SHARED_SHAPE))
    problems.push(`${SHARED} is not exactly 0021's table`);
  if (phase === "pre") {
    for (const [name, index] of Object.entries(shape.integration_indexes))
      if (index !== null) problems.push(`${name} already exists`);
    if (shape.integration !== null) problems.push(`${INTEGRATION} already exists`);
  } else {
    for (const [name, index] of Object.entries(INTEGRATION_INDEXES))
      if (!isDeepStrictEqual(shape.integration_indexes[name], index))
        problems.push(`${name} is not exactly 0022's index`);
    if (!isDeepStrictEqual(shape.integration, INTEGRATION_SHAPE))
      problems.push(`${INTEGRATION} is not exactly 0022's table`);
  }
  return problems;
}
const untouched = (shape) => shapeProblems(shape, "pre").length === 0;
const applied = (shape) => shapeProblems(shape, "post").length === 0;

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
            reward_intake_paused_at,
            encode(sha256(convert_to(concat_ws(chr(10), quote_nullable(rubric_version),
                quote_nullable(rubric::text), quote_nullable(publisher_pubkey),
                quote_nullable(chain_address)), 'UTF8')), 'hex') as rules_digest
       from communities order by created_at`,
  );
  s.epochs = await one(
    `select e.index, e.status::text, e.opens_at, e.closes_at, e.reward_config_id, e.publish_tx,
            to_char(e.opens_at at time zone 'UTC', ${TS_US}) as opens_at_us,
            to_char(e.closes_at at time zone 'UTC', ${TS_US}) as closes_at_us,
            e.root is not null as has_root, e.pot_lamports is not null as has_pot,
            rc.payload->'scoring'->>'promptVersion' as prompt_version,
            (select count(*)::int from reward_epoch_snapshots r where r.epoch_id = e.id) as snapshots,
            (select r.closed_at from reward_epoch_snapshots r where r.epoch_id = e.id)
              as snapshot_closed_at,
            (select count(*)::int from reward_snapshot_entries x
               join reward_epoch_snapshots r on r.id = x.snapshot_id where r.epoch_id = e.id)
              as snapshot_entries,
            (select count(*)::int from reward_snapshot_members x
               join reward_epoch_snapshots r on r.id = x.snapshot_id where r.epoch_id = e.id)
              as snapshot_members,
            (select count(*)::int from epoch_publications p where p.epoch_id = e.id) as intents,
            (select count(*)::int from leaves l where l.epoch_id = e.id) as leaves,
            (select count(*)::int from hold_checks h where h.epoch_id = e.id) as hold_checks,
            (select count(*)::int from hold_checks h where h.epoch_id = e.id
                and h.status = 'holder') as hold_holder,
            (select count(*)::int from hold_checks h where h.epoch_id = e.id
                and h.observed_at >= e.closes_at
                and h.observed_at <= e.closes_at + make_interval(hours => ${HOLD_WINDOW_HOURS}))
              as hold_in_window,
            (select encode(sha256(convert_to(
                to_char(r.closes_at at time zone 'UTC', ${TS_US}) || chr(10) ||
                to_char(r.closed_at at time zone 'UTC', ${TS_US}) || chr(10) ||
                r.cutoff_assumption || chr(10) ||
                coalesce((select string_agg(
                    x.contribution_id::text || '|' || x.member_id::text || '|' ||
                    coalesce(x.decision_id::text, '') || '|' || coalesce(x.decision_hash, '') || '|' ||
                    coalesce(x.revision::text, '') || '|' || coalesce(x.reason::text, '') || '|' ||
                    x.point_units::text, chr(10) order by x.contribution_id)
                  from reward_snapshot_entries x where x.snapshot_id = r.id), '') || chr(10) ||
                coalesce((select string_agg(
                    m.member_id::text || '|' || m.point_units::text || '|' || m.whole_points::text,
                    chr(10) order by m.member_id)
                  from reward_snapshot_members m where m.snapshot_id = r.id), ''),
              'UTF8')), 'hex')
               from reward_epoch_snapshots r where r.epoch_id = e.id) as snapshot_digest,
            (select encode(sha256(convert_to(coalesce(string_agg(concat_ws('|',
                quote_nullable(h.id), quote_nullable(h.community_id), quote_nullable(h.member_id),
                quote_nullable(h.wallet), quote_nullable(h.mint), quote_nullable(h.threshold_raw),
                quote_nullable(h.check_round), quote_nullable(h.status), quote_nullable(h.reason),
                quote_nullable(h.attempts), quote_nullable(h.raw_amount),
                quote_nullable(h.decimals), quote_nullable(h.provider), quote_nullable(h.slot),
                quote_nullable(to_char(h.observed_at at time zone 'UTC', ${TS_US})),
                quote_nullable(to_char(h.checked_at at time zone 'UTC', ${TS_US})),
                quote_nullable(to_char(h.created_at at time zone 'UTC', ${TS_US}))),
                chr(10) order by h.member_id, h.id), ''), 'UTF8')), 'hex')
               from hold_checks h where h.epoch_id = e.id) as hold_digest,
            (select count(*)::int from shared_handle_clearances k where k.epoch_id = e.id)
              as clearances,
            (select coalesce(encode(sha256(convert_to(string_agg(
                k.member_id::text || '|' || k.community_id::text || '|' || k.note || '|' ||
                to_char(k.cleared_at at time zone 'UTC', ${TS_US}),
                chr(10) order by k.member_id), 'UTF8')), 'hex'), '')
               from shared_handle_clearances k where k.epoch_id = e.id) as clearance_digest,
            (select count(*)::int from reward_config_amendments a where a.epoch_id = e.id)
              as amendments,
            -- The whole config row, not only its id and prompt: the payout gate reads the
            -- payload (the hold threshold among it).
            encode(sha256(convert_to(concat_ws(chr(10), quote_nullable(rc.id),
                quote_nullable(rc.community_id), quote_nullable(rc.payload_version),
                quote_nullable(rc.payload::text), quote_nullable(rc.digest),
                quote_nullable(rc.config_hash),
                quote_nullable(to_char(rc.created_at at time zone 'UTC', ${TS_US}))), 'UTF8')), 'hex')
              as config_digest
       from epochs e join communities c on c.id = e.community_id
       left join reward_configs rc on rc.id = e.reward_config_id
      where c.mint = $1 order by e.index`,
    [MINT],
  );
  s.counts = {};
  for (const t of COUNTED_TABLES) {
    // Before 0022 its table does not exist and holds no rows; the shape says whether it exists.
    s.counts[t] =
      t === INTEGRATION && s.shape.integration === null
        ? 0
        : (await one(`select count(*)::int as n from public.${t}`))[0].n;
  }
  s.long_transactions = await one(
    `select pid, state, backend_type, pg_catalog.now() - xact_start as age from pg_stat_activity
      where xact_start < pg_catalog.now() - interval '5 seconds' and pid <> pg_backend_pid()
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
                where state in ('created', 'retry')
                  and created_on < pg_catalog.now() - interval '10 minutes'`,
            )
          )[0].n,
          last_reward_recovery_completed: last,
        };
  s.reference = (
    await one("select pg_catalog.clock_timestamp() as at, pg_current_wal_lsn()::text as lsn")
  )[0];
  return s;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

// The override can only bring the deadline earlier, so no target that merely looks local gets a
// later one.
function releaseDeadline(target) {
  const override = process.env.ROLLOUT_DEADLINE;
  if (!override) return RELEASE_DEADLINE;
  if (!LOOPBACK.has(target.host)) throw new Error("ROLLOUT_DEADLINE is for loopback only");
  const at = new Date(override).toISOString();
  return ms(at) < ms(RELEASE_DEADLINE) ? at : RELEASE_DEADLINE;
}

// One problem when the database clock `at` is past the deadline, none otherwise.
const lateness = (at, deadline, when) =>
  ms(at) <= ms(deadline)
    ? []
    : [`${when}, the database clock ${new Date(at).toISOString()} is past ${deadline}`];

// The deadline at the state read, and again after the public reads, which can be slow.
async function deadlineProblems(conn, state, deadline) {
  const after = await withReadOnly(conn, async (c) => (await c.query(CLOCK)).rows[0].at);
  return [
    ...lateness(state.reference.at, deadline, "at the state read"),
    ...lateness(after, deadline, "after the public reads"),
  ];
}

// The migration's connection reads the database clock before every statement the migrator sends,
// commit included, so a migration that crosses the deadline rolls back with nothing applied. The
// deadline holds to within one round trip. BEGIN is not checked: drizzle sends it outside its
// try/finally, so a throw there would never release the pool's client and pool.end() would hang;
// the first statement after it is checked instead.
const UNCHECKED = new Set(["begin", "rollback"]);
function deadlineClient(Client, deadline) {
  return class extends Client {
    query(config, values, callback) {
      if (typeof values === "function") return this.query(config, undefined, values);
      const text = typeof config === "string" ? config : config.text;
      const run = async () => {
        if (!UNCHECKED.has(text)) {
          const [{ at }] = (await super.query(CLOCK)).rows;
          const before = text.replace(/\s+/g, " ").trim().slice(0, 60);
          const late = lateness(at, deadline, `inside the migration, before "${before}"`);
          if (late.length) throw Object.assign(new Error(late[0]), { code: PAST_DEADLINE });
        }
        return super.query(config, values);
      };
      if (!callback) return run();
      run().then((res) => callback(null, res), callback);
    }
  };
}

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
    epoch3: await get(`/v1/communities/${MINT}/epochs/3`),
    epoch4: await get(`/v1/communities/${MINT}/epochs/4`),
    epoch5: await get(`/v1/communities/${MINT}/epochs/5`),
    epoch6: await get(`/v1/communities/${MINT}/epochs/6`),
  };
}

const ms = (v) => new Date(v).getTime();

// The read API derives an epoch's status from its snapshot, so a published epoch reads as closed.
const publicStatus = (e) => (e.status === "open" ? "open" : "closed");

// Where a public epoch, from the community list or a detail read, differs from its database row.
function epochDifferences(de, pe) {
  const differs = [];
  if (pe?.index !== de.index) differs.push("index");
  if (ms(pe?.opens_at) !== ms(de.opens_at)) differs.push("opens_at");
  if (ms(pe?.closes_at) !== ms(de.closes_at)) differs.push("closes_at");
  if (pe?.status !== publicStatus(de)) differs.push("status");
  return differs;
}

function checkState(s, live, journalExpected, phase) {
  const problems = [];
  const fail = (msg) => problems.push(msg);
  const newCount = Object.keys(NEW_MIGRATIONS).length;
  const appliedCount = phase === "pre" ? journalExpected.length - newCount : journalExpected.length;

  const iso = (d) => d?.toISOString();
  if (s.read_only !== "on") fail(`transaction_read_only is ${s.read_only}`);
  if (s.lock_timeout !== "3s") fail(`lock_timeout is ${s.lock_timeout}, not 3s`);
  if (!journalMatches(s.journal, journalExpected.slice(0, appliedCount)))
    fail(
      `journal (${s.journal.length} rows) is not exactly the first ${appliedCount} expected entries`,
    );
  problems.push(...shapeProblems(s.shape, phase));

  if (s.communities.length !== 1) fail(`communities has ${s.communities.length} rows, expected 1`);
  const lab = s.communities[0];
  if (lab?.mint !== MINT || lab?.name !== "Hyphae Lab") fail("community is not Hyphae Lab");
  if (lab?.first_paid_epoch !== 2) fail(`first_paid_epoch is ${lab?.first_paid_epoch}`);
  if (lab?.reward_intake_paused_at !== null) fail("reward intake is paused");
  if (lab?.rules_digest !== COMMUNITY_RULES_DIGEST)
    fail("community rubric, publisher or chain address differs from the one read on 2026-11-02");

  const e1 = s.epochs.find((e) => e.index === 1);
  const e2 = s.epochs.find((e) => e.index === 2);
  const e3 = s.epochs.find((e) => e.index === 3);
  const e4 = s.epochs.find((e) => e.index === 4);
  const e5 = s.epochs.find((e) => e.index === 5);
  const e6 = s.epochs.find((e) => e.index === 6);
  if (s.epochs.length !== 6) fail(`Hyphae Lab has ${s.epochs.length} epochs, expected 6`);
  for (const [index, [opens, closes]] of Object.entries(EPOCH_TIMES)) {
    const e = s.epochs.find((x) => x.index === Number(index));
    if (e?.opens_at_us !== opens || e?.closes_at_us !== closes)
      fail(`epoch ${index} does not run exactly from ${opens} to ${closes} UTC`);
  }
  if (e1?.status !== "closed" || e1?.snapshots !== 1) fail("epoch 1 is not closed with 1 snapshot");
  // Epochs 2 and 3 were paid: publishing writes status, root and publish_tx together.
  for (const [index, e, closes] of [
    [2, e2, "2026-10-10T00:00:00.000Z"],
    [3, e3, "2026-10-17T00:00:00.000Z"],
  ]) {
    if (
      e?.status !== "published" ||
      !e.publish_tx ||
      e.snapshots !== 1 ||
      iso(e.closes_at) !== closes
    )
      fail(`epoch ${index} is not published, closed at ${closes} with 1 snapshot`);
  }
  // Epochs 4 and 5 are closed and unpaid: no intent, leaf, root, pot or publish_tx, no amendment,
  // and every frozen fact exactly as pinned.
  for (const [index, e] of [
    [4, e4],
    [5, e5],
  ]) {
    const frozen = FROZEN[index];
    if (e?.status !== "closed" || e?.snapshots !== 1)
      fail(`epoch ${index} is not closed with 1 snapshot`);
    const differs = Object.entries(frozen)
      .filter(([key, want]) => {
        const got = e?.[key];
        return (got instanceof Date ? got.toISOString() : got) !== want;
      })
      .map(([key]) => key);
    if (differs.length)
      fail(`epoch ${index} differs from its frozen 2026-11-02 state: ${differs.join(", ")}`);
    if (e?.intents !== 0 || e?.leaves !== 0 || e?.has_root || e?.has_pot || e?.publish_tx !== null)
      fail(`epoch ${index} already has a publication intent, leaf, root, pot or publish_tx`);
    if (e?.amendments !== 0) fail(`epoch ${index} has an amendment`);
  }
  if (
    e6?.status !== "open" ||
    e6?.snapshots !== 0 ||
    iso(e6?.opens_at) !== EPOCH6_OPENS_AT ||
    iso(e6?.closes_at) !== EPOCH6_CLOSES_AT
  )
    fail(`epoch 6 is not open from ${EPOCH6_OPENS_AT} to ${EPOCH6_CLOSES_AT} with 0 snapshots`);
  if (
    e6?.reward_config_id !== EPOCH6.reward_config_id ||
    e6?.prompt_version !== EPOCH6.prompt_version ||
    e6?.config_digest !== EPOCH6.config_digest ||
    e6?.amendments !== 0
  )
    fail(`epoch 6 is not on config ${EPOCH6.reward_config_id} with no amendment`);
  // Nothing is planned, published or checked for epoch 6 before it closes.
  if (
    e6?.intents !== 0 ||
    e6?.leaves !== 0 ||
    e6?.has_root ||
    e6?.has_pot ||
    e6?.publish_tx !== null ||
    e6?.hold_checks !== 0 ||
    e6?.clearances !== 0
  )
    fail("epoch 6 already has an intent, leaf, root, pot, publish_tx, hold check or clearance");

  // Consistency with what the live API serves (identity comes from liveness, see the header).
  if (live.community.name !== lab?.name) fail("public name differs");
  const intake = lab?.reward_intake_paused_at === null ? "open" : "paused";
  if (live.community.reward_intake !== intake) fail("public intake state differs");
  for (const pe of live.community.epochs) {
    const de = s.epochs.find((e) => e.index === pe.index);
    const differs = de ? epochDifferences(de, pe) : ["not in the database"];
    if (differs.length) fail(`public epoch ${pe.index} differs: ${differs.join(", ")}`);
  }
  if (live.community.epochs.length !== s.epochs.length) fail("public epoch count differs");
  // Each detail read against its database epoch. The API's `closed` is its clock past closes_at
  // and `final` is the snapshot: an epoch it shows as open has neither, a closed one has both.
  for (const [de, pe] of [
    [e3, live.epoch3],
    [e4, live.epoch4],
    [e5, live.epoch5],
    [e6, live.epoch6],
  ]) {
    if (!de) continue; // its database state has already failed above
    const differs = epochDifferences(de, pe);
    if (pe?.closed !== (publicStatus(de) === "closed")) differs.push("closed");
    if (pe?.final !== de.snapshots > 0) differs.push("final");
    if (pe?.config?.id !== de.reward_config_id) differs.push("reward config");
    if (pe?.config?.prompt_version !== de.prompt_version) differs.push("prompt version");
    if (pe?.amendments?.length !== de.amendments) differs.push("amendments");
    if (differs.length) fail(`public epoch ${de.index} detail differs: ${differs.join(", ")}`);
  }
  // The API shows a publication only from the stored publish_tx, after verifying it on chain. A
  // stored one it shows as unavailable can be a failed chain read, so only this direction fails.
  const allocation = live.epoch3?.settlement?.allocation;
  if (allocation?.status === "published" && allocation.publish_tx !== e3?.publish_tx)
    fail("public epoch 3 publication is not the database's publish_tx");
  // The database has no publication for epochs 4 to 6, so the API must not show one.
  for (const [index, pe] of [
    [4, live.epoch4],
    [5, live.epoch5],
    [6, live.epoch6],
  ])
    if (pe?.settlement?.allocation?.status === "published")
      fail(`public epoch ${index} shows a publication the database does not have`);

  for (const t of COUNTED_TABLES) {
    if (!Number.isInteger(s.counts[t]) || s.counts[t] < 0) fail(`count of ${t} is invalid`);
  }
  // Organic's requests can arrive only after its key exists, which comes after this release.
  if (s.counts[INTEGRATION] !== 0)
    fail(`${INTEGRATION} has ${s.counts[INTEGRATION]} row(s): requests come only after the key`);
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
  // This release records no amendment: epochs 4 to 6 stay on their own config's prompt.
  if (deltas.reward_config_amendments !== 0)
    problems.push(`reward_config_amendments changed by ${deltas.reward_config_amendments}`);
  // Nothing is closed, planned, cleared or checked for a balance while the release runs.
  for (const t of [
    SHARED,
    "epoch_publications",
    "hold_checks",
    "reward_snapshot_entries",
    "leaves",
    "epochs",
  ])
    if (deltas[t] !== 0) problems.push(`${t} changed by ${deltas[t]}`);
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
  const deadline = releaseDeadline(conn.target);
  const state = await withReadOnly(conn, readState);
  const live = await publicReads(conn.target);
  const problems = checkState(state, live, journalExpected, phase);
  if (phase === "pre") problems.push(...(await deadlineProblems(conn, state, deadline)));
  const allocation = live.epoch3?.settlement?.allocation;
  const report = {
    phase,
    target: conn.target,
    // The public side needs the API's chain read, which can fail: recorded, not required.
    epoch3_publication: {
      database: state.epochs.find((e) => e.index === 3)?.status ?? null,
      public: allocation?.status ?? null,
      public_reason: allocation?.reason ?? null,
    },
  };
  if (phase === "pre") report.deadline = deadline;
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
  const deadline = releaseDeadline(conn.target);
  const beforeCount = journalExpected.length - Object.keys(NEW_MIGRATIONS).length;
  const before = journalExpected.slice(0, beforeCount);
  const lastBefore = before.at(-1)?.tag;
  console.error(`target ${JSON.stringify(conn.target)} deadline ${deadline}`);

  const { baseline, problems } = loadBaseline(baselinePath, conn.target);
  const gate = await withReadOnly(conn, async (c) => ({
    journal: await readJournal(c),
    state: await readState(c),
  }));
  if (problems.length === 0) problems.push(...compareToBaseline(baseline, gate.state).problems);
  // Every precheck condition must still hold now, not only when the baseline was taken.
  problems.push(...checkState(gate.state, await publicReads(conn.target), journalExpected, "pre"));
  problems.push(...(await deadlineProblems(conn, gate.state, deadline)));
  if (!journalMatches(gate.journal, before))
    problems.push(`journal is not exactly the ${beforeCount} migrations up to ${lastBefore}`);
  if (problems.length) {
    console.error(`NOT MIGRATING (nothing changed):\n- ${problems.join("\n- ")}`);
    return 1;
  }

  const Client = deadlineClient(conn.config.Client ?? pg.Client, deadline);
  const pool = new pg.Pool({ ...conn.config, Client, max: 1 });
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
      console.error(
        "LOCK TIMEOUT: journal and schema unchanged. Retry per the release plan (max 3).",
      );
      return 2;
    }
    if (code === PAST_DEADLINE && unchanged) {
      console.error(
        "PAST DEADLINE: rolled back, journal and schema unchanged. STOP: do not retry.",
      );
      return 1;
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
