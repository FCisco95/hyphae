---
date: 2026-09-21
summary: R1 accepted on 2026-09-21 after independent re-review of the R1-01 overflow guard plus a native test/typecheck/lint re-run. PR #1 stays unmerged; R2–R6 remain gated.
---

# Hyphae H-DESIGN handoff

## TL;DR

**R1 status: ACCEPTED (2026-09-21).** The bounded R1-01 fix in `3f9a5dd` passed an independent re-review (verdict ACCEPT, no blocking findings) and the native gate was re-run afterwards: 41 tests, typecheck and Biome all green. Cisco accepted the verdict in-session. PR #1 is still open and unmerged. Do not begin R2 without separately scoped authorization.

## Metadata

- Last Updated: 2026-09-21.
- Branch: `hackathon/r1-exact-reward-points`, pushed to `origin`; PR #1 on `FCisco95/hyphae` is open against `main` with the local H-DESIGN and R1 history.
- Base: `3f9a5dd` (`fix(core): reject overflowing whole point claims`) is included in the branch; R1 source/tests/export and the bounded R1-01 fix are committed and published.
- Re-review runner: Codex CLI session on Windows, 2026-09-21. Model/effort metadata could not be verified because the session's sandbox failed (`helper_unknown_error: apply deny-read ACLs`); its checks were type-erased JavaScript probes in isolated V8, not native Vitest.
- Native gate re-run: Claude Code (Fable 5.1) session on Windows, 2026-09-21, from a clean checkout of `2fd2470` plus this handoff edit. This handoff was saved from that session because the Codex sandbox could not write files.
- Prior implementation runner: GPT-6 Astra (`gpt-6-astra`), xhigh (2026-09-20, verified then from `turn_context`).
- Authority: `docs/handoffs/2026-09-20-h-design-written-approval.md`; approved O1–O7 artifact remains byte-identical.
- Canonical queue consulted: `cisco-brain/10 - PROJECTS/Organic/plans/2026-09-16-hyphae-implementation-plan.md` (private; unchanged).
- Evidence stage: local source/design review, deterministic core tests, read-only arithmetic probes, typecheck, Biome and documentation/scope checks. No integration or deployed-behavior evidence.

## Current Objective

R1 is accepted. Next: record the acceptance through organic-sync post-ship, decide whether to merge PR #1 (Cisco's call, manual gate, no CI), and wait for separately scoped R2 authorization.

## Current State

- R1 preserves separate branded raw quality, credited quality, exact point units and whole points. `index.ts` only adds the new export.
- Credit gates match O5: hard-zero flags, mild/strong AI cap, then the 60 floor; timing and effort follow. Integer-millisecond timing, fractions and once-after-aggregation rounding pass reviewed cases. The floor is not applied again after decay.
- **R1-01 fixed and accepted:** `wholePoints()` rejects values above `MAX_WHOLE_POINTS` (`2^64 - 1`) only after aggregation and half-up rounding. It does not clamp and does not limit scaled exact point units.
- Nine persistent R1 tests include maximum-valid, half-up-overflow and aggregate-overflow regression coverage. The millisecond half-up tie coverage observation remains a future quality improvement, not a reproduced defect.
- Score/settlement behavior remains unchanged. R1 has no callers; this finding establishes no current production payment loss.

## Recent Changes

2026-09-21: independent re-review of `3f9a5dd` returned ACCEPT. Findings confirmed: overflow rejects only after exact aggregation and half-up rounding; removing the guard fails both overflow tests; the u64-max preservation check passes without the guard and fails if `>` becomes `>=`; exact units unchanged; 526 boundary and 2,630 aggregation probes passed. Native gate re-run green afterwards. Only docs changed in this checkpoint (this handoff and its dated snapshot). No deployment, root, claim, fixture run, paid evaluation or payment occurred.

`3f9a5dd` resolves R1-01 with a post-rounding u64 guard and three boundary regressions. `9e9558c`, `2ce7c93`, `3f9a5dd`, `bbaf020`, `d5a38c5` and `2fd2470` are published on `hackathon/r1-exact-reward-points`; PR #1 on `FCisco95/hyphae` is open.

## Validation

2026-09-21 native gate (Claude Code session, Windows):

- `pnpm vitest run` in `packages/core` — passed: 5 files, 41 tests.
- `pnpm tsc --noEmit` in `packages/core` — passed.
- `pnpm biome check .` at repo root — passed: 68 files, no fixes.

2026-09-21 re-review (Codex session, type-erased JS in isolated V8, not native Vitest):

- All nine R1 test bodies passed; guard removal fails both overflow tests; `>` to `>=` fails the u64-max preservation check.
- 526 boundary probes and 2,630 aggregation probes passed; exact units unchanged.

2026-09-20 (implementation session):

