---
date: 2026-10-02
summary: C3-C11 passed. Cisco accepted actual 1.22 SOL funding under 1.2 SOL cap and confirmed return wallet. Buffer key deleted after finalized authority/hash gates; C12 Ledger deploy next.
---

# Hyphae handoff

## TL;DR

**C3-C11 passed; C12 Ledger deploy is next.** Frozen `b3c82c7` is live as Fly v11, Neon 0000-0012; C7 integrations/read-backs and CI passed. Cisco funded 1.22 SOL and accepted that amount under the **1.2 SOL spending cap**, confirming return of all unused balance to **`Fjgmfymca7zPDcCr4e9CJLr9GEyqi68HvHrYJ7Tj1Sd7`**. C11 buffer is finalized under the Ledger, 229,432 bytes, exact reviewed hash; buffer key deleted only after those gates. Hot key retained, finalized balance **0.052391118 SOL** at 11:25:02Z. **No mainnet program deployed yet. Next: C12's one blind Ledger approval, then C13 read-back and sweep.**

Cisco is present. Session pre-approval authorizes Codex to run the named CLI steps/read-backs; Cisco handles wallet transfers, Ledger approvals and necessary human inputs. The older runbook's operator assignment caused an initial pause; the session instruction governs execution. No renewed approval is needed. Every safety/read-back gate remains binding.

## Metadata

- Project: hyphae; project ID: github.com-fcisco95-hyphae; repo root: .; branch: main.
- Last Updated: 2026-10-02T12:28:00+01:00.
- Runner: Codex (GPT-6); exact runtime model ID, effort, token/cost usage unavailable. No helpers or paid scoring calls.
- Arc start: `ea15cf1d134256af79e2ea716ea41fd2aebe7231 = origin/main`, CI `36935161826` success.
- Latest integration main: `4a4165584d4a7d728b3b020e49374dd926c1af25`, pushed, exact-SHA CI `36990943344` success. C8-C10 receipt `9a7e6817a93c4fb6b8ec2db55d0bd6b47c8aa1e6` pushed, exact-SHA CI `36992801247` success. This wallet-registry checkpoint follows; earlier proof CI succeeded too.
- C7 used the frozen candidate; main now has authorized post-C7 doc/test/dependency cleanup. Production API/program source still matches the candidate. Git retains only main and detached `../hyphae-wt/c1-gate`. Preserve untracked `wsl`.

## Current Objective

Run attended C12-C13. C3-C11 are complete; C10 amount ruling and exact return recipient are recorded. After C13, integrate its truth commit, update the public funding README and finish the /organic-sync receipt. Stop this arc before C14-C22.

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
| Program/C8-C11 | Program/key/archive/CLI and Ledger address matched. C9 hashes exact. C10 1.22 SOL funding accepted under 1.2 SOL cap; return recipient explicitly confirmed. C11 finalized buffer Ledger authority, 229,432 bytes, exact hash; key deleted 11:24:18Z. Program still absent at 11:25:02Z; hot balance 0.052391118 SOL. C12-C13 not run; never repeat October 1 rehearsal/C1/C2. |
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

1. Run C12 Windows deploy with one blind Ledger approval after clear program/buffer/hash/authority/fee-payer summary and fresh safety reads. Do not regenerate keys, repeat funding or recreate the deleted buffer identity.
2. C13 finalized program/hash/authority/buffer read-back, then sweep to the exact confirmed recipient, confirm signature, read zero balance and only then delete hot key. C7/integrations/API README/CI and C8-C11 complete; no repeated proof/rehearsal/C1/C2.
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

Hot key retained only in WSL `~/hyphae-mainnet/deploy-hot-2026-10-02.json`; buffer key deleted after C11 gates, exact former path retained in registry. Approved C11 hot-key transactions completed; no mainnet program deploy or scheduled job yet. Existing proof script remains untracked in c1-gate. Organic/Sentinel unchanged; Hyphae v1 read API is deployed, payment still unavailable.

## Resume Prompt

```text
Resume Hyphae Part B at C12. C3-C11 passed; C10 actual 1.22 SOL accepted with 1.2 SOL cap and confirmed sweep recipient Fjgmfymca7zPDcCr4e9CJLr9GEyqi68HvHrYJ7Tj1Sd7. Later similar-looking sender is not the recipient. Buffer E8MhkV28a4918ZpqRZHAf6ANqK8GxkroEy82GEFAdBSF finalized under Ledger with exact 229432-byte reviewed hash; buffer key deleted after gates. Hot key retained in registered WSL path; finalized balance 52391118 lamports at 11:25:02Z. Mainnet program absent then. Preserve C12 Ledger approval and signed-error recovery, C13 sweep/confirm/zero-before-deletion. C7 already live; no repeated funding/rehearsal/deploy.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/WALLETS.md, docs/handoffs/2026-10-02-mainnet-funding.md, docs/handoffs/2026-10-02-wallet-registry.md, docs/handoffs/2026-10-02-epoch-proof.md, docs/handoffs/2026-10-02-attended-run.md, docs/handoffs/2026-10-01-evening-pause.md, docs/handoffs/2026-10-01-ledger-devnet-rehearsal.md, docs/handoffs/2026-09-28-runbook-c.md.
Model: GPT-6.1 Sol (high) — current plan's runbook-execution recommendation.
Skills: handoff-memory, superpowers:verification-before-completion, vercel:vercel-cli, solana-dev, handoff.
Verify actual state, then attended C12-C13 and final C13 truth/public funding/receipt work. Update wallet lifecycle receipts; preserve rules/Jev, original refs, candidate checkout and wsl. Stop this arc before C14-C22 and optional cleanup/close work.
```
