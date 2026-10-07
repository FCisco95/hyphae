---
date: 2026-10-07
summary: Hyphae on 2026-10-07 night (Windows, Claude Opus 5.5, Session A). The Jev live scorer release ran E0 to E5 from 21:04Z to 21:40Z - image jev-e5f864b on API and worker, migration 0017 applied (journal 18), JEV_SCORING=on with the TypeSafe key. Jev is enabled but no epoch uses it yet - epoch 2 still scores reward-eval/2 on Claude Haiku 5.5. Next - Cisco posts the announcement with T2, then the agent records the amendment to reward-jev/1 before T2 (E7) and runs live acceptance.
---

# Hyphae handoff

## Metadata

Last Updated: 2026-10-07T22:35Z (Windows)
Project: Hyphae (Colosseum entry, Organic/MYCEL). Scope: the Jev live scorer release (paused between E5 and E6), epoch 2, the Oct 8 to 9 first-payout sitting.
Updated By: Claude Opus 5.5 (`claude-opus-5-5`), Session A (questions, merge, review fixes, release E0 to E5)
Snapshot: [docs/handoffs/2026-10-07-jev-release-paused-at-e6.md](handoffs/2026-10-07-jev-release-paused-at-e6.md). Earlier tonight: [jev-live merged](handoffs/2026-10-07-jev-live-merged.md), [raid buttons live](handoffs/2026-10-07-raid-buttons-live.md), [Jev plumbing](handoffs/2026-10-07-jev-plumbing.md). Where they differ, this file wins.

## TL;DR

- **Live now:** API `6839d31b317318` and worker `817400c9901de8` on `jev-e5f864b` = `sha256:b3f5617d804a377e8eaae1c6c67641ffe85390e47d88c162f0723206994236c4` (source `e5f864b` = `origin/main`). Neon journal **18** (`0017_reward_amendment_chain` applied 21:17:57Z). Fly secrets `TYPESAFE_API_KEY` and `JEV_SCORING=on` deployed 21:36Z; worker booted clean, `reward-recovery` all zeros at 21:40Z.
- **Jev is on but unused.** Epoch 2 still has one amendment (`reward-eval/2` from 18:00Z) and scores with Claude Haiku 5.5. Nothing changes for members until the second amendment, to `reward-jev/1`, is recorded and its time T2 passes.
- **Paused at E6:** Cisco posts the approved announcement with T2: a whole UTC minute at least 20 minutes after his post (not posted as of 22:35Z). Then the agent does E7 before T2: fingerprint, `amend-epoch.ts --plan`, the record, checks. Exact steps and every check: [release plan](demo/2026-10-07-jev-live-release-plan.md), sections "Record", "Step 6" and "Step 7".
- **If Cisco never posts:** nothing is wrong. Jev stays inert; Haiku 5.5 keeps scoring. To undo the release before E7: both machines back to `haiku55-328fb45` (`sha256:4218b2a9…`), optionally `fly secrets unset JEV_SCORING`; the migration stays (the old image runs on it). No deploy after 2026-10-08T12:00Z; no push or deploy 2026-10-08T22:00Z to 2026-10-10T00:00Z.
- **Reviewed and accepted:** Codex ACCEPT on `1185ad1` after five medium findings ([review record](reviews/2026-10-07-jev-live.md)); calibration with Cisco's accepted misses ([report](evals/jev-v4-calibration-2026-10-07.md)).

## Current Objective

Jev scores epoch 2 quality from an announced T2, recorded publicly, with Haiku 5.5 as the effort model and fallback; then the Oct 8 to 9 payout sitting.

## Needs Cisco, in order

1. **Post the announcement** (Hyphae Lab and X) with T2, a whole UTC minute at least 20 minutes after the post; the approved text is in the release plan's "Announcement" section (replace {T2}). Then send the agent the X post URL and T2. The release window (Cisco's yes) runs to 2026-10-08T12:00Z; recording the amendment later needs his say.
2. **Push the release records:** `! git -C <hyphae repo> push origin main` (docs only; the site redeploys).
3. **Oct 8 sitting** (C14 to C22) with the Ledger and the pot. See [the packet](demo/2026-10-08-first-payout-readiness.md).

