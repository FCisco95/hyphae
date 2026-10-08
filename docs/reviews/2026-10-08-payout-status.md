---
date: 2026-10-08
summary: Independent Codex review of payout-status and its merge into next; CHANGES REQUESTED, 0 high and 5 medium findings, with 160 permitted tests passing and local probes reproducing status, checklist and notification defects.
---

# Payout status: independent Codex review

Reviewer: Codex (GPT-6 family), independent of the builder. Review only; no tracked files changed, no commit, push, live service access or deployment.

## Scope

- Branch diff: `2380d590c624033089a324706c2ac92656d16484..621c8873ef8ef56db3508c6180a24e37192cc822` (`origin/FCisco95/payout-status`). Implementation commits: `d008411`, `21fcb85`, `dcf46ab`, `8f82146`; author note: `621c887`.
- Integrated source and tests: `next` at `300eb975f33f04cb4aa56bcadf108fcaeccc9777`. Both refs remained unchanged during inspection.
- Checked payout merge `2198ba7`, then wallet-record `2556b96`, raid-stats `1916c41`, Blink `3021959` and scorer-v3 `7c6979f` against every payout-status branch file.
- Read `C:/hy/briefs/review-common.md`, `C:/hy/briefs/review-payout-status.md`, `CLAUDE.md`, `docs/HANDOFF.md`, `docs/handoffs/2026-10-08-payout-status.md` and the required review example. The briefs govern this review; the older handoff's deployment dates are not new authorization.

## Verdict: CHANGES REQUESTED

**Findings: 0 high, 5 medium, 0 low.** No changed allocation or eligibility rule was found in the gate extraction. Fix the inconsistent member output and notification behavior before releasing this feature.

1. **Medium — An open-time read can retain a later hold verdict and fail its own schema.** `apps/api/src/payout/readiness.ts:21`, `apps/api/src/payout/readiness.ts:30`, with `apps/api/src/http/read-service.ts:403`.

   `payoutOf` replaces the hold label with `at_close` when `closed` is false, but preserves the verdict and reasons that `judgeMembers` calculated from recorded hold results. The HTTP route obtains database time before starting the read transaction. A request can obtain that time just before the deadline, wait for a connection or scheduling, and begin its database snapshot after close and the hold check commit. Its old `now` still makes `closed=false`, while the database contains a valid holder or below result. The producer returns `{status:"payable", reasons:[], hold:"at_close"}` or `{status:"not_payable", reasons:["below_hold"], hold:"at_close"}`. Both the strict API schema and the consumer schema reject these objects; the second also reveals a hold outcome in a read marked before close.

   A local pure-function probe reproduced both rejected objects using the unchanged producer and schemas. The matching `held / hold_pending / at_close` control passed both schemas. This proves the producer gap; the scheduling interleaving was traced from source, not load-tested.

   **Recommended fix:** capture the read's time consistently with its database snapshot, and make the before-close derivation explicitly ignore hold outcomes. A hold-required member meeting the other conditions must remain `held / hold_pending / at_close` until that read is closed. Preserve the member's wallet, rules-test and points failures independently.

   **Tests needed:** readiness with both holder and below records while `closed=false`; assert that every produced object passes strict and loose schemas. Add a route/read-service boundary case where the initial clock read precedes close and the transaction sees the completed hold check.

2. **Medium — `/me` labels the current wallet as the wallet eligible for a closed epoch.** `apps/api/src/bot/commands/me-summary.ts:57`, with `apps/api/src/bot/commands/me.ts:31`.

   The payout verdict uses `walletAt(closesAt)`, but the checklist interpolates `members.wallet`, fetched separately by `/me`. A member signed wallet A before the deadline and relinks to B just after it, while the close worker has not yet materialized the next epoch. `/me` still reports the elapsed epoch, marks B as its signed payout wallet, and attaches readiness calculated for A. The historical wallet is discarded before the checklist can use it.

   A disposable PGlite probe used a supported zero-hold rubric, a passed rules test and a scored contribution. After the relink and before delayed close, the actual `mePayout` plus checklist printed `Wallet: BBBB…BBBB, signed` under `To be paid for epoch 1 (closed)`. Closing the epoch and evaluating the unchanged gate returned `ready` with `wallet: "AAAAHistoricalWalletAAAA"`. No funds are redirected; the member is shown the wrong destination.

   **Recommended fix:** return the wallet used by the member verdict alongside the checklist status, and use that wallet for the named epoch. If the current link is also shown, label it separately. Read the member display and readiness coherently so an in-flight relink cannot combine different states.

   **Tests needed:** signed A at close, signed B after close, delayed close/materialization, and `/me` must identify A. Cover a concurrent relink during an open-epoch `/me` read and the no-wallet-at-close case.

