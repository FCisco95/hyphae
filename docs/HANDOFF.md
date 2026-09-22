---
date: 2026-09-22
summary: R2 (pinned reward configuration and epoch admission) implemented on feat/r2-pinned-config at ddb2776 after written authorization; native gate green; migration generated but not applied; no production caller. Awaits review and PR merge. R3–R6 gated.
---

# Hyphae H-DESIGN handoff

## TL;DR

**R1 status: ACCEPTED (2026-09-21).** PR #1 merged to `main` at `aebb147`.

**R2 status: IMPLEMENTED, AWAITING REVIEW (2026-09-22).** Cisco answered yes to all five decisions in `docs/handoffs/2026-09-21-r2-scope-proposal.md`; the implementation is `ddb2776` on `feat/r2-pinned-config` with 33 new tests, and the native gate is green. Production behavior is unchanged: `/submit`, the score job and `/me` are untouched, migration 0003 is generated but **not applied to Neon**, and nothing calls admission yet. Record: `docs/handoffs/2026-09-22-r2-implemented.md`. Next: independent review of the PR, merge, then a separately scoped R3.

## Metadata

- Last Updated: 2026-09-22.
- Branch: `feat/r2-pinned-config` from `main` `aebb147`. Commits: `a6028b3` (proposal docs), `ddb2776` (implementation + tests), plus this docs checkpoint. PR #2 to `main` opened from this session.
- Runner: Claude Code, Fable 5.1 (`claude-fable-5-1`), effort xhigh, Windows, 2026-09-22. Read the repo and the private plan; wrote only under `docs/`, `packages/db`, `apps/api/src/rewards`, `apps/api/scripts`, `apps/api/package.json`, `pnpm-lock.yaml`. No Neon command, deploy, model call, fixture run or vault edit.
- Authority: `docs/handoffs/2026-09-20-h-design-written-approval.md` (O1–O7); R2 scope authorization given in-session 2026-09-22 against the proposal document.
- Canonical queue: `cisco-brain/10 - PROJECTS/Organic/plans/2026-09-16-hyphae-implementation-plan.md` (private; unchanged this session).
- Evidence stage: deterministic tests (pure + PGlite in-process Postgres), typecheck, Biome, diff check. No integration against Neon or deployed behavior.

## Current Objective

Get R2 reviewed and merged. Then organic-sync post-ship records R1 accepted, R2 scoped and implemented, and the proposed Week 2–4 calendar rebaseline (last section of the proposal; not applied).

## Current State

- R1 unchanged: `packages/core/src/reward-points.ts` and tests as merged.
- R2 schema: `reward_configs` (insert-only bundles, unique on community + digest), `reward_config_proposals` (one pending per community via partial unique index; statuses pending/activated/superseded/cancelled), `reward_intakes` (unique on contribution, community + artifact key, community + idempotency key), `epochs.reward_config_id` (null = legacy, cannot admit), `communities.reward_intake_paused_at`.
- R2 config module: payload v1 tied to R1 constants (floor 60, caps 79/40, hard-zero flags, units per point, u64 max) with timing milliseconds validated against rubric minutes; `earliestActivationEpoch(k, a) = max(k+1, a+2)`; contiguous materialization up to "now" only; bootstrap at an explicit future whole-second `opensAt` counts as activation 1; propose supersedes the pending row and rejects a no-op; cancel keeps `a`; pause is a column, not a config change.
- R2 intake module: idempotency → pause → epoch (half-open, `closesAt` belongs to the next) → legacy pin → task opening → artifact duplicate → insert contribution + intake with `acceptedAt` from the DB clock read after the community row lock.
- Scripts: `set-rubric.ts` still updates the staging rubric (legacy score job and `/raid` read it) and now records a proposal, bootstraps with `--activate-at`, cancels with `--cancel`; `reward-intake.ts <mint> pause|resume`.
- `Db` type in `@hyphae/db` is now the generic `PgDatabase`, so PGlite tests and postgres-js production share the same functions.

## Recent Changes

2026-09-22: R2 scope proposal written and committed (`a6028b3`); Cisco authorized all five decisions; R2 implemented test-first (`ddb2776`): schema + migration 0003, `rewards/config.ts`, `rewards/intake.ts`, `test-db.ts`, 33 tests, two scripts, `@electric-sql/pglite` dev dependency, `pnpm dedupe` to keep one `drizzle-orm` instance. Docs checkpoint follows.

2026-09-21: R1 accepted after independent re-review of `3f9a5dd`; PR #1 merged.

## Validation

2026-09-22 native gate (this session):

- `pnpm -r test` — core: 5 files, 41 tests; api: 10 files, 76 tests (33 new in `src/rewards`). All passed.
- `pnpm -r typecheck` — core, db, api passed.
- `pnpm exec biome check .` — 75 files, no fixes.
- `git diff --check` — clean.
- Both new test files were run and failed before the implementation existed (missing module / tables), then passed unchanged.

