---
date: 2026-10-02
summary: Epoch proof, C3-C9 and C7 integrations passed. Two C10 keys generated; Cisco funding and sweep address pending. No mainnet transaction or deploy yet.
---

# Hyphae handoff

## TL;DR

**C3-C9 passed; C10 awaits Cisco's funding transfer.** Frozen `b3c82c790e129b1f4a24ada6b34407e5f6d57ec9` is live as Fly v11; Neon 0000-0012, API/site/worker read-backs passed. Integrations/cleanup pushed through `4a41655`, exact-SHA CI `36990943344` success; public README C7 sync pushed as `1caeebb`. Ledger readiness cleared the initial device error; the address matches. Both C9 build hashes match. Two C10 keys were generated silently; deployer `CpBum8ynMAawJSdNCKS9NLZXc6hySE1aDCqna7XhmyNT` finalized balance was 0 at 09:54:10Z. **Next: Cisco sends 1.2 SOL and names the C13 sweep recipient; verify funding, then C11-C13.** No agent transaction or mainnet deploy yet.

Cisco is present. Session pre-approval authorizes Codex to run the named CLI steps/read-backs; Cisco handles wallet transfers, Ledger approvals and necessary human inputs. The older runbook's operator assignment caused an initial pause; the session instruction governs execution. No renewed approval is needed. Every safety/read-back gate remains binding.

## Metadata

- Project: hyphae; project ID: github.com-fcisco95-hyphae; repo root: .; branch: main.
- Last Updated: 2026-10-02T10:55:00+01:00.
- Runner: Codex (GPT-6); exact runtime model ID, effort, token/cost usage unavailable. No helpers or paid scoring calls.
- Arc start: `ea15cf1d134256af79e2ea716ea41fd2aebe7231 = origin/main`, CI `36935161826` success.
- Latest integration main: `4a4165584d4a7d728b3b020e49374dd926c1af25`, pushed, exact-SHA CI `36990943344` success. Earlier `72a93a3`/`2cd7c7c` proof CI also succeeded. Documentation checkpoint follows this integration SHA.
- C7 used the frozen candidate; main now has authorized post-C7 doc/test/dependency cleanup. Production API/program source still matches the candidate. Git retains only main and detached `../hyphae-wt/c1-gate`. Preserve untracked `wsl`.

## Current Objective

Finish C10 funding verification, then attended C11-C13. C7/integrations/public API README and C8/C9 are complete. After C13, integrate its truth commit, update the public funding README and finish the /organic-sync receipt. Stop this arc before C14-C22.

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
| Program/C8-C10 | Program keypair exact; mainnet finalized AccountNotFound. Archive hash/CLI 3.1.10 exact. Ledger retry returned expected address; C8 passed. C9 candidate build hashes/229,432 bytes match. Two C10 keys generated silently; funding pending, finalized balance 0 at 09:54:10Z. C11-C13 not run. Never repeat October 1 rehearsal/C1/C2. |
| Uptake | October 2 08:51:07Z: epochs 1/2 have 0 submissions and 0 intakes; lifetime community submissions 3, outside those windows. Snapshot entries 0. Current community display name is Hyphae Lab; mint is the runbook's fixed mint. |

## Branch Disposition

Original refs remain local/pushed: timing `02ee74e` is patch-integrated as `9df0f41`/`ca054d9`; C7 truth `ad40b77` is integrated as `fa6c35d`, while docs branch `b95d0ab` still needs its C13 commit. Rules `158452f` and Jev `707d7da` remain unmerged until epoch 3. Dependency cleanup `37f2f8f`, C7 receipt `49f409e`. All rebases had no conflicts and range-diff was identical. Delete only fully integrated refs after C13; preserve candidate checkout and `wsl`. Leftover-folder deletion is outside this arc.

## Recent Changes

