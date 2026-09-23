---
date: 2026-09-23
summary: Documentation checkpoint. Founder schedule rulings recorded (mainnet payout committed; public audit page wins a time tradeoff; verified wallet linking before real mainnet payouts). R3–R5 scope proposal written for one written approval with sequential delivery. Tomorrow plan written. Fresh native gate green at dc261c7. No code changed; R3 not started.
---

# Hyphae handoff

## TL;DR

**R3–R5 APPROVED (2026-09-23).** Cisco: "yes to all nine + A + B + apply 0003/0004 after R3 merge". Record: `docs/handoffs/2026-09-23-r3-r5-approval.md`. R3 starts test-first on `feat/r3-slots-dispatch` from `main`; R4 and R5 follow only after the preceding stage is reviewed and merged. Migrations 0003 and 0004 go to Neon after R3 merges (no bootstrap, no deploy). R1 and R2 are merged and locally tested; R2 is **not deployed**.

## Metadata

- Last Updated: 2026-09-23. Session snapshot: `docs/handoffs/2026-09-23-tomorrow-plan.md` (the durable checkpoint for this session).
- Branch state verified this session, not copied from the Sep 22 handoff: `main` = `origin/main` = `dc261c7` (PR #4 merge). `docs/r2-merged-snapshot` (`aafa126`) confirmed an ancestor of `main`, then deleted locally and on origin. This checkpoint rides on `docs/2026-09-23-scope-checkpoint` (commits `87db70d` and the log/handoff commit after it); `main` does not contain it until that branch is merged.
- Other branches left untouched: `hackathon/r1-exact-reward-points`, `sync/mac-handoff-2026-09-19` (local and origin).
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows, 2026-09-23. Requested: Fable 5.1 xhigh or Astra xhigh; neither is what ran. Effort is not observable from inside the session and is not recorded as verified.
- The previous session (per Cisco's brief) could read files but not run Git, tests or writes (`apply deny-read ACLs`); it produced nothing. This session had working Git, tests and writes.
- Authority: `docs/handoffs/2026-09-20-h-design-written-approval.md` (O1–O7). Founder rulings: `docs/handoffs/2026-09-23-schedule-rulings.md`. R3–R5: `docs/handoffs/2026-09-23-r3-r5-approval.md`.
- Canonical queue: `cisco-brain/10 - PROJECTS/Organic/plans/2026-09-16-hyphae-implementation-plan.md` (private; read, not edited). Organic-sync owns private-plan updates for today's rulings.

## Current Objective

R3 test-first on `feat/r3-slots-dispatch`, per the approved proposal. Approval covers decisions 1–9, A (Lab-controlled devnet wallet), B (combined approval, sequential stages) and the post-R3 apply of 0003/0004.

## Current State

- Code unchanged since R2: `packages/core/src/reward-points.ts` (R1), `apps/api/src/rewards/config.ts` and `intake.ts` (R2), migration 0003 generated, not applied. Nothing calls admission. `/submit`, the score job and `/me` are the Sep 17 legacy path.
- Founder rulings (confirmed): mainnet payout remains a committed hackathon target; the public audit page takes priority if time forces a tradeoff. Precondition: verified tester wallet linking before paying real testers on mainnet (today `/link` pastes and can rewrite the wallet).
- Recommendations A (Lab-controlled devnet wallet) and B (combined approval, sequential stages, review after each) confirmed 2026-09-23.
- R3–R5 proposal resolves before code: P1 prompt/policy pinning (payload v2 pins `promptVersion` + `promptTemplateHash`; model recorded, not pinned); P2 durable pre-close acceptance (lock-then-clock argument; real-Postgres race test). All six R2 review observations assigned (1, 3, 4, 5 → R3; 2, 6 → R5).

## Recent Changes

2026-09-23: branch cleanup (above); fresh native gate; `87db70d` adds the schedule rulings, the R3–R5 scope proposal and the tomorrow plan; this handoff and a build-log entry follow in a second docs commit.

2026-09-22: R2 reviewed ACCEPT at `bcdb328`, merged as PR #2 at `336d48d`; docs PRs #3 (`9bc0464`) and #4 (`dc261c7`) merged.

## Validation

2026-09-23, fresh, at `dc261c7` (before any docs change; this session changed no code):

- `pnpm -r test` — core 5 files / 41 tests; api 10 files / 83 tests; exit 0.
- `pnpm -r typecheck` — core, db, api passed; exit 0.
- `pnpm exec biome check .` — 75 files, no fixes; exit 0 (run unfiltered, exit code captured).
- `pnpm --filter @hyphae/db exec drizzle-kit check` — "Everything's fine"; exit 0.
- `git diff --cached --check` clean for the docs commit.

The Sep 22 review's 41 + 83 is historical; the numbers above are this session's own run with the same counts.

Documentation claims checked against current docs (Context7, 2026-09-23): AI SDK `maxRetries` default 2, `0` disables; pg-boss fails and retries a job whose handler exceeds `expireInSeconds` while the handler may still run.

## Known Issues / Watch List

- No CI. The native gate and an independent review are the only evidence.
- Migration 0003 not on Neon. After R3 merges, apply 0003 and 0004 (authorized 2026-09-23; preconditions in the approval record) before any deploy of `main`. Bootstrap and deploy stay separately authorized.
- Real-Postgres concurrency is unproven so far; R3 adds a `test:pg` gate on local Docker Postgres 17 (Docker 28.1.1 present). Not Neon.
- Verified wallet linking is unscheduled as a build; the rulings doc places the decision in Sep 29–30.
- Tester usage since Sep 20 is not evidenced anywhere in the repo; do not state counts without a fresh read.
- Codex CLI sandbox on this Windows machine fails with `apply deny-read ACLs`; use `codex --sandbox danger-full-access` for review sessions.
- pnpm can split `drizzle-orm` into two instances when a driver peer changes; fix with `pnpm dedupe`.

## Next Actions

1. Cisco: merge `docs/2026-09-23-scope-checkpoint` (docs-only) so `main` carries the proposal.
2. Done 2026-09-23: approval recorded in `docs/handoffs/2026-09-23-r3-r5-approval.md`.
3. Sep 24: `docs/WHITEPAPER.md`, `docs/demo/2026-09-25-weekly-video-2.md`, `docs/TESTING.md` from existing evidence, labelled historical / locally tested / deployed / planned (`2026-09-23-tomorrow-plan.md`).
4. R3: `git checkout main && git pull --ff-only && git checkout -b feat/r3-slots-dispatch`; failing tests first (payload v2, lock mode), then slots/nomination, then dispatch.
5. Organic-sync: record the rulings, the proposal and the adopted-or-not calendar in the private plan.

## Quick Reference

- Schedule rulings: `docs/handoffs/2026-09-23-schedule-rulings.md`
- R3–R5 scope (approved 2026-09-23): `docs/handoffs/2026-09-23-r3-r5-scope-proposal.md`
- Tomorrow plan: `docs/handoffs/2026-09-23-tomorrow-plan.md`
- R2 review and observations: `docs/handoffs/2026-09-22-r2-review.md`
- Approved rules O1–O7: `docs/handoffs/2026-09-20-h-design-operational-definitions.md`
- R2 code: `apps/api/src/rewards/config.ts`, `intake.ts`; `packages/db/src/schema.ts`; `packages/db/drizzle/0003_reward_config_intake.sql`
- Legacy path R3 rewires: `apps/api/src/bot/commands/submit.ts`, `jobs/score.ts`, `scoring/run.ts`, `jobs/queue.ts`, `worker.ts`, `bot/commands/me.ts`

## Suggested skills

`handoff-memory` (resume), `superpowers:test-driven-development` (R3, after approval), `supabase:supabase-postgres-best-practices` (locking and constraints), `superpowers:writing-plans` (R3 task list), `humanizer` (whitepaper), `handoff` (session end).

## Resume Checklist

- `git fetch --prune && git status -sb`; confirm whether `docs/2026-09-23-scope-checkpoint` is merged.
- R3–R5 approved (`2026-09-23-r3-r5-approval.md`); R4 and R5 only after the preceding stage merges.
- Run the native gate before trusting any count.
- Stay out of: Neon migration apply before R3 merges, bootstrap, deployment, R6, settlement/root/claim, fixture or paid runs, Sentinel adoption code, vault edits.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Schedule rulings | `docs/handoffs/2026-09-23-schedule-rulings.md` | Two confirmed rulings, two recommendations, wallet precondition, proposed calendar |
| R3–R5 scope proposal | `docs/handoffs/2026-09-23-r3-r5-scope-proposal.md` | Nine decisions; awaiting written approval |
| Tomorrow plan | `docs/handoffs/2026-09-23-tomorrow-plan.md` | Whitepaper, demo script, tester checklist, R3 start |
| Build log entry | `docs/BUILDLOG.md` | 2026-09-23 |
| This handoff | `docs/HANDOFF.md` | Canonical |

No credentials, deployed resources, scheduled jobs or database changes. Deleted: the merged `docs/r2-merged-snapshot` branch (local and origin).

## Next-session prompt

```text
Resume Hyphae for 2026-09-24. Read CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-23-tomorrow-plan.md, docs/handoffs/2026-09-23-r3-r5-scope-proposal.md, docs/handoffs/2026-09-23-schedule-rulings.md.

Check git state first (git fetch --prune; git status -sb); confirm whether docs/2026-09-23-scope-checkpoint is merged to main. Look for Cisco's written answer on the nine R3-R5 decisions and recommendations A and B; record exact words in a dated handoff before any code.

Today: docs/WHITEPAPER.md, docs/demo/2026-09-25-weekly-video-2.md, docs/TESTING.md from existing evidence only, labelled historical / locally tested / deployed / planned. No invented usage or submission numbers.

If approved: branch feat/r3-slots-dispatch from main, test-first. Gate: pnpm -r test; pnpm -r typecheck; pnpm exec biome check . (unfiltered, exit code); pnpm --filter @hyphae/db exec drizzle-kit check; plus test:pg once it exists.

No Neon migration apply, deployment, R6, settlement/root/claim, fixture or paid runs, Sentinel adoption code or vault edits.
Model: Fable 5.1 xhigh preferred; record what actually runs.
Skills: handoff-memory, test-driven-development (after approval), writing-plans, humanizer, handoff.
```
