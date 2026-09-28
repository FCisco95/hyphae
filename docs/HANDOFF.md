---
date: 2026-09-28
summary: Part A of the Oct 1 session prompt (steps 1–9) is done and pushed; nothing is deployed. The frozen candidate 86ff258 passed its gate again, the Windows Solana CLI 3.1.10 is installed and verified, and the Oct 1 cutover runbook is written with Cisco's four Sep 28 rulings folded into Runbook C. Hyphae has a public site ready to deploy: an SVG mark, one design system, a landing page, the audit pages restyled with no behaviour change, social cards, and a video script whose beats each name their page. A fresh gpt-6-astra review found 2 medium and 2 low; all fixed test-first, round 2 APPROVE. Next: Oct 1, Part B (steps 10–16) with Cisco, starting with his copy review of docs/showcase/.
---

# Hyphae handoff

## TL;DR

**Part A (steps 1–9) is done and pushed on `main`; nothing is deployed.**
- **The candidate `86ff258` is still good:** its gate passed again in a temporary worktree (453 tests, `test:pg` 15/15).
- **Windows Solana CLI 3.1.10** at `%USERPROFILE%\solana-3.1.10\solana-release\bin`, archive sha256 checked against the release.
- **The Oct 1 runbook** `handoffs/2026-10-01-cutover.md`: steps 10–16, each with who runs it, its command, its check and its rollback. Cisco's Sep 28 rulings are in Open Decisions below and in Runbook C (C14, C18, C18b).
- **A public site** in `apps/web`, ready for Vercel: the mark and wordmark as SVG, favicon and Apple icon; a landing page at `/`; community, epoch, leaderboard, contribution and claim pages restyled with loading, empty, unavailable and error states; social cards; claim, signing and API behaviour unchanged.
- **Review:** `gpt-6-astra` xhigh, NEEDS-ATTENTION (W1, W2 medium; W3, W4 low), all fixed test-first, round 2 **APPROVE**.

**What to do next:**
1. **Oct 1:** Cisco pastes the session prompt again. `handoffs/2026-10-01-cutover.md` is on `main`, so the session starts at **step 10: Cisco's copy review of `docs/showcase/`** (list below), then steps 11–16, one step per message.
2. **Oct 2–6:** the next-arc list below.
3. **Oct 7–9:** Runbook C, one step per message.

Snapshot: [the site arc](handoffs/2026-09-28-site-arc.md). Earlier today: [the Sep 28 arc](handoffs/2026-09-28-arc.md).

## Metadata

- Last updated: 2026-09-28 (Part A end, about 22:00Z).
- Runner: Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, xhigh. Git and Docker worked; WSL was not needed. Browser checks ran in Microsoft Edge through Playwright (`channel: "msedge"`).
- Reviewer: Codex CLI 0.157.1, **`gpt-6-astra`, xhigh**, read-only, `--ephemeral`, a fresh session each round.
  - Round 1, `4a2569b..92c7afc`: session `01a0e9e8-00b0-7e72-a9b7-ac14a7de260c`, NEEDS-ATTENTION.
  - Round 2, the fix `050d951`: session `01a0e9f3-a126-73c1-84ed-b5876ce742ef`, **APPROVE**.
- Authority: the session prompt's pre-approvals, steps 1–9 including pushes. Writable: `apps/web/**`, `docs/**`, README (site links only; none added, since the site has no URL yet). No Vercel project deploys this repo (GitHub shows no Vercel status or deployment on `main`, checked before each push).

## Current State

