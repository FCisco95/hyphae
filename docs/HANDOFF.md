---
date: 2026-10-02
summary: Epoch proof and C3-C7 passed. Frozen b3c82c7 is live as Fly v11, Neon 0000-0012 and worker/site/API proofs passed. C7 integrations/cleanup and public README sync are next, then attended C8-C13.
---

# Hyphae handoff

## TL;DR

**C7 passed at 09:29:18Z.** Epoch proof and C3-C7 passed. Frozen `b3c82c790e129b1f4a24ada6b34407e5f6d57ec9` is deployed as Fly v11; API and worker are started on `deployment-01M3XYDW5XW7AEAY68CKVPKC2X`. API/docs/OpenAPI/claims/rate-limit/rendered-site and ten-minute worker proofs passed. **Next: C7 integrations, dependency cleanup and public README status/Read API sync, then attended C8-C13.**

Cisco is present. Session pre-approval authorizes Codex to run the named CLI steps/read-backs; Cisco handles wallet transfers, Ledger approvals and necessary human inputs. The older runbook's operator assignment caused an initial pause; the session instruction governs execution. No renewed approval is needed. Every safety/read-back gate remains binding.

## Metadata

- Project: hyphae; project ID: github.com-fcisco95-hyphae; repo root: .; branch: main.
- Last Updated: 2026-10-02T10:22:00+01:00.
- Runner: Codex (GPT-6); exact runtime model ID, effort, token/cost usage unavailable. No helpers or paid scoring calls.
- Arc start: `ea15cf1d134256af79e2ea716ea41fd2aebe7231 = origin/main`, CI `36935161826` success.
- Latest pushed main: `2cd7c7cb664e9eec5944e79b01c6d04f6832cf6f`, exact-SHA CI `36987497612` success. `72a93a3` proof milestone CI `36987120342` also succeeded.
- Runtime/build inputs remain frozen candidate until C7; no substituted API tree. Git retains only main and detached `../hyphae-wt/c1-gate`. Preserve untracked `wsl`.

## Current Objective

Complete C7, then its gated integrations/dependency cleanup and public README status/Read API sync. Continue attended C8-C13, integrate remaining C13 truth and public README funding lines, and write the final /organic-sync receipt. Stop this arc before C14-C22.

## Current State

| Component | Verified state |
|---|---|
| Epoch proof | October 2 08:49:30Z: epoch 1 closed, one empty snapshot, epoch 2 open to October 9 00:00Z; reward-close completed, no failed reward jobs; epoch 1 gate blocked solely by `before_first_paid_epoch`. |
| Neon | C4 applied 0010-0012 on attempt 1 via direct endpoint with 3-second lock timeout. C5 matched all 13 journal hashes/timestamps, schema additions, unchanged counts and null new hashes. `first_paid_epoch = 2`. |
| Fly | v11, candidate `b3c82c7`; API `6839d31b317318`, worker `817400c9901de8`; image `deployment-01M3XYDW5XW7AEAY68CKVPKC2X`. Both read secrets Deployed. Worker restarted October 2 09:19:01Z. |
| C7 rollback | Previous image `deployment-01M3P9QRW519BGZY986E1GV539` (`86ff258`); schema remains 0000-0012. |
| Site | https://hyphae-delta.vercel.app; C7 production rebuild `dpl_BoanHo18mXaSpfXk4JetxakgYoa7`, Ready and aliased. Same web token set as sensitive Production secret. Browser rendered the community with open epoch 2 and final epoch 1. |
| API | Health/docs/OpenAPI/community/epoch/wallet-claims reads passed. Epoch 1 settlement unavailable `before_first_paid_epoch`; epoch 2 `no_settlement`. No-leaf wallet returns total_claims 0/empty list; leaf route and site proxy correctly return 404. Rate limits: token 3,000, anonymous 300. |
| Worker | All required queues consumed. Ten-minute DB proof 09:29:18Z: pending/old/failed jobs 0, recovery completed after restart 4, stop-window submissions/unscored 0. |
| Program | Real `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E` devnet-only at last read. Completed October 1 Ledger devnet deploy/browser claim, C1/C2 and preliminary C8 mainnet read must not be repeated. Fresh C8 mainnet/device checks remain gated after C7. |
| Uptake | October 2 08:51:07Z: epochs 1/2 have 0 submissions and 0 intakes; lifetime community submissions 3, outside those windows. Snapshot entries 0. Current community display name is Hyphae Lab; mint is the runbook's fixed mint. |

## Branch Disposition

All four refs remain local and pushed, unmerged: `fix/timing-budgets` `02ee74e`; `docs/runbook-c-truths` `b95d0ab`; `feat/rules-v2` `158452f`; `feat/jev-eval` `707d7da`. After C7 integrate `ad40b77` and timing by rebase/fast-forward; after C13 integrate `b95d0ab`. Delete only fully integrated refs. Keep rules/Jev until epoch 3; no activation in this arc. Preserve candidate checkout through C7. Leftover folders are nonblocking and deletion is outside this arc.