3. **Medium — The closed `/me` checklist hides a zero-points exclusion.** `apps/api/src/bot/commands/me-summary.ts:72`, `apps/api/src/bot/commands/me-summary.ts:75`.

   For a signed member who passed the rules test but has zero credited points, the gate returns `not_payable` with `no_points`. After the deadline, `/me` drops the `next` lines, which are the only place this checklist acknowledges that reason. With the usual hold requirement, it says the hold was skipped because the wallet or test was missing, directly contradicting both green checks. With a supported zero-hold rubric, the entire checklist is green under `To be paid for epoch N (closed)`, even though this member cannot be paid. The separate numeric points summary does not correct the false explanation or explain its payout consequence.

   Local formatter probes reproduced both outputs. The existing closed-checklist test covers a missing wallet, but not `no_points` alone.

   **Recommended fix:** render the closed member verdict explicitly, including `Not payable: no points`, and derive the skipped-hold explanation from the actual reasons. A zero-points member must not receive an all-green payout checklist.

   **Tests needed:** closed epoch, signed wallet and passed rules test, zero points, with both positive and zero hold thresholds. Also cover zero points combined with missing wallet/test so every explanation remains true.

4. **Medium — Two notification jobs can both append the supposedly once-per-epoch hint.** `apps/api/src/jobs/payout-hint.ts:37`, with `apps/api/src/jobs/reward-jobs.ts:228` and `apps/api/src/jobs/reward-jobs.ts:238`.

   For two unsent decisions belonging to the same member and epoch, each job can observe that no other decision has `notified_at`, calculate a hint, send its own score with that hint, and only then mark its own decision. There is no atomic ownership or serialization across this read/send/mark interval. A PGlite probe with two real decisions returned the missing-wallet/test hint for both concurrent reads; the existing `payout-hint.test.ts` also explicitly accepts a hint on both decisions before marking the first. `batchSize: 1` serializes a single worker process, not two processes during overlap or multiple consumers. The occurrence rate depends on worker topology, which this review did not inspect in production.

   This finding concerns duplicate hints on distinct score messages. The pre-existing, documented Telegram-accepted/process-crashed-before-mark duplicate delivery boundary remains a separate at-least-once limitation. Sequential redelivery after a successful mark is correctly suppressed.

   **Recommended fix:** atomically select or serialize one hint-bearing decision per member and epoch before sending, then recheck ownership while coordinating competing jobs. Keep per-decision notification receipts for score delivery; do not pre-mark a score as delivered to solve hint deduplication. State the remaining Telegram crash-window semantics honestly.

   **Tests needed:** two different decision jobs paused after their initial reads and then released together; only one message may carry the hint. Cover redelivery after marking, send failure followed by retry, and a new revision after an earlier notification. Exercise the selected database synchronization on real Postgres in the later owning validation session; this review did not run `test:pg`.

