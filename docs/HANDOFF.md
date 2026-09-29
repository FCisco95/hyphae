---
date: 2026-09-29
summary: Evening of Sep 29, on Cisco's choice and ahead of the Oct 2 gate, the arc's branch work ran. feat/jev-eval (4a4f4ec, CI green) turns the founder's targets into runnable grades for the 16 synthetic cases; the Jev backend, live runs and report wait for Cisco's Sep 30 question set. feat/rules-v2 (da939d9..9273508) adds rules test mycel-rules-2 and a /rules study page the bot links before the test; then, on Cisco's yes to the four recommendations, rubric 1.3.1 (1.3.0 without the strikes it promised) became the epoch-4 candidate and the test's rubric. Four fresh Codex gpt-6-astra xhigh rounds: FIX, SHIP, SHIP, SHIP. 1.3.1's public sync waits on one wording question (the AI-draft line). Neither branch is merged; main's API code is unchanged since b3c82c7. Epoch 1's close check and the Ledger devnet deploy wait for Oct 2. Earlier the same day: the cutover planned for Oct 1 ran on Sep 29 with Cisco, and every check passed. Production runs the frozen candidate 86ff258 (image deployment-01M3P9QRW519BGZY986E1GV539) on Neon 0000–0009 with its two hold RPCs; the bot token is re-rotated and the old one refused; the public site is live at https://hyphae-delta.vercel.app; and first_paid_epoch reads 2, so epoch 1 closes unpaid on Oct 2 and epoch 2 is the first paid week. Neon moved to the Launch plan at a fixed 0.25 CU after its free compute hit 80%. The two parked apps/api test fixes shipped test-first. Later the same day, on Cisco's ruling: the app repo stays private, the program and rubrics are public in FCisco95/hyphae-program (rebuilt from a fresh clone to the recorded hash), both are BUSL 1.1, and the site's links and licence copy point there; the keypair .gitignore guard landed. Open for Cisco: Colosseum's reviewer access, the Jev question set, and the AI-draft line in 1.3.1.
---

# Hyphae handoff

## TL;DR

**Production moved to the candidate, and the site is public.**
- **API:** Fly `hyphae-api` runs `86ff258`, image `deployment-01M3P9QRW519BGZY986E1GV539` (release v10). Rollback image: `deployment-01M3A6PDECR4D9AP1TSJYDBSP3`.
- **Database:** Neon journal 0000–0009, all hashes checked; 0009's receipt is row 10, hash `20828a04…d1cc4`.
- **Hold checks:** Helius and Alchemy mainnet RPCs, both Deployed; a preflight through the candidate's own code read `holder` for Cisco's wallet.
- **Bot:** token re-rotated (Runbook B step 9); Telegram refuses the old one; `/rules` and `/me` answer.
- **Site:** https://hyphae-delta.vercel.app, from `main`, reading the production API; the bot's links point there (`PUBLIC_WEB_URL`).
- **`first_paid_epoch` = 2** for MYCEL, read back at 13:37:20Z.

