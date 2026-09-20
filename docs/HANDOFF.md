---
date: 2026-09-20
summary: R1-01 whole-claim overflow guard is fixed and locally verified; R1 awaits independent re-review before acceptance. R2–R6 remain gated.
---

# Hyphae H-DESIGN handoff

## TL;DR

**R1 status: locally fixed, awaiting independent re-review.** The reviewed O5 credit, millisecond timing, fractions, aggregation and half-up formulas still pass. R1-01 added a whole-claim overflow guard and durable boundary coverage without limiting scaled exact units. Do not accept R1 or begin R2 until that bounded change is re-reviewed.

## Metadata

- Last Updated: 2026-09-20.
- Branch: `hackathon/r1-exact-reward-points`, pushed to `origin`; PR #1 on `FCisco95/hyphae` is open against `main` with the local H-DESIGN and R1 history.
- Base: `3f9a5dd` (`fix(core): reject overflowing whole point claims`) is included in the branch; R1 source/tests/export and the bounded R1-01 fix are committed and published for review.
- Actual review runner: **GPT-6 Astra (`gpt-6-astra`), xhigh**, verified from this session's local `turn_context` metadata. This differs from the prior implementation handoff's requested GPT-5.6 Terra/high runner. No model switch or sub-agents; billing unavailable.
- Authority: `docs/handoffs/2026-09-20-h-design-written-approval.md`; approved O1–O7 artifact remains byte-identical.
- Canonical queue consulted: `cisco-brain/10 - PROJECTS/Organic/plans/2026-09-16-hyphae-implementation-plan.md` (private; unchanged).
- Evidence stage: local source/design review, deterministic core tests, read-only arithmetic probes, typecheck, Biome and documentation/scope checks. No integration or deployed-behavior evidence.

## Current Objective

Complete an independent R1 re-review before accepting R1. R1-01 is fixed in `3f9a5dd`; the original defect and reproduction remain documented in `docs/handoffs/2026-09-20-r1-external-review.md`.

## Current State

- R1 preserves separate branded raw quality, credited quality, exact point units and whole points. `index.ts` only adds the new export.
- Credit gates match O5: hard-zero flags, mild/strong AI cap, then the 60 floor; timing and effort follow. Integer-millisecond timing, fractions and once-after-aggregation rounding pass reviewed cases. The floor is not applied again after decay.
- **R1-01 fixed locally:** `wholePoints()` now rejects values above `MAX_WHOLE_POINTS` (`2^64 - 1`) only after aggregation and half-up rounding. It does not clamp and does not limit scaled exact point units.
- Nine persistent R1 tests include maximum-valid, half-up-overflow and aggregate-overflow regression coverage. The millisecond half-up tie coverage observation remains a future quality improvement, not a reproduced defect.
- Score/settlement behavior remains unchanged. R1 has no callers; this finding establishes no current production payment loss.

## Recent Changes

`3f9a5dd` resolves R1-01 with a post-rounding u64 guard and three boundary regressions. `9e9558c`, `2ce7c93`, `3f9a5dd`, and `bbaf020` are published with the earlier H-DESIGN commits on `hackathon/r1-exact-reward-points`; PR #1 on `FCisco95/hyphae` is open. This checkpoint refreshes the public build log and handoff; the external-review snapshot remains historical evidence of the discovered defect. No deployment, root, claim, fixture run, paid evaluation or payment occurred.

## Validation

- `pnpm --filter @hyphae/core test` — passed: 5 files, 41 tests (9 R1).
- `pnpm --filter @hyphae/core typecheck` — passed.
- `pnpm exec biome check packages/core/src/reward-points.ts packages/core/src/reward-points.test.ts packages/core/src/index.ts` — passed; no fixes.
- Read-only Node probes — passed: 38,784 credit combinations, 30,565 timing cases (including every MYCEL half-up threshold at ±1 ms and short odd/even curves), 24 whole-rounding cases, 26 invalid-input rejections and all 9 O5 numeric examples. Empty aggregation, custom multipliers and exactness beyond safe-number precision also checked.
- Whole-claim boundary probes — maximum value succeeds; rounding across the maximum and aggregate overflow from individually valid contributions reject.
- `git diff --check` and handoff validation — passed.
- Approved O1–O7 SHA-256 remains `ddeb69325d6b9621fe05de504f30356c4c0d7ec16d8b59fa4c9faf69184c1e99`; synthetic review JSON remains `1b851fa03059c00838438a7bc8d677299da4e87f01e6010e483ce62e75afd936` (16 labels preserved; no fixture run).

## Known Issues / Watch List

- R1 acceptance remains contingent on independent re-review of the R1-01 guard and its boundary coverage. Do not treat local verification as external acceptance.
- R2 owns immutable configuration/admission; R3–R5 retain sequential persistence/decision/close dependencies. R6 retains H-CONTRACT and payment gates.
- Effective-decision filtering, original accepted timestamps and selection of ordinary versus eligible multipliers remain future caller responsibilities.
- Exact units remain future allocation weight; whole-point rounding must not replace them. Existing floating settlement behavior remains outside R1 and is not verified as O5-conforming.

## Next Actions

1. Obtain an independent R1 re-review of `3f9a5dd` in PR #1 on `FCisco95/hyphae`; accept R1 only if the whole-claim boundary and existing O5 checks pass.
2. Organic-sync post-ship should record **R1-01 fixed locally — independent re-review pending**, linking the review snapshot and preserving task IDs. No sibling/private queue was edited and no receipt was sent; canonical application is unverified.
3. Do not begin R2 without separately scoped authorization after R1 acceptance. Preserve all 16 labels and H-FIXTURES, H-CONTRACT, fee/funding/payment, campaign, Sentinel adoption, wallet migration and optional sqrt gates.

## Quick Reference

- Review: `docs/handoffs/2026-09-20-r1-external-review.md`
- Implementation snapshot: `docs/handoffs/2026-09-20-r1-exact-reward-points.md`
- Core: `packages/core/src/reward-points.ts`, `reward-points.test.ts`, `index.ts`
- R1-01 fix: `3f9a5dd`
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
| External R1 review / dated snapshot | `docs/handoffs/2026-09-20-r1-external-review.md` | Historical defect, reproduction, coverage and source fingerprints |
| Current handoff | `docs/HANDOFF.md` | Organic-sync receipt; review checkpoint |
| Public build log | `docs/BUILDLOG.md` | Links implementation and R1-01 fix commits |
| GitHub review | PR #1 on `FCisco95/hyphae` | Open against `main`; no merge or deployed-behavior evidence |

No credentials, deployed resources or scheduled jobs created.

## Resume Prompt

Use the following prompt after separately scoping any source fix.

## Next-session prompt

```text
Resume Hyphae main after `3f9a5dd`. R1-01 now rejects whole-claim overflow with durable boundary tests; R1 still awaits independent re-review. R2–R6 remain unstarted and gated.

Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-20-r1-external-review.md, docs/handoffs/2026-09-20-h-design-operational-definitions.md, packages/core/src/reward-points.ts, packages/core/src/reward-points.test.ts, packages/core/src/index.ts
Model: GPT-6 Astra (xhigh) — retain the verified review runner for precision-sensitive arithmetic re-review; record actual session metadata.
Skills: handoff-memory, andrej-karpathy-skills:karpathy-guidelines, handoff.

Read the external review and `3f9a5dd`. Independently re-review the bounded whole-claim guard, preserving exact units and once-only rounding. Do not accept R1 or start R2, callers/DB/API integration, fixtures/paid runs or settlement until that review succeeds. Refresh the normal handoff for organic-sync.
```
