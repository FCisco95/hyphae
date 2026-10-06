---
date: 2026-10-06
summary: API-only release of the redesigned wallet-link page and the Telegram "Wallet linked" notice (runtime source 121906f). No migration, worker untouched, one machine updated. Reuses the build, update, acceptance and rollback steps of the 2026-10-05 setup release plan. Approved by Cisco in the session prompt (conditions below).
---

# Link release plan: redesigned wallet page and link confirmation on the live Hyphae API

**Status: EXECUTED 2026-10-06T13:32Z to 13:5xZ (see [Execution record](#execution-record-2026-10-06)).** Written 2026-10-06 by Claude Sonnet 5.5 (`claude-sonnet-5-5`, effort high) on the Windows PC from `main`. Nothing in this document changed Fly, the database, Telegram, secrets or Vercel settings. The only effect of pushing it is the existing Vercel web build.

**Why:** the first real tester linked his wallet but believed it failed, because only the wallet page said "Linked" and Telegram said nothing; he also found the unstyled page confusing. This release adds (a) one private Telegram notice to the member after a verified signature, (b) a branded, mobile-first wallet page that shows the signing address and the exact message before the wallet is asked, with separate "wallet did not connect" and "not signed" messages, (c) a hardening so an unreadable server answer ends in a retry instead of a stuck page.

**What it does not change:** reward, epoch, payout and rubric rules. The link token handling, the request/verify calls, the exact-bytes signing check and the CSP string are unchanged. No migration. The worker stays frozen. Wallet support is unchanged: Phantom and Solflare are the tested wallets; Trust Wallet is unverified.

## Approval (recorded from the session prompt, 2026-10-06)

Cisco approved running this plan once, for the API machine only, **if and only if all hold**: (1) the Codex verdict on `be5ef12` is ACCEPT, or every finding is fixed test-first and the gate is green; (2) the pushed `main` matches the commit built; (3) the date is before 2026-10-08T12:00Z. Rollback on any failed acceptance check. It covers only the API image build/push and the one machine update. It does **not** cover any migration, secret, Fly config, worker change, Telegram message, link, signature, raid, payout or invitation.

| Condition | Evidence |
|---|---|
| Codex `gpt-6-astra` xhigh read-only on `be5ef12` | **ACCEPT**, no blocker or should-fix; one advisory (a JSON `null` from `/link/request` left the page busy). Fixed test-first in `121906f` (`answerOf`, 6 new tests red then green). Full review: [2026-10-06 link page](../reviews/2026-10-06-link-page.md) |
| Gate on `121906f` (native Windows) | `pnpm test` 0 (API 809 passed / 3 skipped), `pnpm typecheck` 0, `pnpm lint` 0 |
| Pushed `main` = commit built | Step 0 checks `git rev-parse origin/main` against the source commit and that no runtime file differs |
| Date | Step 0 checks `date -u` is before 2026-10-08T12:00Z |

## Exact live effects (everything the yes allows)

| # | Effect | Exact target and bound |
|---|---|---|
| E1 | Build and push one image | Source: commit `SRC` = `121906f166ee0151b6a5c631c037b795a72a6b91` (the last commit that touches `apps/` or `packages/`; later docs commits do not change the runtime tree, and `.dockerignore` excludes `docs`). Detached clean worktree, existing `apps/api/Dockerfile`, `--frozen-lockfile`, Fly remote builder, registry `registry.fly.io/hyphae-api`. New unique tag `link-121906f` (must read `404` first). Its digest `$NEW` is read from the registry right after the build. |
| E2 | Update the API machine | **Only machine `6839d31b317318`** (process `api`, app `hyphae-api`, region `cdg`) moves to the new image. It restarts; the gap was about 11 s last time and Telegram retries webhook updates. |
| E3 | Nothing else | No migration (`git diff 774b97e..HEAD -- packages/db` is empty). Worker `817400c9901de8` is not touched. No secret, env var, Fly config, Vercel setting, webhook, message, subscription, raid, wallet signature or payout. The new notice only fires after a real member signs, which Cisco's phone test does later and which is Cisco's action. |

**Frozen, unchanged:** worker `817400c9901de8` on `sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2`, last updated `2026-10-02T09:19:01Z`. API machine today: `sha256:d9955c7665c31e3ebdc4953e3902275ccf7191f53accc2a98428f9c8443fef6f` (tag `setup-5808972`, updated `2026-10-05T21:21:27Z`) = the rollback target. Older rollback: tag `member-journey-774b97e` = `sha256:798e1888…`. Held refs untouched: `158452fe`, `707d7daf`, `2fd2470a`, tag `c58aa27`.

## Timing guard

- Estimate 15 to 25 minutes: build 2 to 5 min, update about 1 min, checks, 10-minute worker proof.
- **No deploy and no push to `main` from 2026-10-08T22:00:00Z until 2026-10-10T00:00:00Z.** If this has not run by 2026-10-08T12:00Z, defer it past Oct 10 00:00Z and say so.
- Epoch 2 is open and closes 2026-10-09T00:00Z. Do not pause intake for this.

## Execution order and exact commands

Variables: `APP=hyphae-api`, `API=6839d31b317318`, `WORKER=817400c9901de8`, `SRC=121906f166ee0151b6a5c631c037b795a72a6b91`, `FROZEN=sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2`, `PREV=sha256:d9955c7665c31e3ebdc4953e3902275ccf7191f53accc2a98428f9c8443fef6f`, `TAG=link-121906f`, `REPO=/c/Users/joao_/Desktop/DEVELOPMENTS/hyphae`, `WT=/c/Users/joao_/Desktop/DEVELOPMENTS/hyphae-link-121906f`. `NEW` is set in Step 2.

### Step 0. Guards (read-only)

1. `git -C $REPO status -sb` is clean and not ahead of `origin/main`; no `.git/*.lock`. `git fetch origin`; `git merge-base --is-ancestor $SRC origin/main` is true.
2. `git -C $REPO diff --stat $SRC origin/main -- apps packages pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json .dockerignore` is empty.
3. `bash $REPO/scripts/rollout/registry-digest.sh $TAG` prints `404`. `registry-digest.sh $PREV` and `registry-digest.sh $FROZEN` both print `200`.
4. `fly machine list --app hyphae-api` and `fly image show --app hyphae-api`: API `started` on `$PREV`, worker `started` on `$FROZEN`.
5. `date -u` is before Oct 8 12:00Z.
6. `node --env-file=$REPO/.env $REPO/scripts/rollout/telegram.mjs <chat id> <admin id>` PASS (chat id and admin id come from the db.mjs precheck `communities` row, not from memory notes: the group was upgraded to a supergroup and its old id now errors; the precheck's own FAIL verdict is expected after the migrations were applied and is ignored, only its read-only `communities` row is used). Record `pending_update_count`.

### Step 1. Exact-source worktree (local only)

```
git -C $REPO worktree add --detach $WT $SRC
cd $WT && git rev-parse HEAD            # must equal $SRC
pnpm install --frozen-lockfile
```

### Step 2. Build and push the image only (no machine change)

```
cd $WT
fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --app hyphae-api --build-only --push --image-label link-121906f --depot=false
bash $REPO/scripts/rollout/registry-digest.sh link-121906f     # 200 sha256:<NEW>
NEW=sha256:<the printed digest>
bash $REPO/scripts/rollout/registry-digest.sh $NEW             # 200 $NEW again
```

`$NEW` must differ from `$PREV` and `$FROZEN`. Machines are still unchanged. Never run this without `--build-only` (a plain deploy would roll the worker).

### Step 3. Update the API machine only

flyctl 0.4.104 rejects the digest form (`config.image: invalid image identifier`), so use the guarded tag form:

```
bash $REPO/scripts/rollout/registry-digest.sh link-121906f      # still 200 $NEW, same minute
fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api:link-121906f --yes
fly machine list --app hyphae-api
fly image show --app hyphae-api
```

### Step 4. Acceptance checks (any failure goes to Rollback)

- `fly image show`: API digest equals `$NEW` and `started`; worker `$FROZEN`, `started`, last updated `2026-10-02T09:19:01Z`.
- `GET https://hyphae-api.fly.dev/health` is 200 `{"ok":true}`; `/v1/communities/<mint>` and `/v1/communities/<mint>/epochs/2` 200 with epoch 2 open and intake open; `/docs` 200; `hyphae-delta.vercel.app` 200.
- **Link page (new check).** `/link`, `/link/style.css` and `/link/app.js` each return 200 with the exact header
  `content-security-policy: default-src 'none'; script-src 'self'; connect-src 'self'; img-src data:; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  plus `cache-control: no-store` and `referrer-policy: no-referrer`; `content-type` is `text/html`, `text/css`, `text/javascript`. `/link/style.css` is non-empty and contains `.wallet`. `/link/app.js` is the new build (it contains the text `Check your wallet and sign`). One read-only command does all of it:
  ```
  for p in link link/style.css link/app.js; do curl -sI https://hyphae-api.fly.dev/$p | grep -i -E '^(HTTP|content-type|content-security-policy|cache-control|referrer-policy)'; done
  ```
- **Page loads (new check).** Open `https://hyphae-api.fly.dev/link` in a browser with no token. Expected: the styled Hyphae page loads, its status says "This link expired or was already used…" (a tokenless visit is a defined state, `data-state="ended"`), the retry button is hidden, and the browser console has no CSP violation and no error. This sends no request to `/link/request` or `/link/verify` and creates no session.
- `telegram.mjs` again: PASS, `pending_update_count` back to its recorded level or 0.
- `fly logs --app hyphae-api --machine 6839d31b317318` (read-only): `api listening on :8080`, no stack trace.
- Worker proof: `reward-recovery` completes at about 5-minute spacing at least twice after the update, 0 failed jobs (`fly logs --app hyphae-api --machine 817400c9901de8`).

### Rollback (API only; no database or Git rollback)

```
bash $REPO/scripts/rollout/registry-digest.sh setup-5808972      # must print 200 $PREV
fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api:setup-5808972 --yes
fly image show --app hyphae-api
```

`fly image show` must print `$PREV` for the API machine again, `/health` 200, worker unchanged. The old page and old link message are then back; nothing stored changes shape. If the rollback itself fails, stop live work and keep the exact state for read-only diagnosis.

## What this plan does not do

It sends no Telegram message, links no wallet, signs nothing, creates no raid and invites no one. The attended phone test is Cisco's: open the link page from a real `/setup` on the phone, inside Phantom or Solflare's browser, and say what is on screen. Open decisions that are not in this release: a Hyphae-owned domain for the page (the signed message is bound to the page origin; needs a domain purchase, a Fly certificate, DNS and a `LINK_ORIGIN` secret change) and "Open in Phantom/Solflare" deep links (threat model first, because the token would pass through a wallet vendor). Both wait for Cisco's decisions and not inside the Oct 8 22:00Z to Oct 10 00:00Z window.

## Execution record (2026-10-06)

By Claude Sonnet 5.5 on the Windows PC. The push of `main` (`d98a1dc`, includes this plan) was run by Cisco with `!` after the classifier denied the agent's push; the release then ran under the approval above.

| Step | Time (UTC) | Result |
|---|---|---|
| Preconditions | 13:32 | Codex ACCEPT on `be5ef12`, advisory fixed (`121906f`), gate green; `origin/main` = `d98a1dc`, `121906f` its ancestor, runtime-tree diff to `origin/main` empty, `packages/db` diff since `774b97e` empty; before Oct 8 12:00Z. GitHub CI on `d98a1dc` **success** (run 37471523516); Vercel deployment for `d98a1dc` **success**, `hyphae-delta.vercel.app` 200 |
| 0 Guards | 13:32 | Tag `link-121906f` was `404`; `$PREV` and `$FROZEN` both `200`; API `started` on `$PREV`, worker `started` on `$FROZEN`; `telegram.mjs` PASS (bot administrator, creator admin, webhook matches, 0 pending, no last error) |
| 1 Worktree | 13:33 | Detached at exactly `121906f166ee0151b6a5c631c037b795a72a6b91`, `pnpm install --frozen-lockfile` 14.3 s |
| 2 Build | 13:34 | `fly deploy --build-only --push --image-label link-121906f --depot=false`, 350 MB. **`NEW=sha256:b1e7091a2bd06448beb76e228ddeee5dd3b77e3c3e776ed25268e3c6c1757129`**; registry read by tag and by digest both `200 $NEW`; machines unchanged |
| 3 Update (guarded tag form) | 13:35:12 | Tag re-read `200 $NEW` right before. `fly machine update 6839d31b317318 --image registry.fly.io/hyphae-api:link-121906f --yes`: updated successfully, machine `started` 13:35:28Z, digest **`$NEW`**. Worker `817400c9901de8` untouched: `$FROZEN`, last updated `2026-10-02T09:19:01Z` |
| 4 HTTP | 13:36 | `/health` 200 `{"ok":true}`; `/v1/communities/<mint>` 200 (intake open, epoch 2 open, closes `2026-10-09T00:00Z`); `/v1/communities/<mint>/epochs/2` 200; `/docs` 200; `hyphae-delta.vercel.app` 200 |
| 4 Link page | 13:36 | `/link` (`text/html`), `/link/style.css` (`text/css`), `/link/app.js` (`text/javascript`) all **200**, each with the **exact** CSP string compared character for character, `cache-control: no-store`, `referrer-policy: no-referrer`. `style.css` has `.wallet` (5 hits), `app.js` has `Check your wallet and sign`, the page has `signing-origin` |
| 4 Page loads | 13:36 | Browser (Playwright) on `https://hyphae-api.fly.dev/link`, no token: title "Link your wallet · Hyphae", `data-state="ended"`, status "This link expired or was already used…", retry hidden, signing origin `https://hyphae-api.fly.dev`, stylesheet applied, **0 console errors**, no request beyond the page, stylesheet and script; no session created |
| 4 Telegram | 13:36 | `telegram.mjs` PASS: webhook matches, 0 pending, no last error |
| 4 Logs | 13:35:32 | API: `api listening on :8080`, only pg's known `sslmode` alias warning |
| 4 Worker proof | see below | WORKERPROOF |

Rollback was not needed. Not done by this plan: no migration, secret, env, Fly config, Vercel setting, webhook, Telegram message, link, signature, raid, payout or worker change. The attended phone test is Cisco's.
