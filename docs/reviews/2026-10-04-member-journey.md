# Member journey — fresh other-family review

Last Updated: 2026-10-04T22:40:33Z

## Verdict and evidence stage

**Final ACCEPT** for `e1f2c51cc4d3060aaa695a79b001503cb04e05f1..23a4f9c472c1ad06741632b57f83718ddf70b535`. Fresh actual `claude-opus-5-5` session `8a60ccd2-de25-4de3-b26b-191549521c68`, high requested, tools disabled; static supplied whole production diff and current context. Owner executed all checks; reviewer did not run tests. Initial and second NEEDS-FIXES responses below are historical and their blockers are repaired, not silently waived.

Owner final gate: **1,000 tests passed /1 optional skip** (106core,26SDK,107web,761API), **69/69 disposable PostgreSQL tests**, types0/lint343files0/Drizzlecheck0/API+webbuilds0/diffcheck0, Python16contract hashes reproduced. Exact final source unit/type/lint rerun passed before publication. Native Windows/real Telegram/provider/phone/claim execution remains unproved. Source publication and existing Git-triggered Vercel behavior are now explicitly authorized; production API/migration/worker/money scopes remain separate.

Repairs: Unicode-safe messages, unchanged frozen capture labels plus reward-lane bot proof, Telegram I/O outside the community reward lock, atomic queue job/receipt with real pg-boss concurrency/rollback/lost-ack proof, task-NKU-before-community cancellation with authority recheck, bounded sends, canonical receipt acceptance timestamp, and control-safe receipt fields. Historical brief closure, effort guidance, report/prompt abuse bounds and queue-telemetry savepoint also tested. All historical0000–0013 migrations and frozen worker/reward/payout/core/program source remain unchanged.

Final low advisories: trusted-operator/app-level append-only audit model; optional prompt lookup index, cosmetic empty keyboard, canonicalized permissive URL suffix parsing; no spending cap chosen; PG suite assumes its existing serial disposable runner; Stop may briefly wait on DB-only lifecycle work. Additional owner inspection closed the review's missing-context lock-order question: production rewards/jobs code only reads existing tasks (`intake.ts`, `evaluation.ts`, `score.ts`); no task update/explicit task lock. `closeEpoch` updates nominations/epochs only. Repository workflows contain CI and program build/test, no Fly/API deploy or production migration; repository webhook list is empty. No new production integration configured.

## Historical repair order

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


## Second fresh review — e1f2c51..f3aa3e0

Actual `claude-opus-5-5`, fresh session `642a2ba6-8609-4149-b0df-d210abacdc5b`, high requested, tools disabled; static only. Verdict **NEEDS-FIXES**, one further blocker: a lifecycle command held the community reward lock while waiting on an alert's task SHARE lock. Prior B1/B2/B3 and transactional enqueue repair confirmed resolved.

Owner reproduced this extra blocker with a real Postgres `FOR NO KEY UPDATE NOWAIT` attempt on the community while cancellation waited; it failed55P03 before repair. The runner signal assertion also failed before explicit per-call signals. The production server already had a4-second Api timeout; the review packet lacked that server context, so its multiple-minute default-timeout statement did not describe the existing production entrypoint. Explicit4-second signals are nevertheless added to bound the helper for every supplied Api instance.

Repair pending commit at this checkpoint: task NO KEY UPDATE lock first, then fresh community authority/reward lock; preliminary authority check avoids locking for outsiders. This preserves in-flight-send ordering while FK KEY SHARE stays compatible. Added real tests for reward-lock availability, revocation during wait, FK insert compatibility, and uncertain timeout. Canonical reward acceptance timestamp and control-safe receipt fields also have red→green regressions. No frozen worker/reward/payout/schema change.

Second review verbatim:

# Closing review: e1f2c51..f3aa3e0 (Hyphae member journey)

**Verdict: NEEDS-FIXES. There is one blocker. The fix is small and local.**

This is a static review of the supplied diff and context files only. I ran nothing and read no file myself. All test results below are as reported by the owner. The early part of `deliverRaidAlert` (above the shown hunk) was not supplied, so B1 rests on the shown hunk plus the PG test that demonstrates it.

## Prior blockers and advisories: confirmed resolved

