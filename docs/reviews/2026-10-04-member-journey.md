# Member journey — fresh other-family review

Last Updated: 2026-10-04T22:13:23Z

## Verdict and evidence stage

**NEEDS-FIXES. Paused at the user's request before any review repair.** Reviewed range: `e1f2c51cc4d3060aaa695a79b001503cb04e05f1..96b36296902775b6618c584b37fdaf973f3eb291`. All three blocking findings and all advisories below remain open; none are silently accepted or fixed.

Reviewer: actual `claude-opus-5-5`, fresh CLI session `37d5a3e6-3436-48f7-9cf9-f6f38690b895`; high effort requested. Tools, hooks, MCP and skills disabled; static supplied diff and unchanged reward/read-service context only. No independent execution or production inspection. Generated0014 snapshot was tracked but omitted from the packet for size; Drizzle check and no-change generation passed.

Owner evidence at this commit: **974 unit/integration tests passed, 1 optional skip; 59/59 disposable PostgreSQL tests; typecheck, lint338files, API build, Drizzle check/generate and diff-check passed.** The exact committed PostgreSQL run completed successfully after review submission (59/59,9files,50.31s); the review's pending-run remark is now historical. Passing tests do not resolve the missing regressions or review blockers.

## Resume repair order

1. **B1 — Unicode-safe operator text:** reproduce an issue reason ending across an emoji boundary; fix `safeLine` without breaking the4096-character message bound. Telegram rejection is a reviewer inference, not observed live behavior.
2. **B2 — frozen capture boundary:** keep relation/ownership flags in the new receipt fields, remove the newly appended values from existing `capture.limitations`, and test the private reward path through fixture evaluation, effort nomination and existing public audit parsing. No frozen worker, rubric or reward policy change. The review identifies an unproved downstream compatibility assumption, not an observed payout failure.
3. **B3 — network under community lock:** move the post-fetch Telegram membership lookup immediately before acquiring the community lock; preserve caller/member/community/task/window checks at acceptance, with cheap duplicate/kind checks before network and authoritative checks under the lock. Prove a slow lookup does not hold the reward/close lock, and a task closed during the lookup is refused.
4. **Queue advisory4 deserves explicit investigation before release:** two pending-receipt retries may enqueue concurrently; a successful send followed by failed queue-status persistence is ambiguous. Inspect the installed pg-boss policy rather than assuming `singletonKey` alone proves dedupe. Add a real concurrency/lost-ack regression before selecting a repair. No repair or new queue/migration design was implemented at pause.
5. Triage every other advisory below, preserving the one-active-brief rule and existing eligibility/attestation gates. Add actual-bot reward-lane coverage. Recheck full local gate and PG for affected data paths, commit fixes, then obtain a fresh other-family closing verdict over the whole arc. Keep publication held.

The public-group scoring disclosure is currently in the **pre-submission prompt**, before the member submits; it is not in `receiptText`. The review packet's shorthand called it a private receipt disclosure. This is a wording discrepancy to resolve explicitly, not missing pre-submission disclosure.

## Reviewer response, verbatim

# Verdict: **NEEDS-FIXES**

I reviewed only the supplied diff and context. I ran nothing. The line numbers below are counted from the diff hunks, so treat them as approximate.

## Blockers

**B1. A member's issue text can break `/ops`.** In `apps/api/src/member-journey/operator.ts:258-259`, `safeLine` truncates with `.slice(0, length)`, and line ~293 applies it to issue reasons. The receipt code guards against this case: `clip` in `member-journey/receipts.ts` has a test asserting no lone surrogates. The operator path has no such guard.

Reproduction:
1. As any linked member, send `/issue <own receipt ID> a🌱🌱🌱…` with 79 or more emoji.
2. SQL `left(text, 80)` returns 80 code points.
3. `slice(0, 80)` then ends on a high surrogate, so `operatorMessage()` contains an unpaired surrogate.
4. grammY serializes this as `"\ud83c"`. Telegram's JSON parser is expected to reject unpaired surrogates, so the admin's `/ops` fails.
5. It keeps failing while that issue is among the latest three.

So an unprivileged member can disable the designated admin's operator view. The intercepted-transport tests cannot catch this.

