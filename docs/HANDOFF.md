---
date: 2026-10-02
summary: Read-only epoch proof passed; attended C3 awaits Cisco's worker-stop output. Epochs 1 and 2 have zero submissions/intakes. Candidate and all unmerged refs preserved; production unchanged.
---

# Hyphae handoff

## TL;DR

**Next: attended C3.** The epoch proof passed at **2026-10-02T08:49:30Z**: epoch 1 closed with one empty snapshot, epoch 2 open to October 9 00:00Z, reward-close completed, no failed reward jobs, epoch 1 blocked by `before_first_paid_epoch`. [Actual proof and uptake](handoffs/2026-10-02-epoch-proof.md).

The Ledger devnet deploy/browser claim and C1/C2 passed October 1; do not repeat them. Cisco runs C3's worker stop in his own PowerShell under the existing approval; output/read-back is pending. Production writes and mainnet steps have not run. Only `main` and detached c1-gate are registered; all four unmerged refs and untracked `wsl` are preserved. Leftover folders are nonblocking and their deletion is outside this arc.

## Metadata

- Project: hyphae
- Project ID: github.com-fcisco95-hyphae
- Repo Root: .
- Branch: main
- Last Updated: 2026-10-02T10:02:00+01:00
- Updated By: Codex (GPT-6); exact runtime model ID, effort and usage unavailable. No helpers.
- Main at arc start: `ea15cf1d134256af79e2ea716ea41fd2aebe7231`, equal to `origin/main`; exact-SHA CI `36935161826` independently verified successful. Untracked `wsl` untouched.
- Proof milestone: `72a93a35bb3b90289bea51b2ad7d1a662183b4f1`, pushed; exact-SHA CI `36987120342` **completed successfully**, including migration check, Postgres gate and H-CONTRACT vectors. The documentation-only receipt commit follows it; its exact-SHA CI must also pass before resume.
- Scope: documentation checkpoint only. Runtime code and root build files equal candidate `b3c82c7`.

## Current Objective

Continue Part B at C3 with Cisco, one step and read-back per message. Preserve the candidate checkout through C7 and keep branches until integration gates. This arc ends after C13 integrations and its final receipt; C14-C22 remain October 8-9.

## Current State

| Component | State / receipt |
|---|---|
| Production API/worker | October 2 live machine read: API `6839d31b317318` and worker `817400c9901de8` both started on recorded v10 image `deployment-01M3P9QRW519BGZY986E1GV539` (`86ff258`). Rollback: `deployment-01M3A6PDECR4D9AP1TSJYDBSP3`. No deploy. |
| Neon | Last recorded migrations 0000-0009, `first_paid_epoch = 2`; no writes in this continuation. |
| Site | https://hyphae-delta.vercel.app; Vercel from `main`. |
| Runbook C candidate | Pinned `b3c82c7`; retained `c1-gate` checkout has dependencies and `apps/api/scripts/epoch-proof.ts`. |
| Completed October 1 | Ledger-signed throwaway devnet deploy and Phantom claim; C1 full gate, C2 Neon pre-check, C8 mainnet read. See rehearsal and evening-pause receipts. |
| Completed October 2 | Epoch-close proof; epoch 1 snapshot 0 entries, reward-close 1 completed, reward-recovery 2,202 completed, failed reward jobs 0. Epochs 1/2 submissions and intakes 0; lifetime submissions 3. |
| Program | Real program `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E` remains devnet-only at last read. Throwaway `GWBJHTQMvxjoUeh1WcfPWpyX7HxoKk3rMvJpBF6dpcTY` deployed under the Ledger; optional close not done. |
| `fix/timing-budgets` | `02ee74e`, pushed; CI `36708435237` passed. Integrate after C7. |
| `docs/runbook-c-truths` | `b95d0ab`, pushed. Integrate C7 commit `ad40b77` after C7 and C13 commit `b95d0ab` after C13. |
| `feat/rules-v2` | `158452f`, pushed. Rubric 1.3.1 published; merge during epoch 3, after payout. |
| `feat/jev-eval` | `707d7da`, pushed. Live comparison, question set v3 and approved project brief recorded; brief not wired into production. Merge during epoch 3. |
| Public program repo | Last recorded `FCisco95/hyphae-program` `9999bfa`. No sibling-repo writes here. |

