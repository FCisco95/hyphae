# Manual wallet check (Runbook A), 2026-09-24

Runbook A from `2026-09-24-cutover-decisions.md`, run on Cisco's Windows machine against a test bot, a test supergroup, a local Docker Postgres 17 and the built server behind a Tailscale Funnel. Neon, Fly and `@hyphaeprotocol_bot` were not touched.

## Result

| Check | Result |
|---|---|
| 1. `/link` in the group posts only the `t.me` deep link | pass |
| 2. The private chat returns the page URL | pass |
| 2b. A non-member gets "Join … first" | not run (no second Telegram account) |
| 3. Phantom shows a readable message and nothing else | **failed, then pass after `0589e88`** |
| 3. Solflare, same | pass (on `0589e88`) |
| 4. `/me` shows the wallet as verified | pass (in the group; `/me` is per community) |
| 5. Reopening a used URL shows "expired or already used" | pass (session used 15:24:34, not expired) |
| 6. A second member proving a held wallet gets `wallet_taken` | not run (no second account); covered by `test:pg` races and route tests |
| 7. Supergroup, bot not an admin: `getChatMember` answers | pass (only admin: the group creator) |

Database state after the run: two `member_wallet_links` rows for one member, both `method = 'signature'` with a proof id; the first closed at the exact instant the second opened. Proof requests: consumed where linked, pending where abandoned. Link sessions: one used per successful link.

## Defects found and fixed

1. **Every real wallet failed to sign (`0589e88`).** The page called `solana:signMessage([{ account, message }])`. The Wallet Standard method is variadic (`(...inputs) => outputs`), so Phantom never received the message and the page's altered-bytes guard rejected the result. `/link/request` succeeded; `/link/verify` was never reached. The unit tests had no coverage of the page's wallet adapter. New `page-wallet.test.ts` uses a spec-shaped fake (variadic, rejects non-bytes) and fails on the old call.
2. **The bot token reached the logs, and every handler error answered 500 (`dbe8b7e`).** Under a webhook, grammY never calls `bot.catch`; the error propagates to Hono, whose default handler logged the whole `BotError`, whose `ctx.api` holds the token. Telegram then redelivered the update. Triggered here by stale updates from the group before its supergroup upgrade. Handlers now run inside `bot.errorBoundary(logBotError)`, which logs named fields only. The test bot token did land in a local log file (deleted) and in the session transcript: **Cisco should revoke it in BotFather**. The production image has the same defect, so production handler errors since the Sep 17 deploy may have written `@hyphaeprotocol_bot`'s token to Fly logs.

## Open, not fixed

- **Group upgrade changes the chat id.** Converting a basic group to a supergroup gives it a new `-100…` id; `communities.telegram_chat_id` keeps the old one, so every command in the upgraded group answers "not a registered Hyphae community". Hyphae Lab is a basic group. Recommendation: handle `migrate_to_chat_id` by updating the community row, test-first, before inviting testers to a group that might be upgraded.
- **`/me` in a private chat** answers "This chat is not a registered Hyphae community." `/link` there says "Send /link in your community chat." `/me` should say the same kind of thing.

## Runbook A corrections (apply before the next run)

- Step 2: on Windows, `tailscaled` stays in `NoState` until the GUI client runs; start `tailscale-ipn.exe` first. Enabling Funnel the first time needs an admin approval link in the browser.
- Step 1: a new group is a basic group. Convert it to a supergroup (Chat history for new members: Visible) **before** seeding, or check 7 does not test what it claims and the seeded chat id goes stale.
- Step 1: with privacy mode on, the bot only sees commands, so read the chat id from `getUpdates` after sending `/start@<bot>` in the group.
- Step 4: the server refuses to boot without a scoring key; add `ANTHROPIC_API_KEY=<placeholder>` (the checks never score).
- Step 8: pass `drop_pending_updates=true` to `setWebhook`.
- Step 9.4: send `/me` in the group, not the private chat.

## Review

Codex adversarial review of `b52abd7..dbe8b7e` (diff passed inline; its sandbox denied workspace reads). Verdict **needs-attention**, four findings:

- F1 (high) `HttpError.message` may carry the token URL. Not reproducible here: grammY 1.46 `toHttpError` appends the cause's message only when `sensitiveLogs` is on, and it is off. Redacted anyway in `131ee85`.
- F2 (high) application error message and stack, and non-`Error` throws, could embed a Bot API URL (file URLs carry `/file/bot<token>/`). Fixed test-first in `131ee85`: every logged string has the token redacted.
- F3 (medium) answering 200 loses work that Telegram's redelivery used to recover. Redelivery stays off on purpose: handlers are not idempotent, and a permanent failure (like the pre-upgrade group) would be retried indefinitely. The boundary now tells the member (`131ee85`).
- F4 (medium) the exact `signedMessage` check refuses wallets that prefix the message. Accepted limitation: the server verifies the exact bytes, so a prefixing wallet would fail verification anyway, and supporting it needs a different verification contract. Phantom and Solflare verified by hand.

Follow-up review of `dbe8b7e..131ee85`: F1 closed, F3 and F4 responses accepted; two new findings, both fixed test-first in `ade2d2f`: `Error.name` was unredacted (high), and "Try again" invited duplicating a partly finished command (medium; the notice now says to check first). `ade2d2f` itself was not re-reviewed; it changes one field and one string, each covered by a test.
