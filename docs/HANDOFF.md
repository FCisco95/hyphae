---
date: 2026-10-02
summary: C3-C13 and gated integrations complete, pushed, CI green. Public README synced; integrated refs deleted, rules/Jev preserved. Ledger controls mainnet program; temporary keys retired. Next clock gate October 8-9.
---

# Hyphae handoff

## TL;DR

**This authorized arc is complete through C13 and its integrations.** Mainnet program `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`, sole Ledger authority `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`, reviewed hash/229,432-byte size verified; buffer consumed. Returned **0.051537968 SOL**, finalized success/zero, then deleted hot key; both temporary files absent. Costs **1.168463032 SOL**, below 1.2 SOL cap. C13 integration `874fa19` pushed, exact-SHA CI **37003102460 success**, public README `d1a9f34` pushed; fully integrated timing/docs refs deleted, rules/Jev preserved. Fly v11/Neon 0000-0012/API remain live; site C13 copy verified. **Next: bring real contributions into epoch 2; C14-C22 clock gate October 8-9, video/submission October 9-10. No mainnet community/vault or contributor payment yet.**

The attended sitting is complete; future attendance must be confirmed at the next runbook gate. Session pre-approval authorized the named CLI steps/read-backs; Cisco handled wallet transfers and Ledger approvals. Every safety/read-back gate remains binding.

MYCEL announcement and Cisco quote-post drafts are saved in [the communications checkpoint](handoffs/2026-10-02-mainnet-announcement.md). Neither was published by the agent; no image was generated. Publication by Cisco is unverified.

## Metadata

- Project: hyphae; project ID: github.com-fcisco95-hyphae; repo root: .; branch: main.
- Last Updated: 2026-10-02T13:56:02Z.
- Runner: Codex (GPT-6); exact runtime model ID, effort, token/cost usage unavailable. No helpers or paid scoring calls.
- Arc start: `ea15cf1d134256af79e2ea716ea41fd2aebe7231 = origin/main`, CI `36935161826` success.
- Latest integration main: `874fa199f0e689b3243f0a653b7f2660c4cf0371`, pushed, exact-SHA CI `37003102460` success. C11 receipt `bb45993`, C13 receipt `311830f` pushed. Prior C7/proof/registry CI also green.
- Shipping close checkpoint: `68a151ce1a3c5b7f80f967d4ae96659aea227588`, pushed; exact-SHA CI `37004134175` success, independently rechecked in this handoff refresh. A documentation-only communications checkpoint follows; verify current HEAD/CI when resuming.
- C7 used the frozen candidate; main now has authorized post-C7 doc/test/dependency cleanup. Production API/program source still matches the candidate. Git retains only main and detached `../hyphae-wt/c1-gate`. Preserve untracked `wsl`.

## Current Objective

No further runbook action in this arc. C3-C13, gated integrations, approved README sync and integrated-ref cleanup are complete; the shipping close checkpoint passed CI. Preserve the announcement drafts and prepare the next sitting for C14-C22 on October 8-9 without executing those steps now. Never repeat funding/deploy or fund retired addresses.

## Current State

