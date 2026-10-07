---
date: 2026-10-07
summary: Draft release plan for making Jev the live epoch 2 reward scorer by a second recorded amendment. Applies migration 0017 through the rehearsed db.mjs, moves the API and the worker to one image, sets the TypeSafe key and JEV_SCORING=on, then records one amendment so epoch 2 contributions admitted from the announced UTC time score with reward-jev/1. Not executed; the question set, the Codex review and Cisco's exact yes are missing.
---

# Jev live scorer release plan (source `<SHA>`)

**Status: DRAFT, not executed. Nothing in this plan has run.** Written 2026-10-07 by Claude Sonnet 5.5 (`claude-sonnet-5-5`, effort high), Session B; merged and updated the same night by Claude Opus 5.5 (Session A) on branch `jev-live` = `ed32b4f` + the session prompts + B's commits + `feat/jev-eval` + A's commits and review fixes, then merged with `origin/main` (`fb89ba4`, docs) and `feat/haiku-55` (`d19889a`: `328fb45`, the source of the live image `haiku55-328fb45`, plus its records). So the Jev image keeps Claude Haiku 5.5 as the Anthropic model: it scores effort nominations on `reward-eval/2`, every contribution admitted before T2, and everything if `JEV_SCORING` is off. Preparing it changed nothing live. Format follows the [pilot amendment plan](2026-10-07-pilot-amendment-release-plan.md). What the code does: [plumbing map](../handoffs/2026-10-07-jev-plumbing-map.md). Cisco's ruling (2026-10-07): Jev replaces the Anthropic scorer in epoch 2.

**Authorization will be Cisco's exact sentence:** **"yes, run the Jev live scorer release"** (proposed; he may change it). Nothing below runs without it.

## Blockers before the yes (all open)

