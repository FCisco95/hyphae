---
date: 2026-10-02
summary: Epoch proof and C3-C7 passed. Neon 0000-0012, Fly v11 on pinned b3c82c7, site/read API and ten-minute worker recovery verified. Gated C7 integrations are next.
---

# October 2 attended Part B receipt

## TL;DR

Epoch proof passed in [the proof checkpoint](2026-10-02-epoch-proof.md). Cisco is present. Under the session prompt's explicit C1-C13 approval, Codex handles the approved CLI commands and read-backs; Cisco handles wallet transfers, Ledger approvals and required dashboard/editor inputs. This session instruction supersedes the older runbook's assignment of every Fly/Neon-write command to Cisco's PowerShell; it does not change custody, funding or safety gates.

## C3 — passed

- Started **2026-10-02T09:06:44.764Z**.
- Fresh list: API `6839d31b317318`, worker `817400c9901de8`, both started on `deployment-01M3P9QRW519BGZY986E1GV539`.
- `fly machine stop 817400c9901de8 --app hyphae-api` exited 0.
- Final list: worker **stopped**, API **started**; worker updated at 09:06:48Z.
- `/health` read at 09:06:48.062Z returned **200**, `{"ok":true}`.
- Rollback if needed: `fly machine start 817400c9901de8 --app hyphae-api`.

## C4 — passed on attempt 1

Read-only precheck **09:09:39.706Z**: direct Neon endpoint, `transaction_read_only=on`, `lock_timeout=3s`, no other transaction older than 5 seconds, exactly 0000-0009 with matching SHA-256 hashes/timestamps, new schema absent. Counts: reward configs 1; decisions/intakes/snapshot entries/leaves 0.

From c1-gate at full pinned SHA, `node node_modules/drizzle-kit/bin.cjs migrate` used the direct URL with `options=-c%20lock_timeout%3D3000`, constructed from ignored `.env`. Attempt 1 began **09:10:05.975Z**, exited **0**, `migrations applied successfully!`. No retries and no intake pause. Applied only 0010-0012 in journal order.

## C5 — passed

Read-only postcheck **09:10:34.185Z**: exactly 0000-0012, all 13 hashes/timestamps match files; four new columns, two publication tables and `leaves_wallet` exist. Counts unchanged (1 config, everything else 0); all four new hash fields have **0 non-null rows**. No long transaction. At **09:10:39.131Z**, health 200, API started, worker stopped. Schema additions are not rolled back.

## C6 — passed

At **09:14:13.849Z**, Fly staged `READ_RPC_URL` and `READ_API_WEB_TOKEN`; fresh secret list shows both **Staged**. Verified Vercel target is `ciscos-projects-c3b3be54/hyphae`, project `prj_zGEwnzy5ATqVXru7apeDkPfrcHSM`, root `apps/web`, domain `hyphae-delta.vercel.app`. Added matching `HYPHAE_API_TOKEN` only to **Production**, stored as a sensitive Secret; name-only read-back confirms it exists.

The read RPC reuses the existing Helius hold-check endpoint after an HTTPS/mainnet genesis check (`5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`, HTTP 200). The token is 32 random bytes encoded as 64 hex characters, generated locally and stored in gitignored `.env`. No values printed or committed. No new paid provider/account selected.

## C7 — passed

Deploy from c1-gate at `b3c82c790e129b1f4a24ada6b34407e5f6d57ec9`; tracked tree clean. The existing untracked epoch-proof script will be excluded using a temporary Docker ignore file that adds only that scratch path to the candidate's existing exclusions. Runtime entrypoints, Dockerfile and tracked inputs are unchanged. Previous image: `deployment-01M3P9QRW519BGZY986E1GV539`.

Deploy began **09:16:41.292Z**, exited **0**. Fly release **v11**, image `deployment-01M3XYDW5XW7AEAY68CKVPKC2X`, registry digest `sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2`. API started at 09:18:28Z; worker remained stopped, so `fly machine start 817400c9901de8 --app hyphae-api` ran at **09:18:59.071Z**, exit 0. Final list: worker **started at 09:19:01Z**, API started, both on the new image. Both read secrets now **Deployed**. Temporary ignore file removed; tracked candidate unchanged.

Vercel production rebuild `dpl_BoanHo18mXaSpfXk4JetxakgYoa7`, URL `hyphae-p69a1zc7l-ciscos-projects-c3b3be54.vercel.app`, **Ready** in 47 seconds, aliased to `hyphae-delta.vercel.app`. Token was supplied from the same local value as Fly. Browser at 09:21Z rendered the runbook mint's current name **Hyphae Lab**, reward intake open, epoch 2 open to October 9 and epoch 1 final. The community's display name was not changed. Home and community HTTP 200. Initial HTML contains a streaming loading shell; the browser confirmed final content.

Route reads: health/docs/OpenAPI/community/epochs 1 and 2/wallet claims **200**. OpenAPI lists both claims routes. Epoch 1 allocation/payment unavailable `before_first_paid_epoch`; epoch 2 unavailable `no_settlement`. Wallet with no leaves: `total_claims=0`, `claims=[]`; the leaf route and site proxy correctly return **404 not_found**. Token-aware rate limit **3,000**, anonymous **300**, all `RateLimit-*` headers present. An exploratory `/communities/:mint/epochs` request returned 404 because that route does not exist; the advertised individual epoch routes passed.

Worker consuming line at **09:19:05Z** lists `score`, `reward-evaluation`, `reward-retrieval`, `reward-notify`, `reward-recovery`, `reward-close`, `hold-check`. Recovery logged at 09:19:05Z, 09:19:07Z and 09:20:03Z. **Ten-minute database drain/recovery proof remains due at or after 09:29:01Z.** C7 is not yet complete; C8 and all gated integrations remain pending.

**Final ten-minute proof at 09:29:18.801Z, exit 0, read-only transaction:** pending jobs **0**; old score/reward jobs **0**; failed jobs since C3 **0**; recovery completed after restart **4**, latest 09:25:05.389171Z; submissions during worker-stop window **0**, unscored **0**. Uptake still epochs 1/2 submissions/intakes **0/0**. **Every C7 read-back passed.** C7 integrations and C8-C13 may now proceed under existing approval.

## Generated artifacts this session

| What | Where | Notes |
|---|---|---|
| Read RPC reference | Ignored `.env`; staged Fly `READ_RPC_URL` | Existing verified mainnet provider |
| Read web token | Ignored `.env`; staged Fly `READ_API_WEB_TOKEN`; Vercel Production `HYPHAE_API_TOKEN` | Same 64-character secret, values omitted |
| Operational receipts | `docs/HANDOFF.md`, `docs/BUILDLOG.md`, this receipt and proof checkpoint | Public-safe states/counts only |

No mainnet keys, transfers, deployments or scheduled jobs created yet.

## Checkpoint commits and CI

`72a93a3` (proof milestone) and `2cd7c7c` (its push/CI receipt) are pushed. Exact-SHA CI **36987120342** and **36987497612** both succeeded, including Postgres/migration/H-CONTRACT checks. Main equals origin/main at `2cd7c7c`; runtime/build inputs equal candidate `b3c82c7`, all four unmerged refs preserved, only `wsl` untracked before this receipt.

## Suggested skills

`handoff-memory`, `superpowers:verification-before-completion`, `solana-dev` for C8-C13, `handoff`.
