---
date: 2026-09-30
summary: Session closed 2026-09-30 evening (record: docs/handoffs/2026-09-30-session-close.md). Part A and the late Jev review fixes are complete and pushed. feat/jev-eval is at 7c00629, with all three findings addressed and its full local gate and CI green. docs/runbook-c-truths is pushed at b95d0ab after its full gate. The optional Claude follow-up review returned HTTP 429 twice, including after the reported credit reset; no follow-up verdict exists. fix/timing-budgets is at 02ee74e with ten continuation full-suite passes and green CI. Later on 2026-09-30 Cisco ruled nine times on the Jev questions, the first live Jev vs Sonnet run happened, and feat/jev-eval is now at 707d7da with question set v3 (docs/handoffs/2026-09-30-jev-eval-run.md). Part B waits for 2026-10-02T00:00Z and Cisco. Production remains 86ff258 on Neon 0000-0009, first_paid_epoch 2; Runbook C's candidate remains b3c82c7. Nothing merged, deployed or written to production.
---

# Hyphae handoff

## TL;DR

**Session close, 2026-09-30 evening** (receipt: [session close](handoffs/2026-09-30-session-close.md), written for `/organic-sync`). The pre-Oct-2 work is finished: the CLAUDE.md CI note is corrected on `main`, and the Jev eval ran live with nine rulings from Cisco, pushed on `feat/jev-eval` `707d7da`. The production path is untouched (production `86ff258`, Neon 0000 to 0009, Runbook C candidate `b3c82c7`, API tree equals the candidate). **Next gate: 2026-10-02T00:00Z, with Cisco** (Part B below). The Jev follow-ups are optional and need Cisco's grades and two answers about the project brief.

**Part A of the Oct 2 arc is done** (2026-09-30; record: [2026-09-30 Part A](handoffs/2026-09-30-part-a.md)). Next is **Part B, after 2026-10-02T00:00Z, with Cisco**: epoch 1's close check, the Ledger devnet deploy, then Runbook C Parts 1–2 on mainnet.

**The quoted prior-session open items are complete:** all three Jev findings are fixed on `feat/jev-eval` at **`7c00629`**, pushed, and `docs/runbook-c-truths` is pushed at **`b95d0ab`** after its full gate. Jev now rejects unsafe options before provider calls, records scoring configuration and live/replay provenance, and tests request identity and composition boundaries. Its full local gate passed (792 tests + 1 skipped; Postgres 44/44), and CI `36707618974` passed. The runbook branch's CI `36697228485` passed. Do not reopen these as unfinished implementation or an unpushed branch.

**The Jev eval ran live, in the same day's later session** (record: [Jev eval run](handoffs/2026-09-30-jev-eval-run.md)). Cisco ruled on the five open questions in session; `feat/jev-eval` is at **`5882fb3`**, pushed, with the ruled question set (v3 now; v1 is what the first run used), the eval-only `low_effort` zero, the first run's report and recordings. Jev passed 4 of 16 (rubric 1.2.0) and 5 of 16 (1.3.1), Sonnet 3 and 2; no superiority claim from 16 cases. Ruling 5's "backwards sentence" tell did not fire (ai_slop P(yes) 0.09 on case 1), and raw scores on flagged cases miss the founder's targets in both directions. Cisco then labeled 48 replies I wrote (two sessions, one labeler; files are local and gitignored) and amended ruling 5: the backwards shape alone is not the tell, it reads as AI when polished, abstract or stacked. v2 carries that wording; on a holdout it cleared one false flag and kept his AI calls. Cisco then scored his own 11 replies through Jev (screenshots, known human): no false AI flags, but banter and link-sharing replies were zeroed by `low_effort` or `off_topic`. He ruled that jokes and short opinions are not low effort, that the scorer needs a maintained project brief, that answering with the project's own material is good engagement, and that an organic reaction earns the low end (about 60 to 70) of the same scale (rulings 6 to 9). v3 writes 6 and 9 into the questions; measured, the effect is small, and examples in the state did not change that. Next: a calibration learned from his grades (not more wording), his approval of a draft project brief, and intake that passes quoted posts and image descriptions.

