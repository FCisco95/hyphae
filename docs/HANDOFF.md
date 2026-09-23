---
date: 2026-09-23
summary: R3 review findings F1, F2 and F4 fixed test-first on fix/r3-recovery (task-close check; scheduled recovery sweep), gate green including test:pg, PR open against main. F3 (lost score message after a crash) waits on Cisco's choice between migration 0005 and a transactional enqueue. Nothing applied or deployed.
---

# Hyphae handoff

## TL;DR

**F1, F2, F4 FIXED on `fix/r3-recovery`; F3 OPEN pending a decision.** `main` = `3754534` (R3). The fix branch adds a task-close check inside admission (`25cd7b4`) and a 5-minute, idempotent `reward-recovery` sweep (`4d0bd4d`). F3 needs either migration 0005 (a `notified_at` marker, recommended) or a transactional enqueue; the approval covers only 0003/0004, so it waits for Cisco. **Next:** review and merge the fix PR on Cisco's yes; Cisco's F3 call; then apply 0003/0004 (plus 0005 if approved). No bootstrap, no deploy.

## Metadata

- Last Updated: 2026-09-23 (late). Snapshots: `docs/handoffs/2026-09-23-r3-recovery.md` (this fix, F3 options), `2026-09-23-r3-merged.md` (findings), `2026-09-23-r3-implemented.md` (R3, corrected on notifications).
- Branches: `main` = `origin/main` = `3754534`. `docs/2026-09-23-r3-merged` (PR #7) open, not merged. `fix/r3-recovery` is based on it and pushed; its PR targets `main` and therefore also carries PR #7's docs commit.
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows, 2026-09-23. Launch requested effort high; effort is not observable in-session.
- Authority: O1–O7 (`2026-09-20-h-design-written-approval.md`); schedule rulings (`2026-09-23-schedule-rulings.md`); R3–R5 approval (`2026-09-23-r3-r5-approval.md`).
- Canonical private plan: not read or edited this session.

## Current Objective

Get the recovery fix reviewed and merged, settle F3, then apply migrations 0003/0004 per the approval preconditions.

## Current State

- On `fix/r3-recovery` (not merged, not deployed): `admitContribution` refuses `task_closed` when the task is not `open` or `now >= closesAt` under the lock. `strandedWork` + `reward-recovery` queue re-queue, after a 10-minute grace: admitted intakes with no live quality dispatch and no live new-work nomination; `ready` nominations with no live slot dispatch (covers `reward-reconcile.ts`); pending-evidence nominations missing their next retrieval round; dispatches stuck in `dispatched`. The worker schedules it with `*/5 * * * *`.
- R3 on `main` as before; the withdraw-without-quality gap is closed by the sweep once the fix merges.
- Production unchanged: Neon has migrations 0000–0002 only (last recorded Sep 17; not re-checked); the deployed bot runs the Sep 17 path.

## Recent Changes

2026-09-23 (late): F4 fix `25cd7b4`; recovery sweep `4d0bd4d`; R3 record corrected ("retry independently" only once queued); record `2026-09-23-r3-recovery.md`; build log.

2026-09-23: PR #5 and PR #6 merged; findings F1–F4 recorded (PR #7).

## Validation

Fresh on `4d0bd4d`: `pnpm -r test` exit 0 (core 54, api 160); `pnpm -r typecheck` exit 0; `pnpm exec biome check .` exit 0 (97 files); `drizzle-kit check` exit 0; `pnpm --filter @hyphae/api test:pg` 4/4 exit 0; `git diff --check` exit 0. Mutation probes on the sweep: 13/13 killed.

## Known Issues / Watch List

- **F3 open:** a crash between completion and queueing the notification loses the member's message (the score is kept). Options and recommendation in `2026-09-23-r3-recovery.md`.
- The sweep's worker wiring (`recoverRewardWork`, `boss.schedule`) is typechecked, not run against pg-boss; first real run is at cutover.
- No CI. The native gate, `test:pg` and an independent review are the evidence.
- `main` must not be deployed before 0003 and 0004 are applied (approved; check zero MYCEL epochs and a 0000–0002 journal first).
- `/me` still sums legacy `scoring_runs` (R4). BotFather menu lacks `/effort` (manual step at cutover). No bot withdraw command.
- Live Telegram, oEmbed and provider paths are exercised only through injected fakes.
- Codex CLI sandbox on this machine fails with `apply deny-read ACLs`; use `codex --sandbox danger-full-access` for a review session.
- Worktree-isolated sessions refuse compound shell commands that mix `cd` or runtime variables with git; run git and pnpm as plain single commands.

## Next Actions

1. Review the fix PR: read Codex's inline comments (`gh api repos/FCisco95/hyphae/pulls/<n>/comments`), address any, merge on Cisco's yes. Merge PR #7 first or together.
2. Cisco: F3 option 1 (migration 0005, `notified_at`) or option 2 (transactional enqueue). Option 1 needs a written yes for 0005.
3. Apply 0003/0004 (and 0005 if approved and built) to Neon per the approval preconditions; record it. No bootstrap, no deploy.
4. Sep 24 docs per `2026-09-23-tomorrow-plan.md`.
5. R4 on `feat/r4-effective-reads` after the fixes merge.

## Quick Reference

- This fix: `apps/api/src/rewards/{intake,recovery}.ts`, `recovery.test.ts`, `apps/api/src/jobs/{queue,reward-jobs}.ts`, `apps/api/src/worker.ts`
- Findings: `docs/handoffs/2026-09-23-r3-merged.md`; fix record: `2026-09-23-r3-recovery.md`
- Approval: `docs/handoffs/2026-09-23-r3-r5-approval.md`
- Real-Postgres gate: `apps/api/scripts/test-pg.sh`
- Operator script: `apps/api/scripts/reward-reconcile.ts <dispatch-id> not-sent --reason "<evidence>"` (the sweep queues the follow-up call)

## Suggested skills

`handoff-memory` (resume), `superpowers:receiving-code-review` (PR comments), `superpowers:test-driven-development` (F3 once chosen, R4), `supabase:supabase-postgres-best-practices` (migration apply), `handoff`.

## Resume Checklist

- `git fetch --prune && git status -sb`; check whether PR #7 and the fix PR are merged.
- Run the native gate and `pnpm --filter @hyphae/api test:pg` (Docker must be running).
- Do not apply any migration until the fix PR merges; 0005 only with its own written yes.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| F4 fix, recovery sweep | `fix/r3-recovery` (`25cd7b4`, `4d0bd4d`) | Not merged, not deployed |
| Fix record + F3 options | `docs/handoffs/2026-09-23-r3-recovery.md` | |
| R3 record correction | `docs/handoffs/2026-09-23-r3-implemented.md` | Notifications line |
| Build log | `docs/BUILDLOG.md` | 2026-09-23 (late) entry |

No credentials, deployed resources, Neon changes or live scheduled jobs. Docker test containers are removed by `test-pg.sh` on exit.

## Next-session prompt

```text
Resume Hyphae. R3 is on main (3754534). Review findings F1, F2, F4 are fixed on fix/r3-recovery (PR open against main); F3 waits on Cisco's choice. Read CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-23-r3-recovery.md, docs/handoffs/2026-09-23-r3-r5-approval.md.

Check git state and whether PR #7 and the fix PR are merged. If the fix PR is open, read Codex's inline comments (gh api repos/FCisco95/hyphae/pulls/<n>/comments) and address them test-first. If Cisco chose F3 option 1 with a written yes for 0005, build it test-first (nullable reward_decisions.notified_at; notifyReward sets it; sweep part (c)). Gate: pnpm -r test; pnpm -r typecheck; pnpm exec biome check .; pnpm --filter @hyphae/db exec drizzle-kit check; pnpm --filter @hyphae/api test:pg; git diff --check.

After the fixes merge on Cisco's yes: apply 0003/0004 (and 0005 only if approved) to Neon per the approval preconditions, record it. No bootstrap, deploy, R6, settlement/root/claim, fixture or paid runs, Sentinel code or vault edits.
Skills: handoff-memory, receiving-code-review, test-driven-development, supabase-postgres-best-practices, handoff.
```
