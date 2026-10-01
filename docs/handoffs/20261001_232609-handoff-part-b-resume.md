# SNAPSHOT METADATA

- Created At: 2026-10-01T23:26:09+01:00
- Scope: repo
- Kind: handoff
- Source Canonical: docs/HANDOFF.md
- Workspace: n/a
- Workstream: n/a
- Repositories: hyphae
- Reason: Explicit handoff-memory request; concise checkpoint before next attended production arc

---
---
date: 2026-10-01
summary: Worktree cleanup is complete in Git and Orca, but four leftover folders remain policy-blocked. Epoch proof is pending after 2026-10-02T00:00Z; attended C3-C7 follows. Completed devnet rehearsal, C1 and C2 must not be repeated. Production is unchanged.
---

# Hyphae handoff

## TL;DR

Git and Orca retain only `main` and detached `../hyphae-wt/c1-gate` at `b3c82c7`. All four unmerged branches are preserved. Their deregistered folders still exist: automatic approval review blocked recursive deletion. The exact PowerShell command is in [cleanup receipt](2026-10-01-worktree-cleanup.md); paste only the command, without prose or Markdown fences.

The Ledger devnet deploy/browser claim, C1 and C2 passed on October 1. **Next: after 2026-10-02T00:00Z (01:00 Lisbon), run the read-only epoch proof, then C3-C7 with Cisco tomorrow morning, then C8-C13.** No epoch proof or production action ran in this continuation. No overnight automation was installed; the original provider session/transcript was read only and never resumed or modified. Do not assume its background wait produced a proof.

## Metadata

- Project: Hyphae
- Project ID: github:fcisco95/hyphae
- Repo Root: .
- Branch: main
- Last Updated: 2026-10-01 22:23 UTC
- Updated By: Codex; specific model variant, effort and usage unavailable. No helpers.
- Main at handoff refresh: `f60615b`, equal to `origin/main`; untracked `wsl` untouched.
- Scope: documentation checkpoint only. Runtime code and root build files equal candidate `b3c82c7`.

## Current Objective

Resume Part B safely at the epoch-close proof. Cisco chose tomorrow morning for attended production work. Preserve the candidate checkout through C7 and keep all branches until their integration gates.

## Current State

| Component | State / receipt |
|---|---|
| Production API/worker | Last recorded `86ff258`, Fly release v10, image `deployment-01M3P9QRW519BGZY986E1GV539`; not re-read during cleanup. Rollback: `deployment-01M3A6PDECR4D9AP1TSJYDBSP3`. |
| Neon | Last recorded migrations 0000-0009, `first_paid_epoch = 2`; no writes in this continuation. |
| Site | https://hyphae-delta.vercel.app; Vercel from `main`. |
| Runbook C candidate | Pinned `b3c82c7`; retained `c1-gate` checkout has dependencies and `apps/api/scripts/epoch-proof.ts`. |
| Completed October 1 | Ledger-signed throwaway devnet deploy and Phantom claim; C1 full gate, C2 Neon pre-check, C8 mainnet read. See rehearsal and evening-pause receipts. |
| Program | Real program `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E` remains devnet-only at last read. Throwaway `GWBJHTQMvxjoUeh1WcfPWpyX7HxoKk3rMvJpBF6dpcTY` deployed under the Ledger; optional close not done. |
| `fix/timing-budgets` | `02ee74e`, pushed; CI `36708435237` passed. Integrate after C7. |
| `docs/runbook-c-truths` | `b95d0ab`, pushed. Integrate C7 commit `ad40b77` after C7 and C13 commit `b95d0ab` after C13. |
| `feat/rules-v2` | `158452f`, pushed. Rubric 1.3.1 published; merge during epoch 3, after payout. |
| `feat/jev-eval` | `707d7da`, pushed. Live comparison, question set v3 and approved project brief recorded; brief not wired into production. Merge during epoch 3. |
| Public program repo | Last recorded `FCisco95/hyphae-program` `9999bfa`. No sibling-repo writes here. |

## Recent Changes

- Cleanup checkpoint `e4d8648` and validation receipt `f60615b` pushed to `origin/main`.
- Four branch heads checked against live GitHub. All 80 non-dependency files in the leftover folders matched their branch blobs; no unique non-dependency files or links found.
- Follow-up state check confirms all four folders still exist. No successful user deletion has been observed.
- Canonical handoff condensed to remove contradictory historical summaries. Earlier decisions, reviews and measurements remain in linked receipts.

## Known Issues / Watch List

- **Folder deletion blocked:** both guarded and literal-path recursive deletion attempts were rejected by automatic approval review as “blocked by policy,” without further reason. Do not report folders as deleted or delete branch refs. The cleanup receipt holds the verified command.
- **Epoch proof:** failure parks Part B; report, do not repair. Proof must show epoch 1 closed with one snapshot, epoch 2 open to October 9, completed reward-close with none failed, and epoch 1 blocked with `before_first_paid_epoch`.
- **Candidate remains frozen:** no program or runtime changes before C7. C4 uses Neon's direct endpoint with `options=-c lock_timeout=3000`, bounded retry, migrations 0010-0012 in order. Recheck C2 activity at C4.
- **Custody:** recorded C1-C13 approval applies only under runbook preconditions and Cisco's attendance. C10 sends 1.2 SOL; C12 requires a blind Ledger approval. Any failed precondition/read-back stops that step.
- **Boundaries:** Organic is consumed only through its public settlement API; never write `organic-app`. Public program/README writes must follow recorded authorization, with an explicit stop if it is missing.
- **Payout:** no epoch 1 payout (`first_paid_epoch = 2`). MYCEL had zero submissions at last production read; no new count is claimed.
- **Parked engineering:** known settlement timing flake is fixed on the gated timing branch; `gates.pg.test.ts` multi-pool timeout remains for investigation after payout. Optional Claude follow-up review returned HTTP 429 twice; no new verdict. Jev needs real founder grades/holdout calibration and quoted-post/image context; no superiority claim from 16 synthetic cases. Details in session-close and Jev receipts.
- **Founder/dashboard items:** Vercel Pro/alerts ruled yes but dashboard completion unverified; Colosseum repo access, domain, post-hackathon database cost and remaining project-brief questions stay parked in the session-close receipt.

