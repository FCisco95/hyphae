---
date: 2026-10-02
summary: C3-C13 passed. Mainnet program/hash/Ledger authority verified; 0.051537968 SOL returned, zero balance, both temporary key files deleted after gates. Final integration/README/CI next.
---

# Hyphae handoff

## TL;DR

**C3-C13 passed with Cisco attending.** Mainnet program `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`, sole Ledger authority `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`, reviewed hash and 229,432-byte size verified; buffer consumed. Returned **0.051537968 SOL**, confirmed finalized success/zero, then deleted hot key; both temporary key files absent. Costs **1.168463032 SOL**, below 1.2 SOL cap. Fly v11/Neon 0000-0012/read API remain live. **Next: C13 truth integration, public README-only sync, fully integrated ref cleanup and final gate/CI. No mainnet community/vault or contributor payment yet.**

Cisco is present. Session pre-approval authorizes Codex to run the named CLI steps/read-backs; Cisco handles wallet transfers, Ledger approvals and necessary human inputs. The older runbook's operator assignment caused an initial pause; the session instruction governs execution. No renewed approval is needed. Every safety/read-back gate remains binding.

## Metadata

- Project: hyphae; project ID: github.com-fcisco95-hyphae; repo root: .; branch: main.
- Last Updated: 2026-10-02T12:39:00+01:00.
- Runner: Codex (GPT-6); exact runtime model ID, effort, token/cost usage unavailable. No helpers or paid scoring calls.
- Arc start: `ea15cf1d134256af79e2ea716ea41fd2aebe7231 = origin/main`, CI `36935161826` success.
- Latest integration main: `4a4165584d4a7d728b3b020e49374dd926c1af25`, pushed, exact-SHA CI `36990943344` success. C8-C10 receipt `9a7e6817a93c4fb6b8ec2db55d0bd6b47c8aa1e6` pushed, exact-SHA CI `36992801247` success. This wallet-registry checkpoint follows; earlier proof CI succeeded too.
- C7 used the frozen candidate; main now has authorized post-C7 doc/test/dependency cleanup. Production API/program source still matches the candidate. Git retains only main and detached `../hyphae-wt/c1-gate`. Preserve untracked `wsl`.

## Current Objective

Finish post-C13 truth integration/public README, fully integrated ref cleanup and final local/CI/handoff gates. All attended C3-C13 actions are complete; never repeat funding or deploy. This arc stops before C14-C22.

## Current State

| Component | Verified state |
|---|---|
| Epoch proof | October 2 08:49:30Z: epoch 1 closed, one empty snapshot, epoch 2 open to October 9 00:00Z; reward-close completed, no failed reward jobs; epoch 1 gate blocked solely by `before_first_paid_epoch`. |
| Neon | C4 applied 0010-0012 on attempt 1 via direct endpoint with 3-second lock timeout. C5 matched all 13 journal hashes/timestamps, schema additions, unchanged counts and null new hashes. `first_paid_epoch = 2`. |
| Fly | v11, candidate `b3c82c7`; API `6839d31b317318`, worker `817400c9901de8`; image `deployment-01M3XYDW5XW7AEAY68CKVPKC2X`. Both read secrets Deployed. Worker restarted October 2 09:19:01Z. |
| C7 rollback | Previous image `deployment-01M3P9QRW519BGZY986E1GV539` (`86ff258`); schema remains 0000-0012. |
| Site | https://hyphae-delta.vercel.app; current C7 integration deployment `dpl_91ZFh5fugnnEs247CsShBL5Kbwa5`, Ready and aliased. Same web token as sensitive Production secret. Browser rendered community/open epoch 2/final epoch 1; integrated API-docs link/disclaimer verified live. |
| API | Health/docs/OpenAPI/community/epoch/wallet-claims reads passed. Epoch 1 settlement unavailable `before_first_paid_epoch`; epoch 2 `no_settlement`. No-leaf wallet returns total_claims 0/empty list; leaf route and site proxy correctly return 404. Rate limits: token 3,000, anonymous 300. |
| Worker | All required queues consumed. Ten-minute DB proof 09:29:18Z: pending/old/failed jobs 0, recovery completed after restart 4, stop-window submissions/unscored 0. |
| Program/C13 | Mainnet finalized: program EAz8WkyU…d6E, ProgramData `CHm2qHs1Mj3FF4pmRdwmtEYBrL2WkupesoayiwxiNp3J`, Ledger authority exact, reviewed executable hash exact, 229,432 bytes. Deploy signature in C13 receipt, one Approved Ledger prompt; buffer AccountNotFound. Sweep returned 0.051537968 SOL to confirmed original wallet, finalized/zero 11:34:18Z; both temporary files absent 11:34:53Z. |
| Uptake | October 2 10:02:50Z read-only refresh: epochs 1/2 have 0 submissions and 0 intakes; lifetime community submissions 3, outside those windows. Snapshot entries 0 at close proof. Community display name is Hyphae Lab; mint is the runbook's fixed mint. |

