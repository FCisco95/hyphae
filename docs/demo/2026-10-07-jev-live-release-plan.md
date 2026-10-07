---
date: 2026-10-07
summary: Draft release plan for making Jev the live epoch 2 reward scorer by a second recorded amendment. Applies migration 0017 through the rehearsed db.mjs, moves the API and the worker to one image, sets the TypeSafe key and JEV_SCORING=on, then records one amendment so epoch 2 contributions admitted from the announced UTC time score with reward-jev/1. Not executed; the question set, the Codex review and Cisco's exact yes are missing.
---

# Jev live scorer release plan (source `<SHA>`)

**Status: DRAFT, not executed. Nothing in this plan has run.** Written 2026-10-07 by Claude Sonnet 5.5 (`claude-sonnet-5-5`, effort high), Session B. Preparing it changed nothing live. Format follows the [pilot amendment plan](2026-10-07-pilot-amendment-release-plan.md). What the code does: [plumbing map](../handoffs/2026-10-07-jev-plumbing-map.md). Cisco's ruling (2026-10-07): Jev replaces the Anthropic scorer in epoch 2.

**Authorization will be Cisco's exact sentence:** **"yes, run the Jev live scorer release"** (proposed; he may change it). Nothing below runs without it.

## Blockers before the yes (all open)

| # | Blocker | Owner |
|---|---|---|
| 1 | Question set `v4` wired into `scoring/jev-registry.ts`, its holdout report done, R1-R3 and P1-P5 passing 3 of 3, every labeled zero staying zero | Session A, Cisco labels |
| 2 | Codex review (read-only, xhigh) of `git diff 18325c6..HEAD` after both branches are merged: ACCEPT. Money-bearing scoring: no push before it | Cisco starts it, agent fixes test-first |
| 3 | The exact public sentence for what Jev is and why (the pages say "prompt" today) | Cisco |
| 4 | `TYPESAFE_API_KEY` added as a Fly secret by Cisco (Step 4). The agent never sets it | Cisco |

If 1 or 2 is not done by about **2026-10-08T08:00Z**, stop: epoch 2 stays on `reward-eval/2`, and nothing here is deployed (the code is inert while `JEV_SCORING` is off, so shipping it alone buys nothing). No deploy after **2026-10-08T12:00Z**.

## What goes live (when the blockers clear)

| Commit (on the merged head `<SHA>`) | What |
|---|---|
| `fadf80c` | A Jev scorer can answer reward quality; request committed before the call; no retries; `JEV_SCORING=off` by default |
| `772caea`, `039f94d` | Amendments chain (migration `0017`), admission pins the latest in effect, one emergency way back, manifest chain check |
| `8d12d2a`, `b672657` | `db.mjs` for 0017, `jev-ping.ts` |
| Session A's merge | The v4 question set, its registry entry, its public documentation |

**What it does not change:** rubric 1.2.0, flags, hard zeros, AI caps, the 60 floor, timing, effort policy and its Anthropic model, points, the payout gate, allocation and its caps, the program, the held refs `158452fe`, `707d7daf`, `2fd2470a`, tag `c58aa27`. Every epoch 2 intake, dispatch and decision admitted before the effective time stays byte-for-byte.

## Exact live effects

| # | Effect | Exact target and bound |
|---|---|---|
| E0 | Cisco pushes `main` | `! git push origin main`. Vercel redeploys the site. |
| E1 | Build and push one image | Source `<SHA>`, detached clean worktree, `apps/api/Dockerfile`, `--frozen-lockfile`, tag `jev-<sha7>` (must read `404` first). |
| E2 | Apply migration 0017 | Production Neon only, through `scripts/rollout/db.mjs` (direct host, `lock_timeout` 3 s, read-only pre- and postchecks, liveness proof). SQL SHA-256 `d630d663625392762f3889eb6dfe78966840651fbd16ae68cf1c02bd03dfc3fe`. Drops one unique index and creates another on `reward_config_amendments` (1 row). Takes ACCESS EXCLUSIVE on that one small table for milliseconds. No data change. |
| E3 | Update the API machine | `6839d31b317318` only, after E2 passes. |
| E4 | Update the worker | `817400c9901de8` only, after E3 passes. |
| E5 | Cisco sets two Fly secrets | `TYPESAFE_API_KEY` and `JEV_SCORING=on`, one command (one restart of both machines). Only after `jev-ping.ts` passes from the image's environment. |
| E6 | Cisco publishes the announcement | On X and in Hyphae Lab, with the effective time **T2**. The agent never posts. |
| E7 | Record one amendment | `amend-epoch.ts` from the exact-source worktree: `--plan` first, then the record, before **T2**. Epoch 2, prompt `reward-jev/1`, effective **T2**, actor `Cisco (founder)`, the reason below. |
| E8 | Nothing else | No proposal, Vercel setting, Telegram message by the agent, link, payout or invitation. |

**Why this order:** the old image runs correctly on the new schema (it only reads the table; with one row the unordered admission lookup returns it). The new image must run, with `JEV_SCORING=on` and a good key, before the first contribution can pin the Jev config. The amendment goes last and is recorded only after the worker proves it can call Jev.