- **B1 (operator Unicode).** `safeLine` replaces `\p{Cc}\p{Cf}` and clips on code-point boundaries. The SQL `left(…, 80)` counts code points, so no surrogates get split. Tests cover the name, target, delivery reason, issue reason and the full message.
- **B2 (new capture labels).** These are gone. The reward-lane capture is `["text_only"]`. The fixture prompt assertion confirms neither new label reaches the scorer, and the receipt still states relation and ownership as unverified.
- **B3 (Telegram under the community lock).** Fixed directly:
  - `acceptSubmission` calls Telegram (before fetch, then the post-fetch `currentMember`) before `withCommunityLock`.
  - Inside the lock it only rechecks the chat id, member row, session, window, duplicates and handle cap.
  - `beginSubmission` follows the same pattern.
  - The PG test with a gated second membership call shows the community lock is still available.
- **A4 (singletonKey).** The receipt is the only lock taken. The job is inserted with `fromDrizzle(tx)` using a stable receipt id, and `queued` is marked in the same transaction.
  - pg-boss is keyed per `(name, id)` and the lane is fixed per receipt, so an id collision can only mean a committed queued receipt, which short-circuits.
  - Unknown outcomes return `false` and ask the member to retry; the code never claims a job doesn't exist.
- **Frozen scope.** No touched file is in rewards, jobs, payout, core or program. `intake.ts`, `submission.ts`, `config.ts`, `score.ts` and `reward-jobs.ts` appear only as context.
- **Migration 0014.** It contains only the four `CREATE TABLE`s plus FKs and indexes on those tables. It adds no `ALTER` to existing tables.
- **Receipt wording.** All required lines are present:
  - target relation unverified;
  - X ownership unverified;
  - "approved human authorship attestation for the current payout still applies";
  - eligibility separate;
  - allocation labeled "not a payment confirmation";
  - claimability and payment "not checked/verified here".
- **Database checks.** The `relation_status`/`ownership_status` CHECK pins both to `'unverified'`, so no code path can upgrade them.

I also traced the whole intake flow:

- Deep-link and callback lengths are under Telegram's 64-byte limits.
- The reward lane's `AdmitResult` statuses all map to `REFUSALS` keys.
- `admitContribution` nested inside `withCommunityLock` uses a savepoint and the same lock holder.
- The group `telegramMessageId` (never a private-chat id) is passed to the frozen scorer.
- The `LIKE '%/status/<digits>'` dedupe has no wildcard injection and no suffix collision.
- Replay skips the provider fetch and handle binding and keys on session plus artifact.

## Remaining blocker

### B1: Telegram send can transitively hold the community reward lock

The new `deliverRaidAlert` hunk takes `tasks … FOR SHARE` and then calls `deps.send(...)` inside the same transaction.

`transitionRaid` takes these locks in order:

1. `communities … FOR NO KEY UPDATE`
2. `tasks … FOR UPDATE`, which conflicts with the alert's `FOR SHARE`.

So a close or cancel that races an in-flight alert holds the community NKU lock while waiting on a Telegram network call. While it waits, all of these block for that community:

- `acceptSubmission`
- `beginSubmission`
- `admitContribution`
- reward close
- `setRewardIntakePaused`

Your own PG test, "cancel waits for an already-started private alert", shows the wait. It just doesn't check what else is blocked during it.

Why this is a realistic case and not a corner:

- The most likely trigger is "opened with the wrong target, cancel immediately", which lands during alert fan-out.
- `runner.ts` passes no timeout to `sendMessage`, so the wait is bounded only by grammY's default API timeout (several minutes).
- If the notifier ever runs sends concurrently, overlapping `FOR SHARE` holders can starve the `FOR UPDATE` waiter for the whole fan-out.
- Acceptance timestamps are taken after the lock, so blocked submissions near an epoch boundary are stamped late. That is availability and fairness, not integrity, but it is the same invariant B3 was blocked on.

**Minimal fix (no migration):**

