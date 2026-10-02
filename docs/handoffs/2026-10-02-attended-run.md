---
date: 2026-10-02
summary: Epoch proof/C3-C9 passed; C7 integrations pushed and CI green. C10 keys generated silently; Cisco funding and sweep recipient pending. No mainnet transaction or deploy yet.
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

Worker consuming line at **09:19:05Z** lists `score`, `reward-evaluation`, `reward-retrieval`, `reward-notify`, `reward-recovery`, `reward-close`, `hold-check`. Recovery logged at 09:19:05Z, 09:19:07Z and 09:20:03Z. The initial route/site read preceded the required ten-minute proof below.

**Final ten-minute proof at 09:29:18.801Z, exit 0, read-only transaction:** pending jobs **0**; old score/reward jobs **0**; failed jobs since C3 **0**; recovery completed after restart **4**, latest 09:25:05.389171Z; submissions during worker-stop window **0**, unscored **0**. Uptake still epochs 1/2 submissions/intakes **0/0**. **Every C7 read-back passed.** C7 integrations and C8-C13 may now proceed under existing approval.

## Post-C7 integration milestone

| Original | Integrated on main | Verification |
|---|---|---|
| `ad40b77` | `fa6c35d` | Detached rebase/fast-forward; range-diff identical, no conflicts |
| `8d9acfc` | `9df0f41` | Same accepted timing-test patch |
| `02ee74e` | `ca054d9` | Same accepted deterministic-clock patch |
| Two dependency cleanups | `37f2f8f` | One commit: remove unused root Anchor; move direct web test-only zod to devDependencies |

Verified root Anchor had no imports; web zod appears only in `lib/api.test.ts`. Offline lockfile update removed the unused graph (47 installed packages); no retained dependency version upgrade. Sentinel remains **exactly 0.1.0**. Full gate: **727 passed, 1 skipped** (106 core, 80 web, 541 API), typecheck/lint exit 0, production web build exit 0. No conflict or sensitive implementation change; unchanged accepted integrations require no new review. Original branch refs remain preserved until their final integration gates.

Public-program owning checkout created at `../hyphae-program`, origin `FCisco95/hyphae-program`. Baseline `9999bfa`, clean, no conflicting README changes. **Only README status and Read API lines** changed; `1caeebb5f30366c7cb9cfa5d9502e76106b69ad4` committed and **pushed**, checkout equals origin/main. Funding/program-status lines remain unchanged for C13. No public program/rubric edits.

Main C7 receipt `49f409e`, C7 docs `fa6c35d`, timing `9df0f41`/`ca054d9`, cleanup `37f2f8f` and integration receipt `4a4165584d4a7d728b3b020e49374dd926c1af25` are **pushed**. Exact-SHA CI **36990943344** completed **successfully** on `4a41655`, including full tests/typecheck/lint, migration check, Postgres and H-CONTRACT vectors. Main equals origin/main with only untracked `wsl`. Auto-deployed site `dpl_91ZFh5fugnnEs247CsShBL5Kbwa5` is Ready; live home read at 09:40:58Z confirms direct API-docs link and absence of the old wallet-route disclaimer.

## C8 — passed after Ledger readiness

Fresh checks after green integration CI:

- Windows archive sha256 `84abbbf25a463a0b53aec04df0ede9cb4f00d6bf2ea1ab6870e7a4306b39c06b`, exact match; CLI `3.1.10 (src:7bc9c805; feat:1620780344, client:Agave)`.
- `solana-keygen pubkey target/deploy/hyphae-keypair.json` returns exact `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`.
- Finalized mainnet account read returns **AccountNotFound**, expected.
- Initial `solana-keygen.exe pubkey usb://ledger?key=2/0` returned **no device found**. After Cisco replied **Ledger ready**, the retry returned exact `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`, exit 0, before 09:52:07Z. **C8 passed**, with no signing.

## C9 passed; C10 funding pending

Rechecked the existing October 1 verifiable build in WSL `~/vb/oct2`: HEAD exactly `b3c82c790e129b1f4a24ada6b34407e5f6d57ec9`, tracked tree clean, executable 229,432 bytes. SHA256 `cb4ffdd8074442310f7953b5233a4c2df4eaf8c3f7627cdf259efb84ebf98d79`; executable hash `7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac`. Both match the approved reuse gate; no rebuild or program change.

C10 silently generated two new keys with restrictive permissions, without overwriting files: `~/hyphae-mainnet/deploy-hot-2026-10-02.json` and `deploy-buffer-2026-10-02.json`. Public deployer `CpBum8ynMAawJSdNCKS9NLZXc6hySE1aDCqna7XhmyNT`; buffer `E8MhkV28a4918ZpqRZHAf6ANqK8GxkroEy82GEFAdBSF`. Secret bytes/recovery phrases were not printed or copied. Cisco's request is pending: send exactly **1.2 SOL on mainnet** to the deployer and name the C13 sweep recipient. Finalized balance **0** at **09:54:10.230Z**. RPC mainnet genesis matched; recommended priority fee **10,000 micro-lamports/CU** at that read. Refresh it before C11. C11-C13 have not run; no funds moved by the agent, no signing or mainnet deploy. No C13 truth integrated or refs deleted.

## Participation request for Cisco

Epoch 2 still has **zero contributions/intakes** at the 09:29Z read. C7 is live now, so ask Cisco to bring real MYCEL reply/quote contributions through the existing bot workflow during epoch 2, which closes October 9 00:00Z. Recommendation: invite them promptly, leaving time for scoring and the October 8 author/duplicate audit. No community post/message was sent. No Organic fee collection or contributor payment is claimed.

## Downstream and next gate

Hyphae's complete public v1 read API is deployed (including claims/docs/OpenAPI), with rate limits and unavailable payment reasons. Organic/Sentinel/vault unchanged; SDK exactly 0.1.0. The public-program README's live API claim now matches that rollout. Program remains devnet-only at fresh mainnet absence read; treasury/pot/custody policy unchanged. After C13, integrate `b95d0ab`, update only authorized README funding/program status and delete fully integrated refs. C14-C22 stay October 8-9, video/submission October 9-10, outside this arc.

## Generated artifacts this session

| What | Where | Notes |
|---|---|---|
| Read RPC reference | Ignored `.env`; staged Fly `READ_RPC_URL` | Existing verified mainnet provider |
| Read web token | Ignored `.env`; staged Fly `READ_API_WEB_TOKEN`; Vercel Production `HYPHAE_API_TOKEN` | Same 64-character secret, values omitted |
| Operational receipts | `docs/HANDOFF.md`, `docs/BUILDLOG.md`, this receipt and proof checkpoint | Public-safe states/counts only |

Two mainnet deployment key files now exist only at their canonical WSL paths above. Funding is pending; no agent transaction, program deployment or scheduled job created yet.

## Checkpoint commits and CI

`72a93a3` (proof milestone) and `2cd7c7c` (its push/CI receipt) are pushed. Exact-SHA CI **36987120342** and **36987497612** both succeeded, including Postgres/migration/H-CONTRACT checks. Main equals origin/main at `2cd7c7c`; runtime/build inputs equal candidate `b3c82c7`, all four unmerged refs preserved, only `wsl` untracked before this receipt.

## Suggested skills

`handoff-memory`, `superpowers:verification-before-completion`, `solana-dev` for C8-C13, `handoff`.
