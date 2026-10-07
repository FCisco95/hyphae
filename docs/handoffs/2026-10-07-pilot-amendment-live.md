---
date: 2026-10-07
summary: Hyphae on 2026-10-07 evening (Windows, Claude Opus 5.5, effort xhigh). Live: earn-first release (migration 0015, image earn-94ce60e) and the epoch 2 pilot amendment release (migration 0016, image amend-b265204); amendment a75dbfeb recorded 17:12:35Z, effective 18:00Z, epoch 2 contributions from then on score with reward-eval/2. Cisco ruled testers who meet every condition are paid in epoch 2. Next: verify the first post-18:00 contribution, then switch the scorer to Claude Sonnet 5.5 at medium effort (Cisco's decision), measured first and recorded publicly, deployed before 2026-10-08T12:00Z.
---

# Hyphae handoff

## Metadata

Last Updated: 2026-10-07T17:35Z (Windows)
Project: Hyphae (Colosseum entry, Organic/MYCEL). Scope: live testing in epoch 2, the Oct 8 to 9 first-payout sitting, the scoring model.
Updated By: Claude Opus 5.5 (`claude-opus-5-5`), effort xhigh
Snapshot: [docs/handoffs/2026-10-07-pilot-amendment-live.md](handoffs/2026-10-07-pilot-amendment-live.md). Older, longer text: [2026-10-06 archive](handoffs/2026-10-06-handoff-archive-before-reorganization.md). Where they differ, this file wins.

## TL;DR

- **Live now:** API `6839d31b317318` and worker `817400c9901de8` both on `amend-b265204` = `sha256:161252f99dcc4b790e4742f99c9c3f0b4ad43bc6200157d756e33b6e9dfd947a` since 16:46Z. Neon journal at `0016`. It carries earn-first, the one-tap X buttons, the vault panel and the pilot amendment.
- **Epoch 2 pilot amendment** `a75dbfeb-1484-46df-aaae-9cd8d43a7827`: contributions admitted at or after **2026-10-07T18:00:00Z** score with `reward-eval/2`; earlier ones keep `reward-eval/1`. Announced on X at 17:06Z ([post](https://x.com/organic_mycel/status/2107880131390013632)), recorded 17:12:35Z, public on `GET /v1/communities/<mint>/epochs/2` and the epoch page. Raid on that post open since 17:07:53Z.
- **Payout ruling (Cisco, 2026-10-07):** testers who meet every existing condition before the close are paid from the approved 0.5 SOL pot. He would add "one more SOL" if engagement grows: not a ruling until he names the amount and the epoch.
- **Cisco's next decision, already made:** switch the scorer to Claude Sonnet 5.5 at medium effort. Not done yet: needs code (the scorer sends no effort today), an eval, a Codex review and a deploy before Oct 8 12:00Z.
- **Pushed:** `origin/main` = `72f0d3d`. The evening records commit is local until Cisco's push (see Needs Cisco).

## Current Objective

Real testers get valid scores in epoch 2 and some can be paid at the Oct 8 to 9 sitting, with every scoring change public and non-retroactive.

## Needs Cisco, in order

1. **Push the records:** `! git push origin main` (the evening records commit: CHANGELOG entry, security page "used once", release record, BUILDLOG, this handoff). The site redeploys; the security page then says the amendment power was used once.
2. **Telegram heads-up (before 18:00Z, if not done):** "the new scoring starts at 18:00 UTC; reply on X now if you like, but tap Submit after 18:00."
3. **A reply after 18:00Z** to the pilot-update post, submitted with the raid's Submit button, so Step 8 acceptance can be checked (his 17:10 reply stays 58 → 0 under `reward-eval/1`: it was admitted before the change).
4. **Phone `/setup` check** (release A Step 5): step 2 should read "Link your wallet to be paid … You can reply to raids before this."
5. **Yes for the Sonnet 5.5 release** once the next session has the eval numbers and the plan (the switch itself is his ruling; the release needs its exact yes like every release).
6. **Oct 8 sitting** (C14 to C22) with the Ledger and the pot; more payable members now possible, so C18b attestation covers each tester's X account. See [the packet](demo/2026-10-08-first-payout-readiness.md).
7. Pushes to `main` are always `! git push origin main` (the agent's push is blocked).

## Current State

| Area | State |
|---|---|
| API and worker | Both `started` on `sha256:161252f9…` (tag `amend-b265204`). Worker proof: `reward-recovery` at 16:50:13Z and 16:55:39Z, counters 0. Rollback to `earn-94ce60e` is **not allowed** now that the amendment is recorded (the old image ignores it): fix forward. |
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
2. **Sonnet 5.5 medium, test-first:** add a model id + effort to the scorer (`apps/api/src/scoring/provider.ts`, `env.ts` default; check the AI SDK v7 / `@ai-sdk/anthropic` v4 option names with Context7), handle a `refusal` stop reason explicitly, fix the price table, then run `eval:reward-prompt` on all 28 cases, 3 runs, `reward-eval/2`, on Sonnet 5.5 medium (about USD 1) and compare with the published Sonnet 5 results. If it is worse, report before switching.
3. **Make the switch public:** a CHANGELOG entry and a short announcement Cisco posts, with the exact UTC time; ideally record the model in the epoch's public data, not only per decision.
4. Codex review (other model family) of the switch, then a release plan in release B's format and Cisco's exact yes, deployed **before 2026-10-08T12:00Z**.
5. About an hour before the Oct 8 sitting: re-run `oct8-audit.mts` and the live reads; recount payable members.

## Quick Reference

- Mint `HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg`; API `https://hyphae-api.fly.dev`; site `https://hyphae-delta.vercel.app`; Hyphae Lab chat `-1003934645546`.
- Amendment record: `node --env-file=<repo>/.env --import tsx scripts/amend-epoch.ts <mint> --epoch <n> --prompt <v> --effective-at <iso Z> --actor "…" --reason "…" [--plan]` (from `apps/api`).
- Fingerprint: `node --env-file=<repo>/.env <repo>/scripts/rollout/decisions-digest.mjs <mint> <epoch> [<cutoff>]` (from `packages/db`).
- Eval: `pnpm --filter @hyphae/api eval:reward-prompt --cases ../../docs/rubrics/eval/reward-eval-cases.json --rubric ../../docs/rubrics/mycel-1.2.0.json --runs 3 [--versions …] [--model …]`.
- `registry-digest.sh <tag|digest>`, `telegram.mjs <chat> 784434992`, `docs/demo/proposal-check.mts`.
- Leftover worktrees: `../hyphae-earn-94ce60e`, `../hyphae-amend-b265204` (remove with `git worktree remove` when no longer needed).

## Resume Checklist

`git status -sb` (`main` = `origin/main` after Cisco's push), `fly image show --app hyphae-api` (both on `sha256:161252f9…`), `GET /epochs/2` (one amendment, 18:00Z), the date against the deploy cutoff and the hold. Every new live effect needs its own exact yes.

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
Hyphae, 2026-10-07 evening. Live: image amend-b265204 (sha256:161252f9…) on API and worker; epoch 2 pilot amendment a75dbfeb recorded, effective 2026-10-07T18:00:00Z (reward-eval/1 -> reward-eval/2), raid open on Cisco's pilot-update post. Cisco ruled: testers meeting every condition are paid in epoch 2, and the scorer moves to Claude Sonnet 5.5 at medium effort.

Files: CLAUDE.md, docs/HANDOFF.md, docs/demo/2026-10-07-pilot-amendment-release-plan.md, apps/api/src/scoring/provider.ts, apps/api/src/scoring/default-model.ts, apps/api/src/env.ts, apps/api/scripts/eval-reward-prompt.ts, docs/rubrics/eval/reward-eval-cases.json, docs/rubrics/eval/reward-eval-2-calibration.md, docs/rubrics/eval/reward-eval-2-injection.md, docs/rubrics/CHANGELOG.md
Model: Claude Opus 5.5 (xhigh) — a production release with money-bearing scoring and a Codex review in one sitting.
Skills: the-analyst, claude-api, context7, superpowers:test-driven-development, handoff

1. Read-only: confirm the first raid contribution admitted after 18:00Z shows `amendment` (reward-eval/2) and a reward-eval/2 revision; fill Step 8 of the release B record.
2. Switch the scorer to claude-sonnet-5-5 at effort medium, test-first: model id + effort in provider.ts and the env.ts default, an explicit refusal path, the price table at $2/$10. Run eval:reward-prompt on all 28 cases x3 on Sonnet 5.5 medium (about USD 1) and compare with the published Sonnet 5 results; if it scores worse, stop and show Cisco.
3. Record the switch publicly (CHANGELOG entry with the exact UTC time + a short post for Cisco), Codex review (other family, read-only, xhigh) until ACCEPT, a release plan in release B's format, then deploy on Cisco's exact yes before 2026-10-08T12:00Z. No deploy after that; no push or deploy from Oct 8 22:00Z to Oct 10 00:00Z.
```