1. In `transitionRaid`, lock the task with `.for("no key update")` *before* the community lock.
   - The status update is non-key, so NKU is sufficient.
   - NKU still conflicts with the alert's `FOR SHARE`, so "close waits for the in-flight alert" is preserved.
   - NKU does not conflict with the `KEY SHARE` taken by FK inserts of contributions, sessions and receipts. That avoids the deadlock a plain `FOR UPDATE` reorder would cause against `acceptSubmission`.
   - No current path takes a task lock and then the community lock, so the new order cannot invert.
2. In the runner, bound `sendMessage` with `AbortSignal.timeout(~10s)`, as `private-submit.ts` already does for `getChatMember`, and classify a timeout as `uncertain`.

**Test to add:** in the existing gated-send PG test, assert from pool `b` that `select … from communities … for no key update nowait` succeeds while `transitionRaid` is waiting. Also re-run the "close wins over fetch" test and the racing-open test.

If you'd rather not reorder, an acceptable alternative is `set local lock_timeout` before the task lock, returning a `busy, retry` status to the admin. The error aborts the transaction, so catch it outside `db.transaction`.

## Advisories (not blocking)

1. **Legacy-lane receipts left `pending` have no automatic redispatch.** Only a member retry re-sends them; the reward lane has the `strandedWork` sweep. `/ops` shows the count. Document this, or add a sweep later.
2. **Legacy lane now honors `rewardIntakePausedAt`.** Group text `/submit` in the legacy lane does not. This looks intentional; note it in HANDOFF.
3. **`receivedAt` and `submittedAt`/`acceptedAt` are separate clock reads.** The receipt uses the outer lock clock; `admitContribution` reads its own. The gap is milliseconds, but the receipt timestamp is not the canonical acceptance time. Say so if anyone audits it.
4. **`receiptText` doesn't strip `Cc`/`Cf` characters.** This affects the community name, the oEmbed-derived target and the explanation. The message is plain text to the member only, so the risk is low, but `safeLine` could be reused.
5. **`parsePostUrl` has no end anchor** (`/status/123abc` parses as 123). It is harmless because the fetch canonicalizes and the post id is cross-checked.
6. **Cosmetic and performance items:**
   - The empty `InlineKeyboard` on the cancellation reply is a no-op.
   - `promptLimited` has no `(community_id, telegram_user_id, created_at)` index.
   - Both are fine at the current scale.
7. **`docs/HANDOFF.md` shows as modified in the working tree.** Confirm it is the intended closing record before committing.

## Publication disposition

Once B1 is fixed and the gates are re-run (unit, PG including the new lock-availability assertion, types, lint, Drizzle check, API and web builds), I would expect **ACCEPT**. Pushing `main` as authorized would then publish the source and trigger the Git-connected Vercel web deploy. Within the stated scope, nothing in this diff touches the production DB, API, Fly, the reward worker, secrets, real Telegram, or money. Production still needs migration 0014 applied before the new bot code runs, and that is outside this authorization.


## Final fresh review — e1f2c51..23a4f9c

# Final review: e1f2c51..23a4f9c (Hyphae member journey)

**Verdict: ACCEPT.**

This is a static review of the supplied previous review, final delta, full production diff and current context files. I ran nothing; all test and gate results are the owner's.

## Prior blocker B1: resolved

`transitionRaid` now locks in this order:

1. An unlocked preliminary authorization read.
2. `tasks … FOR NO KEY UPDATE`.
3. `communities … FOR NO KEY UPDATE`.
4. A fresh chat/admin recheck.

I traced the lock interactions:

- **Alert vs. closer.** The alert's `FOR SHARE` on the task conflicts with NKU, so the closer still waits for an in-flight send. It now waits before acquiring the community lock. Intake, admission, reward close and pause stay available. The `NOWAIT` assertion from pool `b` tests exactly this, and the owner reports it red before the fix and green after.
- **No intake lock cycle.** Every community-lock holder in the supplied code (`acceptSubmission`, `beginSubmission`, `admitContribution`, `openRaid`) touches existing task rows only through foreign-key `KEY SHARE`. That is compatible with NKU. The third PG test inserts a real FK row under the held community lock while the closer waits, with a 500 ms `lock_timeout`.
- **Status update stays NKU.** `UPDATE tasks SET status` changes a non-key column, so it does not escalate to `FOR UPDATE` and stays compatible with `KEY SHARE`.
- **Late alerts are suppressed.** An alert that queues behind the closer's NKU re-reads the committed row (READ COMMITTED recheck), sees `closed`, and skips. The existing second-recipient assertion covers this.
- **Outsiders can't queue locks.** The preliminary read stops non-admins from taking task locks. The revocation-during-wait test shows the under-lock recheck is authoritative.
- **Send timeout.** The per-call `AbortSignal.timeout(4_000)` duplicates the existing `timeoutSeconds: 4` in `server.ts`, which I had not seen when I wrote the previous review. A grammY abort surfaces as a non-`GrammyError`, so it lands in `uncertain`/`send_unknown` with no automatic resend. The fixture asserts one send and an `uncertain` row.