**T2:** a whole minute in UTC, at least 20 minutes after the announcement, and at least 5 minutes after E5's smoke checks pass. Epoch 2 closes 2026-10-09T00:00Z. T2 should be early enough that contributions admitted under Jev can be scored before the C18b intake pause at 2026-10-08T23:00Z.

**Rollback**

| Until | Action |
|---|---|
| Before E7 (no amendment recorded) | API and worker back to `amend-b265204` = `sha256:161252f99dcc4b790e4742f99c9c3f0b4ad43bc6200157d756e33b6e9dfd947a`; `fly secrets unset JEV_SCORING` is optional (the old image ignores it). The migration is never rolled back: the old image runs on it. |
| After E7, before T2 | Cannot unrecord. Turn nothing off; either the Jev path is verified, or record the emergency way back (below) with a later T. |
| After T2, Jev misbehaves | **Emergency exit:** record a third amendment `reward-eval/2` with a new future effective time (the one allowed way back; the epoch's own `reward-eval/1` never). Contributions admitted under Jev stay pinned to Jev and must keep `JEV_SCORING=on` to be scored. Do **not** roll the worker back to `amend-b265204`: it cannot score a Jev pin. |

**The reason recorded:** to be written with Cisco (his words, public). Draft: "The Anthropic scorer was too strict and too costly for a pilot. Jev answers fixed questions about each reply, and code turns its answers into the score. Same rubric, same hard zeros, same floor."

## Step 0. Guards (read-only)

1. Cisco's push done (E0). `git fetch origin`; the source `<SHA>` is an ancestor of `origin/main`; runtime-tree diff empty; `git status -sb` clean and not ahead. GitHub CI on the pushed head: success.
2. Gate on `<SHA>`, native: `pnpm test`, `pnpm typecheck`, `pnpm lint` (exit codes), `pnpm --filter @hyphae/db exec drizzle-kit check`, `pnpm --filter @hyphae/api test:pg` (Docker). Known intermittents: the member-journey and raid-alert Postgres tests, and `src/link/page-handoff.test.ts` under load; a failure outside that list stops the release.
3. `registry-digest.sh jev-<sha7>` prints `404`; `registry-digest.sh amend-b265204` prints `200 sha256:161252f9…`.
4. `fly image show --app hyphae-api`: both machines `started` on `sha256:161252f9…`.
5. `date -u` is before 2026-10-08T12:00Z.
6. `node --env-file=.env scripts/rollout/telegram.mjs -1003934645546 784434992` PASS.
7. Live reads: `/v1/communities/<mint>/epochs/2` shows exactly one amendment (`a75dbfeb…`, `reward-eval/2`, effective 2026-10-07T18:00:00Z).
8. **Baseline fingerprint**, from `packages/db`, taken at Step 0 and again right before E7: `node --env-file=$REPO/.env $REPO/scripts/rollout/decisions-digest.mjs <mint> 2 > $RUN/epoch2-before.json`. Record intakes, decisions and dispatches counts and hashes. After E7 with the cutoff T2 it must equal the baseline for everything accepted before T2; new rows after T2 are expected.
9. `jev-ping.ts` from the worktree with the key in the environment: one answer from `jev-1.13.0`. (It runs on Cisco's machine or the agent's shell with the key already exported, never in a file.)

## Step 1. Exact-source worktree and image

```
git -C $REPO worktree add --detach $WT <SHA>
cd $WT && git rev-parse HEAD && pnpm install --frozen-lockfile
fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --app hyphae-api --build-only --push --image-label jev-<sha7> --depot=false
bash $REPO/scripts/rollout/registry-digest.sh jev-<sha7>      # 200 sha256:<NEW>
```

## Step 2. Migration 0017 (E2)

From `$WT/packages/db`:

```
node --env-file=$REPO/.env $REPO/scripts/rollout/db.mjs precheck > $RUN/pre.json; echo $?     # 0, PASS, one amendments row, index reward_config_amendments_epoch(epoch_id)
# wait for the next reward-recovery completion (about 5 min)
node --env-file=$REPO/.env $REPO/scripts/rollout/db.mjs migrate $RUN/pre.json; echo $?        # 0, APPLIED 17 -> 18
node --env-file=$REPO/.env $REPO/scripts/rollout/db.mjs postcheck $RUN/pre.json > $RUN/post.json; echo $?   # 0, PASS, index reward_config_amendments_epoch_from(epoch_id,from_config_id), 1 row, deltas 0
```

Exit 2 (lock timeout): nothing applied; retry at most 3 times, then stop and ask. Exit 1: `NOT MIGRATING` means nothing changed; any other outcome means stop and ask Cisco.

Rehearsal done 2026-10-07 on a disposable `postgres:17` seeded in Hyphae Lab's shape (migrations 0000 to 0016, one amendment): precheck PASS; migrate refused without a newer `reward-recovery`; migrate while another session held ROW EXCLUSIVE on the table: `55P03 … lock timeout`, journal and schema unchanged, exit 2; migrate `APPLIED: journal 17 -> 18 rows, ending 0017_reward_amendment_chain`; postcheck PASS with every count delta 0; a second migrate refused. Production has not been touched.

## Step 3. API machine, then worker (E3, E4)

```
bash $REPO/scripts/rollout/registry-digest.sh jev-<sha7>      # still 200 <NEW>
fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api:jev-<sha7> --yes
```

Checks: the API on `<NEW>`; `/health` 200; community 200; `/epochs/2` 200 with one amendment, `reward-eval/2` in force; a contribution read 200; `/link` 200; `telegram.mjs` PASS; log `api listening`, no stack trace. Any failure: roll the API back.

```
fly machine update 817400c9901de8 --app hyphae-api --image registry.fly.io/hyphae-api:jev-<sha7> --yes
```

Checks: the worker on `<NEW>`, `started`; `reward-recovery` completes at least twice, all counters 0; no stack trace. `JEV_SCORING` is still off, so the log must show no Jev line. Then `decisions-digest.mjs` equals the Step 0 baseline.

## Step 4. Key and switch (E5, Cisco)

Cisco runs one command, with the key already in his shell (the value is never typed into the chat or a file):

```
! fly secrets set "TYPESAFE_API_KEY=$TYPESAFE_API_KEY" JEV_SCORING=on --app hyphae-api
```

Checks: both machines restart and return to `started`; the worker log shows no `scoring:` error (a missing key or empty registry stops the worker at boot, by design); `reward-recovery` completes again; `GET /health` 200. If the worker does not start: `fly secrets unset JEV_SCORING --app hyphae-api` and read the log before anything else.

## Step 5. Announcement (E6, Cisco)

Cisco publishes the X post and the Telegram message with **T2**. Draft text is in "Announcement" below; Cisco edits it. He sends the agent the post URL and T2.

## Step 6. Record the amendment (E7)

From `$WT/apps/api`, with **T2** as `YYYY-MM-DDTHH:MM:00Z`:

```
node --env-file=$REPO/.env --import tsx scripts/amend-epoch.ts <mint> --epoch 2 --prompt reward-jev/1 --effective-at T2 --actor "Cisco (founder)" --reason "<the reason>" --plan
node --env-file=$REPO/.env --import tsx scripts/amend-epoch.ts <mint> --epoch 2 --prompt reward-jev/1 --effective-at T2 --actor "Cisco (founder)" --reason "<the reason>"
```

Checks: the plan names `reward-eval/2` → `reward-jev/1` with the template hash of the question set (`jevTemplateHash("jev-1.13.0", QUESTIONS_V4)`, printed by the plan and equal to the one in the repo docs); the record's `recorded_at` is before **T2**; `GET /epochs/2` shows two amendments in order; `decisions-digest.mjs <mint> 2 <T2>` equals the baseline taken just before. A refusal changes nothing: read it and stop. The refusals to expect: "the previous amendment … is not yet in effect" (impossible after 18:00Z), "already used by epoch 2" (asked for `reward-eval/1`), "not registered" (registry missing from the image).

## Step 7. Live acceptance

- A reply admitted after **T2**: `GET /v1/contributions/<id>` shows `amendment: { effective_at: T2, prompt_version: "reward-jev/1" }`; once scored, its revision's `model.model` is `typesafe:jev-1.13.0`, `prompt_version` `reward-jev/1`, `cost_micro_usd` about 80 to 200, and its `explanation` starts "Composed from jev-1.13.0 answers".
- A reply admitted before **T2** and scored after it still reads `reward-eval/2` and Sonnet.
- `decisions-digest.mjs <mint> 2 <T2>` equals the baseline at every later run.
- The audit manifest for epoch 2 (built later, at close) lists both amendments; `buildPublication` dry run against the production copy is the Oct 8 to 9 sitting's job, but a read-only check now is cheap: `GET /epochs/2` parses with `ReadApiV1.epoch`.
- The epoch page shows two amendments.

## Announcement (draft; Cisco publishes, the agent never posts)

**Telegram (Hyphae Lab):**

> Scoring update for epoch 2
>
> From {T2} UTC, new epoch 2 replies are scored by Jev, a model that answers fixed questions about each reply. Code turns the answers into the score. The goal is to remove low effort and unrelated replies and give honest replies a fair score.
>
> Not changing: anything submitted before {T2} keeps its score. The rubric, the hard zeros, the AI-writing caps, the 60-point floor and the payout rules stay. Both changes are recorded on the epoch 2 page.

## What Session A must hand over

See section 4 of the [plumbing map](../handoffs/2026-10-07-jev-plumbing-map.md): the registry entry, the `dependencies` placement of the SDK, deterministic question JSON, the member-visible explanation, and the public sentence.

## Needs Cisco (in order)

1. Label the holdout when Session A sends it.
2. Say when Jev is ready to release, and the exact yes.
3. The public sentence and the recorded reason.
4. `! git push origin main` (E0) and the two `fly secrets` in one line (E5), each only after the previous check passes.
5. Post the announcement and give the agent the URL and T2.
