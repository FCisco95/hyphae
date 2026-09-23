---
date: 2026-09-23
summary: F1, F2 and F4 are merged (PR #9); the public docs are merged (PR #8). F3 is fixed on fix/r3-f3-notified with migration 0005 (approved in writing by Cisco), and its PR is open. Next: merge on Cisco's yes, then apply 0003–0005 to Neon in one run. Nothing applied or deployed.
---

# Hyphae handoff

## TL;DR

**All four R3 review findings are fixed; F3's fix awaits merge.** `main` = `68091d5` (PRs #7, #9 and #8 merged 2026-09-23). The F3 branch `fix/r3-f3-notified` (`26f51bc`) adds migration 0005, a nullable `reward_decisions.notified_at`, which Cisco approved in writing ("Yes, add 0005"). **Next:** review and merge the F3 PR on Cisco's yes, then apply 0003, 0004 and 0005 to Neon in one run per `docs/handoffs/2026-09-23-f3-notified.md`. No bootstrap, no deploy.

## Metadata

- Last Updated: 2026-09-23 (night). Snapshots: `docs/handoffs/2026-09-23-f3-notified.md` (approval, F3 fix, apply preconditions), `2026-09-23-r3-recovery.md` (F1/F2/F4), `2026-09-23-r3-merged.md` (findings).
- Branches: `main` = `origin/main` = `68091d5`. `fix/r3-f3-notified` is pushed with a PR against `main`. Merged branches are deleted.
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows, 2026-09-23. Effort is not observable in-session.
- Authority: O1–O7 (`2026-09-20-h-design-written-approval.md`); schedule rulings; R3–R5 approval (`2026-09-23-r3-r5-approval.md`); migration 0005 approval (`2026-09-23-f3-notified.md`).
- Canonical private plan: not read or edited this session.

## Current Objective

Merge the F3 fix, then apply migrations 0003–0005 to Neon per the preconditions in `2026-09-23-f3-notified.md`.

## Current State

- On `main` (not deployed): R3 plus the recovery fixes. Admission refuses closed tasks. A 5-minute `reward-recovery` sweep re-queues stranded intakes, ready nominations, missing retrieval rounds and stuck dispatches.
- On `fix/r3-f3-notified` (not merged): `notifyReward` skips decisions already marked and marks them after Telegram accepts; sweep part (c) resends unmarked decisions after a 10-minute grace, for up to 24 h. Delivery is at least once.
- Public docs on `main`: `docs/WHITEPAPER.md`, `docs/TESTING.md`, `docs/demo/2026-09-25-weekly-video-2.md`.
- Production unchanged: Neon has migrations 0000–0002 only (last recorded Sep 17; not re-checked); the deployed bot runs the Sep 17 path.

## Recent Changes

2026-09-23 (night): PRs #7, #9 and #8 merged; Cisco approved 0005; F3 fixed (`26f51bc`); record `2026-09-23-f3-notified.md`; build log.

2026-09-23 (late): F4 `25cd7b4`, recovery sweep `4d0bd4d` (PR #9); public docs `5f2c27e` (PR #8).

2026-09-23: R3 merged (PR #6); findings F1–F4 recorded (PR #7).

## Validation

Fresh on `26f51bc`: `pnpm -r test` exit 0 (core 54, api 163); `pnpm -r typecheck` exit 0; `pnpm exec biome check .` exit 0 (98 files); `drizzle-kit check` exit 0; `test:pg` 4/4 exit 0; `git diff --check` exit 0. Mutation probes on the F3 code: 5 of 5 killed.

## Known Issues / Watch List

- The worker wiring (`recoverRewardWork`, `boss.schedule`, the notify marker) has never run against pg-boss; its first real run is at cutover. Check that the worker log shows a `reward-recovery` line about every 5 minutes.
- A decision's message can be sent twice (crash after Telegram accepts, before the mark). It is abandoned after 24 h of refusals.
- `main` must not be deployed before 0003–0005 are applied.
- No CI. The native gate, `test:pg` and an independent review are the evidence.
- `/me` still sums legacy `scoring_runs` (R4). The BotFather menu lacks `/effort` and still lists `/propose` and `/rubric`, which aren't built. No bot withdraw command.
- Live Telegram, oEmbed and provider paths are exercised only through injected fakes.
- Cross-session messages to a background session in a different permission mode are held for the user's approval and expire when nobody approves them.

## Next Actions

1. Review the F3 PR and merge it on Cisco's yes.
2. Apply 0003, 0004 and 0005 to Neon in one run per `2026-09-23-f3-notified.md` (zero epochs, journal 0000–0002, Drizzle migrator from the merge commit), and record it. No bootstrap, no deploy.
3. R4 on `feat/r4-effective-reads` (effective reads, epoch-scoped `/me`, operator corrections).
4. Weekly video #2 on Friday per `docs/demo/2026-09-25-weekly-video-2.md`.

## Quick Reference

- F3 fix: `apps/api/src/rewards/recovery.ts` (`strandedWork` part (c), `decisionNotified`, `markNotified`), `apps/api/src/jobs/reward-jobs.ts`, `packages/db/drizzle/0005_reward_decision_notified.sql`
- Apply preconditions: `docs/handoffs/2026-09-23-f3-notified.md`
- Real-Postgres gate: `apps/api/scripts/test-pg.sh`
- Operator script: `apps/api/scripts/reward-reconcile.ts <dispatch-id> not-sent --reason "<evidence>"`

## Suggested skills

`handoff-memory` (resume), `superpowers:receiving-code-review` (F3 PR), `supabase:supabase-postgres-best-practices` (migration apply), `superpowers:test-driven-development` (R4), `handoff`.

## Resume Checklist

- `git fetch --prune && git status -sb`; check whether the F3 PR is merged.
- Run the native gate and `pnpm --filter @hyphae/api test:pg` (Docker must be running).
- Apply the migrations only after the F3 PR merges, and only in one run.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Public docs | `docs/WHITEPAPER.md`, `docs/TESTING.md`, `docs/demo/2026-09-25-weekly-video-2.md` | Merged (PR #8) |
| Review of PR #9 | PR #9 comment | Gate re-run, no blockers |
| F3 fix + migration 0005 | `fix/r3-f3-notified` (`26f51bc`) | Not merged, not applied |
| Approval + F3 record | `docs/handoffs/2026-09-23-f3-notified.md` | |
| Build log | `docs/BUILDLOG.md` | 2026-09-23 (night) entry |

No credentials, deployed resources, Neon changes or live scheduled jobs.

## Next-session prompt

```text
Resume Hyphae. All four R3 review findings are fixed. F1, F2 and F4 are on main (68091d5). F3 (migration 0005, notified_at) is on fix/r3-f3-notified with an open PR. Read CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-23-f3-notified.md.

Check git state and whether the F3 PR is merged. If it's open, read Codex's inline comments and address them test-first. Once merged on Cisco's yes: re-run the gate on the merge commit (pnpm -r test; pnpm -r typecheck; pnpm exec biome check .; pnpm --filter @hyphae/db exec drizzle-kit check; pnpm --filter @hyphae/api test:pg). Then run the read-only checks: zero epochs, and a journal showing 0000-0002. Apply 0003-0005 in one Drizzle migrator run and record it in a dated handoff. Then start R4 on feat/r4-effective-reads test-first.
Out of bounds: bootstrap, deploy, R6, settlement/root/claim, fixture or paid runs, Sentinel code, vault edits.
Skills: handoff-memory, receiving-code-review, supabase-postgres-best-practices, test-driven-development, handoff.
```
