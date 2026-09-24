---
date: 2026-09-24
summary: Production still runs main b7bfe55 (cutover done Sep 24; MYCEL epoch 1 2026-09-25T00:00Z to 2026-10-02T00:00Z). This session recorded the schedule rulings and wrote the H-CONTRACT proposal (Part A yes/no list for Friday), the payment-definitions proposal, the calendar to Oct 12, the audit-page build plan and a complete Runbook B with a pending token re-rotation, and fixed /me in private chats (not deployed). Blocked: the audit-page build waits for Cisco's Part A ruling. Payout target moved to epoch 2 (closes Oct 9) because the approved policy needs the rules test live before the first paid epoch opens.
---

# Hyphae handoff

## TL;DR

**Next: Cisco rules H-CONTRACT Part A** (15 yes/no lines in `docs/handoffs/2026-09-25-h-contract-proposal.md`; ruling proposed for Fri Sep 25, due Sep 27). The audit-page build (`docs/handoffs/2026-09-25-audit-page-plan.md`) starts once his words are recorded in `docs/handoffs/`. Also open: the bot token re-rotation (Runbook B step 9), and early rulings on payment items P9 and P12. **The payout target is now epoch 2 (closes 2026-10-09T00:00Z)**, which needs the rules test and the hold gate live before 2026-10-02T00:00Z.

## Metadata

