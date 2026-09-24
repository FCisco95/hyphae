---
date: 2026-09-24
summary: R5 (strict close, frozen snapshot, re-entry) is on main at a4d8cd7 after a Codex review (two findings fixed test-first, the decision hash deferred to R6). The organic-sync working agreement is adopted: trunk-based, no PRs, a cross-model review replaces the PR. Migrations 0006 and 0007 are still not applied to Neon. Nothing deployed or bootstrapped. Next: the verified-link build on feat/verified-link-sdk.
---

# Hyphae handoff

## TL;DR

**R5 is on `main` (`a4d8cd7`, pushed; PR #13 shows as merged).** An epoch closes once, at its scheduled `closesAt`, into a frozen snapshot. Live nominations expire, the next epoch opens, and a late answer counts for nothing. An expired, never-judged artifact can re-enter the next epoch as new work, and it is judged on the post as it reads at re-entry. Codex found two real problems, both fixed test-first; the decision hash waits for R6. Hyphae now works trunk-based under the solo-founder working agreement (`AGENTS.md`, `CLAUDE.md`). **Migrations 0006 and 0007 are not applied**, so `main` must not be deployed yet.

## Metadata

- Last Updated: 2026-09-24 (evening). R5 record with the review verdict and dispositions: `docs/handoffs/2026-09-24-r5-implemented.md`. R4 record: `docs/handoffs/2026-09-24-r4-implemented.md`.
- Branches: `main` = `origin/main` = `a4d8cd7`. `feat/verified-link-sdk` (docs only, plan) lives in its own worktree at `DEVELOPMENTS/hyphae-verified-link`. `feat/r5-close-snapshot` is deleted locally and on origin.
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows, 2026-09-24. Effort is not observable in-session.
- Authority: O1–O7 (`2026-09-20-h-design-written-approval.md`); R3–R5 approval (`2026-09-23-r3-r5-approval.md`, build yes, apply no); 0005 (`2026-09-23-f3-notified.md`); 0006 (`2026-09-24-r4-implemented.md`); R5 shape (`2026-09-24-r5-implemented.md`); working agreement adopted by Cisco on 2026-09-24 (session prompt), commit `0d11a81`.
- Canonical private plan: not read or edited this session.

## Current Objective

Build verified wallet linking from `docs/handoffs/2026-09-24-verified-link-sdk-plan.md` (on `feat/verified-link-sdk`; Cisco decided D1–D6), test-first, and land it on `main` the trunk way after a cross-model review.

## Current State

- On `main`, not deployed: R3, F1–F4, R4 (migration 0006) and R5 (migration 0007). Neon has migrations 0000–0005 only.
- R5 pieces: `rewards/close.ts` (`closeEpoch`, `dueCloses`), `selectEffective`, the `reward-close` queue on the 5-minute sweep, `completed_after_cutoff`, re-entry in `rewards/slots.ts` (`needs_evidence` until `/effort` supplies a fresh capture via `capturedEvidence()`), snapshot tables with a whole-points rounding check.
- Working agreement: commit to `main` after each verified milestone, push once the local gate passes, no feature branches or PRs unless Cisco asks; the other model family reviews money, rewards, auth, wallet, security and migration changes before the push.
- Fly runs the Sep 17 image.

## Recent Changes

2026-09-24 (evening): working agreement committed (`0d11a81`) and pushed. Codex review of R5 (PR comment + local adversarial pass, verdict needs-attention): C1 stale evidence on re-entry fixed (`b12ec98`), C2 whole-points rounding check fixed in 0007 (`975dd42`), C3 decision hash deferred to R6 (O7 contract gate). R5 rebased onto `main`, fast-forwarded, gate re-run on `main`, pushed; branch deleted.

2026-09-24 (afternoon): R5 built test-first. Verified-link plan decided (D1–D6).

## Validation

Fresh on `main` at `a4d8cd7`: `pnpm -r test` exit 0 (core 54, api 213); `pnpm -r typecheck` exit 0; `pnpm exec biome check .` exit 0 (112 files); `drizzle-kit check` exit 0; `test:pg` 7/7 exit 0 (Docker, Postgres 17); `git diff --check` exit 0. The same gate also passed on the branch before the merge.

## Known Issues / Watch List

- `main` must not be deployed before 0006 and 0007 are applied to Neon (separate authorization, like 0003–0005). 0007 drops and recreates the artifact uniqueness index as a partial one; existing rows satisfy it. It also adds `reward_snapshot_members_whole_points`, which only constrains the new (empty) table.
- Cutover is a separate step: apply 0006/0007, deploy, bootstrap MYCEL's reward config and first epoch, BotFather menu (add `/effort`), confirm `reward-recovery` and `reward-close` in the worker log. Not authorized.
- R6 must add the versioned decision hash to snapshot entries before any root or claim is built from a snapshot (review C3). Until then the snapshot is an internal close record.
- `/effort`'s re-entry glue (fetch, second `nominate`) has no unit test, like the other command handlers; the logic it calls is tested.
- The worker wiring (recovery sweep, notify marker, close job) has never run against pg-boss. No CI; the local gate is the only gate.
- A decision's message can be sent twice (crash after Telegram accepts, before the mark).

## Next Actions

1. Verified-link build: rebase `feat/verified-link-sdk` on `main` in its worktree, execute the plan task by task test-first, get a Codex review, land on `main`, delete the branch.
2. Its migration joins 0006/0007 on the cutover apply list; applying needs Cisco's separate yes.
3. Weekly video #2 on Friday per `docs/demo/2026-09-25-weekly-video-2.md`.
4. Pending Cisco decisions: cutover timing (decision 1) and calendar (decision 3).

## Quick Reference

- R5 record: `docs/handoffs/2026-09-24-r5-implemented.md`
- Close: `closeEpoch(db, { communityId, epochId })`; due list `dueCloses(db, now)`; queue `reward-close`
- Correction script: `apps/api/scripts/reward-correct.ts <contribution-id> --expected-revision <n> --reason "<text>" --evidence <ref> [--raw-quality N] [--flags a,b|none] [--effort eligible|ineligible]`
- Local gate: `pnpm -r test; pnpm -r typecheck; pnpm exec biome check .; pnpm --filter @hyphae/db exec drizzle-kit check; pnpm --filter @hyphae/api test:pg` (Docker); `git diff --check`

## Suggested skills

`handoff-memory` (resume), `superpowers:executing-plans` or `superpowers:subagent-driven-development` (verified-link plan), `superpowers:test-driven-development`, `codex:rescue` / Codex adversarial review (cross-model review before push), `supabase:supabase-postgres-best-practices` (`member_wallet_links`), `handoff`.

## Resume Checklist

- `git fetch --prune && git status -sb`; `git worktree list`.
- Re-run the gate (Docker running) before every push to `main`.
- No deploy, bootstrap, Neon migration, package publish or mainnet transaction without Cisco's separate yes.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Working agreement | `AGENTS.md`, `CLAUDE.md` (`0d11a81`) | Managed block from cisco-brain `/organic-sync` |
| R5 + review fixes | `main` (`7809c67`..`a4d8cd7`) | 0007 not applied |
| Review record | `docs/handoffs/2026-09-24-r5-implemented.md` | Verdict + C1–C3 |
| Build log | `docs/BUILDLOG.md` | 2026-09-24 (evening) entry |

No Neon changes, credentials, deployments or live scheduled jobs.

## Next-session prompt

```text
Resume Hyphae. Read CLAUDE.md, AGENTS.md (working agreement: trunk-based, no PRs, cross-model review replaces the PR) and docs/HANDOFF.md. R5 is on main (a4d8cd7); migrations 0006 and 0007 are not applied to Neon. Continue the verified-link build from docs/handoffs/2026-09-24-verified-link-sdk-plan.md on feat/verified-link-sdk in its worktree (DEVELOPMENTS/hyphae-verified-link), test-first; get a Codex review of the arc, fix findings test-first, run the full local gate, rebase and fast-forward onto main, push, delete the branch.
Hard stops: applying any migration to Neon, deploy or bootstrap, mainnet transactions, package publishes, public posts, secrets, deleting unmerged work, writes outside this repo.
```