**Optional follow-up review remains pending:** both fresh Claude attempts, including the retry after Cisco reported resetting credits, returned HTTP 429 with zero review tokens and a reported reset of 14:20 Lisbon. No follow-up SHIP verdict is claimed. The original mandatory rubric review remains SHIP. Details: [continuation receipt](handoffs/2026-09-30-orca-continuation.md).

The timing branch's original CI run `36696829889` failed despite its 12 local passes (nine reads versus eight in the deadline test). Test-only correction `02ee74e` is pushed; all ten continuation full-suite runs passed (726 tests + 1 skipped each), the weakened-guard mutation was caught, and CI `36708435237` passed. The earlier count of five omitted completed background runs. Do not describe `8d9acfc` as the corrected CI run.

**Production is unchanged since the Sep 29 cutover:**
- **API:** Fly `hyphae-api` runs `86ff258`, image `deployment-01M3P9QRW519BGZY986E1GV539` (release v10). Rollback image: `deployment-01M3A6PDECR4D9AP1TSJYDBSP3`.
- **Database:** Neon journal 0000–0009 (Postgres 18.6, Launch plan, fixed 0.25 CU).
- **Site:** https://hyphae-delta.vercel.app, from `main`. **Bot** on the rotated token. **MYCEL `first_paid_epoch` = 2.**

