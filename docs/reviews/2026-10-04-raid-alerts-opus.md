# Private raid alerts — fresh other-family reviews

Last Updated: 2026-10-04T21:25:07Z

## Verdict and limits

Initial **3d23691f8afc1ea7535c2e440efed0eb19bbb662..f8a360b19352b76a78e57adce2d4222795d20d5f NEEDS-FIXES**. Closing **f8a360b19352b76a78e57adce2d4222795d20d5f..050753615b456645ac7d95f5de243bec59ec68c4 ACCEPT**. Actual reviewer **claude-opus-5-5** in separate fresh CLI sessions; **high requested**, effort not independently attested. Tools disabled; static supplied diff/runtime-source review only. Reviewer did not run tests or independently inspect files; owner executed the gates below. Initial generated snapshot omitted from supplied diff for size, causing a false-positive missing-snapshot concern; actual tracked blob and no-change Drizzle generation resolve it.

Initial session `ea29c67a-ab05-4e41-b7b4-8314f0834d19`; closing `c0346334-90f0-4c81-9608-300160f664a2`. No usage/cost estimate borrowed into this session's runtime claim. Main/source runs under gpt-6.1-sol/xhigh from primary turn metadata.

## Findings and repair evidence

- Signal handlers stopped the notifier without exiting an API that retained HTTP/pg-boss handles. **Actual child SIGINT/SIGTERM tests failed with required SIGKILL**, then passed after a drain/exit helper with a ten-second backstop. Unix tests intentionally skip on native Windows; no Windows execution claim.
- Snapshot was already tracked: `packages/db/drizzle/meta/0013_snapshot.json`, blob `d9a5e3128ad09b6a1d2d8a37ff003680cb74e18b`. Actual `drizzle-kit generate`:28tables, **no schema changes/nothing to migrate**. No duplicated migration generated.
- Dropped subscriber FOR SHARE: fresh two-pool PostgreSQL500ms-lock-timeout case proves new raid creation does not wait for an in-flight private send. Consent remains fenced by revision and a delivery-side row lock.
- Check task window before and after membership lookup. Expired targets cannot loop on a failed lookup.
- Stop removes only the pressed community's control, retaining other controls; failed/stale keyboard editing cannot suppress saved-consent confirmation.
- Deep link only offers; explicit **Enable raid alerts** verifies exact current membership and saves consent. Opening the bot/link does not subscribe.
- Stale claims with dispatchStarted=false safely recover once. Started/ambiguous sends remain uncertain and are never automatically retried. Two-pool test races the original/recovered claimant and observes one send.
- Lost-receipt duplicate-send regression proved by temporarily removing the persisted dispatch marker: FAIL; exact source restored:PASS. Source remains private/caller scoped; no provider or production messages.

Closing current-main gate: **916tests/1optional skip**, types0/lint320/Drizzle0/API+web builds0; fresh disposable PostgreSQL **55/55**. Exact minimal outgoing candidate **c58aa27efdb5bc5492c2f96d45c090c9fc91d379**: **876tests/1optional skip** (106core/107web/663API), types0/lint297/Drizzle0/Postgres55/55/API+web builds0. Feature/repair changed-file bytes identical between main and candidate; earlier SDK/adopter source absent from candidate.

## Accepted advisories

Closing reviewer found no release blockers. Record, do not erase, these follow-ups:

1. A failed/expired callback toast can prevent Stop or Enable before the consent write; no successful confirmation is shown. Make callback answers best-effort in a later scoped repair.
2. UTF-16 slice boundaries can split an emoji in long names/briefs/post excerpts; a rejected alert is recorded failed. Use code-point truncation in a later scoped repair.
3. Platform shutdown timeout may end a drain before the ten-second app budget; resulting started deliveries remain uncertain. No Fly configuration changed; verify any API-only stop budget under the live scope and never change frozen-worker config implicitly.
4. `/help brief` **exists** in registered bot commands/onboarding, source verified; no missing-command finding.
5. Signal test resolves from process.cwd() and assumes normal filtered API test cwd; use import.meta.url in a future portable-test cleanup.
6. Permanent membership failures are conservatively retried only until the raid's window closes; consider terminal classification later.

