---
date: 2026-10-05
summary: Written API-only rollout plan for the reviewed member journey at runtime source 774b97e. Builds one new image, applies migrations 0013+0014 in one atomic run, updates only the API machine, leaves the worker frozen, and names every command target, check, rollback and open item. Prepared, not authorized, not executed.
---

# API-only rollout plan: member journey on the live Hyphae API

**Status: PREPARED. NOT AUTHORIZED. NOT EXECUTED.** Prepared 2026-10-05T09:05Z by a Hyphae product worker (Claude Sonnet 5.5, `claude-sonnet-5-5`, effort not observable) from `main` `0c02e38f79913161f6cb43d271b715105f4dc634` = `origin/main`. Nothing in this document changed Fly, the database, Telegram, secrets or Vercel settings. The only effect of writing it is the docs-only push that triggers the existing Vercel web build.

The old [c58aa27 plan](2026-10-04-raid-alerts-release-plan.md) is historical and is not authority for any of this. The earlier web-release and read-only Fly approvals do not cover these effects.

**Result this plan delivers:** the reviewed member journey code (private raid buttons, receipts, `/issue`, `/ops`, private raid alerts) runs on the live API machine, with the worker, reward jobs, payout math and the program unchanged, before the October 8 sitting. Raid buttons and `/issue` are only exercised when a real raid brief exists. Creating one, posting to the group, or any member subscription is a separate scope this plan does not include.

