---
date: 2026-10-06
summary: Release of the looser scorer (prompt reward-eval/2) for epoch 3. Updates the API machine and the worker (the worker runs the scoring) to one new image, then proposes one reward configuration that pins the new prompt from epoch 3. No migration, epoch 2 untouched. Prepared, needs Cisco's exact yes.
---

# Scoring release plan: reward-eval/2 from epoch 3

**Status: PREPARED, not run. Needs Cisco's exact yes (wording at the end).** Written 2026-10-06 by Claude Sonnet 5.5 (`claude-sonnet-5-5`, effort high) on the Windows PC from `main`. Nothing in this document changed Fly, the database, Telegram, secrets or Vercel settings.

**Why:** Cisco's instruction on 2026-10-06: the AI scoring is too hard, "loosen up a lot", members mention the project and that is reach, not spam. Evidence: epoch 2's real reply to the post's own question scored raw 58 (credited 0) as "a general crypto take", and a founder quote that describes the project was zeroed as `off_topic`, although rubric 1.2.0 says a genuine take on the theme earns most of `context_fit`. The scorer was stricter than the published rubric. Evidence and numbers: [calibration report](../rubrics/eval/reward-eval-2-calibration.md); independent review: [Codex review](../reviews/2026-10-06-reward-eval-2.md) (core clean; two script findings fixed).

**What it does.** Prompt `reward-eval/2` tells the scorer how to apply the unchanged rubric: an own-words reaction that relates to the post or the project (opinion, joke, question, banter) earns at least 62, and 72 to 90 with a concrete detail, an angle or a comparison; describing or promoting the project the raid is about is on-topic; `off_topic` and `spam` are for unrelated plugs and verbatim copies. On the fixed case set, Cisco's three real contributions go from 3 of 9 credited runs to 8 of 9, and every gm, lfg, generic hype, AI slop, buy/10x, price shill, other-coin and other-project case still earns 0.

**What it does not change.** The rubric (1.2.0 stays pinned, so the rules test still applies and nobody retakes it), the guidelines, the flags, the hard zeros, the AI caps (79 and 40), the 60 floor, timing, effort, points, payout math, the program. **Epoch 2 is NOT changed:** it is pinned to `reward-eval/1` by hash and keeps that, so its one counted member and Oct 8 payout stay exactly as scored. The earliest any new rule can apply is epoch 3, which opens 2026-10-09T00:00Z; the cooldown (`max(accepted epoch + 1, last activation + 2)`) allows nothing earlier, and hand-editing the pinned config would void every score already made.

## Why the worker is in this release

Scoring runs in the **worker** (`apps/api/src/worker.ts` handles `reward-evaluation`), not in the API. The worker is frozen on `sha256:1c2d6dd5…` (source `b3c82c7`), which only knows `reward-eval/1`. If epoch 3 pins `reward-eval/2` and the worker is not updated, every epoch 3 contribution stays `prompt_unavailable` and unscored. Since `b3c82c7` nothing the worker runs has changed except this prompt (`git diff b3c82c7..HEAD -- apps/api/src/worker.ts apps/api/src/jobs apps/api/src/rewards apps/api/src/payout apps/api/src/scoring packages/core` is only `reward-eval.ts`, a one-line `read-api.ts` import-style change, and the new eval helper that the worker never imports) plus the additive schema from migrations 0013 and 0014, which are already applied. So the worker update is small in code but it is a worker restart (about 10 to 15 s with jobs resuming) a day or two before the sitting, and every earlier plan kept the worker frozen. That is the one decision beyond "loosen the scoring" and is why this plan needs its own yes.

## Exact live effects (everything the yes allows)

