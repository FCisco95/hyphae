---
date: 2026-10-08
summary: DRAFT, not authorized. Release plan for the reviewed `next` branch (scorer reward-eval/3 with its whole-call deadline, honest payout status, wallet record, raid stats and recap, claim Blink, the epoch-page schedule notice) after the epoch 2 payout. Migrations 0018 and 0019 through the re-pinned and reviewed db.mjs, one image for the API and the worker, then the push of main for the web, then the epoch 3 scorer amendment at a time Cisco announces. Recommended timing, after C22 on 2026-10-11.
---

# Release plan: `next` after the first payout (DRAFT, 2026-10-08 night)

Written by Claude Fable 5.1 (architect). Format follows the [Jev live release plan](2026-10-07-jev-live-release-plan.md). Nothing here runs without Cisco's exact yes. Proposed sentence: **"yes, run the post-payout release"**.

## Timing: my recommendation

**After the hold ends (2026-10-11T00:00Z) and after C19 to C22 have run on the deployed source.** Then this release, then the video's final cut and the submission.

Why not before the freeze (2026-10-09T22:00Z): the branch changes the payout gate's read path and the worker's scoring engine, and every one of its five branches needed fixes after review tonight. A first mainnet payout is the one irreversible event of the week; it should run on code that has been live for two days, not on code deployed hours before. Why not between the close and C19: the hold window runs then, and the deploy restarts the worker that reads the hold.

What that costs: epoch 3 replies admitted between 2026-10-10T00:00Z and the amendment time T are scored by `reward-eval/2`, the ranking prompt that under-scored honest replies. Mitigation, Cisco's: **open no raid in epoch 3 until T.** Replies only arrive through raids, so nobody is scored by the old prompt in epoch 3.

## Blockers before the yes

| # | Blocker | State (2026-10-08 night) |
|---|---|---|
| 1 | Codex reviews of the five branches, findings fixed test-first, fix checks ACCEPT | scorer-v3, raid-stats, wallet-record, Blink: **ACCEPT** after fixes ([records](../reviews/)). payout-status: five findings fixed, fix check running |
| 2 | Schedule notice on the epoch page (ruling 3) | merged into `next` |
| 3 | `scripts/rollout/db.mjs` re-pinned to 0018+0019 with the post-payout epoch state, rehearsed on Postgres 17 and 18 | **done and reviewed, ACCEPT** (`docs/handoffs/2026-10-09-rollout.md`, `docs/reviews/2026-10-09-rollout.md`) |
| 4 | Full gate on the merged `next`: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `drizzle-kit check`, `test:pg`; numbers in the handoff | after 1 |
| 5 | Cisco's answers: the scorer's four questions, the member-visible strings in each branch note (payout-status, wallet-record, raid-stats, Blink, the notice panel, the `/me` lines added by the payout fix), the privacy call (rules-test status public per member id), the CHANGELOG and announcement wording | morning of Oct 9 |
| 6 | C19 to C22 done and recorded: the payout published and claimed, P14 read. **Precondition the script does not certify:** `db.mjs` accepts epoch 2 closed-and-unpublished as well as published; the plan requires `published` before E2 | Oct 11 |

## What goes live

| Branch | Effect |
|---|---|
| scorer-v3 + scorer-fix | `reward-eval/3` registered, inert until the amendment (E8); the Claude call bounded body included by the 90 s deadline. New dependency `@anthropic-ai/sdk` |
| payout-status + payout-fix | Read API `payout` per row, entry and contribution; the read clock taken inside each read's snapshot; "Scored." plus what pay needs; `/me` checklist naming the wallet at the close; one line on a member's first score message of an epoch, serialized per member and epoch |
| wallet-record + wallet-fix | `GET /v1/wallets/:wallet/record` (one joined query before the empty path), `/wallet/[wallet]`, migration 0018 (index) |
| raid-stats + raid-fix | `/raids` stats, one public recap when a raid ends (sent under the raid's lock, one 429 retry), migration 0019 (`raid_recaps` with `retry_used`); the recap link uses `PUBLIC_WEB_URL` (confirm the Fly value is the live site before E3) |
| blink + blink-fix | Solana Action for a claim, `actions.json`, "Share claim link on X"; web only |
| notice | "Schedule change" panel on an epoch whose window differs from its configured duration; web only |
| rollout | `db.mjs` pinned to 0018 `79592f95…2302` and 0019 `b81d6085…864b` |

**What it does not change:** rubric 1.2.0, the credit rules, the program, the payout gate's verdicts (`payTerms` and `judgeMembers` extracted, not changed), epoch 2's settlement, the held refs.

## Exact live effects, in order

| # | Effect | Target and bound |
|---|---|---|
| E0 | Merge `next` into `main` locally, full gate green, **no push yet** | home machine, `main` |
| E1 | Build and push one image from the exact source | detached clean worktree at `main`'s SHA, `apps/api/Dockerfile`, `--frozen-lockfile`, tag `next-<sha7>` (must read 404 first) |
| E2 | Apply 0018 then 0019 | production Neon only, through `db.mjs` from the exact-source worktree's `packages/db` (`precheck` → wait for a newer `reward-recovery` → `migrate` → `postcheck`, direct host, `lock_timeout` 3 s, liveness proof). It refuses unless epoch 2 is closed at 2026-10-10T00:00Z with one snapshot, epoch 3 is open to 2026-10-17T00:00Z, the public reads agree, and `raid_recaps` has no rows. 0018 is a `CREATE INDEX` on a tiny table; 0019 creates an empty table. No data change. The old image never reads either |
| E3 | Update the API machine `6839d31b317318` | only after E2 passes; `/health`, `/v1/communities/<mint>/epochs/3`, `/v1/wallets/<signed wallet>/record` answer 200 |
| E4 | Update the worker `817400c9901de8` | only after E3; the next `reward-recovery` completes; no failed jobs |
| E5 | Cisco pushes `main` | `! git push origin main`. Vercel deploys the web: payout status, wallet page, Blink, schedule notice. CI green |
| E6 | Smoke: epoch 2 page shows the settlement and "Scored." rows; epoch 2 shows the schedule panel; `/actions.json` and the Action `OPTIONS` answer; `/me` in Hyphae Lab shows the checklist | agent reads, Cisco taps `/me` |
| E7 | Cisco announces T for the epoch 3 scorer (X and Hyphae Lab), the approved text | Cisco posts; the agent never posts |
| E8 | Record the amendment, after E2's postcheck and E4: `amend-epoch.ts <mint> --epoch 3 --prompt reward-eval/3 --effective-at <T> --actor "Cisco (founder)" --reason "<approved>" --plan`, check the template hash `48dabec5…`, then without `--plan`, before T | from the exact-source worktree's `apps/api` |
| E9 | Nothing else | no proposal, no secret, no Telegram message by the agent, no payout |

**T:** a whole minute in UTC, at least 20 minutes after the announcement and after E6 passes. Until T, no raid is opened in epoch 3.

**Rollback:** before E8, API and worker back to `jev-e5f864b` (`sha256:b3f5617d…`); the migrations stay (the old image ignores them); the web rolls back by reverting the push. After E8 and before T: cannot unrecord; record the emergency way back only if the new scorer fails its first live reply.

## Record

(filled at execution: SHAs, image digest, migration times, machine updates, smoke results, T, the amendment's recorded time)
