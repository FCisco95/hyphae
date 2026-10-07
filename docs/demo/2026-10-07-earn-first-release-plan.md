---
date: 2026-10-07
summary: Release of earn-first, one-tap Reply/Quote on X and the vault section. Applies migration 0015 to production through the rehearsed db.mjs, then updates the API machine and the worker to one new image built from 94ce60e. No proposal, no rubric or payout change, epoch 2 untouched. Prepared and rehearsed; needs Cisco's exact yes.
---

# Earn-first release plan (source `94ce60e`)

**Status: PREPARED, not authorized, not executed.** Written 2026-10-07 by Claude Opus 5.5 (`claude-opus-5-5`, effort high) on the Windows PC. Nothing in this document changed Fly, the database, Telegram, secrets or Vercel. Cisco chose the timing on 2026-10-07: before the deploy hold. Authorization is his exact sentence: **"yes, run the 2026-10-07 earn-first release plan at 94ce60e"**.

**What goes live:**

| Commit | What |
|---|---|
| `4457da6` | One-tap Reply on X / Quote on X on raid messages and alerts |
| `9b75532` | `vault` section in `GET /v1/communities/:mint` and the web "Fund this community" panel |
| `a25eec3` + `94ce60e` | Earn before linking (Cisco's ruling): a group member can submit and take the rules test before linking a wallet; payment still needs a wallet signed before the close |

Review: [Codex record](../reviews/2026-10-07-earn-first-vault-buttons.md), NEEDS-FIXES, fixed in `94ce60e`, ACCEPT.

**What it does not change:** the rubric, prompts, flags, caps, floor, the payout gate, allocation, publication, the program, epoch 2's config and scores, the pending `reward-eval/2` proposal, and the held refs `158452fe`, `707d7daf`, `2fd2470a`, tag `c58aa27`. Codex probed that a wallet-less member with points changes no payable allocation and adds no leaf.

## Exact live effects (everything the yes allows)

| # | Effect | Exact target and bound |
|---|---|---|
| E0 | Cisco pushes `main` | `! git push origin main`. Vercel redeploys the site. For the minutes until E3, the site's new text ("you can reply before you link") is ahead of the live bot. Run E1 to E4 right after the push. |
| E1 | Build and push one image | Source `SRC` = `94ce60e`, the last commit that touches `apps/` or `packages/`. Detached clean worktree, existing `apps/api/Dockerfile`, `--frozen-lockfile`, Fly remote builder, new tag `earn-94ce60e` (must read `404` first). |
| E2 | Apply migration 0015 | Production Neon only, through `scripts/rollout/db.mjs` (direct host, `lock_timeout` 3 s, read-only pre- and postchecks, liveness proof). SQL SHA-256 `e7c19e651fac58fc6efd319b1773504e37374400eb01acfa98c3a62070d268e4`. Changes: `members.wallet`, `link_method` and `linked_at` drop NOT NULL; one CHECK keeps them set together. No data change. The ADD CONSTRAINT holds an ACCESS EXCLUSIVE lock on `members` (2 rows) for milliseconds. |
| E3 | Update the API machine | Only `6839d31b317318`, after E2 passes. |
| E4 | Update the worker | Only `817400c9901de8`, after E3 passes. |
| E5 | Nothing else | No proposal, secret, env, Fly config, Vercel setting, Telegram message, raid, link, payout or invitation. |

**Why this order:** the old image runs correctly on the migrated schema. In rehearsal, its insert without `linked_at` still worked, and only the new image creates wallet-less rows. The new image needs the migration before its first wallet-less insert.

**Rollback targets:** API and worker tag `scoring-6b2a4e3` = `sha256:def68189a1e16ffbc062c68ca3ad7e923824dc64a122b5a48f47d09fc433142f` (the current image). They are valid **only while `members` has no wallet-less row**: the old `/me` crashes on a null wallet. After the first wallet-less member exists, fix forward. The migration itself is not rolled back: the old image runs fine on it.

## Rehearsal (done 2026-10-07, disposable `postgres:17`, never production)

The rehearsal script lives in the session scratchpad: migrations 0000 to 0014 applied, then a Hyphae Lab shaped seed (community, epoch 1 closed with a snapshot, epoch 2 open until Oct 9, one pasted and one signed member, a `reward-recovery` job). The live API reads come from a fixture file (`ROLLOUT_LIVE_FIXTURE`, honoured only for a loopback target).

| Case | Result |
|---|---|
| `precheck` | PASS: shape untouched (three columns NOT NULL, no check), 0 wallet-less members |
| `migrate` with no newer `reward-recovery` | `NOT MIGRATING (nothing changed)`, exit 1 |
| `migrate` while another session holds a lock on `members` | `55P03 … lock timeout`, `journal and schema unchanged`, exit 2 |
| `migrate` | `APPLIED: journal 15 -> 16 rows, ending 0015_members_earn_before_link`, exit 0 |
| `postcheck` | PASS: three columns nullable, check present, 0 wallet-less |
| `migrate` again | Refused: journal not 0000 to 0014, shape already applied |
| The old image's insert (wallet, method, no `linked_at`) | Works (default fills `linked_at`) |
| A half-linked row (method without wallet) | Refused by `members_wallet_link_together` |
| A wallet-less member present at postcheck | FAIL: "1 member(s) without a wallet before the new image runs" |

The first rehearsal run found a bug in the generalized `db.mjs`: a variable named `applied` hid the shape check, so postcheck crashed. It was fixed and the whole rehearsal re-run from a fresh container. Production precheck (read-only, 2026-10-07): **PASS**. Journal at 0014, shape untouched, 2 members, no long transactions, queue healthy.

## Timing guard

- One attended sitting, **before 2026-10-08T12:00Z**. Estimate 40 to 50 minutes: about 5 minutes waiting for the worker's `reward-recovery` between precheck and migrate, build 2 to 5 minutes, two machine updates and the checks.
- **No deploy and no push to `main` from 2026-10-08T22:00Z until 2026-10-10T00:00Z.** If the sitting has not happened by Oct 8 12:00Z, say so and decide; do not squeeze it into the hold.

## Order of work

### Step 0. Guards (read-only)

1. Cisco's push done (E0). Run `git fetch origin`, then:
   - `git merge-base --is-ancestor 94ce60e origin/main`
   - `git diff --stat 94ce60e origin/main -- apps packages pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json .dockerignore` is empty
   - `git status -sb` is clean and not ahead
2. Gate on `94ce60e`, native: `pnpm test`, `pnpm typecheck`, `pnpm lint` 0; `drizzle-kit check` fine; `test:pg` 71 passed. Done 2026-10-07 and not repeated unless the source changes.
3. `registry-digest.sh earn-94ce60e` prints `404`; `registry-digest.sh scoring-6b2a4e3` prints `200 sha256:def68189…`.
4. `fly image show --app hyphae-api`: both machines `started` on `sha256:def68189…`.
5. `date -u` is before Oct 8 12:00Z.
6. `node --env-file=.env scripts/rollout/telegram.mjs -1003934645546 784434992` PASS.
7. `proposal-check.mts` (from `apps/api`, with `.env`): the bootstrap `activated`, one `pending` on `reward-eval/2` (earliest epoch 3), epochs 1 and 2 on `reward-eval/1`.

### Step 1. Exact-source worktree and image (local, then registry only)

```
git -C $REPO worktree add --detach $WT 94ce60e
cd $WT && git rev-parse HEAD          # 94ce60e…
pnpm install --frozen-lockfile
fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --app hyphae-api --build-only --push --image-label earn-94ce60e --depot=false
bash $REPO/scripts/rollout/registry-digest.sh earn-94ce60e      # 200 sha256:<NEW>, differs from def68189…
```

### Step 2. Migration 0015 (E2)

From `$WT/packages/db`, the exact-source migrations folder, with the production `.env`:

```
node --env-file=$REPO/.env $REPO/scripts/rollout/db.mjs precheck > $RUN/pre.json; echo $?     # 0, PASS
# wait for the next reward-recovery completion (about 5 min)
node --env-file=$REPO/.env $REPO/scripts/rollout/db.mjs migrate $RUN/pre.json; echo $?        # 0, APPLIED 15 -> 16
node --env-file=$REPO/.env $REPO/scripts/rollout/db.mjs postcheck $RUN/pre.json > $RUN/post.json; echo $?   # 0, PASS
```

How to handle each exit code:
- **2 (lock timeout):** nothing was applied. Retry, at most 3 times, then stop and ask.
- **1:** read the message. `NOT MIGRATING` means nothing changed. Any other outcome means stop and ask Cisco; do not retry.

The postcheck must show the three columns nullable, the check present, and 0 wallet-less members.

### Step 3. API machine (E3)

```
bash $REPO/scripts/rollout/registry-digest.sh earn-94ce60e      # still 200 <NEW>
fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api:earn-94ce60e --yes
```

Checks:
- `fly image show`: the API is on `<NEW>`, the worker is still on `def68189…`.
- `/health` returns 200.
- `GET /v1/communities/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg` returns 200 with a `vault` field. It must be `{"status":"unavailable","reason":"community_not_on_chain"}`, because `chain_address` is null until C16 of the payout sitting.
- `/epochs/2` returns 200, still `reward-eval/1`.
- `/link` returns 200.
- `telegram.mjs` PASS.
- API logs show `api listening`, with no stack trace.

Any failure: roll back the API (Rollback below).

### Step 4. Worker (E4)

```
fly machine update 817400c9901de8 --app hyphae-api --image registry.fly.io/hyphae-api:earn-94ce60e --yes
```

Checks:
- The worker is on `<NEW>` and `started`.
- `reward-recovery` completes at least twice after the update, with all counters 0, no `prompt_unavailable` and no stack trace.

Any failure: roll back the worker first.

### Step 5. Live acceptance (Cisco, one action)

In the Hyphae Lab group, from the phone, send `/setup`. Step 2 should read "Link your wallet to be paid … You can reply to raids before this." A raid message opened afterwards shows the "Reply on X" and "Quote on X" buttons. No raid is opened for this check unless Cisco wants one.

## Rollback

- **While `members` has no wallet-less row:** move the worker back, then the API. Use the tag form `scoring-6b2a4e3`, after `registry-digest.sh` confirms it still resolves to `sha256:def68189…`. Leave the migration in place.
- **After a wallet-less member exists:** do not roll back to the old image. Fix forward, or ask for a ruling.

## Execution record

Not executed.
