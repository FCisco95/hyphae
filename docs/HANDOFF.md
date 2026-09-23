---
date: 2026-09-23
summary: R3–R5 scope approved in writing; R3 implemented test-first on feat/r3-slots-dispatch (7 code commits), native gate green (core 54, api 144) plus a new real-Postgres test:pg gate (4 tests, 50-round races). Awaiting independent review and Cisco's yes to merge; then apply migrations 0003/0004 (no bootstrap, no deploy). R4/R5 wait for the R3 merge.
---

# Hyphae handoff

## TL;DR

**R3 IMPLEMENTED, awaiting independent review (2026-09-23).** Branch `feat/r3-slots-dispatch`, record `docs/handoffs/2026-09-23-r3-implemented.md`. R3–R5 scope approved by Cisco the same day ("yes to all nine + A + B + apply 0003/0004 after R3 merge", `docs/handoffs/2026-09-23-r3-r5-approval.md`). Nothing merged, applied or deployed. Next: review → Cisco's yes → merge → apply 0003 and 0004 to Neon → R4.

## Metadata

- Last Updated: 2026-09-23 (evening). Snapshots: `docs/handoffs/2026-09-23-r3-implemented.md` (R3), `2026-09-23-tomorrow-plan.md` (Sep 24 docs plan).
- Branches (verified this session): `main` = `origin/main` = `dc261c7`. `docs/2026-09-23-scope-checkpoint` → PR #5 (rulings, R3–R5 proposal, approval, tomorrow plan; docs only; open). `feat/r3-slots-dispatch` is based on that docs branch, so its PR shows the docs commits until PR #5 merges; merge PR #5 first. `docs/r2-merged-snapshot` deleted locally and on origin after confirming it was merged.
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows, 2026-09-23. Requested Fable 5.1 xhigh or Astra xhigh; neither ran. Effort not observable in-session.
- Authority: O1–O7 (`2026-09-20-h-design-written-approval.md`); schedule rulings (`2026-09-23-schedule-rulings.md`); R3–R5 approval (`2026-09-23-r3-r5-approval.md`).
- Canonical private plan: read, not edited. Organic-sync owns updating it with today's rulings, approval and R3 state.

## Current Objective

Independent review of the R3 PR. Then merge on Cisco's yes and apply migrations 0003 and 0004 per the approval preconditions.

## Current State

- R3 on the branch: payload v2 pins the `reward-eval/1` prompt by template hash; migration 0004 adds slots, nominations, retrievals, dispatches, decisions with the O2 bounds as constraints; `/submit` routes legacy vs reward lane; `/effort` nominates explicitly; fenced dispatch with `maxRetries: 0`, reconciliation instead of repeats, operator `reward-reconcile.ts`; atomic completion and consumption; three pg-boss queues (`reward-evaluation`, `reward-retrieval`, `reward-notify`).
- R2 review observations: 1, 3, 4, 5 resolved in R3 (lock mode proven on real Postgres); 2 and 6 belong to R5.
- Founder rulings: mainnet payout committed; public audit page wins a time tradeoff; verified wallet linking before paying real testers; Lab-controlled wallet for devnet (A); combined approval, sequential stages (B).
- Production unchanged: Neon has migrations 0000–0002 only (last recorded Sep 17; not re-checked); the deployed bot runs the Sep 17 path.

## Recent Changes