These are not independently reclassified as blockers. Changing source after this accepted pin invalidates its exact release authorization and requires a new pin/gate/review where sensitive.

## Initial review (verbatim)

# Verdict: NEEDS-FIXES

The core design holds: isolation, consent revisions, Stop serialization, the `dispatchStarted` ownership token, the claims, and the additive schema are all correct. Two release blockers remain: one in API shutdown and one in Drizzle metadata (please verify the second). The other findings are minor and do not block.

I used no tools. This review covers only the diff you pasted.

## Blocking

**1. API no longer exits on SIGINT/SIGTERM.** `apps/api/src/server.ts:22-25`
- **Cause:** Node removes its default exit-on-signal behaviour once a listener is attached to SIGINT or SIGTERM. The handler stops the notifier but never exits. The HTTP server and pg-boss keep the event loop alive.
- **Failure scenario:** Fly sends SIGINT on deploy or stop. The API keeps serving until `kill_timeout`, then gets SIGKILL. Every deploy now waits the full timeout and ends with a hard kill. Locally, the first Ctrl-C does nothing. This applies unless some code outside the shown hunk already calls `process.exit`.
- **Minimal fix:** `process.once(signal, () => void raidNotifier.stop().finally(() => process.exit(0)));`
  - This lets a bounded in-flight delivery record its receipt, then exits.
  - If it gets killed anyway, the row ends up `uncertain`, which is the accepted outcome.
  - Add a test that the handler calls exit after `stop()` resolves.

**2. Migration snapshot missing from the range (verify).** `packages/db/drizzle/meta/_journal.json:96-102`
- **Cause:** The journal gains `0013_raid_alerts`, but the range has no `packages/db/drizzle/meta/0013_snapshot.json`.
- **Failure scenario:** If `0000`–`0012` snapshots are tracked, the next `drizzle-kit generate` will diff against `0012_snapshot.json`. It will emit a `0014` that re-runs `CREATE TYPE raid_delivery_status` and `CREATE TABLE raid_*`, which fails on any migrated database. `drizzle-kit check` does not catch a missing snapshot.
- **Minimal fix:** Commit the generated `0013_snapshot.json`. Then confirm `drizzle-kit generate` reports no changes.

## Non-blocking (low)

**3. Subscriber `FOR SHARE` ties the `/raid` webhook to in-flight sends.** `apps/api/src/raid-alerts/alerts.ts:140`
- **Failure scenario:** The delivery transaction holds the subscription row `FOR UPDATE` across up to two 4-second Telegram calls. A concurrent `/raid` blocks on `FOR SHARE` after `fetchPost`. That can push the webhook past its timeout. Telegram then retries, and the group sees an extra "already opened" reply. Dedup still holds.
- **Why the lock isn't needed:** The delivery step re-checks `revision` under its own lock. A Stop that commits after the subscriber read still causes `consent_changed`.
- **Fix:** Drop `.for("share")` on the subscriber select.

**4. Membership failures retry until the task status flips, not until the deadline.** `alerts.ts:285-290`
- **Cause:** The window check only runs after the membership lookup.
- **Failure scenario:** The bot is removed from the group, so `getChatMember` returns 400/403 permanently. Every delivery for that community calls Telegram every 60 seconds until something sets `tasks.status` to closed, even after `closesAt`.
- **Fix:** Also check `task.opensAt > now || task.closesAt <= now` before calling `deps.membership`. Keep the existing check after it.

**5. Stopping from the list removes every Stop button.** `apps/api/src/bot/commands/notifications.ts:134`
- **Failure scenario:**
  - In the private `/notifications` list, one press clears the whole keyboard. The other communities' buttons disappear, even though the text says "each button stops only that community".
  - A fast double-tap makes `editMessageReplyMarkup` throw "message is not modified". The error goes to the error boundary after the stop has already been saved.
