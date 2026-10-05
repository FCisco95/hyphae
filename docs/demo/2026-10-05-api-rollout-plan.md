---
date: 2026-10-05
summary: API-only rollout plan for the reviewed member journey at runtime source 774b97e. Builds one image, applies migrations 0013+0014 in one atomic run through rehearsed scripts, updates only the API machine by immutable digest, leaves the worker frozen. Rehearsed locally and ready; not authorized, not executed. Needs the production .env and Cisco's exact yes.
---

# API-only rollout plan: member journey on the live Hyphae API

**Status: READY, REHEARSED. NOT AUTHORIZED. NOT EXECUTED.** First prepared 2026-10-05T09:05Z by a Hyphae product worker (Claude Sonnet 5.5, `claude-sonnet-5-5`, effort not observable) from `main` `0c02e38`. Completed 2026-10-05T10:50Z by Claude Opus 5.5 (`claude-opus-5-5`) from `main` `f551677`: disposable-Postgres rehearsal done, migrator driver corrected to `pg`, checks and migration moved into committed scripts (`scripts/rollout/`), machine update and rollback pinned to registry digests. Nothing in this document changed Fly, the database, Telegram, secrets or Vercel settings. The only effect of writing it is the docs/scripts push that triggers the existing Vercel web build.

The old [c58aa27 plan](2026-10-04-raid-alerts-release-plan.md) is historical and is not authority for any of this. The earlier web-release and read-only Fly approvals do not cover these effects.

**Result this plan delivers:** the reviewed member journey code (private raid buttons, receipts, `/issue`, `/ops`, private raid alerts) runs on the live API machine, with the worker, reward jobs, payout math and the program unchanged, before the October 8 sitting. Raid buttons and `/issue` are only exercised when a real raid brief exists. Creating one, posting to the group, or any member subscription is a separate scope this plan does not include.

