---
date: 2026-10-07
summary: Hyphae on 2026-10-07 late night (Windows, Claude Sonnet 5.5). Live image buttons-ed32b4f on API and worker: up to 3 open raids per community, /raid length buttons, /raids Close menu (all Codex ACCEPT, no migration). Epoch 2 pilot amendment (reward-eval/2 from 18:00Z) still in force. The Sonnet 5.5 scorer switch is parked; Cisco is deciding Haiku 5.5 vs Jev in other sessions.
---

# Hyphae handoff

## Metadata

Last Updated: 2026-10-07T20:15Z (Windows)
Project: Hyphae (Colosseum entry, Organic/MYCEL). Scope: live testing in epoch 2, the Oct 8 to 9 first-payout sitting, the scoring model.
Updated By: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Snapshot: [docs/handoffs/2026-10-07-raid-buttons-live.md](handoffs/2026-10-07-raid-buttons-live.md). Earlier: [pilot amendment live](handoffs/2026-10-07-pilot-amendment-live.md). Older, longer text: [2026-10-06 archive](handoffs/2026-10-06-handoff-archive-before-reorganization.md). Where they differ, this file wins.

## TL;DR

- **Live now:** API `6839d31b317318` and worker `817400c9901de8` both on `buttons-ed32b4f` = `sha256:fa0b2c955b16e7096c629aebeb6c65ca46337ba3365d75e254c59c655529a5ed` since 2026-10-07 ~19:52Z. Neon journal still at `0016`. Adds, on top of `amend-b265204`: up to 3 open raids per community (777a5b8) and raid buttons (135e900, ed32b4f): `/raid <link>` asks 6/12/24/48h, `/raids` lists open raids with Close buttons. Both Codex ACCEPT. The Sonnet 5.5 scorer switch is NOT in this image and is parked on branch `feat/sonnet55-medium` (eval: scored legit pilot cases R2 and P3 at 0 on all runs, where Sonnet 5 scores 68 to 78; per session notes, not yet in a committed file). Jev scoring is being built in other sessions; whoever deploys next must build from `origin/main` at `ed32b4f` or later.
- **Epoch 2 pilot amendment** `a75dbfeb-1484-46df-aaae-9cd8d43a7827`: contributions admitted at or after **2026-10-07T18:00:00Z** score with `reward-eval/2`; earlier ones keep `reward-eval/1`. Announced on X at 17:06Z ([post](https://x.com/organic_mycel/status/2107880131390013632)), recorded 17:12:35Z, public on `GET /v1/communities/<mint>/epochs/2` and the epoch page. Raid on that post open since 17:07:53Z.
- **Payout ruling (Cisco, 2026-10-07):** testers who meet every existing condition before the close are paid from the approved 0.5 SOL pot. He would add "one more SOL" if engagement grows: not a ruling until he names the amount and the epoch.
- **Scorer, open:** the Sonnet 5.5 medium switch is NOT shipped. Code is parked on branch `feat/sonnet55-medium`; per session notes its eval scored legitimate pilot cases R2 and P3 at 0 on every run (Sonnet 5: 68 to 78) and had one timeout. Cisco is choosing Haiku 5.5 (`feat/haiku-55`) or Jev (`feat/jev-reward`, `FCisco95/jev-plumbing`, `jev-live`) in other sessions. Haiku 4.5 missed 6 of 28 (R1, R2). Deploy cutoff Oct 8 12:00Z still applies.
- **Pushed:** `origin/main` = `9f67137` (code ed32b4f). Nothing of mine is local-only. Any deploy must build from `origin/main` at `ed32b4f` or later, or the raid changes drop out of the image.

## Current Objective

Real testers get valid scores in epoch 2 and some can be paid at the Oct 8 to 9 sitting, with every scoring change public and non-retroactive.

## Needs Cisco, in order

1. **Decide the scorer** (Haiku 5.5 or Jev) in the sessions that own it; show the eval numbers before any release. A release needs its own exact yes.
2. **Telegram heads-up (before 18:00Z, if not done):** "the new scoring starts at 18:00 UTC; reply on X now if you like, but tap Submit after 18:00."
3. **A reply after 18:00Z** to the pilot-update post, submitted with the raid's Submit button, so Step 8 acceptance can be checked (his 17:10 reply stays 58 → 0 under `reward-eval/1`: it was admitted before the change).
4. **Phone `/setup` check** (release A Step 5): step 2 should read "Link your wallet to be paid … You can reply to raids before this."
5. **Telegram menu (optional):** add `/raids` to the BotFather command list; it works when typed.
6. **Oct 8 sitting** (C14 to C22) with the Ledger and the pot; more payable members now possible, so C18b attestation covers each tester's X account. See [the packet](demo/2026-10-08-first-payout-readiness.md).
7. Pushes to `main` are always `! git push origin main` (the agent's push is blocked).

## Current State

| Area | State |
|---|---|
| API and worker | Both `started` on `sha256:fa0b2c955b16e7096c629aebeb6c65ca46337ba3365d75e254c59c655529a5ed` (tag `buttons-ed32b4f`, since ~19:52Z). Chain: earn-94ce60e, amend-b265204, raids-777a5b8 (`sha256:5185a5ec...`), buttons-ed32b4f. Rollback to `amend-b265204` or `raids-777a5b8` is allowed (no migration since 0016); never below `amend-b265204`. |
| Database | Neon journal 17 rows, ending `0016_reward_config_amendments`. `members` has 0015's nullable wallet shape. One row in `reward_config_amendments`. |
| Epoch 2 | Open until 2026-10-09T00:00Z, base config `df5be064…` (rubric 1.2.0, `reward-eval/1`), amended to config `d265af98…` (`reward-eval/2`, digest `9f4bfac8182a`, the same config the pending epoch 3 proposal pins) from 18:00Z. 4 contributions, 4 decisions as of 17:29Z. History from before the release byte-identical (`scripts/rollout/decisions-digest.mjs` with cutoff 15:22Z: intakes 3 `79ed17cc`, decisions 3 `5897c505`, dispatches 3 `6af848b1`). |
| Epoch 3 | Not created. Materializes after Oct 9 00:00Z and must activate the pending `reward-eval/2` proposal `2ce6085a…`. |
| Scoring model | `anthropic:claude-sonnet-5`, the code default in `apps/api/src/env.ts` (no `SCORING_MODEL` set on Fly). No effort or thinking setting is sent, so the API defaults apply. The model is **not pinned** in the epoch config; each decision records it. `apps/api/src/scoring/provider.ts` prices Sonnet 5 at $3/$15 per million tokens; Anthropic's current list (claude-api skill, cached 2026-09-25) is $2/$10 for both Sonnet 5 and Sonnet 5.5, so recorded costs read about 1.5x high. |
| Security page | States the pilot amendment power, "Used once, on 2026-10-07", with evidence (`apps/web/lib/trust.ts`, `docs/SECURITY.md`; `trust.test.ts` holds them identical). Live after the push. |
| Records | [CHANGELOG](rubrics/CHANGELOG.md) entry, [design and rulings](handoffs/2026-10-07-epoch2-pilot-amendment.md), [Codex review](reviews/2026-10-07-pilot-amendment.md) (ACCEPT), [release B plan and record](demo/2026-10-07-pilot-amendment-release-plan.md), [release A record](demo/2026-10-07-earn-first-release-plan.md), [BUILDLOG](BUILDLOG.md). |

## Recent Changes

- Release A executed 14:26Z to 14:41Z: migration 0015, image `earn-94ce60e` (`sha256:2ff89500…`). Record `780183d`.
- Pilot amendment built test-first: `365e442` record + admission, `e73b824` read API + web + audit manifest, `e44fe2c` `amend-epoch`, `d48b810` postgres-js test, `76cf244` `db.mjs` for 0016, `2828d81` schema tests, `7a0626e` security claim, `b944143`/`c1aec51` epoch fingerprint tool, `b265204` Codex fixes, `72f0d3d` review + plan.
- Release B executed 16:36Z to 17:12Z (see its record). Cisco posted at 17:06Z and opened the raid at 17:07:53Z, before T.

## Validation

- Native gate on `b265204`: `pnpm test` 0 (core 114, read-client 26, web 123, API 870 passed / 3 skipped), `pnpm typecheck` 0, `pnpm lint` 0, `drizzle-kit check` fine. CI on `72f0d3d` success.
- `test:pg` 73 of 73 in 4 of 7 runs; the failing runs fail the member-journey "private journey" tests (and raid-alert tests that then claim the alert they leave behind). Those tests also fail 2 of 3 runs alone on `94ce60e` without B: pre-existing.
- Rehearsal of 0016 + `amend-epoch` on disposable Postgres 17 with the real epoch 2 payload: 11 of 11 as expected.
- Side eval (USD 0.18): Cisco's 17:10 reply `reward-eval/1` 58/58/58 → 0; `reward-eval/2` 75/66/75. His Oct 6 reply: v1 72/70/75 (58 live), v2 70/74/74.

## Known Issues / Watch List

- **Not yet seen:** a contribution admitted after 18:00Z showing `amendment` and a `reward-eval/2` revision (Step 8 of release B).
- **Scorer noise near the floor:** the same reply scored 58 live and 70 to 75 in the eval under `reward-eval/1`. `reward-eval/2` puts a sincere reply above 62, which buffers it.
- **Model switch mid-epoch:** Cisco ruled Sonnet 5.5 medium. The model is not in the pinned config, so a switch is visible only per decision unless it is recorded publicly (CHANGELOG entry + announcement). Sonnet 5.5 can decline a request (`stop_reason: "refusal"`, categories include `reasoning_extraction`, `frontier_llm`): a prompt-injection reply could land in reconciliation instead of scoring 0. The scorer must handle a refusal deliberately.
- **Pre-existing flaky test:** `apps/api/src/member-journey/submissions.pg.test.ts` "private journey" tests claim the next due alert globally; make them claim their own delivery.
- **Rollback rules:** no rollback below `amend-b265204` (the amendment is recorded). Do not roll the worker back after epoch 3 opens on `reward-eval/2`.
- Earlier items still open: injection-as-`guideline_breach` rubric question; trust gaps listed on the security page; Neon password rotation after Oct 10.

## Preserved payout safeguards

Epoch 2 closes Oct 9 00:00Z. Oct 8 pause 23:00Z, final C18b after 23:45Z, corrections and attestation strictly before Oct 9 00:00Z, then post-close safety, Ledger, claim and P14, and the hold through Oct 10 00:00Z inclusive. **No deployment after 2026-10-08T12:00Z for this arc, and no deployment or push to `main` from Oct 8 22:00Z until Oct 10 00:00Z.** Empty or no-payable epoch means no payment. Canonical runbook: [first-payout readiness](demo/2026-10-08-first-payout-readiness.md) (its "founder is the only payable member" wording is outdated by the 2026-10-07 ruling: recount from the audit). Admin and upgrade key: Ledger `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`; fee vault Squads `rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK`. Held refs untouched: `158452fe`, `707d7daf`, `2fd2470a`, tag `c58aa27`.

## Next Actions

1. **After 18:00Z, read-only:** the first raid contribution after T: `GET /v1/contributions/<id>` shows `amendment: {effective_at: "2026-10-07T18:00:00.000000Z", prompt_version: "reward-eval/2"}` and a `reward-eval/2` revision; `decisions-digest.mjs <mint> 2 2026-10-07T18:00:00Z` stable across runs. Fill Step 8 in the release B record.
2. **Scorer, in the owning sessions:** Haiku 5.5 is a model-only switch (price row in `apps/api/src/scoring/provider.ts`); Jev is gated on its v4 calibration. Whichever ships needs the 28-case eval shown to Cisco, a Codex review (`codex exec -m gpt-6-astra -c model_reasoning_effort=xhigh -s read-only --ephemeral`), a public CHANGELOG entry, then a release by `fly deploy --build-only` + `fly machine update <id> --image registry.fly.io/hyphae-api:<tag>` (the digest form is rejected). Before 2026-10-08T12:00Z.
3. **Raids:** Cisco tests `/raid <link>` (pick 12h) then `/raids` on his new post; fix anything clumsy. Up to 3 open raids; the 4th is refused.
4. Optional, post-hackathon: wider admin menu (brief and hours presets, per-raid stats), council approval queue.
5. About an hour before the Oct 8 sitting: re-run `oct8-audit.mts` and the live reads; recount payable members.

## Quick Reference

- Mint `HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg`; API `https://hyphae-api.fly.dev`; site `https://hyphae-delta.vercel.app`; Hyphae Lab chat `-1003934645546`.
- Amendment record: `node --env-file=<repo>/.env --import tsx scripts/amend-epoch.ts <mint> --epoch <n> --prompt <v> --effective-at <iso Z> --actor "…" --reason "…" [--plan]` (from `apps/api`).
- Fingerprint: `node --env-file=<repo>/.env <repo>/scripts/rollout/decisions-digest.mjs <mint> <epoch> [<cutoff>]` (from `packages/db`).
- Eval: `pnpm --filter @hyphae/api eval:reward-prompt --cases ../../docs/rubrics/eval/reward-eval-cases.json --rubric ../../docs/rubrics/mycel-1.2.0.json --runs 3 [--versions …] [--model …]`.
- `registry-digest.sh <tag|digest>`, `telegram.mjs <chat> 784434992`, `docs/demo/proposal-check.mts`.
- Leftover worktrees: `../hyphae-earn-94ce60e`, `../hyphae-amend-b265204` (remove with `git worktree remove` when no longer needed).

## Resume Checklist

`git status -sb` (`main` = `origin/main` at 9f67137 or later), `fly image show --app hyphae-api` (both on `sha256:fa0b2c95...`, tag `buttons-ed32b4f`, unless a scorer release followed), `GET /epochs/2` (one amendment, 18:00Z), the date against the deploy cutoff and the hold. Every new live effect needs its own exact yes.

## Suggested skills

the-analyst (model choice is a decision with money attached); claude-api (Sonnet 5.5 effort, thinking and refusal handling: read before writing scorer code); context7 (AI SDK v7 and `@ai-sdk/anthropic` provider options); superpowers:test-driven-development (scorer change); codex review via `codex exec -m gpt-6-astra -c model_reasoning_effort=xhigh -s read-only --ephemeral`; handoff at the end.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Image `earn-94ce60e` (`sha256:2ff89500…`) | Fly registry `registry.fly.io/hyphae-api` | Superseded; no longer a valid rollback target |
| Image `amend-b265204` (`sha256:161252f9…`) | Fly registry, both machines | Live |
| Migrations 0015 and 0016 applied | Neon project `Hyphae` | Journal 17 rows |
| Amendment `a75dbfeb-1484-46df-aaae-9cd8d43a7827` and config `d265af98-202c-4425-9d7b-dfdd5d5715fa` | Neon `reward_config_amendments`, `reward_configs` | Append-only, public |
| Worktrees `../hyphae-earn-94ce60e`, `../hyphae-amend-b265204` | Sibling folders of the repo | Local only, safe to remove |

No keys, secrets or credentials were created or changed.

## Next-session prompt

```
Hyphae, 2026-10-07 night. Live: image buttons-ed32b4f (sha256:fa0b2c95...) on API and worker. Up to 3 open raids per community, /raid <link> asks 6/12/24/48h, /raids lists open raids with Close buttons. Epoch 2 amendment (reward-eval/2 from 18:00Z) in force. The Sonnet 5.5 scorer switch is parked (feat/sonnet55-medium): it scored legit pilot cases R2 and P3 at 0.

Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-10-07-raid-buttons-live.md, apps/api/src/scoring/provider.ts, docs/rubrics/eval/reward-eval-cases.json, docs/rubrics/CHANGELOG.md
Model: Claude Opus 5.5 (xhigh) for the scorer release; Sonnet 5.5 for code.
Skills: the-analyst, claude-api, superpowers:test-driven-development, handoff

1. Read-only: confirm a contribution admitted after 18:00Z shows amendment reward-eval/2 (Step 8 of the release B record).
2. Scorer: whichever of Haiku 5.5 or Jev Cisco picked, show the 28-case eval first, Codex review, CHANGELOG entry, release on his exact yes before 2026-10-08T12:00Z. Build from origin/main >= ed32b4f.
3. Oct 8 sitting prep: re-run oct8-audit.mts and the live reads an hour before. No deploy after 12:00Z; no push or deploy from Oct 8 22:00Z to Oct 10 00:00Z.
```