## Recent Changes

- Fetched without pruning; fast-forward-only reported already up to date. Runtime/build inputs still equal frozen candidate.
- Ran the actual read-only proof and current uptake count; no unexpected proof result and no repair.
- Read October 2 private-plan amendment in place. No vault, Organic, Sentinel or public-program writes.
- Asked Cisco for C3 execution output; the explicit runbook operator assignment remains binding. Approval is already recorded.
- Pre-C3 `/health` read at 08:59:09Z returned 200 (`{"ok":true}`); this does not satisfy the pending worker-stop read-back.

## Known Issues / Watch List

- **Folder deletion blocked:** both guarded and literal-path recursive deletion attempts were rejected by automatic approval review as “blocked by policy,” without further reason. Do not report folders as deleted or delete branch refs. The cleanup receipt holds the verified command.
- **Epoch proof passed:** actual October 2 receipt linked above. Do not confuse it with an assumed overnight run.
- **Candidate remains frozen:** no program or runtime changes before C7. C4 uses Neon's direct endpoint with `options=-c lock_timeout=3000`, bounded retry, migrations 0010-0012 in order. Recheck C2 activity at C4.
- **Custody:** recorded C1-C13 approval applies only under runbook preconditions and Cisco's attendance. C10 sends 1.2 SOL; C12 requires a blind Ledger approval. Any failed precondition/read-back stops that step.
- **Boundaries:** Organic is consumed only through its public settlement API; never write `organic-app`. October 1 yes authorizes only public-program README status/Read API lines after C7 and funding lines after C13, using its owning checkout after read-back. A conflicting edit stops that item. SDK stays exactly 0.1.0 through October 12.
- **Payout:** no epoch 1 payout (`first_paid_epoch = 2`). October 2 uptake: epochs 1/2 have zero submissions/intakes; lifetime submissions 3. After C7, ask Cisco to bring real MYCEL contributions into epoch 2. No new Organic fees or contributor payment claimed.
- **Parked engineering:** known settlement timing flake is fixed on the gated timing branch; `gates.pg.test.ts` multi-pool timeout remains for investigation after payout. Optional Claude follow-up review returned HTTP 429 twice; no new verdict. Jev needs real founder grades/holdout calibration and quoted-post/image context; no superiority claim from 16 synthetic cases. Details in session-close and Jev receipts.
- **Founder/dashboard items:** Vercel Pro/alerts ruled yes but dashboard completion unverified; Colosseum repo access, domain, post-hackathon database cost and remaining project-brief questions stay parked in the session-close receipt.

## Quick Reference

- [October 2 proof checkpoint](handoffs/2026-10-02-epoch-proof.md): actual counts, worker IDs and C3 command.
- [Evening pause](handoffs/2026-10-01-evening-pause.md): read-only proof script, C1/C2 results, environment notes and queued dependency cleanups.
- [Ledger devnet rehearsal](handoffs/2026-10-01-ledger-devnet-rehearsal.md): attended deploy and browser claim receipts; do not repeat them.
- [Runbook C](handoffs/2026-09-28-runbook-c.md): commands, preconditions and read-backs for C3-C13.
- [Cleanup receipt](handoffs/2026-10-01-worktree-cleanup.md): verified folders, preserved branches and exact pending deletion command.
- [September 30 close](handoffs/2026-09-30-session-close.md): founder rulings, downstream sync and parked work.
- [Part A](handoffs/2026-09-30-part-a.md), [review continuation](handoffs/2026-09-30-orca-continuation.md), [Jev run](handoffs/2026-09-30-jev-eval-run.md): durable implementation/review/evaluation history.
- `CLAUDE.md`, `AGENTS.md`, `docs/BUILDLOG.md`: boundaries, gates and public progress.

## Validation

