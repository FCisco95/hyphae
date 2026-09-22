---
date: 2026-09-22
summary: R2 (pinned reward configuration and epoch admission) reviewed ACCEPT at bcdb328 and merged to main at 336d48d on Cisco's in-session yes (2026-09-22) after Codex's two P2 findings plus one same-class finding were fixed test-first; native gate green; migration generated but not applied; no production caller. R3–R6 gated.
---

# Hyphae H-DESIGN handoff

## TL;DR

**R1 status: ACCEPTED (2026-09-21).** PR #1 merged to `main` at `aebb147`.

**R2 status: MERGED (2026-09-22).** PR #2 merged to `main` at `336d48d` on Cisco's in-session yes; merge tree identical to the reviewed `d24ceef`. Implementation `ddb2776` plus three review-session commits (`37a2cca` Codex P2 fixes, `e81fa98` foreign-member guard, `bcdb328` formatting). Independent review verdict ACCEPT with six non-blocking observations, recorded in `docs/handoffs/2026-09-22-r2-review.md` and as a review comment on PR #2. Production behavior unchanged: `/submit`, the score job and `/me` untouched, migration 0003 generated but **not applied to Neon**, nothing calls admission. Next: organic-sync post-ship → R3 scope proposal.

## Metadata

- Last Updated: 2026-09-22 (review session closed). Session snapshot: `docs/handoffs/2026-09-22-r2-merged.md`, delivered by a follow-up docs PR after PR #3 merged.
- Branch: `main` at `9bc0464` = `origin/main` (PR #3 docs refresh on top of the PR #2 merge `336d48d`, head `d24ceef`). `feat/r2-pinned-config` deleted locally and on origin. The session-end snapshot rides on `docs/r2-merged-snapshot` (follow-up docs PR).
- Runner (this session): Claude Code, Fable 5.1 (`claude-fable-5-1`), Windows, 2026-09-22. Effort not readable from inside the session; requested xhigh. Wrote only under `apps/api/src/rewards`, `apps/api/scripts`, `docs/handoffs`, `docs/HANDOFF.md`. No Neon command, deploy, model call, fixture run, settlement, root, claim, Sentinel or vault edit. `docs/BUILDLOG.md` not touched (outside the session's writable list).
- Runner (implementation, 2026-09-22 earlier): Claude Code, Fable 5.1, effort xhigh; see `docs/handoffs/2026-09-22-r2-implemented.md`.
- Authority: `docs/handoffs/2026-09-20-h-design-written-approval.md` (O1–O7); R2 scope authorization given in-session 2026-09-22 against the proposal document; Cisco's 2026-09-22 authorization covers the Codex P2 fixes.
- Canonical queue: `cisco-brain/10 - PROJECTS/Organic/plans/2026-09-16-hyphae-implementation-plan.md` (private; unchanged this session).
- Evidence stage: deterministic tests (pure + PGlite in-process Postgres), typecheck, Biome, diff check, drizzle-kit snapshot check, mutation probes. No integration against Neon or deployed behavior; no two-writer concurrency run.

## Current Objective

Organic-sync post-ship: record R1 accepted, R2 scoped, implemented, reviewed and merged, and the proposed Week 2–4 calendar rebaseline (last section of the proposal; not applied). Then an R3 scope proposal for written authorization.

## Current State

- R1 unchanged: `packages/core/src/reward-points.ts` and tests as merged.
- R2 schema: `reward_configs` (insert-only bundles, unique on community + digest), `reward_config_proposals` (one pending per community via partial unique index; statuses pending/activated/superseded/cancelled), `reward_intakes` (unique on contribution, community + artifact key, community + idempotency key), `epochs.reward_config_id` (null = legacy, cannot admit), `communities.reward_intake_paused_at`.
- R2 config module: payload v1 tied to R1 constants with timing milliseconds validated against rubric minutes; `earliestActivationEpoch(k, a) = max(k+1, a+2)`; contiguous materialization up to "now" only; bootstrap at an explicit future whole-second `opensAt` counts as activation 1; propose supersedes the pending row and rejects a no-op; cancel keeps `a`; pause is a column. New this session: `parseActivationTime` accepts only `Z` or `±HH:MM` timestamps.
- R2 intake module: idempotency → pause → epoch (half-open) → legacy pin → **member of this community** → **task of this community** and opened → artifact duplicate → insert contribution + intake with `acceptedAt` from the DB clock read after the community row lock. Foreign member or task ids throw before any write.
- Scripts: `set-rubric.ts` validates `--activate-at` before the staging rubric update, still updates the staging rubric, records a proposal, bootstraps with `--activate-at`, cancels with `--cancel`; `reward-intake.ts <mint> pause|resume`.
- `Db` type in `@hyphae/db` is the generic `PgDatabase`, so PGlite tests and postgres-js production share the same functions.

## Recent Changes

2026-09-22 (review session): Codex GitHub review of `7e43f80` raised two P2s (offset-free `--activate-at`; task lookup by id only). Fixed test-first in `37a2cca`. Review found the same hole for `memberId`; fixed test-first in `e81fa98`, formatting follow-up `bcdb328`. Independent review of the full diff: ACCEPT, six non-blocking observations for R3/R5. Review comment posted on PR #2 (review id 5279752308). Cisco said yes in-session; PR #2 merged to `main` at `336d48d` (merge commit, branch deleted, merge tree identical to `d24ceef`).

2026-09-22 (implementation session): R2 scope proposal (`a6028b3`); Cisco authorized all five decisions; R2 implemented test-first (`ddb2776`); docs checkpoint (`7e43f80`, `e184d8b`); PR #2 opened.

2026-09-21: R1 accepted after independent re-review of `3f9a5dd`; PR #1 merged.

## Validation

2026-09-22 native gate at `bcdb328` (review session):

- `pnpm -r test` — core: 5 files, 41 tests; api: 10 files, 83 tests (7 new this session: 5 `parseActivationTime`, foreign task, foreign member). All passed.
- `pnpm -r typecheck` — core, db, api passed.
- `pnpm exec biome check .` — 75 files, no fixes, exit 0.
- `git diff --check` — clean.
- `pnpm exec drizzle-kit check` — fine; `drizzle-kit generate` — no schema changes (snapshot 0003 matches the schema).
- Mutation probes: six invariant mutations each made 1–5 tests fail, reverted. Lock-before-clock ordering verified by reading only.
- All three new tests were watched failing before their implementation (`is not a function`; promise resolved `admitted`).

2026-09-22 native gate at `ddb2776` (implementation session) — core 41, api 76, typecheck, Biome 75 files, diff check green.

## Known Issues / Watch List

- No CI. PR merge is a manual gate; the native gate above is the only evidence.
- Migration 0003 is not applied to Neon. Applying it, bootstrapping MYCEL and resuming intake are a separate authorized cutover (checklist in the R2 record, plus one new precondition: `epochs` must be empty for MYCEL, see review observation 3).
- PGlite is single-connection: concurrent-writer races are proven by unique indexes and the lock discipline, not by a live race. R3's dispatch fencing needs a real-Postgres concurrency check.
- Review observations to carry into scope docs: (R3) `FOR UPDATE` vs FK `KEY SHARE` queueing, consider `for("no key update")`; closed legacy epoch has no path to pinned; (R5) `ensureEpochAt` `t`/`now` split; `resolvedAt` semantics. Minor: re-proposing the pending payload supersedes itself; `set-rubric.ts` updates staging before the reward write.
- pnpm may re-split `drizzle-orm` into two instances when a driver peer changes; symptom is a typecheck failure on `Column` class identity. Fix: `pnpm dedupe`.
- Gate output filtering hid a Biome failure once this session (`e81fa98`). Run `biome check .` unfiltered and check its exit code before claiming green.
- Codex CLI sandbox on this Windows machine still fails with `apply deny-read ACLs`; start it with `codex --sandbox danger-full-access` for a review session.
- R3–R5 remain sequential; R6 waits on H-CONTRACT and payment gates. Effective-decision reads, timing computation from `intake.acceptedAt`, and multiplier selection are R3/R4 caller work.

## Next Actions

1. Merge the follow-up docs PR (`docs/r2-merged-snapshot`: this handoff refresh and the session snapshot). Docs-only; Cisco's call. PR #3 already merged at `9bc0464`.
2. Organic-sync post-ship: record R1 accepted 2026-09-21, R2 scoped, implemented, reviewed and merged 2026-09-22 at `336d48d` (link the proposal, `2026-09-22-r2-implemented.md`, `2026-09-22-r2-review.md`), the six observations as R3/R5 inputs, and the proposed calendar rebaseline as a proposal. Canonical application unverified.
3. Decide whether `docs/BUILDLOG.md` gets a 2026-09-22 review-and-merge line (not written this session; outside the writable list).
4. R3 (slots, candidates, dispatch fencing, nomination adapter, `/submit` rewire) needs its own scope document and written authorization. No settlement, root, claim, fixture or paid run.

## Quick Reference

- Session-end snapshot: `docs/handoffs/2026-09-22-r2-merged.md`
- R2 review (ACCEPT): `docs/handoffs/2026-09-22-r2-review.md`
- R2 record: `docs/handoffs/2026-09-22-r2-implemented.md`
- R2 scope (authorized): `docs/handoffs/2026-09-21-r2-scope-proposal.md`
- R2 code: `apps/api/src/rewards/config.ts`, `intake.ts`, `test-db.ts`, tests; `packages/db/src/schema.ts`; `packages/db/drizzle/0003_reward_config_intake.sql`
- Scripts: `apps/api/scripts/set-rubric.ts`, `apps/api/scripts/reward-intake.ts`
- PR #2: https://github.com/FCisco95/hyphae/pull/2
- R1 acceptance: `docs/handoffs/2026-09-21-r1-accepted.md`
- Approved rules: `docs/handoffs/2026-09-20-h-design-operational-definitions.md`

## Suggested skills

`handoff-memory`, `superpowers:test-driven-development`, `handoff`. For R3 planning: `superpowers:brainstorming`, `superpowers:writing-plans`. Database/security guidance applies to R3+.

## Resume Checklist

- `git checkout main && git pull --ff-only` and confirm `336d48d` is present. `feat/r2-pinned-config` no longer exists.
- Run the native gate before trusting anything: `pnpm -r test`, `pnpm -r typecheck`, `pnpm exec biome check .` (check the exit code).
- Stay within explicit authorization; no R3–R6, Neon migration apply, callers, fixtures/paid runs, settlement, root or payment work.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| R2 review record | `docs/handoffs/2026-09-22-r2-review.md` | ACCEPT at `bcdb328`; fixes table, evidence, six observations |
| PR #2 review comment | https://github.com/FCisco95/hyphae/pull/2#pullrequestreview-5279752308 | Same verdict, condensed |
| P2 fixes + tests | `37a2cca`, `e81fa98`, `bcdb328` | `parseActivationTime`, community-scoped task and member lookups |
| PR #2 merge | `main` `336d48d` | Merge commit on Cisco's yes; tree = `d24ceef` |
| Current handoff | `docs/HANDOFF.md` | This file; PR #3 merged at `9bc0464`, snapshot follows in `docs/r2-merged-snapshot` |
| Session-end snapshot | `docs/handoffs/2026-09-22-r2-merged.md` | TL;DR, next steps, suggested skills |

No credentials, deployed resources or scheduled jobs created. Migration not applied.

## Next-session prompt

```text
Resume Hyphae. R2 (pinned reward configuration and admission) is merged to main at 336d48d (PR #2, reviewed ACCEPT at bcdb328). Branch feat/r2-pinned-config is gone; work from main (9bc0464 or later). A docs-only PR from docs/r2-merged-snapshot carries the session snapshot; merge it if still open. The repo has no CI; the native gate (pnpm -r test, pnpm -r typecheck, biome check . with exit code) is the only evidence. Migration 0003 is generated, not applied to Neon.

Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-22-r2-review.md, docs/handoffs/2026-09-22-r2-implemented.md, docs/handoffs/2026-09-21-r2-scope-proposal.md, apps/api/src/rewards/config.ts, apps/api/src/rewards/intake.ts
Model: Fable 5.1 xhigh or Opus-class xhigh; record actual session metadata.
Skills: handoff-memory, brainstorming, writing-plans, handoff.

If the task is organic-sync: record R1 accepted, R2 reviewed/merged, the six review observations as R3/R5 inputs, and the calendar rebaseline proposal. If the task is R3: stop and write an R3 scope proposal for written authorization first, carrying review observations 1–3. No Neon apply, callers, fixtures/paid runs, settlement, root or payment work without explicit authorization.
```
