---
date: 2026-09-20
summary: External R1 review complete; changes requested for missing whole-claim overflow rejection. Source unchanged; R2–R6 remain gated.
---

# Hyphae H-DESIGN handoff

## TL;DR

**R1 verdict: changes requested.** O5 credit, millisecond timing, fractions, aggregation and half-up formulas pass review, but `wholePoints()` accepts results beyond the existing unsigned 64-bit claim range. The canonical R1 acceptance matrix requires overflow rejection. The defect is reproduced and remains unfixed; this session owned documentation only. Next, scope an R1 fix and regression tests, then re-review before accepting R1. R2–R6 remain unstarted and gated.

## Metadata

- Last Updated: 2026-09-20.
- Base: `main` includes `9e9558c` (`feat(core): add exact reward point primitives`); R1 source/tests/export are committed locally and await the bounded R1-01 fix.
- Actual review runner: **GPT-6 Astra (`gpt-6-astra`), xhigh**, verified from this session's local `turn_context` metadata. This differs from the prior implementation handoff's requested GPT-5.6 Terra/high runner. No model switch or sub-agents; billing unavailable.
- Authority: `docs/handoffs/2026-09-20-h-design-written-approval.md`; approved O1–O7 artifact remains byte-identical.
- Canonical queue consulted: `cisco-brain/10 - PROJECTS/Organic/plans/2026-09-16-hyphae-implementation-plan.md` (private; unchanged).
- Evidence stage: local source/design review, deterministic core tests, read-only arithmetic probes, typecheck, Biome and documentation/scope checks. No integration or deployed-behavior evidence.

## Current Objective

Resolve **R1-01 (P2)** before accepting R1. Details and a copyable reproduction are in `docs/handoffs/2026-09-20-r1-external-review.md`. This review supplied no source-edit authority.

## Current State

- R1 preserves separate branded raw quality, credited quality, exact point units and whole points. `index.ts` only adds the new export.
- Credit gates match O5: hard-zero flags, mild/strong AI cap, then the 60 floor; timing and effort follow. Integer-millisecond timing, fractions and once-after-aggregation rounding pass reviewed cases. The floor is not applied again after decay.
- **R1-01:** `wholePoints()` at `packages/core/src/reward-points.ts:147` validates nonnegativity but no upper claim bound. Direct construction and aggregation can return `18446744073709551616` (`2^64`) as `WholePoints`, beyond the existing unsigned 64-bit claim score encoding. Bigint exactness does not satisfy claim-range rejection.
- Seven persistent R1 tests pass but have no overflow regression or millisecond half-up tie case. Additional review probes provide local evidence, not durable regression coverage.
- Score/settlement behavior remains unchanged. R1 has no callers; this finding establishes no current production payment loss.

## Recent Changes

This checkpoint records the external review after `9e9558c`; it refreshes `docs/HANDOFF.md`, adds `docs/handoffs/2026-09-20-r1-external-review.md`, and adds build-log entries. The reviewed source/test/export files remain byte-identical. The prior implementation snapshot remains historical. No push or deployment occurred.

## Validation

- `pnpm --filter @hyphae/core test` — passed: 5 files, 39 tests (7 R1).
- `pnpm --filter @hyphae/core typecheck` — passed.
- `pnpm exec biome check packages/core/src/reward-points.ts packages/core/src/reward-points.test.ts packages/core/src/index.ts` — passed; no fixes.
- Read-only Node probes — passed: 38,784 credit combinations, 30,565 timing cases (including every MYCEL half-up threshold at ±1 ms and short odd/even curves), 24 whole-rounding cases, 26 invalid-input rejections and all 9 O5 numeric examples. Empty aggregation, custom multipliers and exactness beyond safe-number precision also checked.
- Overflow probes — defect reproduced for a direct result, two individually representable contributions aggregated together, and rounding across the maximum claim value.
- `git diff --check` and handoff validation — passed.
- Approved O1–O7 SHA-256 remains `ddeb69325d6b9621fe05de504f30356c4c0d7ec16d8b59fa4c9faf69184c1e99`; synthetic review JSON remains `1b851fa03059c00838438a7bc8d677299da4e87f01e6010e483ce62e75afd936` (16 labels preserved; no fixture run).

