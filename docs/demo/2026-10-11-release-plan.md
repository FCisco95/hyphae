---
date: 2026-10-08
summary: Authorized October 11 for E0–E6 only, with the approved private member checklist and reviewed claim recovery. Execution in progress. E7–E8 scorer amendment/announcement excluded.
---

# Release plan: `next` after the first payout (E0–E6 authorized October 11)

Written by Claude Fable 5.1 (architect). Format follows the [Jev live release plan](2026-10-07-jev-live-release-plan.md). Nothing here runs without Cisco's exact yes. Proposed sentence: **"yes, run the post-payout release"**.

## Timing: my recommendation

**After the hold ends (2026-10-11T00:00Z) and after C19 to C22 have run on the deployed source.** Then this release, then the video's final cut and the submission.

Why not before the freeze (2026-10-09T22:00Z): the branch changes the payout gate's read path and the worker's scoring engine, and every one of its five branches needed fixes after review tonight. A first mainnet payout is the one irreversible event of the week; it should run on code that has been live for two days, not on code deployed hours before. Why not between the close and C19: the hold window runs then, and the deploy restarts the worker that reads the hold.

What that costs: epoch 3 replies admitted between 2026-10-10T00:00Z and the amendment time T are scored by `reward-eval/2`, the ranking prompt that under-scored honest replies. Mitigation, Cisco's: **open no raid in epoch 3 until T.** Replies only arrive through raids, so nobody is scored by the old prompt in epoch 3.

## Blockers before the yes

| # | Blocker | State (2026-10-08 night) |
|---|---|---|
| 1 | Codex reviews of the five branches, findings fixed test-first, fix checks ACCEPT | scorer-v3, raid-stats, wallet-record, Blink: **ACCEPT** after fixes ([records](../reviews/)). payout-status: five findings fixed, fix-check ACCEPT at next 1249fed (next:docs/reviews/2026-10-09-payout-fix.md; current HANDOFF) |
| 2 | Schedule notice on the epoch page (ruling 3) | merged into `next` |
| 3 | `scripts/rollout/db.mjs` re-pinned to 0018+0019 with the post-payout epoch state, rehearsed on Postgres 17 and 18 | **done and reviewed, ACCEPT** (`docs/handoffs/2026-10-09-rollout.md`, `docs/reviews/2026-10-09-rollout.md`) |
| 4 | Full gate on merged next: tests/typecheck/lint/Drizzle/test:pg | DONE at 1249fed; exact CI success. Re-run once after integrating main-only docs and any later authorized change |
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
| E0 | Merge reviewed next with then-current main locally, preserve BOTH histories, full combined gate green, **no push yet** | Reviewed bases d3b8c6c main / 1249fed next diverge by 5 main-only docs and 62 next-only commits; no reset or fast-forward assumption |
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

- **Authorization:** Cisco replied exactly `yes, run the post-payout release (E0–E6)` on October 11. Execution began at 12:07:50Z. Privacy selection and accepted final member-visible copy: [approval sheet](2026-10-11-release-approval.md). Public eligibility/hints in the historical plan above are superseded by public aggregates and a member-only private checklist. Both privacy and claim-page reviews ACCEPT before execution.
- **Scope:** E0–E6 only. E7–E8, T, scorer amendment, announcement, new payouts and epoch 3 publication excluded. No raid opened here.
- **E0 complete:** merge `e7b6824428ab1c485683b72827132be7155c24d6`, parents `99cd33ef40376d486c92b28134c6d93ae54e318e` and `9d0da9b337d1b11770278603b595ebcbd60f12d7`; both histories are ancestors. Only conflicts: web view imports and lockfile. Combined lockfile retains main's pins and adds the exact reviewed Anthropic SDK 0.128.0 (33 additions, no removals).
- **Integration fixes:** `30833d5ef58ce8c83ba3fdb7507006499d1494f9` updates the old group /me expectation and verifies its private link; `42ce449efb386195ef0c2eca69ff843a4fa0531a` fixes the main-only public raid route's stale clock call by taking the integrated read clock inside its read-only snapshot. Existing tests failed first, then all 14 onboarding and five raid tests passed. No new funds/scoring/payout-gate change. Claim component/wallet/CSS match the accepted diff.
- **Combined gate on 42ce449:** frozen install, `pnpm test` 1,731 passed (three gated API tests skipped), `pnpm typecheck`, `pnpm lint`, Drizzle check and 16 Python H-CONTRACT hashes passed. Disposable Postgres 17: all 15 files / 84 tests passed. Two-worker environment bounds only concurrency. One unused web import warning removed afterwards and checked separately; no behavioral change.
- **Production baseline before E2:** both Fly machines on `jev-e5f864b`, `sha256:b3f5617d804a377e8eaae1c6c67641ffe85390e47d88c162f0723206994236c4`; web origin/main `d3b8c6c`. No production write or deploy before E2.
- **E1 complete, registry verified 12:28:47Z:** clean detached source `3a3e294f764545b9a66c795d1e2b4c4bfd037b68`; tag `next-3a3e294` read 404 before creation, then 200 with `sha256:0a00c38d24c19ba4195ba93205443c3bdadf986e8e1503a38f505fff723be841`. Frozen install and Fly build-only/push using apps/api/Dockerfile passed; no live machine update. Web production build on the same runtime source also passed. Actual API and worker PUBLIC_WEB_URL both confirmed `https://hyphae-delta.vercel.app`.
- **E2 complete:** exact-source db.mjs from packages/db, using the direct Neon host and lock_timeout 3 s. Precheck PASS at `2026-10-11T12:30:03.384Z`: database/public epoch 2 both published, journal 18, read_only on, stale pending 0. A newer completed recovery at `12:30:22.798Z` proved liveness. Pinned 0018 (`79592f957d9b43805e468c97ffce066a091a68cfaebda5944f9d234282812302`) then 0019 (`b81d60858828b95e89b7d2be8e0445e231eac6a3c7e43318b983affeeb56864b`) applied: journal 18 → 20. Postcheck PASS at `12:32:44.182Z`, problems [], liveness true, exact wallet index/table shape. Count deltas: tasks +1 during concurrent live activity; every other checked table 0, including raid_recaps. No refusal, lock retry or rollback. Raw operational reports retain private IDs locally and are not committed; this is the public execution record.
- **Raid activity:** read-only probe at 12:31Z found three already-open raids and zero failed jobs. Cisco subsequently said he had just opened a new raid and questioned closure. Closing it is not required for E0–E6; the historical no-raid mitigation is not in effect. No raid/scorer/epoch data changed by this release operator. Public epoch 3 at 12:38Z still selects reward-eval/2 with no amendments; E7–E8/T remain unapproved. The E2 tasks +1 delta coincides with Cisco's live raid activity.
- **E3 complete, verified 12:38:47Z:** API machine 6839d31b317318 started on the pinned next-3a3e294 digest. Health, epoch 3, signed C21 wallet record, epoch 2, public raids and OpenAPI all answered 200. Wallet epoch 2 shows 363,750,000 lamports allocated and paid in C21's mainnet signature. Public epoch/contribution reads and OpenAPI omit private rules-test/hold verdicts; the wallet record retains actual public allocation/payment receipts. Worker still on the rollback image until E4.
