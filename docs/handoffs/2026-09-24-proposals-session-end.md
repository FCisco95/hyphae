---
date: 2026-09-24
summary: Cutover done. Neon has migrations 0000-0008, LINK_ORIGIN is set, main b7bfe55 is deployed on Fly (the token-logging image is gone), a live /link with Phantom produced a signed wallet link, MYCEL epoch 1 is bootstrapped (2026-09-25T00:00Z to 2026-10-02T00:00Z, rubric 1.2.0) and the BotFather menu matches the bot. Next: Friday's weekly video, check the first reward intake after epoch 1 opens, then the hold-gate plan.
---

# Hyphae handoff

## TL;DR

**Production now runs `main` `b7bfe55`.** Runbook B ran end to end on Cisco's yes at each hard stop: migrations 0006–0008 applied and verified, `LINK_ORIGIN` deployed, new image live, worker consuming all reward queues, live `/link` with Phantom linked a signed wallet, MYCEL epoch 1 bootstrapped, BotFather menu updated. **Next: Friday's weekly video, then confirm the first reward-path submission after epoch 1 opens at 2026-09-25T00:00Z.**

## Metadata

- Last Updated: 2026-09-24 (evening). Session record: `docs/handoffs/2026-09-24-cutover.md` (every step, numbers, the flaky-test fix, runbook corrections). Earlier: `2026-09-24-manual-wallet-check.md`, `2026-09-24-cutover-decisions.md`, `2026-09-24-afternoon-session-end.md`.
- Branches: only `main` (= `origin/main`).
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`), Windows, 2026-09-24.
- Authority: schedule rulings of 2026-09-24 ("do your recommendation", `2026-09-24-founder-rulings.md`): H-CONTRACT Part A by Sep 27 with the audit-page build starting on that ruling; Part B and the fee, funding and payment definitions by Sep 30; cutover Mon Sep 28, which ran early on Sep 24 on Cisco's in-session yes. Cutover order and `LINK_ORIGIN` (`2026-09-24-cutover-decisions.md`); each hard stop got Cisco's yes; epoch 1 rubric 1.2.0 and open time 2026-09-25T00:00:00Z chosen by Cisco.
- Canonical private plan: not read or edited this session.

## Current Objective

Run the first reward epoch in Hyphae Lab and get the hackathon demo material from it. Epoch 1 closes 2026-10-02T00:00Z; epoch 2 closes 2026-10-09T00:00Z; the deadline is 2026-10-12.

## Current State

- Fly `hyphae-api`: api + worker on image `deployment-01M3A6PDECR4D9AP1TSJYDBSP3` (`b7bfe55`). Rollback image: `deployment-01M2R8W6Z6NAAWYM6KT2ZDYA2H` (Sep 17; its schema expectations still hold because the migrations only add). Webhook `https://hyphae-api.fly.dev/telegram`.
- Neon: journal 9 rows (0000–0008), hashes match. 1 community (Hyphae Lab, MYCEL mint), 1 member with a signed wallet (`MAoR…VhAB`) and its closed pasted predecessor in `member_wallet_links`.
- Rewards: epoch 1 2026-09-25T00:00Z → 2026-10-02T00:00Z, config `1c822678…40a` (rubric 1.2.0, 7-day epochs, effort 3×, 1 slot). No decisions yet. Points only; no payouts exist until R6.
- BotFather menu: `link`, `submit`, `effort`, `raid`, `me`.
- Local `.env` (gitignored) now includes `LINK_ORIGIN`, which every script that imports `src/db.ts` needs.

## Recent Changes (this session)

- `b7bfe55` test(rewards): the completion-versus-close race set its 300 ms boundary before `beginDispatch`, so a slow setup closed the epoch first; the boundary is now set after the dispatch exists. Test-only.
- Docs: cutover record, build log entry, Runbook B pointer to the corrected commands, this handoff.
- Out of repo (Cisco, on his yes): Neon migrate, `fly secrets set LINK_ORIGIN --stage`, `fly deploy --depot=false`, `set-rubric` bootstrap, BotFather `/setcommands`.

## Validation

On `b7bfe55`: `pnpm -r test` exit 0 (core 54, api 270); typecheck, Biome (138 tracked files), `drizzle-kit check`, `git diff --check` exit 0; `test:pg` 11/11 on three consecutive runs. Production: `/health` 200, `/link` page and `/link/app.js` 200, `reward-recovery` logged at 17:20:16Z with zeros, live `/link` + `/me` verified, bootstrap rows read back.