- Last Updated: 2026-09-24 (night). Snapshot: `docs/handoffs/2026-09-24-proposals-session-end.md`. This session's documents: `2026-09-24-founder-rulings.md`, `2026-09-25-h-contract-proposal.md`, `2026-09-25-payment-definitions-proposal.md`, `2026-09-25-plan.md` (supersedes `2026-09-24-plan.md`), `2026-09-25-audit-page-plan.md`, and Runbook B in `2026-09-24-cutover-decisions.md`. Cutover record: `2026-09-24-cutover.md`.
- Branches: only `main` (= `origin/main`).
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`), effort xhigh (set by `/effort` at session start), Windows, 2026-09-24. The session prompt preferred Fable 5.1; this session ran on Opus 5.5.
- Authority: schedule rulings of 2026-09-24 ("do your recommendation", `2026-09-24-founder-rulings.md`): H-CONTRACT Part A by Sep 27 with the audit-page build starting on that ruling; Part B and the fee, funding and payment definitions by Sep 30; cutover Mon Sep 28, which ran early on Sep 24 on Cisco's in-session yes. Session prompt (organic-sync board, 2026-09-24) for steps 1–7 of this arc.
- Canonical private plan: read-only this session (board rulings, integration contract); not edited.

## Current Objective

Get H-CONTRACT Part A ruled and build the public audit page on it. Then get the rules test and hold gate live before epoch 2 opens (2026-10-02T00:00Z), so that epoch 2 can be the first paid epoch.

## Current State

- Fly `hyphae-api`: api + worker on `b7bfe55` (image `deployment-01M3A6PDECR4D9AP1TSJYDBSP3`). Rollback image `deployment-01M2R8W6Z6NAAWYM6KT2ZDYA2H` (Sep 17; **it logs the bot token on handler errors**, so a rollback means a rotation too).
- Neon: 0000–0008. 1 community (Hyphae Lab, MYCEL), 1 member with a signed wallet.
- Rewards: epoch 1 2026-09-25T00:00Z → 2026-10-02T00:00Z, config `1c822678…40a` (rubric 1.2.0). Points only; epoch 1 is not payable under the approved policy (no rules test when it opened).
- `main` is ahead of production by one bot fix (`5ee7a8b`, `/me` private-chat reply) and docs. The fix ships with the next deploy.
- Anchor program: still the `initialize` stub. `apps/web`: does not exist yet.

## Recent Changes (this session)

- `0723674` docs: 2026-09-24 schedule rulings recorded; handoff authority updated.
- `b7afc9c` docs: H-CONTRACT proposal. Part A: five public GET routes (`/v1/communities/:mint`, `…/epochs/:index`, `…/epochs/:index/contributions`, `…/leaderboard?epoch=`, `/v1/contributions/:id`), wire conventions, privacy boundary, states, honest unavailable, lock-free reads, admin actor `admin:<handle>` with corrections script-only. Part B: RFC 8785 profile, tag-prefixed SHA-256, config/evidence/decision hashes with predecessor chain, member-epoch manifest as the existing 89-byte leaf's evidence hash, anchored epoch audit hash, a shared TS/Rust vector file.
- `3698a7d` docs: payment definitions P1–P16 (Lab-funded SOL vault, 3% of gross floored at publish, exact-unit allocation, 25% cap, retained shown separately, claim receipts as proof).
- `b6952e8` docs: calendar Sep 25 → Oct 12, with owners and dependencies; go/no-go Oct 1.
- `21aecdb` docs: audit-page build plan (15 test-first tasks). It lives in `docs/handoffs/`, not the prompt's `docs/plans/`, because `docs/plans/` is gitignored.
- `e880eb8` docs: Runbook B complete on its own, with step 9 (token re-rotation) and the rollback note.
- `5ee7a8b` fix(bot): `/me` in a private chat answers "Send /me in your community chat."

## Validation

On `5ee7a8b`: `pnpm -r test` exit 0 (core 54, api 271); `pnpm -r typecheck` exit 0; Biome on tracked files exit 0 (138 files) and on the two changed files exit 0; `drizzle-kit check` exit 0; `test:pg` 11/11 exit 0; `git diff --check` exit 0. The new `/me` test failed on the old reply ("This chat is not a registered Hyphae community.") before the fix.

Review: the only code change is a one-line bot reply (no money, rewards, auth, wallet or migration path), so no cross-family review. The read API build requires a Codex data-exposure review (plan Task 15).

## Known Issues / Watch List

- **Bot token re-rotation is open** (Runbook B step 9). The token set on Sep 24 ran on the Sep 17 image until the 17:17Z deploy, and that image logged the token on handler errors.
- **First reward-path traffic is untested in production.** After 2026-09-25T00:00Z, one real `/submit`; watch `reward-evaluation` in the worker log.
- **The payout depends on two unbuilt gates:** the rules test and the hold gate, both needed before 2026-10-02T00:00Z (payment proposal P9, P12). Neither has a plan yet.
- Organic's adapter defaults absent fields to zero or empty (`open_raids`, `rules_test_passed`, `strikes`) and expects `pot_lamports`; see the proposal's "Downstream: Organic".
- `/me` prints `${PUBLIC_WEB_URL}/w/<wallet>`, which can show a pasted wallet and points to a page that won't exist. Plan Task 12 replaces it.
- R6 must add the decision hash before any root (R5 C3); Part B B5–B6 propose how.
- No CI; the local gate is the only gate.

## Next Actions

1. **Cisco:** rule Part A (A1–A15) and, if possible, payment P9 and P12 on Fri Sep 25. Record his exact words in `docs/handoffs/`.
2. **Cisco:** Runbook B step 9 (token re-rotation), one step per message.
3. After 2026-09-25T00:00Z: one real `/submit` in Hyphae Lab; verify the reward path read-only.
4. On the Part A ruling: build per `docs/handoffs/2026-09-25-audit-page-plan.md`; Codex review of the read API before pushing.
5. Rules-test scope proposal and hold-gate plan (Sep 26–27), per `2026-09-25-plan.md`.

## Quick Reference

- Runbook B (complete, incl. step 9 and rollback): `docs/handoffs/2026-09-24-cutover-decisions.md`.
- Calendar: `docs/handoffs/2026-09-25-plan.md`. Proposals: `2026-09-25-h-contract-proposal.md`, `2026-09-25-payment-definitions-proposal.md`.
- Payout wallet: `walletAt(db, memberId, epoch.closesAt)` in `apps/api/src/link/wallet-links.ts`; payable only if `method === "signature"`.
- Bot wiring: `apps/api/src/bot/index.ts`; `/me`: `bot/commands/me.ts`, `me-summary.ts`.
- Local gate: `pnpm -r test; pnpm -r typecheck; git ls-files -z '*.ts' '*.json' '*.js' | xargs -0 pnpm exec biome check; pnpm --filter @hyphae/db exec drizzle-kit check; pnpm --filter @hyphae/api test:pg` (Docker); `git diff --check`.

## Suggested skills

- `handoff-memory` (resume this handoff).
- `superpowers:test-driven-development` (audit-page build; rules test; hold gate).
- `superpowers:writing-plans` (rules-test scope, hold-gate plan).
- `superpowers:verification-before-completion` (end-to-end seeded epoch render).
- `handoff` (session end).

## Resume Checklist

- `git fetch --prune && git status -sb` (expect `main` = `origin/main`).
- Check `docs/handoffs/` for a recorded Part A ruling before starting the build.
- Docker Desktop running before `test:pg`.
- No deploy, Neon change, Fly secret, token change, rubric proposal, package publish, public post or mainnet transaction without Cisco's separate yes. Cisco runs Fly and Neon-write commands in his own terminal, **one manual step per message**.

## Next-session prompt

```text
Resume Hyphae. Read CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-09-25-h-contract-proposal.md, 2026-09-25-audit-page-plan.md and 2026-09-25-plan.md. Production runs b7bfe55; main carries one undeployed /me fix (5ee7a8b) plus docs. If docs/handoffs records Cisco's Part A ruling, build the read API v1 and apps/web test-first per the audit-page plan (adjust any task a "no" line touches), get a Codex review of the read API for data exposure, and finish when a locally seeded epoch renders end to end and the full gate passes. If it is not recorded, present Part A's 15 lines to Cisco and record his exact words first. Separately, walk Cisco through Runbook B step 9 (token re-rotation), ONE step per message.
Stops: a read route that would expose Telegram ids, unverified wallets or unpublished decisions; any deploy, Fly secret, token change, Neon write or mainnet action without Cisco's yes.
```
