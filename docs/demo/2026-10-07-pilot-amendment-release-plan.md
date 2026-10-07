---
date: 2026-10-07
summary: Release of the epoch 2 pilot amendment. Applies migration 0016 (one new empty table) through the rehearsed db.mjs, moves the API and the worker to one image built from b265204, then, after Cisco publishes the announcement, records one amendment so epoch 2 contributions admitted from the announced UTC time score with reward-eval/2. Earlier decisions untouched; rubric, floor, hard zeros, AI caps and payout math unchanged. Executed 2026-10-07: image amend-b265204 (sha256:161252f9…), amendment recorded 17:12:35Z, effective 18:00Z.
---

# Epoch 2 pilot amendment release plan (source `b265204`)

**Status: EXECUTED 2026-10-07 (E0 to E6 done, every check PASS; Step 8 acceptance pending a submission after 18:00 UTC). Record at the end.** Written 2026-10-07 by Claude Opus 5.5 (`claude-opus-5-5`, effort xhigh) on the Windows PC; preparing it changed nothing live. Authorization is Cisco's exact sentence: **"yes, run the epoch 2 pilot amendment release"**. Design and rulings: [design](../handoffs/2026-10-07-epoch2-pilot-amendment.md).

**What goes live:**

| Commit | What |
|---|---|
| `365e442` | The amendment record (migration `0016`), admission and re-entry pin the amended config from `effective_at` |
| `e73b824` | Epoch API `amendments`, contribution `amendment`, the web epoch and contribution pages, the audit manifest commits the amendment |
| `e44fe2c` | `apps/api/scripts/amend-epoch.ts` with a rollback `--plan` mode |
| `2828d81`, `b265204` | Codex review fixes: schema test fixtures; whole-minute effective time, exact boundary display, "admitted under" wording |
| `7a0626e` | Security page: the amendment power, "Not used yet" |
| `b944143`, `c1aec51` | `scripts/rollout/decisions-digest.mjs`: read-only fingerprint of epoch 2 intakes, decisions and dispatches (not in the image) |

Review: [Codex record](../reviews/2026-10-07-pilot-amendment.md): NEEDS-FIXES, fixed, fix check NEEDS-FIXES (fingerprint coverage), fixed, **ACCEPT**.

**Recommended T:** 2026-10-07T18:00:00Z (19:00 in Lisbon), if the announcement can go out by 17:40Z; otherwise the next whole hour at least 20 minutes after posting. Full timing credit lasts 6 hours after the raid opens, so a raid opened at 18:00Z gives full credit until 00:00Z; a second raid on Oct 8 would give later testers the same.

**What it does not change:** rubric 1.2.0, flags, hard zeros, AI caps, the 60 floor, timing, effort policy, points, the payout gate, allocation and its caps, publication math, the program, the pending epoch 3 proposal, the held refs `158452fe`, `707d7daf`, `2fd2470a`, tag `c58aa27`. Every epoch 2 intake, dispatch and decision that exists before the effective time stays byte-for-byte (fingerprint below).

## Exact live effects (everything the yes allows)

| # | Effect | Exact target and bound |
|---|---|---|
| E0 | Cisco pushes `main` | `! git push origin main`. Vercel redeploys the site; its security page then states the amendment power with "Not used yet". |
| E1 | Build and push one image | Source `b265204`, detached clean worktree, existing `apps/api/Dockerfile`, `--frozen-lockfile`, Fly remote builder, new tag `amend-b265204` (must read `404` first). |
| E2 | Apply migration 0016 | Production Neon only, through `scripts/rollout/db.mjs` (direct host, `lock_timeout` 3 s, read-only pre- and postchecks, liveness proof). SQL SHA-256 `34a7f77df2a7b9b0ac336f3b6a42375663af5986edaed4a29b0131ac3900424a`. Creates one empty table `reward_config_amendments`; its foreign keys take SHARE ROW EXCLUSIVE on `communities`, `epochs` and `reward_configs` for milliseconds. No data change. |
| E3 | Update the API machine | Only `6839d31b317318`, after E2 passes. |
| E4 | Update the worker | Only `817400c9901de8`, after E3 passes. |
| E5 | Cisco publishes the announcement | On X and in the Hyphae Lab group, with the effective time **T** (a whole minute in UTC, at least 20 minutes after he posts). The agent never posts. |
| E6 | Record one amendment | `amend-epoch.ts` from the exact-source worktree: `--plan` first, then the record, before **T**. Epoch 2, prompt `reward-eval/2`, effective **T**, actor `Cisco (founder)`, the reason below. |
| E7 | Cisco opens the raid | `/raid <announcement post URL>` in the Hyphae Lab group, at or after **T**, so every raid submission is admitted under the amendment. |
| E8 | Nothing else | No proposal, secret, env, Fly config, Vercel setting, agent Telegram message, link, payout or invitation. |