| Component | Commit | Stage |
|---|---|---|
| Oct 1 runbook, rulings in Runbook C | `4a2569b` | Pushed. |
| Brand: mark, wordmark, icons | `37190f9` | Pushed. `apps/web/public/brand/`, `app/icon.svg`, `apple-icon.png`, `favicon.ico`. |
| Design system, landing, restyled pages | `346e294`, `92c7afc` | Pushed. |
| Social cards, page titles | `eb10276` | Pushed. |
| Oct 9 video script: beats name pages, recording guide | `dac1458` | Pushed. |
| Review fixes W1–W3 | `050d951` | Pushed. |
| Screenshots, showcase | `33c0906` | Pushed. |
| The site in production | none | **No Vercel project yet**; Cisco creates it at Oct 1 step 15. |
| Program | `.so` sha256 `cb4ffdd8…8d79`, on-chain hash `7e902d1b…43ac` | **On devnet** (`EAz8WkyU…`). Not on mainnet. |
| Migrations 0010–0012, HYP-01, HYP-02 | `dabfb56`, `2c689aa`, `747faa7`, `4d3d48b`, … | Pushed. Not applied or deployed; reach production with Runbook C's C7. |
| Hyphae admin and upgrade key `2kz1Zq…` | Ledger `44'/501'/2'/0'` | Ruled; not funded or used on mainnet. |
| MYCEL Treasury Squads | multisig `34wSn…`, vault `rRce…u7MK` | On mainnet. Nothing sent there yet. |
| Production | Fly `b7bfe55`, Neon 0000–0008 | Last recorded, not queried. No `/v1`. |

## Interfaces and Invariants

