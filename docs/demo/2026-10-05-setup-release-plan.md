---
date: 2026-10-05
summary: API-only release of the guided /setup checklist and the wallet-browser link message (runtime source 5808972). No migration, worker untouched, one machine updated by digest. Reuses the build, update-by-digest, acceptance and rollback steps of the 2026-10-05 API rollout plan. Executed 2026-10-05.
---

# Setup release plan: guided /setup on the live Hyphae API

**Status: EXECUTED 2026-10-05T21:19Z to 21:22Z (see [Execution record](#execution-record-2026-10-05)).** Authorized by Cisco's exact sentence "yes, run the 2026-10-05 setup release plan at 5808972". Written 2026-10-05 by Claude Sonnet 5.5 (`claude-sonnet-5-5`, effort high) on the Windows PC from `main`. Nothing in this document changed Fly, the database, Telegram, secrets or Vercel settings. The only effect of pushing it is the existing Vercel web build.

**Why:** invited members never reached the wallet-link step (the database holds one Telegram account with a link session: Cisco's). The old private link message did not say that Telegram's built-in browser cannot sign, there was no guide through the five steps, and the 100,000 MYCEL hold was never shown. This release adds `/setup` (a private five-step checklist), a new link message with Phantom/Solflare instructions and a tap-to-copy link, and an honest "what payment needs" text.

**What it does not change:** reward, epoch, payout and rubric rules; the hold is explained, not changed. The link session, the membership check and the 15-minute single-use rule are unchanged in effect. No migration. The worker stays frozen.

## Exact live effects (everything the yes would allow)

| # | Effect | Exact target and bound |
|---|---|---|
| E1 | Build and push one image | Source: commit `SRC` = `5808972` (the last commit that touches `apps/` or `packages/`; later docs commits do not change the runtime tree, and `.dockerignore` excludes `docs`). Detached clean worktree, existing `apps/api/Dockerfile`, `pnpm-lock.yaml` with `--frozen-lockfile`, Fly remote builder, registry `registry.fly.io/hyphae-api`. New unique tag `setup-5808972` (registry `404` on 2026-10-05, so unused). Its digest `$NEW` is read from the registry right after the build. |
| E2 | Update the API machine | **Only machine `6839d31b317318`** (process `api`, app `hyphae-api`, region `cdg`) moves to `registry.fly.io/hyphae-api@$NEW`. It restarts; the gap was about 10 s on the last update. Telegram retries webhook updates, so a message sent in the gap is delivered afterwards. |
| E3 | Nothing else | No migration (`git diff 774b97e..5808972 -- packages/db` is empty). Worker `817400c9901de8` is not touched. No secret, env var, Fly config, Vercel setting, webhook, message, subscription, raid, wallet signature or payout. `READ_RPC_URL` is already a Fly secret (checked by name on 2026-10-05); without it the checklist would show a generic hold text instead of the amount. |

**Frozen, unchanged:** worker `817400c9901de8` on `sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2`, last updated `2026-10-02T09:19:01Z`. API machine today: `sha256:798e18880fd0ce8684c6f4627010e0653ede8a3e3e33584654f6e53cc31ac90c` (updated `2026-10-05T14:26:31Z`) = the rollback target. Held refs untouched: `158452fe`, `707d7daf`, `2fd2470a`, tag `c58aa27`.

## Timing guard

- Estimate 15 to 25 minutes: build 2 to 5 min, update about 1 min, checks, 10-minute worker proof.
- **No deploy and no push to `main` from 2026-10-08T22:00:00Z until 2026-10-10T00:00:00Z.** If this has not run by 2026-10-08T12:00Z, defer it past Oct 10 00:00Z and say so.
- Epoch 2 is open and closes 2026-10-09T00:00Z. Do not pause intake for this.

## Why this is safe to ship

- The change is bot-only: new `/setup` command, two new callbacks, a changed private link message, and the shared `sendLinkMessage`. Reward, scoring, gate and publication code is not in the diff.
- Source reviewed by an independent Codex pass (`gpt-6-astra`, xhigh, read-only): NEEDS-FIXES with two should-fix findings (hold amount rounded down; payment text omitted gate conditions) and one test gap. All three fixed test-first in `5808972`. No auth bypass, token leak, HTML-escaping defect or callback collision was found. The two earlier probes on forged and group-chat callbacks passed.
- Native Windows gate on `5808972`: `pnpm test` (788 API tests passed / 3 skipped), `pnpm typecheck` 0, `pnpm lint` 0.

## Execution order and exact commands

Run in Git Bash on the Windows PC with Cisco present. Variables: `APP=hyphae-api`, `API=6839d31b317318`, `WORKER=817400c9901de8`, `SRC=5808972` (use the full 40-character SHA), `FROZEN=sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2`, `PREV=sha256:798e18880fd0ce8684c6f4627010e0653ede8a3e3e33584654f6e53cc31ac90c`, `TAG=setup-5808972`, `REPO=/c/Users/joao_/Desktop/DEVELOPMENTS/hyphae`, `WT=/c/Users/joao_/Desktop/DEVELOPMENTS/hyphae-setup-5808972`. `NEW` is set in Step 3.

### Step 0. Guards (read-only)

1. `git -C $REPO status -sb` is clean, no `.git/*.lock`. `git -C $REPO fetch origin`, then `git merge-base --is-ancestor $SRC origin/main` is true.
2. `git -C $REPO diff --stat $SRC origin/main -- apps packages pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json .dockerignore` is empty.
3. `bash $REPO/scripts/rollout/registry-digest.sh $TAG` prints `404`. `registry-digest.sh $PREV` and `registry-digest.sh $FROZEN` both print `200` (rollback target exists).
4. `fly machine list --app hyphae-api` and `fly image show --app hyphae-api`: API `started` on `$PREV`, worker `started` on `$FROZEN`.
5. `date -u` is before Oct 8 12:00Z.
6. `node --env-file=$REPO/.env $REPO/scripts/rollout/telegram.mjs <chat id> <admin id>` PASS (bot rights, webhook, `pending_update_count` recorded). Chat and admin IDs: see the private infra note.

### Step 1. Exact-source worktree (local only)

```
git -C $REPO worktree add --detach $WT $SRC
cd $WT && git rev-parse HEAD            # must equal $SRC
pnpm install --frozen-lockfile
```

### Step 2. Build and push the image only (no machine change)

```
cd $WT
fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --app hyphae-api --build-only --push --image-label setup-5808972 --depot=false
bash $REPO/scripts/rollout/registry-digest.sh setup-5808972     # 200 sha256:<NEW>
NEW=sha256:<the printed digest>
bash $REPO/scripts/rollout/registry-digest.sh $NEW              # 200 $NEW again
```

`$NEW` must differ from `$PREV` and `$FROZEN`. `fly machine list` still shows the API on `$PREV` and the worker on `$FROZEN`. Never run this without `--build-only` (a plain deploy would roll the worker).

### Step 3. Update the API machine only, by digest

```
bash $REPO/scripts/rollout/registry-digest.sh $NEW        # still 200 $NEW
fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api@$NEW --yes
fly machine list --app hyphae-api
fly image show --app hyphae-api
```

The digest form was accepted by flyctl 0.4.111 on the Mac; this PC has 0.4.104. If it rejects the digest form before changing the machine, use `--image registry.fly.io/hyphae-api:setup-5808972` only after `registry-digest.sh setup-5808972` prints `$NEW` again in the same minute.

### Step 4. Acceptance checks (any failure goes to Rollback)

- `fly image show`: API digest equals `$NEW` and `started`. Worker digest `$FROZEN`, `started`, last updated `2026-10-02T09:19:01Z`.
- `GET https://hyphae-api.fly.dev/health` is 200 `{"ok":true}`; `/v1/communities/<mint>` and `/epochs/2` 200 with epoch 2 open and intake open; `/link`, `/link/app.js`, `/docs` 200; `hyphae-delta.vercel.app` 200.
- `telegram.mjs` again: PASS, webhook matches, `pending_update_count` back to its recorded level or 0.
- `fly logs --app hyphae-api --machine 6839d31b317318` (read-only): `api listening on :8080`, no stack trace.
- Worker proof: `reward-recovery` completes again at about 5-minute spacing at least twice after the update, 0 failed jobs (`node --env-file=$REPO/.env $REPO/scripts/rollout/db.mjs postcheck` needs a baseline from `precheck`; for an API-only update the Fly logs of the worker are enough: `fly logs --app hyphae-api --machine 817400c9901de8`).
- Attended, by Cisco from the real group: send `/setup`. Expected: one reply with a single **Start setup** button. Tapping it opens the private chat with the checklist. This is the first test of the new code in production and is Cisco's action, not the agent's.

### Rollback (API only; no database or Git rollback)

```
fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api@sha256:798e18880fd0ce8684c6f4627010e0653ede8a3e3e33584654f6e53cc31ac90c --yes
fly image show --app hyphae-api
```

`fly image show` must print `$PREV` for the API machine again, `/health` 200, worker unchanged. Pending `/setup` buttons then do nothing (the old code ignores `setup_` callbacks and `setup_<uuid>` start payloads), which is harmless. If the rollback itself fails, stop live work and keep the exact state for read-only diagnosis.

## Execution record (2026-10-05)

By Claude Sonnet 5.5 on the Windows PC with Cisco present. Reports and the worktree `hyphae-setup-5808972` are local only.

| Step | Time (UTC) | Result |
|---|---|---|
| 0 Guards | 21:18 | Clean `main` = `origin/main`, no locks; `5808972` is an ancestor; runtime-tree diff to `origin/main` empty; tag `setup-5808972` was `404`; `$PREV` and `$FROZEN` both `200` in the registry; API and worker `started` on `$PREV` / `$FROZEN`; `telegram.mjs` **PASS**, 0 pending, no last error |
| 1 Worktree | 21:19 | Detached at exactly `58089727a0ab397e3fc1e9be60307e7345b12406`, `pnpm install --frozen-lockfile` 12.8 s |
| 2 Build | 21:20 | `fly deploy --build-only --push --image-label setup-5808972 --depot=false`, 350 MB. Pushed `setup-5808972` -> **`NEW=sha256:d9955c7665c31e3ebdc4953e3902275ccf7191f53accc2a98428f9c8443fef6f`** (manifest v2). Registry read by tag and by digest both `200 $NEW`. Machines unchanged |
| 3 Update, digest form | 21:20:50 | **flyctl 0.4.104 rejected it** before changing anything (`config.image: invalid image identifier`; it appended the digest twice). Machines verified untouched |
| 3 Update, guarded tag fallback | 21:21:07 to 20:21:28 | Registry re-read: tag still `200 $NEW`. `fly machine update 6839d31b317318 --image registry.fly.io/hyphae-api:setup-5808972 --yes`: updated successfully, "Machine created and started in 11.363s" |
| 4 Fly | 21:21 | API `6839d31b317318` `started`, digest **`$NEW`**, updated 21:21:27Z. Worker `817400c9901de8` `started`, digest **`$FROZEN`**, updated `2026-10-02T09:19:01Z`, unchanged |
| 4 HTTP | 21:22 | `/health` 200 `{"ok":true}`; `/v1/communities/<mint>` 200 (intake open, epoch 2 open, closes `2026-10-09T00:00Z`); `/epochs/2`, `/link`, `/link/app.js`, `/docs` 200; `hyphae-delta.vercel.app` 200 |
| 4 Logs | 21:21:32 | API: `api listening on :8080`, no stack trace (pg's known `sslmode` alias warning only) |
| 4 Telegram | 21:22 | `telegram.mjs` **PASS**: webhook matches, 0 pending, no last error |
| 4 Worker proof | 21:21 to 21:30 | **PASS**: worker completed `reward-recovery` at 21:25:16Z and 21:30:16Z after the update (about every 5 min), all counters 0, no error lines. API logs show no error since the restart |

Digest-form note for next time: on flyctl 0.4.104 use the tag form after the registry check; the plan's fallback worked as written. The rollback command below uses the digest form and may hit the same rejection; the tag `member-journey-774b97e` points to `$PREV`, so use `--image registry.fly.io/hyphae-api:member-journey-774b97e` after `registry-digest.sh member-journey-774b97e` prints `$PREV`.

Not done by this plan: no migration, secret, env, Fly config, Vercel, webhook, message, subscription, raid, payout or worker change. Rollback was not needed. The attended `/setup` check in the real group is Cisco's.

## What this plan does not do

It sends no Telegram message, links no wallet, signs nothing, creates no raid and invites no one. The attended phone test that follows is [in the handoff](../HANDOFF.md) and is performed by Cisco on a second Telegram account or a stuck member's phone.

## Approval wording

Cisco answers one sentence: **"yes, run the 2026-10-05 setup release plan at 5808972"**. Anything else, including "ok" without naming the plan, is a no. A yes covers E1 to E3 only, once, before Oct 8 12:00Z.
