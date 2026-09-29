---
date: 2026-09-29
summary: Steps 10–17 of the Sep 28 session prompt, run with Cisco on Sep 29 instead of Oct 1. Cisco approved the site's copy unchanged; production moved from b7bfe55 to the frozen candidate 86ff258 with migration 0009 only and two mainnet hold RPCs; the bot token was re-rotated and the old one is refused; the site went live on Vercel and the bot links to it; first_paid_epoch reads 2. Neon's free compute hit 80%, so Cisco moved to the Launch plan with a fixed 0.25 CU. The two parked apps/api test fixes shipped test-first. Nothing was rolled back.
---

# 2026-09-29 — the cutover, and the site goes live

## Runner and authority

- **Runner:** Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, effort **high**. Attended: Cisco at the keyboard, one hand-step per message. Git, Docker, flyctl (read-only calls by the agent) and Playwright (Edge) worked; WSL was not needed.
- **Authority:** the session prompt (steps 10–17), Cisco's four rulings of 2026-09-28, and Cisco's own production actions. The agent ran only read-only production checks, plus step 16's pre-approved UPDATE.
- **No review round:** this arc changed two `apps/api` test files, docs and the README; no money, reward, auth, wallet, security or migration code changed, so the working agreement asks for no other-family review.

## Per step

The full log, with every command and result, is the run log in [`2026-10-01-cutover.md`](2026-10-01-cutover.md#run-log).

| Step | Result |
|---|---|
| 10. Copy review | Cisco: "public ok". No edits, so no commit. |
| 11. Neon, before | 9 journal rows 0000–0008, every hash equal; 0009's objects absent; `<MYCEL mint>` = `HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg`; epoch 1 open until 2026-10-02T00:00Z. |
| 12. Hold RPCs, 0009 | Helius + Alchemy, distinct hosts, preflight `holder`, staged. 0009 applied from the `86ff258` worktree: row 10, hash `20828a04…d1cc4`; every post-check equal. |
| 13. Deploy | Image **`deployment-01M3P9QRW519BGZY986E1GV539`** (v8). `/health`, `/link`, `/v1` 200; worker queues including `hold-check`; `reward-recovery` clean; `/rules` 6/6 and `/me` in Hyphae Lab. |
| 14. Token | Revoked, re-set (v9), webhook re-set; **the old token → `Unauthorized`**; `/me` answers. |
| 15. Site | **https://hyphae-delta.vercel.app** (Vercel project `hyphae`, root `apps/web`); `PUBLIC_WEB_URL` (v10); every page check passed, 0 console errors; README links it. |
| 16. `first_paid_epoch` | 1 row updated at 13:37:20Z; reads **2**. |
| 17. Unattended | Two test fixes (below); the worktree removed from git; this record; gate; push. |

## Step 17: the two test fixes

- **The `.env.example` guard skips `content/`.** A new test builds a `content/` and a `lib/` fixture and expects only `lib/read.ts` back; it failed first ("content/snippet.js" was scanned), then passed once `content` joined the skipped directories. The fixture splits `process.env.` from the names, because the guard reads its own test file too (the first draft of the test tripped the guard itself).
- **The eval-scoring child-process test gets 30 s,** and its child 25 s. Its red state is the recorded run of 8.5 s against vitest's 5 s default under the full parallel suite; alone it takes 1–2 s. A timeout can't be shown failing on demand, so this one is verified by the full suite passing, not by a red run.

## Found during the run

- **Neon's free compute was 80% used.** pg-boss polls, so the compute never scales to zero: about 6 CU-hours a day against a 100 CU-hour month. Suspension at 100% would have stopped the bot, the worker and epoch 1's close. On the agent's recommendation Cisco moved the organization to Neon Launch and fixed the production compute at 0.25 CU (it had been 0.25–8 CU autoscaling), capping compute near $19.35 a month. The API read Neon normally afterwards. The billing period resets on the 1st.
- **The GitHub repo is private.** A read-only scan of the full history (306 commits, 521 paths, 13 PR refs) found no secret, keypair, `.env` file or vault content ever committed; only test fixtures, labelled transaction signatures and path references. The decision is Cisco's (`docs/HANDOFF.md`, Open Decisions).
- **`hyphae.fun`**, the API's default `PUBLIC_WEB_URL`, doesn't resolve, so the bot's links were dead until step 15 set the Vercel URL.
- **Rules test feedback:** Cisco asked for study material, example-based questions and a looser price rule. Recorded with a recommendation in `docs/HANDOFF.md`.

## Validation

- `pnpm test`: **721 passed** (core 106, web 75, api 540) + 1 skipped devnet harness.
- `pnpm typecheck` exit 0; `pnpm lint` (Biome, 265 files) clean; `drizzle-kit check` pass; `test:pg` **44/44** on Postgres 17; `git diff --check` clean.

## Readiness for epoch 1's close (2026-10-02T00:00Z)

Ready. Epoch 1 closes unpaid by design (`first_paid_epoch = 2`); the worker runs `reward-close` and `reward-recovery`; Neon can't suspend on the Launch plan. The Oct 2 read-only check is the next session's first step.

## Left over

- The `86ff258` worktree is removed from git (`git worktree list` shows only `main`). Its empty folder `C:\Users\joao_\hyphae-86ff258` was locked by another process at the end of the session (likely a PowerShell window still inside it); delete it once that window closes.
