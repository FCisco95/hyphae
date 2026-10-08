---
date: 2026-10-08
summary: Independent Codex review of raid-stats and its merge into next at 300eb97; CHANGES REQUESTED, with two medium concurrency findings and one low retry-bound finding; 34 focused tests passed.
---

# Raid stats: independent Codex review

## Scope

Reviewer: Codex, independent of the builder. Read both assigned briefs, `CLAUDE.md`, `docs/HANDOFF.md`, the branch note and the existing Blink review format before reviewing the implementation.

- Branch diff: `2380d590c624033089a324706c2ac92656d16484..0112695c2593e4db8e2d3d7c6b3e463b3df36278` (`origin/FCisco95/raid-stats`); implementation `446ea5dfd47763ab0244d91ecea4d87c43045b69`.
- Merged implementation: `1916c41afe61a82968a0659c28d6bc4b9ade68d5`, checked through `next` at `300eb975f33f04cb4aa56bcadf108fcaeccc9777`.
- Reviewed the recap and stats code, notifier wiring, bot changes and tests, schema/migration metadata, and relevant unchanged lifecycle, alert, reward-lock and public-read paths. All finding locations below refer to the merged tree.

## Verdict: CHANGES REQUESTED

**Findings: 0 high, 2 medium, 1 low.** The cancellation check does not cover the interval between claim and send, and a stale concurrent claim can bypass a newly recorded rate-limit delay. The requested one-retry limit is also absent. These are source-level execution traces; the prescribed tests passed but do not exercise these interleavings. No production service was contacted.

1. **Medium — Serialize cancellation with the actual recap send.** `apps/api/src/raid-alerts/recap.ts:144`, with the claim transaction ending at `recap.ts:123` and `apps/api/src/member-journey/lifecycle.ts:73`.

   Scenario: a raid's window has expired but its task is still `open`. The notifier claims it and commits `raid_recaps.status = sending`. Before `deliverRaidRecap` starts the Telegram request, `/cancel_raid` acquires the now-released task lock, records cancellation and completes. Delivery then sends the previously built "Raid ended" recap and marks it `sent` without reading the task or cancellation event again. Members can therefore receive a new recap after cancellation has completed. This differs from the branch note's accepted limitation that a recap **already posted** remains visible when an expired raid is later cancelled.

   The claim's `FOR SHARE` protects only the claim transaction. PostgreSQL releases that lock at transaction end, so it cannot cover the later send. [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS).

   **Recommended fix:** preserve the committed at-most-once claim, then use a separate delivery transaction to acquire the task's `FOR SHARE` lock, recheck cancellation and retain the lock through the bounded Telegram request. Record a terminal `skipped` outcome if cancellation already won. Keep the community reward lock out of this send transaction and retain the existing four-second send bound. A standalone recheck without the lock leaves the same race.

   **Tests needed:** in `recap.test.ts`, claim an expired raid, complete `transitionRaid(..., action: cancelled)`, then deliver and assert zero sends and a terminal skipped outcome. In a later authorized Postgres run, cover both orders with two connections: cancellation wins before delivery, and delivery holds its bounded send lock so cancellation cannot confirm before that request finishes. Existing tests cancel before claiming only.

2. **Medium — Recheck the retry deadline in the atomic conflict update.** `apps/api/src/raid-alerts/recap.ts:90`, following the candidate test at `recap.ts:71`.

   Scenario: two API processes select the same ended task while its recap is absent or due. Both can hold `FOR SHARE` on the task. Process B pauses after the SELECT; A claims, commits, sends and receives `429 retry_after=30`, then saves `pending` with a deadline 30 seconds ahead. B resumes its INSERT before that deadline. Its conflict update checks only `status = pending`, so it changes A's deferred row back to `sending` and sends immediately. This bypasses Telegram's requested delay and can repeatedly consume attempts during a rate limit. It does not establish two successfully accepted messages: only the rejected attempt makes the row reclaimable.

   Shared task locks do not exclude another shared claimant. The conflict action must check the current row's deadline rather than rely on the earlier candidate query. PostgreSQL evaluates the conflict action's condition against the identified conflicting row. [PostgreSQL INSERT / ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT).

   **Recommended fix:** require both `pending` and `next_attempt_at <= due` in `setWhere`, evaluated when the conflict row is locked. Keep returning no claim when the predicate fails. A task lock change by itself is insufficient unless all relevant delivery-state transitions use that same lock.

   **Tests needed:** a controlled two-connection test that pauses B between candidate selection and INSERT, lets A receive a 429 and record a future deadline, then resumes B. B must return no claim; no send may start before the deadline, and exactly one claimant must win after it. The existing Postgres race test races fresh claims but does not interleave a 429 completion. It was read, not run, per the brief.