**Why this order:** the old image runs correctly on the new schema (it never reads the new table), and the new image needs the table before its first admission. The amendment is recorded only after both machines run the new image, because the old image ignores amendments.

**Rollback targets:** API and worker tag `earn-94ce60e` = `sha256:2ff89500a8fdde20794df0d363d352696ef36794c45e4a396b2bb53cd58e15f9` (the current image), **only before E6**. After the amendment is recorded, the old image would pin new contributions to `reward-eval/1` against the announcement: fix forward. The migration is never rolled back.

**The reason recorded (Cisco's words):** "We are in the pilot testing phase; I'm making scoring less strict so people get valid scores while they are still learning the algorithm and what is expected."

## Rehearsal (done 2026-10-07, disposable `postgres:17`, never production)

Migrations 0000 to 0015 applied, then a Hyphae Lab shaped seed whose epoch 2 pins the **real public epoch 2 config payload** (`df5be064…`, `reward-eval/1`), with a pasted, a signed and a wallet-less member and a `reward-recovery` job.

| Case | Result |
|---|---|
| `precheck` with a wallet-less member present | PASS: 0015 shape, no amendments table |
| `migrate` with no newer `reward-recovery` | `NOT MIGRATING (nothing changed)`, exit 1 |
| `migrate` while another session holds ROW EXCLUSIVE on `epochs` | `55P03 … lock timeout`, `journal and schema unchanged`, exit 2 |
| `migrate` | `APPLIED: journal 16 -> 17 rows, ending 0016_reward_config_amendments`, exit 0 |
| `postcheck` | PASS: table with its three checks and unique index, 0 rows |
| `migrate` again | Refused: journal not 0000 to 0015, table exists |
| `amend-epoch --plan` (T = now + 1 h) | Printed the record, `reward-eval/1` → `reward-eval/2`, to-config digest `9f4bfac8182a` (the pending epoch 3 proposal's config); 0 rows |
| `amend-epoch` with T in the past | Refused: "effectiveAt must be in the future; amendments are never retroactive"; 0 rows |
| `amend-epoch` | Recorded, 1 row; a second run refused "epoch 2 is already amended" |
| A row whose effective time equals its record time | Refused by `reward_config_amendments_future` |
| `postcheck` after recording | FAIL: "not exactly 0016's empty table" (postcheck belongs before E6) |

## Timing guard

- E0 to E4 in one attended sitting, **before 2026-10-08T12:00Z**. Estimate 40 to 50 minutes.
- E6 before **T**; E7 at or after **T**. Both before the C18b intake pause at 2026-10-08T23:00Z.
- **No deploy and no push to `main` from 2026-10-08T22:00Z until 2026-10-10T00:00Z.**

## Order of work

### Step 0. Guards (read-only)

1. Cisco's push done (E0). `git fetch origin`; `git merge-base --is-ancestor b265204 origin/main`; `git diff --stat b265204 origin/main -- apps packages pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json .dockerignore` is empty; `git status -sb` clean and not ahead. GitHub CI on the pushed head: success.
2. Gate on `b265204`, native, done 2026-10-07: `pnpm test` 0 (core 114, read-client 26, web 123, API 870 passed / 3 skipped), `pnpm typecheck` 0, `pnpm lint` 0; `drizzle-kit check` fine. `test:pg`: 73 of 73 in 4 of 7 full runs. Every failing run failed only the member-journey "private journey" tests (and raid-alert tests that then claim the alert they leave behind); those same tests fail 2 of 3 runs on the live `94ce60e` with no B code, so this is a pre-existing intermittent test, logged as a follow-up. B's own Postgres tests passed in every run. Not repeated unless the source changes.
3. `registry-digest.sh amend-b265204` prints `404`; `registry-digest.sh earn-94ce60e` prints `200 sha256:2ff89500…`.
4. `fly image show --app hyphae-api`: both machines `started` on `sha256:2ff89500…`.
5. `date -u` is before Oct 8 12:00Z.
6. `node --env-file=.env scripts/rollout/telegram.mjs -1003934645546 784434992` PASS.
7. `proposal-check.mts`: the bootstrap `activated`, one `pending` on `reward-eval/2` (earliest epoch 3), epochs 1 and 2 on `reward-eval/1`.
8. Baseline fingerprint, from `packages/db`: `node --env-file=$REPO/.env $REPO/scripts/rollout/decisions-digest.mjs <mint> 2 > $RUN/epoch2-before.json`. Taken 2026-10-07T15:22Z and again at 16:03Z (identical): intakes 3 `79ed17cc…`, decisions 3 `5897c505…`, dispatches 3 `6af848b1…`.

### Step 1. Exact-source worktree and image

```
git -C $REPO worktree add --detach $WT b265204
cd $WT && git rev-parse HEAD && pnpm install --frozen-lockfile
fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --app hyphae-api --build-only --push --image-label amend-b265204 --depot=false
bash $REPO/scripts/rollout/registry-digest.sh amend-b265204      # 200 sha256:<NEW>
```

### Step 2. Migration 0016 (E2)

From `$WT/packages/db`:

```
node --env-file=$REPO/.env $REPO/scripts/rollout/db.mjs precheck > $RUN/pre.json; echo $?     # 0, PASS
# wait for the next reward-recovery completion (about 5 min)
node --env-file=$REPO/.env $REPO/scripts/rollout/db.mjs migrate $RUN/pre.json; echo $?        # 0, APPLIED 16 -> 17
node --env-file=$REPO/.env $REPO/scripts/rollout/db.mjs postcheck $RUN/pre.json > $RUN/post.json; echo $?   # 0, PASS
```

Exit 2 (lock timeout): nothing applied; retry at most 3 times, then stop and ask. Exit 1: `NOT MIGRATING` means nothing changed; any other outcome means stop and ask Cisco.

### Step 3. API machine (E3)

```
bash $REPO/scripts/rollout/registry-digest.sh amend-b265204      # still 200 <NEW>
fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api:amend-b265204 --yes
```

Checks: the API on `<NEW>`, the worker still on `2ff89500…`; `/health` 200; community 200; `/epochs/2` 200 with `config.prompt_version` `reward-eval/1` and `amendments: []`; `/v1/contributions/<an epoch 2 contribution>` 200 with `amendment: null`; `/link` 200; `telegram.mjs` PASS; log `api listening`, no stack trace. Any failure: roll back the API.

### Step 4. Worker (E4)

```
fly machine update 817400c9901de8 --app hyphae-api --image registry.fly.io/hyphae-api:amend-b265204 --yes
```

Checks: the worker on `<NEW>` and `started`; `reward-recovery` completes at least twice after the update, all counters 0, no `prompt_unavailable`, no stack trace. Any failure: roll back the worker first. Then `decisions-digest.mjs` equals the Step 0 baseline.

### Step 5. Announcement (E5, Cisco)

Cisco publishes the X post and the Telegram message below with the chosen **T**, and sends the agent the post URL and **T**.

### Step 6. Record the amendment (E6)

From `$WT/apps/api`, with **T** as `YYYY-MM-DDTHH:MM:00Z`:

```
node --env-file=$REPO/.env --import tsx scripts/amend-epoch.ts <mint> --epoch 2 --prompt reward-eval/2 --effective-at T --actor "Cisco (founder)" --reason "<the reason above>" --plan
node --env-file=$REPO/.env --import tsx scripts/amend-epoch.ts <mint> --epoch 2 --prompt reward-eval/2 --effective-at T --actor "Cisco (founder)" --reason "<the reason above>"
```

Checks: the plan names `reward-eval/1` → `reward-eval/2` and the expected template hashes; the record's `recorded_at` is before **T**; `GET /epochs/2` shows exactly one amendment with **T**, the actor and the reason; `decisions-digest.mjs` still equals the baseline. A refusal changes nothing: read it and stop.

### Step 7. Raid (E7, Cisco)

At or after **T**, Cisco sends `/raid <announcement post URL>` in the Hyphae Lab group.

### Step 8. Live acceptance

- A raid reply submitted after **T** (Cisco's or a tester's): `GET /v1/contributions/<id>` shows `amendment: { effective_at: T, prompt_version: "reward-eval/2" }` and, once scored, a revision whose `model.prompt_version` is `reward-eval/2`.
- `decisions-digest.mjs <mint> 2 T` equals the Step 0 baseline: every epoch 2 intake, decision and dispatch from before **T** is unchanged.
- The epoch page on the site shows the amendment panel.

## Announcement (Cisco publishes; the agent never posts)

**X (under 280 characters with T = 21:00):**

> Hyphae pilot update: from {T} UTC today, new epoch 2 replies get a less strict scorer while you learn the rules. Earlier scores, the rubric, hard zeros, 60 floor and payout rules stay. Epoch 2 pays qualifiers: signed wallet, /rules pass, 100k MYCEL. Reply with your take.

**Telegram (Hyphae Lab):**

> Pilot update for epoch 2
>
> We are in the pilot testing phase. I'm making scoring less strict so people get valid scores while they are still learning the algorithm and what is expected.
>
> What changes: from {T} UTC on {date}, every new reply or quote submitted in epoch 2 is scored with the newer scoring prompt, reward-eval/2. It gives credit to a sincere reaction in your own words that relates to the post or the project.
>
> What does not change: anything submitted before {T} keeps its score. The rubric, the hard zeros (spam, off-topic, rule breaches), the AI-writing caps, the 60-point floor and the payout rules stay the same. The change is recorded publicly on the epoch 2 page.
>
> Epoch 2 pays: if you link a wallet by signing, pass /rules and hold 100,000 MYCEL before 9 October 00:00 UTC, your epoch 2 points can be paid at the close.
>
> How to take part: at {T} I open a raid on my X post about this change. Reply to that post with what you honestly think of the change, then tap Submit on the raid message here and paste your reply link. Replies submitted within 6 hours of the raid opening get full timing credit.

## Execution record (2026-10-07)

By Claude Opus 5.5 (`claude-opus-5-5`, effort xhigh) on the Windows PC, on Cisco's exact yes ("yes, run the epoch 2 pilot amendment release"). Cisco pushed `main` (`30cf429..72f0d3d`) with `!`.

| Step | Time (UTC) | Result |
|---|---|---|
| 0 Guards | 16:36 to 16:40 | `b265204` an ancestor of `origin/main` = `72f0d3d`, runtime-tree diff empty, `main` = `origin/main`; tag `amend-b265204` `404`; `earn-94ce60e` `200 sha256:2ff89500…`; both machines `started` on it; `telegram.mjs` PASS; `proposal-check`: bootstrap `activated`, one `pending` `reward-eval/2` (E3), epochs 1 and 2 on `reward-eval/1`; epoch 2 fingerprint equal to the baseline (intakes 3 `79ed17cc`, decisions 3 `5897c505`, dispatches 3 `6af848b1`); GitHub CI on `72f0d3d` success |
| 1 Worktree and image | 16:37 to 16:40 | Detached at exactly `b265204a323440d560fad8454bda1f34a54977fc`, clean, install 15 s. The first `--build-only` failed at Fly's remote builder (`unable to upgrade to h2c, received 500`), nothing pushed (tag still `404`); the retry pushed. **`NEW=sha256:161252f99dcc4b790e4742f99c9c3f0b4ad43bc6200157d756e33b6e9dfd947a`**, by tag and by digest `200`; machines unchanged |
| 2 Precheck | 16:40:21 | PASS: 0015 shape, no amendments table, journal 16 |
| 2 Migrate | 16:45:26 | After a newer `reward-recovery` (16:45:06Z): `APPLIED: journal 16 -> 17 rows, ending 0016_reward_config_amendments`, exit 0; SQL SHA-256 `34a7f77d…` equals the plan |
| 2 Postcheck | 16:45 | PASS: the table with its three checks and unique index, 0 rows, every counted table delta 0, liveness true |
| 3 API | 16:45:46 | Tag re-read `200 NEW`; API started 16:46:05Z on `NEW`, worker still `2ff89500…`. `/health` 200; community 200; `/epochs/2` open, `reward-eval/1`, `amendments: []`, 3 counted; a contribution read `amendment: null`; `/link`, `/docs` 200; `telegram.mjs` PASS; `api listening on :8080` at 16:46:08Z (the two proxy "refused connection" lines at 16:46:04Z are the restart gap) |
| 4 Worker | 16:46:31 | Worker started 16:46:48Z on `NEW`; `worker: consuming …` 16:46:46Z. **Worker proof PASS:** `reward-recovery` at 16:50:13Z and 16:55:39Z, every counter 0, no failed or retrying jobs, no stack line |
| 6 Plan in production | 16:47, 17:12:22 | `amend-epoch --plan` with T = 18:00Z: `reward-eval/1` → `reward-eval/2`, to-config digest `9f4bfac8182a` (the pending epoch 3 proposal's config); nothing recorded, `amendments: []` |
| 5 Announcement | 17:06:00 | Cisco posted on X ([post](https://x.com/organic_mycel/status/2107880131390013632)): "From 18:00 UTC today, honest epoch 2 replies in your own words can earn valid scores …". He opened the raid on it at 17:07:53Z, before T, and closed the earlier raid `46284eb4…` |
| 6 Record | 17:12:35 | **Amendment `a75dbfeb-1484-46df-aaae-9cd8d43a7827`**: epoch 2, `reward-eval/1` (`7c3b3482…`) → `reward-eval/2` (`aa244562…`), effective **2026-10-07T18:00:00Z**, actor `Cisco (founder)`, the reason above; to-config `d265af98-202c-4425-9d7b-dfdd5d5715fa`. Public read-back of `/epochs/2` shows exactly this amendment with `recorded_at` 17:12:35.849Z |
| Untouched history | 17:29 | `decisions-digest.mjs <mint> 2 2026-10-07T15:22:00Z` equals the baseline exactly (intakes 3 `79ed17cc`, decisions 3 `5897c505`, dispatches 3 `6af848b1`). Without a cutoff: 4/4/4, the fourth row being Cisco's 17:10 reply below |
| Before T | 17:10:10 | Cisco's own raid reply was admitted at 17:10, before T, and judged by `reward-eval/1`: raw 58, credited 0 (`low_effort`). It stays as judged. A side eval of the same text: `reward-eval/1` 58/58/58, `reward-eval/2` 75/66/75 (USD 0.18) |

Not done by this plan: no proposal, secret, env, Fly config, Vercel setting, agent Telegram message, payout or invitation. Rollback to `earn-94ce60e` is no longer allowed: the amendment is recorded, so fix forward. **Still open (Step 8):** a raid reply submitted after 18:00 UTC must show `amendment` on its contribution page and a `reward-eval/2` revision once scored, and `decisions-digest.mjs <mint> 2 2026-10-07T18:00:00Z`, taken after 18:00, must give the same result at every later run (nothing from before T changes). Leftover worktrees `../hyphae-earn-94ce60e` and `../hyphae-amend-b265204` can be removed with `git worktree remove`.
