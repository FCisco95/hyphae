---
date: 2026-10-08
summary: Raid stats in /raids, a one-time counts-only recap in the group when a raid ends, and the end time on the raid-length confirmation. Branch FCisco95/raid-stats, not pushed (hold until 2026-10-10T00:00Z). Needs migration raid_recaps (new table) and Cisco's yes on the texts below.
---

# Raid stats and recap, 2026-10-08

Branch `FCisco95/raid-stats`, commit `446ea5d` on top of `2380d59`. Local only: nothing pushed, merged or deployed.

## What works

- **`/raids`** (admin only, unchanged check) shows, for each open raid: the end time, the time left, replies and quotes submitted, how many are credited, and the average credited score. Numbers only.
- **Recap.** When a raid closes (Close button or `/close_raid`) or its window ends, the API posts one recap in the community group: the post, how long it ran, how many members took part, replies and quotes, credited count, average credited score, and a link to the epoch page. Counts only, no names or handles of members.
- **Exactly once, by design at most once.** A new `raid_recaps` row (one per raid, primary key `task_id`) is committed before the send. Racing processes, restarts, a redelivered `/close_raid` and a second tap all find the row and post nothing more. A Telegram 429 is retried after its `retry_after`. A send that may have gone out (network error, 5xx, crash mid-send) is marked `uncertain` or left in `sending` and is never retried. A 400/403 is `failed`.
- **No recap** for a cancelled raid, a brief (`kind = open`), or a raid that ended more than one hour ago (so a release or an outage does not replay old raids).
- **Length confirmation.** Tapping 6/12/24/48h edits the picker to "Raid set for 24h. Ends 2026-10-09 18:00 UTC." (it also removes the buttons, as before).
- Unchanged: every tap and command re-checks the community admin; the cap of 3 open raids; closing keeps all work and credit. No scoring, reward or payout code was touched.

### Definitions used in the numbers

