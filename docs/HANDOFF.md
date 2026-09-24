---
date: 2026-09-24
summary: R4 merged (PR #12, 09:36 UTC). R5 (strict close, frozen snapshot, re-entry) built test-first on feat/r5-close-snapshot; migration 0007 generated, not applied. Full gate green including test:pg 7/7. Verified wallet-linking plan decided (D1–D6) on its own branch; build waits for R5 merge and a separate yes. Nothing deployed or bootstrapped.
---

# Hyphae handoff

## TL;DR

**R5 is on `feat/r5-close-snapshot` (commit `082cffa`), ready for independent review and a PR; merge only on Cisco's yes.** An epoch now closes once, at its scheduled `closesAt`, into a frozen snapshot: each contribution's selected decision or reason, and per-member exact and whole points. Live nominations expire, the next epoch opens, and a late answer counts for nothing. An expired, never-judged artifact can re-enter the next epoch as linked new work. Migration 0007 is **not applied**. R4 (PR #12) was merged by Cisco at 09:36 UTC. Nothing is deployed or bootstrapped.

## Metadata

- Last Updated: 2026-09-24. Record: `docs/handoffs/2026-09-24-r5-implemented.md` (Cisco's two in-session answers verbatim, interpretations for review, evidence). R4 record: `docs/handoffs/2026-09-24-r4-implemented.md`.
- Branches: `main` = `origin/main` = `a5eb9f4` (PR #12 merged); `feat/r5-close-snapshot` = `082cffa` + docs. `feat/verified-link-sdk` lives in its own worktree at `DEVELOPMENTS/hyphae-verified-link`; do not check it out here.
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows, 2026-09-24. Effort is not observable in-session.
- Authority: O1–O7 (`2026-09-20-h-design-written-approval.md`); R3–R5 approval (`2026-09-23-r3-r5-approval.md`, build yes, apply no); 0005 (`2026-09-23-f3-notified.md`); 0006 (`2026-09-24-r4-implemented.md`); R5 shape (`2026-09-24-r5-implemented.md`).
- Canonical private plan: not read or edited this session.

## Current Objective

Get R5 reviewed and merged. Then the verified-link build, on its own yes.

## Current State

- On `main` and in Neon's schema (not deployed): R3 plus F1–F4. Neon has migrations 0000–0005. `main` also has R4 (migration 0006, not applied).
- On `feat/r5-close-snapshot` only: `rewards/close.ts` (`closeEpoch`, `dueCloses`), `selectEffective` in `rewards/effective.ts`, the `reward-close` queue and sweep wiring, `completed_after_cutoff`, re-entry in `rewards/slots.ts`, migration 0007.
- Verified wallet linking: plan `docs/handoffs/2026-09-24-verified-link-sdk-plan.md` on `feat/verified-link-sdk` (pushed, docs only). Cisco decided D1–D6 as recommended: SDK route (`@organichub/verify` 0.1.0, exact version), pasted `/link` removed, no wallet takeover, closed epochs pay the wallet valid at `closesAt` (new append-only `member_wallet_links` table), signing page on the api origin, mainnet. This resolves pending decision 2 (wallet-linking route) of `2026-09-24-plan.md` (that file is on branch `docs/2026-09-23-migrations-applied`, not `main`). The build starts only after R5 merges, on a separate yes. The hold gate is a separate future plan.
- Fly runs the Sep 17 image.

## Recent Changes

2026-09-24 (afternoon): R5 built test-first (`082cffa`). Cisco chose one PR for all of R5 and delegated where whole points live (per-member table). Relayed from the Sentinel session: verified-link plan decided as above.

2026-09-24 (morning): R4 built, reviewed (Codex + independent; findings 1–5 handled, 6–10 deferred) and merged as PR #12 at 09:36 UTC.

## Validation

Fresh on `082cffa`: `pnpm -r test` exit 0 (core 54, api 208); `pnpm -r typecheck` exit 0; `pnpm exec biome check .` exit 0 (112 files); `drizzle-kit check` exit 0; `test:pg` 7/7 exit 0 (new completion-versus-close race, 50 rounds); `git diff --check` exit 0.

## Known Issues / Watch List

- `main` must not be deployed before 0006 and, once R5 merges, 0007 are applied to Neon (separate authorization, like 0003–0005). 0007 drops and recreates the artifact uniqueness index as a partial one; existing rows satisfy it.
- Cutover is still a separate step: deploy, bootstrap MYCEL's reward config and first epoch, BotFather menu (add `/effort`), confirm `reward-recovery` and `reward-close` in the worker log. Not authorized.
- R5 interpretations the reviewer should check (record, "Interpretations"): reason precedence, close driven by the 5-minute sweep, one epoch materialized per close, reuse of R1's aggregation instead of a new core module, re-entry shape and timing from the original submission, no decision hash in the snapshot yet.
- Two R5 tests passed before their code (boundary intake: existing behavior; `/submit` after re-entry: row order), and the `test:pg` race was written after the code. Stated in the record.
- The worker wiring (recovery sweep, notify marker, close job) has never run against pg-boss. No CI.
- A decision's message can be sent twice (crash after Telegram accepts, before the mark).

## Next Actions

1. Push `feat/r5-close-snapshot`, open the R5 PR, run an independent review; fix valid findings test-first.
2. Merge on Cisco's yes.
3. Verified-link build on `feat/verified-link-sdk`'s plan, only on a separate yes after R5 merges.
4. Weekly video #2 on Friday per `docs/demo/2026-09-25-weekly-video-2.md`.
5. Pending Cisco decisions: cutover timing (decision 1) and calendar (decision 3). Decision 2 is resolved.

## Quick Reference

- R5 record: `docs/handoffs/2026-09-24-r5-implemented.md`
- Close: `closeEpoch(db, { communityId, epochId })`; due list `dueCloses(db, now)`; queue `reward-close`
- Correction script: `apps/api/scripts/reward-correct.ts <contribution-id> --expected-revision <n> --reason "<text>" --evidence <ref> [--raw-quality N] [--flags a,b|none] [--effort eligible|ineligible]`
- Real-Postgres gate: `pnpm --filter @hyphae/api test:pg` (Docker)

## Suggested skills

`handoff-memory` (resume), `code-review` or `superpowers:requesting-code-review` (R5 PR), `superpowers:receiving-code-review` (findings), `superpowers:test-driven-development` (fixes, verified-link build), `supabase:supabase-postgres-best-practices` (`member_wallet_links`), `handoff`.

## Resume Checklist

- `git fetch --prune && git status -sb`; check the R5 PR state (`gh pr list`).
- Re-run the gate and `test:pg` (Docker running) on whatever you merge.
- No deploy, bootstrap, or 0006/0007 apply without Cisco's separate yes. No verified-link code before R5 merges and its own yes.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| R5 code + migration 0007 | `feat/r5-close-snapshot` (`082cffa`) | Not merged, not applied |
| R5 record | `docs/handoffs/2026-09-24-r5-implemented.md` | |
| Build log | `docs/BUILDLOG.md` | 2026-09-24 (afternoon) entry |

No Neon changes, credentials, deployments or live scheduled jobs.

## Next-session prompt

```text
Resume Hyphae. R5 (strict close, frozen snapshot, re-entry) is on feat/r5-close-snapshot; record docs/handoffs/2026-09-24-r5-implemented.md. Read CLAUDE.md and docs/HANDOFF.md. If the R5 PR is not merged: run or read its independent review, fix valid findings test-first, re-run the full gate (pnpm -r test; pnpm -r typecheck; pnpm exec biome check .; pnpm --filter @hyphae/db exec drizzle-kit check; pnpm --filter @hyphae/api test:pg; git diff --check), and merge only on Cisco's yes. After the merge, the verified-link build (plan on feat/verified-link-sdk, worktree DEVELOPMENTS/hyphae-verified-link) starts only on a separate yes.
Out of bounds: deploy, bootstrap, applying 0006/0007, R6, settlement/root/claim, fixture or paid runs, Sentinel code, vault edits.
```
