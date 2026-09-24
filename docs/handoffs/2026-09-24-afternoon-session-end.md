---
date: 2026-09-24
summary: Manual wallet check (Runbook A) done with Cisco; it found that no real wallet could sign and that bot errors logged the token, both fixed test-first and Codex-reviewed. Production bot token rotated. Group upgrades to supergroups are now followed. All on main (6276948), pushed, not deployed. Migrations 0006-0008 are not applied to Neon; LINK_ORIGIN is not set on Fly. Next is the cutover window (Runbook B), one step at a time, each on Cisco's yes.
---

# Hyphae handoff

## TL;DR

**Everything since Sep 17 is on `main` (`6276948`), pushed, gate green, not deployed.** The manual wallet check passed 6 of 7 checks with Phantom and Solflare after fixing the page's `signMessage` call. The Fly machines still run the **Sep 17 image**, which logs the bot token on any handler error; the production token was rotated as a precaution, and only the cutover deploy takes the fix live. **Next: Runbook B (the cutover), one step per message, each step on Cisco's yes.** The cutover date is not decided yet: ask first.

## Metadata

- Last Updated: 2026-09-24 (afternoon, session end). Snapshot: `docs/handoffs/2026-09-24-afternoon-session-end.md`. Session record: `docs/handoffs/2026-09-24-manual-wallet-check.md` (check results, defects, both reviews, token hygiene, Runbook A corrections). Earlier records: `2026-09-24-cutover-decisions.md` (Runbooks A and B), `2026-09-24-verified-link-implemented.md`, `2026-09-24-r5-implemented.md`.
- Branches: only `main` (= `origin/main` = `6276948`). The empty folder `DEVELOPMENTS/hyphae-verified-link` may still exist (was locked by another process); it contains nothing.
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`), Windows, 2026-09-24.
- Authority: working agreement (`0d11a81`); cutover order and `LINK_ORIGIN=https://hyphae-api.fly.dev` decided by Cisco (`2026-09-24-cutover-decisions.md`); group-upgrade fix built on Cisco's yes this session. The cutover date is **not** decided.
- Canonical private plan: not read or edited this session.

## Current Objective

Run the cutover window (Runbook B in `docs/handoffs/2026-09-24-cutover-decisions.md`): read-only Neon checks, stage `LINK_ORIGIN`, apply 0006–0008, post-checks, deploy, verify, bootstrap, BotFather menu. Every step is a hard stop that needs Cisco's yes.

## Current State

- On `main`, not deployed: R3, F1–F4, R4 (0006), R5 (0007), verified linking (0008), and this session's fixes. Neon has 0000–0005.
- Fly: api + worker on the Sep 17 image (release v5), machines restarted today only to pick up the rotated `TELEGRAM_BOT_TOKEN`. Webhook set to `https://hyphae-api.fly.dev/telegram`. `/me` answers in Hyphae Lab.
- Repo `.env` holds the rotated production token (gitignored).

## Recent Changes (this session)

- `0589e88` fix(link): `solana:signMessage` is variadic; the page passed an array, so no real wallet could sign.
- `dbe8b7e`, `131ee85`, `ade2d2f` fix(bot): handlers run inside `bot.errorBoundary(containBotError)`; under a webhook grammY never calls `bot.catch`, so errors had reached Hono, which logged the whole `BotError` (token included) and answered 500. Logged fields are now named and token-redacted; the member is told a failed command may not have finished.
- `e03e7eb`, `36d1251` fix(bot): follow a basic group's upgrade to a supergroup (`migrate_to_chat_id` / `migrate_from_chat_id`); a collision with another community moves nothing and logs a conflict.
- Docs: `20e8315`, `515fe83`, `6276948`.
- Out of repo: test bot token revoked; production bot token rotated, Fly secret set, webhook re-set.

## Validation

Fresh on `36d1251`: `pnpm -r test` exit 0 (core 54, api 270); `pnpm -r typecheck` exit 0; Biome on tracked files exit 0; `git diff --check` exit 0. **Not rerun this session:** `drizzle-kit check` and `test:pg` (no schema or reward-job change). Runbook B step 0 requires the **full** gate on the deploy commit, so run both before the cutover.

Codex reviews (diff passed inline because its sandbox cannot read the workspace): wallet + error fixes needs-attention → fixed (`131ee85`, `ade2d2f`; `ade2d2f` not re-reviewed, covered by tests); group upgrade needs-attention → fixed (`36d1251`). Details in the session record.

## Known Issues / Watch List