- **Fix:** reuse the code-point-safe `clip` for every `safeLine` call (name, target, delivery reason, issue reason).
- **Test:** add an emoji-boundary case asserting no lone surrogate, like the receipts test does.

**B2. The private path writes new values into the frozen reward ledger, with no downstream evidence.** At `apps/api/src/member-journey/submissions.ts:265`, the code appends `"target_relation_unverified"` and `"account_ownership_unverified"` to `capture.limitations`. That value is stored in `reward_intakes.capture` and read by frozen or shared code:
- `readContribution` / the public API, then the web and readclient;
- evaluation, possibly as prompt input;
- effort nomination logic, which decides "essential evidence missing".

No test covers this path:
- `submissions.test.ts` only checks the stored array.
- `member-phone.test.ts` uses `seedCommunity`, which is the legacy lane.
- `receipts.test.ts` admits with `["text_only"]` directly.

Reproduction gap: in the `reward=true` case, after `acceptSubmission`:
1. Run `runEvaluation` with a fixture call.
2. Run `nominate` (the `/effort` path) on the same contribution.
3. Read it via `readContribution` and the readclient/web parser.

If any of these enumerate limitations or treat non-`text_only` values as missing evidence, private submissions will:
- stall in `pending_evidence`,
- change model input under a pinned prompt, or
- fail public audit parsing.

The receipt row already records `relation_status` and `ownership_status` as `'unverified'`, with a CHECK constraint.

- **Fix:** do not push into `capture`. Or add the end-to-end tests above and confirm the core/readclient schema accepts free-form strings.

**B3. A Telegram network call runs while holding the shared community reward lock.** At `apps/api/src/member-journey/submissions.ts:212`, `currentMember(tx, …)` calls `deps.membership` (`getChatMember`, up to 4 s) inside `withCommunityLock`. That transaction holds:
- the community `NO KEY UPDATE` lock, which is shared with `admitContribution`, `runEvaluation`/`completeDispatch`, `closeEpoch`, `openRaid` and `transitionRaid`;
- the session row lock.

The duplicate and `kind_taken` checks (lines ~238-253) run after that call.

Reproduction:
1. A linked member repeatedly opens fresh prompts (`/start reply_<id>`).
2. Each time they reply with an already-submitted public URL.
3. Every attempt passes the pre-lock checks and the oEmbed fetch, then holds the community lock across a Telegram round trip before being refused as `duplicate_artifact`.

Sustained contention delays frozen-worker writes. Near an epoch cutoff, a delayed decision gets `acceptedAt ≥ closesAt` and becomes **late/excluded**. That is an unprivileged path that can affect credit timing.

- **Fix:** do the post-fetch membership recheck immediately *before* `withCommunityLock`, still after retrieval. Then do the cheap duplicate and `kind_taken` pre-checks before any network I/O. Keep the authoritative duplicate and `kind_taken` checks under the lock.

## Requirement check (not met as worded)

- **"Private receipt explicitly discloses existing worker may post score publicly in group":** `receiptText` (`member-journey/receipts.ts`) contains no such line. The disclosure exists only in the pre-submission prompt (`bot/commands/private-submit.ts`, `prompt()`). The prompt is the better consent point. If the requirement is literal, add one receipt line: "The existing scorer may post this result publicly in the group, replying to the raid message." Otherwise, record that disclosure at the prompt is accepted.
- **Owner validation:** the disposable Postgres run (59/59) predates the final edits, and the exact committed run is still in progress. Even after the fixes above, acceptance is conditional on that run passing.

## Verified against the stated requirements (from the text)

- **Exact binding:**
  - Sessions bind user, community, task and kind.
  - Prompt replies are looked up by `(telegramUserId, promptMessageId)`.
  - Every entry point requires a private chat with `chat.id === from.id` and `!is_bot`.
  - A newer raid cannot take a submission.
  - Receipt and issue reads join member, session, task and contribution on caller, community and task.
- **Membership:**
  - `getChatMember` is checked at prompt time, before evidence fetch and after fetch.
  - Outages fail closed with no success message.
  - The `link_required` gate is kept.
- **Group message ID:** the contribution uses `task.telegramMessageId` (the group `/raid` message), never the private message ID. A test asserts this.
- **Admin-only:**
  - `/close_raid`, `/cancel_raid` and `/ops` check the exact current `adminTelegramUserId` plus the registered chat.
  - Retries recheck authority.
  - `/ops` rechecks before returning.