| Component | Verified state |
|---|---|
| Epoch proof | October 2 08:49:30Z: epoch 1 closed, one empty snapshot, epoch 2 open to October 9 00:00Z; reward-close completed, no failed reward jobs; epoch 1 gate blocked solely by `before_first_paid_epoch`. |
| Neon | C4 applied 0010-0012 on attempt 1 via direct endpoint with 3-second lock timeout. C5 matched all 13 journal hashes/timestamps, schema additions, unchanged counts and null new hashes. `first_paid_epoch = 2`. |
| Fly | v11, candidate `b3c82c7`; API `6839d31b317318`, worker `817400c9901de8`; image `deployment-01M3XYDW5XW7AEAY68CKVPKC2X`. Both read secrets Deployed. Worker restarted October 2 09:19:01Z. |
| C7 rollback | Previous image `deployment-01M3P9QRW519BGZY986E1GV539` (`86ff258`); schema remains 0000-0012. |
| Site | https://hyphae-delta.vercel.app; C13 integration `dpl_E7jkDXr6cKZrtAftHAoYz349fANy`, Ready/aliased. Browser 11:50:16Z rendered mainnet/devnet trust and network-specific community funding text; public README links intact. Final docs push may create a later equivalent deployment. |
| API | Health/docs/OpenAPI/community/epoch/wallet-claims reads passed. Epoch 1 settlement unavailable `before_first_paid_epoch`; epoch 2 `no_settlement`. No-leaf wallet returns total_claims 0/empty list; leaf route and site proxy correctly return 404. Rate limits: token 3,000, anonymous 300. |
| Worker | All required queues consumed. Ten-minute DB proof 09:29:18Z: pending/old/failed jobs 0, recovery completed after restart 4, stop-window submissions/unscored 0. |
| Program/C13 | Mainnet finalized: program EAz8WkyU…d6E, ProgramData `CHm2qHs1Mj3FF4pmRdwmtEYBrL2WkupesoayiwxiNp3J`, Ledger authority exact, reviewed executable hash exact, 229,432 bytes. Deploy signature in C13 receipt, one Approved Ledger prompt; buffer AccountNotFound. Sweep returned 0.051537968 SOL to confirmed original wallet, finalized/zero 11:34:18Z; both temporary files absent 11:34:53Z. |
| Uptake | October 2 11:48:42.858Z read-only refresh: epochs 1/2 submissions/intakes 0/0; lifetime submissions 3, outside those windows. Snapshot entries 0 at close proof. Community display name Hyphae Lab; runbook fixed mint unchanged. |

## Branch Disposition

Timing `02ee74e` fully patch-integrated as `9df0f41`/`ca054d9`; docs `ad40b77`/`b95d0ab` as `fa6c35d`/`874fa19`. Identical range-diffs, no conflicts; all pushed and CI green. Only these fully integrated refs were deleted locally/remotely after C13 and CI, using atomic remote SHA leases. Rules `158452fe2b22a1e42e5efd42f3f7e11bfdf59c70` and Jev `707d7daf21e217d9a8a64e58514065f5e3bca45e` remain local/pushed unmerged until epoch 3. Only main and detached c1-gate registered; candidate checkout, leftover folders and untracked `wsl` preserved.

## Recent Changes

- [Epoch proof checkpoint](handoffs/2026-10-02-epoch-proof.md): proof, actual uptake, pushed `72a93a3` and `2cd7c7c`, exact-SHA CI successes.
- [Attended run](handoffs/2026-10-02-attended-run.md): actual C3-C6 commands/timestamps and C7 deployment/read-backs as observed.
- C6 generated a 64-character web token in ignored `.env`; staged Fly read secrets and set matching Vercel Production token. RPC reuses existing Helius hold provider, verified mainnet genesis. Values never printed/committed.
- C7 deployed from c1-gate; temporary ignore file added only the untracked proof-script exclusion, then was removed. Dockerfile/entrypoints/source unchanged.
- Private October 2 plan amendment read in place; vault/Organic/Sentinel unchanged. Public README-only C7 sync `1caeebb`, C13 sync `d1a9f347f3f62731e7ce4d69e222a556d3d7dd95` pushed; owning checkout `../hyphae-program` clean at origin/main. No public source/rubric edits. README status/hash/funding text now matches C13; no conflicting edit found.
- Cisco's Ledger-ready reply cleared C8. C9 hashes refreshed; Cisco's funding amount/recipient ruling cleared C10. [Funding/C11 receipt](handoffs/2026-10-02-mainnet-funding.md) records write/authority signatures, finalized proof and buffer-key deletion. The later 1,000-lamport deposit from a similar-looking address does not change the confirmed original return recipient. Production worker remains healthy/started.
- Cisco requested a durable wallet inventory and reaffirmed continuation after the deployment rent/control explanation. [Wallet registry](WALLETS.md) records both temporary keys, persistent program identity and Ledger authority, exact storage, recovery limits, rent commitment and deletion gates. [Registry checkpoint](handoffs/2026-10-02-wallet-registry.md) records verification. No custody change, copied secret or new wallet.
- [C13 receipt](handoffs/2026-10-02-c13-mainnet-receipt.md): actual Ledger approval, finalized program/hash/authority/ProgramData and consumed buffer, sweep signature/recipient/zero and hot-key deletion. Persistent program identity and Ledger retained. Claims API still 200/zero claims after deploy; no payment claim.

