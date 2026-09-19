---
date: 2026-09-20
summary: D1–D3/O1–O7 are approved. Bounded implementation planning is complete; no implementation has started.
---

# Hyphae H-DESIGN handoff

## TL;DR

The approved reward/epoch design has a complete bounded implementation plan. Its ignored local mirror is `docs/plans/h-design-implementation-plan-2026-09-20.md`; the public-safe checkpoint is `docs/handoffs/2026-09-20-h-design-implementation-planning.md`. If separately authorized, the first safe implementation slice is R1: pure exact reward-points math only.

## Metadata

- Scope: approved D1–D3/O1–O7 implementation planning; no implementation.
- Worktree: `h-design-2026-09-19`, current planning baseline `5b65a0a`; approval checkpoint `07072fb` remains in history.
- Approved design checkpoint: `c08871f`; approved artifact SHA-256 `ddeb69325d6b9621fe05de504f30356c4c0d7ec16d8b59fa4c9faf69184c1e99`.
- Runner: GPT-5.6 Terra, high, user-selected. Session billing unavailable.
- Evidence stage: local design/source inspection and notes validation only.

## Current Objective

The ignored implementation-plan amendment was returned to organic-sync (receipt below). Stop before implementation. A later, separately authorized session may implement R1 only and must retain the remaining dependency order.

## Current State

- D1–D3/O1–O7 are approved. Authority: `docs/handoffs/2026-09-20-h-design-written-approval.md`; exact operating design: `docs/handoffs/2026-09-20-h-design-operational-definitions.md`.
- The plan covers persistent slot/candidate/dispatch counters, ordinary-to-effort upgrade, strict scheduled close/late recovery/re-entry, indexed cooldown, exact/whole points, effective correction lineage, and staged logical commitments.
- No source, fixture, database, deployment, push, paid evaluation, or sibling write occurred. The separate dirty Mac main checkout is untouched.
- Synthetic review SHA-256 remains `1b851fa03059c00838438a7bc8d677299da4e87f01e6010e483ce62e75afd936`; all 16 labels remain unchanged.

## Recent Changes

Created the complete private plan and public-safe planning snapshot, then refreshed this handoff. Targeted source inspection recorded the current gaps: mutable rubric reads, retriable provider/job behavior, `/me` summing all runs, no close job, and float settlement. These are future changes, not implemented behavior. Returned the private amendment to organic-sync via Orca request `35fc0dfe-a7db-4c9f-a526-1d4df21d99c4`; receipt stages were `input_accepted` and `turn_started`, not application proof.

## Known Issues / Watch List

- H-CONTRACT/DEP-09 still owns public wire/auth/hash-vector schemas, admin actor identity, consumer compatibility, and wallet-migration semantics.
- Fees/funding/payment, campaign eligibility, Sentinel release/adoption, H-FIXTURES ranges/paid evaluation, and exact optional sqrt arithmetic remain separate gates.
- Existing `score.ts` permits generic force re-scores and retriable model calls; pg-boss may retry uncertainty. `/me` aggregates `scoring_runs` without epoch/effective selection. Do not represent this as conforming behavior.
- New reward processing must begin at a future pinned-config epoch boundary. Historic records are legacy read-only unless a separately authorized evidence-backed migration exists.

## Next Actions

1. Organic-sync applies or records the received private amendment; confirm only if it provides application evidence.
2. Do not implement without separate authorization. If authorized, start R1 only: `packages/core` exact point arithmetic/tests.
3. Review R1 before R2; R2–R5 remain sequential because they share config, schema and worker state.
4. Hold any root, claim, nonzero allocation, correction UI, public contract, or Sentinel work behind their stated gates.

## Quick Reference

- Approval: `docs/handoffs/2026-09-20-h-design-written-approval.md`
- Approved operating design: `docs/handoffs/2026-09-20-h-design-operational-definitions.md`
- Planning snapshot: `docs/handoffs/2026-09-20-h-design-implementation-planning.md`
- Private plan mirror: `docs/plans/h-design-implementation-plan-2026-09-20.md`
- Current source: `packages/db/src/schema.ts`, `apps/api/src/jobs/score.ts`, `apps/api/src/scoring/run.ts`, `apps/api/src/bot/commands/{submit,me,link}.ts`, `packages/core/src/{score,settle}.ts`

## Validation

Verified approval/design and synthetic-review hashes against `c08871f`; checked planning coverage, current source references, ignored private mirror, whitespace and worktree scope. No product tests were run for notes-only work.

## Resume Checklist

- Use this H-DESIGN worktree, not the dirty main checkout; inspect branch/status.
- Read the approval record before the historical proposal wording in the unchanged operational snapshot.
- Read the public planning checkpoint and ignored private plan; keep approved design distinct from unimplemented behavior.
- Confirm organic-sync received the amendment. Do not treat receipt acceptance as source implementation.
- Reconfirm all separate gates before moving beyond R1.

## Suggested skills

`handoff-memory`, `orca-cli`, `handoff`. Use TypeScript/testing guidance before R1 and database/security guidance before R2+.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Complete private implementation plan | `docs/plans/h-design-implementation-plan-2026-09-20.md` | Ignored planning mirror; return to organic-sync |
| Dated planning snapshot | `docs/handoffs/2026-09-20-h-design-implementation-planning.md` | Public-safe checkpoint |
| Canonical repo handoff | `docs/HANDOFF.md` | This file |

## Resume Prompt

```text
Resume Hyphae on h-design-2026-09-19. D1–D3/O1–O7 are approved and the bounded implementation plan is complete; no implementation has begun. Preserve all 16 synthetic labels and the separate dirty main checkout.

Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-20-h-design-written-approval.md, docs/handoffs/2026-09-20-h-design-implementation-planning.md, docs/plans/h-design-implementation-plan-2026-09-20.md
Model: GPT-5.6 Terra (high) — user-selected efficient runner for the first bounded implementation slice.
Skills: handoff-memory, orca-cli, handoff.

If separately authorized, implement R1 only: pure `packages/core` exact reward-point arithmetic with unit tests. Do not begin R2+ or work on H-CONTRACT, H-FIXTURES, fee/funding/payment, campaign, Sentinel, wallet migration, or optional sqrt arithmetic.
```
