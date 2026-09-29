---
date: 2026-09-29
summary: The cutover planned for Oct 1 ran on Sep 29 with Cisco, and every check passed. Production runs the frozen candidate 86ff258 (image deployment-01M3P9QRW519BGZY986E1GV539) on Neon 0000–0009 with its two hold RPCs; the bot token is re-rotated and the old one refused; the public site is live at https://hyphae-delta.vercel.app; and first_paid_epoch reads 2, so epoch 1 closes unpaid on Oct 2 and epoch 2 is the first paid week. Neon moved to the Launch plan at a fixed 0.25 CU after its free compute hit 80%. The two parked apps/api test fixes shipped test-first. Later the same day, on Cisco's ruling: the app repo stays private, the program and rubrics are public in FCisco95/hyphae-program (rebuilt from a fresh clone to the recorded hash), both are BUSL 1.1, and the site's links and licence copy point there; the keypair .gitignore guard landed. Open for Cisco: Colosseum's reviewer access, and rules test v2 with rubric 1.3.0 for epoch 3.
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

**What to do next:**
1. **Oct 2, after 00:00Z (read-only):** epoch 1 is `closed` with its snapshot, epoch 2 is open, `reward-close` logged no error, and the payout gate refuses epoch 1 as `before_first_paid_epoch`.
2. **Before submitting:** Cisco adds `hackathon@colosseum.com` as a collaborator on the private repo.
3. **Oct 2–6 arc:** the Ledger-signed devnet deploy, the Jev offline eval, then rules test v2 and the study page (if ruled).
4. **Oct 7–9:** Runbook C.

