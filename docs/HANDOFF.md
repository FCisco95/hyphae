---
date: 2026-10-06
summary: Hyphae on 2026-10-06 evening (Windows, Claude Sonnet 5.5, effort high). Link page and looser scorer (reward-eval/2) are live on API and worker, epoch 3 will score with it, epoch 2 is untouched. Five ranked next steps are in docs/ROADMAP.md. First payout sitting Oct 8 to 9; deploy hold Oct 8 22:00Z to Oct 10 00:00Z.
---

# Hyphae handoff

## Metadata

Last Updated: 2026-10-06T21:45Z (Windows)
Project: Hyphae (Colosseum entry, Organic/MYCEL). Scope: October 8 first-payout preparation and the post-review roadmap.
Updated By: Claude Sonnet 5.5 (`claude-sonnet-5-5`), effort high
Older, longer handoff text (member journey, publication receipts, validation counts): [docs/handoffs/2026-10-06-handoff-archive-before-reorganization.md](handoffs/2026-10-06-handoff-archive-before-reorganization.md). Where the two differ, this file wins.

## TL;DR

- **Live now (2026-10-06T20:24Z):** API machine `6839d31b317318` and worker `817400c9901de8` run one image, `scoring-6b2a4e3` = `sha256:def68189a1e16ffbc062c68ca3ad7e923824dc64a122b5a48f47d09fc433142f` (source `6b2a4e3`). It carries the redesigned wallet-link page plus Telegram "Wallet linked" notice and the looser scorer `reward-eval/2`.
- **Scoring:** one config proposal is pending (`2ce6085a-ecbd-4ddc-a0dc-32966db43278`, rubric 1.2.0, prompt `reward-eval/2`, earliest activation epoch 3 = **2026-10-09T00:00Z**). **Epoch 2 is pinned to `reward-eval/1` and unchanged** (3 contributions counted, 1 member, the founder).
- **Next:** Cisco's phone test of the link page, then the roadmap in [docs/ROADMAP.md](ROADMAP.md) (5 ranked steps before the Oct 8 22:00Z deploy hold), and the Oct 8 to 9 first-payout sitting.

## Current Objective

Get the first real members scored in epoch 3 and keep the Oct 8 to 9 payout sitting exactly as planned. No reward, epoch, payout or rubric rule changes.

## Needs Cisco, in order