5. **Medium — Optional button initialization can prevent the score from being sent.** `apps/api/src/jobs/reward-jobs.ts:196`, `apps/api/src/jobs/reward-jobs.ts:212`.

   The fallback catches only `scoreHint`. On the first hint after worker startup, `botUsername()` calls `bot.init()` outside that catch and without an abort deadline. A username/getMe failure therefore prevents `sendMessage` entirely, even when the score itself could be sent. In the installed grammY implementation, `init()` calls `withRetries(getMe)` and retries network, 5xx and 429 failures; with no signal, hint preparation can remain pending beyond the notification queue's 30-second job expiry. The optional enhancement becomes a blocking dependency for score delivery and can retain an already-open-time hint while the epoch closes.

   An in-memory import of the unchanged notification module with mocked dependencies reproduced a getMe failure yielding **0 sends, 0 marks**. The control with only the status read failing yielded **1 score send, 1 mark**, as intended. No Telegram request was made. The initial probe harness lacked one import stub; after adding that stub in memory, the probe completed with the results above.

   **Recommended fix:** give optional username lookup a bounded deadline and catch failure across the complete hint/button preparation path, using sanitized logging and a score-only fallback. Cache a successful username. Recheck time-sensitive hint eligibility after any asynchronous preparation delay.

   **Tests needed:** an uninitialized bot whose getMe rejects, one whose initialization stays pending until aborted, and a slow lookup crossing the epoch deadline. Verify that score delivery still proceeds, the mark follows only a successful send, and no expired pre-close instruction is appended. Current notify tests always mock `isInited()` as true.

## Checks and evidence

All test commands used `--maxWorkers=1`. Only the brief's permitted test files were run.

| Check | Result |
|---|---|
| API: `src/payout/readiness.test.ts`, `src/payout/gate.test.ts`, `src/payout/hold-gate.test.ts`, `src/payout/publication.test.ts`, `src/payout/publish.test.ts`, `src/bot/commands/me-summary.test.ts`, `src/bot/commands/me.test.ts`, `src/jobs/payout-hint.test.ts`, `src/jobs/reward-message.test.ts`, `src/jobs/reward-notify.test.ts` | `pnpm --filter @hyphae/api exec vitest run <the 10 files> --maxWorkers=1`: exit 0, **124 tests / 10 files**. |
| Existing gate safety coverage | Gate **27**, hold-gate **22**, publication **13**, publish **17**: **79 passing tests**. These four files have no diff from `2380d59` to the branch or integrated HEAD. Their real gate/publication calls exercise the extracted functions. |
| Core: `src/read-api-schema.test.ts` | `pnpm --filter @hyphae/core exec vitest run src/read-api-schema.test.ts --maxWorkers=1`: exit 0, **29 tests / 1 file**. |
| Web: `lib/format.test.ts` | `pnpm --filter @hyphae/web exec vitest run lib/format.test.ts --maxWorkers=1`: exit 0, **7 tests / 1 file**. |
| Total | **160 tests / 12 files**, all passing. |
| Additional diagnostics | Network-free, in-memory formatter/schema and mocked-notifier probes; disposable PGlite historical-wallet and hint-race probes, with no probe/test files added. Results are recorded with the findings. |
| Merge and working tree | Local git comparisons completed; reviewed refs unchanged, tracked diff empty. |

The sandbox shell initially could not start (`CreateProcessAsUserW`, access denied); authorized unsandboxed local command execution succeeded. No full suite, typecheck, lint, Docker or `test:pg` was run. `read-service.test.ts`, `openapi.test.ts` and `views.test.tsx` were inspected but not executed, because the specific brief did not include them in its runnable list. No production database, API, RPC, Fly, Telegram or remote Git operation was used. These are local test and source-review results, not a production payout rehearsal.

## Checked and found sound