## Next agent steps (after Cisco's T2)

1. Fingerprint at cutoff C = 2026-10-07T20:55:00Z must still equal the baseline (5/5/5, `abb8e77f`, `6ed1a09e`, `aafe8160`): `scripts/rollout/decisions-digest.mjs` from `packages/db` with the repo `.env`.
2. From the exact-source worktree `C:/hy-jev-e5f864b/apps/api` (detached at `e5f864b`, installed): `amend-epoch.ts <mint> --epoch 2 --prompt reward-jev/1 --effective-at <T2> --actor "Cisco (founder)" --reason "<approved reason>" --plan`, check it names `reward-eval/2` → `reward-jev/1` with template hash `c6fe2dd7811d2468039acf1db8f288a97807ae243354ddb6ab634d8ec3aef267`, then the same without `--plan`, before T2.
3. Checks after the record: `/epochs/2` shows two amendments in order; fingerprint at cutoff T2 equals the baseline for rows before T2.
4. CHANGELOG entry with the exact T2 (`docs/rubrics/CHANGELOG.md`); release record and build log; Cisco pushes.
5. Step 7 acceptance after T2: the first reply admitted after T2 shows `prompt_version` `reward-jev/1`, `model.model` `typesafe:jev-1.13.0`, cost about 200 µUSD, explanation starting "Scored 0 because" or "Passed every check".

## Suggested skills

- `superpowers:verification-before-completion` before claiming E7 or Step 7 done.
- `superpowers:systematic-debugging` if the worker logs a `scoring:` error, a dispatch parks in reconciliation, or `amend-epoch.ts` refuses.
- `handoff-memory:handoff-memory` at the start of the next session (the SessionStart hook loads this file).
- `typesafe:typesafe-ai` only if Jev answers look wrong in production.

## Current State

| Area | State |
|---|---|
| API and worker | Both `started` on `sha256:b3f5617d804a377e8eaae1c6c67641ffe85390e47d88c162f0723206994236c4` (tag `jev-e5f864b`, API since 21:18:43Z, worker since 21:19:31Z, restarted 21:36Z for the secrets). Chain: earn-94ce60e, amend-b265204, raids-777a5b8, buttons-ed32b4f, haiku55-328fb45 (`sha256:4218b2a9…`, the rollback target before E7), jev-e5f864b. |
| Database | Neon journal 18: `0017_reward_amendment_chain` (unique index `reward_config_amendments_epoch_from`), one amendment row. Never roll it back. |
| Jev | `JEV_SCORING=on`, key set, registry `reward-jev/1` (template hash `c6fe2dd7…`). No epoch pins it yet. |
| Epoch 2 | Open until 2026-10-09T00:00Z, base config `df5be064…` (rubric 1.2.0, `reward-eval/1`), amended to config `d265af98…` (`reward-eval/2`, digest `9f4bfac8182a`, the same config the pending epoch 3 proposal pins) from 18:00Z. 4 contributions, 4 decisions as of 17:29Z. History from before the release byte-identical (`scripts/rollout/decisions-digest.mjs` with cutoff 15:22Z: intakes 3 `79ed17cc`, decisions 3 `5897c505`, dispatches 3 `6af848b1`). |
| Epoch 3 | Not created. Materializes after Oct 9 00:00Z and must activate the pending `reward-eval/2` proposal `2ce6085a…`. |
| Scoring model | Anthropic default `anthropic:claude-haiku-5-5` (code default in `apps/api/src/env.ts`, no `SCORING_MODEL` on Fly) for `reward-eval/2` quality and every effort judgment; Jev `reward-jev/1` for quality only once an epoch pins it. |
| Security page | Pushed 21:10Z (the Vercel redeploy was not checked): names TypeSafe beside Anthropic as receiving contributions (only for an epoch that pins Jev), describes the amendment chain, "First used on 2026-10-07", and lists the v4 calibration (`apps/web/lib/trust.ts`, `docs/SECURITY.md`). |
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
