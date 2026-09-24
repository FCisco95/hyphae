---
date: 2026-09-24
summary: R4 is built test-first on feat/r4-effective-reads and open as PR #12 (effective read, /me for the current epoch, append-only corrections, migration 0006 approved but not applied). Full gate green including test:pg 6/6. Nothing deployed or bootstrapped. Next: Codex's inline comments, an independent review, merge on Cisco's yes; then R5.
---

# Hyphae handoff

## TL;DR

**R4 is open as PR #12 on `feat/r4-effective-reads`. Merge only on Cisco's yes.** It adds one effective-decision read, `/me` for the current epoch, and operator-only corrections with an expected-revision check. Cisco approved migration 0006 in writing for the correction audit fields; it is **not applied** and joins the cutover apply list. `main` = `5fdda31` (PRs #10 and #11 merged). Nothing is deployed or bootstrapped.

## Metadata

- Last Updated: 2026-09-24. Record: `docs/handoffs/2026-09-24-r4-implemented.md` (0006 approval verbatim, interpretations for review, evidence). Plan: `docs/handoffs/2026-09-24-plan.md`.
- Branches: `main` = `origin/main` = `5fdda31`; `feat/r4-effective-reads` pushed (PR #12).
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows, 2026-09-24. Effort is not observable in-session.
- Authority: O1–O7 (`2026-09-20-h-design-written-approval.md`); R3–R5 approval (`2026-09-23-r3-r5-approval.md`); 0005 (`2026-09-23-f3-notified.md`); 0006 (`2026-09-24-r4-implemented.md`).
- Canonical private plan: not read or edited this session.

## Current Objective

Get R4 reviewed and merged (PR #12). R5 (strict close, unfunded snapshot) starts only after that.

## Current State

- On `main` and in Neon's schema (not deployed): R3 plus F1–F4. Neon has migrations 0000–0005.
- On PR #12 only: `rewards/effective.ts`, `bot/commands/me-summary.ts` (+ `me.ts`), `rewards/decisions.ts`, migration 0006, the sweep filter in `rewards/recovery.ts`, `scripts/reward-correct.ts` (+ `reward-correct-args.ts`).
- Fly runs the Sep 17 image.

## Recent Changes

2026-09-24: R4 built test-first (commits `5a2aa91`, `d00824c`, `67673ea`, `5b7083d`, `a6e98b1`, `457aaa0`), records and PR #12.

2026-09-23 (midnight): PR #10 merged; migrations 0003–0005 applied to Neon and verified.

## Validation

Fresh on `457aaa0`: `pnpm -r test` exit 0 (core 54, api 187); `pnpm -r typecheck` exit 0; `pnpm exec biome check .` exit 0 (108 files); `drizzle-kit check` exit 0; `test:pg` 6/6 exit 0; `git diff --check origin/main...HEAD` exit 0.

## Known Issues / Watch List

- Once PR #12 merges, `main` must not be deployed before 0006 is applied to Neon (separate authorization, like 0003–0005).
- Cutover is still a separate step: deploy, bootstrap MYCEL's reward config and first epoch, BotFather menu (add `/effort`), confirm `reward-recovery` in the worker log about every 5 minutes. Not authorized.
- R4 interpretations the reviewer should check: entry states are `scored`/`pending`/`late` (`excluded` arrives with R5); "current epoch" in `/me` is the most recently opened one; `closed` relies on a `FOR SHARE` read lock (argued, not raced); O6 authority-at-acceptance and predecessor hash wait for H-CONTRACT/R6; members aren't messaged about corrections.
- The worker wiring (recovery sweep, notify marker) has never run against pg-boss. No CI.
- A decision's message can be sent twice (crash after Telegram accepts, before the mark).

## Next Actions

1. PR #12: read Codex's inline comments and handle them per `superpowers:receiving-code-review`; independent review in a fresh session.
2. Merge on Cisco's yes. Then R5 on `feat/r5-close-snapshot`, test-first.
3. Weekly video #2 on Friday per `docs/demo/2026-09-25-weekly-video-2.md`.
4. Pending Cisco decisions from `2026-09-24-plan.md`: cutover timing, wallet-linking route, calendar.

## Quick Reference

- R4 record: `docs/handoffs/2026-09-24-r4-implemented.md`
- R5 scope: `docs/handoffs/2026-09-23-r3-r5-scope-proposal.md` (R5 section)
- Correction script: `apps/api/scripts/reward-correct.ts <contribution-id> --expected-revision <n> --reason "<text>" --evidence <ref> [--raw-quality N] [--flags a,b|none] [--effort eligible|ineligible]`
- Real-Postgres gate: `pnpm --filter @hyphae/api test:pg` (Docker)

## Suggested skills

`handoff-memory` (resume), `superpowers:receiving-code-review` (PR #12 comments), `superpowers:test-driven-development` (R5), `supabase:supabase-postgres-best-practices` (snapshot tables), `handoff`.

## Resume Checklist

- `git fetch --prune && git status -sb`; check PR #12 state (`gh pr view 12 --comments`).
- Re-run the gate and `test:pg` (Docker running) on whatever you merge.
- No deploy, bootstrap or 0006 apply without Cisco's separate yes. No R5 before R4 merges.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| R4 code + migration 0006 | PR #12 | Not merged, not applied |
| R4 record + 0006 approval | `docs/handoffs/2026-09-24-r4-implemented.md` | |
| Build log | `docs/BUILDLOG.md` | 2026-09-24 entry |

No Neon changes, credentials, deployments or live scheduled jobs.

## Next-session prompt

```text
Resume Hyphae. R4 is open as PR #12 (feat/r4-effective-reads); record docs/handoffs/2026-09-24-r4-implemented.md. Read CLAUDE.md and docs/HANDOFF.md. If PR #12 is not merged: read its review comments, fix valid findings test-first, re-run the full gate (pnpm -r test; pnpm -r typecheck; pnpm exec biome check .; pnpm --filter @hyphae/db exec drizzle-kit check; pnpm --filter @hyphae/api test:pg; git diff --check), and merge only on Cisco's yes. Once merged: R5 (strict close, unfunded snapshot) on feat/r5-close-snapshot, test-first, per the R5 section of docs/handoffs/2026-09-23-r3-r5-scope-proposal.md.
Out of bounds: deploy, bootstrap, applying 0006, R6, settlement/root/claim, fixture or paid runs, Sentinel code, vault edits.
```