## Recent Changes

- [Epoch proof checkpoint](handoffs/2026-10-02-epoch-proof.md): proof, actual uptake, pushed `72a93a3` and `2cd7c7c`, exact-SHA CI successes.
- [Attended run](handoffs/2026-10-02-attended-run.md): actual C3-C6 commands/timestamps and C7 deployment/read-backs as observed.
- C6 generated a 64-character web token in ignored `.env`; staged Fly read secrets and set matching Vercel Production token. RPC reuses existing Helius hold provider, verified mainnet genesis. Values never printed/committed.
- C7 deployed from c1-gate; temporary ignore file added only the untracked proof-script exclusion, then was removed. Dockerfile/entrypoints/source unchanged.
- Private October 2 plan amendment read in place; vault, Organic, Sentinel and public-program checkout not written yet.

## Known Issues / Watch List

- A failed runbook precondition/read-back parks dependent steps; do not repair an unexpected epoch-proof result. Candidate remains pinned through C7. No custody/program/source change outside the runbook.
- C10 sends 1.2 SOL; C12 requires one blind Ledger approval. Use a clear-headed sitting. C13 verifies program/hash/authority/buffer, then sweep/confirm/zero balance before deleting the hot key.
- Public-program README-only exception: October 1 yes authorizes status/Read API after C7, funding lines after C13, using owning checkout after read-back. Conflicting edits stop that item; no other public-repo edits.
- SDK stays exactly 0.1.0 through October 12. Organic's CPMM fee blocker does not alter this treasury-funded runbook. No new Organic fees or contributor payment claim.
- Known timing flake is fixed on the gated timing branch. Postgres multi-pool hang, Jev calibration/holdout and project-context follow-ups remain parked in the September 30 receipts. No new superiority claim.
- Founder/dashboard items (Pro/alerts confirmation, reviewer access, domain, database cost) remain in the September 30 close. Vercel Pro/alerts already ruled yes.

## Validation

Local gate this session: 726 tests passed, 1 skipped (106 core, 79 web, 541 API); typecheck and lint exit 0 (266 files). First test run hit the known wallet-claims deadline flake; unchanged standalone rerun passed. Strict handoff validation, resume-path existence and diff checks passed on the proof checkpoint. Both pushed proof/receipt CI runs passed, including migration consistency, Postgres and H-CONTRACT gates. Completed C1 Postgres/migration checks are reused for the unchanged candidate; C4/C5 live reads prove the actual migration state. No sensitive code changed or conflict was resolved yet.

## Next Actions

1. C7 completed; commit its actual receipt, then perform the gated integrations and cleanup below. No rerun of the completed proof/rehearsal/C1/C2.
2. After C7 passes: rebase/fast-forward `ad40b77` and timing; remove unused root `@anchor-lang/core`, move web `zod` to devDependencies only if test-only, one cleanup commit. Full gate/push/exact-SHA CI. Fresh other-family review for sensitive or conflict-altered code. Public-program README status/Read API sync under existing yes.
3. Ask Cisco to bring real MYCEL reply/quote contributions into epoch 2 through the bot, leaving time for scoring and the October 8 author/duplicate audit. Prepare the request; Cisco sends any community message.
4. C8-C13 in order with fresh safety reads and Cisco attending. After C13 integrate `b95d0ab`, update public README funding lines, delete only fully integrated refs; gate/push/exact-SHA CI.
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

No mainnet keys, funds movement, program deploy or scheduled jobs created yet. Existing proof script remains untracked in c1-gate. No Organic/Sentinel API contract changed; Hyphae's approved v1 read API is now deployed, with payment still unavailable.

## Resume Prompt

```text
Resume Hyphae Part B after passed C7 (October 2 09:29:18Z). Epoch proof and C3-C7 passed; b3c82c7 is live as Fly v11, Neon 0000-0012, site/token/routes and worker drain/recovery verified. Next are C7 integrations/cleanup/public README, then C8-C13. Cisco attends; agent CLI execution is pre-approved, human wallet/Ledger inputs remain Cisco's.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-02-epoch-proof.md, docs/handoffs/2026-10-02-attended-run.md, docs/handoffs/2026-10-01-evening-pause.md, docs/handoffs/2026-10-01-ledger-devnet-rehearsal.md, docs/handoffs/2026-09-28-runbook-c.md.
Model: GPT-6.1 Sol (high) — current plan's runbook-execution recommendation.
Skills: handoff-memory, superpowers:verification-before-completion, vercel:vercel-cli, solana-dev, handoff.
Verify actual state, perform gated C7 integrations/cleanups/public README status lines, then attended C8-C13 and final funding/docs receipts. Preserve rules/Jev, candidate checkout and wsl. Stop this arc before C14-C22 and optional cleanup/close work.
```
