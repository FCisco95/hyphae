---
date: 2026-09-23
summary: PR #5 (rulings, R3–R5 scope, approval) and PR #6 (R3) merged by Cisco 2026-09-23; main at 3754534, gate green. Codex's automated review left four open findings (F1–F4). Next session fixes them test-first, then applies migrations 0003/0004. Nothing applied or deployed.
---

# Hyphae handoff

## TL;DR

**R3 MERGED (2026-09-23), four review findings OPEN.** `main` = `3754534` (PR #6 R3; PR #5 docs at `6b7a24d`). Cisco merged both in-session. **No independent review verdict was recorded.** Codex's automated review of PR #6 left F1–F3, and one PR #5 finding (F4) is also unaddressed; see `docs/handoffs/2026-09-23-r3-merged.md`. **Next session:** fix F1–F4 test-first on `fix/r3-recovery`, then apply 0003/0004 to Neon (authorized), with no bootstrap and no deploy. A durable notification marker (F3) needs migration 0005, which needs Cisco's yes.

## Metadata

- Last Updated: 2026-09-23 (session end). Snapshots: `docs/handoffs/2026-09-23-r3-merged.md` (merge + open findings), `2026-09-23-r3-implemented.md` (R3), `2026-09-23-tomorrow-plan.md` (Sep 24 docs plan).
- Branches (verified at session end): `main` = `origin/main` = `3754534`. PR #5 and PR #6 merged 2026-09-23 18:00 UTC; their branches deleted locally and on origin. This handoff rides on `docs/2026-09-23-r3-merged`.
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows, 2026-09-23. Requested Fable 5.1 xhigh or Astra xhigh; neither ran. Effort not observable in-session.
- Authority: O1–O7 (`2026-09-20-h-design-written-approval.md`); schedule rulings (`2026-09-23-schedule-rulings.md`); R3–R5 approval (`2026-09-23-r3-r5-approval.md`).
- Canonical private plan: read, not edited. Organic-sync owns updating it with today's rulings, approval and R3 state.

## Current Objective

Fix open findings F1–F4 test-first, then apply migrations 0003/0004 per the approval preconditions. The findings table and suggested fix shape are in `docs/handoffs/2026-09-23-r3-merged.md`.

## Current State

- R3 on `main` (not deployed): payload v2 pins the `reward-eval/1` prompt by template hash; migration 0004 adds slots, nominations, retrievals, dispatches, decisions with the O2 bounds as constraints; `/submit` routes legacy vs reward lane; `/effort` nominates explicitly; fenced dispatch with `maxRetries: 0`, reconciliation instead of repeats, operator `reward-reconcile.ts`; atomic completion and consumption; three pg-boss queues (`reward-evaluation`, `reward-retrieval`, `reward-notify`).
- R2 review observations: 1, 3, 4, 5 resolved in R3 (lock mode proven on real Postgres); 2 and 6 belong to R5.
- Founder rulings: mainnet payout committed; public audit page wins a time tradeoff; verified wallet linking before paying real testers; Lab-controlled wallet for devnet (A); combined approval, sequential stages (B).
- Production unchanged: Neon has migrations 0000–0002 only (last recorded Sep 17; not re-checked); the deployed bot runs the Sep 17 path.

## Recent Changes

2026-09-23 (session end): Cisco merged PR #5 (`6b7a24d`) and PR #6 (`3754534`); Codex's automated review findings recorded as F1–F4; merged branches deleted; gate green on `main`.

2026-09-23: branch cleanup; fresh gate at `dc261c7`; rulings, R3–R5 proposal and tomorrow plan (PR #5); written approval recorded (`8650383`); R3 built test-first (`f4fd68e`..`7992bb2`); R3 record, build log and this handoff.

2026-09-22: R2 reviewed ACCEPT and merged (PR #2, `336d48d`); docs PRs #3 and #4 merged.

## Validation

Fresh at session end on `main` `3754534`: `pnpm -r test` exit 0 (core 54, api 144); `pnpm -r typecheck` exit 0; `pnpm exec biome check .` exit 0 (95 files); `drizzle-kit check` exit 0. `test:pg` passed on `773b771` (same code), not re-run on the merge commit. Mutation probes: 6 of 7 killed; the survivor was removed.

## Known Issues / Watch List

- No CI. The native gate, `test:pg` and an independent review are the evidence.
- **Open review findings F1–F4** (`2026-09-23-r3-merged.md`): reconcile script never re-queues; admission-then-queue gap; notification lost on crash; task close unchecked at admission.
- `main` must not be deployed before 0003 and 0004 are applied (approved; check zero MYCEL epochs and a 0000–0002 journal first).
- Withdrawing a new-work nomination leaves that artifact without an ordinary quality score; no bot withdraw command exists yet.
- `/me` still sums legacy `scoring_runs` (R4). BotFather menu lacks `/effort` (manual step at cutover).
- Live Telegram, oEmbed and provider paths are exercised only through injected fakes.
- Codex CLI sandbox on this machine fails with `apply deny-read ACLs`; use `codex --sandbox danger-full-access` for a review session.
- Bash tool heredocs occasionally fail to parse long Python patches ("unexpected EOF"); use the Write/Edit tools or a `PYEOF` delimiter.

## Next Actions

1. `fix/r3-recovery` from `main`, test-first: F4 (task close/status inside `admitContribution`), F1+F2+F3 via one idempotent recovery sweep job. If F3 needs a notified marker (migration 0005), stop and get Cisco's yes first.
2. Review the fix (a fresh session or Codex), merge on Cisco's yes.
3. Apply 0003/0004 (and 0005 only if approved) to Neon per the approval preconditions; record it in a dated handoff. No bootstrap, no deploy.
4. Sep 24 docs per `2026-09-23-tomorrow-plan.md` (R3 = merged, locally tested, not deployed).
5. R4 on `feat/r4-effective-reads` after the fixes merge.

## Quick Reference

- Open findings: `docs/handoffs/2026-09-23-r3-merged.md`
- R3 record: `docs/handoffs/2026-09-23-r3-implemented.md`
- Approval: `docs/handoffs/2026-09-23-r3-r5-approval.md`; scope: `2026-09-23-r3-r5-scope-proposal.md`; rulings: `2026-09-23-schedule-rulings.md`
- R3 code: `packages/core/src/reward-eval.ts`; `apps/api/src/rewards/{slots,evaluation,submission,staging}.ts`; `apps/api/src/jobs/{reward-jobs,reward-message}.ts`; `apps/api/src/bot/commands/{submit,effort}.ts`; `packages/db/drizzle/0004_reward_slots_dispatch.sql`
- Real-Postgres gate: `apps/api/scripts/test-pg.sh`, `apps/api/src/rewards/concurrency.pg.test.ts`
- Operator script: `apps/api/scripts/reward-reconcile.ts <dispatch-id> not-sent --reason "<evidence>"`

## Suggested skills

`handoff-memory` (resume), `superpowers:receiving-code-review` (F1–F4), `code-review` or a Codex session (fix review), `superpowers:test-driven-development` (R4), `supabase:supabase-postgres-best-practices` (migration apply), `humanizer` (whitepaper), `handoff`.

## Resume Checklist

- `git fetch --prune && git status -sb`; confirm `main` ≥ `3754534` and whether the `docs/2026-09-23-r3-merged` PR is merged.
- Run the native gate and `pnpm --filter @hyphae/api test:pg` (Docker must be running).
- F1–F4 before the migration apply and before R4. R4 and R5 only after the preceding stage merges; no bootstrap, deploy, R6, settlement/root/claim, fixture or paid runs, Sentinel code or vault edits.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Schedule rulings, R3–R5 proposal, tomorrow plan, approval | `docs/handoffs/2026-09-23-*.md` | PR #5 |
| R3 code and migration 0004 | `feat/r3-slots-dispatch` | Not applied, not deployed |
| R3 record | `docs/handoffs/2026-09-23-r3-implemented.md` | Evidence, deviations, gaps |
| Build log | `docs/BUILDLOG.md` | Three 2026-09-23 entries |
| Merge snapshot + open findings | `docs/handoffs/2026-09-23-r3-merged.md` | F1–F4, fix shape |

No credentials, deployed resources, scheduled jobs or Neon changes. Docker test containers are removed by `test-pg.sh` on exit.

## Next-session prompt

```text
Resume Hyphae. R3 is merged to main (3754534, PR #6) but Codex's automated review left four open findings. Read CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-23-r3-merged.md (findings F1-F4 and fix shape), docs/handoffs/2026-09-23-r3-implemented.md, docs/handoffs/2026-09-23-r3-r5-approval.md.

Check git state first. Branch fix/r3-recovery from main and fix F1-F4 test-first: F4 task close/status inside admitContribution under the lock; F1-F3 via one idempotent recovery sweep job. If F3 needs a durable notified marker (migration 0005), stop and ask Cisco first; the approval covers only 0003/0004. Gate: pnpm -r test; pnpm -r typecheck; pnpm exec biome check . (exit code); pnpm --filter @hyphae/db exec drizzle-kit check; pnpm --filter @hyphae/api test:pg (Docker).

After the fix merges on Cisco's yes: apply 0003/0004 to Neon per the approval preconditions (zero MYCEL epochs, journal 0000-0002), record it. No bootstrap, deploy, R6, settlement/root/claim, fixture or paid runs, Sentinel code or vault edits.
Model: Fable 5.1 xhigh preferred; record what actually runs.
Skills: handoff-memory, receiving-code-review, test-driven-development, supabase-postgres-best-practices, handoff.
```