**One exact yes needed from Cisco:** the sentence in [Approval wording](#approval-wording) below.

## Exact live effects (everything the yes would allow)

| # | Effect | Exact target and bound |
|---|---|---|
| E1 | Build and push one image | Source: **commit `774b97e61ae71cf6704908b28822c36c019ca097`** in a detached clean worktree. `git diff 774b97e..0c02e38 -- apps packages` is empty (re-read at execution); `.dockerignore` excludes `docs`, so current `HEAD` builds the same runtime tree. Existing `apps/api/Dockerfile`, committed `pnpm-lock.yaml` with `--frozen-lockfile`, Fly remote builder, registry `registry.fly.io/hyphae-api`. New unique tag `member-journey-774b97e` (registry `404` on 2026-10-05, so unused). Its digest `$NEW` is read from the registry right after the build. No machine changes in this step. |
| E2 | Apply migrations | `0013_raid_alerts.sql` SHA-256 `7e0f951e3548d335dd8f299390daba14f6d8a6a3f79277a2068b2ecd4cc4b022` then `0014_member_journey.sql` SHA-256 `fa479c949a4c2c96234be8ddb2034c8ddaec00df836bcc8e14e199cc743e5485` (both verified today from the files and from `git show 774b97e:`). Production Neon database only after the pre-checks match. Additive: 7 new tables, 1 enum, foreign keys and indexes on them. No `ALTER` of an existing column, no data change. |
| E3 | Update the API machine | **Only machine `6839d31b317318`** (process `api`, app `hyphae-api`, region `cdg`, currently v11, started) moves to the new image, referenced by its immutable digest `registry.fly.io/hyphae-api@$NEW`. It restarts, so the API is unreachable for a short window. |
| E4 | Nothing else | Worker `817400c9901de8` is not touched. No secret, env var, Fly config, Vercel setting, Telegram webhook/menu, message, subscription, raid, wallet signature, payout or schedule change. |

**Why migrations first:** the new API starts a raid notifier and reads the new tables at boot and on every `/raid`, private submit and receipt. The frozen code ignores the new tables. So the order is: build, migrate, then update the machine. A migrated database with the old image is harmless.

**Why not plain `fly deploy`:** `apps/api/fly.toml` defines both `api` and `worker`, so a plain deploy rolls the worker too. Only `--build-only` plus a single-machine `fly machine update` keeps the worker frozen.

**Frozen, unchanged:** worker `817400c9901de8` on `sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2` (source `b3c82c7`), last updated `2026-10-02T09:19:01Z`. Verify 0.1.0 through Oct 12. Held refs untouched: scoring `158452fe`, Jev `707d7daf`, reward branch `2fd2470a`, tag `candidate/raid-alerts-2026-10-04` (`c58aa27`).

## Timing guard

- Run in one attended sitting on **Oct 5, 6 or 7**. Estimate 30 to 45 minutes: build 2 to 5 min, migration seconds, machine update about 1 min, checks plus the 10-minute worker proof.
- **No execution from Oct 8 23:00Z through Oct 10 00:00Z inclusive** (pause 23:00Z, final C18b after 23:45Z, corrections/attestation strictly before Oct 9 00:00Z, hold window). If it has not started by **Oct 8 12:00Z**, defer it past Oct 10 00:00Z and say so.
- Epoch 2 is open and intake is open. Do not pause intake for this. If the migration cannot get its locks in three attempts, stop and ask (see E2 failure handling).

## Execution order and exact commands

Variables: `APP=hyphae-api`, `API=6839d31b317318`, `WORKER=817400c9901de8`, `SRC=774b97e61ae71cf6704908b28822c36c019ca097`, `FROZEN=sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2`, `TAG=member-journey-774b97e`, `REPO=/Users/cisco/Desktop/projects/hyphae`, `WT=/Users/cisco/Desktop/projects/hyphae-774b97e`, `RUN=$WT/rollout-run` (untracked, holds the check reports). `NEW` is set in Step 4 from the registry.

The checks and the migration run through committed, rehearsed scripts in `$REPO/scripts/rollout/` (outside the Docker build context, so the image is unchanged by them):

| Script | Does | Never |
|---|---|---|
| `db.mjs precheck`, `migrate <pre.json>`, `postcheck <pre.json>` | Read-only checks in a `read only` transaction; the 0013+0014 migration through the same `pg` driver and `drizzle-orm/node-postgres/migrator` that `drizzle-kit migrate` uses, with the Postgres error code printed | Prints the URL or any credential. Exit 0 pass/applied, 1 fail (stop), 2 lock timeout (nothing applied) |
| `telegram.mjs <chat id> <admin id>` | `getMe`, `getChat`, `getChatMember` x2, `getWebhookInfo` | Sends, reads updates, or changes the webhook. Prints no token |
| `registry-digest.sh <tag\|sha256:…>` | `HEAD` of the manifest on `registry.fly.io/hyphae-api`; prints HTTP code, digest, media type | Pushes or tags anything. Token goes to curl on stdin only |

Shell lines are POSIX (macOS, Linux, WSL or Git Bash); the Node scripts are OS-independent. The `.env` is read with `node --env-file`, which refuses to start if the file is missing.

### Step 0. Guards (read-only)

1. `git -C $REPO status -sb`, `ps` for another writer in `$REPO`, `ls $REPO/.git/*.lock`. Stop if a writer or lock exists.
2. `git -C $REPO fetch origin` (no prune), `git merge-base --is-ancestor $SRC origin/main` must be true. Held refs unchanged.
3. `git -C $REPO diff --stat $SRC origin/main -- apps packages pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json .dockerignore` is empty.
4. `$REPO/scripts/rollout/registry-digest.sh $TAG` prints `404` (the tag is unused, so Step 4 cannot reuse an older image). `registry-digest.sh deployment-01M3XYDW5XW7AEAY68CKVPKC2X` and `registry-digest.sh $FROZEN` both print `200 $FROZEN` (the rollback target exists).
5. `date -u` is before Oct 8 12:00Z. Cisco is present.

### Step 1. Exact-source worktree (local only)

```
git -C $REPO worktree add --detach $WT $SRC
cd $WT && git rev-parse HEAD            # must equal $SRC
pnpm install --frozen-lockfile
mkdir -p $RUN
shasum -a 256 packages/db/drizzle/0013_raid_alerts.sql packages/db/drizzle/0014_member_journey.sql
```

The source already passed its full gate and an other-family ACCEPT (`docs/reviews/2026-10-04-member-journey.md`); it is not retested here. `db.mjs` re-checks every migration hash itself.

### Step 2. Local rehearsal: DONE 2026-10-05, no need to repeat

Ran on a disposable `postgres:17` (17.11) container on this Mac, never production, from an exact `774b97e` worktree with `pnpm install --frozen-lockfile`:

| Case | Result |
|---|---|
| Driver | `drizzle-kit migrate` prints `Using 'pg' driver` (`pg@8.23.0`, a peer of `drizzle-orm@0.45.2`, resolves from drizzle-kit's location). The first draft's postgres.js claim was wrong; this is the same driver as the Oct 2 Windows receipts. |
| 0000 to 0012 applied | 13 journal rows |
| `db.mjs precheck` on a seeded Lab copy | `PASS`: `read_only on`, `lock_timeout 3s` (the startup option reaches the server through `pg`), 13 rows equal to the table below, live public reads matched |
| Negative precheck (epoch 2 closes moved by a day) | `FAIL`: "epoch 2 is not open until …" and "public epoch 2 differs" |
| `ROW EXCLUSIVE` lock held on `communities`, plain `drizzle-kit migrate` with `options=-c lock_timeout=3000` | Exit 1 after 3.4 s, journal 13, no new table, no enum. **drizzle-kit prints no error text at all**, so it cannot tell a lock timeout from any other failure. That is why Step 5 uses `db.mjs migrate`. |
| Same lock, `db.mjs migrate` | Exit **2** after 3 s: `code=55P03 message=canceling statement due to lock timeout`, journal 13 |
| Lock released, `drizzle-kit migrate` and later `db.mjs migrate` | Exit 0, journal 15, all 15 hashes and `created_at` equal the table, 7 tables and the enum exist. The failed runs left no partial 0013, which proves the single-transaction atomicity. |
| `db.mjs postcheck` | `PASS`, new tables empty, row deltas 0 |
| `db.mjs migrate` again | Refuses |

Second round, 2026-10-05T11:56Z, after the Codex review fixes (fresh disposable DB, seeded Lab, real pg-boss 12 schema; a "worker tick" completes one `reward-recovery` job):

| Case | Result |
|---|---|
| `precheck` | PASS, exit 0 |
| `migrate pre.json` with no newer `reward-recovery` completion | `NOT MIGRATING (nothing changed)`: liveness missing, exit 1 |
| `migrate` without a baseline | Refused, exit 1 |
| URL with `?host=evil.example` | `unsupported param host`, exit 1 |
| `channel_binding=require` against a server without `-PLUS` | `server offered no -PLUS`, exit 1 |
| 13 journal rows whose last row is 0013's identity (the review's partial-apply scenario) | `journal is not exactly 0000-0012`, exit 1, nothing changed |
| After a worker tick, `ROW EXCLUSIVE` lock held | `55P03`, `LOCK TIMEOUT: journal and schema unchanged`, exit 2 |
| Lock released | `APPLIED: journal 13 -> 15 rows, exactly 0000-0014`, exit 0 |
| `postcheck pre.json` | PASS, `liveness=true`, all deltas 0 |
| Baseline edited to `FAIL` / count removed / other target | FAIL each: "not a passing precheck" / "count of contributions is invalid" / "target differs" |
| A counted table shrinks | FAIL: "tasks lost rows (delta -5)" |
| `migrate` again | Refused: journal not 0000-0012, schema exists |

Third round, 2026-10-05T12:1xZ, after the fix-check:

| Case | Result |
|---|---|
| Trust-auth server (no SASL at all), `channel_binding=require` | `no verified -PLUS login`, refused; the same server without the parameter connects (control) |
| TLS server (`ssl=on`, SCRAM), `sslmode=no-verify&channel_binding=require` | Connects via `SCRAM-SHA-256-PLUS` and reaches the queries |
| Baseline PASS, worker tick, then intake paused | `NOT MIGRATING`: "reward intake is paused", "public intake state differs", exit 1 |
| Intake unpaused | `APPLIED … exactly 0000-0014`, exit 0; `postcheck` PASS, `liveness=true` |

### Step 3. Read-only pre-checks (all must PASS; any FAIL stops the plan)

```
cd $WT/packages/db
node --env-file=$REPO/.env $REPO/scripts/rollout/db.mjs precheck > $RUN/pre.json; echo $?
```

`db.mjs` swaps Neon's `-pooler` host for the direct host and sets `lock_timeout=3s` as a startup option. It refuses a URL with any query parameter other than `sslmode` and `channel_binding` (a `host=` parameter would silently redirect pg), checks that pg's effective host, port and database equal the reported ones, and enforces `channel_binding=require` when the URL asks for it (pg 8.23 alone treats it as a preference). It prints `verdict`, `problems`, the target (host, port, database, TLS settings; never credentials) and the full state.

**Cisco confirms one thing by eye:** the printed `target.host` is the endpoint of the production branch in the Neon console. That plus liveness (below) is the identity proof.

It enforces:

| Check | Expected |
|---|---|
| `transaction_read_only`, `show lock_timeout` | `on`, `3s` |
| Journal | Exactly **13 rows, 0000 to 0012**, each hash and `created_at` equal to the table below (computed from the worktree files) |
| New schema absent | All 7 new tables and the `raid_delivery_status` enum absent |
| Lab identity | Exactly 1 community: mint `HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg`, `Hyphae Lab`, `first_paid_epoch = 2`, intake not paused. Its UUID, `telegram_chat_id` and `admin_telegram_user_id` are in the report for the next check. |
| Epochs | Epoch 1 closed with one snapshot, epoch 2 open, closes `2026-10-09T00:00:00Z` |
| Consistent with the live API | Name, intake state, every epoch's index, status, opens and closes, and epoch 2's reward config UUID (`df5be064-4cee-4f69-84f8-939b46140b1a` on 2026-10-05) equal the live `GET https://hyphae-api.fly.dev/v1/communities/<mint>` and `/epochs/2`. This is consistency only: a recent Neon branch or copy would match too. |
| Identity (enforced later, by `migrate` and `postcheck`) | A `reward-recovery` completion **newer than this precheck's** must exist. Only the database the live worker writes to gets new completions, so a branch, copy or stale target cannot pass. Fly secrets cannot be read back and their listed digests are not a reproducible hash. |
| Activity | No other client transaction older than 5 s |
| Queue | `pgboss.job`: 0 failed, nothing `created`/`retry` older than 10 min, last `reward-recovery` completion within 10 min |
| Recorded, not judged | Row counts of `members`, `contributions`, `reward_intakes`, `reward_decisions`, `epochs`, `tasks`, `reward_snapshot_entries`, `leaves`; `now()` and `pg_current_wal_lsn()` as a point-in-time reference (not a rollback) |

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

**Bot rights (Telegram reads only):**

```
node --env-file=$REPO/.env $REPO/scripts/rollout/telegram.mjs <telegram_chat_id> <admin_telegram_user_id> > $RUN/telegram-pre.json; echo $?
```

PASS means: bot is `@hyphaeprotocol_bot`; `getChat` succeeds; the bot is `member` or `administrator` in the chat; the designated admin is `creator` or `administrator`; the webhook URL is `https://hyphae-api.fly.dev/telegram` with no `last_error_message`. `pending_update_count` is recorded. If it FAILs only on an old `last_error_message`, show Cisco the `last_error_date` and stop; do not judge it alone.

**Fly (read-only):**

```
fly machine list --app hyphae-api
fly image show --app hyphae-api
fly machine status 6839d31b317318 --app hyphae-api --display-config
```

Expected: API and worker both `started`, both digest `$FROZEN`, worker last updated `2026-10-02T09:19:01Z`.

### Step 4. Build and push the image only (no machine change)

From `$WT`:

```
fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --app hyphae-api --build-only --push --image-label member-journey-774b97e --depot=false
$REPO/scripts/rollout/registry-digest.sh member-journey-774b97e     # 200 sha256:<NEW> <media type>
NEW=sha256:<the printed digest>
$REPO/scripts/rollout/registry-digest.sh $NEW                       # 200 $NEW again
```

Record `$NEW`, the media type, and Node and pnpm versions from the build log. `$NEW` must differ from `$FROZEN`. `fly machine list` must still show both machines on `$FROZEN`. Never run this without `--build-only`.

### Step 5. Apply 0013 then 0014 (one atomic run)

Keep the Step 3 `$RUN/pre.json` as the baseline (do not overwrite it). Then:

```
cd $WT/packages/db
node --env-file=$REPO/.env $REPO/scripts/rollout/db.mjs migrate $RUN/pre.json; echo $?
```

Before any DDL, on every attempt, `db.mjs migrate` re-runs **every precheck condition on fresh state** (including the live public reads, queue health, intake and epochs) and refuses (exit 1, nothing changed) unless they all pass and: the migrations folder is exactly 0000 to 0012 plus the pinned 0013 and 0014; the baseline is a PASS precheck of the same target, under 2 hours old, with valid counts; the live journal **content** (every hash and `created_at`, not just the count) is exactly 0000 to 0012; no new table or enum exists; no other transaction is older than 5 s; no counted table lost rows; and a `reward-recovery` completion newer than the baseline exists (identity). If that last one is missing, wait about 5 minutes and rerun. It then runs the `drizzle-orm@0.45.2` migrator, which applies every pending file's SQL and journal row inside one transaction, in journal order. The foreign keys take brief locks on `communities`, `tasks`, `members` and `contributions`; the 3 s lock timeout fails fast instead of queueing members behind it.

After the migrator returns or fails, the script reads the journal and schema back and reports one outcome:

- **Exit 0**, `APPLIED: journal 13 -> 15 rows, exactly 0000-0014`: continue.
- **Exit 2**, `LOCK TIMEOUT` (Postgres `55P03` **and** journal content and schema read back unchanged): wait 30 s, retry the same command. **At most three attempts**, then stop and ask Cisco.
- **Exit 1** with `ROLLED BACK` (another error, nothing applied), `COMMITTED` (e.g. a lost commit acknowledgement after both files applied), `INCONSISTENT` or `UNKNOWN` (read-back failed): stop. Do not retry. Reconcile the journal and schema read-only on the same target, never replay or change target, and ask Cisco. `COMMITTED` continues with the post-check only after Cisco agrees.

Post-check:

```
node --env-file=$REPO/.env $REPO/scripts/rollout/db.mjs postcheck $RUN/pre.json > $RUN/post-migrate.json; echo $?
curl -s -o /dev/null -w '%{http_code}\n' https://hyphae-api.fly.dev/health     # 200, old API still serving
```

`postcheck` PASS means: journal **15 rows**, all equal to the table; the 7 tables and the enum exist and are **empty**; identity, epochs, activity and queue checks still pass; no counted table lost rows. Intake stays open during the sitting, so counts may grow; the report shows each delta.

### Step 6. Update the API machine only, by digest

```
$REPO/scripts/rollout/registry-digest.sh $NEW        # still 200 $NEW
fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api@$NEW --yes
fly machine list --app hyphae-api
fly image show --app hyphae-api
```

The digest reference is immutable, so the machine cannot receive anything other than the image read in Step 4. If flyctl rejects the digest form before changing the machine (`fly machine list` shows it untouched), use `--image registry.fly.io/hyphae-api:member-journey-774b97e` only after `registry-digest.sh member-journey-774b97e` prints `$NEW` again in the same minute; Step 7 then proves the result.

### Step 7. Acceptance checks

- `fly image show`: API machine `6839d31b317318` digest **equals `$NEW`**, `started`. Worker `817400c9901de8` **unchanged**: digest `$FROZEN`, `started`, last updated `2026-10-02T09:19:01Z`. Any other result goes to Rollback.
- `GET https://hyphae-api.fly.dev/health` 200 `{"ok":true}`; `/v1/communities/<mint>` and `/v1/communities/<mint>/epochs/2` 200 with epoch 2 open and intake open as before; `/link` and `/link/app.js` 200; `/docs` 200.
- `telegram.mjs` again (`> $RUN/telegram-post.json`): PASS, `pending_update_count` back to its recorded level or 0.
- `db.mjs postcheck $RUN/pre.json > $RUN/post-update.json` PASS (includes liveness: the worker kept completing `reward-recovery` into this database): 15 journal rows; new tables still empty (nothing creates rows until a raid exists); no counted table lost rows; queue healthy. Repeat after 10 minutes: `reward-recovery` completions continue about every 5 minutes (same proof as the Oct 2 C7 run).
- `fly logs --app hyphae-api --machine 6839d31b317318` (read-only, Cisco present): `api listening on :8080`, no stack trace. Worker logs show no new error.
- Attended, Cisco's own admin private chat, read-only: `/ops <community UUID>` answers with the operator view (empty states, unknown telemetry shown as unknown), and `/receipt` answers with no receipts. These send no group message and create no raid or subscription.
- Vercel is unaffected by this plan: `hyphae-delta.vercel.app` still 200.
- Outside this plan, needs its own approval: a real raid brief, reply/quote buttons, `/issue` on a real receipt, private alert subscriptions and the registered-Lab phone test.

### Rollback (API only; no DB or Git rollback)

If acceptance fails after Step 6:

```
fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api@sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2 --yes
fly image show --app hyphae-api
```

`fly image show` must print `$FROZEN` for the API machine again, `/health` 200, worker unchanged. On 2026-10-05 the registry served this digest (`200`, `application/vnd.docker.distribution.manifest.v2+json`), and the tag `deployment-01M3XYDW5XW7AEAY68CKVPKC2X` that both machines run resolved to the same digest. The additive tables stay; the frozen code ignores them. Never drop or delete a table, reseed, reset a queue, change a credential or force a resend. If the rollback itself fails, stop live work and keep the exact state for read-only diagnosis.

If Step 5 stops with exit 1 or 2 before DDL, or with `LOCK TIMEOUT` or `ROLLED BACK`, nothing was applied and only the built image tag exists. `COMMITTED`, `INCONSISTENT` or `UNKNOWN` means the database state must be reconciled first (Step 5). If Step 4 fails, nothing has changed.

## Other-family review of the scripts and plan

Codex CLI 0.160.0 (`gpt-6-astra`, read-only sandbox, offline; session `01a10be3-4caf-7500-a877-2701a969520b`) reviewed `f551677..38ae3e7`: **NEEDS-FIXES**, 6 findings, all accepted and fixed in the next commit, then re-rehearsed (second round above):

1. Major, DB identity not established (a recent branch/copy passes; a URL `host=` parameter overrides the hostname): liveness rule, query-parameter allowlist, pg effective-target check, Cisco's host confirmation.
2. Major, journal guards compared counts, not contents: full content comparison before DDL and after a lock timeout.
3. Major, postcheck accepted an invalid baseline: phase/verdict/target/count/age validation.
4. Minor, `channel_binding=require` silently ignored by pg: enforced by refusing non-`-PLUS` authentication.
5. Major, plan said every Step 5 failure applied nothing: outcomes now `ROLLED BACK`/`COMMITTED`/`INCONSISTENT`/`UNKNOWN`.
6. Minor, `registry-digest.sh` kept `\r` in the HTTP status: stripped before parsing.

The reviewer found no credential leak path and no wrong flyctl flag, and confirmed the normal path matches drizzle-kit and is atomic.

Fix-check (same tool, session `01a10bed-9742-79b3-8647-9f74e5cf28ff`) on `38ae3e7..463967d`: findings 1, 2, 3, 5 and 6 **FIXED**; 4 **NOT FIXED** (a login without any SASL exchange still became ready) and one new major (migrate checked liveness but not current health, so a stopped worker or paused intake after the baseline could still migrate). Both fixed in the next commit and re-rehearsed (third round above).

## Read-only checks added 2026-10-05T10:38Z to 10:50Z (completion pass)

By Claude Opus 5.5 (`claude-opus-5-5`) on this Mac, from `main` `f551677` = `origin/main`, clean tree. No production write, no message, no secret read.

| Check | Result |
|---|---|
| Held refs | `158452fe…`, `707d7daf…`, `2fd2470a…`, tag `candidate/raid-alerts-2026-10-04` = `c58aa27e…`, all unchanged |
| `git diff 774b97e f551677 -- apps packages pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json .dockerignore` | Empty |
| All 15 migration file hashes in an exact `774b97e` worktree | Equal the table above |
| Driver actually used | `pg@8.23.0` (see Step 2). Corrects the earlier postgres.js claim and open item 4 |
| Local rehearsal | All cases in Step 2 as expected |
| `fly machine list`, `fly image show` | API `6839d31b317318` and worker `817400c9901de8` `started`, both `deployment-01M3XYDW5XW7AEAY68CKVPKC2X` = `$FROZEN`; updated `09:18:28Z` and `09:19:01Z` Oct 2. Same as 09:05Z |
| `fly secrets list` (names and Fly's digests only) | `DATABASE_URL` and `TELEGRAM_BOT_TOKEN` present and `Deployed`, with 9 other secrets. The listed digests do not match a plain SHA-256/SHA-1/MD5 prefix of known public values, so they cannot prove a local value equals the secret |
| Registry (`registry-digest.sh`) | `deployment-01M3XYDW5XW7AEAY68CKVPKC2X` → `200 $FROZEN` (docker v2 manifest); `$FROZEN` by digest → `200`; `member-journey-774b97e` → `404` (unused) |
| Public reads | `/v1/communities/<mint>`: Hyphae Lab, intake open, epoch 2 open `2026-10-02` to `2026-10-09`; `/epochs/2`: config `df5be064-4cee-4f69-84f8-939b46140b1a`, 0 contributions so far |
| `.env` on this Mac | **Still absent** (`$REPO/.env`, `apps/api/.env`, `packages/db/.env`; checked by existence only) |
| Scripts | `pnpm lint` exit 0 with `scripts/rollout/` included; `telegram.mjs` error path with a fake token prints no token |

## Read-only checks run while first preparing this plan (2026-10-05T09:05Z)


| Check | Result |
|---|---|
| `git rev-parse HEAD`, `origin/main` after `git fetch origin` (no prune) | Both `0c02e38f79913161f6cb43d271b715105f4dc634`; status clean |
| Held refs | `158452fe2b22a1e42e5efd42f3f7e11bfdf59c70`, `707d7daf21e217d9a8a64e58514065f5e3bca45e`, `2fd2470a26ff9a349bceeb697b2731bd1bff0e07`, tag `candidate/raid-alerts-2026-10-04` = `c58aa27efdb5bc5492c2f96d45c090c9fc91d379`, all unchanged |
| Live writer | No `.git/*.lock`; a Codex CLI process has this repo as its working directory (pid 44872) but made no change during this session |
| `git diff 774b97e..0c02e38 -- apps packages pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json .dockerignore` | Empty. Only 6 doc files differ |
| `shasum -a 256` of 0013 and 0014, from the working tree and from `git show 774b97e:` | Both match the pinned hashes |
| Hashes of 0000 to 0012 from the files | Computed; 0000 to 0009 equal the Sep 29 cutover table, 0010 to 0012 are new here |
| Migration SQL | 0013 and 0014 contain only `CREATE TYPE`, `CREATE TABLE`, `ALTER TABLE ... ADD CONSTRAINT` on the new tables and `CREATE INDEX` on them |
| Migrator atomicity | `drizzle-orm@0.45.2` `PgDialect.migrate` wraps all pending SQL and journal inserts in one transaction; `drizzle-kit@0.31.10 migrate` imports `drizzle-orm/node-postgres/migrator` or `postgres-js/migrator`; `pg` is not resolvable from `packages/db` here, so the postgres.js driver would be used. **Superseded:** drizzle-kit resolves `pg` from its own location and uses it (completion pass) |
| postgres.js `options` | Source read: a URL `options=` parameter becomes a startup parameter. Not the driver in use; `pg` was proven to forward it in the rehearsal |
| New code and environment | `apps/api/src/env.ts` unchanged since `b3c82c7`; no new variable is read; `Dockerfile`, `fly.toml` unchanged; new boot path adds the raid notifier |
| `flyctl version` | `v0.4.111`; `fly auth whoami` = `cisco_vieira@hotmail.com` |
| `fly status --app hyphae-api` | API `6839d31b317318` and worker `817400c9901de8`, v11, `started`, `cdg`, image `deployment-01M3XYDW5XW7AEAY68CKVPKC2X` |
| `fly machine list`, `fly image show` | Both machines digest `sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2`; updated `2026-10-02T09:18:28Z` (API) and `09:19:01Z` (worker) |
| `fly machine status 6839d31b317318 --display-config`, `fly config show` | `node dist/server.js`, shared 1 CPU/512 MB, http_service 8080 auto-stop off, restart on-failure; env only `FLY_PROCESS_GROUP`, `PRIMARY_REGION` (no secret in config) |
| `fly releases --app hyphae-api --image` | v11 (Oct 2 09:18) is current |
| `fly deploy --help`, `fly machine update --help` | `--build-only`, `--push`, `--image-label`, `--depot`, and `fly machine update <id> --image ... --yes` all exist in 0.4.111 |
| Public reads | `/health`, `/v1/communities/<mint>`, `/v1/communities/<mint>/epochs/2`, `hyphae-delta.vercel.app/`, `/c/<mint>` all HTTP 200; Hyphae Lab epoch 2 open, intake open, as of `2026-10-05T08:57Z` |
| Local `.env` on this Mac | **Absent** (`/Users/cisco/Desktop/projects/hyphae/.env`, `apps/api/.env`, `packages/db/.env`) |

## Open items

1. **Needs you: the production `.env` on this Mac.** Steps 3 to 7 need `DATABASE_URL` and `TELEGRAM_BOT_TOKEN`. Both exist as Fly secrets (names checked), but Fly secrets cannot be read back. Recommended: Cisco creates the gitignored `$REPO/.env` in an editor with those two lines, taking `DATABASE_URL` from the Neon console (the pooled or direct string both work; `db.mjs` uses the direct host) and the token from his password manager. Never paste either in chat. Alternative: copy the `.env` from the Windows PC over a private channel. Step 3's public cross-check then proves it is the right database before anything is written.
2. ~~Image digest unknown until the build.~~ Resolved: Step 4 reads it from the registry and Step 6 updates by `@$NEW`. The only residual unknown is whether flyctl 0.4.111 accepts the digest form for `machine update`; Step 6 names the guarded tag fallback.
3. That `fly machine update` leaves the worker and app release untouched is expected and checked by Step 7 (worker digest and `updated` timestamp), not proven in advance.
4. ~~Migrator driver and timeout.~~ Resolved by the Step 2 rehearsal: `pg` driver, `lock_timeout` 3 s reaches the server, lock failure is classified by `55P03`.
5. **Bot rights** have no fixed pass threshold in the repo beyond "bot is in the registered chat and the designated admin is creator or administrator". `telegram.mjs` enforces exactly that; anything else stops.
6. DB target identity rests on two things: Cisco confirming the printed direct host is the production branch endpoint in the Neon console, and the liveness rule (a `reward-recovery` completion newer than the baseline, which only the live worker's database can show). The public-API match is a consistency check, not identity.
8. `channel_binding=require` is enforced by refusing any authentication without `SCRAM-SHA-256-PLUS`; this relies on pg 8.23 internals (`_handleAuthSASL`) and was proven locally in both directions (refused without SASL or without `-PLUS`; connected through `-PLUS` on a TLS server). If the production precheck fails with `server offered no -PLUS`, stop and ask; do not drop the parameter alone.
7. `fly deploy --build-only --push` writes a new image to the registry and may start the existing remote builder. This is part of E1 and is why it needs the yes.

## Approval wording

Cisco answers one sentence, for example: **"yes, run the 2026-10-05 API rollout plan at 774b97e"**, after the Mac `.env` exists (open item 1). Anything else, including "ok" without naming the plan, is a no. A yes covers E1 to E4 only, once, before Oct 8 12:00Z. It does not cover a raid, any Telegram message, a phone test, the worker, a rollback of the database, or anything during the Oct 8 to Oct 10 sitting.
