---
date: 2026-10-08
summary: Hyphae on 2026-10-08 afternoon. Cisco ruled that epoch 2 keeps Claude Haiku 5.5 (Jev is never recorded for epoch 2) and that epoch 3 moves to reward-eval/3, Haiku answering Jev's v4 questions, after the hold. Five feature branches were built in parallel through Orca on a second machine and merged into one verified branch, `next` (gate and test:pg green) - scorer v3, payout status, raid stats, wallet record, claim Blink. `main` and live production are unchanged (jev-e5f864b) so tonight's first-payout sitting runs on the deployed source. After Oct 10 00:00Z - `git merge origin/next` on main, reviews and fixes, then release.
---

# Hyphae handoff

## Metadata

Last Updated: 2026-10-08T16:10Z
Project: Hyphae (Colosseum entry, Organic/MYCEL). Scope: the epoch 2 close and first payout (tonight), and five post-hold feature branches.
Updated By: Claude Opus 5.5 (`claude-opus-5-5`), coordinator session on a second Windows machine that has no production access (no `.env`, no `flyctl`). Workers ran as Orca sessions; every branch says which model built it.
Snapshot: [docs/handoffs/2026-10-08-orca-wave.md](handoffs/2026-10-08-orca-wave.md). Previous: [Jev release paused at E6](handoffs/2026-10-07-jev-release-paused-at-e6.md). Where they differ, this file wins.

## TL;DR

- **Rulings today (Cisco):** epoch 2 keeps scoring on Claude Haiku 5.5 under `reward-eval/2`; the Jev amendment (E7) is not recorded for epoch 2. Epoch 3 moves to a new `reward-eval/3`: Haiku answers Jev's v4 yes/no questions and code computes the score (gates score 0; an own-words reply starts at 65 plus bonuses). It ships after the hold, by deploy and a recorded amendment.
- **Live production is unchanged:** API and worker on `jev-e5f864b` (`sha256:b3f5617d…`), Neon journal 18, `JEV_SCORING=on` but no epoch pins Jev. Epoch 2 at 13:35Z: 13 contributions from 6 members, all decided, 0 pending, one amendment (`reward-eval/2` from 2026-10-07T18:00Z). Four of the six members have no signed wallet.
- **All five branches are merged into `next`** (`300eb97`, pushed): conflicts resolved, the raid migration renumbered to 0019 with byte-identical SQL, and the full gate green on the merged code (core 130, read-client 26, web 168, API 1142 passed / 3 skipped, typecheck and lint 0, `drizzle-kit check` fine, test:pg 79/79). `main` stays at the deployed source until the payout is published. **Resume after the hold with `git pull` then `git merge origin/next` on `main`: no checkout.** Do not merge it earlier: tonight's operator scripts run from `main`, and `next` refactors payout-gate and settlement reads that have not been reviewed yet.
- Each branch's worker note (`docs/handoffs/2026-10-08-*.md`, all present on `next`) lists the member-visible strings for Cisco's approval.
- **Tonight is unchanged:** C14 to C18 attended and finished by about 21:30Z, 23:00Z pause, corrections and attestation before Oct 9 00:00Z, then close, C19 to C22. No push to `main` and no deploy from Oct 8 22:00Z until Oct 10 00:00Z.

## Needs Cisco, in order