**One exact yes needed from Cisco:** the sentence in [Approval wording](#approval-wording) below.

## Exact live effects (everything the yes would allow)

| # | Effect | Exact target and bound |
|---|---|---|
| E1 | Build and push one image | Source: **commit `774b97e61ae71cf6704908b28822c36c019ca097`** in a detached clean worktree. `git diff 774b97e..0c02e38 -- apps packages` is empty (re-read at execution); `.dockerignore` excludes `docs`, so current `HEAD` builds the same runtime tree. Existing `apps/api/Dockerfile`, committed `pnpm-lock.yaml` with `--frozen-lockfile`, Fly remote builder, registry `registry.fly.io/hyphae-api`. New unique tag `member-journey-774b97e`. **Digest unknown until built.** No machine changes in this step. |
| E2 | Apply migrations | `0013_raid_alerts.sql` SHA-256 `7e0f951e3548d335dd8f299390daba14f6d8a6a3f79277a2068b2ecd4cc4b022` then `0014_member_journey.sql` SHA-256 `fa479c949a4c2c96234be8ddb2034c8ddaec00df836bcc8e14e199cc743e5485` (both verified today from the files and from `git show 774b97e:`). Production Neon database only after the pre-checks match. Additive: 7 new tables, 1 enum, foreign keys and indexes on them. No `ALTER` of an existing column, no data change. |
| E3 | Update the API machine | **Only machine `6839d31b317318`** (process `api`, app `hyphae-api`, region `cdg`, currently v11, started) moves to the new image. It restarts, so the API is unreachable for a short window. |
| E4 | Nothing else | Worker `817400c9901de8` is not touched. No secret, env var, Fly config, Vercel setting, Telegram webhook/menu, message, subscription, raid, wallet signature, payout or schedule change. |

**Why migrations first:** the new API starts a raid notifier and reads the new tables at boot and on every `/raid`, private submit and receipt. The frozen code ignores the new tables. So the order is: build, migrate, then update the machine. A migrated database with the old image is harmless.

**Why not plain `fly deploy`:** `apps/api/fly.toml` defines both `api` and `worker`, so a plain deploy rolls the worker too. Only `--build-only` plus a single-machine `fly machine update` keeps the worker frozen.

**Frozen, unchanged:** worker `817400c9901de8` on `sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2` (source `b3c82c7`), last updated `2026-10-02T09:19:01Z`. Verify 0.1.0 through Oct 12. Held refs untouched: scoring `158452fe`, Jev `707d7daf`, reward branch `2fd2470a`, tag `candidate/raid-alerts-2026-10-04` (`c58aa27`).

## Timing guard

- Run in one attended sitting on **Oct 5, 6 or 7**. Estimate 30 to 45 minutes: build 2 to 5 min, migration seconds, machine update about 1 min, checks plus the 10-minute worker proof.
- **No execution from Oct 8 23:00Z through Oct 10 00:00Z inclusive** (pause 23:00Z, final C18b after 23:45Z, corrections/attestation strictly before Oct 9 00:00Z, hold window). If it has not started by **Oct 8 12:00Z**, defer it past Oct 10 00:00Z and say so.
- Epoch 2 is open and intake is open. Do not pause intake for this. If the migration cannot get its locks in three attempts, stop and ask (see E2 failure handling).

## Execution order and exact commands

Variables: `APP=hyphae-api`, `API=6839d31b317318`, `WORKER=817400c9901de8`, `SRC=774b97e61ae71cf6704908b28822c36c019ca097`, `FROZEN=sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2`, `TAG=member-journey-774b97e`, `REPO=/Users/cisco/Desktop/projects/hyphae`, `WT=/Users/cisco/Desktop/projects/hyphae-774b97e`. The scripts below live in the session scratchpad, read the gitignored `.env` through `node --env-file`, and never print a value.

### Step 0. Guards (read-only)

1. `git -C $REPO status -sb`, `ps` for another writer in `$REPO`, `ls $REPO/.git/*.lock`. Stop if a writer or lock exists.
2. `git -C $REPO fetch origin` (no prune), `git merge-base --is-ancestor $SRC origin/main` must be true. Held refs unchanged.
3. `date -u` is before Oct 8 12:00Z. Cisco is present.

### Step 1. Exact-source worktree and gate (local only)

```
git -C $REPO worktree add --detach $WT $SRC
cd $WT && git rev-parse HEAD            # must equal $SRC
pnpm install --frozen-lockfile
shasum -a 256 packages/db/drizzle/0013_raid_alerts.sql packages/db/drizzle/0014_member_journey.sql
tail -4 packages/db/drizzle/meta/_journal.json   # last tag 0014_member_journey
```

The source already passed its full gate and an other-family ACCEPT (`docs/reviews/2026-10-04-member-journey.md`); it is not retested here beyond the hash and journal checks.

### Step 2. Local migrator rehearsal (disposable Postgres, no production)

The Mac resolves `postgres` (postgres.js) but not `pg` from `packages/db`, so `drizzle-kit migrate` uses the **postgres.js driver here**, not the `pg` driver recorded in the Oct 2 Windows receipts. postgres.js forwards a URL `options=` parameter as a startup parameter (read in `postgres@3.4.9` `parseOptions`), so the 3-second lock timeout should hold, but prove it before production:

On a disposable Postgres 17 container (never production): apply 0000 to 0012, hold a `ROW EXCLUSIVE` lock on `communities`, run the exact migrate command from Step 5 with `options=-c%20lock_timeout%3D3000` against it. Expect exit 1 within about 5 s, journal still 13 rows, no `raid_*` table. Release the lock, rerun: expect success, journal 15 rows, both new hashes. Stop if either result differs.

### Step 3. Read-only pre-checks (all must match; any mismatch stops the plan)

Run as one `read only` transaction on Neon's **direct** endpoint (host with `-pooler` removed), `postgres` package from `$WT/packages/db`, URL from `.env` with `&options=-c%20lock_timeout%3D3000`.

| Check | Expected |
|---|---|
| `transaction_read_only`, `show lock_timeout` | `on`, `3s` (proves the option reaches the server through this driver) |
| Host names only (never credentials): direct host, database name | Recorded; direct host differs from the pooler host |
| Journal: `select id, hash, created_at from drizzle.__drizzle_migrations order by created_at` | Exactly **13 rows, 0000 to 0012**, each hash and `created_at` equal to the table below |
| New schema absent | `to_regclass` null for `raid_announcements`, `raid_deliveries`, `raid_subscriptions`, `raid_lifecycle_events`, `raid_submission_receipts`, `raid_submission_sessions`, `submission_issues`; `pg_type` has no `raid_delivery_status` |
| Lab identity: `communities` | Exactly 1 row: mint `HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg`, name `Hyphae Lab`, `first_paid_epoch = 2`, `reward_intake_paused_at` null. Record its UUID, `telegram_chat_id`, `admin_telegram_user_id`. |
| Epochs | Epoch 1 closed with one snapshot, epoch 2 open, closes `2026-10-09T00:00:00Z` |
| DB target is the production one | Same mint, name, epoch indexes/times/status and intake state as the live public read `GET https://hyphae-api.fly.dev/v1/communities/<mint>`; contribution and member counts match the public epoch read. This is the proof the `.env` URL is the DB the API uses, since Fly secrets cannot be read. |
| Row counts (recorded for the post-check) | `members`, `contributions`, `reward_intakes`, `reward_decisions`, `epochs`, `tasks`, `reward_snapshot_entries`, `leaves` |
| Activity | `pg_stat_activity`: no transaction other than this one older than 5 s |
| Queue baseline | `pgboss.job` by `name, state` counts: failed 0, nothing pending older than 10 minutes, `reward-recovery` completing about every 5 minutes |
| Neon point-in-time reference | `select now(), pg_current_wal_lsn()` recorded. Not a rollback (the plan has none for the DB); a reference if something unforeseen is found. |

Expected journal (SHA-256 of each file at `774b97e`; `created_at` is the journal `when`):

| # | File | `created_at` | sha256 |
|---|---|---|---|
| 0000 | `0000_dry_ezekiel_stane` | 1789602401338 | `15c45e6aa5dfbcaa1ffc0f48ec4e0220502cea4d0447129a6ceaf6ad14cc81bd` |
| 0001 | `0001_drop_x_handle` | 1789666400825 | `6475c8725e3f0eed0145cec7151aa778e1b4ef1b798c68a1d3075f1ea5822bb7` |
| 0002 | `0002_x_handles` | 1789666401918 | `b634811335296af4ab2423e5b8d65f0e802bb8dd003d7562caad6b3946542611` |
| 0003 | `0003_reward_config_intake` | 1790085607607 | `3da1313df14fa49a5b5bbf36182dd242a77bf256ed5e8e7de8691876e088f216` |
| 0004 | `0004_reward_slots_dispatch` | 1790178141169 | `36b86c46cc5ab4cf70d5201f7a36e0c1796bf798bc2be688b61ac75baf13462c` |
| 0005 | `0005_reward_decision_notified` | 1790202415529 | `62a762ae2a58c5c241c388c3975251bad3363aa85a15947d26e2c3d14822fbbc` |
| 0006 | `0006_reward_decision_corrections` | 1790239121780 | `f3e04f49c982f990f6d1c4a1ab037a4ad5c0de50bc389a34536018c411096f35` |
| 0007 | `0007_reward_close_snapshot` | 1790243450325 | `0e12c3137e6c027b55eca1f1d637a7db50d5ff7a6cdd475ce8f34997efe70206` |
| 0008 | `0008_verified_wallet_links` | 1790245142463 | `7c9f44cb21a410529643dd4c3be1b29253282d3f310e032c2df0be43c90da9f7` |
| 0009 | `0009_payout_gates` | 1790284758294 | `20828a04cc4f7051a144843ccd68a6c03ff1b4ee94603cb443cc68d48f6d1cc4` |
| 0010 | `0010_reward_commitment_hashes` | 1790457684750 | `147bdf9e0447da4f86c8b7d3c62e2ae1666bd8c70daa2d7b04f6559de037a550` |
| 0011 | `0011_publication_intent` | 1790506357853 | `1f08037f7f8b0ae81527f553ec28e76f5fec151256b8c5ac3d60d23b1d6087a7` |
| 0012 | `0012_leaves_wallet_index` | 1790521992081 | `5de5cfecd64965e6e41729157e20e170be5d1c8f1d80eb9319e318ef2ff8a4c4` |
| 0013 | `0013_raid_alerts` (to apply) | 1791145987015 | `7e0f951e3548d335dd8f299390daba14f6d8a6a3f79277a2068b2ecd4cc4b022` |
| 0014 | `0014_member_journey` (to apply) | 1791150690052 | `fa479c949a4c2c96234be8ddb2034c8ddaec00df836bcc8e14e199cc743e5485` |

**Bot rights (Telegram reads only; token from `.env` via `node --env-file`, never in argv):** `getMe` returns `@hyphaeprotocol_bot` and records its numeric id; `getChat(<telegram_chat_id from the DB>)` succeeds and records the type; `getChatMember(chat, bot id)` shows the bot is a member or administrator; `getChatMember(chat, <admin_telegram_user_id>)` shows `creator` or `administrator`; `getWebhookInfo` URL equals `https://hyphae-api.fly.dev/telegram`, no `last_error_message`, `pending_update_count` recorded. No `getUpdates`, `setWebhook`, `deleteWebhook`, message, invite or any write call.

**Fly (read-only):**

```
fly machine list --app hyphae-api
fly image show --app hyphae-api
fly machine status 6839d31b317318 --app hyphae-api --display-config
fly config show --app hyphae-api
```

Expected: API and worker both `started`, both digest `$FROZEN`, worker updated `2026-10-02T09:19:01Z` and version 11. Today's read (below) matched.

### Step 4. Build and push the image only (no machine change)

From `$WT`:

```
fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --app hyphae-api --build-only --push --image-label member-journey-774b97e --depot=false
```

Record the printed image reference, Node and pnpm versions from the build log, and the digest if the output shows one. `fly machine list` must still show both machines unchanged afterward. Never run this without `--build-only`.

### Step 5. Apply 0013 then 0014 (one atomic run)

Immediately before: rerun the Step 3 activity read. From `$WT/packages/db`, URL built from `.env` without printing it (direct endpoint, 3-second lock timeout):

```
DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' $REPO/.env | sed -e 's/-pooler\././' -e 's/$/\&options=-c%20lock_timeout%3D3000/')" node node_modules/drizzle-kit/bin.cjs migrate
```

Expected: `migrations applied successfully!`, exit 0. **Atomic:** `drizzle-orm@0.45.2` `PgDialect.migrate` runs every pending file's SQL and its journal insert inside one `session.transaction`, in journal order, and `drizzle-kit migrate` calls that migrator (read in `node_modules` today). A failure rolls back both files and both journal rows. The foreign keys take brief locks on `communities`, `tasks`, `members` and `contributions`; the 3 s timeout fails fast instead of queuing members behind it.

- Lock-timeout failure (`canceling statement due to lock timeout`): confirm the journal still has 13 rows, list lock holders (`pg_locks` joined to `pg_stat_activity`), wait 30 s, rerun Step 3 activity read, retry. **At most three attempts**, then stop and ask Cisco.
- Any other failure: stop. Nothing is applied. Do not retry blind.
- Connection lost after the migrator may have committed: read the journal on the same target first, never replay or change target.

Post-check (read-only, same script): journal **15 rows**, every hash and `created_at` equal to the table; the 7 tables and enum exist and are **empty**; Step 3 row counts unchanged; no long transaction; `GET /health` 200 and the old API still serving.

### Step 6. Update the API machine only

```
fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api:member-journey-774b97e --yes
```

Then:

```
fly machine list --app hyphae-api
fly image show --app hyphae-api
```

### Step 7. Acceptance checks

- API machine `6839d31b317318` `started`, digest is the new image's digest (record it; not `$FROZEN`). Worker `817400c9901de8` **unchanged**: same digest `$FROZEN`, `started`, updated `2026-10-02T09:19:01Z`, version 11.
- `GET https://hyphae-api.fly.dev/health` 200 `{"ok":true}`; `/v1/communities/<mint>` and `/v1/communities/<mint>/epochs/2` 200 with the same epoch 2 open and intake open as before; `/link` and `/link/app.js` 200; `/docs` 200.
- `getWebhookInfo`: URL unchanged, `pending_update_count` back to its recorded level or 0, no `last_error_message`.
- Read-only DB reads: 15 journal rows; new tables still empty (nothing creates rows until a raid exists); Step 3 row counts unchanged; queue state: failed 0, nothing pending older than 10 minutes, `reward-recovery` completions continuing about every 5 minutes for 10 minutes after the update (same proof as the Oct 2 C7 run).
- Fly logs (read-only, Cisco present): API prints `api listening on :8080` with no stack trace; worker log shows no new error.
- Attended, Cisco's own admin private chat, read-only: `/ops <community UUID>` answers with the operator view (empty states, unknown telemetry shown as unknown), and `/receipt` answers with no receipts. These send no group message and create no raid or subscription.
- Vercel is unaffected by this plan: `hyphae-delta.vercel.app` still 200.
- Outside this plan, needs its own approval: a real raid brief, reply/quote buttons, `/issue` on a real receipt, private alert subscriptions and the registered-Lab phone test.

### Rollback (API only; no DB or Git rollback)

If acceptance fails after Step 6:

```
fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api:deployment-01M3XYDW5XW7AEAY68CKVPKC2X --yes
fly image show --app hyphae-api
```

`fly image show` must print `$FROZEN` for the API machine again, `/health` 200, worker unchanged. The tag `deployment-01M3XYDW5XW7AEAY68CKVPKC2X` is the one both machines run today and resolves to `$FROZEN`. The additive tables stay; the frozen code ignores them. Never drop or delete a table, reseed, reset a queue, change a credential or force a resend. If the rollback itself fails, stop live work and keep the exact state for read-only diagnosis.

If Step 5 fails, nothing was applied and nothing else has changed except the built image tag. If Step 4 fails, nothing has changed.

## Read-only checks run while preparing this plan (2026-10-05)

| Check | Result |
|---|---|
| `git rev-parse HEAD`, `origin/main` after `git fetch origin` (no prune) | Both `0c02e38f79913161f6cb43d271b715105f4dc634`; status clean |
| Held refs | `158452fe2b22a1e42e5efd42f3f7e11bfdf59c70`, `707d7daf21e217d9a8a64e58514065f5e3bca45e`, `2fd2470a26ff9a349bceeb697b2731bd1bff0e07`, tag `candidate/raid-alerts-2026-10-04` = `c58aa27efdb5bc5492c2f96d45c090c9fc91d379`, all unchanged |
| Live writer | No `.git/*.lock`; a Codex CLI process has this repo as its working directory (pid 44872) but made no change during this session |
| `git diff 774b97e..0c02e38 -- apps packages pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json .dockerignore` | Empty. Only 6 doc files differ |
| `shasum -a 256` of 0013 and 0014, from the working tree and from `git show 774b97e:` | Both match the pinned hashes |
| Hashes of 0000 to 0012 from the files | Computed; 0000 to 0009 equal the Sep 29 cutover table, 0010 to 0012 are new here |
| Migration SQL | 0013 and 0014 contain only `CREATE TYPE`, `CREATE TABLE`, `ALTER TABLE ... ADD CONSTRAINT` on the new tables and `CREATE INDEX` on them |
| Migrator atomicity | `drizzle-orm@0.45.2` `PgDialect.migrate` wraps all pending SQL and journal inserts in one transaction; `drizzle-kit@0.31.10 migrate` imports `drizzle-orm/node-postgres/migrator` or `postgres-js/migrator`; `pg` is not resolvable from `packages/db` here, so the postgres.js driver would be used |
| postgres.js `options` | Source read: a URL `options=` parameter becomes a startup parameter |
| New code and environment | `apps/api/src/env.ts` unchanged since `b3c82c7`; no new variable is read; `Dockerfile`, `fly.toml` unchanged; new boot path adds the raid notifier |
| `flyctl version` | `v0.4.111`; `fly auth whoami` = `cisco_vieira@hotmail.com` |
| `fly status --app hyphae-api` | API `6839d31b317318` and worker `817400c9901de8`, v11, `started`, `cdg`, image `deployment-01M3XYDW5XW7AEAY68CKVPKC2X` |
| `fly machine list`, `fly image show` | Both machines digest `sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2`; updated `2026-10-02T09:18:28Z` (API) and `09:19:01Z` (worker) |
| `fly machine status 6839d31b317318 --display-config`, `fly config show` | `node dist/server.js`, shared 1 CPU/512 MB, http_service 8080 auto-stop off, restart on-failure; env only `FLY_PROCESS_GROUP`, `PRIMARY_REGION` (no secret in config) |
| `fly releases --app hyphae-api --image` | v11 (Oct 2 09:18) is current |
| `fly deploy --help`, `fly machine update --help` | `--build-only`, `--push`, `--image-label`, `--depot`, and `fly machine update <id> --image ... --yes` all exist in 0.4.111 |
| Public reads | `/health`, `/v1/communities/<mint>`, `/v1/communities/<mint>/epochs/2`, `hyphae-delta.vercel.app/`, `/c/<mint>` all HTTP 200; Hyphae Lab epoch 2 open, intake open, as of `2026-10-05T08:57Z` |
| Local `.env` on this Mac | **Absent** (`/Users/cisco/Desktop/projects/hyphae/.env`, `apps/api/.env`, `packages/db/.env`) |

## Open items (could not be verified read-only)

1. **No `.env` on this Mac.** The migrator, the DB pre-checks and the Telegram reads need `DATABASE_URL` and `TELEGRAM_BOT_TOKEN`. Fly secrets cannot be read and `fly ssh` exec is out of scope. Recommended: Cisco puts both values in the gitignored `$REPO/.env` in an editor, taking them from Neon's console and his password manager. Never paste them in chat. Alternative: run the same plan from the Windows PC that already has `.env`. Until one of these exists, steps 3 to 7 cannot run.
2. **Image digest is unknown until the build.** It is recorded after Step 4 if the output shows it, and always after Step 6 from `fly image show`. The machine is updated by a unique tag, not by digest. Recommended: keep the unique tag, require the recorded digest to appear in the report before declaring acceptance.
3. **That `fly machine update` leaves the worker and app release untouched** is expected and checked by Step 7 (worker digest, version, `updated` timestamp), not proven in advance.
4. **Migrator driver and timeout** differ from the Oct 2 Windows runs (postgres.js here, `pg` there). Covered by the Step 2 rehearsal and the Step 3 `show lock_timeout` read. Fallback if it fails: a scratchpad script calling `drizzle-orm/postgres-js/migrator` on the same worktree migrations folder, same transaction logic, with `connection: { options: '-c lock_timeout=3000' }`. Do not add a dependency.
5. **Bot rights** have no fixed pass threshold in the repo beyond "bot is in the registered chat and the designated admin is creator or administrator". The pre-check records the exact values; if the bot is absent from the chat or `getChat` fails, stop.
6. **DB target identity** is proven by cross-checking the DB against the public API (Step 3), not by reading the Fly secret.
7. `fly deploy --build-only --push` writes a new image to the registry and may start the existing remote builder. This is part of E1 and is why it needs the yes.

## Approval wording

Cisco answers one sentence, for example: **"yes, run the 2026-10-05 API rollout plan at 774b97e"**, with the Mac `.env` supplied or the Windows PC chosen. Anything else, including "ok" without naming the plan, is a no. A yes covers E1 to E4 only, once, before Oct 8 12:00Z. It does not cover a raid, any Telegram message, a phone test, the worker, a rollback of the database, or anything during the Oct 8 to Oct 10 sitting.
