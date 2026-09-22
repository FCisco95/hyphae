---
date: 2026-09-22
summary: R1 accepted and merged (PR #1, main aebb147). R2 scope proposal written 2026-09-22 and awaiting Cisco's written authorization; nothing implemented. R3–R6 remain gated.
---

# Hyphae H-DESIGN handoff

## TL;DR

**R1 status: ACCEPTED (2026-09-21).** The bounded R1-01 fix in `3f9a5dd` passed an independent re-review (verdict ACCEPT, no blocking findings) and the native gate was re-run afterwards: 41 tests, typecheck and Biome all green. PR #1 merged to `main` at `aebb147` on 2026-09-21.

**R2 status: SCOPED, NOT AUTHORIZED (2026-09-22).** The bounded R2 scope is written in `docs/handoffs/2026-09-21-r2-scope-proposal.md`: additive schema (three tables, one enum, two nullable columns), `apps/api/src/rewards/config.ts` and `rewards/intake.ts`, `set-rubric.ts` as a proposal producer, cooldown indexing with the E11/E12→E13 example, five acceptance tests on PGlite, explicit exclusions. It ends with five yes/no decisions. No code, schema or migration exists yet. Implementation goes on `feat/r2-pinned-config` only after Cisco answers yes to all five.

## Metadata

- Last Updated: 2026-09-22.
- Branch: `main` at `aebb147` = `origin/main`. PR #1 (`hackathon/r1-exact-reward-points`) merged 2026-09-21; that branch is finished. R2 docs live on `feat/r2-pinned-config` (docs-only until authorized).
- R2 scoping runner: Claude Code, Fable 5.1 (`claude-fable-5-1`), effort xhigh, Windows, 2026-09-22. Read-only against the repo and the private plan; no DB command, model call, deploy or push.
- Base: `3f9a5dd` (`fix(core): reject overflowing whole point claims`) is included in the branch; R1 source/tests/export and the bounded R1-01 fix are committed and published.
- Re-review runner: Codex CLI session on Windows, 2026-09-21. Model/effort metadata could not be verified because the session's sandbox failed (`helper_unknown_error: apply deny-read ACLs`); its checks were type-erased JavaScript probes in isolated V8, not native Vitest.
- Native gate re-run: Claude Code (Fable 5.1) session on Windows, 2026-09-21, from a clean checkout of `2fd2470` plus this handoff edit. This handoff was saved from that session because the Codex sandbox could not write files.
- Prior implementation runner: GPT-6 Astra (`gpt-6-astra`), xhigh (2026-09-20, verified then from `turn_context`).
- Authority: `docs/handoffs/2026-09-20-h-design-written-approval.md`; approved O1–O7 artifact remains byte-identical.
- Canonical queue consulted: `cisco-brain/10 - PROJECTS/Organic/plans/2026-09-16-hyphae-implementation-plan.md` (private; unchanged).
- Evidence stage: local source/design review, deterministic core tests, read-only arithmetic probes, typecheck, Biome and documentation/scope checks. No integration or deployed-behavior evidence.

## Current Objective

R1 is accepted and merged. R2 is scoped and waiting for written authorization (five yes/no decisions in the proposal). Organic-sync post-ship still needs to record the R1 acceptance and the R2 proposal, plus the proposed Week 2–4 calendar rebaseline in the proposal's last section.

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

1. Cisco answers the five decisions in `docs/handoffs/2026-09-21-r2-scope-proposal.md`. All yes = R2 authorized on `feat/r2-pinned-config` (schema + migration generated, config/intake modules, set-rubric proposal producer, PGlite tests; migration not applied to Neon). Any no = revise the proposal, no partial build.
2. Organic-sync post-ship should record **R1 accepted 2026-09-21** and **R2 scoped 2026-09-22**, linking `docs/handoffs/2026-09-21-r1-accepted.md` and the R2 proposal, and record the proposed calendar rebaseline (proposal, not applied). Canonical application is unverified.
3. Preserve all 16 labels and H-FIXTURES, H-CONTRACT, fee/funding/payment, campaign, Sentinel adoption, wallet migration and optional sqrt gates. No R3–R6, settlement, root, claim, fixture or paid run.

## Quick Reference

- R2 scope proposal (awaiting authorization): `docs/handoffs/2026-09-21-r2-scope-proposal.md`
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
| GitHub review | PR #1 on `FCisco95/hyphae` | Merged into `main` 2026-09-21; no deployed-behavior evidence |

No credentials, deployed resources or scheduled jobs created.

## Resume Prompt

Use the following prompt after Cisco has answered the R2 proposal.

## Next-session prompt

```text
Resume Hyphae on `feat/r2-pinned-config` (branched from `main` at `aebb147`). Not `hackathon/r1-exact-reward-points` (merged, finished) and not `sync/mac-handoff-2026-09-19`. R1 is ACCEPTED and merged. R2 is scoped in docs/handoffs/2026-09-21-r2-scope-proposal.md and waits for five yes/no answers. The repo has no CI; the native gate (pnpm test, pnpm typecheck, biome check .) is the only evidence.

Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-21-r2-scope-proposal.md, docs/handoffs/2026-09-20-h-design-operational-definitions.md, packages/db/src/schema.ts, apps/api/scripts/set-rubric.ts, packages/core/src/reward-points.ts
Model: Fable 5.1 xhigh (or Opus-class xhigh); record actual session metadata.
Skills: handoff-memory, superpowers:test-driven-development, handoff.

If Cisco's written answer is yes to all five decisions, implement R2 exactly as proposed: schema + generated migration (not applied to Neon), rewards/config.ts, rewards/intake.ts, set-rubric proposal producer, reward-intake pause script, PGlite tests; keep R1 untouched; run the native gate; open a PR. Otherwise revise the proposal and stop. No R3–R6, settlement, root, claim, fixture or paid run.
```
