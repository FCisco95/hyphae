# Place the existing Hyphae Lab in MYCEL's Telegram Community

**Current continuation — October 4:** source/checkpoint `e5ee300d6ce65231ec2325fef60be1f1ecbcba05` contains completed, independently reviewed T/A/B onboarding and operator-assisted setup. Both remain local-only, unpushed/undeployed. The owner-doc patch is applied. Next gate: combined release/target preflight, genuine owner inputs and separately authorized attended phone/setup/live scope; no rebuild of accepted source. [Current handoff](../../HANDOFF.md).

**Prepared only; no Telegram, database or account-setting mutation executed.** Ownership is settled: Cisco created Lab on September 17, and the supplied group-info screenshot shows Cisco as owner and Hyphae as admin; its two members are owner and bot. Mycel Testers is a separate chat, not the registered Lab. Do not ask Cisco to establish ownership again.

## Evidence and diagnosis

- The [September 16 build-log entry](../../BUILDLOG.md) records the bot provisioned as admin of the Hyphae Lab test group. The [September 24 checkpoint](../../handoffs/2026-09-24-afternoon-session-end.md) explicitly required keeping Lab a **basic group until deployment**, because upgrade handling was not live yet.
- [Telegram's current documentation](https://core.telegram.org/tdlib/options) describes Community chat capacity in terms of **supergroups and channels**. Basic-group type is therefore the leading explanation for Lab being missing from the owner's Add a Chat picker. **This remains an inference:** no fresh `getChat.type` was read, and the read-only GUI inspection stopped after Orca twice reported `window_not_focused`, including after the guide's one permitted restore retry.
- [Telegram migration](https://core.telegram.org/method/messages.migrateChat) upgrades a basic group to a supergroup. The [Bot API](https://core.telegram.org/bots/api#message) reports old/new identifiers through migration service messages. Hyphae already handles both in [chat-migration](../../../apps/api/src/bot/chat-migration.ts), wired in [bot registration](../../../apps/api/src/bot/index.ts). Existing tests cover same-row migration, replay no-op, unrelated groups and collision refusal. Accepted September 24 cutover includes the handler; no fresh Fly inspection was made here.
- The screenshot's September 17 `/link <address>` and unregistered-chat replies are historical prototype messages, not current signed-link instructions or a fresh production contradiction. Current `/link` uses a private message-signing flow. No owner/tester secrets or raw screenshots belong in the receipt.

## Read-only preflight, required before any upgrade

Using the existing configured bot and authorized read-only database connection, privately select the single community row by mint `HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg`: UUID, registered chat ID, name, admin, chain binding, rubric/config references and member/epoch counts. Require one row. Do not guess the chat ID from the screenshot or rerun seeding. Neither credential connection is available in this checkout today.

Call **`getChat`** for that exact registered chat ID with the existing bot, without putting its token in shell arguments, logs or receipts. Read only type/title, bot membership/admin status and owner identity. Ownership is already established; this is a technical identity/type check, not a repeat founder question. If type is `supergroup`, **do not upgrade**: inspect Community eligibility/client behavior instead. If `group`, the basic-group diagnosis is confirmed. Any target/bot mismatch parks the operation.

Verify the webhook and deployed migration handler are current and healthy; retain its prior accepted review, but require current operational reads before relying on automatic migration. Record a preflight baseline without public Telegram identifiers. Public API/community/epoch reads remain available even while Community placement is unresolved.

## Future owner-attended action and read-back

**Requires a new concrete authorization covering the Telegram upgrade and its automatic one-row database effect.** This planning prompt does not supply it. Upgrade the **existing** basic Lab in place through an explicit supported Telegram control; do not change public/private visibility, enable unrelated features, create another chat or change invite permissions merely to force conversion. The exact control remains uninspected; do not invent a sequence of toggles. If the client lacks an explicit control, park that path rather than making an unrelated setting change.

After migration, record old/new chat IDs privately and verify the existing Hyphae handler moved the **same community UUID** to the new ID. Mint, members, epochs, configs, chain binding and reward policy remain intact; other communities remain untouched. Duplicate Telegram service delivery is a no-op. On a target-ID collision, the handler refuses and logs a conflict: stop for operator review, never overwrite another row. On uncertain delivery, read back the row before retrying; no blind manual update or replacement registration.

With separate authorization for Community placement, reopen the owner's Add a Chat picker and choose that same upgraded Lab if available. Verify its linked MYCEL Community and retained history/member/bot setup. Community placement can affect discovery/joining: the owner must choose visibility. **Recommendation: keep the pilot hidden from other Community members until the phone path passes**, then deliberately expand intake; visibility is not approved by this plan. Adding Lab must not register Raid Team or either Testers chat for rewards.

Under the attended test authorization, the owner sends fresh `/me` and `/link` in that exact chat; require correct community identity and private signing flow. Then invite the existing external tester and perform the separate fifteen-minute phone test. These messages are not sent by this docs-only session.

## Recovery, limits and validation

Do not promise that an upgrade can be reversed to the old chat ID. If read-back fails, preserve the upgraded chat/history and park intake/placement work for diagnosis; any database repair is a separately reviewed, guarded operator action. Do not recreate Lab or delete a community. An approved removal from the Telegram Community is distinct from reversing the upgrade or reward registration.

No runtime implementation or new schema is needed by this plan. Before executing, recheck existing migration tests and the full local gate; record private identity read-backs and public-safe counts/verdict. SDK stays 0.1.0 through October 12, rules/Jev unmerged, and all October 8–9 money/author-audit gates unchanged. Bot-menu polish can be prepared independently of Community placement; no broad recruitment until phone linking is proven.