- **Fix:** Rebuild the keyboard without the pressed row, or simply wrap the edit in `try/catch` and ignore failures. The reply should not depend on the edit succeeding.

**6. Consent is one tap on a deep link.** `notifications.ts:65`
- **Failure scenario:** Someone posts a disguised text link pointing to `?start=raids_<id>`. A member who taps it gets subscribed, especially in clients that auto-send `/start` for an existing chat. Impact is small: they must be a member, and every alert has a Stop button.
- **Fix:** Reply with an "Enable alerts" callback button and write consent only on that press.

**7. Optional: fewer missed alerts at no duplicate risk.** `alerts.ts:159-167`
- Stale `sending` rows with `dispatchStarted = false` can safely go back to `pending` instead of `uncertain`. The conditional `dispatchStarted` update stays the only send token, so a stalled first claimant and a re-claimant cannot both send.
- Rows with `dispatchStarted = true` must stay `uncertain`.

## Checked and sound
- **Isolation:**
  - Opt-in requires a private chat whose ID equals the user ID, plus a live membership check in that exact community.
  - Stop only touches the caller's own row.
  - Delivery checks that the task and announcement belong to the community.
  - Unsafe chat or user IDs are refused rather than rounded.
- **Consent:**
  - The `enabledAt <= now` filter means opt-in never backfills old raids.
  - A repeated opt-in keeps the same revision.
  - Stop followed by re-opt-in cannot revive deliveries queued under the old consent.
  - A Stop that commits blocks every later send. One that arrives mid-send waits for that send to finish.
- **Dedup and concurrency:**
  - The advisory lock plus a unique source index make webhook retries reuse the same event.
  - Claims use `SKIP LOCKED`.
  - `dispatchStarted` is committed before the send transaction. A failed receipt write therefore rolls back to `sending` and is later swept to `uncertain`, never resent.
  - The sweep waits on the row lock and re-checks `status`, so it cannot overwrite a committed `sent`.
  - Lock order is delivery row, then subscription row, with no cycles.
- **Telegram calls:**
  - The notifier's `Api` has `timeoutSeconds: 4` and no retry plugin.
  - 429 honours `retry_after`.
  - 400/403 end as terminal; 403 also disables alerts for that community.
  - Network errors and 5xx are recorded as `uncertain`.
- **Credentials and logging:** No raw errors, payloads or recipient IDs are stored or logged. No `parse_mode` is set.
- **Migration:**
  - Only new enum, tables, foreign keys and indexes.
  - The old API stays compatible.
  - Callback data is 46 bytes and the deep-link payload is 42 characters, both within Telegram's 64 limit.

Once 1 and 2 are fixed and the local gate plus `test:pg` pass again, I would ACCEPT. Findings 3–7 can wait for a later pass.

## Closing review (verbatim)

# Verdict: ACCEPT

Both prior blockers are fixed. None of the repairs adds a new problem that should block release. Everything below is a follow-up, not a blocker.

I used no tools. This review covers only the material you pasted. I took the snapshot evidence and the test and gate numbers as you reported them.

## Prior blockers

**1. Shutdown: fixed.**
- `stopApiOnSignals` waits for the notifier to finish, then exits with 0. If the drain fails, or takes longer than 10 s, it exits with 1.
- The `stopping` flag stops SIGINT and SIGTERM from both running the drain.
- After the first signal, `once` removes that listener. A second press of the same signal falls back to Node's default and exits at once. That is the right force-quit behaviour.
- The child-process test is a real proof:
  - A `setInterval` keeps the process alive, so it only exits if the handler exits it.
  - It checks for `drained` and for `{code: 0, signal: null}`.
  - A SIGKILL after 3 s makes the test fail instead of hang.

**2. Snapshot: resolved.** It was missing from the review input, not from the repo. `drizzle-kit generate` reports no changes, which is the check that matters.

## Prior low findings (3–7)