| # | Blocker | Owner |
|---|---|---|
| 1 | Question set `v4` wired into `scoring/jev-registry.ts`, its holdout report done, R1-R3 and P1-P5 passing 3 of 3, every labeled zero staying zero | **Done, with exceptions for Cisco to accept:** registered as `reward-jev/1` (`2473c62`); [calibration](../evals/jev-v4-calibration-2026-10-07.md): 84 of 84 on the reward cases, R1-R3 and P1-P5 pass 3 of 3 (74 to 95). On the 64-reply holdout one labeled zero passes (reply 26, 74) and two labeled passes are zeroed (jokes built on a cheer). Rerun live through the production client and registry: same results, 0 errors, slowest call 607 ms. **Cisco accepted these three misses and chose to release (2026-10-07, about 20:50Z).** |
| 2 | Codex review (read-only, xhigh) of `git diff ed32b4f..HEAD` on `jev-live`, then of the merged head with `feat/haiku-55` (the live image's source): ACCEPT. Money-bearing scoring: no push before it | **Done: ACCEPT** on `1185ad1` after five medium findings were fixed test-first ([review record](../reviews/2026-10-07-jev-live.md)) |
| 3 | The exact public sentence for what Jev is and why (the pages say "prompt" today) | **Done:** Cisco approved the reason, the announcement and the line (below); the security page names TypeSafe and the amendment chain |
| 4 | `TYPESAFE_API_KEY` added as a Fly secret by Cisco (Step 4). The agent never sets it | Cisco |

If 1 or 2 is not done by about **2026-10-08T08:00Z**, stop: epoch 2 stays on `reward-eval/2`, and nothing here is deployed (the code is inert while `JEV_SCORING` is off, so shipping it alone buys nothing). No deploy after **2026-10-08T12:00Z**.

## What goes live (when the blockers clear)

| Commit (on `jev-live`; B's original SHAs in brackets) | What |
|---|---|
| `99bc61a` (`fadf80c`) | A Jev scorer can answer reward quality; request committed before the call; no retries; `JEV_SCORING=off` by default |
| `f2caae3`, `9326fd7` (`772caea`, `039f94d`) | Amendments chain (migration `0017`), admission pins the latest in effect, one emergency way back, manifest chain check |
| `ceb768a`, `07db478` (`8d12d2a`, `b672657`) | `db.mjs` for 0017, `jev-ping.ts` |
| `6ad67b4` | Merge of `feat/jev-eval`: the Jev engine (`jev.ts`) and the eval harness |
| `17546e4`, `2473c62`, `03d618d` | Question set v4 and its composition; its registry entry `reward-jev/1`; the member-readable explanation; `@typesafe-ai/sdk` under `dependencies` only |

Everything else in the image is already live (`haiku55-328fb45`, since about 20:01Z on 2026-10-07).

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
| Before E7 (no amendment recorded) | API and worker back to `haiku55-328fb45` = `sha256:4218b2a901b93db1bf1cad550c4fd219a817552e92e45fc70c669c6f9e097d12` (live since about 20:01Z on 2026-10-07); `fly secrets unset JEV_SCORING` is optional (the old image ignores it). The migration is never rolled back: the old image runs on it. |
| After E7, before T2 | Cannot unrecord. Turn nothing off; either the Jev path is verified, or record the emergency way back (below) with a later T. |
| After T2, Jev misbehaves | **Emergency exit:** record a third amendment `reward-eval/2` with a new future effective time (the one allowed way back; the epoch's own `reward-eval/1` never). Contributions admitted under Jev stay pinned to Jev and must keep `JEV_SCORING=on` to be scored. Do **not** roll the worker back to `haiku55-328fb45`: it cannot score a Jev pin. |

**The reason recorded (approved by Cisco, 2026-10-07):** "Jev scores the way this rubric asks: on our published tests it zeroes greetings, hype, shills and attempts to instruct the scorer, and passes honest replies, at a fraction of the cost. New in this change: a reply that tries to instruct the scorer scores 0. The tests and their known misses are public."

It must say the new zero: question set v4 zeroes a reply that tries to instruct the scorer, which rubric 1.2.0 does not list, so "same hard zeros" alone would be untrue.

## Step 0. Guards (read-only)

0. **Before E0, put `main` on `jev-live` (agent, after the yes).** At 20:54Z local `main` was `origin/main` (`fb89ba4`) plus `3adcf63`, the session prompts, whose content is `a366d60` in `jev-live`. Check `git cherry -v jev-live main` prints only `-` lines (nothing on `main` that `jev-live` lacks), then in the main checkout `git reset --keep jev-live` (keeps untracked files, refuses if anything local would be lost); `git status -sb` must show `main...origin/main [ahead N]` and no behind. This also publishes `328fb45` (Haiku 5.5, live since 20:01Z but not yet on `origin/main`).
1. Cisco's push done (E0). `git fetch origin`; the source `<SHA>` is an ancestor of `origin/main`; runtime-tree diff empty; `git status -sb` clean and not ahead. GitHub CI on the pushed head: success.
2. Gate on `<SHA>`, native: `pnpm test`, `pnpm typecheck`, `pnpm lint` (exit codes), `pnpm --filter @hyphae/db exec drizzle-kit check`, `pnpm --filter @hyphae/api test:pg` (Docker). Known intermittents: the member-journey and raid-alert Postgres tests, and `src/link/page-handoff.test.ts` under load; a failure outside that list stops the release.
3. `registry-digest.sh jev-<sha7>` prints `404`; `registry-digest.sh haiku55-328fb45` prints `200 sha256:4218b2a9…`.
4. `fly image show --app hyphae-api`: both machines `started` on `sha256:4218b2a9…` (`haiku55-328fb45`). Any other digest means the live image moved again: stop and re-read the handoff before going on.
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

- A reply admitted after **T2**: `GET /v1/contributions/<id>` shows `amendment: { effective_at: T2, prompt_version: "reward-jev/1" }`; once scored, its revision's `model.model` is `typesafe:jev-1.13.0`, `prompt_version` `reward-jev/1`, `cost_micro_usd` about 200 (the calibration runs averaged 205), and its `explanation` starts "Scored 0 because" or "Passed every check".
- A reply admitted before **T2** and scored after it still reads `reward-eval/2` and Claude Haiku 5.5 (`anthropic:claude-haiku-5-5`).
- `decisions-digest.mjs <mint> 2 <T2>` equals the baseline at every later run.
- The audit manifest for epoch 2 (built later, at close) lists both amendments; `buildPublication` dry run against the production copy is the Oct 8 to 9 sitting's job, but a read-only check now is cheap: `GET /epochs/2` parses with `ReadApiV1.epoch`.
- The epoch page shows two amendments.

## Announcement (approved by Cisco, 2026-10-07; he publishes, the agent never posts)

**Telegram (Hyphae Lab):**

> Scoring update for epoch 2
>
> From {T2} UTC, new epoch 2 replies are scored by Jev, a small model that answers fixed yes/no questions about each reply. Code turns the answers into the score, and your receipt says why.
>
> Zero: greetings and hype that fit under any post, restating the post in polished or AI-style wording, off-topic replies or promoting something else, buy or price calls, spam, and (new) any reply that tries to tell the scorer what to do. A related reply in your own words starts at 65; a real question, a suggestion, something of your own or your reasoning adds more.
>
> Not changing: anything submitted before {T2} keeps its score. The rubric, the AI-writing caps, the 60 floor and the payout rules stay. Both changes are on the epoch 2 page.

The X post is Cisco's to adapt from it.

**The line for what Jev is (approved):** "Jev (TypeSafe, `jev-1.13.0`) answers fixed yes/no questions about each reply; it never writes the score. Our code turns its answers into the score, and the receipt says why."

**The security page** (`apps/web/lib/trust.ts`, `docs/SECURITY.md`) is updated on this branch so it is true before and after T2: TypeSafe is listed with Anthropic as receiving a contribution and its post (only for an epoch that pins Jev), the amendment claim describes the chain and says "First used on 2026-10-07" instead of "Used once", and the v4 calibration is listed as our own test. It deploys with E0.

## What Session A must hand over

See section 4 of the [plumbing map](../handoffs/2026-10-07-jev-plumbing-map.md): the registry entry, the `dependencies` placement of the SDK, deterministic question JSON, the member-visible explanation, and the public sentence.

## Needs Cisco (in order)

1. ~~Label the holdout~~ (done), ~~accept v4's known misses~~ (done), ~~approve the public texts~~ (done).
2. Say when to release, with the exact yes.
3. `! git push origin main` (E0) and the two `fly secrets` in one line (E5), each only after the previous check passes.
4. Post the announcement and give the agent the URL and T2.
