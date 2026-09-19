---
date: 2026-09-19
summary: Hyphae is cloned and verified on the Mac; the next build session should resume the public audit surface and rubric-calibration work, not redo infrastructure.
---

# HANDOFF — Mac workspace setup

## TL;DR

The Mac workspace is ready at the repo root. It is a clean clone of `FCisco95/hyphae` at `454843f` on `main`, with dependencies installed using the locked pnpm 10.29.3 version. `pnpm lint`, `pnpm test` (59 tests), `pnpm typecheck`, and `pnpm build` all pass.

Do not create a separate sixth vault project: Hyphae remains the bounded Colosseum entry under Organic. Its private canonical design and implementation documents stay in the vault; the public build log remains `docs/BUILDLOG.md`.

## What to do next

Resume from the latest build-log next action: founder-graded evaluation set and prompt calibration for MYCEL rubric 1.3.0, then weekly judge video #1 and the public score page. Read the private design and implementation plan before changing code. Keep the strict boundary: Hyphae uses only Organic's public settlement API and must never modify `organic-app`.

## Local-state notes

- `node_modules/` and API build output are present locally and ignored by Git.
- `.env` is intentionally absent on this Mac. Recreate it from the approved secret store or remote-service settings only when an execution task needs it; never copy secrets into Git.
- `docs/plans/` is intentionally absent. It is a gitignored local mirror; the canonical plan remains in the private vault.
- Hyphae brand assets at `~/Desktop/Mycel/Hyphae/` were not found on this Mac. This matters only when the web/brand task starts.

## Suggested skills

- `handoff-memory` — reconstruct the latest checkpoint when returning.
- `superpowers:test-driven-development` — for pure scoring/core changes.
- `context7-mcp` — before modifying Anchor, Token-2022, grammY, pg-boss, AI SDK, or Drizzle use.
- `solana-dev` — once resuming the on-chain program.
- `frontend-design` — for the public score/audit page.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Mac Hyphae source workspace | repository root | Clean clone of `FCisco95/hyphae`; no secrets copied. |
| Local dependencies and build artifacts | `node_modules/`, `apps/api/dist/` | Gitignored and reproducible from the lockfile. |

## Next-session prompt

```
Hyphae is a clean, verified Mac checkout at `main` commit `454843f`; it is a bounded Organic hackathon entry, not a separate vault project. The bot/scoring loop is already live; do not redo setup or touch organic-app.

Files: docs/HANDOFF.md, docs/BUILDLOG.md, CLAUDE.md, docs/rubrics/mycel-1.2.0.json
Model: Sonnet 5 (xhigh) — the established execution routing for the approved build plan.
Skills: handoff-memory, superpowers:test-driven-development, context7-mcp

Read the private vault spec and implementation plan, then begin the founder-graded evaluation set and rubric 1.3.0 calibration; stop for founder input where the plan requires judgment.
```
