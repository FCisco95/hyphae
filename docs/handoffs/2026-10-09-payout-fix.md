---
date: 2026-10-09
summary: The five medium findings of the independent payout-status review are fixed test-first on FCisco95/payout-fix. Reads judge the hold only after the close and take their clock inside their snapshot; /me names the wallet its verdict used and says why a closed epoch does not pay; the once-per-epoch score hint is serialized per member and epoch with an advisory lock; the bot username lookup is bounded and never blocks a score. Local branch only; nothing pushed or deployed. An independent Codex fix review comes next.
---

# Payout status fixes (worker note, 2026-10-09)

Branch `FCisco95/payout-fix` from `origin/next` (`300eb97`). Built by Claude Opus 5.5 (`claude-opus-5-5`) as an Orca worker. Not pushed, not merged, not deployed.

Commits, oldest first:

| Commit | What |
|---|---|
| `716de93` | fix(payout): no hold outcome in a read judged before the close (finding 1, part A) |
| `b866ee4` | fix(bot): /me names the wallet its verdict used, and why a closed epoch does not pay (findings 2 and 3) |
| `985de70` | test(bot): run the /me relink pg test in a database of its own |
| `014e92a` | fix(jobs): one payout hint per member and epoch; the username lookup never blocks a score (findings 4 and 5) |
| `cb83142` | fix(payout): read the API's clock inside each read's snapshot (finding 1, part B) |
| `b63fc1d` | fix(jobs): type the username deadline's signal as grammY declares it |

The review being answered: `docs/plans/review-payout-status.md` (gitignored, in the `C:/hy/next` worktree). Unchanged, as the brief requires: `payTerms`, `judgeMembers`, the gate's verdict rules, the strict schema, every web file.

## What changed, finding by finding

### 1. An open-time read kept a later hold verdict

- `payoutOf` (`apps/api/src/payout/readiness.ts`): before the close it now drops every hold outcome. A member who meets wallet, rules test and points is `held / hold_pending / at_close`; wallet, rules-test and points failures stay as judged. This alone makes every produced object pass both schemas, whatever clock a caller uses.
- The read clock now runs inside each read's transaction. The coordinator approved editing `read-service.ts` and `routes.ts` for this (they were outside the first ownership list). Every read function takes a `ReadClock` (a `Date`, or a function of the transaction) and reads it as the first statement inside `readOnly()`: `readCommunity`, `readEpoch`, `readClaim`, `readWalletClaims`, `readWalletRecord`, `readContributions`, `readLeaderboard`, `readContribution`. The routes pass the database clock (`clock_timestamp()`), not a `Date`. Callers that pass a `Date` (tests, member receipts) are unchanged.
- Why this ordering holds: a repeatable-read snapshot is taken at the transaction's first statement, and `clock_timestamp()` is evaluated during it, so `as_of` is never earlier than the snapshot. A read that says `closed: false` therefore cannot see a hold check committed after the close.

### 2. /me named the wrong wallet for a closed epoch