1. **Phone test (one action, yours):** on the phone, send `/setup` in the registered group, open the private link page inside Phantom or Solflare's browser, sign, and tell the agent what is on the screen and whether "Wallet linked" arrives in Telegram. This gates recruitment.
2. **Decisions for the roadmap:** real members after Oct 9 00:00Z (roadmap item 1) and the Hyphae-owned domain for the link page (item 2a: buy a domain, approve the `LINK_ORIGIN` secret change and Fly certificate; by Oct 8 12:00Z or after Oct 10).
3. **Oct 8 sitting** (C14 to C22): you, the Ledger and about 0.52 SOL plus fees; see [the packet](demo/2026-10-08-first-payout-readiness.md).
4. **Add `hackathon@colosseum.com`** as a collaborator on the private repo before submitting; **Neon password rotation** after Oct 10 00:00Z.
5. Pushes to `main` are yours with `! git push origin main` (the agent's push is blocked by the classifier). `main` = `origin/main` = `bfe8609` as of this handoff.

## Current State

| Area | State |
|---|---|
| API and worker | Both `started` on `sha256:def68189…` (tag `scoring-6b2a4e3`). Updated 20:23:44Z and 20:24:43Z. Worker completed `reward-recovery` twice afterwards, no errors. No migration needed or run. |
| Epoch 2 | Open, closes 2026-10-09T00:00Z, config rubric 1.2.0 + `reward-eval/1`. 3 counted contributions from 1 member; credited points are the founder's reply (66). `first_paid_epoch` = 2. |
| Epoch 3 | Not created yet. It materializes at the first activity after Oct 9 00:00Z and must pin `reward-eval/2` (check: roadmap Step 6 below). |
| Scorer | `reward-eval/2`: sincere own-words reaction related to the post or project earns at least 62 (72 to 90 with detail); promoting the raid's own project is not off_topic or spam. Rubric, flags, hard zeros, AI caps and the 60 floor unchanged; `reward-eval/1` byte-identical (hash test). Evidence: [calibration report](rubrics/eval/reward-eval-2-calibration.md); review: [Codex verdict](reviews/2026-10-06-reward-eval-2.md). |
| Link page | Branded mobile-first page on `https://hyphae-api.fly.dev/link`, shows the signing address and exact message, separate "did not connect" / "not signed" messages, Telegram "Wallet linked" notice. Review: [Codex ACCEPT](reviews/2026-10-06-link-page.md). Tested wallets: Phantom, Solflare. Trust Wallet unverified. Funnel so far: 5 sessions, 2 verified members (Cisco and one tester). |
| Telegram | The Hyphae Lab group is now a supergroup, chat id `-1003934645546` (the old id errors). Bot webhook clean, 0 pending. |
| Web | `hyphae-delta.vercel.app` READY on the existing Git integration. Every push to `main` redeploys it. |
| Release records | [Link release](demo/2026-10-06-link-release-plan.md), [scoring release](demo/2026-10-06-scoring-release-plan.md), [setup release](demo/2026-10-05-setup-release-plan.md), [member-journey rollout](demo/2026-10-05-api-rollout-plan.md). |

## Roadmap next steps (full detail: [docs/ROADMAP.md](ROADMAP.md))

Accepted by Cisco on 2026-10-06. Before the Oct 8 22:00Z hold, in this order:

1. **Real members scored in epoch 3** (after Oct 9 00:00Z; needs the real-raid-use approval and the phone PASS first).
2. **Easier, more trustworthy wallet linking:** own domain, deep link with a one-time short code, Sign-In With Solana format, wallet picker, funnel counts. Privy-style embedded wallets are not the default (they have no history or MYCEL, and make Sybil wallets free).
3. **Security and trust page** plus privacy policy and deletion path.
4. **Prompt-injection cases in the scoring eval** (about USD 0.50; the agent can do this first).
5. **A Solana Action (Blink) for claim and receipt;** cut if not reviewed by Oct 8 12:00Z.

After Oct 10: wallet record endpoint and page, self-serve communities, more contribution sources, scorer-quality tracking, monitoring and status page, SDK publication.

## Recent Changes

- `6b2a4e3` fix(scoring): the reward-prompt eval fails on any miss or error and validates `--runs` (Codex finding).
- `ba0e12b` feat(scoring): `reward-eval/2` and `eval:reward-prompt`.
- `121906f` fix(link): a non-object server answer ends in `link_unavailable` instead of a frozen page.
- `be5ef12`, `f80f5da`, `3f76e48` link page redesign, slow-send test, "Wallet linked" notice.
- Docs: calibration report, review records, three release plans and records, roadmap, this handoff. Latest `main`: `bfe8609`.

## Validation

Gate on `6b2a4e3` (native Windows): `pnpm test` 0 (core 110, read-client 26, web 107, API 822 passed / 3 skipped), `pnpm typecheck` 0, `pnpm lint` 0. CI on `bfe8609` was running when this handoff was written; `667b036` CI was success. Live acceptance for both releases is in their execution records. Not run: a real-phone signature, an epoch 3 scoring run (does not exist yet), real members.

## Known Issues / Watch List

- **Pre-boundary posts:** anyone who posts before Oct 9 00:00Z is scored in epoch 2 under the strict prompt. Do not invite members before then.
- **Do not roll the worker back after epoch 3 opens on `reward-eval/2`:** the old worker cannot score it. Before epoch 3 opens, `set-rubric <mint> --cancel` withdraws the proposal.
- **Model parse failures:** about 1 to 5 percent of scorer answers fail schema validation (over-long notes); they go to the existing reconciliation path. Version 2 asks for shorter notes.
- **One real quote** (mostly a pitch of the founder's own product) still zeroes in about 1 run in 3; a real reply failed once in 4 runs. The admin correction exists for noise.
- **Scorer blind spots:** no images and no quoted-post text; X relation and ownership remain "unverified" by design.
- **Post-hackathon backlog:** several raids at once; a council approval queue (needs Organic's verified role contract; the designated-admin fallback is intentional).
- Accepted low advisories from earlier reviews are listed in the archive.
- Local leftovers: untracked folders `../hyphae-link-121906f` and `../hyphae-scoring-6b2a4e3` (only `node_modules`), safe to delete; `.playwright-mcp/` is untracked.

## Preserved payout safeguards

Epoch 2 closes Oct 9 00:00Z. Oct 8 pause 23:00Z, final C18b after 23:45Z, corrections and attestation strictly before Oct 9 00:00Z, post-close safety, Ledger, claim and P14, and the hold through Oct 10 00:00Z inclusive. **No deployment and no push to `main` from Oct 8 22:00Z until Oct 10 00:00Z.** Empty or no-payable epoch means no payment. The founder is the only payable member unless real members are separately authorized; Cisco confirmed the plain wording on 2026-10-05. Canonical runbook: [first-payout readiness](demo/2026-10-08-first-payout-readiness.md); read-only audit runner `docs/demo/oct8-audit.mts`; proposal check `docs/demo/proposal-check.mts`. Admin and upgrade key: Ledger `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`; fee vault: Squads `rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK`. Held refs, untouched: `158452fe`, `707d7daf`, `2fd2470a`, tag `c58aa27`. Designated-admin fallback and "X relation and ownership unverified" stay.

## Next Actions

1. **Read-only, now:** `git pull --ff-only origin main`; read this file and [docs/ROADMAP.md](ROADMAP.md). Confirm `fly image show --app hyphae-api` shows both machines on `sha256:def68189…` and `node --env-file=<repo>/.env --import tsx ../../docs/demo/proposal-check.mts` (from `apps/api`) shows one `pending` proposal on `reward-eval/2`.
2. **Agent, no approval needed:** roadmap item 4 (prompt-injection eval cases and published result), then item 3 (security and trust page; Cisco supplies the contact address).
3. **Cisco:** the phone test, then the decisions for items 1, 2a and 5 (see "Needs Cisco").
4. **After 2026-10-09T00:00Z (read-only):** `GET /v1/communities/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/epochs/3` shows `config.prompt_version` `reward-eval/2` and rubric `1.2.0`, and `proposal-check.mts` shows the proposal `activated` at epoch 3. If epoch 3 pinned `reward-eval/1`, report; do not hand-edit.
5. About an hour before the Oct 8 sitting: re-run `oct8-audit.mts` and the live reads.

## Quick Reference

- [ROADMAP](ROADMAP.md) · [scoring release](demo/2026-10-06-scoring-release-plan.md) · [link release](demo/2026-10-06-link-release-plan.md) · [calibration report](rubrics/eval/reward-eval-2-calibration.md) · [rubric changelog](rubrics/CHANGELOG.md) · [payout runbook](demo/2026-10-08-first-payout-readiness.md) · [submission checklist](demo/2026-10-10-submission-checklist.md) · [organic-sync brief](handoffs/2026-10-06-organic-sync-brief.md) · [build log](BUILDLOG.md).
- Commands (from `apps/api`, with the repo `.env`): `pnpm --filter @hyphae/api eval:reward-prompt --cases ../../docs/rubrics/eval/reward-eval-cases.json --rubric ../../docs/rubrics/mycel-1.2.0.json --runs 3`; `node scripts/rollout/telegram.mjs -1003934645546 784434992` (from the repo root, with `--env-file=.env`); `registry-digest.sh <tag|digest>`.
- Rollback targets: API tag `link-121906f` = `sha256:b1e7091a…`; worker tag `deployment-01M3XYDW5XW7AEAY68CKVPKC2X` = `sha256:1c2d6dd5…`. flyctl 0.4.104 rejects the digest form of `fly machine update`: use the tag form after `registry-digest.sh` confirms the tag resolves to the target digest.
- Mint (Hyphae Lab): `HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg`; API `https://hyphae-api.fly.dev`; site `https://hyphae-delta.vercel.app`.

## Resume Checklist

Verify Git (`git status -sb`, `main` = `origin/main`), live state (Fly images, proposal), and the date against the hold window before any live step. Earlier approvals were single-use and are spent: the setup, link and scoring release plans all ran once. Every new live effect (deploy, production write, Telegram message, real members, domain, secret) needs its own exact yes. Reward, epoch, payout and rubric rules do not change without Cisco.

## Suggested skills

handoff-memory; the-analyst for strategy questions; superpowers:test-driven-development for any reward or link change; Codex `/review` (other model family) before any push that touches reward, auth, wallet or security code; Context7 or the Solana MCP before writing against Anchor, grammY, pg-boss, Drizzle, wallet adapters or Solana Actions; colosseum-copilot if Cisco wants evidence on past hackathon winners; parallel-feature-development only with explicit file ownership.

## Resume Prompt

```text
Continue Hyphae. Read CLAUDE.md, docs/HANDOFF.md and docs/ROADMAP.md first (the TL;DR and "Needs Cisco" are the current state).
State: API 6839d31b317318 and worker 817400c9901de8 both on scoring-6b2a4e3 = sha256:def68189a1e16ffbc062c68ca3ad7e923824dc64a122b5a48f47d09fc433142f since 2026-10-06T20:24Z. One config proposal is pending (prompt reward-eval/2, rubric 1.2.0, earliest activation epoch 3 = 2026-10-09T00:00Z). Epoch 2 is pinned to reward-eval/1 and unchanged. The link page redesign and Telegram "Wallet linked" notice are live.
Do first: read-only checks in HANDOFF "Next Actions" 1; then roadmap item 4 (prompt-injection eval cases) and item 3 (security and trust page). Wait for Cisco on: the phone test, real members after Oct 9 00:00Z, the domain, the Blink.
No deploy and no push to main from 2026-10-08T22:00Z until 2026-10-10T00:00Z. Do not change reward, epoch, payout or rubric rules. Preserve held refs (158452fe, 707d7daf, 2fd2470a, tag c58aa27), the designated-admin fallback and "X relation and ownership unverified". Talk plainly; one hand-step at a time for Cisco.
```