2026-09-23: branch cleanup; fresh gate at `dc261c7`; rulings, R3–R5 proposal and tomorrow plan (PR #5); written approval recorded (`8650383`); R3 built test-first (`f4fd68e`..`7992bb2`); R3 record, build log and this handoff.

2026-09-22: R2 reviewed ACCEPT and merged (PR #2, `336d48d`); docs PRs #3 and #4 merged.

## Validation

Fresh this session, R3 tip before the docs-base rebase (`adef9f6`, code identical to `7992bb2`):

- `pnpm -r test` exit 0 — core 54 tests (6 files), api 144 tests (15 files).
- `pnpm -r typecheck` exit 0. `pnpm exec biome check .` exit 0, 95 files, no warnings. `drizzle-kit check` exit 0. `git diff --check` clean. api build succeeded.
- `pnpm --filter @hyphae/api test:pg` (local Docker `postgres:17`, never Neon): 4 passed; fails if the lock mode reverts to `FOR UPDATE`.
- Mutation probes: 6 of 7 killed; the survivor (a redundant fence check) was removed.
- Re-run after the rebase and docs commit: recorded in the PR description.

## Known Issues / Watch List

- No CI. The native gate, `test:pg` and an independent review are the evidence.
- After R3 merges, `main` must not be deployed before 0003 and 0004 are applied (approved; check zero MYCEL epochs and a 0000–0002 journal first).
- Withdrawing a new-work nomination leaves that artifact without an ordinary quality score; no bot withdraw command exists yet.
- `/me` still sums legacy `scoring_runs` (R4). BotFather menu lacks `/effort` (manual step at cutover).
- Live Telegram, oEmbed and provider paths are exercised only through injected fakes.
- Codex CLI sandbox on this machine fails with `apply deny-read ACLs`; use `codex --sandbox danger-full-access` for a review session.
- Bash tool heredocs occasionally fail to parse long Python patches ("unexpected EOF"); use the Write/Edit tools or a `PYEOF` delimiter.

## Next Actions

1. Cisco: merge PR #5 (docs only).
2. Independent review of the R3 PR (cross-family preferred), against the proposal's R3 section and `2026-09-23-r3-implemented.md`, including its deviations and known gaps.
3. Cisco's yes → merge R3. Then apply 0003 and 0004 per the approval preconditions and record it in a dated handoff. No bootstrap, no deploy.
4. Sep 24 docs (whitepaper, demo script, tester checklist) per `2026-09-23-tomorrow-plan.md`; they can now describe R3 as locally tested, not deployed.
5. R4 on `feat/r4-effective-reads` after R3 merges.

## Quick Reference

- R3 record: `docs/handoffs/2026-09-23-r3-implemented.md`
- Approval: `docs/handoffs/2026-09-23-r3-r5-approval.md`; scope: `2026-09-23-r3-r5-scope-proposal.md`; rulings: `2026-09-23-schedule-rulings.md`
- R3 code: `packages/core/src/reward-eval.ts`; `apps/api/src/rewards/{slots,evaluation,submission,staging}.ts`; `apps/api/src/jobs/{reward-jobs,reward-message}.ts`; `apps/api/src/bot/commands/{submit,effort}.ts`; `packages/db/drizzle/0004_reward_slots_dispatch.sql`
- Real-Postgres gate: `apps/api/scripts/test-pg.sh`, `apps/api/src/rewards/concurrency.pg.test.ts`
- Operator script: `apps/api/scripts/reward-reconcile.ts <dispatch-id> not-sent --reason "<evidence>"`

## Suggested skills

`handoff-memory` (resume), `code-review` or a Codex review session (R3 review), `superpowers:receiving-code-review` (fixes), `superpowers:test-driven-development` (R4), `supabase:supabase-postgres-best-practices` (migration apply), `humanizer` (whitepaper), `handoff`.

## Resume Checklist

- `git fetch --prune && git status -sb`; check PR #5 and the R3 PR state.
- Run the native gate and `pnpm --filter @hyphae/api test:pg` (Docker must be running).
- R4 and R5 only after the preceding stage merges. No Neon apply before R3 merges; no bootstrap, deploy, R6, settlement/root/claim, fixture or paid runs, Sentinel code or vault edits.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Schedule rulings, R3–R5 proposal, tomorrow plan, approval | `docs/handoffs/2026-09-23-*.md` | PR #5 |
| R3 code and migration 0004 | `feat/r3-slots-dispatch` | Not applied, not deployed |
| R3 record | `docs/handoffs/2026-09-23-r3-implemented.md` | Evidence, deviations, gaps |
| Build log | `docs/BUILDLOG.md` | Two 2026-09-23 entries |

No credentials, deployed resources, scheduled jobs or Neon changes. Docker test containers are removed by `test-pg.sh` on exit.

## Next-session prompt

```text
Resume Hyphae. Read CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-23-r3-implemented.md, docs/handoffs/2026-09-23-r3-r5-scope-proposal.md (R3 section), docs/handoffs/2026-09-23-r3-r5-approval.md.

Check git and PR state first. If the task is the R3 review: review feat/r3-slots-dispatch against the approved R3 scope, including the five recorded deviations and the known gaps; run pnpm -r test, pnpm -r typecheck, pnpm exec biome check . (exit code), drizzle-kit check, and pnpm --filter @hyphae/api test:pg (Docker). Record a verdict in docs/handoffs; merge only on Cisco's yes. After merge, apply 0003/0004 to Neon only per the approval preconditions; no bootstrap or deploy.

If the task is the Sep 24 docs: follow docs/handoffs/2026-09-23-tomorrow-plan.md; R3 is locally tested, not deployed.

Model: Fable 5.1 xhigh or a different family for review; record what actually runs.
```