**Done in Part A:**
- **Rubric 1.3.1 is final and public.** "What earns zero" no longer lists an unedited AI draft; "How grading works" says it is "capped at 79, or at 40 when obvious, and a score under 60 earns zero" (Cisco's "fix it"). `feat/rules-v2` `158452f`, Codex `gpt-6-astra` xhigh **SHIP** with no findings. `FCisco95/hyphae-program` `9999bfa` carries it byte for byte (sha256 `56e5fad1…03de`).
- **The Jev backend** on `feat/jev-eval` (`7c00629`): `eval-scoring --backend jev`, `jev-1.13.0` pinned, unsafe replay options rejected before provider construction, replay/configuration provenance recorded, and H1's DRAFT question set (`docs/evals/jev-questions-draft.md`) as the default. **Not run live:** Cisco's question set doesn't exist yet.
- **Runbook C Parts 1–2 on Oct 2–3** (`main` `e7f3821`): candidate `b3c82c7`; C4 behind `options=-c lock_timeout=3000` on Neon's direct endpoint with a retry rule; C7 checks the worker drains its queue. Every Oct 2 precondition is listed in the runbook's new first section.
- **Helpers and continuation:** `fix/timing-budgets` `02ee74e` on `8d9acfc` (the settlement flake, test files only); `docs/runbook-c-truths` `ad40b77` (C7) and `b95d0ab` (C13); the video script and submission checklist on `main` (`c93561a`).

**What to do next:**
1. **Cisco, any time before Oct 2 (dashboard):** Vercel Pro with usage alerts (board decision 4, ruled yes).
2. **Optional, whenever Cisco has time (Jev eval):** answer the project brief's two open questions and confirm its flagged sentence (`docs/evals/project-brief-mycel.md` on `feat/jev-eval`); grade more replies, including jokes and short opinions, so a calibration can be fit and tested on a holdout. The `13 Jev Question Set` vault note is no longer needed: the set is `docs/evals/jev-questions.md`.
3. **Oct 2 after 00:00Z (read-only):** epoch 1 `closed` with its snapshot, epoch 2 open, `reward-close` logged no error, the payout gate refuses epoch 1 as `before_first_paid_epoch`.
4. **Oct 2, attended (~30 min):** the Ledger-signed devnet deploy (Runbook C's C8–C13 at a fresh throwaway address, Windows CLI 3.1.10, `usb://ledger?key=2/0`), then one `/claim` from a real browser wallet against that devnet program.
5. **Oct 2–3, attended:** Runbook C C1–C13 on mainnet, one step per message. After C7 passes, merge `ad40b77`; after C13, merge `b95d0ab` (rebase, fast-forward).

## Metadata

- Last updated: 2026-09-30 evening, session close requested by Cisco; `origin` branch heads re-verified (`feat/jev-eval` `707d7da`, `feat/rules-v2` `158452f`, `fix/timing-budgets` `02ee74e`, `docs/runbook-c-truths` `b95d0ab`).
- This session's runner: Claude Code **Sonnet 5.5**, effort **high**, no helpers; reviewer Codex `gpt-6.1-sol` high, read-only, three rounds (eight findings, all fixed). Usage was not exposed (budget counter about 45k, unverified). Spend: Sonnet $0.464 recorded plus about $0.19 estimated; Jev about $0.07 estimated. Full accounting in the session-close receipt.
- Continuation runner: Codex, GPT-6 (specific variant and effort not exposed by this runtime); no helpers. The original Orca/provider session was read only, never resumed or modified.
- Runner: Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, effort **xhigh**, unattended. Helpers: three Claude **Sonnet** subagents (H1–H3), each writing only its own files; the main session reviewed and committed every diff. Reviews: Codex `gpt-6-astra`, reasoning xhigh, read-only.
- Authority: the session prompt's Part A and Cisco's rulings on the vault's Integration Board (2026-09-29, "I agree with them"): decision 2 "fix it", decision 3 yes, decision 4 yes.
- Writable, as used: `apps/api/**`, `apps/web/**`, `packages/core/**`, `docs/**`, `README.md` on the four branches; `docs/**` on `main`; `rubrics/**` of the `hyphae-program` clone. No vault or sibling-repo write. No production write: two read-only Neon transactions (C4's connection check).

## Current State

| Component | Where | Stage |
|---|---|---|
| API and worker | Fly `hyphae-api`, `86ff258`, image `…GV539`, v10 | **Live.** Worker consumes `score`, `reward-*`, `hold-check`. |
| Database | Neon project Hyphae, journal 0000–0009 | **Live.** Postgres 18.6. |
| Public site | Vercel project `hyphae`, https://hyphae-delta.vercel.app | **Live** from `main`. Hobby plan until Cisco moves it to Pro. |
| Program | devnet `EAz8WkyU…`, upgrade authority the throwaway `Fcv1xtZ6…` | Devnet only; mainnet `AccountNotFound`. |
| Runbook C candidate | `b3c82c7` (CI `36596228282`) | Pinned. Migrations 0010–0012, HYP-01/02 and the full `/v1` arrive at C4 and C7. |
| `main` | docs after `b3c82c7`; API tree equals the candidate | `2302224` (CLAUDE.md CI note) pushed on top of `f902a64`. |
| `feat/rules-v2` | `158452f` (CI `36694552444` green) | Pushed. Rubric 1.3.1 final. Merges during epoch 3. |
| `feat/jev-eval` | `707d7da` | Pushed. Ruled question set v3 (v1 for the first live run), report with three addenda, approved project brief (not wired in); gate green (test run 1 of 3 failed on the known settlement flake, see the run record). Merges during epoch 3. |
| `fix/timing-budgets` | `02ee74e` on `8d9acfc` | Pushed; CI `36708435237` passed. Merge after C7 (test files of the frozen API). |
| `docs/runbook-c-truths` | `ad40b77` (C7), `b95d0ab` (C13) | Pushed. Merge each commit when its step has passed. |
| `FCisco95/hyphae-program` | `9999bfa` | Public: program, rubrics 1.0.0–1.3.1. |

## Interfaces and Invariants

- **Production `/v1`:** `/v1/communities/{mint}` and `/v1/communities/{mint}/epochs/{index}` answer. `/v1/wallets/{wallet}/claims`, `/v1/openapi.json` and `/docs` answer 404 until C7. The site shows each missing part as unavailable, never as a zero.
- **The payout gate:** epoch 1 is refused as `before_first_paid_epoch`; epoch 2's hold checks start after it closes on 2026-10-09T00:00Z.
- **C4 must use Neon's direct endpoint with `options=-c lock_timeout=3000`.** `.env`'s `DATABASE_URL` is the pooler, which refuses it; a bare `lock_timeout=` parameter is silently ignored on the direct endpoint. The runbook's PowerShell builds the URL from `.env`.
- **Vault addresses:** the vault is the PDA of `["vault", community]`, where `community` is the PDA of `["community", mint, admin]`. Integrators, Organic included, derive it themselves; the admin is a seed, so a community is the pair, not the mint alone.
- **Rules tests (on `feat/rules-v2`):** the gate takes the test for the epoch's pinned rubric: `mycel-rules-1` for 1.2.0, `mycel-rules-2` for 1.3.1, and a pass of one never counts for the other. 1.3.0 has no test and fails closed. The API with `mycel-rules-2` must be deployed before any epoch opens under 1.3.1.
- **The Jev eval is offline only:** nothing in production calls it; a live run needs `TYPESAFE_API_KEY` (never a Fly secret) and inputs only the 16 synthetic cases. Jev-only CLI options require `--backend jev`; replay results label the original call's latency, usage and cost as historical. Local composition changes are visible in `composition` and `configurationHash`, separate from the HTTP `requestHash`.
- **Keep `hyphae-program` in sync** with `programs/hyphae` and `docs/rubrics/*.json`; re-verify the build after any program change.
- Unchanged: the frozen candidate, the custody policy, the 89-byte leaf, the 3% fee, claim and signing behaviour.

## Validation

| Gate | `feat/rules-v2` `158452f` | `feat/jev-eval` `7c00629` | `fix/timing-budgets` `02ee74e` | `docs/runbook-c-truths` `b95d0ab` |
|---|---|---|---|---|
| `pnpm test` | 773 + 1 skipped | 792 + 1 skipped | 726 + 1 skipped, ten runs | 726 + 1 skipped |
| typecheck | 0 | 0 | 0 | see below |
| Biome | 273 clean | 275 clean | 267 clean | see below |
| `drizzle-kit check` | pass | pass | pass | see below |
| `test:pg` | 44/44 | 44/44 | see below | see below |
| `git diff --check` | clean | clean | see below | see below |

- Before the continuation fixes, `feat/jev-eval`'s first full run failed one test, the settlement deadline flake that `fix/timing-budgets` fixes; the next two full runs passed. The current `7c00629` gate is recorded separately below.
- `fix/timing-budgets`: H2's original 12 local full parallel runs passed, but CI exposed a timer-boundary race. Continuation commit `02ee74e` controls the test clock; ten additional full-suite runs passed locally, the weakened-guard mutation failed as expected, and CI `36708435237` passed, including Postgres 44/44. No separate local Postgres rerun after `02ee74e` is claimed.
- Follow-up `feat/jev-eval` `7c00629`: 792 tests + 1 skipped (106 core, 79 web, 607 API), typecheck clean, Biome 275 files clean, drizzle check pass, Postgres 44/44, diff check clean. The eight invalid-CLI cases were red before the fix with network intercepted; all now reject before a provider call.
- `docs/runbook-c-truths` `b95d0ab` was pushed after its gate completed: 726 tests + 1 skipped, Postgres 44/44. CI `36697228485` passed, independently checked in this continuation.
- Codex `gpt-6-astra` xhigh: step 1 **SHIP** (no findings).
- Final documentation refresh on `main`, after `ce99c4e`: full local gate passed again before committing (726 tests + 1 skipped; typecheck 0; Biome 267 files clean; drizzle check pass; local Postgres 44/44; diff check clean). Handoff validation passed with template-format warnings; every path in the resume prompts exists. Only the three handoff/build-log files changed; the untracked `wsl` file is untouched.

## Open Decisions

| Item | Status | Recommendation |
|---|---|---|
| The Jev question set | **Ruled 2026-09-30** (five rulings, `docs/evals/jev-questions.md`); first run done. | Next: fix the raw-score double count in the criteria questions, add a deterministic backwards-sentence check, and have Cisco supply 30+ real labelled replies before tuning against the 16. |
| Ritual posts and the `low_effort` pre-filter | New, Cisco's ideas 2026-09-30. | Rubric-level design for a version after 1.3.1: an admin tags ritual (greeting) posts at intake with a small fixed credit and no AI call, and a no-AI pre-filter zeroes a bare gm or emoji-only reply. Production's `creditedScore` does not zero `low_effort` yet; only the eval does. |
| When `fix/timing-budgets` merges | Open. | After C7: its files are tests of `main`'s frozen API; merging before C1 would change the candidate's tree. |
| The public `hyphae-program` README at C7 and C13 | Open. | Allow the C7 and C13 sessions to edit that README's status, Read API and funding lines (the same changes as `docs/runbook-c-truths`); this session could write only `rubrics/**`. |
| `CLAUDE.md` says "There is no CI" | **Done** 2026-09-30 (`2302224`). | CI runs the gate on every push; the local gate still runs before each push. |
| Repo visibility and licence | Ruled and done 2026-09-29, except Colosseum access. | Cisco adds `hackathon@colosseum.com` to `FCisco95/hyphae` before submitting (checklist step 4). |
| Vercel plan | **Ruled yes 2026-09-29** (board decision 4). | Cisco's dashboard step: Pro with usage alerts. |
| The site's domain | Open. | Keep `hyphae-delta.vercel.app` until a domain is bought. |
| Database cost after Oct 12 | Open. | Decide with a week of real usage numbers. |
| The video's theme; the hero's first button | Open (unchanged). | Dark; keep "Open the MYCEL community". |

## Parked

- **Optional fresh Claude review of `0894335..7c00629`:** two HTTP 429 responses, zero review tokens, no verdict. Retry when Claude CLI access is available; the three original findings are already fixed and pushed.
- **`gates.pg.test.ts` "concurrent runs settle on one row…" hung to its 60 s timeout** in 2 of 8 `test:pg` runs on 2026-09-30, both under heavy parallel load; it passes in about 4 s otherwise, on `main` too. `main`'s API is frozen before C1; read `runHoldChecks`'s pool and lock path after the payout. Production runs one worker, so the multi-pool race doesn't arise there.
- **Jev eval, remaining:** no case tests `link_mismatch` positively; flagged-case raw scores miss in both directions (Ruling 4 says fix the questions, not the check); no cap on a perfect reply (Ruling 3). Details in the run report `docs/evals/jev-first-run-2026-09-30.md` on `feat/jev-eval`.

## Next Actions

1. Oct 2 after 00:00Z, read-only: epoch 1's close (the Next-session prompt's step 6). A failure there stops Part B: report, don't repair.
2. Oct 2, attended: the Ledger devnet deploy and one browser-wallet `/claim` on devnet.
3. Oct 2–3, attended: Runbook C C1–C13, one step per message; merge `ad40b77` after C7 and `b95d0ab` after C13; sync the public README if allowed.
4. Jev eval follow-up: see the Jev eval run record's recommended next steps; needs Cisco's real labelled replies.
5. Oct 8–9: Runbook C Parts 3–4 (unchanged). Oct 9–10: the video and the submission checklist. During epoch 3, after the payout: merge `feat/rules-v2` and `feat/jev-eval`, deploy, then the O4 proposal of 1.3.1.

## For /organic-sync

Everything downstream is listed in [session close](handoffs/2026-09-30-session-close.md), "Downstream changes": the applied CI patch, the nine rulings to record, the missing `13 Jev Question Set` note (superseded by `docs/evals/jev-questions.md`), the rubric-level ideas for a version after 1.3.1, the approved brief and Cisco's description of Organic. Nothing changed in `organic-app`, the public `hyphae-program` repo, the vault or any sibling.

## For Organic and other integrators

Organic reads Hyphae only through the public read API. Production serves the community and epoch routes; the wallet-claims route, `/docs` and `/v1/openapi.json` arrive with Runbook C's C7 (planned Oct 2–3). To find a community's vault, derive the PDA of `["vault", community]`, where `community` is the PDA of `["community", mint, admin]`, on the program `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`.

**Suggested skills, in order:**
1. `handoff-memory`: loads this file.
2. `superpowers:verification-before-completion`: the epoch 1 close check and each Runbook C check.
3. `solana-dev`: the Ledger devnet deploy and C8–C13.
4. `typesafe:typesafe-ai` and `superpowers:test-driven-development`: 2c–2d once Cisco's set exists.
5. `handoff` at the end.
6. Only if the Jev follow-ups start: `typesafe:typesafe-ai` and `superpowers:test-driven-development`; read `docs/handoffs/2026-09-30-jev-eval-run.md` first.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Branches `feat/rules-v2`, `feat/jev-eval`, `fix/timing-budgets`, `docs/runbook-c-truths` | GitHub `FCisco95/hyphae` | Pushed, unmerged. |
| `hyphae-program` commit `9999bfa` | GitHub `FCisco95/hyphae-program` | Public. |
| Worktrees `../hyphae-wt/{rules-v2,jev-eval,timing,c-truths}` | This machine, beside the repo | Remove with `git worktree remove`; long paths need PowerShell `Remove-Item -LiteralPath "\\?\<path>"` then `git worktree prune`. |
| Vercel previews of the branch pushes | Vercel project `hyphae`, behind Vercel's login | Created by the pushes. |
| Codex review logs; the C4 rehearsal files | Session scratch only | Verdicts and numbers are in the Part A record. |

No keys, credentials, secrets, services, on-chain accounts or scheduled jobs were created.

## Next-session prompt

```
Hyphae Part B, after 2026-10-02T00:00Z, with Cisco. Production runs 86ff258 on Neon 0000-0009 (site https://hyphae-delta.vercel.app, first_paid_epoch = 2). Part A is done (docs/handoffs/2026-09-30-part-a.md); its late Jev review findings are fixed in 7c00629 (docs/handoffs/2026-09-30-orca-continuation.md). Pushed, unmerged: feat/rules-v2 158452f and feat/jev-eval 707d7da (merge during epoch 3; docs/handoffs/2026-09-30-session-close.md), fix/timing-budgets 02ee74e (CI 36708435237 passed; merge after C7), docs/runbook-c-truths ad40b77 (C7) and b95d0ab (C13). Runbook C's candidate is b3c82c7.

Read: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-09-30-part-a.md, docs/handoffs/2026-09-28-runbook-c.md (its first section lists Oct 2's preconditions), docs/handoffs/2026-09-28-verifiable-build-and-deploy-rehearsal.md, docs/handoffs/2026-09-27-ledger-transport.md.
Model: claude-opus-5-5 (high) - production checks and a Ledger-signed deploy.
Skills: handoff-memory, superpowers:verification-before-completion, solana-dev, handoff

6. Read-only: epoch 1 is closed with its snapshot, epoch 2 is open, reward-close logged no error, and the payout gate refuses epoch 1 as before_first_paid_epoch. Record each command and its result.
7. Attended, about 30 minutes: the Ledger-signed devnet deploy, Runbook C's C8-C13 at a fresh throwaway program address, Windows Solana CLI 3.1.10, usb://ledger?key=2/0. Then one /claim from a real browser wallet on Cisco's device against that devnet program. Done when the chain reads the Ledger back as upgrade authority with the verifiable build's hash, the hot key is closed, each approval is recorded and the browser claim landed.
8. Runbook C Parts 1-2 (C1-C13) on mainnet, one step per message, each a hard stop with Cisco's yes. After C7 passes, rebase docs/runbook-c-truths on main and fast-forward its C7 commit only; after C13, its C13 commit.
9. Handoff and BUILDLOG on main: the close receipt, the devnet Ledger receipt, each Runbook C step's receipt.
Stops: epoch 1 didn't close cleanly or the gate doesn't refuse it (report, don't repair); any change under programs/hyphae; a Runbook C check fails (stop there). Out of scope: Parts 3-4 (C14-C22), merging feat/rules-v2 or feat/jev-eval, activating a rubric.
```