- **Site routes:** `/` is the landing page (live numbers from the read API, or "can't be reached"); `/community` redirects to the default community `/c/<mint>`; `/x/<id>` permanently redirects to `/contribution/<id>` (the bot's score links). Every other route is unchanged.
- **Social cards:** `/opengraph-image` (static) and `/contribution/<id>/opengraph-image`. A failed read says "Contribution unavailable" or "Contribution not found" on the card and in the page metadata; it never shows a normal-looking card.
- **The landing says only what it can trace:** each sentence's source is in `docs/showcase/README.md`; tests hold the devnet signatures, the verified hash, the custody policy and the integration code to their source documents.
- **Unchanged:** `components/claim-panel.tsx`, `lib/claim.ts`, `lib/wallet.ts`, `lib/api.ts`, `lib/reads.ts`, `app/api/**`; all 45 web tests that existed before this arc pass unedited. `main`'s site works against `86ff258`'s API (rehearsed locally; the cutover runbook's step 15).
- Unchanged from Sep 28: `init-community`, `publish-epoch`, admission under the community lock, `telegramCall`, `/v1` routes and limits, P14, the custody policy, the 89-byte leaf, the 3% fee.

## Validation

Final gate at `33c0906` (the code is unchanged since `050d951`):
- `pnpm test` **720 passed** (core 106, web 75, api 539) + 1 skipped devnet harness;
- typecheck 0; `pnpm lint` 0 (Biome, 265 files); `drizzle-kit check` pass; `git diff --check` clean;
- `test:pg` **44/44** on Postgres 17; Python vectors: 16;
- `next build` of `apps/web` succeeds.

**Accessibility:** axe-core (WCAG 2.0/2.1/2.2 A and AA, plus best practice) on **40 page × width × theme runs: 0 violations of any impact**. Every one of 36 screenshot captures: 0 horizontal overflow, 0 console errors. Reduced motion draws the filaments still.

**CI** on the push of `33c0906`: **green** (`36488877069`). The step-3 push `4a2569b`: green (`36479081897`).

## For Cisco's copy review (Oct 1, step 10)

Everything is in **`docs/showcase/`**; its `README.md` says where each page's data comes from and traces every landing sentence to its source. Fixture data (the settled epoch and the claim page) is flagged there; its signatures are placeholders.

1. **Start here:** `landing-hero-1920-dark.png` and `landing-hero-1920-light.png` (the video's first frame).
2. **The whole landing:** `landing-1920-{dark,light}.png`, `landing-1180-dark.png`, `landing-390-dark.png`.
3. **The audit pages, dark, at 1180 and 390:** `community-*`, `epoch-*` (settled, fixture), `epoch-final-*` (demo seed), `leaderboard-*`, `contribution-*`, `claim-*` (fixture), `unavailable-*`. The light versions are in `docs/screenshots/`.
4. **Social cards:** `og-landing.png`, `og-contribution.png`.
5. **Edits:** reply with the sentence and its replacement; the agent applies them, gates and pushes (step 10).

## Devnet and Deployment Readiness

### October 1: Part B, steps 10–16 (`handoffs/2026-10-01-cutover.md`)

One step per message with Cisco:

10. Cisco reviews the site's copy (above); the agent applies his edits, gates and pushes.
11. Read-only Neon check: journal 0000–0008 with matching hashes, 0009's objects absent.
12. Cisco stages the two hold RPCs (the agent then runs a read-only hold check through the candidate's own code), and applies **only 0009** from a worktree of `86ff258`; the agent runs the post-checks.
13. Cisco deploys `86ff258` from that worktree; `/health`, `/link`, the worker's queues and `/rules` are verified. Rollback image: `deployment-01M3A6PDECR4D9AP1TSJYDBSP3`.
14. The bot token re-rotation (Runbook B step 9), with a check that the old token is refused.
15. Cisco creates the Vercel project for `apps/web` and sets Fly `PUBLIC_WEB_URL`; then the README gets the site link.
16. `first_paid_epoch = 2` before 2026-10-02T00:00Z, on Cisco's ruling, if 12–14 passed.

`86ff258` does not have the HYP-01 and HYP-02 fixes. Epoch 2 is covered by Runbook C's C18b before it closes. The token exposure needs a Telegram network failure in a worker notice, and ends with C7.

### October 7–9: Runbook C

`handoffs/2026-09-28-runbook-c.md`:
- **Part 1:** migrations 0010–0012 with the worker stopped; the read secrets; the deploy of `main`.
- **Part 2:** the verifiable program deploy with `usb://ledger?key=2/0` as its only upgrade key, then the readback.
- **Part 3:** `init-community` with fee recipient `rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK` (never `34wSn…`); `chain_address`; C14 sends 0.02 SOL to the admin; C18, Cisco sends the exact top-up from his funding wallet straight to the vault; C18b before 2026-10-09T00:00Z.
- **Part 4**, after the close: plan, publish, one claim, the P14 read.
- **Two landing sentences change with it:** "The production API does not serve this example's wallet-claims route yet" (after C7) and "The program is on devnet only" (after C13). The README's status changes at the same points.

**Ledger approvals:** 1 each for the deploy, the init and the publish; readiness reads need none.

## Next Actions

1. **Oct 1:** Part B, steps 10–16, attended.
2. **Oct 2–6 arc** (after the Oct 1 deploy):
   1. **Read-only check of epoch 1's close** (Oct 2, 00:00Z) and of the hold checks.
   2. **Ledger-signed devnet deploy** (ruled yes, early in the window): the rehearsed sequence with `usb://ledger?key=2/0` from the Windows CLI, then close the program to recover the devnet SOL.
   3. **Jev offline eval** (pre-approved): branch `feat/jev-eval`, merged only after the Oct 7–8 payout is confirmed.
   4. **Two `apps/api` test fixes** parked below.
3. **Oct 7–9:** Runbook C, then the two landing sentences.
4. **Oct 9–10:** the video (`docs/demo/2026-10-09-final-video.md`, recording guide inside) and `docs/demo/2026-10-10-submission-checklist.md`.

## For Organic and other integrators

Unchanged: Organic reads Hyphae only through the public read API. Contract: [the key rulings](handoffs/2026-09-27-keys-and-fee-rulings.md#for-organic-and-other-integrators). Production `b7bfe55` has no `/v1`; `86ff258` (Oct 1) serves the community and epoch routes; the wallet-claims route and `/v1/openapi.json` arrive with C7.

## Open Decisions

| Item | Status | Recommendation |
|---|---|---|
| Q1 HYP-03: X handle ownership | **Ruled 2026-09-28** ("Yes to all"). | Operator attestation at C18b: any epoch-2 post whose author Cisco can't confirm as the member's own account is corrected to zero. Verified X linking after the hackathon. |
| Q2 The pot's source | **Ruled 2026-09-28.** | C14 sends 0.02 SOL to the admin `2kz1Zq…`. C18's exact top-up goes from Cisco's funding wallet straight to the vault. |
| Q3 Ledger-signed devnet deploy | **Ruled 2026-09-28: yes.** | Early in Oct 2–6, program closed afterwards. |
| `first_paid_epoch = 2` | **Ruled 2026-09-28: go if Oct 1 steps 12–14 pass.** | Step 16, before 2026-10-02T00:00Z. |
| The site's copy | **Open, Oct 1 step 10.** | Review `docs/showcase/` as listed above. |
| The video's theme | Open. | **Dark**: the mark reads strongest on black, and the recording guide assumes it. |
| The hero's first button, "Open the MYCEL community" | Open. | Keep it: it names the one live community; rename when a second one exists. |

## Parked

- **The API's `.env.example` guard reads display text as an environment read** (`apps/api/src/env-example.test.ts`). The landing's integration snippet lives in `apps/web/content/integration.txt` to avoid it. Fix in the guard: skip `content/` or string literals. Next arc that touches `apps/api`.
- **`scripts/eval-scoring.test.ts` timed out once** (8.5 s against 5 s) under the full parallel suite; alone it passes in under 1 s. Fix: a 30 s timeout on that child-process test.
- **"API docs" links to the README's Read API section** until `/docs` arrives with C7.
- **README link to the site** waits for the Vercel URL (step 15).

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Windows Solana CLI 3.1.10 | `%USERPROFILE%\solana-3.1.10\solana-release\bin` | sha256 `84abbbf2…c06b` matches the release digest; `solana.exe --version` reads `3.1.10 (src:7bc9c805)`. |
| Brand source PNGs | `apps/web/public/brand/source/` | Copied from Cisco's local brand folder, which was read only. |
| Screenshot, axe and review scripts | the session scratchpad | Disposable. Local servers and the `hyphae-site-pg` container were stopped and removed. |

Commits: `4a2569b` … `33c0906`, plus this record. Nothing deployed, no Neon write, no secret changed, no mainnet or devnet transaction, and Cisco's Ledger was not used.

**Suggested skills, in order:**
1. `handoff-memory`: loads this file at session start.
2. `superpowers:verification-before-completion`: for every Oct 1 step's check.
3. The `vercel:deployment-expert` agent: step 15's project settings (root `apps/web`, `HYPHAE_API_URL`, `DEFAULT_MINT`).
4. `solana-dev` and `context7-mcp`: the Ledger devnet deploy.
5. `handoff` at the end.

## Next-session prompt

```
Hyphae main is pushed and CI green; nothing deployed. Part A of the Oct 1 prompt is done (docs/handoffs/2026-09-28-site-arc.md). Oct 1 = Part B, steps 10–16 of docs/handoffs/2026-10-01-cutover.md, attended, one step per message: Cisco's copy review of docs/showcase/, Neon read-only check, 0009 from a worktree of 86ff258, deploy 86ff258, token re-rotation, Vercel project + PUBLIC_WEB_URL, first_paid_epoch = 2 before 2026-10-02T00:00Z.

Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-10-01-cutover.md, docs/handoffs/2026-09-28-site-arc.md, docs/showcase/README.md
Model: claude-opus-5-5 (xhigh): production deploy with hard stops rewards care over speed
Skills: handoff-memory, superpowers:verification-before-completion, handoff

No Neon, Fly, Vercel or mainnet action without Cisco's yes for that step.
```