Review: the only code change is a test fix, so no cross-family review was needed; the deployed code was reviewed in earlier sessions (records above).

## Known Issues / Watch List

- **First reward-path traffic is untested in production.** After 2026-09-25T00:00Z, a `/submit` in Hyphae Lab should go through reward intake and evaluation (model call). Watch the worker log for `reward-evaluation` and errors.
- The worker's reward jobs have only run in tests and one idle `reward-recovery`; the first real `reward-close` is at 2026-10-02T00:00Z.
- `/me` in a private chat answers "not a registered Hyphae community"; should point to the community chat like `/link` does (small UX fix, parked).
- Scripts (`set-rubric`, `reward-correct`, …) parse the full app env through `src/db.ts`; a missing bot-only variable stops a DB-only script. Works now that `.env` has `LINK_ORIGIN`; a narrower env for scripts is optional cleanup.
- Manual check gaps from Runbook A (two-member `wallet_taken`, non-member refusal) remain covered only by tests.
- R6 must add the decision hash to snapshot entries before any root (R5 review C3), and pay only `walletAt(..., closesAt)` wallets with `method = 'signature'`.
- No CI; the local gate is the only gate.

## Next Actions

1. Weekly video #2 on Friday per `docs/demo/2026-09-25-weekly-video-2.md` (the cutover and a live `/link` are new material).
2. After 2026-09-25T00:00Z: one real `/submit` in Hyphae Lab; confirm the reward path (intake row, evaluation, decision, notification) and record it.
3. H-CONTRACT Part A ruling (due Sep 27; the audit-page build starts on it). Part B and the fee, funding and payment definitions by Sep 30.
4. Hold gate (`checkHold`, guide §6): its own plan.
5. Scoring-evaluation session (founder-labelled set) → decide whether to propose rubric 1.3.0 for a later epoch.
6. `/me` private-chat UX fix (test-first, ships with the next deploy).

## Quick Reference

- Cutover commands that work: `docs/handoffs/2026-09-24-cutover.md` § Runbook corrections. Deploy: from the repo root, `fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --app hyphae-api --depot=false`.
- Read-only Neon checks from the agent: `node --env-file=.env <script>` with `postgres` resolved from `packages/db` and `sql.begin("read only", …)`.
- Payout wallet: `walletAt(db, memberId, epoch.closesAt)` in `apps/api/src/link/wallet-links.ts`; payable only if `method === "signature"`.
- Bot wiring: `apps/api/src/bot/index.ts`; `/me` body: `bot/commands/me-summary.ts`.
- Local gate: `pnpm -r test; pnpm -r typecheck; git ls-files -z '*.ts' '*.json' '*.js' | xargs -0 pnpm exec biome check; pnpm --filter @hyphae/db exec drizzle-kit check; pnpm --filter @hyphae/api test:pg` (Docker); `git diff --check`.

## Suggested skills

- `handoff-memory` (resume this handoff).
- `superpowers:systematic-debugging` (first real reward-path run, if anything fails).
- `superpowers:writing-plans` (hold-gate plan).
- `superpowers:test-driven-development` (`/me` UX fix).
- `handoff` (session end).

## Resume Checklist

- `git fetch --prune && git status -sb` (expect `main` = `origin/main`).
- Docker Desktop running before `test:pg`.
- No deploy, Neon change, Fly secret, rubric proposal, package publish, public post or mainnet transaction without Cisco's separate yes. Cisco runs Fly and Neon-write commands in his own terminal.
- Cisco prefers **one manual step per message**, then wait for the result.

## Next-session prompt

```text
Resume Hyphae. Read CLAUDE.md, AGENTS.md and docs/HANDOFF.md. Production runs main b7bfe55 since the 2026-09-24 cutover; Neon has 0000-0008; MYCEL epoch 1 runs 2026-09-25T00:00Z to 2026-10-02T00:00Z on rubric 1.2.0. First: if epoch 1 is open, ask Cisco to send one real /submit in Hyphae Lab and verify the reward path read-only (intake, evaluation, decision, notification) and in the worker log. Then the hold-gate plan. Give Cisco ONE manual step per message.
Hard stops (each needs Cisco's explicit yes): Neon writes, fly secrets, fly deploy, rubric proposals, BotFather changes, mainnet transactions, package publishes, public posts, writes outside this repo.
```