## Known Issues / Watch List

- Enforce an explicit supported whole-claim limit after aggregation and rounding, without clamping. Do not impose a 64-bit limit on scaled exact point units. Add boundary/overflow regression tests in a separately scoped R1 fix.
- R2 owns immutable configuration/admission; R3–R5 retain sequential persistence/decision/close dependencies. R6 retains H-CONTRACT and payment gates.
- Effective-decision filtering, original accepted timestamps and selection of ordinary versus eligible multipliers remain future caller responsibilities.
- Exact units remain future allocation weight; whole-point rounding must not replace them. Existing floating settlement behavior remains outside R1 and is not verified as O5-conforming.

## Next Actions

1. Organic-sync post-ship should record **external R1 review complete — changes requested, R1 not accepted**, linking the snapshot and preserving task IDs. No sibling/private queue was edited and no receipt was sent this session; canonical application is unverified.
2. Scope an R1-01 fix limited to core arithmetic/tests/export and normal documentation. Re-run core tests/typecheck, focused Biome and boundary probes; re-review before acceptance and any commit decision.
3. Do not begin R2 without separately scoped authorization after R1 acceptance. Preserve all 16 labels and H-FIXTURES, H-CONTRACT, fee/funding/payment, campaign, Sentinel adoption, wallet migration and optional sqrt gates.

## Quick Reference

- Review: `docs/handoffs/2026-09-20-r1-external-review.md`
- Implementation snapshot: `docs/handoffs/2026-09-20-r1-exact-reward-points.md`
- Core: `packages/core/src/reward-points.ts`, `reward-points.test.ts`, `index.ts`
- Approved rules: `docs/handoffs/2026-09-20-h-design-operational-definitions.md`, O4 bounds and O5 arithmetic

## Suggested skills

`handoff-memory`, `andrej-karpathy-skills:karpathy-guidelines`, `handoff`. Database/security guidance belongs to separately authorized R2+ work.

## Resume Checklist

- Verify base/worktree and source fingerprints in the review snapshot.
- Read R1-01 and O4/O5 before a fix; preserve exact aggregation and single half-up rounding.
- Stay within explicit fix authorization; no R2, caller/DB/API integration, fixtures/paid runs, settlement, root or payment work.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| External R1 review / dated snapshot | `docs/handoffs/2026-09-20-r1-external-review.md` | Defect, reproduction, coverage and source fingerprints |
| Current handoff | `docs/HANDOFF.md` | Organic-sync receipt; review checkpoint |
| Public review entry | `docs/BUILDLOG.md` | Links reviewed implementation commit |

No credentials, deployed resources or scheduled jobs created.

## Resume Prompt

Use the following prompt after separately scoping any source fix.

## Next-session prompt

```text
Resume Hyphae main 1418cbc plus local R1 changes. External review requests changes for R1-01: missing whole-claim overflow rejection. R2–R6 remain unstarted and gated.

Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-20-r1-external-review.md, docs/handoffs/2026-09-20-h-design-operational-definitions.md, packages/core/src/reward-points.ts, packages/core/src/reward-points.test.ts, packages/core/src/index.ts
Model: GPT-6 Astra (xhigh) — retain the verified review runner for precision-sensitive arithmetic re-review; record actual session metadata.
Skills: handoff-memory, andrej-karpathy-skills:karpathy-guidelines, handoff.

Read R1-01. Implement a bounded fix only if the new task explicitly authorizes it; otherwise review the proposed fix. Preserve exact units, reject unsupported whole-claim results without clamping, and add/run meaningful boundary regressions. Stop before R2, callers/DB/API integration, fixtures/paid runs and settlement. Refresh the normal handoff for organic-sync.
```
