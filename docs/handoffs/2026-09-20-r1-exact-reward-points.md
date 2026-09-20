# H-DESIGN R1 — exact reward-point arithmetic

## TL;DR

R1 is implemented and internally reviewed locally in the `main` checkout; it awaits external review. It adds only pure bigint reward-point math and tests in `packages/core`; all R2+ and separately gated work remains untouched.

## Scope and changes

- Added `packages/core/src/reward-points.ts` and `reward-points.test.ts`; exported the module from `packages/core/src/index.ts`.
- The module preserves separate raw quality, credited quality, exact point units, and whole claim points. It applies hard-zero/AI-cap/floor credit gates first, then integer-millisecond timing and multiplier basis points; exact values aggregate before one nonnegative half-up whole-point round.
- Verified 85 eligible/full = 255, 85 at 27h = 127.5 exact, two 0.5 contributions = 1 whole point, near-close fractions, and invalid bounds.
- Internal review added pure-runtime validation for unsupported no-task timestamps, unknown flags, and non-boolean AI metadata; no arithmetic or scope issue remained.
- No caller, `settle.ts`, database/API, fixture, model, commitment/root/claim, optional sqrt, contract, or payment work changed.

## Evidence

- `pnpm --filter @hyphae/core test` — 39 passed.
- `pnpm --filter @hyphae/core typecheck` — passed.
- Focused Biome check and `git diff --check` — passed.
- Evidence stage is local deterministic checks only; no paid model evaluation, database command, deployment, push, or payment occurred.

## Runner and next action

User-selected runner: GPT-5.6 Terra, high. Runtime billing/model telemetry unavailable. Complete external R1 review before any decision on a commit or separately authorized R2.

## Suggested skills

`handoff-memory`, `andrej-karpathy-skills:karpathy-guidelines`, `handoff`.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Exact reward-point module | `packages/core/src/reward-points.ts` | Local, uncommitted R1 implementation |
| Exact arithmetic tests | `packages/core/src/reward-points.test.ts` | Seven focused tests |

## Next-session prompt

```text
Resume Hyphae on main. R1 exact reward-point arithmetic is implemented locally and awaiting review; do not begin R2 or wire it to callers.

Files: docs/HANDOFF.md, packages/core/src/reward-points.ts, packages/core/src/reward-points.test.ts
Model: GPT-5.6 Terra (high) — user-selected bounded implementation runner.
Skills: handoff-memory, andrej-karpathy-skills:karpathy-guidelines, handoff.

Review R1 only, then seek separate authorization for the next slice.
```
