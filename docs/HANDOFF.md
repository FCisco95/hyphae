---
date: 2026-09-24
summary: R5 and verified wallet linking are both on main, each after a Codex review with its findings fixed test-first. Hyphae works trunk-based under the solo-founder working agreement. Migrations 0006, 0007 and 0008 are not applied to Neon; nothing is deployed; LINK_ORIGIN is not set on Fly. Next: a hands-on wallet check with Cisco, then the cutover on separate authorization.
---

# Hyphae handoff

## TL;DR

**R5 (strict close, frozen snapshot, re-entry) and verified wallet linking are on `main`, locally tested, not deployed.** `/link` now hands a member a private, single-use, 15-minute link; the wallet signs a readable message; `@organichub/verify` 0.1.0 checks it; one transaction consumes proof and session and writes the wallet plus append-only history. Payouts must resolve wallets with `walletAt(memberId, closesAt)` and require `method = 'signature'`. **Migrations 0006–0008 are not applied, and the new image needs `LINK_ORIGIN` or it will not boot**, so `main` must not be deployed yet.

## Metadata

- Last Updated: 2026-09-24 (night). Records: `docs/handoffs/2026-09-24-verified-link-implemented.md` (acceptance matrix, review, evidence), `docs/handoffs/2026-09-24-r5-implemented.md` (R5 review C1–C3).
- Branches: only `main` (= `origin/main`). `feat/r5-close-snapshot` and `feat/verified-link-sdk` are merged and deleted, and the `hyphae-verified-link` worktree is removed.
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows, 2026-09-24. Effort is not observable in-session.
- Authority: O1–O7; R3–R5 approval (build yes, apply no); 0005; 0006; R5 shape; working agreement adopted 2026-09-24 (`0d11a81`); verified-link plan D1–D6 decided 2026-09-24, build started on the session prompt's yes.
- Canonical private plan: not read or edited this session.

## Current Objective

Prepare the cutover: a hands-on wallet check, then (each on its own yes) Neon apply of 0006–0008, `LINK_ORIGIN` on Fly, deploy, bootstrap.

## Current State

- On `main`, not deployed: R3, F1–F4, R4 (0006), R5 (0007), verified linking (0008). Neon has 0000–0005.
- Verified linking: `apps/api/src/link/` (config, sessions, store, routes, page), `bot/commands/link.ts`, `/me` wallet lines. Pasted `/link <address>` is removed (D1). The page is served at `<LINK_ORIGIN>/link`.
- Fly runs the Sep 17 image.

## Recent Changes

2026-09-24 (night): verified linking built test-first (Tasks 1–7 of the plan), Codex review (one medium finding, fixed in `3e00174`), guide §7 acceptance tests added, landed on `main`.

2026-09-24 (evening): working agreement adopted; R5 reviewed by Codex (C1, C2 fixed; C3 deferred to R6) and landed on `main`.

## Validation

Fresh on the verified-link tip `3e00174` and again on `main` after the fast-forward: `pnpm -r test` exit 0 (core 54, api 252); `pnpm -r typecheck` exit 0; `pnpm exec biome check .` exit 0 (134 files); `drizzle-kit check` exit 0; `test:pg` 11/11 exit 0; `git diff --check` exit 0.

## Known Issues / Watch List

- Do not deploy `main` before 0006, 0007 and 0008 are applied and `LINK_ORIGIN` is set on Fly (the env schema requires it; api and worker both parse it).
- 0008 backfills one open `paste` history row per existing member (tested on a migrate-to-0007-then-0008 run).
- The manual wallet check (plan Task 8 step 3) has not been run: Phantom and Solflare prompts, `getChatMember` in a supergroup where the bot is not an admin. Needs Cisco, a test bot token, a test group and an HTTPS tunnel; never `@hyphaeprotocol_bot`.
- Membership is checked when the link session opens, not at signing (Review Focus 5, accepted).
- R6 must add the decision hash to snapshot entries before any root (R5 review C3), and must pay only `walletAt(..., closesAt)` wallets with `method = 'signature'`.
- No log-capture test for "no secrets in logs"; it holds by construction (`fail()` logs `{ link, code }` only).
- The worker wiring has never run against pg-boss. No CI; the local gate is the only gate.

## Next Actions

1. Manual wallet check with Cisco (test bot, test group, HTTPS tunnel, `LINK_ORIGIN` = tunnel origin).
2. Cutover on separate yeses: apply 0006–0008 to Neon, set `LINK_ORIGIN` on Fly, deploy, bootstrap MYCEL's reward config and first epoch, BotFather menu (`/effort`, new `/link` text).
3. Hold gate (`checkHold`, guide §6) as its own plan.
4. Weekly video #2 on Friday per `docs/demo/2026-09-25-weekly-video-2.md`.
5. Pending Cisco decisions: cutover timing (decision 1) and calendar (decision 3).

## Quick Reference

- Payout wallet: `walletAt(db, memberId, epoch.closesAt)` in `apps/api/src/link/wallet-links.ts`; payable only if `method === "signature"`.
- Link endpoints: `GET /link`, `GET /link/app.js`, `POST /link/request|verify|status`.
- Close: `closeEpoch(db, { communityId, epochId })`; queue `reward-close`.
- Local gate: `pnpm -r test; pnpm -r typecheck; pnpm exec biome check .; pnpm --filter @hyphae/db exec drizzle-kit check; pnpm --filter @hyphae/api test:pg` (Docker); `git diff --check`.

## Suggested skills

`handoff-memory` (resume), `superpowers:test-driven-development`, `codex:rescue` / Codex adversarial review (before each push of reward, wallet or migration work), `supabase:supabase-postgres-best-practices` (cutover SQL checks), `handoff`.

## Resume Checklist

- `git fetch --prune && git status -sb`; `git worktree list`.
- Re-run the gate (Docker running) before every push to `main`.
- No deploy, bootstrap, Neon migration, Fly secret, package publish or mainnet transaction without Cisco's separate yes.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Working agreement | `AGENTS.md`, `CLAUDE.md` (`0d11a81`) | |
| R5 + review fixes | `main` (`7809c67`..`a4d8cd7`) | 0007 not applied |
| Verified linking | `main` (`a4265f7`..`3e00174`) | 0008 not applied |
| Records | `docs/handoffs/2026-09-24-r5-implemented.md`, `docs/handoffs/2026-09-24-verified-link-implemented.md` | Reviews, evidence, acceptance matrix |
| Build log | `docs/BUILDLOG.md` | Evening and night entries |

No Neon changes, credentials, deployments or live scheduled jobs.

## Next-session prompt

```text
Resume Hyphae. Read CLAUDE.md, AGENTS.md (working agreement) and docs/HANDOFF.md. R5 and verified wallet linking are on main, locally tested, not deployed; migrations 0006-0008 are not applied and LINK_ORIGIN is not set on Fly. If Cisco is available, run the manual wallet check from docs/handoffs/2026-09-24-verified-link-implemented.md with a test bot and group over an HTTPS tunnel. Otherwise prepare the cutover runbook (read-only Neon checks, apply order 0006-0008, Fly secret, deploy, bootstrap) for Cisco's yes.
Hard stops: applying migrations to Neon, deploy or bootstrap, Fly secrets, mainnet transactions, package publishes, public posts, deleting unmerged work, writes outside this repo.
```
