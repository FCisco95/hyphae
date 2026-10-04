# Private community raid alerts

**Implementation is local and tested; not live.** Production still uses the previously approved web and frozen API/worker. This feature needs a reviewed source release, migration `0013_raid_alerts.sql`, and an API-only rollout before members can use it. No new Fly machine is required. Keep the frozen reward worker on its existing image.

Members choose alerts separately for each registered community:

1. In the registered group, tap **/notifications** in the welcome keyboard, or send `/notifications`.
2. Tap **Get raid alerts privately**, open the official bot, press **Start**, then press **Enable raid alerts** for the named community. Opening the link only shows an offer; Enable checks current membership in that exact registered group before saving consent. Opening the bot, linking a wallet or belonging to another group does not automatically subscribe anyone.
3. Future admin-created raids arrive in that private chat with the target link/excerpt, brief, UTC deadline, **Engage on X** and **Stop these alerts** buttons. Submit the URL of your own reply/quote in the registered group using `/submit`; the notification itself creates no contribution or reward.
4. Stop from any alert, or send `/notifications` privately to choose a community to stop. Other communities stay unchanged. Re-enabling alerts does not replay old raids.

The current designated-admin `/raid` permission stays in place. Council authorization still depends on the separately owned, verified community-role/Telegram identity contract. Subscribing grants no target-creation, council, wallet or reward authority. The existing engagement-evidence gaps are recorded in `docs/handoffs/2026-10-04-engagement-authority.md` and are not silently changed by notification delivery.

Delivery uses three additive tables: community/user consent, the original Telegram raid event, and one outbox row per event/recipient. Task creation and outbox creation commit together. Webhook retries reuse the original event. Delivery rechecks consent revision, exact community/task, live Telegram membership and the task's open window. Leaving the group or blocking the bot disables only that community's alerts. The API handles outbox delivery independently of the reward worker, paced at one message per second per API process, with bounded Telegram calls.

A confirmed Telegram429 rejection waits for `retry_after`; a membership lookup outage waits without sending. A network failure, interrupted started dispatch or failed receipt write may leave delivery **uncertain**. Telegram provides no send idempotency key: these uncertain rows are retained and are **not automatically resent**, avoiding duplicate alerts after an ambiguous accept. An alert can therefore be missed during such a failure. Claims interrupted before dispatch starts can safely recover through the same one-use dispatch marker. There is no bulk-resend tool or delivery guarantee. Failed/skipped/uncertain states are not scoring or payment states.

A Stop request acknowledges that stopping has begun, then waits for any already in-flight bounded send. After the final Stop confirmation, that community's consent is disabled. Database receipt rows store bounded reasons only; logs omit recipient identifiers, payloads and credentials. A subscribed user's Telegram ID is stored privately in the existing database for delivery, not exported to public API responses.

Migration0013 adds new tables and an enum; all historical migrations0000–0012 stay unchanged. Do not auto-migrate production, backfill subscriptions, alter the frozen reward worker, change secrets, or send test messages without the separately approved live scope. The old API remains compatible with this additive schema; an API-only rollback retains the new tables and consent/evidence rather than deleting production data.
