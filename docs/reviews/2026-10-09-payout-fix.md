---
date: 2026-10-08
summary: Independent Codex fix check of 300eb97..b63fc1d; ACCEPT, all five medium findings resolved, 275 permitted tests passed and one gated devnet test skipped, including both real-Postgres concurrency cases.
---

# Payout status: independent fix check

## Scope

Reviewer: Codex, independent of the Claude builder. Worktree `C:/hy/payout`, branch `FCisco95/payout-fix`.

- Exact code diff: `300eb975f33f04cb4aa56bcadf108fcaeccc9777..b63fc1dbf64b7596b1736cd4898e1f70350da322`.
- Tested checkout: `9851f62eee390a8f3179db1821b7e6d29b0d7bfc`; the last commit adds the builder note, outside the code diff.
- Read both dispatch briefs, the original five-finding review at `C:/hy/next/docs/plans/review-payout-status.md`, `CLAUDE.md`, `docs/HANDOFF.md`, `docs/handoffs/2026-10-09-payout-fix.md`, and the Blink review format.
- This report uses the review machine's date. The builder note and briefs contain different payout dates; no live schedule or production state was verified or inferred from them.
- No tracked files modified, commits, pushes, production access, or Telegram requests. The only authored file is this ignored report.

## Verdict: ACCEPT

**Findings: 0 high, 0 medium, 0 low.** All five medium findings are resolved in the reviewed diff. No further code change is required by this fix check. Copy approval and release authorization remain with the founder/coordinator; acceptance is not deployment approval.

## Findings resolved and evidence

1. **Read clock and pre-close hold result — resolved.** `apps/api/src/http/routes.ts:98` passes a clock function, and each read calls it as the first statement in the callback passed to `readOnly`. The eight reads and clock-call lines in `apps/api/src/http/read-service.ts` are:

   | Read | Clock line |
   |---|---|
   | `readCommunity` | 477 |
   | `readEpoch` | 537 |
   | `readClaim` | 631 |
   | `readWalletClaims` | 655 |
   | `readWalletRecord` | 732 |
   | `readContributions` | 903 |
   | `readLeaderboard` | 932 |
   | `readContribution` | 1018 |

   `readOnly` remains repeatable-read/read-only (`apps/api/src/pg.ts:10`). The default `databaseNow(tx)` executes `clock_timestamp()` on that transaction; none of the eight public routes captures an outside `Date`. The new all-eight test inspects transaction isolation/read-only settings and checks returned `as_of` values. Source inspection establishes that no data selection precedes the clock; the test alone does not prove that ordering.

   `apps/api/src/payout/readiness.ts:22` independently removes `below_hold` and `hold_pending` before interpreting an open, hold-required member. With no other failures the result is exactly `held / hold_pending / at_close`; wallet, rules-test and points failures remain `not_payable`, with `at_close`. Holder and below records, with and without a frozen snapshot, pass the strict and loose schemas in the new tests. The read-service boundary regression deliberately supplies an earlier fixed clock after the hold record is committed, demonstrating that the defensive derivation survives that mismatch too.

   Compatibility detail: `ReadClock` still accepts fixed dates. The existing internal `/receipt` loader supplies one (`apps/api/src/member-journey/receipts.ts:86`), and the resulting contribution object contains a payout verdict. Its text formatter does not render that field; the new defensive derivation protects it. Thus the clock claim covers the eight public read routes, not every internal caller. Beyond the intended clock timing and hold correction, no changed public schema, cache policy, pagination, chain lookup, or public field was found.

2. **Wallet named by `/me` — resolved.** `apps/api/src/payout/readiness.ts:123` returns each verdict's wallet without changing `judgeMembers` or `walletAt(closesAt)`. `mePayout` (`apps/api/src/bot/commands/me-summary.ts:161`) reads the clock, epoch, member link and verdict in one snapshot. The checklist uses that verdict wallet, while a differing current link gets its own line at line 81. `/me` passes that complete result rather than merging an earlier member row (`apps/api/src/bot/commands/me.ts:31`).

   Passing tests cover A signed before close and B after close, the delayed close worker, the gate retaining A after materialization, `/me` moving to epoch 2 on B, no signed wallet at close, and an open epoch on the current link. The real-Postgres test commits B on another connection after the first read has established its snapshot; that read returns A for both wallet fields and the next read returns B for both. This is meaningful snapshot evidence rather than a mocked transaction assertion.