- **One active brief:** checked in `openRaid` under the community lock. The two-pool race test expects `created` and `active_exists`.
- **Close/cancel:**
  - Only `tasks.status` and an append-only event change.
  - A unique `(task_id, action)` index prevents duplicates; there is no rewrite and no cross-transition.
  - Contributions and scoring runs are preserved (tested).
  - An in-flight alert finishes; later sends are suppressed.
- **Frozen and immutable semantics:**
  - Issues use `ON CONFLICT DO NOTHING` and never write decisions.
  - Receipts mutate only `queue_status` from pending to queued, and verification columns are CHECK-pinned.
  - Frozen selection wins over late corrections.
  - Payment is never inferred.
- **Operator view:** selects only, with parameterized SQL and community-scoped queries. Missing pg-boss tables report "unavailable", not zero.
- **Frozen areas:** no edits to jobs, rewards, payout or core files. Migration 0014 is additive.

## Low advisories

1. **`/effort` regression:** `bot/commands/submit.ts:64`. `preflight` now refuses every URL, so `/effort <new URL>` (`effort.ts`) returns the "open the raid's private Submit button" text, and the `/effort` USAGE is stale. Standalone, non-raid URL work can no longer be submitted at all. Confirm this is intended, then update USAGE/help and add an `/effort` test.
2. **Possible `/raid` lockout:** `raid-alerts/alerts.ts:~107-114`. The active-brief check counts open tasks of any `kind`, but `transitionRaid` only accepts `kind = 'raid'`. A non-raid open task blocks `/raid` with no bot path to close it. Either filter on `kind = 'raid'` or allow closing it. There is also no DB-level invariant, so other task-opening paths (if any) bypass the check.
3. **Repeat cancel rewrites the timestamp:** `submissions.ts:~137`. `cancelSubmission` overwrites `cancelled_at` on every repeat and uses the JS clock, while expiry uses the DB clock. Add `isNull(cancelledAt)` and use the DB time.
4. **Duplicate enqueue possible:** `queueSubmission` (end of `submissions.ts`). Concurrent retries on a `pending` receipt can both enqueue. The reward lane is idempotent. The legacy `singletonKey` dedupe depends on pg-boss queue policy, so a duplicate could mean a second paid scoring call. Also, a failed status update after a successful enqueue reports "not queued".
5. **Aborted transaction in `readJobs`:** `operator.ts:~56-87`. The `catch` cannot recover inside a caller's transaction: PG aborts the transaction, and the final `authorized()` recheck then throws. Wrap the query in a savepoint if `/ops` is ever run in a read-only transaction.
6. **Replay needs current membership:** `acceptSubmission` checks membership before the replay path. A member who left cannot retry dispatch for their own pending receipt; it stays visible in `/ops`. Document this or allow replay-only dispatch without membership.
7. **`?? 0` message ID:** `submissions.ts:264`. `telegramMessageId ?? 0` gives the worker reply target `0` for tasks without a stored message ID. Prefer refusing, or make sure every raid stores one.
8. **No rate limits:** prompts (`beginSubmission`) and issues (distinct message IDs mean unlimited rows per receipt) are unbounded. Consider reusing an open session per (user, task, kind) and capping issues per receipt.
9. **Hidden gate check:** the body of `communityAndMember` is not in the packet. Confirm the old group path enforced no gate beyond the member row and implicit group presence, so the private path drops no existing eligibility check.
10. **Immutability is app-level only:** no trigger or privilege stops UPDATE/DELETE on `submission_issues` or `raid_lifecycle_events`. This is optional hardening if those rows must be auditable.
11. **State naming mismatch:** the operator SQL uses `'scheduled'` while `raidState()` uses `"upcoming"`. This is cosmetic but invites drift.
12. **Same surrogate class as B1 in existing code:** `raid.ts` uses `post.text.slice(0, 200)` and `deliverRaidAlert` uses `targetText.slice(0, 400)`. Here the text comes from the X post, not a member.
13. **Coverage gap:** `member-phone.test.ts` exercises only the legacy lane. Add one actual-bot reward-lane journey once B2 is resolved.