- `pnpm --filter @hyphae/core test` — passed: 5 files, 41 tests (9 R1).
- `pnpm --filter @hyphae/core typecheck` — passed.
- `pnpm exec biome check packages/core/src/reward-points.ts packages/core/src/reward-points.test.ts packages/core/src/index.ts` — passed; no fixes.
- Read-only Node probes — passed: 38,784 credit combinations, 30,565 timing cases (including every MYCEL half-up threshold at ±1 ms and short odd/even curves), 24 whole-rounding cases, 26 invalid-input rejections and all 9 O5 numeric examples. Empty aggregation, custom multipliers and exactness beyond safe-number precision also checked.
- Whole-claim boundary probes — maximum value succeeds; rounding across the maximum and aggregate overflow from individually valid contributions reject.
- `git diff --check` and handoff validation — passed.
- Approved O1–O7 SHA-256 remains `ddeb69325d6b9621fe05de504f30356c4c0d7ec16d8b59fa4c9faf69184c1e99`; synthetic review JSON remains `1b851fa03059c00838438a7bc8d677299da4e87f01e6010e483ce62e75afd936` (16 labels preserved; no fixture run).

## Known Issues / Watch List

- Codex CLI sandbox on this Windows machine fails with `apply deny-read ACLs`; it can read but not run commands or write files. Fix before the next Codex session: `/approvals` → full access, or restart with `codex --sandbox danger-full-access`. Same failure hit the organic-app session on 2026-09-21.
- The repo has no CI workflows. PR #1 merge is a manual gate with no automated checks behind it.
- R2 owns immutable configuration/admission; R3–R5 retain sequential persistence/decision/close dependencies. R6 retains H-CONTRACT and payment gates.
- Effective-decision filtering, original accepted timestamps and selection of ordinary versus eligible multipliers remain future caller responsibilities.
- Exact units remain future allocation weight; whole-point rounding must not replace them. Existing floating settlement behavior remains outside R1 and is not verified as O5-conforming.

## Next Actions

1. Organic-sync post-ship should record **R1 accepted 2026-09-21**, linking `docs/handoffs/2026-09-21-r1-accepted.md` and the review snapshot, preserving task IDs. No sibling/private queue was edited and no receipt was sent; canonical application is unverified.
2. Cisco decides PR #1 merge. Nothing blocks it technically; it is a manual gate.
3. Do not begin R2 without separately scoped authorization. Preserve all 16 labels and H-FIXTURES, H-CONTRACT, fee/funding/payment, campaign, Sentinel adoption, wallet migration and optional sqrt gates.

## Quick Reference

- Acceptance snapshot: `docs/handoffs/2026-09-21-r1-accepted.md`
- Review: `docs/handoffs/2026-09-20-r1-external-review.md`
- Implementation snapshot: `docs/handoffs/2026-09-20-r1-exact-reward-points.md`
- Core: `packages/core/src/reward-points.ts`, `reward-points.test.ts`, `index.ts`
- R1-01 fix: `3f9a5dd`
- Approved rules: `docs/handoffs/2026-09-20-h-design-operational-definitions.md`, O4 bounds and O5 arithmetic

## Suggested skills

`handoff-memory`, `andrej-karpathy-skills:karpathy-guidelines`, `handoff`. Database/security guidance belongs to separately authorized R2+ work.

## Resume Checklist

- Verify base/worktree and source fingerprints in the review snapshot.
- Confirm R1 acceptance in this handoff before touching anything R2-shaped.
- Stay within explicit authorization; no R2, caller/DB/API integration, fixtures/paid runs, settlement, root or payment work.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| R1 acceptance snapshot | `docs/handoffs/2026-09-21-r1-accepted.md` | Verdict, evidence, sandbox limitation |
| Current handoff | `docs/HANDOFF.md` | Organic-sync receipt; acceptance checkpoint |
| External R1 review / dated snapshot | `docs/handoffs/2026-09-20-r1-external-review.md` | Historical defect, reproduction, coverage and source fingerprints |
| Public build log | `docs/BUILDLOG.md` | Links implementation and R1-01 fix commits |
| GitHub review | PR #1 on `FCisco95/hyphae` | Open against `main`; no merge or deployed-behavior evidence |

No credentials, deployed resources or scheduled jobs created.

## Resume Prompt

Use the following prompt only after R2 has been separately scoped and authorized.

## Next-session prompt

```text
Resume Hyphae on `hackathon/r1-exact-reward-points` at the tip after `2fd2470`. Not `main`, and not `sync/mac-handoff-2026-09-19` — a stale SessionStart overlay may still name the latter. R1 is ACCEPTED as of 2026-09-21 (see docs/HANDOFF.md and docs/handoffs/2026-09-21-r1-accepted.md). PR #1 is open and unmerged; merge is Cisco's manual call, the repo has no CI. R2–R6 remain unstarted and gated.

Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-21-r1-accepted.md, docs/handoffs/2026-09-20-h-design-operational-definitions.md, packages/core/src/reward-points.ts, packages/core/src/reward-points.test.ts, packages/core/src/index.ts
Model: Opus-class runner (xhigh) for R2 design/implementation; record actual session metadata.
Skills: handoff-memory, andrej-karpathy-skills:karpathy-guidelines, handoff.

Do not start R2, callers/DB/API integration, fixtures/paid runs or settlement without an explicit R2 scope from Cisco in this session. If none is given, stop after confirming the branch and handoff state.
```