- **3. `FOR SHARE` removed: correct.** Consent safety still comes from the revision check under the delivery-side `FOR UPDATE`. A Stop that commits after the subscriber read still causes `consent_changed`, and so does Stop followed by re-enable. A user who enables during an `openRaid` may miss that one raid, which matches "future raids". The lock-timeout test is the right test: nothing in `openRaid` waits on the delivery transaction's locks.
- **4. Window check before lookup: correct.** Failed lookups now retry only until the raid closes. Each retry sets `dispatchStarted: false`, so the row can be claimed again.
- **5. Stop keyboard: correct.**
  - Only the pressed button is removed. "Engage on X" and the other communities' Stop buttons stay.
  - A failed edit is ignored, so it cannot block the confirmation.
  - The confirmation is sent only after consent is saved.
- **6. Explicit Enable: correct.**
  - The deep link only offers. Enable requires a private chat whose ID equals the user's ID, plus a live membership check.
  - Callback data can only come from buttons on the bot's own messages, so the consent path takes two deliberate taps.
  - A start payload of `raids_on_…` fails the UUID check and gets the harmless "own private chat" reply.
  - Tapping Enable twice is idempotent.
- **7. Stale-claim recovery: correct. I checked the races:**
  - **Stalled first claimant A vs. recovering B:** only one conditional `dispatchStarted` update can succeed. The loser reads the status and returns without sending. Your two-pool test covers this.
  - **A's dispatch marker commits during B's sweep:** Postgres re-checks the updated row, sees `dispatchStarted = true`, and sets it to `uncertain`. A then reads `uncertain` under its row lock and does not send. That is a safe miss, not a duplicate.
  - **No path leaves a row `pending` with `dispatchStarted = true`:** `finish("pending")` always resets the flag, and the sweep only sets `pending` when the flag is false.
  - **A transaction fails after the marker commits:** it rolls back to `sending` with the flag true, and the sweep then marks it `uncertain`. Conservative and correct.

## Follow-ups (non-blocking, in priority order)

1. **A failed callback answer can block Stop or Enable.** `notifications.ts`, in `stopRaidAlerts` and `enableRaidAlerts`.
   - Both handlers call `answerCallbackQuery` before the consent write.
   - Telegram rejects answers to callback queries that are too old. That can happen when a webhook update is retried late, for example after a deploy or restart.
   - When that happens, the error boundary swallows it and the Stop is never saved. The user sees no confirmation, so they are not misled, but Stop is the safety lever and should not depend on a toast.
   - Fix: wrap both answers in `try/catch` and ignore failures, the same way you already handle the keyboard edit.
2. **Cutting text by UTF-16 units can split an emoji.** `alerts.ts`, the `targetText.slice(0, 400)` call (new in this repair). `brief` and `community.name` use the same pattern.
   - A lone surrogate half at the cut point is not valid text.
   - If Telegram rejects it with 400, every subscriber's alert for that raid ends as `failed`.
   - This only bites on long posts (premium X), but it fails all subscribers at once.
   - Fix: truncate by code point, e.g. `Array.from(s).slice(0, n).join("")`.
3. **Fly's kill timeout vs. the drain bound.** Fly's default `kill_timeout` is 5 s. An in-flight delivery can take more than 8 s: a 4 s membership lookup, a 4 s send, plus database time.
   - Fly can SIGKILL before the drain finishes. The row then ends `uncertain`, which is the accepted outcome but an avoidable miss.
   - Fix: set `kill_timeout` to about 15 s in the API's Fly config, so the 10 s backstop is the limit that actually applies.
4. **Check that `/help brief` exists.** The new alert text sends users to it. If that subcommand does not exist, the alert makes a public claim the bot cannot back up.
5. **The shutdown test depends on the working directory.** It builds its path from `process.cwd()`, so it breaks if Vitest ever runs from the repo root. Build the path from `import.meta.url` instead.
6. **Optional:** a 400 or 403 from the membership lookup (bot removed, chat not found) is permanent but is treated like an outage. It is now bounded by the raid window, so this is only wasted calls. You could mark these `skipped` directly.

Per the working agreement, record this verdict and the follow-ups in `docs/HANDOFF.md`.