- [Epoch proof checkpoint](handoffs/2026-10-02-epoch-proof.md): proof, actual uptake, pushed `72a93a3` and `2cd7c7c`, exact-SHA CI successes.
- [Attended run](handoffs/2026-10-02-attended-run.md): actual C3-C6 commands/timestamps and C7 deployment/read-backs as observed.
- C6 generated a 64-character web token in ignored `.env`; staged Fly read secrets and set matching Vercel Production token. RPC reuses existing Helius hold provider, verified mainnet genesis. Values never printed/committed.
- C7 deployed from c1-gate; temporary ignore file added only the untracked proof-script exclusion, then was removed. Dockerfile/entrypoints/source unchanged.
- Private October 2 plan amendment read in place; vault, Organic and Sentinel unchanged. Public-program README-only C7 sync committed/pushed as `1caeebb`; funding/program status unchanged until C13. New owning checkout `../hyphae-program` is clean at origin/main.
- Cisco's Ledger-ready reply cleared C8's initial device error. C9 build reuse passed; C10 keys exist only in WSL. Funding/sweep-recipient request is pending. No attempted transaction signature; production worker remains healthy/started.

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

1. Await Cisco's 1.2 SOL mainnet transfer to `CpBum8ynMAawJSdNCKS9NLZXc6hySE1aDCqna7XhmyNT` and named C13 sweep recipient; verify finalized funding before C11. Do not regenerate keys or send funding twice.
2. Attended C11-C13 in order under existing approval. Refresh RPC fee estimate and required safety reads. C7/integrations/API README/CI and C8/C9 are complete; no repeated proof/rehearsal/C1/C2/deploy.
3. Ask Cisco to bring real MYCEL reply/quote contributions into epoch 2 through the bot, leaving time for scoring and the October 8 author/duplicate audit. Prepare the request; Cisco sends any community message.
4. After C13 integrate `b95d0ab`, update public README funding lines, delete only fully integrated refs; gate/push/exact-SHA CI.
5. Final C13 /organic-sync receipt: actual runner/usage limits, SHAs, program/image/migrations, attended reads, checks, branches, uptake, downstream API impact and parked items/recommendations. This arc ends there.
6. C14-C22 remain clock-bound October 8-9; video/submission October 9-10. Execution of those steps, rules/Jev merge, optional devnet close and folder deletion are out of scope.

## Quick Reference

`CLAUDE.md`, `AGENTS.md`, `docs/BUILDLOG.md`; [Runbook C](handoffs/2026-09-28-runbook-c.md); [October 1 pause](handoffs/2026-10-01-evening-pause.md); [completed rehearsal](handoffs/2026-10-01-ledger-devnet-rehearsal.md); [September 30 close](handoffs/2026-09-30-session-close.md); [cleanup receipt](handoffs/2026-10-01-worktree-cleanup.md). Private plan stays in the vault; no copy committed.

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

Two keys exist only in WSL `~/hyphae-mainnet`: `deploy-hot-2026-10-02.json` and `deploy-buffer-2026-10-02.json`. Their public addresses and both C9 hashes are in the attended receipt. No agent funds movement, program deploy or scheduled job yet. Existing proof script remains untracked in c1-gate. Organic/Sentinel unchanged; Hyphae v1 read API is deployed, payment still unavailable.

## Resume Prompt

```text
Resume Hyphae Part B at C10 funding verification. C7/integrations complete: b3c82c7 live as Fly v11, Neon 0000-0012, main 4a41655 pushed with exact-SHA CI success, public README C7 sync 1caeebb pushed. C8 Ledger retry and C9 build hashes passed. Two C10 keys exist only in WSL ~/hyphae-mainnet; deployer CpBum8ynMAawJSdNCKS9NLZXc6hySE1aDCqna7XhmyNT finalized balance 0 at 09:54:10Z. Await Cisco's 1.2 SOL transfer and named sweep recipient; don't regenerate or fund twice. No agent transaction/deploy. CLI pre-approved; wallet/Ledger inputs remain Cisco's.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-02-epoch-proof.md, docs/handoffs/2026-10-02-attended-run.md, docs/handoffs/2026-10-01-evening-pause.md, docs/handoffs/2026-10-01-ledger-devnet-rehearsal.md, docs/handoffs/2026-09-28-runbook-c.md.
Model: GPT-6.1 Sol (high) — current plan's runbook-execution recommendation.
Skills: handoff-memory, superpowers:verification-before-completion, vercel:vercel-cli, solana-dev, handoff.
Verify actual state and C10 funding, then attended C11-C13 and final C13 truth/public funding/receipt work. Preserve rules/Jev, original refs, candidate checkout and wsl. Stop this arc before C14-C22 and optional cleanup/close work.
```