- **Submitted:** the raid's reply and quote contributions.
- **Credited:** the decision the public read API selects for that contribution (the epoch snapshot's once frozen, otherwise the last revision accepted before the epoch cutoff) has positive points. This is the receipt's "Counted" case; a zero-point score is submitted, not credited. Scored-but-pending work counts as submitted only.
- **Average credited score:** the rounded mean credited quality of the credited work. Omitted when nothing is credited.
- **Still being scored:** admitted to an open epoch with no selected decision yet (includes a model call waiting for reconciliation). Shown in the recap only when above zero.
- **Epoch link:** every epoch the raid's work was admitted to; the community page when none was.

## Exact new member-visible text (for Cisco's approval)

### `/raids` (admin, in the group)

```
Open raids (2 of 3):

#1 @owner · ends 2026-10-08 18:00 UTC (5h 12m left)
https://x.com/owner/status/123
Replies 4 · Quotes 2 · Credited 3 · Avg credited score 71

#2 @other · ends 2026-10-09 06:00 UTC (17h 12m left)
https://x.com/other/status/456
Replies 0 · Quotes 0 · Credited 0

Closing stops new submissions; existing work and credit stay.
```

New pieces: the `(… left)` suffix (`(under a minute left)` below one minute) and the stats line. The header, the URL line and the last line are unchanged.

### Raid length picked (edits the "How long should this raid run?" message)

```
Raid set for 24h. Ends 2026-10-09 18:00 UTC.
```

### Recap (public, in the group)

Closed by the admin:

```
Raid closed — @owner:
https://x.com/owner/status/123
Ran for 11h 42m.
5 members took part: 4 replies, 2 quotes.
Credited so far: 3 of 6, average credited score 71.
2 still being scored and may be credited later.
Epoch 2 results: https://<PUBLIC_WEB_URL>/c/<mint>/e/2
```

Window over, one submission, work in two epochs:

```
Raid ended — @owner:
https://x.com/owner/status/123
Ran for 12h.
1 member took part: 1 reply, 0 quotes.
Credited so far: 0 of 1.
Epoch 2 results: https://<PUBLIC_WEB_URL>/c/<mint>/e/2
Epoch 3 results: https://<PUBLIC_WEB_URL>/c/<mint>/e/3
```

Nobody submitted:

```
Raid ended — @owner:
https://x.com/owner/status/123
Ran for 6h.
No submissions.
Results: https://<PUBLIC_WEB_URL>/c/<mint>
```

The header mirrors the opening message ("Raid open for 24h — @owner:"); `@owner` is the X post's author, already public in that message. Durations read `5h 12m`, `12h`, `42m` or `under a minute`. Link previews are off.

## How it was checked

- New tests: `raid-alerts/stats.test.ts` (text builders; the credited count and average equal what `readContribution` selects on the full audit demo: frozen epoch, a late decision, an off-topic zero after a correction, an unresolved call, an unscored item), `raid-alerts/recap.test.ts` (exact recap texts; expiry once; admin close with its real duration; cancelled, stale and brief get none; 429 retried once after `retry_after`; 403 and network error never resent), lifecycle tests through the real bot handlers (Close button once and none on a second tap; `/close_raid` once and none on redelivery; `/cancel_raid` none; window over once and none after a later close; closed brief none), `runner.test.ts` (the notifier loop posts the recap to the group chat with previews off and records `sent` with the message id), `raid-alerts/recap.pg.test.ts` on real Postgres (three racing claims on two pools give one; a raid whose close or cancel is in flight is skipped, then claimed; the stats query matches the read API).
- `pnpm typecheck` exit 0. `pnpm lint` exit 0 (419 files). `drizzle-kit check`: "Everything's fine".
- `pnpm --filter @hyphae/api test:pg` (Docker, `HYPHAE_TEST_PG_PORT=55517`): 77 of 77, 13 files, exit 0. A first run made at the same time as the full unit suite had 5 failures: the known flaky "private journey" alert claim, the alert tests that then claim what it left behind, and a 200 s effort-slot race timeout. None touch this change; the run alone passed.
- `pnpm test`: core 119, read-client 26, web 123, API 1054 passed / 3 skipped (100 files, 2 skipped). **Exit 1.** The first run, made alongside `test:pg`, failed one test on a timeout (`scripts/eval-scoring.test.ts` "--recorded", 26 s). The next two runs passed every test but still exited 1 on one vitest error, `[vitest-worker]: Timeout calling "onTaskUpdate"`. A fourth run had the same error plus a 30 s `beforeAll` timeout booting PGlite in `member-phone.test.ts` (that file passes alone, 5 of 5). The base commit `2380d59` without this change fails the same way on this machine (1023 passed, the same error, and `scripts/read-community.test.ts` failed), so this is load from five workers' suites on one machine, not this change. Re-run the gate on a quiet machine or in CI before release.
- Context7 was not available in this session; the drizzle-orm 0.45.2 lock options and grammY 1.46.0 `editMessageText` were checked against the installed typings.

## What the release needs

1. **Migration.** `packages/db/drizzle/0018_raid_recaps.sql` creates `raid_recaps` only (no change to existing tables, no backfill). The coordinator renumbers it to 0019 at merge, since the wallet-record branch also takes 0018. Apply it before the new image; the old image never reads the table. `scripts/rollout/db.mjs` is pinned to the 0017 release and needs its own pin for this one.
2. **Review.** A migration plus new public bot output: per CLAUDE.md, a fresh-session review from the other model family (Codex `/review`) of the diff before push.
3. **Config.** None new. The epoch link uses the existing `PUBLIC_WEB_URL` (code default `https://hyphae.fun`); confirm the Fly value is the site members should open.
4. **Cisco's yes** on every string above.
5. **At deploy:** a raid that ended within the hour before the deploy gets its recap then (at most one per raid).

## Open questions and known limits

- A raid whose window ended can still be cancelled (existing lifecycle rule). If the recap was already posted, it stays. Changing that means changing the cancel rule, which this task does not touch.
- A 429 retry that falls beyond the one-hour window stays `pending` and is not sent.
- A crash between the claim commit and the send loses that one recap (at most once is the chosen side). Such a row stays in `sending`, which reads as "may have been sent".
- The recap does not say anything about payment. Only the private alert carries "Points do not promise payment."; the opening group message does not. Add a line if Cisco wants it in every public recap.