- `epochPayouts` also returns `wallets`: the signed wallet each verdict used (`walletAt(closes_at)`, the current link while open).
- `mePayout` reads the clock, epoch, member row, verdict and that wallet in one read-only snapshot, with the clock first. It returns `wallet` (the verdict's) and `member` (the current link). `/me` uses both from that read; it no longer pairs them with the member row it looked up separately.
- The checklist names the verdict's wallet. If the current link differs, it gets its own line: `Current link: BBBB…BBBB, signed`.
- After the close worker runs, `/me` moves on to the next epoch and names the current link there; the gate still pays the closed epoch to the wallet at its close (tested).

### 3. The closed checklist hid `no_points`

- After the close, a not-payable member gets one verdict line in the site's existing words, for example `Not payable: no points.` or `Not payable: no wallet was signed by the close; no points.`; `below_hold` gets `Not payable: the wallet held less than the minimum after the close.`
- The skipped-hold line is derived from the reasons: the existing "since the wallet or rules test was missing" when one of those is missing, otherwise "since there were no points". A zero-points member never sees an all-green list, with a positive or a zero hold.

### 4. Two notify jobs could both append the once-per-epoch hint

- `notifyReward` (`apps/api/src/jobs/reward-jobs.ts`) sends a decision's message in one read-committed transaction: `lockScoreMessages` (`apps/api/src/jobs/payout-hint.ts`) takes `pg_advisory_xact_lock(hashtext('score-hint:<member>:<epoch>'))`, then the job rechecks its own `notified_at`, reads the hint, sends and marks. The next job for that member and epoch waits on the lock, then sees the mark and omits the hint. The key follows the repo's existing raid-alert lock idiom. No migration.
- `notified_at` stays the per-decision delivery receipt; nothing is pre-marked. A job without a decision (pending notices) takes no lock.
- The hint read runs in a savepoint. Without it, a failed status query aborts the transaction, so a message already accepted by Telegram could not be marked and would be sent again. A mutation probe proved this.
- `scoreHint` now returns `{ payout, closesAt }`. The close time is used by finding 5.

**The send's bound.** `bot/index.ts` creates the bot without client options, so grammY 1.46's default applies: **500 s per Bot API call** (read from the installed `out/core/client.js`). The brief called the send "already bounded"; it is, but only at 500 s. While a send stalls, the lock and one pooled connection stay held for that member and epoch only. The notify job expires after 30 s; a retry of the same job waits on the lock, then sees the mark and returns. I kept the brief's decision and did not change the bound (see open question 2).

**Crash window (unchanged, at least once).**
- If Telegram accepts the message and the process dies, or the commit fails, before the mark commits, the transaction rolls back. The lock is released with the connection, and a retry or the recovery sweep sends that message again, hint included.
- In that same window, another decision's job can take the lock, find no mark, and append the hint to its own message. A member can then see the hint on two messages, but only after such a crash, never from two jobs running at once.

### 5. `bot.init()` could block score delivery

- The username is looked up only when a hint has a button. `bot.init(signal)` gets a 3 s abort deadline. A failure is logged through `telegramCall`'s token-free error message, and the score goes out alone (score-only fallback). grammY keeps the username after the first success (`bot.isInited()`), so later messages make no lookup.
- After the lookup, the hint is dropped if the epoch's `closesAt` has passed, so no expired "before the epoch closes" instruction goes out.
- Consequence: a message sent while the lookup fails carries no hint and is still marked, so that member gets no hint in that epoch unless a later first message is still unsent.

## Tests

All new or changed tests, by file. "Red first": failed on the unchanged code for the expected reason.

| File | Test | Red first |
|---|---|---|
| `payout/readiness.test.ts` | payoutOf: before the close, ignores a hold result already recorded by the time of the read (strict + loose schema) | yes |
| | epochPayouts: read as open after the hold check committed (holder and below records, with and without the snapshot; both schemas) | yes |
| `http/read-service.test.ts` | a clock taken before the close, read after the hold check: the hold still waits for the close (strict + loose) | yes, ZodError |
| | a read's clock: read inside the read's own repeatable-read, read-only snapshot, and the read is as of it (all 8 reads) | yes |
| `bot/commands/me-summary.test.ts` | after the close, a member with no points is told so (positive hold, zero hold, with missing wallet and/or test) | yes |
| | after the close, names the wallet signed at the close, and a later link apart from it | yes |
| | the existing closed-checklist test now expects the verdict line | yes |
| | mePayout: after the close names A, not B linked since; the gate pays A; after materialization /me shows epoch 2 on B | yes |
| | mePayout: no wallet signed by the close, the current link apart | yes |
| | mePayout: while open, the verdict's wallet is the current signed link | yes |
| | mePayout: the existing test now expects `wallet` and `member` | yes |
| `bot/commands/me.test.ts` | names the wallets read with the status, never a member row read apart from it | yes |
| `bot/commands/me-summary.pg.test.ts` (real Postgres) | a relink committed on another connection after the read's clock: the read names A on both sides; the next read names B | yes (fields missing); a probe that removed the transaction returned B, so the test catches that |
| `jobs/payout-hint.test.ts` | scoreHint names the epoch's close; lockScoreMessages takes the lock and refuses an unknown decision; existing tests now read `.payout` | yes (the 3 existing tests that expect a status failed on the new shape) |
| `jobs/reward-notify.test.ts` | getMe rejects: score alone, marked, no token in the log | yes |
| | init pending until aborted: nothing at 2,999 ms, score alone at 3,000 ms, marked | yes |
| | the lookup ends after the close: score alone, no instruction | passed vacuously on the old code (the mock shape changed); a probe that removed the recheck turns it red |
| | the username is asked once per process | yes |
| `jobs/reward-notify-hint.test.ts` (PGlite) | redelivery after the mark sends nothing; a failed send marks nothing and spends no hint; a corrected revision after the member was told carries no hint; a status read failing in the database still sends and marks | no: these guard the new transaction (the old code passed them). A probe without the savepoint fails the last one |
| `jobs/reward-notify.pg.test.ts` (real Postgres) | two decision jobs of one member, both held after their reads, then released: exactly one hint | yes: 2 hints on the old code. A probe without the lock gives 2 hints again |

Mutation probes were run on copies and restored from them; the tree is clean.

## Checks run

- `pnpm --filter @hyphae/api exec vitest run src/payout src/bot/commands/me.test.ts src/bot/commands/me-summary.test.ts src/jobs src/http/read-service.test.ts --maxWorkers=2`: **230 passed, 1 skipped** (`publish.devnet.test.ts`, gated), 19 files.
- `pnpm --filter @hyphae/api exec vitest run src/http src/member-journey/receipts.test.ts --maxWorkers=2`: 103 passed (routes and receipts still pass with the clock change).
- `pnpm --filter @hyphae/core exec vitest run src/read-api-schema.test.ts`: **29 passed**.
- `pnpm typecheck`: exit 0. `pnpm lint`: exit 0 (451 files).
- Real Postgres 17 on my own container (`hyphae-payout-fix-pg`, port 55497): `me-summary.pg.test.ts` 1 passed, `reward-notify.pg.test.ts` 1 passed; `concurrency.pg.test.ts` (9 passed) ran beside them to show no seed collision. Both new pg files create their own database, because `seedRewardLane` names communities `Mint1…` in every file and the shared `test:pg` database would collide.
- Not run, per the brief: the full suite and the whole `test:pg`. CI has not run on this branch.

## New member-visible strings (for Cisco's approval)

/me:

- `Current link: {AbCd…WxYz}, signed` · `Current link: {AbCd…WxYz}, pasted`, on its own line under the wallet check when the current link is not the wallet the verdict used.
- `➖ Hold: not checked, since there were no points`
- After the close, for a not-payable member: `Not payable: {why}.` with the site's existing whys, `no wallet was signed by the close`, `the rules test was not passed by the close`, `no points`, joined by `; `. Also `Not payable: the wallet held less than the minimum after the close.` These sentences are new in the bot; the site already uses them.

Score message: no new string. The hint is now left out when the bot's username cannot be read within 3 s, or when the epoch closed during that lookup.

## Open questions

1. **The strings above.** Approve, or reword.
2. **Cap the send under the lock?** Today a stalled Telegram call can hold one member's lock and one pooled connection for up to 500 s. Recommendation: keep it for this release. A cap below the job's 30 s expiry (for example a 20 s abort signal on `sendMessage`) shortens the hold, but an abort after Telegram accepted causes a duplicate score message. Revisit only if the worker shows held connections.
3. **Hint lost when the username lookup fails.** The message is still marked, so that member gets no hint for the epoch. Accept (the score matters more), or leave such messages unmarked for the hint? Recommendation: accept; getMe failing usually means sendMessage fails too, and then nothing is marked.

## Known limits

- `/me`'s epoch and points lines (`meSummary`) are still read apart from the checklist. In the second around a close they can say "open until" while the checklist says "(closed)". This was outside the finding.
- The hint's `now` is the worker's process clock (`new Date()`), as before; the close uses database time.
- The real-Postgres cases ran on one machine under light load; they wait on observed state (a send held, or a session waiting on an advisory lock), not on sleeps.

## Next

An independent Codex fix review of `300eb97..b63fc1d`, then the release plan's merge into `next`. No push from this worker.