## Known Issues / Watch List

- A failed runbook precondition/read-back parks dependent steps; do not repair an unexpected epoch-proof result. Candidate remains pinned through C7. No custody/program/source change outside the runbook.
- C10 amount departure was explicitly accepted under the 1.2 SOL spending cap; C12 recorded one blind Ledger approval. C13 finalized program/hash/authority/buffer and sweep/zero proofs passed before hot-key deletion. Do not repeat completed steps or fund retired keys.
- Public-program README-only exception: October 1 yes authorizes status/Read API after C7, funding lines after C13, using owning checkout after read-back. Conflicting edits stop that item; no other public-repo edits.
- SDK stays exactly 0.1.0 through October 12. Organic's CPMM fee blocker does not alter this treasury-funded runbook. No new Organic fees or contributor payment claim.
- Known timing flake is fixed on the gated timing branch. Postgres multi-pool hang, Jev calibration/holdout and project-context follow-ups remain parked in the September 30 receipts. No new superiority claim.
- Founder/dashboard items (Pro/alerts confirmation, reviewer access, domain, database cost) remain in the September 30 close. Vercel Pro/alerts already ruled yes.

## Validation

Fresh post-C13 gate: **727 passed, 1 skipped** (106 core, 80 web, 541 API), typecheck/lint exit 0 (266 files), production web build exit 0. Exact-SHA CI **37003102460 success** on `874fa19`, including migration check, Postgres 17 and H-CONTRACT vectors. Retained dependency versions unchanged, SDK 0.1.0 exact. C4/C5 prove live schema; finalized C13 proofs and fresh claims read passed. API/db/program production inputs match frozen candidate; C7/C13 accepted copy/test integrations and dependency cleanup only. No conflict or new sensitive implementation; accepted reviews reused. Initial known timing flake passed unchanged before the accepted deterministic-clock fix.

## Next Actions

1. Cisco brings real MYCEL reply/quote contributions into epoch 2 via the existing bot flow before October 9 00:00 UTC; request prepared in the C13 receipt. Agent sent no community message. Allow scoring time and October 8 author/duplicate audit.
2. Next attended runbook sitting: C14-C18 community/vault preparation on October 8 with fresh preconditions, then C18b audit from **October 8 23:00Z** before close. Any uncorrected duplicate/borrowed work parks publication; no waived gates.
3. C19-C22 after **October 9 00:00Z** epoch-2 close and required hold-check/safety proofs. No unattended proof assumed. Video/submission October 9-10.
4. /organic-sync post-ship: reconcile this receipt read-only against the private plan; vault edits remain outside this arc. SDK stays 0.1.0 through October 12; rules/Jev remain for epoch 3.
5. Shipping arc closed at `68a151c` with exact-SHA CI success. Announcement drafts remain for Cisco to use; no social publication or image generation is authorized by this checkpoint. C14-C22 execution, rules/Jev merge, optional devnet close and leftover-folder deletion remain out of scope.

## Quick Reference

`CLAUDE.md`, `AGENTS.md`, `docs/BUILDLOG.md`; [Runbook C](handoffs/2026-09-28-runbook-c.md); [October 1 pause](handoffs/2026-10-01-evening-pause.md); [completed rehearsal](handoffs/2026-10-01-ledger-devnet-rehearsal.md); [September 30 close](handoffs/2026-09-30-session-close.md); [cleanup receipt](handoffs/2026-10-01-worktree-cleanup.md). Private plan stays in the vault; no copy committed.