1. **Hyphae Lab post (public, yours):** "To be paid for epoch 2, run /setup and pass the quiz before 00:00 UTC." Members without a wallet or the rules test are scored but cannot be paid.
2. **The sitting, on the home machine:** `git pull` first, then the [readiness packet](demo/2026-10-08-first-payout-readiness.md), C14 to C18, with the Ledger and the pot.
3. **Corrections, 23:00Z to 23:45Z:** the coordinator gave Cisco a private row-by-row list (recommendation: one correction, an own-words reply scored 42 that the new filter rules pass; leave the founder's own rows as they are). Each correction is Cisco's call.
4. **Revoke the temporary Anthropic key** used for the scorer eval in the Anthropic console; it was pasted into a session. It was never committed (the branch and worktree were scanned).
5. **After the hold, approvals:** the member-visible strings in each branch note; the privacy calls in the payout-status note (rules-test status becomes public per member, and the one-time line shows in the group); the wallet-record wording calls; the Blink registry (Dialect) and share-text decisions.

## Branches (base `2380d59`, all merged into `next`, not on `main`, not deployed)

`next` = `8cae3da` + the five branches below, merged in this order: payout-status, wallet-record (migration 0018), raid-stats (migration 0019), blink, scorer-v3. The scorer adds the dependency `@anthropic-ai/sdk` to `apps/api`. The individual branches stay on GitHub for reference.

| Branch | What it does | State | Before release |
|---|---|---|---|
| `FCisco95/scorer-v3` | `reward-eval/3`: Haiku 5.5 answers the v4 questions through structured output; `composeJev` scores; same request-hash, one-call, reconciliation and refusal handling as Jev | Gate green with 2 workers (API 1083, web 123, core 119, test:pg 74). Eval done (`docs/evals/reward-eval-3-calibration-2026-10-08.md` on the branch): 277 calls, USD 0.23, 0 errors or refusals; reward cases 78/78; all 8 injections 0 in 24/24 runs; holdout 171/180 judged runs right, the same as Jev v4; misses H26 and H40 (Jev's accepted misses) and a new H54 (a polished restatement credited 65); about USD 0.0008 per reply, p50 1.2 s | Cisco's yes on the CHANGELOG and announcement drafts and four open questions in the note (receipt wording, refusals to reconciliation, accepting H54, the 65 baseline); Codex review |
| `FCisco95/payout-status` | Read API `payout` status from the payout gate's own extracted terms; "Counted." becomes "Scored." plus what pay still needs; `/me` checklist with the next step; one line in a member's first score message of an epoch | Gate green (API 1070, web 132, core 124, test:pg 74/74); no migration | Codex review (`2380d59..8f82146`), Cisco's copy and privacy rulings |
| `FCisco95/raid-stats` | `/raids` stats per raid; one counts-only recap in the group when a raid closes or ends; end time on the length confirmation | Typecheck and lint 0, test:pg 77/77, API unit tests pass (exit code hit the load timeout below) | Codex review (not started), migration `0019_raid_recaps` (renumbered at merge), Cisco's copy |
| `FCisco95/wallet-record` | `GET /v1/wallets/:wallet/record` and a `/wallet/[wallet]` page linked from the leaderboard and claim page | Gate green with 2 workers (API 1046, web 140, core 125), test:pg 74/76 (2 known concurrency timeouts that pass alone) | Codex review (`2380d59..70e5b3c`), migration 0018 (index on `member_wallet_links.wallet`), wording calls |
| `FCisco95/blink` | Solana Action for an epoch's claim (GET, POST, OPTIONS), `actions.json`, "Share claim link on X" | Codex review on the branch: CHANGES REQUESTED, 0 high, 1 medium (body byte limit enforced while reading), 2 low (keep the claim tx on "already claimed"; keep `X-Blockchain-Ids` on errors) | Fix test-first, fix review, registry decision |

## Next agent steps (after 2026-10-10T00:00Z, home machine)

1. On `main`, after the sitting's records are committed: `git pull`, `git merge origin/next`, `pnpm install`. Commit locally; **do not push `main` yet**, because the push redeploys the web and the new pages need the new API.
2. Scorer: walk Cisco through the eval report and the four open questions in the scorer note; then a Codex review.
3. Blink: fix the three findings test-first on `main`, then a Codex fix review.
4. Codex reviews of the raid-stats, wallet-record and payout-status changes (`8cae3da..next`: migrations, public output, payout-gate and settlement reads); fix test-first.
5. Release plan (its own yes): migrations 0018 and 0019 before the API image; `scripts/rollout/db.mjs` pins to the new journal; the API and worker image from the reviewed `main`; then push `main` so Vercel ships the web after the API it needs.
6. Epoch 3 scorer: after the release, Cisco announces T, then `amend-epoch.ts <mint> --epoch 3 --prompt reward-eval/3 --effective-at <T>` from the exact-source worktree.

## Current State

| Area | State |
|---|---|
| API and worker | `jev-e5f864b` (`sha256:b3f5617d804a377e8eaae1c6c67641ffe85390e47d88c162f0723206994236c4`), unchanged since 2026-10-07 21:36Z. Rollback target before any epoch pins Jev: `haiku55-328fb45` (`sha256:4218b2a9…`). |
| Database | Neon journal 18 (`0017_reward_amendment_chain`). Never roll back. |
| Jev | Enabled, unused. No epoch 2 amendment will be recorded. The exact-source worktree `C:/hy-jev-e5f864b` on the home machine can be removed. |
| Epoch 2 | Open until 2026-10-09T00:00Z, scoring `reward-eval/2` on `anthropic:claude-haiku-5-5`. |
| Epoch 3 | Opens 2026-10-09T00:00Z and must activate the pending `reward-eval/2` proposal `2ce6085a…`; moves to `reward-eval/3` by amendment after the release. |
| Chain (13:15Z) | Ledger admin 0 lamports; community, vault and epoch 2 accounts absent (C14 not started); fee vault `rRceAU…u7MK` System-owned, 895,047,823 lamports. |
| Site | Security page live with the TypeSafe wording (verified 13:15Z). |

## Known Issues / Watch List

- **Machine load:** five agents running full test suites at once pinned 8 cores; vitest then fails with `Timeout calling "onTaskUpdate"` although every test passes. Run with `--maxWorkers=2` on a busy machine; CI is the clean signal. Run at most two heavy sessions at a time.
- **Orca and Codex on Windows:** `worker-start --agent codex --model …` quoted the flags so `cmd` rejected them. Working path: `orca terminal create --command "codex -m gpt-6-astra -c model_reasoning_effort=xhigh"`, answer the update and trust prompts, then `worker-start --terminal <handle>`, then press Enter once if the prompt stays in the draft.
- **Scorer noise near the floor** (unchanged): `reward-eval/2` still ranks; sincere replies scored 42 and 58 today. `reward-eval/3` is the fix.
- **Pre-existing flaky test:** `apps/api/src/member-journey/submissions.pg.test.ts` "private journey".
- Earlier items still open: trust gaps on the security page; Neon password rotation after Oct 10.

## Preserved payout safeguards

Epoch 2 closes Oct 9 00:00Z. Oct 8 pause 23:00Z, final C18b after 23:45Z, corrections and attestation strictly before Oct 9 00:00Z, then post-close safety, Ledger, claim and P14, and the hold through Oct 10 00:00Z inclusive. **No deployment or push to `main` from Oct 8 22:00Z until Oct 10 00:00Z.** Empty or no-payable epoch means no payment. Canonical runbook: [first-payout readiness](demo/2026-10-08-first-payout-readiness.md) (recount payable members from the audit). Admin and upgrade key: Ledger `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`; fee vault Squads `rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK`. Held refs untouched: `158452fe`, `707d7daf`, `2fd2470a`, tag `c58aa27`.

## Quick Reference

- Mint `HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg`; API `https://hyphae-api.fly.dev`; site `https://hyphae-delta.vercel.app`; Hyphae Lab chat `-1003934645546`.
- Correction: `node --env-file=$hyphaeEnv --import tsx scripts/reward-correct.ts <contribution-id> --expected-revision <n> --reason "…" --evidence "<ref>" --raw-quality <0-100>` (from `apps/api`).
- Amendment: `node --env-file=<repo>/.env --import tsx scripts/amend-epoch.ts <mint> --epoch <n> --prompt <v> --effective-at <iso Z> --actor "…" --reason "…" [--plan]` (from `apps/api`).
- Fingerprint: `node --env-file=<repo>/.env <repo>/scripts/rollout/decisions-digest.mjs <mint> <epoch> [<cutoff>]` (from `packages/db`).
- Codex review: `codex exec -m gpt-6-astra -c model_reasoning_effort=xhigh -s read-only --ephemeral`, or an Orca Codex terminal as above.

## Resume Checklist

`git pull` (brings `origin/next` too); `git status -sb`; `fly image show --app hyphae-api` (both on `jev-e5f864b`); `GET /v1/communities/<mint>/epochs/2` (one amendment); the clock against the 22:00Z push cutoff and the hold. Every new live effect needs its own yes.

## Next-session prompt

```
Hyphae, after 2026-10-10T00:00Z, home machine, on main. Read CLAUDE.md and docs/HANDOFF.md.
Model: Claude Opus 5.5 (xhigh) for the scorer and money paths; Sonnet 5.5 for UI fixes; Codex gpt-6-astra xhigh for reviews.

0. git pull, git merge origin/next, pnpm install, full gate. Do not push main until step 4's release.
1. Walk Cisco through the reward-eval/3 eval report and the four open questions (docs/handoffs/2026-10-08-reward-eval-3.md).
2. Fix the Blink review findings test-first (docs/reviews/2026-10-08-blink.md); Codex fix review.
3. Codex reviews of the raid-stats, wallet-record and payout-status changes (8cae3da..next); fix test-first.
4. Release plan for Cisco's yes: migrations 0018 and 0019, the API and worker image, then push main for the web.
```