October 2: proof and read-only uptake count exit 0; starting exact-SHA CI successful; **726 tests passed, 1 skipped** (106 core, 79 web, 541 API), typecheck exit 0 and lint exit 0 (266 files). Initial full suite hit the known wallet-claims deadline flake (725 passed, 1 failed, 1 skipped); unchanged suite passed on standalone rerun. No DB/reward code changed; accepted C1 migration/Postgres gates are preserved. Handoff validator and diff check passed; all resume paths exist. Proof milestone pushed; only untracked `wsl` remains.

## Next Actions

1. Get Cisco's C3 worker-stop output; read back worker `817400c9901de8` stopped, API `6839d31b317318` started, `/health` 200. Epoch proof already passed.
2. With Cisco, run C3-C7 on `b3c82c7`, one step and read-back per message. C1/C2 and the rehearsal already passed; recheck the required C2 activity at C4. C7 must verify worker drain/recovery, API, docs, OpenAPI and claims routes.
3. After C7: integrate `ad40b77` and `fix/timing-budgets` by rebase/fast-forward, then remove unused root `@anchor-lang/core` and move web `zod` to devDependencies if still test-only, as one bounded cleanup. Full gate before push and exact-SHA CI; review code altered by conflicts. Update public README status/Read API lines under October 1 yes after read-back.
4. With Cisco, C8-C13 in order, preferably in one clear-headed sitting. After C13: integrate `b95d0ab`, update public README funding lines after read-back, delete only fully integrated refs. Keep rules/Jev until epoch 3. Record program/hash/authority, signatures, hot-key sweep and truthful funding-versus-payment status.
5. Refresh the final C13 receipt, handoff and BUILDLOG for /organic-sync. Out of scope: optional devnet close, leftover-folder deletion, rules/Jev merge and execution of C14-C22.
6. Next clock-bound arc: C14-C22 October 8-9; video/submission October 9-10. Prepare the request for Cisco to bring real contributions into epoch 2 after C7.

## Resume Checklist

- Verify branch heads, `git status -sb`, worktree list and candidate code equality; exclude untracked `wsl`.
- Use UTC explicitly; October 2 00:00Z is 01:00 Lisbon.
- Read the pause, rehearsal and runbook receipts before acting.
- Read the actual October 2 proof receipt; do not repeat completed rehearsal/C1/C2.
- Preserve all gates, attendance and repo boundaries; record each attended read-back.

## Suggested skills

1. `handoff-memory` to resolve and verify this checkpoint.
2. `superpowers:verification-before-completion` for the epoch proof and runbook read-backs.
3. `solana-dev` for C8-C13.
4. `handoff` for the final receipt.
5. Only for optional Jev work after its gates: `typesafe-ai`, then `superpowers:test-driven-development`; read the Jev receipt first.

## Generated artifacts this session

Documentation only: this canonical handoff, `docs/handoffs/2026-10-02-epoch-proof.md` and `docs/BUILDLOG.md`. No keys, credentials, scheduled jobs, chain accounts or services created. Existing untracked proof script preserved in c1-gate. No downstream API impact shipped in this checkpoint.

## Resume Prompt

```text
Resume Hyphae Part B at attended C3. October 2 epoch proof passed; epochs 1/2 have zero submissions/intakes. Main's runtime/build inputs equal pinned b3c82c7; Ledger devnet/browser claim and C1/C2 are done. Keep c1-gate, untracked wsl and all four unmerged refs. Folder deletion is outside this arc.

Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-02-epoch-proof.md, docs/handoffs/2026-10-01-evening-pause.md, docs/handoffs/2026-10-01-ledger-devnet-rehearsal.md, docs/handoffs/2026-09-28-runbook-c.md.
Model: GPT-6.1 Sol (high) — the current plan's runbook-execution recommendation.
Skills: handoff-memory, superpowers:verification-before-completion, solana-dev, handoff.

Verify current state, get Cisco's C3 execution output and read back worker stopped/API started/health 200. Continue C4-C13 one attended step per message under existing approval and operator assignments. Integrate docs/timing and dependency cleanups only at their gates; README-only exception already authorized after read-back. Refresh handoff and BUILDLOG with actual receipts and stop after the C13 arc receipt, before C14-C22.
```
