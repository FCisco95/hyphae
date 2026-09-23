---
date: 2026-09-23
summary: All four R3 review findings are merged (PRs #9 and #10), and migrations 0003–0005 are applied to Neon (2026-09-23T22:42:49Z, verified). No bootstrap, no deploy; the Sep 17 bot is still serving. Next: R4 test-first on feat/r4-effective-reads.
---

# Hyphae handoff

## TL;DR

**R3 is complete, and its tables are on Neon.** `main` = `99f7596` (PR #10, F3). All four review findings are merged. Migrations 0003, 0004 and 0005 were applied in one Drizzle run at 2026-09-23T22:42:49Z and verified read-only (`docs/handoffs/2026-09-23-migrations-applied.md`). Nothing writes to the new tables yet: no bootstrap, no deploy. **Next:** R4 on `feat/r4-effective-reads`, test-first.

## Metadata

- Last Updated: 2026-09-23 (midnight). Snapshots: `docs/handoffs/2026-09-23-migrations-applied.md` (Neon apply), `2026-09-23-f3-notified.md` (0005 approval, F3 fix), `2026-09-23-r3-recovery.md` (F1/F2/F4), `2026-09-23-r3-merged.md` (findings).
- Branches: `main` = `origin/main` = `99f7596`, plus this docs branch. Merged branches are deleted.
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows, 2026-09-23. Effort is not observable in-session.
- Authority: O1–O7 (`2026-09-20-h-design-written-approval.md`); schedule rulings; R3–R5 approval (`2026-09-23-r3-r5-approval.md`); migration 0005 approval (`2026-09-23-f3-notified.md`).
- Canonical private plan: not read or edited this session.

## Current Objective

R4 (effective reads and corrections) per `docs/handoffs/2026-09-23-r3-r5-scope-proposal.md`. It follows R3 and needs an independent review before merge.

## Current State

- On `main`, and in Neon's schema (not deployed): R3, the recovery sweep (F1/F2), the task-close check (F4) and the notified marker (F3).
- Neon: migrations 0000–0005; 0 epochs, 1 community, 3 contributions, 6 scoring runs (read 2026-09-23T22:43Z). The reward tables are empty.
- Fly runs the Sep 17 image; `/health` returned 200 after the apply.
- Public docs on `main`: `docs/WHITEPAPER.md`, `docs/TESTING.md`, `docs/demo/2026-09-25-weekly-video-2.md`. The whitepaper's status table still says the R3 findings are "being fixed"; update it at the next docs pass.

## Recent Changes

2026-09-23 (midnight): PR #10 merged (`99f7596`); migrations 0003–0005 applied to Neon and verified; record `2026-09-23-migrations-applied.md`.

2026-09-23 (night): PRs #7, #9 and #8 merged; Cisco approved 0005; F3 fixed (`26f51bc`); record `2026-09-23-f3-notified.md`.

2026-09-23 (late): F4 `25cd7b4`, recovery sweep `4d0bd4d` (PR #9); public docs `5f2c27e` (PR #8).

2026-09-23: R3 merged (PR #6); findings F1–F4 recorded (PR #7).

## Validation

Fresh on the merge commit `99f7596`: `pnpm -r test` exit 0 (core 54, api 163); `pnpm -r typecheck` exit 0; `pnpm exec biome check .` exit 0 (98 files); `drizzle-kit check` exit 0; `test:pg` 4/4 exit 0. Neon checked read-only before and after the apply.

## Known Issues / Watch List

- Deploying `main` is a separate cutover step: deploy, bootstrap MYCEL's reward config and first epoch, update the BotFather menu (add `/effort`; `/propose` and `/rubric` are listed but not built), and confirm a `reward-recovery` line in the worker log about every 5 minutes. Not authorized yet.
- The worker wiring (recovery sweep, notify marker) has never run against pg-boss.
- A decision's message can be sent twice (a crash after Telegram accepts but before the mark). After 24 h of refusals it's abandoned.
- No CI. The native gate, `test:pg` and an independent review are the evidence.
- `/me` still sums legacy `scoring_runs` (R4 fixes this). No bot withdraw command.
- Live Telegram, oEmbed and provider paths are exercised only through injected fakes.
- The drizzle-kit apply prints a `pg` SSL-mode deprecation warning; harmless today.
- Cross-session messages to a background session running in a different permission mode wait for the user's approval, and expire if nobody approves them.

## Next Actions

1. R4 on `feat/r4-effective-reads` from `main`, test-first:
   - an effective-decision read (upgrade selects 255, not 85 + 255; superseded, late and legacy runs ignored)
   - `/me` for the current epoch only
   - append-only operator corrections with an expected-predecessor check (script only, no route)
   - `totalEntries` and `closed` per the scope proposal
   - concurrent corrections tested as a `test:pg` race
2. Independent review of R4, then merge on Cisco's yes. R5 after that.
3. Weekly video #2 on Friday per `docs/demo/2026-09-25-weekly-video-2.md`.
4. Cutover (deploy + bootstrap) only when Cisco authorizes it separately.

## Quick Reference

- Neon apply record: `docs/handoffs/2026-09-23-migrations-applied.md`
- R4 scope: `docs/handoffs/2026-09-23-r3-r5-scope-proposal.md` (R4 section)
- Recovery and notify: `apps/api/src/rewards/recovery.ts`, `apps/api/src/jobs/reward-jobs.ts`
- Real-Postgres gate: `apps/api/scripts/test-pg.sh`
- Operator script: `apps/api/scripts/reward-reconcile.ts <dispatch-id> not-sent --reason "<evidence>"`

## Suggested skills

`handoff-memory` (resume), `superpowers:test-driven-development` (R4), `superpowers:receiving-code-review` (R4 PR), `supabase:supabase-postgres-best-practices` (correction queries), `handoff`.

## Resume Checklist

- `git fetch --prune && git status -sb`; `main` ≥ `99f7596`.
- Run the native gate and `pnpm --filter @hyphae/api test:pg` (Docker must be running).
- R4 only. No deploy or bootstrap, no R5 before R4 merges, no R6, settlement/root/claim or paid runs.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Public docs | `docs/WHITEPAPER.md`, `docs/TESTING.md`, `docs/demo/2026-09-25-weekly-video-2.md` | Merged (PR #8) |
| Review of PR #9 | PR #9 comment | Gate re-run, no blockers |
| F3 fix + migration 0005 | PR #10, merged `99f7596` | Applied to Neon |
| 0005 approval + F3 record | `docs/handoffs/2026-09-23-f3-notified.md` | |
| Neon apply record | `docs/handoffs/2026-09-23-migrations-applied.md` | 0003–0005 applied, verified |
| Build log | `docs/BUILDLOG.md` | 2026-09-23 (night) and (midnight) entries |

One Neon change (migrations 0003–0005, recorded). No credentials, deployments or live scheduled jobs.

## Next-session prompt

```text
Resume Hyphae. R3 is complete: all four review findings are merged (main 99f7596), and migrations 0000-0005 are on Neon (applied 2026-09-23; see docs/handoffs/2026-09-23-migrations-applied.md). Nothing is deployed or bootstrapped. Read CLAUDE.md, docs/HANDOFF.md, and the R4 section of docs/handoffs/2026-09-23-r3-r5-scope-proposal.md.

Build R4 on feat/r4-effective-reads from main, test-first:
- one effective-decision read: an upgrade gives 255, not 85 + 255; superseded, late and legacy runs are ignored; totalEntries counts pending and zero entries; closed flips exactly at closesAt
- /me for the current epoch only
- append-only corrections through an operator script with an expected-predecessor check; concurrent corrections yield one successor, tested as a test:pg race
Gate: pnpm -r test; pnpm -r typecheck; pnpm exec biome check .; pnpm --filter @hyphae/db exec drizzle-kit check; pnpm --filter @hyphae/api test:pg; git diff --check. Open a PR, read Codex's inline comments, and merge only on Cisco's yes.
Out of bounds: deploy, bootstrap, R5 before R4 merges, R6, settlement/root/claim, fixture or paid runs, Sentinel code, vault edits.
Skills: handoff-memory, test-driven-development, receiving-code-review, supabase-postgres-best-practices, handoff.
```