Wallet inventory: [docs/WALLETS.md](WALLETS.md). Update actual signatures, balances and key deletion states at C11/C13; the registry is not a secret backup.

## Resume Checklist

Check Git refs/status/frozen candidate and live machine/schema/site state before trusting this checkpoint. Read the actual proof and attended receipts. Use UTC. Preserve all gates and attendance; never repeat a completed money step or assume an unattended proof.

## Suggested skills

`handoff-memory` to resume; `superpowers:verification-before-completion`, `solana-dev` and `vercel:vercel-cli` for the next authorized runbook sitting; `handoff` for closure. For announcement work: `content-repurposer-sms`, `social-media-trends-research`; `imagegen` if an image is requested. No helpers.

## Generated artifacts this session

| What | Canonical home | Notes |
|---|---|---|
| Read token/RPC reference | Ignored `.env`, Fly secrets, Vercel Production token | Secret values omitted; existing mainnet RPC reused |
| Deployed API/worker image | Fly v11 `deployment-01M3XYDW5XW7AEAY68CKVPKC2X` | Frozen candidate; previous image retained for rollback |
| Site rebuild | Vercel `dpl_BoanHo18mXaSpfXk4JetxakgYoa7` | Production token, same site alias |
| Receipts | `docs/HANDOFF.md`, `docs/BUILDLOG.md`, October 2 proof/attended snapshots | Public-safe; no private plan or credential copied |
| Wallet metadata | `docs/WALLETS.md`, October 2 registry snapshot | Public addresses/exact file locations; no secret bytes or backup copy |

Both temporary key files deleted after C11/C13 gates; exact former paths/public addresses/deletion times retained in registry. Do not fund their retired addresses. Persistent program identity and Ledger retained. Mainnet program now deployed; no scheduled job created. Existing proof script remains untracked in c1-gate. Organic/Sentinel unchanged; v1 read API live, no contributor payment yet.

## Resume Prompt

```text
Resume Hyphae after the completed C3-C13 arc. Mainnet program/hash/Ledger authority/ProgramData verified; buffer consumed, unused 0.051537968 SOL returned, sweep finalized/zero and both temporary key files deleted after gates. C13 integration 874fa19 pushed/CI 37003102460 success, shipping close 68a151c pushed/CI 37004134175 success, public README d1a9f34 pushed, fully integrated timing/docs refs deleted; rules/Jev and wsl preserved. A documentation-only announcement checkpoint follows; verify actual HEAD/CI. MYCEL/Cisco drafts and image concept are in docs/handoffs/2026-10-02-mainnet-announcement.md; publication unverified, no image generated. No mainnet community/pot/payment yet. Next runbook clock gate October 8-9; never repeat funding/deploy or fund retired addresses.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/WALLETS.md, docs/handoffs/2026-10-02-c13-mainnet-receipt.md, docs/handoffs/2026-10-02-mainnet-funding.md, docs/handoffs/2026-10-02-wallet-registry.md, docs/handoffs/2026-10-02-epoch-proof.md, docs/handoffs/2026-10-02-attended-run.md, docs/handoffs/2026-10-01-evening-pause.md, docs/handoffs/2026-10-01-ledger-devnet-rehearsal.md, docs/handoffs/2026-09-28-runbook-c.md.
Model: GPT-6.1 Sol (high) — current plan's runbook-execution recommendation.
Skills: handoff-memory, superpowers:verification-before-completion, vercel:vercel-cli, solana-dev, handoff.
Verify current HEAD/CI and ledger receipt, then prepare only the next authorized sitting. Cisco needs real epoch-2 contributions (0 submissions/intakes at 11:48:42Z). C14-C18 October 8, C18b from 23:00Z, C19-C22 after October 9 00:00Z and all safety gates; video/submission October 9-10. Do not execute these later steps without that session's scope. Preserve rules/Jev, candidate checkout and wsl.
```