**Two branches wait for the Oct 9 payout** (both pushed, neither merged; record: [2026-09-29 branch work](handoffs/2026-09-29-branch-work.md)):
- **`feat/jev-eval`** at `4a4f4ec`, CI `36626690355` green: DEP-06, the 16 founder targets as runnable grades (±5, credited 0 exact, case 12 at 75–80), with each case's absolute error reported. Steps 2b–2d (Jev backend, live runs, `docs/evals/2026-10-jev-vs-sonnet.md`) wait for Cisco's Sep 30 question set.
- **`feat/rules-v2`** at `9273508` (`da939d9`…`9273508`), CI `36635682930` green: rules test `mycel-rules-2` for rubric **1.3.1** from six founder-graded examples, a `/rules` study page that reads which rubric is in force, and the bot linking it before the test. Rubric 1.3.1 is 1.3.0 without its sentence on strikes, which are not built (Cisco's ruling, 2026-09-29 evening). Codex `gpt-6-astra` xhigh: FIX → SHIP → SHIP → SHIP, every finding fixed test-first. Preview (Vercel login): https://hyphae-po203lhbl-ciscos-projects-c3b3be54.vercel.app/rules

**What to do next:**
1. **Cisco, one answer:** should rubric 1.3.1's "What earns zero" stop saying an unedited AI draft earns zero (the code caps it at 79, or 40 when obvious)? "Fix it" (recommended) or "sync as is". Then the agent finishes 1.3.1 on `feat/rules-v2`, reviews it, and copies it to `hyphae-program`.
2. **Cisco:** write the Sep 30 Jev question set in the vault (steps 2b–2d need it), and read `/rules` on the preview.
3. **Oct 2, after 00:00Z (read-only):** epoch 1 is `closed` with its snapshot, epoch 2 is open, `reward-close` logged no error, and the payout gate refuses epoch 1 as `before_first_paid_epoch`.
4. **Oct 2–6:** steps 2b–2d on `feat/jev-eval` (Sonnet on 1.2.0 and 1.3.1); the Ledger-signed devnet deploy with Cisco (Runbook C's C8–C13 at a throwaway address).
5. **Before submitting:** Cisco adds `hackathon@colosseum.com` to the private repo. **Oct 7–9:** Runbook C. **During epoch 3, after the Oct 9 payout (ruled):** merge both branches (rebase, fast-forward), deploy the API with `mycel-rules-2`, then the O4 proposal of 1.3.1 for epoch 4.

Run record: [the cutover run log](handoffs/2026-10-01-cutover.md#run-log). Snapshots: [2026-09-29 cutover](handoffs/2026-09-29-cutover-run.md), [2026-09-29 branch work](handoffs/2026-09-29-branch-work.md).

## Metadata

- Last updated: 2026-09-29, about 22:00Z.
- Runner (evening): Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, effort **xhigh**. The Oct 2 arc's prompt said "start after 2026-10-02T00:00Z"; Cisco chose to run its branch work now (steps 2a, 4, 5), leaving steps 1, 2b–2d and 3 for after Oct 2.
- Authority (evening): Cisco's rulings of 2026-09-28 (the Jev eval as option A with the ±5 range rule) and 2026-09-29 (board decision 2: rules test v2, the study page and rubric 1.3.0 on a branch, merged after the Oct 9 payout, activated at epoch 4). Later that evening, "Let's do your recommendations": rubric 1.3.1 without strikes replaces 1.3.0, the quiz stays all worked examples, Cisco reads `/rules` on a preview before the merge, and the merge and deploy happen in epoch 3 before the O4 proposal.
- Writable (evening): `apps/api/**`, `apps/web/**`, `docs/**` on the two branches; `docs/**` on `main`. No vault or sibling repo was written. `docs/rubrics/mycel-1.3.1.json` is new on `feat/rules-v2`; its copy to `hyphae-program` waits on the AI-draft question (below).
- Runner (cutover, earlier): Opus 5.5, effort high, attended by Cisco, one hand-step per message, under the session prompt's steps 10–17 and Cisco's four rulings of 2026-09-28. Neon Launch and its 0.25 CU cap were Cisco's decision in the session.

## Current State

| Component | Where | Stage |
|---|---|---|
| API and worker | Fly `hyphae-api`, `86ff258`, image `…GV539`, v10 | **Live.** Worker consumes `score`, `reward-*`, `hold-check`. |
| Database | Neon project Hyphae, journal 0000–0009 | **Live.** Launch plan, fixed 0.25 CU. |
| Hold RPCs | `mainnet.helius-rpc.com`, `solana-mainnet.g.alchemy.com` | Deployed. |
| Bot token | rotated 2026-09-29 | Deployed; the old token is refused. |
| Public site | Vercel project `hyphae`, root `apps/web`, https://hyphae-delta.vercel.app | **Live** from `main`; each push to `main` deploys it. |
| MYCEL `first_paid_epoch` | `communities` | **2.** |
| Program | devnet `EAz8WkyU…` | Devnet only. |
| Migrations 0010–0012, `main`'s API, HYP-01/02 | `main` | Not applied or deployed; Runbook C's C7. |
| GitHub repos | `FCisco95/hyphae` (private), `FCisco95/hyphae-program` (public: program + rubrics) | BUSL 1.1. |
| `feat/jev-eval` | `4a4f4ec` | Pushed, CI green. Merges after the Oct 9 payout. 2b–2d to come. |
| `feat/rules-v2` | `9273508` | Pushed after review SHIP. Carries rubric 1.3.1. Merges during epoch 3; its API must be deployed before any epoch opens under 1.3.1. |

## Interfaces and Invariants

- **Production `/v1`:** `/v1/communities/{mint}` and `/v1/communities/{mint}/epochs/{index}` answer. `/v1/wallets/{wallet}/claims`, `/v1/openapi.json` and `/docs` answer 404 until C7. The site shows each missing part as unavailable, never as a zero.
- **The bot's links** go to `PUBLIC_WEB_URL` = `https://hyphae-delta.vercel.app`. The code's default, `https://hyphae.fun`, doesn't resolve.
- **The payout gate:** epoch 1 is refused as `before_first_paid_epoch`; epoch 2's hold checks start after it closes on 2026-10-09T00:00Z. `first_paid_epoch` can only be undone before then (`update … set first_paid_epoch = null … and first_paid_epoch = 2`).
- **The `.env.example` guard** (`apps/api/src/env-example.test.ts`) now skips `content/` directories: text on display, not code that runs.
- Unchanged: the frozen candidate, the custody policy, the 89-byte leaf, the 3% fee, claim and signing behaviour.
- **Rules tests (on `feat/rules-v2`):** the gate still takes the test for the epoch's pinned rubric: `mycel-rules-1` for 1.2.0, `mycel-rules-2` for 1.3.1, and a pass of one never counts for the other. 1.3.0 has no test, so an epoch pinned to it fails closed. An epoch that opens under 1.3.1 on an API without `mycel-rules-2` is blocked `no_rules_test_defined` and its members get no test, so that API deploy must precede activation.
- **`/rules` (on `feat/rules-v2`)** reads the open epoch's rubric and never asserts an activation it has not read.

## Validation

Production checks: every step's check passed (the run log has each command and result). Nothing was rolled back.

Local gate before the cutover-day push to `main`: `pnpm test` **721 passed** (core 106, web 75, api 540) + 1 skipped devnet harness; typecheck 0; Biome 265 files clean; `drizzle-kit check` pass; `test:pg` **44/44** on Postgres 17; `git diff --check` clean.

Branch gates (evening): `feat/jev-eval` **754 passed** + 1 skipped, `feat/rules-v2` **772 passed** + 1 skipped at `9273508`; both typecheck 0, Biome 272 files clean, `drizzle-kit check` pass, `test:pg` 44/44, `git diff --check` clean. On `feat/jev-eval`, 3 of 5 full runs first failed one timing test each in code the branch doesn't touch (parked below).

## Epoch 1's close (2026-10-02T00:00Z): ready

- Epoch 1 is open, with 1 member and 3 contributions, 0 reward intakes and 0 decisions.
- `reward-close` runs in the worker; `reward-recovery` ran clean after the deploy.
- `first_paid_epoch = 2`, so epoch 1 closes unpaid by design.
- Neon can't suspend now (Launch plan), so the close can't lose its database mid-week.
- The bot answers on the new token and links to the live site.

## Open Decisions

| Item | Status | Recommendation |
|---|---|---|
| Repo visibility and licence | **Ruled and done 2026-09-29, except Colosseum access.** `FCisco95/hyphae` stays private. The program (with its tests and vectors) and the rubrics are public at **`FCisco95/hyphae-program`** (`cfff7f4`; Cisco created it with `!` after the harness refused the agent). A fresh clone rebuilds to sha256 `cb4ffdd8…8d79` and `solana-verify` `7e902d1b…43ac`, equal to devnet; its tests pass (24 + 6). Both repos are BUSL 1.1 (Change Date 2028-10-12, Change License GPL-2.0-or-later). The site's GitHub links, licence copy and custody link point at the public repo. **Keep it in sync:** any change to `programs/hyphae` or `docs/rubrics/*.json` must be copied there, and the build re-verified. | Cisco adds `hackathon@colosseum.com` as a collaborator on `FCisco95/hyphae` before submitting (personal repos grant write, not read-only). |
| `.gitignore` guard for keypairs | **Done 2026-09-29** on Cisco's yes. | Add `*-keypair.json`, `id.json` and `admin-*.json`: today only `target/` is covered, and the runbooks' Solana commands write keypairs elsewhere. |
| Rules test v2, a study page, the epoch-4 rubric | **Ruled yes 2026-09-29 (board decision 2), built on `feat/rules-v2`, reviewed SHIP.** Later the same evening Cisco ruled the order: merge and deploy during epoch 3, after the Oct 9 payout, then the O4 proposal of 1.3.1 (accepted in E3, so earliest activation E4). | Cisco reads `/rules` on the preview before the merge (ruled). |
| Rubric 1.3.0 promises strikes | **Ruled and built 2026-09-29.** `docs/rubrics/mycel-1.3.1.json` on `feat/rules-v2` is 1.3.0 without the strike sentence (a test holds it to that); `mycel-rules-2` and `/rules` point at it; the changelog marks 1.3.0 superseded before use. | Sync 1.3.1 to `hyphae-program` once the AI-draft question is answered. |
| The AI-draft line in 1.3.1 | **Open (new, review round 4).** "What earns zero" lists "text that reads like an unedited AI draft", but the code caps a mild AI-writing flag at 79 and only the strong cap (40) falls under the 60 floor; the founder's own case 1 credits 70. Same in 1.2.0 and 1.3.0. | Fix it in 1.3.1 before it goes public: move that line out of "What earns zero" and say "reads like an unedited AI draft: capped at 79, or at 40 when obvious". Then sync. If you'd rather not change the rules text, sync 1.3.1 as it is. |
| The Jev question set | **Needed** for steps 2b–2d. | Cisco writes the Sep 30 note; the eval then runs in the Oct 2 session. |
| Timing and limits in the v2 quiz | **Ruled 2026-09-29: keep.** Every `mycel-rules-2` question is a founder-graded example; the 6-hour/48-hour timing and the one-reply-one-quote limit are on the study page. | — |
| The site's domain | Open. | Keep `hyphae-delta.vercel.app` until a domain is bought. If Cisco buys `hyphae.fun`: add it in Vercel, set `PUBLIC_WEB_URL`, and the code default becomes right. |
| Database cost after Oct 12 | Open. | Neon Launch at 0.25 CU is about $19–20 a month. After the hackathon, either let the worker's queue idle so Neon can scale to zero, or move to an always-on free or cheap Postgres; decide with a week of real usage numbers. |
| Vercel plan | Open. | Hobby is fine for the hackathon; its terms are non-commercial, so move to Pro (or elsewhere) before the 3% fee earns anything. |
| The video's theme; the hero's first button | Open (unchanged). | Dark; keep "Open the MYCEL community". |

Ruled 2026-09-28 and now applied or scheduled: Q1 HYP-03 (C18b), Q2 the pot's source (C14, C18), Q3 the Ledger devnet deploy (Oct 2–6), `first_paid_epoch = 2` (**applied**).

## Parked

- **README "Read API" paragraph** still says the API isn't deployed; the status table now says which routes are live. Rewrite the paragraph with C7.
- **Two landing sentences** change with Runbook C: "The production API does not serve this example's wallet-claims route yet" (C7) and "The program is on devnet only" (C13).
- **"API docs"** links to the README's Read API section until `/docs` arrives with C7.
- **Timing tests flake under the full parallel suite** (seen on `feat/jev-eval`, code untouched there): `apps/api/src/http/settlement.test.ts`'s 500 ms deadline tests and `src/payout/ready-seed.test.ts`'s same-millisecond seed (5 s timeout). `main`'s API tests are frozen until Oct 7; then give them measured budgets, as `5963852` did for the round-loop tests.

## Next Actions

1. Oct 2 read-only check of epoch 1's close (above).
2. Once Cisco's Sep 30 Jev question set exists: steps 2b–2d on `feat/jev-eval` (Jev backend with a recorded mode, live runs only with their keys, the report in `docs/evals/`), gate, push the branch.
3. Oct 2–6, attended: the Ledger-signed devnet deploy (Runbook C's C8–C13 at a throwaway address, Windows Solana CLI 3.1.10, `usb://ledger?key=2/0`).
4. Keep `FCisco95/hyphae-program` in sync with `programs/hyphae` and `docs/rubrics/*.json` (re-verify the build after any program change).
5. Oct 7–9: Runbook C (`handoffs/2026-09-28-runbook-c.md`). Oct 9–10: the video and the submission checklist (`docs/demo/`). After the Oct 9 payout: merge both branches, deploy, then the O4 proposal for epoch 4.

## For Organic and other integrators

Organic reads Hyphae only through the public read API. As of 2026-09-29 production serves the community and epoch routes; the wallet-claims route and `/v1/openapi.json` arrive with C7.

**Suggested skills, in order:**
1. `handoff-memory`: loads this file.
2. `superpowers:verification-before-completion`: the Oct 2 close check.
3. `typesafe:typesafe-ai` and `superpowers:test-driven-development`: the Jev backend (2b); invent no request fields.
4. `solana-dev`: the Ledger devnet deploy.
5. `handoff` at the end.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Branch `feat/jev-eval` (`4a4f4ec`) | GitHub `FCisco95/hyphae` | Unmerged; merges during epoch 3. |
| Branch `feat/rules-v2` (`9273508`) | GitHub `FCisco95/hyphae` | Unmerged; merges during epoch 3; its API deploy must precede 1.3.1's activation. |
| Rubric `docs/rubrics/mycel-1.3.1.json` | `feat/rules-v2` | Not yet in `FCisco95/hyphae-program`: waits on the AI-draft answer. |
| Harness fixture `docs/rubrics/eval/mycel-synthetic.json` | `feat/jev-eval` | Regenerated by `apps/api/scripts/founder-grades.ts`; a test holds it to the review file. |
| Vercel preview deployments of `4a4f4ec`, `ac1ed17`, `9273508` | Vercel project `hyphae`, preview, behind Vercel's login | Created by the branch pushes. `/rules` preview: https://hyphae-po203lhbl-ciscos-projects-c3b3be54.vercel.app/rules |
| Codex review transcripts, rounds 1–4 | This machine's session scratch only | Not kept; each verdict and finding is in `docs/handoffs/2026-09-29-branch-work.md`. |
| Web build output `apps/web/.next` | Gitignored, this machine | Delete `apps/web/.next/types` before gating another branch. |

No keys, credentials, secrets, services, on-chain accounts or scheduled jobs were created.

## Next-session prompt

```
Hyphae, after 2026-10-02T00:00Z. Production runs 86ff258 on Neon 0000-0009 (site https://hyphae-delta.vercel.app, first_paid_epoch = 2); main 7155fd8 has no code change since b3c82c7. Pushed, unmerged until epoch 3: feat/jev-eval 4a4f4ec (DEP-06 runnable founder grades) and feat/rules-v2 9273508 (mycel-rules-2, the /rules page, rubric 1.3.1; Codex SHIP). Rubric 1.3.1's public copy waits on Cisco's AI-draft answer.

Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-09-29-branch-work.md, docs/handoffs/2026-09-29-cutover-run.md, docs/handoffs/2026-09-28-runbook-c.md, docs/handoffs/2026-09-28-verifiable-build-and-deploy-rehearsal.md, docs/handoffs/2026-09-27-ledger-transport.md, docs/rubrics/eval/mycel-synthetic-review.json, apps/api/scripts/eval-scoring.ts, packages/core/src/score.ts
Model: claude-opus-5-5 (xhigh) - production checks, a Ledger-signed deploy and reward-scoring code, where precision beats speed.
Skills: handoff-memory, superpowers:verification-before-completion, typesafe:typesafe-ai, superpowers:test-driven-development, solana-dev, handoff

1. Read-only: confirm epoch 1 closed with its snapshot, epoch 2 is open, reward-close logged no error, and the payout gate refuses epoch 1 as before_first_paid_epoch. Record each command and its result.
2. If Cisco answered the AI-draft question: apply it to docs/rubrics/mycel-1.3.1.json on feat/rules-v2 test-first (or leave it as is), get a fresh Codex gpt-6-astra xhigh review, push the branch, then copy 1.3.1 byte for byte to FCisco95/hyphae-program with a rubrics/README.md row.
3. If Cisco's Sep 30 Jev question set exists in the vault: steps 2b-2d on feat/jev-eval (@typesafe-ai/sdk with jev-1.13.0 pinned, a recorded mode without a key, live Jev only with TYPESAFE_API_KEY, Sonnet on 1.2.0 and on 1.3.1 from `git show origin/feat/rules-v2:docs/rubrics/mycel-1.3.1.json` only with ANTHROPIC_API_KEY, the 16 synthetic cases only, docs/evals/2026-10-jev-vs-sonnet.md). Full gate, push the branch, never main.
4. Attended with Cisco and the Ledger: Runbook C's C8-C13 on devnet at a fresh throwaway program address, the Ledger (usb://ledger?key=2/0, 2kz1Zq...) as upgrade authority, Windows Solana CLI 3.1.10.
5. Handoff and BUILDLOG on main, docs only: the close receipt, the eval's headline numbers, the Ledger receipt.
Stops: no change to main's API code before Oct 7; no merge; no rubric activation; nothing on mainnet.
```