## Branch Disposition

Original refs remain local/pushed: timing `02ee74e` is patch-integrated as `9df0f41`/`ca054d9`; C7 truth `ad40b77` is integrated as `fa6c35d`, while docs branch `b95d0ab` still needs its C13 commit. Rules `158452f` and Jev `707d7da` remain unmerged until epoch 3. Dependency cleanup `37f2f8f`, C7 receipt `49f409e`. All rebases had no conflicts and range-diff was identical. Delete only fully integrated refs after C13; preserve candidate checkout and `wsl`. Leftover-folder deletion is outside this arc.

## Recent Changes

- [Epoch proof checkpoint](handoffs/2026-10-02-epoch-proof.md): proof, actual uptake, pushed `72a93a3` and `2cd7c7c`, exact-SHA CI successes.
- [Attended run](handoffs/2026-10-02-attended-run.md): actual C3-C6 commands/timestamps and C7 deployment/read-backs as observed.
- C6 generated a 64-character web token in ignored `.env`; staged Fly read secrets and set matching Vercel Production token. RPC reuses existing Helius hold provider, verified mainnet genesis. Values never printed/committed.
- C7 deployed from c1-gate; temporary ignore file added only the untracked proof-script exclusion, then was removed. Dockerfile/entrypoints/source unchanged.
- Private October 2 plan amendment read in place; vault, Organic and Sentinel unchanged. Public-program README-only C7 sync committed/pushed as `1caeebb`; funding/program status unchanged until C13. New owning checkout `../hyphae-program` is clean at origin/main.
- Cisco's Ledger-ready reply cleared C8. C9 hashes refreshed; Cisco's funding amount/recipient ruling cleared C10. [Funding/C11 receipt](handoffs/2026-10-02-mainnet-funding.md) records write/authority signatures, finalized proof and buffer-key deletion. The later 1,000-lamport deposit from a similar-looking address does not change the confirmed original return recipient. Production worker remains healthy/started.
- Cisco requested a durable wallet inventory and reaffirmed continuation after the deployment rent/control explanation. [Wallet registry](WALLETS.md) records both temporary keys, persistent program identity and Ledger authority, exact storage, recovery limits, rent commitment and deletion gates. [Registry checkpoint](handoffs/2026-10-02-wallet-registry.md) records verification. No custody change, copied secret or new wallet.
- [C13 receipt](handoffs/2026-10-02-c13-mainnet-receipt.md): actual Ledger approval, finalized program/hash/authority/ProgramData and consumed buffer, sweep signature/recipient/zero and hot-key deletion. Persistent program identity and Ledger retained. Claims API still 200/zero claims after deploy; no payment claim.

## Known Issues / Watch List

- A failed runbook precondition/read-back parks dependent steps; do not repair an unexpected epoch-proof result. Candidate remains pinned through C7. No custody/program/source change outside the runbook.
- C10 sends 1.2 SOL; C12 requires one blind Ledger approval. Use a clear-headed sitting. C13 verifies program/hash/authority/buffer, then sweep/confirm/zero balance before deleting the hot key.
- Public-program README-only exception: October 1 yes authorizes status/Read API after C7, funding lines after C13, using owning checkout after read-back. Conflicting edits stop that item; no other public-repo edits.
- SDK stays exactly 0.1.0 through October 12. Organic's CPMM fee blocker does not alter this treasury-funded runbook. No new Organic fees or contributor payment claim.
- Known timing flake is fixed on the gated timing branch. Postgres multi-pool hang, Jev calibration/holdout and project-context follow-ups remain parked in the September 30 receipts. No new superiority claim.
- Founder/dashboard items (Pro/alerts confirmation, reviewer access, domain, database cost) remain in the September 30 close. Vercel Pro/alerts already ruled yes.