3. **Low — Enforce the brief's one-retry bound.** `apps/api/src/raid-alerts/recap.ts:147` and `packages/db/src/schema.ts:179`.

   Scenario: the first request receives a 429; the allowed retry also receives a 429. Both errors take the identical `pending` branch, and the table stores no attempt count or retry-used flag. The next sweep can issue a third request, then further requests while the raid remains within the one-hour window. The test named "retries ... and posts once" covers one rejection followed by success, not exhaustion of the retry allowance. Rejected requests are not duplicate public posts, so this is a retry-policy/robustness defect rather than evidence of duplicate delivery.

   **Recommended fix:** persist whether the permitted retry has been used, update it atomically with claiming, and make a second rate-limit rejection terminal with a bounded reason such as `rate_limit_retry_exhausted`. Preserve no-retry handling for ambiguous outcomes. If repeated 429 retries are intended instead, the coordinator must explicitly reconcile that behavior with the supplied one-retry requirement.

   **Tests needed:** first 429 then success; two consecutive 429 responses followed by repeated sweeps and restart with no third send; missing/invalid `retry_after`; retry deadline beyond the one-hour eligibility window. Apply any schema adjustment to the still-unreleased migration under the coordinator's ownership.

## Checks and evidence

Command run once:

```text
pnpm --filter @hyphae/api exec vitest run src/raid-alerts/stats.test.ts src/raid-alerts/recap.test.ts src/raid-alerts/runner.test.ts src/bot/commands/raid-lifecycle.test.ts src/bot/commands/raid-menu.test.ts --maxWorkers=1
```

| Check | Result |
|---|---|
| `raid-alerts/stats.test.ts` | 4/4 passed |
| `raid-alerts/recap.test.ts` | 8/8 passed |
| `raid-alerts/runner.test.ts` | 4/4 passed |
| `bot/commands/raid-lifecycle.test.ts` | 10/10 passed |
| `bot/commands/raid-menu.test.ts` | 8/8 passed |
| Focused run | **34/34 tests, 5/5 files, exit 0, 15.04 seconds**, one worker |
| Merge review | All five merge commits inspected by ref; branch-file comparison shows no application/test behavior changes from raid-stats |
| SQL identity | Branch `0018_raid_recaps.sql` and merged `0019_raid_recaps.sql` share Git blob `c99652b657563e02ae99b6bb2701528d8f30107b`; disk bytes also match Git |
| Snapshot comparison | Only `public.raid_recaps` added from snapshot 0018 to 0019; zero changed existing tables or other schema sections; recap definition equals the branch snapshot |
| Scope safety | No tracked files edited; no commit, push, production access, full suite, typecheck, lint or `test:pg` |

The initial sandboxed shell attempts failed before execution with Windows `CreateProcessAsUserW` access denied. Authorized elevated shell execution worked. Tests used their local PGlite fixtures and intercepted Telegram transport. No additional test files or custom runtime probes were created or run. `member-phone.test.ts` was inspected; its only branch change passes the new web-base argument, and it was not included in the explicitly bounded lifecycle test run.

## Checked and found sound