2026-09-21 native gate — core 41 tests, typecheck, Biome (68 files) green at `2fd2470`.

## Known Issues / Watch List

- No CI. PR merge is a manual gate; the native gate above is the only evidence.
- Migration 0003 is not applied to Neon. Applying it, bootstrapping MYCEL and resuming intake are a separate authorized cutover (checklist in the R2 record).
- PGlite is single-connection: concurrent-writer races are proven by unique indexes and the lock discipline, not by a live race. R3's dispatch fencing needs a real-Postgres concurrency check.
- pnpm may re-split `drizzle-orm` into two instances when a driver peer changes; symptom is a typecheck failure on `Column` class identity. Fix: `pnpm dedupe`.
- A no-op `set-rubric` proposal ends with the thrown error after the staging rubric update; the reward lane is unchanged.
- Codex CLI sandbox on this Windows machine still fails with `apply deny-read ACLs`; start it with `codex --sandbox danger-full-access` for a review session.
- R3–R5 remain sequential; R6 waits on H-CONTRACT and payment gates. Effective-decision reads, timing computation from `intake.acceptedAt`, and multiplier selection are R3/R4 caller work.

## Next Actions

1. Independent review of PR #2 (`feat/r2-pinned-config` → `main`), focus: lock/clock ordering in `withCommunityLock`, materialization loop, admission guards, migration SQL. Merge on ACCEPT.
2. Organic-sync post-ship: record R1 accepted 2026-09-21, R2 scoped and implemented 2026-09-22 (link the proposal and `docs/handoffs/2026-09-22-r2-implemented.md`), and the proposed calendar rebaseline as a proposal. Canonical application unverified.
3. R3 (slots, candidates, dispatch fencing, nomination adapter, `/submit` rewire) needs its own scope document and written authorization. No settlement, root, claim, fixture or paid run.

## Quick Reference

- R2 record: `docs/handoffs/2026-09-22-r2-implemented.md`
- R2 scope (authorized): `docs/handoffs/2026-09-21-r2-scope-proposal.md`
- R2 code: `apps/api/src/rewards/config.ts`, `intake.ts`, `test-db.ts`, tests; `packages/db/src/schema.ts`; `packages/db/drizzle/0003_reward_config_intake.sql`
- Scripts: `apps/api/scripts/set-rubric.ts`, `apps/api/scripts/reward-intake.ts`
- R1 acceptance: `docs/handoffs/2026-09-21-r1-accepted.md`
- Approved rules: `docs/handoffs/2026-09-20-h-design-operational-definitions.md`

## Suggested skills

`handoff-memory`, `superpowers:test-driven-development`, `handoff`. For the review: `code-review`. Database/security guidance applies to R3+.

## Resume Checklist

- `git checkout feat/r2-pinned-config` (or `main` once merged) and confirm `ddb2776` is present.
- Run the native gate before trusting anything: `pnpm -r test`, `pnpm -r typecheck`, `pnpm exec biome check .`.
- Stay within explicit authorization; no R3–R6, Neon migration apply, callers, fixtures/paid runs, settlement, root or payment work.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| R2 scope proposal | `docs/handoffs/2026-09-21-r2-scope-proposal.md` | Authorized in-session; unchanged after authorization |
| R2 implementation record | `docs/handoffs/2026-09-22-r2-implemented.md` | Deviations, evidence, cutover checklist |
| R2 code, migration, tests, scripts | see Quick Reference | `ddb2776` |
| Current handoff | `docs/HANDOFF.md` | This file |
| Public build log | `docs/BUILDLOG.md` | 2026-09-22 entry |

No credentials, deployed resources or scheduled jobs created. Migration not applied.

## Next-session prompt

```text
Resume Hyphae. R2 (pinned reward configuration and admission) is implemented at ddb2776 on feat/r2-pinned-config and awaits review/merge into main; R1 is merged at aebb147. Not hackathon/r1-exact-reward-points and not sync/mac-handoff-2026-09-19. The repo has no CI; the native gate (pnpm -r test, pnpm -r typecheck, biome check .) is the only evidence. Migration 0003 is generated, not applied to Neon.

Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-22-r2-implemented.md, docs/handoffs/2026-09-21-r2-scope-proposal.md, apps/api/src/rewards/config.ts, apps/api/src/rewards/intake.ts, packages/db/src/schema.ts
Model: Fable 5.1 xhigh or Opus-class xhigh; record actual session metadata.
Skills: handoff-memory, code-review, handoff.

If the task is review: review the R2 PR against the proposal and O2–O4, run the native gate, report ACCEPT or findings; do not start R3. If the task is R3: stop and write an R3 scope proposal for written authorization first. No Neon apply, callers, fixtures/paid runs, settlement, root or payment work without explicit authorization.
```