## Validation

Post-C7 full gate: **727 passed, 1 skipped** (106 core, 80 web, 541 API), typecheck/lint exit 0, production web build exit 0. Retained dependency versions unchanged and SDK 0.1.0 exact. Before timing integration, initial proof gate hit the known deadline flake, unchanged rerun passed (726/1). Integration exact-SHA CI **36990943344 success**, including migration/Postgres/H-CONTRACT; earlier proof CI green too. C4/C5 prove live schema. No sensitive code/conflict-altered patch; unchanged accepted reviews reused, no new mandatory review triggered.

## Next Actions

1. Integrate only b95d0ab's gated C13 patch by rebase/fast-forward, with identical range-diff. C13 is complete; do not repeat funding/deploy or recreate deleted key identities.
2. Fetch/read owning public checkout; update only approved README funding/program lines after no-conflict check. Verify live site after final push. Run required local gate before push and verify exact-SHA CI.
3. Ask Cisco to bring real MYCEL reply/quote contributions into epoch 2 through the bot, leaving time for scoring and the October 8 author/duplicate audit. Prepare the request; Cisco sends any community message.
4. After C13 integrate `b95d0ab`, update public README funding lines, delete only fully integrated refs; gate/push/exact-SHA CI.
5. Final C13 /organic-sync receipt: actual runner/usage limits, SHAs, program/image/migrations, attended reads, checks, branches, uptake, downstream API impact and parked items/recommendations. This arc ends there.
6. C14-C22 remain clock-bound October 8-9; video/submission October 9-10. Execution of those steps, rules/Jev merge, optional devnet close and folder deletion are out of scope.

## Quick Reference

`CLAUDE.md`, `AGENTS.md`, `docs/BUILDLOG.md`; [Runbook C](handoffs/2026-09-28-runbook-c.md); [October 1 pause](handoffs/2026-10-01-evening-pause.md); [completed rehearsal](handoffs/2026-10-01-ledger-devnet-rehearsal.md); [September 30 close](handoffs/2026-09-30-session-close.md); [cleanup receipt](handoffs/2026-10-01-worktree-cleanup.md). Private plan stays in the vault; no copy committed.

Wallet inventory: [docs/WALLETS.md](WALLETS.md). Update actual signatures, balances and key deletion states at C11/C13; the registry is not a secret backup.

## Resume Checklist

Check Git refs/status/frozen candidate and live machine/schema/site state before trusting this checkpoint. Read the actual proof and attended receipts. Use UTC. Preserve all gates and attendance; never repeat a completed money step or assume an unattended proof.

## Suggested skills

`handoff-memory`, `superpowers:verification-before-completion`, `vercel:vercel-cli` for site checks, `solana-dev` for C8-C13, `handoff` for final receipt. No helpers.

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
Resume Hyphae after C13. Mainnet program/hash/authority/ProgramData/229432 bytes verified, buffer consumed. Returned 0.051537968 SOL to confirmed original wallet, sweep finalized/zero and both temporary key files deleted after gates. Persistent program identity and Ledger retained; don't fund retired addresses or repeat deploy. C13 truth integration/public README/final checks remain. C7 Fly v11/Neon 0000-0012/read API complete; no mainnet community/pot/payment yet.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/WALLETS.md, docs/handoffs/2026-10-02-c13-mainnet-receipt.md, docs/handoffs/2026-10-02-mainnet-funding.md, docs/handoffs/2026-10-02-wallet-registry.md, docs/handoffs/2026-10-02-epoch-proof.md, docs/handoffs/2026-10-02-attended-run.md, docs/handoffs/2026-10-01-evening-pause.md, docs/handoffs/2026-10-01-ledger-devnet-rehearsal.md, docs/handoffs/2026-09-28-runbook-c.md.
Model: GPT-6.1 Sol (high) — current plan's runbook-execution recommendation.
Skills: handoff-memory, superpowers:verification-before-completion, vercel:vercel-cli, solana-dev, handoff.
Verify actual Git state, finish post-C13 integration/README/gate/push/CI, refresh uptake and append final receipt. Preserve rules/Jev, candidate checkout and wsl. Stop before C14-C22 and optional cleanup/close work.
```
