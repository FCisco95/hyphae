---
date: 2026-09-24
summary: Production still runs main b7bfe55 (MYCEL epoch 1 2026-09-25T00:00Z to 2026-10-02T00:00Z). Cisco ruled H-CONTRACT Parts A and B and the payment definitions ("I like all your recommendations."). On that ruling the public read API v1 and the audit site were built test-first, Codex-reviewed (needs-attention, two fixes, then ship) and verified end to end on a seeded local epoch. Not deployed. Next: Cisco's token re-rotation, then deploying the api and creating the Vercel site, then the rules test and hold gate by Oct 1 so epoch 2 can be the first paid epoch.
---

# Hyphae handoff

## TL;DR

**The audit page exists, locally.** `main` has read API v1 (`/v1/…`, five public GET routes) and `apps/web` (Next.js 16), verified end to end on real Postgres with a seeded epoch, Codex verdict **ship** after two fixes. Nothing new is deployed. **Next, all Cisco:** (1) Runbook B step 9 token re-rotation; (2) deploy `main` to Fly (adds `/v1` and the `/me` fixes); (3) create the Vercel project for `apps/web`. Then the agent builds the rules test and hold gate, which must be live before 2026-10-02T00:00Z for epoch 2 to be payable.

## Metadata

- Last Updated: 2026-09-24 (late night). Snapshot: `docs/handoffs/2026-09-24-audit-built-session-end.md`. Session records: `2026-09-24-contract-and-payment-rulings.md` (the ruling), `2026-09-24-audit-page-built.md` (build, deviations, evidence, review). Earlier this session: `2026-09-24-founder-rulings.md`, `2026-09-25-h-contract-proposal.md`, `2026-09-25-payment-definitions-proposal.md`, `2026-09-25-plan.md`, `2026-09-25-audit-page-plan.md`, Runbook B in `2026-09-24-cutover-decisions.md`.
- Branches: only `main` (= `origin/main` after this session's push).
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`), effort xhigh, Windows, 2026-09-24. The session prompt preferred Fable 5.1; this session ran on Opus 5.5.
- Authority: schedule rulings (`2026-09-24-founder-rulings.md`); H-CONTRACT Parts A and B and payment P1–P16 ruled yes, pot 0.5 SOL, admin handle `admin:cisco`, fee address still to be named (`2026-09-24-contract-and-payment-rulings.md`).
- Canonical private plan: read-only this session; not edited.

## Current Objective

Ship the audit page to production and get the rules test and hold gate live before epoch 2 opens (2026-10-02T00:00Z), so epoch 2 can be the first paid epoch (payout Oct 9–10). Cisco's go/no-go on the mainnet payout is Thu Oct 1 (`2026-09-25-plan.md`).

## Current State

- Fly `hyphae-api`: api + worker on `b7bfe55` (image `deployment-01M3A6PDECR4D9AP1TSJYDBSP3`). Rollback image `deployment-01M2R8W6Z6NAAWYM6KT2ZDYA2H` (Sep 17; it logs the bot token on handler errors, so a rollback means a rotation too).
- Neon: 0000–0008 (no new migration this session). 1 community (Hyphae Lab, MYCEL), 1 member with a signed wallet.
- Rewards: epoch 1 2026-09-25T00:00Z → 2026-10-02T00:00Z (never paid: it opened before the rules test). Epoch 2 → 2026-10-09T00:00Z.
- `main` ahead of production: read API v1 (`apps/api/src/http`), `apps/web`, `/me` private-chat reply and `/c/<mint>` link, docs.
- Anchor program: still the `initialize` stub.

## Recent Changes (this session, after the proposals)

- `201419e` docs: Cisco's ruling recorded.
- `6f7c77d` core `exactPoints`, `creditRule`; `4129605` read API v1 schemas (strict + loose).
- `772447a` demo seed through the real reward functions; `e15de78` lock-free read service; `9db438b` `/v1` routes mounted; `b65d1ed` data-exposure test; `61b7701` `/me` links `/c/<mint>`.
- `fceea17`, `a1765ee`, `9c4f102` `apps/web`: client, four pages, styles.
- `c59f2c1` docs: `TESTING.md` is now the invite checklist for the deployed bot, with the public-audit notice; whitepaper status after the cutover.
- `0641702`, `51241ca` review fixes (linear ranking; SQL paging; closing states mirror `close.ts`); `95d64e1` flaky test fixed.

## Validation

On `95d64e1`: `pnpm -r test` exit 0 three runs in a row (core 67, web 14, api 299); `pnpm -r typecheck` exit 0; Biome on tracked files exit 0 (168 files); `drizzle-kit check` exit 0; `test:pg` 11/11; `next build` exit 0; `git diff --check` exit 0. End to end on local Postgres 17 with the built api and site: 10/10 page checks, no private data, no "paid"/"claimed", unavailable state shown with the api down.

Review: Codex, fresh session, diff inline: **needs-attention** (C1 per-request work grows with the epoch; C2 closing epochs showed `pending`), both fixed (`51241ca`, C2 test-first); follow-up **ship**, no findings. Details: `2026-09-24-audit-page-built.md`.

## Known Issues / Watch List

- **Bot token re-rotation still open** (Runbook B step 9).
- **First reward-path traffic is untested in production** (epoch 1 opens 2026-09-25T00:00Z).
- **Unverified outside this machine:** `/v1` has only run against local Postgres 17 (not the Neon pooler), and `apps/web` has only built with local `next build`, not on Vercel (pnpm workspace root, `nodenext` tsconfig). Check both on the first deploy.
- **Rules test and hold gate are unbuilt** and gate the first payout (P9, P12). Both need plans on Sep 26–27.
- `PUBLIC_WEB_URL` on Fly defaults to `https://hyphae.fun`, which does not resolve. After the site is on Vercel, set it to the site's URL so `/me`'s link works.
- The public api is not rate-limited; epoch and leaderboard reads cost O(epoch size). Fine at hackathon scale; add a limit or edge cache if the api URL is published beyond the site.
- The correction script still records `script:reward-correct`; the `--actor admin:<handle>` flag (A14) needs a session scoped to `apps/api/scripts`.
- Organic's adapter changes (DEP-01) are Organic's: see the H-CONTRACT proposal's downstream section.
- No CI; the local gate is the only gate.

## Next Actions

1. **Cisco:** Runbook B step 9, token re-rotation (one step per message).
2. **Cisco:** deploy `main` (runbook commands: repo root, `--depot=false`); agent verifies `/v1/communities/<MYCEL mint>` read-only.
3. **Cisco:** Vercel project for `apps/web` (root `apps/web`, env `HYPHAE_API_URL=https://hyphae-api.fly.dev`, `DEFAULT_MINT=<MYCEL mint>`), then `fly secrets set PUBLIC_WEB_URL=<site URL>`.
4. After 2026-09-25T00:00Z: one real `/submit` in Hyphae Lab; verify the reward path and see it on the audit page.
5. Agent: rules-test scope proposal and hold-gate plan (Sep 26–27), build both by Oct 1.
6. Cisco: name the fee address (P8) before the mainnet publish; invite testers with `docs/TESTING.md`.

## Quick Reference

- Read API: `apps/api/src/http/{read-service,routes}.ts`; schemas `packages/core/src/read-api.ts`; exposure test `apps/api/src/http/exposure.test.ts`.
- Site: `apps/web` (`pnpm --filter @hyphae/web dev|build|test`), env `HYPHAE_API_URL`, `DEFAULT_MINT`. `tsconfig` uses `nodenext` so Turbopack resolves core's `.js` specifiers; relative imports carry `.js`.
- Local end to end: Postgres 17 in Docker → `drizzle-kit migrate` → `node --import tsx apps/api/src/http/demo-seed.ts` (prints the mint and ids) → built api with a local env file → `next start` with `HYPHAE_API_URL`.
- Runbook B: `docs/handoffs/2026-09-24-cutover-decisions.md`. Calendar: `docs/handoffs/2026-09-25-plan.md`.
- Local gate: `pnpm -r test; pnpm -r typecheck; git ls-files -z '*.ts' '*.tsx' '*.json' '*.js' '*.css' | xargs -0 pnpm exec biome check; pnpm --filter @hyphae/db exec drizzle-kit check; pnpm --filter @hyphae/api test:pg` (Docker); `git diff --check`.

## Suggested skills

- `handoff-memory` (resume).
- `superpowers:writing-plans` (rules-test scope, hold-gate plan).
- `superpowers:test-driven-development` (both gates).
- `vercel:deployments-cicd` or `vercel:vercel-cli` (the site's first deploy, with Cisco).
- `handoff` (session end).

## Resume Checklist

- `git fetch --prune && git status -sb` (expect `main` = `origin/main`).
- Docker Desktop running before `test:pg`.
- No deploy, Neon change, Fly secret, token change, Vercel project, rubric proposal, package publish, public post or mainnet transaction without Cisco's separate yes. Cisco runs Fly and Neon-write commands in his own terminal, one manual step per message.

## Next-session prompt

```text
Resume Hyphae. Read CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-09-24-audit-page-built.md and 2026-09-25-plan.md. Production runs b7bfe55; main adds read API v1 (/v1), apps/web and /me fixes, all reviewed and gate-green, not deployed. With Cisco, ONE manual step per message: (1) Runbook B step 9 token re-rotation; (2) fly deploy of main from the repo root with --depot=false, then verify /health and /v1/communities/<MYCEL mint> read-only; (3) the Vercel project for apps/web (HYPHAE_API_URL, DEFAULT_MINT), then PUBLIC_WEB_URL on Fly. Then write the rules-test scope proposal and the hold-gate plan; both must be live before 2026-10-02T00:00Z for epoch 2 to be payable.
Hard stops (each needs Cisco's explicit yes): deploys, Fly secrets, token changes, Vercel project creation, Neon writes, rubric proposals, mainnet transactions, package publishes, public posts, writes outside this repo.
```
