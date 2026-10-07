---
date: 2026-10-07
summary: Release that moves the reward scorer from Claude Sonnet 5 to Claude Haiku 5.5 with the same prompt (reward-eval/2) and no database change. One image from 328fb45 (live source ed32b4f plus this change), API then worker, rollback to buttons-ed32b4f.
---

# Haiku 5.5 scorer release plan (source `328fb45`)

**Status: EXECUTED 2026-10-07T19:57Z to 20:12Z (E1 to E3 done, Step 4 acceptance pending the next scored contribution). Prepared as: Codex review (`gpt-6-astra`, xhigh, read-only): NEEDS-FIXES (live image was `buttons-ed32b4f`, not `amend-b265204`; fingerprint cutoff; public wording; rollback bound; judged denominators), fixed, fix check NEEDS-FIXES (late notification time can change the digest), fixed, ACCEPT on `24e38ee`.** Written 2026-10-07 by Claude Sonnet 5.5 (`claude-sonnet-5-5`) on the Windows PC from the live source `ed32b4f` plus one commit. Preparing it changed nothing live. Authorization is Cisco's exact sentence: **"yes, run the Haiku 5.5 scorer release"**. Cisco's ruling (2026-10-07): use Haiku 5.5 now; Jev (typesafe System One) is the next scorer and is built in parallel, so this release is the safe step, not the end state.

## What goes live

| Commit | What |
|---|---|
| `328fb45` | The code default `SCORING_MODEL` becomes `anthropic:claude-haiku-5-5`; the price table gains Haiku 5.5 ($0.10 in / $0.50 out per MTok) and states Sonnet 5 at its current $2/$10. The prompt, rubric, flags, credit rules, epoch config and amendment are untouched. |

There is no `SCORING_MODEL` set on Fly, so the default applies after the machines restart. No migration, no secret, no config change. The model is not pinned in the epoch config: every decision records the model it ran on, so the change is visible per decision and rewrites no past row.

## Evidence

28 reward cases x 3 runs (84 calls; 78 are judged, because A2 and I8 are shown, not judged), rubric `mycel-1.2.0`, prompt `reward-eval/2`, production renderer and credit rules, run 2026-10-07:

| Scorer | Wrong of 78 judged | Cost for 84 calls |
|---|---|---|
| Sonnet 5 (live) | 0 | about USD 0.7 |
| Sonnet 5.5 medium | 6 (R2, P3 credited 0 at raw 58) | USD 0.74 |
| Haiku 4.5 | 6 (R1, R2) | USD 0.29 |
| **Haiku 5.5** | **3 (R2 only)** | **USD 0.048** |