3. **Closed zero-points checklist — resolved.** `apps/api/src/bot/commands/me-summary.ts:108` adds the explicit closed verdict. Zero points produces `Not payable: no points.` with both positive and zero hold thresholds. The skipped-hold explanation at line 94 uses the actual reasons: missing wallet/test when present, otherwise no points. `judgeMembers` only produces `not_checked` after one of those prerequisite failures, so that fallback is supported by the producer. Tests cover zero points alone and combined missing wallet/test reasons; the zero-hold case retains its green prerequisite checks but now explicitly states that the member is not payable.

4. **Once-per-member/epoch hint — resolved.** `apps/api/src/jobs/payout-hint.ts:15` derives a stable key from the decision's immutable member and epoch IDs and acquires `pg_advisory_xact_lock(hashtext('score-hint:<member>:<epoch>'))`. `notifyReward` (`apps/api/src/jobs/reward-jobs.ts:265`) holds the same read-committed transaction across lock acquisition, its own receipt recheck, hint lookup, send and mark. Read committed matters: the waiting job reads the preceding committed `notified_at` after obtaining the lock. The hint read has its own savepoint at line 222, so a failed optional SQL statement cannot poison the transaction that later records delivery.

   The real-Postgres race test starts distinct decisions of the same member/epoch, blocks the send, and observes either two sends reaching the barrier or one send plus an advisory-lock waiter. It then releases the barrier and asserts two score messages with exactly one hint. This would expose the original unlocked interleaving; it passed on the reviewed code. Other passing tests cover redelivery after marking, failed-send retry, a corrected revision, and a database-level hint-read failure. Per-decision receipts remain intact and nothing is pre-marked.

   `hashtext` has a 32-bit collision space, not a uniqueness guarantee. A collision serializes unrelated owners; it cannot let identical owners bypass the lock or share receipt predicates. Given this effect and the scoped workload, the collision risk is acceptable for this release. The crash/commit boundary remains at least once: Telegram acceptance followed by process or transaction failure can repeat the score and hint.

5. **Bounded username lookup and fallback — resolved.** `apps/api/src/jobs/reward-jobs.ts:197` creates a 3,000 ms abort deadline and passes its signal to `bot.init` inside the sanitized failure path. A failed lookup returns no hint, then score delivery proceeds; only a successful send is marked. The installed grammY 1.46.0 implementation was inspected: its request client accepts an abort signal, retry backoff is abortable, successful initialization is cached, and failed initialization clears its pending promise. The TypeScript signal cast does not remove those runtime semantics.

   Passing tests cover getMe/init rejection with token-free logs, pending initialization until abort at 3,000 ms, successful caching, and a lookup that crosses close. The close recheck at line 233 occurs after lookup and removes the entire instruction/button when expired. These tests mock Telegram; no live Bot API behavior was claimed or exercised.

## Send timeout decision and remaining limits

**Recommendation: keep the existing send bound for this release.** `apps/api/src/bot/index.ts:32` supplies no client override, so the installed grammY default is 500 seconds per send. That is a long availability limit, not a short lock timeout. `reward-notify` expires after 30 seconds; inspection of the installed pg-boss worker shows expiration does not cancel this application transaction because the callback does not forward its signal. A retry waits, then rechecks the receipt, preserving the concurrency fix.

The operational cost is broader than one member: a stalled sender holds a pooled connection, and lock waiters hold additional connections in the runtime's ten-connection application pool. There is no new end-to-end lock-wait deadline. Multiple stalled sends/retries can therefore delay unrelated database work. This is an accepted availability limitation for the scoped release, not a claim of pool isolation. A shorter abort would reduce occupancy but would still leave the ambiguous Telegram-accepted boundary; introduce that policy with separate tests if tightening it later.

A successfully sent score-only fallback consumes the member/epoch hint opportunity: later decisions see its receipt and omit their hints. Keep the successful delivery marked; intentionally leaving it unmarked would create duplicate score deliveries. The earlier note's suggestion that a later unsent message might still recover the hint is not true after that receipt commits. The separate `/me` summary/checklist clock boundary and process-clock use for hints remain as documented pre-existing limits.