## Quick Reference

- [Evening pause](2026-10-01-evening-pause.md): read-only proof script, C1/C2 results, environment notes and queued dependency cleanups.
- [Ledger devnet rehearsal](2026-10-01-ledger-devnet-rehearsal.md): attended deploy and browser claim receipts; do not repeat them.
- [Runbook C](2026-09-28-runbook-c.md): commands, preconditions and read-backs for C3-C13.
- [Cleanup receipt](2026-10-01-worktree-cleanup.md): verified folders, preserved branches and exact pending deletion command.
- [September 30 close](2026-09-30-session-close.md): founder rulings, downstream sync and parked work.
- [Part A](2026-09-30-part-a.md), [review continuation](2026-09-30-orca-continuation.md), [Jev run](2026-09-30-jev-eval-run.md): durable implementation/review/evaluation history.
- `CLAUDE.md`, `AGENTS.md`, `docs/BUILDLOG.md`: boundaries, gates and public progress.

## Validation

Earlier in this continuation, before pushing the cleanup records: `pnpm test` passed with 726 tests and 1 skipped (106 core, 79 web, 541 API); typecheck and lint exited 0 (266 files). Diff check was clean. Handoff validation passed with existing template/portability warnings. No DB or reward-job code changed; no separate Postgres gate was required for those docs commits.

This handoff refresh changes documentation only. Runtime tests from the same session are reused; handoff validation, reference existence and diff checks are rerun. No new CI or live production proof is claimed.

## Next Actions

1. After October 2 00:00Z, execute the evening pause's read-only epoch proof from `c1-gate`. Record commands/results. Any unexpected result parks Part B: report, do not repair.
2. With Cisco, run C3-C7 on `b3c82c7`, one step and read-back per message. C1/C2 and the rehearsal already passed; recheck the required C2 activity at C4. C7 must verify worker drain/recovery, API, docs, OpenAPI and claims routes.
3. After C7: integrate `ad40b77` and `fix/timing-budgets` by rebase/fast-forward, then remove unused root `@anchor-lang/core` and move web `zod` to devDependencies if still test-only, as one bounded cleanup. Full gate before push; review any rebase conflict that changes code. Public README changes only under recorded authorization.
4. With Cisco, C8-C13 in order, preferably in one sitting. After C13: integrate `b95d0ab`; delete only fully integrated branches. Keep the rules/Jev branches until epoch 3. Optional devnet program close requires Cisco's in-session yes.
5. Finish local leftover-folder deletion when Cisco runs the recorded command; confirm absence. It does not block the epoch proof. Keep `c1-gate` through C7.
6. C14-C22 remain October 8-9; video/submission October 9-10. No rubric activation or rules/Jev merge in the current arc.

## Resume Checklist

- Verify branch heads, `git status -sb`, worktree list and candidate code equality; exclude untracked `wsl`.
- Use UTC explicitly; October 2 00:00Z is 01:00 Lisbon.
- Read the pause, rehearsal and runbook receipts before acting.
- Confirm the epoch proof actually ran and passed; do not trust an unattended promise.
- Preserve all gates, attendance and repo boundaries; record each attended read-back.

## Suggested skills

1. `handoff-memory` to resolve and verify this checkpoint.
2. `superpowers:verification-before-completion` for the epoch proof and runbook read-backs.
3. `solana-dev` for C8-C13.
4. `handoff` for the final receipt.
5. Only for optional Jev work after its gates: `typesafe-ai`, then `superpowers:test-driven-development`; read the Jev receipt first.

## Generated artifacts this session

Documentation only: this canonical handoff, the cleanup snapshot, its dated handoff-memory snapshot and `docs/BUILDLOG.md`. No keys, credentials, scheduled jobs, chain accounts or services created. Existing unmerged branches, Vercel previews and local build artifacts are documented in earlier receipts.

## Resume Prompt

```text
Resume Hyphae Part B after 2026-10-02T00:00Z. Main's runtime tree equals pinned candidate b3c82c7; the Ledger devnet deploy/browser claim, C1 and C2 are done. Keep c1-gate and all four unmerged branches. Folder cleanup is incomplete only on disk, with the exact verified command in its receipt.

Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-01-evening-pause.md, docs/handoffs/2026-10-01-ledger-devnet-rehearsal.md, docs/handoffs/2026-10-01-worktree-cleanup.md, docs/handoffs/2026-09-28-runbook-c.md.
Model: claude-opus-5-5 (high), the recorded Part B recommendation for attended production checks.
Skills: handoff-memory, superpowers:verification-before-completion, solana-dev, handoff.

Verify current state, then run the read-only epoch proof first. Failure parks Part B: report, do not repair. Cisco joins for C3-C7, one step at a time, then C8-C13 under the recorded runbook approvals. Do not repeat the completed rehearsal or merge the rules/Jev branches. Integrate the docs/timing branches only at their gates. Refresh handoff and BUILDLOG with actual receipts; never assume an overnight proof ran.
```