Haiku 5.5 passes R1, R3 and P1-P5 in every run and credits 0 for every spam, price, other-project, AI-slop and pure-injection case. A2 (polished abstract praise, shown) credits 0 in 3 of 3 (raw 30-35); I8 (a real reply with an injection appended, shown) scores 65-68 against 66-68 for the plain reply, so it is not inflated. It misses R2 (the founder's own pitch quote: the scorer cannot see the quoted post). Limits: 3 runs on 28 cases, the prompt wording was tuned on these cases, and R2 is a real reply that does not pass. This is a regression guard, not proof of calibration.

## Exact live effects

| # | Effect | Exact target and bound |
|---|---|---|
| E1 | Build and push one image | Source `328fb45`, detached clean worktree, `apps/api/Dockerfile`, `--frozen-lockfile`, Fly remote builder, new tag `haiku55-328fb45` (must read `404` first). |
| E2 | Update the API machine | Only `6839d31b317318`. |
| E3 | Update the worker | Only `817400c9901de8`, after E2 passes. |
| E4 | Nothing else | No migration, secret, env, Fly config, Vercel setting, push to `main`, Telegram message, payout or amendment. Cisco posts the short public note himself. |

The image is built from `328fb45`, which is the live source `ed32b4f` (tag `buttons-ed32b4f`, three open raids) plus this one commit. `main` may hold later commits that this release does not authorize. Whoever deploys next must start from a branch that contains `328fb45`, or the next image would silently return to Sonnet 5.

**Rollback:** API and worker tag `buttons-ed32b4f` = `sha256:fa0b2c955b16e7096c629aebeb6c65ca46337ba3365d75e254c59c655529a5ed` (the current image on both machines, verified 2026-10-07). It is the same code but for the model default, so it is compatible with the database. Allowed only inside this release's window (before 2026-10-08T12:00Z) as part of a failed step; any later rollback is a deploy and needs its own yes outside the 22:00Z hold. Decisions already made stay as recorded.

## Timing guard

- All of it in one attended sitting, **before 2026-10-08T12:00Z**; estimate 20 to 30 minutes.
- **No deploy and no push to `main` from 2026-10-08T22:00Z until 2026-10-10T00:00Z.**

## Order of work

### Step 0. Guards (read-only)

1. `git -C $REPO merge-base --is-ancestor ed32b4f 328fb45` succeeds; `git diff --stat ed32b4f 328fb45 -- apps packages pnpm-lock.yaml` shows only the five files of `328fb45`.
2. Gate on `328fb45`: `pnpm test`, `pnpm typecheck`, `pnpm lint` all exit 0 (a fresh worktree needs `pnpm --filter @hyphae/read-client build` first).
3. `registry-digest.sh haiku55-328fb45` prints `404`; `registry-digest.sh buttons-ed32b4f` prints `200 sha256:fa0b2c95…`.
4. `fly image show --app hyphae-api`: both machines `started` on `sha256:fa0b2c95…`.
5. `date -u` is before Oct 8 12:00Z. A Codex review of `git diff ed32b4f..328fb45` and this plan says ACCEPT.
6. Baseline fingerprint with one fixed cutoff `C` = a time at least 10 minutes before Step 1 starts (so every dispatch before it has resolved): `node --env-file=$REPO/.env $REPO/scripts/rollout/decisions-digest.mjs HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg 2 C > $RUN/epoch2-before.json` (from `packages/db`). Every later check uses the same `C`; rows after `C` may legitimately be new. The digest hashes whole decision rows, which include the notification time that recovery can set for up to 24 hours, so a changed digest is a reason to look, not to roll back: re-run it, list the changed rows, and treat the release as failed only if a score, credit, model, prompt or output field of a row at or before `C` differs.
7. `node --env-file=$REPO/.env scripts/rollout/telegram.mjs -1003934645546 784434992` PASS.

### Step 1. Image (E1)

```
git -C $REPO worktree add --detach $WT 328fb45
cd $WT && git rev-parse HEAD && pnpm install --frozen-lockfile
fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --app hyphae-api --build-only --push --image-label haiku55-328fb45 --depot=false
bash $REPO/scripts/rollout/registry-digest.sh haiku55-328fb45      # 200 sha256:<NEW>
```

A transient `h2c` upgrade error from the remote builder happened once before; retry the build once.

### Step 2. API machine (E2)

```
fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api:haiku55-328fb45 --yes
```

Checks: API on `<NEW>`; `/health` 200; community 200; `/epochs/2` 200 with `config.prompt_version` `reward-eval/1` and the one amendment (`reward-eval/2`, T = 2026-10-07T18:00Z); `telegram.mjs` PASS; log `api listening`, no stack trace. Any failure: roll back the API.

### Step 3. Worker (E3)

```
fly machine update 817400c9901de8 --app hyphae-api --image registry.fly.io/hyphae-api:haiku55-328fb45 --yes
```

Checks: worker on `<NEW>` and `started`; `reward-recovery` completes at least twice, all counters 0, no `prompt_unavailable`, no stack trace; `decisions-digest.mjs ... 2 C` (the same `C`) equals the Step 0 baseline, or any difference is shown to be a notification time only (see Step 0.6). Any failure: roll back the worker first.

### Step 4. Live acceptance

- The next scored epoch 2 contribution shows a revision whose `model.model` is `anthropic:claude-haiku-5-5` and `prompt_version` `reward-eval/2` (`GET /v1/contributions/<id>`), a positive `cost`, and no `refused` error in the worker log.
- If Haiku 5.5 refuses or errors on a real contribution, the existing reconciliation path keeps it unresolved (no score is invented). Report it and decide between rollback and wait.
- Record the first contribution scored by Haiku 5.5 and its score in the record below.

## Public record (Cisco publishes; the agent never posts)

CHANGELOG entry (to be filled with the exact UTC time at deploy):

> **Scorer model: Claude Haiku 5.5 from {T} UTC (not a rubric or prompt change).** Contributions scored from {T} (including any admitted earlier that were still waiting to be scored) are scored by `claude-haiku-5-5` with the same prompt, `reward-eval/2`, rubric MYCEL 1.2.0 and credit rules. Decisions already made keep the model they ran on; each decision records its model. Evidence: 28 fixed replies x 3 runs, Haiku 5.5 missed 3 of 78 judged calls (one case, the founder's own pitch quote), Sonnet 5 0 of 78, at 1/15 of the cost.

Short post for Cisco:

> Scoring update: from {T} UTC, replies are scored by Claude Haiku 5.5 instead of Sonnet 5. Same rubric, same prompt, same rules; scores already given stay as they are. Each score still shows which model produced it. About 15x cheaper per score, which is what lets this scale. Jev (typesafe) is next.

## Needs Cisco

- The exact sentence above for the release, before 2026-10-08T12:00Z.
- Publishing the post and merging `328fb45` into `main` (or telling the raid session to) after the deploy, so the next image keeps Haiku 5.5.

## Record

- Authorization: Cisco's exact sentence "yes, run the Haiku 5.5 scorer release", 2026-10-07.
- Step 0 stopped once: the raid session had shipped `buttons-ed32b4f` (`sha256:fa0b2c95…`) at 19:52Z, so the source moved from `777a5b8` to `ed32b4f` (commit `328fb45` is the same five-file change rebased), the plan was re-pointed and Codex re-checked it: ACCEPT. Gate on `328fb45`: `pnpm test`, `pnpm typecheck`, `pnpm lint` all exit 0.
- Baseline fingerprint, cutoff C = 2026-10-07T19:42:00Z: intakes 5 `abb8e77f…`, decisions 5 `6ed1a09e…`, dispatches 5 `aafe8160…`. Taken again at 20:11Z after both machines changed: identical.
- E1: image `haiku55-328fb45` = `sha256:4218b2a901b93db1bf1cad550c4fd219a817552e92e45fc70c669c6f9e097d12` (tag read `404` first; built in detached worktree at `328fb45`).
- E2: API `6839d31b317318` updated 20:00:12Z; `/health` 200, community 200, `/epochs/2` 200 (base config `reward-eval/1`, one amendment to `reward-eval/2` at 18:00Z), `telegram.mjs` PASS, `api listening`, no stack trace.
- E3: worker `817400c9901de8` updated 20:00:58Z; `reward-recovery` completed at 20:05:18Z and 20:10:02Z with all counters 0, no `prompt_unavailable`, no stack trace. Both machines on `haiku55-328fb45`.
- Public: CHANGELOG entry "Scorer model: Claude Haiku 5.5 from 2026-10-07 20:01 UTC" (docs, on the release branch until merged).
- **Still open (Step 4):** the next scored epoch 2 contribution must show `model.model` `anthropic:claude-haiku-5-5` and `prompt_version` `reward-eval/2`. Rollback target if needed before 2026-10-08T12:00Z: `buttons-ed32b4f`.