- **Gate extraction:** `payTerms` computes the same hold threshold, publication/first-paid checks and rules-test lookup. The pure lookup now happens earlier; it adds no query, write or lock. `judgeMembers` retains pass cutoff, wallet history at close, input ordering, reason ordering, positive-points rule, unsigned-wallet rejection and exact wallet/mint/threshold/window checks for hold evidence. Missing, pending, uncertain and wrong-wallet evidence remain held; a zero-hold rubric bypasses only the balance condition. Snapshot consistency, duplicate-wallet and other epoch-wide blockers still run in the original gate order. No payout transaction or publication lock boundary was changed.
- **Read consistency and cost:** HTTP reads remain inside a repeatable-read, read-only transaction; the extra live selection and paginated selection share its database snapshot. The new functions add no row locks or writes. Readiness uses frozen member totals after snapshot and live effective totals beforehand. It does not independently revalidate every epoch-wide publication blocker, so the member status is not authorization to publish. Finding 1 concerns the separately captured clock, not drift between two SQL selections in the same transaction. The added per-member wallet queries are bounded by the 100-row page size; there is also an epoch-wide hold lookup and extra live selection. No production latency benchmark was performed.
- **Schema and compatibility:** required output versus optional consumer `payout`, reason ordering, verdict/reason consistency and pre-close hold/publication restrictions are covered by the passing core tests. They correctly reject the producer outputs in finding 1. A zero-hold open member may legitimately have `payable / not_required`; web wording still describes completed prerequisites rather than payment.
- **Privacy and cache:** beyond the newly public rules-test status, the field exposes whether the signed wallet's post-close balance was confirmed above/below the configured minimum or remains pending/not checked. That reveals a balance bracket, not its exact amount. No raw balance, provider/slot, proof, test answers, pass timestamp, Telegram identifier or new X identifier is added by this field. Group `/me` output and score hints associate the checklist with the speaking member. The author's public-copy/privacy decisions remain founder decisions, and should account for the hold-result disclosure too. Public cache headers still apply: 15 seconds normally and 300 seconds for final contribution/leaderboard reads. Final status may therefore lag a hold/publication update by up to five minutes; it is an as-of public read, not private or immutable data.
- **Bot paths:** the amount uses the existing read-RPC helper, whose two-second bound and exception handling return `undefined` on failure; the checklist then uses the generic minimum wording, not an invented amount. Deep links use the existing `link_<community>` and `rules_<community>` payload builders and corresponding private-chat handlers. Closed/late/unpaid decisions omit score hints. Once an earlier decision is notified, a subsequent revision sees that prior notified row and omits the hint; already marked redelivery returns before sending. Status-query failure alone falls back to the score, as the fault probe confirmed.
- **Web payment wording:** reviewed every added sentence and its callers. None asserts that funds moved; published status points to settlement. The existing rendered-view `NEVER` assertion remains and the added open-epoch view test applies it to the new sentences. The executed format tests cover each formatter branch, but those assertions are not a substitute for the unexecuted rendering suite.
- **Merge preservation:** payout merge `2198ba7` differs from its payout-status parent only in `docs/BUILDLOG.md`, `docs/HANDOFF.md` and the coordinator wave note. Later changes to payout-status files add wallet-record schemas/read methods/navigation and scorer-v3 evaluator dependencies. The extracted gate, readiness, checklist and hint paths are preserved. No conflict resolution changing payout-status behavior was found; the five findings exist on the feature branch as well as integrated HEAD.

## Next action and review handoff

The owning builder should fix the five findings with regressions, then request an independent fix review before release. This report grants no merge, push, deployment or production-data approval. The coordinator owns any tracked build-log/handoff refresh; this worker was explicitly authorized to write only this ignored report.

Suggested skills: `superpowers:systematic-debugging` for the time and notification races, `superpowers:test-driven-development` for the fixes, then `compound-engineering:ce-code-review` for the independent fix review. Preserve the caller's test and file-ownership limits.

Generated artifacts this session: `docs/plans/review-payout-status.md` only, local and gitignored by explicit task instruction. No credentials, resources, schedules or deployed artifacts were created.

Next-session prompt:

```text
Fix the five medium findings in docs/plans/review-payout-status.md against next at 300eb975f33f04cb4aa56bcadf108fcaeccc9777, first checking whether the coordinator has advanced the branch. The extraction's 79 existing gate tests passed; the full permitted review set passed 160 tests in 12 files.
Files: docs/plans/review-payout-status.md, apps/api/src/payout/readiness.ts, apps/api/src/bot/commands/me-summary.ts, apps/api/src/bot/commands/me.ts, apps/api/src/jobs/payout-hint.ts, apps/api/src/jobs/reward-jobs.ts.
Skills: superpowers:systematic-debugging, superpowers:test-driven-development, compound-engineering:ce-code-review.
Follow the coordinator's ownership and release constraints, add the missing boundary/concurrency regressions, and return for an independent review of the fixes. Do not infer production authorization from this report.
```