| # | Effect | Exact target and bound |
|---|---|---|
| E1 | Build and push one image | Source `SRC` = `6b2a4e34e1bc45822e951cb026e1812b8e1eaf1f` (the last commit that touches `apps/` or `packages/`; docs commits after it do not change the runtime tree). Detached clean worktree, existing `apps/api/Dockerfile`, `--frozen-lockfile`, Fly remote builder, registry `registry.fly.io/hyphae-api`, new unique tag `scoring-6b2a4e3` (must read `404` first). Digest `$NEW` read from the registry after the build. |
| E2 | Update the API machine | Only `6839d31b317318` moves to the new image (restart about 11 s; Telegram retries webhook updates). |
| E3 | Update the worker | Only `817400c9901de8` moves to the same image, **after** E2 passes. It restarts; pg-boss jobs resume. |
| E4 | Record one proposal | `set-rubric` (the same script that bootstrapped epoch 1) writes one `reward_configs` row and one pending `reward_config_proposals` row (earliest activation epoch 3) and re-saves the community's staging rubric 1.2.0 unchanged. Dry-run: the new payload differs from epoch 2's pinned payload only in `scoring.promptVersion` (`reward-eval/1` to `reward-eval/2`) and `scoring.promptTemplateHash`; digest `1c822678…` to `9f4bfac8…`. It runs **only after** the worker is verified on the new image. |
| E5 | Nothing else | No migration, no secret, no env, no Fly config, no Vercel setting, no Telegram message, no link, signature, raid, payout or invitation. |

**Frozen and unchanged:** the program, the rubric file, epoch 2's config and every score in it, held refs `158452fe`, `707d7daf`, `2fd2470a`, tag `c58aa27`. **Rollback targets:** API `link-121906f` = `sha256:b1e7091a2bd06448beb76e228ddeee5dd3b77e3c3e776ed25268e3c6c1757129`; worker tag `deployment-01M3XYDW5XW7AEAY68CKVPKC2X` = `sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2`.

## Timing guard

- Run once, in one attended sitting, **before 2026-10-08T12:00Z**. Estimate 30 to 40 minutes: build 2 to 5 min, two machine updates, checks, two 10-minute worker proofs.
- **No deploy and no push to `main` from 2026-10-08T22:00Z until 2026-10-10T00:00Z.** The proposal must be accepted before epoch 2 closes (2026-10-09T00:00Z), or the new prompt waits for epoch 4. If the sitting has not happened by Oct 8 12:00Z, say so and decide; do not squeeze it into the hold.
- Preferred: today or tomorrow, so a worker problem shows before the Oct 8 sitting.

## Order of work

### Step 0. Guards (read-only)

1. `main` is pushed and contains `SRC`: `git fetch origin`; `git merge-base --is-ancestor $SRC origin/main`; `git diff --stat $SRC origin/main -- apps packages pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json .dockerignore` is empty; `git status -sb` clean and not ahead. Pushing is Cisco's `!` line (the agent's push to `main` is blocked by the classifier).
2. Gate on `SRC` was run natively: `pnpm test`, `pnpm typecheck`, `pnpm lint` all 0.
3. `registry-digest.sh scoring-6b2a4e3` prints `404`; the two rollback digests print `200`.
4. `fly machine list` and `fly image show`: API `started` on the link digest, worker `started` on `$FROZEN`.
5. `date -u` is before Oct 8 12:00Z.
6. `telegram.mjs -1003934645546 784434992` PASS (the old group id errors: the group was upgraded to a supergroup). Record `pending_update_count`.
7. `node ../../docs/demo/proposal-check.mts` (from `apps/api`, with the `.env`): exactly one proposal (`activated`, bootstrap), no pending, epochs 1 and 2 on `reward-eval/1`, epoch 3 not yet materialized.

### Step 1. Exact-source worktree (local only)

```
git -C $REPO worktree add --detach $WT $SRC
cd $WT && git rev-parse HEAD            # must equal $SRC
pnpm install --frozen-lockfile
```

### Step 2. Build and push the image only

```
cd $WT
fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --app hyphae-api --build-only --push --image-label scoring-6b2a4e3 --depot=false
bash $REPO/scripts/rollout/registry-digest.sh scoring-6b2a4e3     # 200 sha256:<NEW>
bash $REPO/scripts/rollout/registry-digest.sh sha256:<NEW>        # 200 again
```

`$NEW` must differ from both rollback digests. Machines are still unchanged. Never run this without `--build-only`.

### Step 3. Update the API machine (E2), then check

```
bash $REPO/scripts/rollout/registry-digest.sh scoring-6b2a4e3     # still 200 $NEW
fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api:scoring-6b2a4e3 --yes
```