## Prior advisories: resolved

- **`receivedAt`.** The reward lane now records `intake.acceptedAt`, the canonical admission time from the nested same-holder lock. The legacy lane uses the outer `now`, which equals `submittedAt`.
- **Receipt control characters.** `clip` now replaces `\p{Cc}\p{Cf}` in every untrusted field: community name, target, submission URL and both explanations.
- **Documented items.** Legacy pending dispatch (member retry, no sweep) and legacy honoring of the pause are documented as stated.

## Remaining advisories (low, not blocking)

1. **Frozen-path lock order is inferred, not verified.** The new order is safe only if no path takes the community lock and then locks or updates an existing `tasks` row.
   - Every supplied path complies. `closeEpoch` and the score worker were not supplied.
   - If a frozen path did invert, PostgreSQL would detect the deadlock and abort one transaction rather than hang. An aborted `transitionRaid` is an admin retry, not an integrity issue.
   - One grep for task locks or updates in `rewards/` and `jobs/` would close this.
2. **Control-character replacement flattens but doesn't neutralize text.**
   - An admin-chosen name like `X\nPayment: confirmed` renders inline as "…for X Payment: confirmed." on line 1. It is not a separate status line, and the real "Payment: not verified here" line still follows.
   - Replacing `Cf` also inserts spaces into ZWJ emoji sequences in names.
   - Both are cosmetic, and the name is operator-set.
3. **PG test helpers in a shared database.**
   - `waitForLock` matches any session waiting on `from "tasks"`/`"communities"` in the database, not specifically pool `b`.
   - `claimRaidAlert(a)` claims the globally earliest pending delivery. A leftover pending row from another suite could be claimed instead, and the gate would then never fire, so the test times out.
   - Both are flake risks only if files share the database concurrently or leave pending rows. Filtering by the application name or pid of `b`, and claiming by id, would harden them.
4. **Lock holds while the closer waits.** An alert waiting behind a closer's task NKU still holds its delivery and subscription row locks. A Stop tap for that one user waits briefly. This is bounded by short DB-only work.
5. **Type cast.** The `AbortSignal … as unknown as Parameters<…>` cast is type-only and changes no behavior.
6. **Retained from the previous review:**
   - App-level append-only for lifecycle and issue records.
   - Empty `InlineKeyboard`.
   - No `promptLimited` index.
   - `parsePostUrl` has no end anchor.
   - No spending limit.

   All are acceptable at current scale and under the trusted-operator model.

## Scope check

- **No frozen files touched.** None of the touched production files is in rewards, jobs, payout, core or programs. Those appear only as context.
- **Migration 0014 is additive.** It creates four tables plus FKs and indexes on those tables only. It adds no `ALTER` to existing tables, and the CHECKs pin `relation_status`/`ownership_status` to `'unverified'`.
- **Lifecycle changes stay narrow.** They write task status and audit events only, with no score, decision or allocation writes.

## Publication disposition

Within the stated authorization, pushing current `main` is acceptable. It publishes the source and triggers only the existing Git-connected Vercel web deploy.

Before anyone deploys the API, apply migration 0014 to production. The new bot code reads the four new tables, so deploying the API first would break `/raid`, private submit and receipts. Neither the migration nor an API deploy is authorized here.

Confirm that no Git-triggered Fly/API deploy is wired to `main`; the brief says only Vercel is, and that matches.

The working-tree changes to `docs/HANDOFF.md` and `docs/reviews/2026-10-04-member-journey.md` should be checked as the intended closing record before committing.