Run record: [the cutover run log](handoffs/2026-10-01-cutover.md#run-log). Snapshot: [2026-09-29](handoffs/2026-09-29-cutover-run.md).

## Metadata

- Last updated: 2026-09-29, about 15:00Z.
- Runner: Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, effort **high**, attended by Cisco, one hand-step per message.
- Authority: the session prompt's steps 10–17, Cisco's four rulings of 2026-09-28 (step 16's UPDATE once 12–14 passed), and Cisco's own production actions in the session. Neon Launch and its 0.25 CU cap were Cisco's decision in the session, on the agent's recommendation.
- Writable: `apps/web/**`, `apps/api/**` (step 17 only), `docs/**`, README (the site link). No vault or sibling repo was written.

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

## Interfaces and Invariants

- **Production `/v1`:** `/v1/communities/{mint}` and `/v1/communities/{mint}/epochs/{index}` answer. `/v1/wallets/{wallet}/claims`, `/v1/openapi.json` and `/docs` answer 404 until C7. The site shows each missing part as unavailable, never as a zero.
- **The bot's links** go to `PUBLIC_WEB_URL` = `https://hyphae-delta.vercel.app`. The code's default, `https://hyphae.fun`, doesn't resolve.
- **The payout gate:** epoch 1 is refused as `before_first_paid_epoch`; epoch 2's hold checks start after it closes on 2026-10-09T00:00Z. `first_paid_epoch` can only be undone before then (`update … set first_paid_epoch = null … and first_paid_epoch = 2`).
- **The `.env.example` guard** (`apps/api/src/env-example.test.ts`) now skips `content/` directories: text on display, not code that runs.
- Unchanged: the frozen candidate, the custody policy, the 89-byte leaf, the 3% fee, claim and signing behaviour.

## Validation

Production checks: every step's check passed (the run log has each command and result). Nothing was rolled back.

Local gate before the push: `pnpm test` **721 passed** (core 106, web 75, api 540) + 1 skipped devnet harness; typecheck 0; Biome 265 files clean; `drizzle-kit check` pass; `test:pg` **44/44** on Postgres 17; `git diff --check` clean.

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
| Rules test v2, a study page, rubric 1.3.0 | **Open**, raised by Cisco after passing `/rules` 6/6: members need material to study, and questions built from examples ("rate this reply", "good, fake or bot engagement?"); price talk should allow reasoned, hedged opinion. | Rubric 1.3.0 (`docs/rubrics/mycel-1.3.0.json`) already allows grounded, uncertain price speculation and bans guarantees, "buy" instructions and unsupported hype. Evaluate it in the Jev offline eval; then build `mycel-rules-2` for 1.3.0 from worked examples, plus a public `/rules` page with graded examples that the bot links before the test. Activate all three for **epoch 3 (2026-10-09T00:00Z)**, not mid-epoch-2, the first paid week; they ship with `main`'s deploy in Runbook C. |
| The site's domain | Open. | Keep `hyphae-delta.vercel.app` until a domain is bought. If Cisco buys `hyphae.fun`: add it in Vercel, set `PUBLIC_WEB_URL`, and the code default becomes right. |
| Database cost after Oct 12 | Open. | Neon Launch at 0.25 CU is about $19–20 a month. After the hackathon, either let the worker's queue idle so Neon can scale to zero, or move to an always-on free or cheap Postgres; decide with a week of real usage numbers. |
| Vercel plan | Open. | Hobby is fine for the hackathon; its terms are non-commercial, so move to Pro (or elsewhere) before the 3% fee earns anything. |
| The video's theme; the hero's first button | Open (unchanged). | Dark; keep "Open the MYCEL community". |

Ruled 2026-09-28 and now applied or scheduled: Q1 HYP-03 (C18b), Q2 the pot's source (C14, C18), Q3 the Ledger devnet deploy (Oct 2–6), `first_paid_epoch = 2` (**applied**).

## Parked

- **README "Read API" paragraph** still says the API isn't deployed; the status table now says which routes are live. Rewrite the paragraph with C7.
- **Two landing sentences** change with Runbook C: "The production API does not serve this example's wallet-claims route yet" (C7) and "The program is on devnet only" (C13).
- **"API docs"** links to the README's Read API section until `/docs` arrives with C7.

## Next Actions

1. Oct 2 read-only check of epoch 1's close (above).
2. Keep `FCisco95/hyphae-program` in sync with `programs/hyphae` and `docs/rubrics/*.json` (re-verify the build after any program change).
3. Oct 2–6: the Ledger devnet deploy; the Jev offline eval on `feat/jev-eval`; rules test v2 and the study page if ruled.
4. Oct 7–9: Runbook C (`handoffs/2026-09-28-runbook-c.md`).
5. Oct 9–10: the video and the submission checklist (`docs/demo/`).

## For Organic and other integrators

Organic reads Hyphae only through the public read API. As of 2026-09-29 production serves the community and epoch routes; the wallet-claims route and `/v1/openapi.json` arrive with C7.

**Suggested skills, in order:**
1. `handoff-memory`: loads this file.
2. `superpowers:verification-before-completion`: the Oct 2 close check.
3. `solana-dev`: the Ledger devnet deploy.
4. `superpowers:test-driven-development`: rules test v2.
5. `handoff` at the end.

## Next-session prompt

```
Hyphae: production runs 86ff258 on Neon 0000–0009 (cutover done 2026-09-29, docs/handoffs/2026-10-01-cutover.md#run-log); the site is live at https://hyphae-delta.vercel.app; first_paid_epoch = 2. First: a read-only check that epoch 1 closed at 2026-10-02T00:00Z (closed with its snapshot, epoch 2 open, reward-close clean, the gate refusing epoch 1 as before_first_paid_epoch). Then the Oct 2–6 arc from docs/HANDOFF.md: the Ledger devnet deploy, the Jev eval, and rules test v2 + study page if Cisco ruled it.

Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-29-cutover-run.md, docs/handoffs/2026-09-28-runbook-c.md
Model: claude-opus-5-5 (high)
Skills: handoff-memory, superpowers:verification-before-completion, handoff
```