(flyctl 0.4.104 rejects the digest form, so the tag form after a registry check, as on Oct 5 and 6.) Checks: `fly image show` API digest `$NEW`, worker still `$FROZEN`; `/health` 200; `/v1/communities/<mint>` and `/v1/communities/<mint>/epochs/2` 200 with epoch 2 open, intake open, **epoch 2 `config.prompt_version` still `reward-eval/1`**; `/link`, `/link/style.css`, `/link/app.js` 200 with the exact CSP string (as in the link plan); `telegram.mjs` PASS; API logs `api listening on :8080`, no stack trace. Any failure: Rollback.

### Step 4. Update the worker (E3), then check

```
bash $REPO/scripts/rollout/registry-digest.sh scoring-6b2a4e3     # still 200 $NEW
fly machine update 817400c9901de8 --app hyphae-api --image registry.fly.io/hyphae-api:scoring-6b2a4e3 --yes
```

Checks: `fly image show` worker digest `$NEW`, `started`; `fly logs --app hyphae-api --machine 817400c9901de8`: the worker starts, `reward-recovery` completes at about 5-minute spacing **at least twice** after the update with all counters 0, no `prompt_unavailable`, no stack trace; the queue is not stuck. Any failure: roll the worker back first.

### Step 5. Record the proposal (E4), only now

From the exact-source worktree's `apps/api` (this is the only production write of the plan):

```
node --env-file=$REPO/.env --import tsx scripts/set-rubric.ts HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg $REPO/docs/rubrics/mycel-1.2.0.json
```

Expected output: `proposal <id> accepted in E2, earliest activation E3`. Then `node ../../docs/demo/proposal-check.mts`: one new `pending` proposal, `earliest_activation_epoch` 3, prompt `reward-eval/2`, rubric `1.2.0`, digest `9f4bfac8182a`; epoch 2 still `reward-eval/1`. A refusal ("already pinned", "already pending") changes nothing; stop and report.

### Step 6. After the boundary (read-only, not part of the sitting)

Once 2026-10-09T00:00Z has passed and the first epoch 3 request has materialized it: `GET /v1/communities/<mint>/epochs/3` shows `config.prompt_version` `reward-eval/2`, `config.rubric_version` `1.2.0`, and `proposal-check.mts` shows the proposal `activated` at epoch 3. If epoch 3 materializes under `reward-eval/1`, the proposal was missed or cancelled: report, do not hand-edit.

## Rollback

- **Before Step 5:** worker back first, then API (guarded tag form, after `registry-digest.sh` confirms the tag still resolves to the target digest):
  `fly machine update 817400c9901de8 --app hyphae-api --image registry.fly.io/hyphae-api:deployment-01M3XYDW5XW7AEAY68CKVPKC2X --yes`, then
  `fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api:link-121906f --yes`.
- **After Step 5, before epoch 3 opens:** `node --env-file=$REPO/.env --import tsx scripts/set-rubric.ts <mint> --cancel` withdraws the pending proposal (epoch 3 then inherits epoch 2's config), then roll the machines back if needed.
- **After epoch 3 has opened on `reward-eval/2`:** do not roll the worker back (it could not score epoch 3). Fix forward or ask for a ruling.
- If a rollback itself fails, stop live work and keep the exact state for read-only diagnosis.

## Honest limits

- The case set is small and written by the same author as the prompt; Cisco's three real contributions were used to tune the wording. It is a regression guard, not proof of calibration. A holdout labelled by Cisco and a second person comes before any further loosening.
- One real quote in the set (a mostly-pitch quote of the founder's own product) still zeroes in about 1 of 3 runs. One real reply failed once in a separate 4-run pass. The admin correction exists for model noise and it is public.
- The floor (60) is unchanged on purpose: it is a pinned constant, and the loosening comes from how the rubric is applied, not from a lower gate.
- Real members who contribute before 2026-10-09T00:00Z are scored under epoch 2's strict prompt. Invite them to start after the epoch 3 boundary.
- The model still sometimes fails to produce a valid answer (3 of 60 calls under version 1, 1 of 60 under version 2 in the calibration run); such jobs go to the existing reconciliation path.

## Approval wording

Cisco answers one sentence: **"yes, run the 2026-10-06 scoring release plan at 6b2a4e3"**. Anything else, including "ok" without naming the plan, is a no. A yes covers E1 to E5 only, once, before Oct 8 12:00Z. It does not cover any migration, secret, Fly config, Telegram message, link, signature, raid, payout or invitation, and it does not change epoch 2.