## Checks run

All tests used `--maxWorkers=1` and only the explicitly permitted selection.

| Check | Result |
|---|---|
| API: `pnpm --filter @hyphae/api exec vitest run src/payout src/bot/commands/me.test.ts src/bot/commands/me-summary.test.ts src/jobs src/http/read-service.test.ts src/http/routes.test.ts --maxWorkers=1` | Exit 0; **244 passed, 1 skipped**, 20 passed files plus the gated devnet file; 126.00 s. |
| Gate safety subset within that API run | **79 passed**: gate 27, hold-gate 22, publication 13, publish 17. These four test files are unchanged in the diff. |
| Core: `pnpm --filter @hyphae/core exec vitest run src/read-api-schema.test.ts --maxWorkers=1` | Exit 0; **29 passed / 1 file**. |
| Real Postgres: `pnpm --filter @hyphae/api exec vitest run --config vitest.pg.config.ts src/bot/commands/me-summary.pg.test.ts src/jobs/reward-notify.pg.test.ts --maxWorkers=1` | Exit 0; **2 passed / 2 files**, using only this review's disposable Postgres 17 server on `127.0.0.1:55749`. |
| Total | **275 passed, 1 gated skip; 23 passed files, 1 skipped file.** Gate subset is not counted twice. |
| Scope/whitespace | `git diff --check 300eb97..b63fc1d` clean. No diff for gate implementation, four gate tests, core read schema or any web path; no database/migration path in the full changed-file list. |

`payTerms`, `judgeMembers`, eligibility/allocation rules, the strict schema and all web files are unchanged by path. This review did not run the full suite, whole `test:pg`, lint, typecheck, additional mutation probes, or production checks. The builder's mutation claims were read, not independently repeated. The sandbox could not start PowerShell; authorized local commands ran outside it. Public/read-only database tests remained local.

## Member-visible strings for founder approval

`apps/api/src/bot/commands/me-summary.ts` introduces or newly renders these lines in the bot:

- `Current link: {AbCd…WxYz}, signed`
- `Current link: {AbCd…WxYz}, pasted`
- `➖ Hold: not checked, since there were no points`
- `Not payable: no points.`
- `Not payable: no wallet was signed by the close.`
- `Not payable: the rules test was not passed by the close.`
- Combinations of the preceding reasons, in wallet/test/points order, separated by `; ` and ending in `.`; for example, `Not payable: no wallet was signed by the close; the rules test was not passed by the close; no points.`
- `Not payable: the wallet held less than the minimum after the close.`

No reviewed line gives an incorrect verdict or asserts payment. `Current link` distinguishes a later link from the named epoch's wallet. The existing abbreviated wallet format remains; the score message adds no new wording.

## Review handoff

The coordinator can record ACCEPT for this exact range and handle copy approval plus the separate merge/release process. The long send bound and omitted hint after fallback should stay in the release notes. The coordinator owns any tracked build-log/canonical-handoff refresh: this worker's explicit ownership is this ignored report only, so no tracked handoff or snapshot was changed.

### Suggested skills

`handoff-memory` to reconcile the review with current coordinator state; `handoff` to preserve the coordinator's durable release checkpoint. Invoke any further implementation/review workflow only for newly authorized changes.

### Generated artifacts this session

| What | Where | State |
|---|---|---|
| Fix-review report | `docs/plans/review-payout-fix.md` | Local, gitignored; sole authored file. |
| Disposable Postgres test container | `hyphae-payout-review-371b-pg17`, loopback port 55749 | Created for this dispatch, then removed with its test volume; absence verified. No other container touched. |

### Next-session prompt

```text
The independent fix check ACCEPTS code range 300eb97..b63fc1d on FCisco95/payout-fix. The permitted tests passed 275 cases with one gated devnet skip, including the two real-Postgres concurrency tests; no tracked files were modified or pushed.
Files: docs/plans/review-payout-fix.md, docs/handoffs/2026-10-09-payout-fix.md, docs/HANDOFF.md
Model: use the coordinator's existing model; no model switch is needed to record this review.
Skills: handoff-memory, handoff.
Verify the refs have not advanced, preserve the documented send-timeout and score-only-hint limits, and continue the already authorized coordinator release plan subject to its copy approvals and holds.
```