- **Do not deploy `main` before 0006–0008 are applied and `LINK_ORIGIN` is set on Fly**: the env schema requires `LINK_ORIGIN`, and api and worker both parse it.
- **The live Sep 17 image still logs the bot token on handler errors** until the cutover deploy. Keep the cutover soon.
- **Keep Hyphae Lab a basic group until the deploy**: the upgrade handling is not live yet.
- Manual check gaps: check 6 (`wallet_taken` across two members) and the non-member refusal were not run by hand (no second Telegram account); `test:pg` races and route tests cover them.
- Accepted limitation: a wallet that prefixes the message before signing is refused (the server verifies exact bytes). Phantom and Solflare work.
- `/me` in a private chat answers "not a registered Hyphae community"; should point to the community chat like `/link` does (small UX fix, parked).
- Runbook B practicalities: Cisco runs Fly commands in his own terminal (the agent's classifier blocks `fly deploy`); pasting a token from Telegram Desktop into PowerShell broke `fly secrets set`, so set secrets from `.env` or type non-secret values like `LINK_ORIGIN` directly; `fly logs --no-tail` hangs and returns nothing here; revoking a bot token clears its webhook.
- R6 must add the decision hash to snapshot entries before any root (R5 review C3), and pay only `walletAt(..., closesAt)` wallets with `method = 'signature'`.
- The worker wiring has never run against pg-boss. No CI; the local gate is the only gate.

## Next Actions

1. Ask Cisco when to run the cutover. If now, Runbook B step 0: run the full gate on `main` (incl. `drizzle-kit check` and `test:pg` with Docker).
2. Runbook B steps 1–8, **one step per message**, each on Cisco's yes; record each result in the build log.
3. After the deploy: re-run a short live check (`/link` in Hyphae Lab with Phantom), then the BotFather menu.
4. Hold gate (`checkHold`, guide §6): its own plan after the cutover.
5. Weekly video #2 on Friday per `docs/demo/2026-09-25-weekly-video-2.md`.

## Quick Reference

- Runbooks: `docs/handoffs/2026-09-24-cutover-decisions.md` (A: manual check, with corrections in `2026-09-24-manual-wallet-check.md`; B: cutover).
- Payout wallet: `walletAt(db, memberId, epoch.closesAt)` in `apps/api/src/link/wallet-links.ts`; payable only if `method === "signature"`.
- Bot wiring: `apps/api/src/bot/index.ts` (error boundary, chat migration, commands); `bot/errors.ts`; `bot/chat-migration.ts`.
- Local gate: `pnpm -r test; pnpm -r typecheck; pnpm exec biome check .; pnpm --filter @hyphae/db exec drizzle-kit check; pnpm --filter @hyphae/api test:pg` (Docker); `git diff --check`. Biome on `.` also lints the gitignored `.claude/settings.local.json` (formatting error, not a repo file); lint tracked files with `git ls-files -z '*.ts' '*.json' '*.js' | xargs -0 pnpm exec biome check`.
- Codex review from Claude Code: `node <codex plugin>/scripts/codex-companion.mjs task --fresh "$(cat prompt-with-inline-diff.txt)"`.

## Suggested skills

- `handoff-memory` (resume this handoff).
- `supabase:supabase-postgres-best-practices` (Runbook B's read-only Neon checks and post-checks).
- `superpowers:verification-before-completion` (evidence for every cutover step before reporting it done).
- `superpowers:test-driven-development` (any fix found during the cutover).
- `handoff` (session end).

## Resume Checklist

- `git fetch --prune && git status -sb` (expect `main` = `origin/main` = `6276948` or later).
- Docker Desktop running before `test:pg`.
- No deploy, Neon migration, Fly secret, bootstrap, package publish, public post or mainnet transaction without Cisco's separate yes.
- Cisco prefers **one manual step per message**, then wait for the result.

## Next-session prompt

```text
Resume Hyphae. Read CLAUDE.md, AGENTS.md and docs/HANDOFF.md. main (6276948) has verified wallet linking, the bot error-boundary fix and group-upgrade handling, all pushed and not deployed; Neon has migrations 0000-0005; Fly runs the Sep 17 image, which logs the bot token on handler errors, so the cutover should happen soon. First ask Cisco whether to run the cutover now. If yes, run Runbook B from docs/handoffs/2026-09-24-cutover-decisions.md: step 0 is the full local gate on main including drizzle-kit check and test:pg. Then give Cisco ONE step per message and wait for his result before the next. Cisco runs Fly commands in his own terminal.
Hard stops (each needs Cisco's explicit yes): applying migrations to Neon, fly secrets, fly deploy, bootstrap (set-rubric), BotFather changes, mainnet transactions, package publishes, public posts, writes outside this repo.
```