- **At-most-once delivery on the normal notifier path:** a successful claim commits before `sendMessage`; the task primary key and conflict predicate prevent another claim while the row is `sending`, `sent`, `failed` or `uncertain`. Duplicate commands, Close taps and expiry sweeps have no independent direct-send path. No path was found that records `sent` without the sender returning success. A crash before sending can lose a recap while leaving `sending`; a crash or database error after acceptance can leave `sending`/`uncertain`. These are the documented at-most-once tradeoffs, not automatic retry candidates. Network errors and 5xx resolve to `uncertain`; 400/403 resolve to `failed`.
- **Eligibility filters:** task kind must be `raid`; cancelled events are excluded at claim time; end time is the earlier of the scheduled end and a recorded close. The interval is `(now - 1 hour, now]`, so an end exactly one hour old is excluded. A deployment claims eligible, previously unclaimed raids that ended within the preceding hour; there is no deployment-time lower bound or historical backfill. Briefs receive no recap. Finding 1 covers cancellation after the claim.
- **Counts and public text:** stats select reply/quote contributions, count distinct member IDs internally, and expose only aggregates. Frozen work uses the snapshot's selected decision and units; provisional work uses the highest revision accepted strictly before the epoch cutoff. Positive selected units define credited work, and the mean is the rounded selected credited quality of that positive-point subset. This agrees with the seven-contribution audit fixture: 2 members, 4 replies, 3 quotes, 2 credited, average 78, 1 still scoring, epochs 1 and 2. An admitted item without a selected decision counts as still scoring only before the cutoff and without a snapshot; legacy work without intake does not. The recap contains no member name, handle, Telegram ID or contribution URL; its target URL and author are the already-public opening target. It makes no payment promise, and link previews are disabled.
- **Admin and accounting boundaries:** `/raids`, duration taps and Close taps retain their admin checks; opening and transitions recheck designation inside their existing transactions. The cap remains three open tasks through unchanged `openRaid`. Closing changes lifecycle state and adds an event without deleting submissions or changing credit. The branch path diff contains no scoring, reward, settlement or payout implementation edits; the new stats module only reads their tables.
- **Lock order:** the claim takes the task SHARE lock and obtains FK KEY SHARE locks when inserting its recap. It does not acquire the community's reward NO KEY UPDATE lock; `dbClock` is an ordinary SELECT. No new community/task lock-order cycle was found. Lifecycle still locks task before community. The new claim holds the task lock while reading all raid contributions and decisions, so duration grows with raid history; those queries have no explicit per-claim deadline. The recap network send occurs after commit and is bounded to four seconds. A slow database claim can delay the serial notifier loop; the permitted tests are not a load benchmark.
- **Merge and migration:** `1916c41` renames the SQL to 0019, puts the wallet index at 0018, regenerates snapshot metadata and updates the branch note. Snapshot 0019 has ID `699ef4cc-853c-42ab-96df-0f86bfd31246` and correctly points to snapshot 0018 ID `e68468a4-b962-4285-ab70-09eddfacfa38`. Journal index 19 names `0019_raid_recaps`, timestamp `1791474946724`, after index 18. SQL creates only the recap table with its primary key and two foreign keys, reusing the existing enum. Later merges add no changes to the branch's application code or tests. The shared schema's additional wallet index belongs to wallet-record.

## Release prerequisites and limits

`scripts/rollout/db.mjs:35` still pins the previous 0017 release. Its current journal-tail, schema-shape and epoch-2-open checks cannot be used unchanged for this post-payout release. Prepare a separate reviewed release pin for **0018 and 0019**, replacing the old migration set, with pre/post checks for journal **18 -> 20**, the wallet index and recap table, and the actual approved epoch state. The present SQL hashes are:

```text
0018_member_wallet_links_wallet  79592f957d9b43805e468c97ffce066a091a68cfaebda5944f9d234282812302
0019_raid_recaps                6d3f708b25b1fa32218bcd18266723661f9d34f22ebe4252e19702a5a6fe592c
```

Recompute 0019's pin if the retry-state fix changes its SQL. Migration application must precede starting the new image. This is an already-recorded release prerequisite, not a claim that a migration was applied here.

URL wiring is `process.env.PUBLIC_WEB_URL` -> `apps/api/src/env.ts:13` -> `apps/api/src/server.ts:23` -> notifier -> `recapText`. With the environment value absent, `https://hyphae.fun` reaches members unchanged except for stripping a trailing slash; `apps/api/fly.toml` supplies no override. The recorded cutover in `docs/handoffs/2026-09-29-cutover-run.md:25` says Fly's `PUBLIC_WEB_URL` was set to `https://hyphae-delta.vercel.app` (v10). That is historical evidence, not current Fly verification. Confirm the effective API process value in the authorized release sitting; do not infer it from local `.env` or the default.

Real Postgres races were not executed, as required. Stats use two queries without the public API's repeatable-read wrapper; parity was verified on stable fixtures, not as a concurrent snapshot-consistency guarantee. The existing handoff's old release timetable was not treated as current authorization; the review brief places this code after the first payout. This report grants no migration, deployment or publication approval.

Next bounded action: the coordinator assigns the three findings for fixes and regression coverage, then requests an independent fix review. Suggested skills for that work: systematic-debugging and verification-before-completion; use the same Orca task ownership contract. This ignored report is the worker's durable handoff; tracked handoff/build-log updates remain with the coordinator under the explicit no-tracked-edits constraint.
