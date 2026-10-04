# Bounded participant onboarding implementation plan

**Current continuation — October 4:** source/checkpoint `e5ee300d6ce65231ec2325fef60be1f1ecbcba05` contains completed, independently reviewed T/A/B onboarding and operator-assisted setup. Both remain local-only, unpushed/undeployed. The owner-doc patch is applied. Next gate: combined release/target preflight, genuine owner inputs and separately authorized attended phone/setup/live scope; no rebuild of accepted source. [Current handoff](../../HANDOFF.md).

**Status: approved local T/A/B candidate built and independently reviewed through 8841a01; unpushed/undeployed.** Depends on [the design](../specs/2026-10-03-participant-onboarding-design.md) and [platform verdict/test](../specs/2026-10-03-link-platform-verdict.md). An approved implementation prompt must identify release scope; deployment and live metadata remain separately authorized. SDK **exactly 0.1.0 through October 12**, frozen reward/scoring/program behavior, and unmerged rules/Jev remain boundaries.

## Dependency gates before activation

1. Run the owner-attended fifteen-minute test with the external tester's own account/wallet. It creates link/proof/member records, so this planning authorization does not execute it. Record Android actual URL-opening surface, system browser and wallet browser separately. Test iOS if available; otherwise label unsupported/unproven, never advertise iOS PASS. **Recommendation: test the installed wallet-browser path first after recording Telegram's failure**, because the current bearer link already works across browsers by contract.
2. If no tested wallet browser registers both required features, **park the phone release and recruitment**. A new injected adapter, vendor deeplink signing or confirmation protocol needs a separate reviewed design; do not change the SDK to meet a deadline. Sentinel stays PARKED under F-13; WR-01 is not a Hyphae build dependency. Only if Hyphae's attended phone path fails and pattern validation is needed may the already conditionally approved isolated probe inform a Hyphae-owned design. No Sentinel implementation, review, push or service reopening follows from that result. Hyphae's existing session does not depend on Sentinel's new cookies/handoff routes.
3. Cisco supplies the genuine registered-group invite, support contact URL, official publishing account URL and verifies the exact registered chat before any live change. Owner screenshots resolve that Hyphae Lab and Mycel Testers are separate; the two Testers entries must not be confused. Ownership is established; the September 24 basic-group record means Community placement must follow [the separate upgrade/placement plan](2026-10-03-lab-community-placement-operator-plan.md), with live type checks and migration read-back, not a guessed UI toggle. Verify the bot identity/membership/rights and actual link round trip. **Recommendation: preserve the registered chat**, rather than silently registering Testers or Raid Team.
4. **Settled:** disjoint Hyphae paid briefs in the registered chat, Raidar campaigns separate, one active brief and hidden pilot until phone PASS. Recruitment still requires the real phone/input/live gates; no imported points or retroactive duplicate/exclusion policy.
5. **Review complete locally:** reuse accepted split T/A/B ranges through 8841a01 and setup range 072e99b..cd4c4ef. Fresh other-family review is needed only for new sensitive deltas. Publication still requires the complete current local gate, including DB consistency and API real-Postgres checks. Expanded account-confirmation is outside this arc.


## Research/document gate — complete; preserve on continuation

Carry `docs/superpowers/specs/2026-10-03-project-alignment-and-document-hygiene.md` into each handoff. The owning Brain sync reconciles shared docs; this repo completes its engineering-document pass. Reuse the dated source table and primary-source checks from Brain's October 3 post-ship report, then verify relevant current code/refs. Preserve historical receipts and separate confirmed, prior-receipt, unknown and proposed claims. The prepared owner-doc patch, including WHITEPAPER rules/hold and Sentinel dependency corrections, is already applied. The original requirement retains dated proposal wording; the completed participant/setup receipts and this continuation own current status. Recheck changed evidence, preserve unknowns and historical receipts. This preparation authorizes no new runtime or live change.

## Milestone T — explicit professional Telegram welcome and guidance (complete locally)

T, A and B were explicitly approved and completed locally. The historical file contract and acceptance steps below record that implementation; they are not a new build queue. Deployment/messaging and real phone evidence remain separately gated.

**Prospective writable files:** existing `apps/api/src/bot/index.ts`; new `apps/api/src/bot/commands/onboarding.ts`, `apps/api/src/bot/commands/onboarding.test.ts`, `apps/api/src/bot/commands/onboarding-content.ts`, `apps/api/src/bot/commands/onboarding-content.test.ts`; `docs/community/OPERATING-GUIDE.md`, `docs/HANDOFF.md`, `docs/BUILDLOG.md` and the normal dated receipt. Keep existing link/rules/member/reward handlers and migration/SDK files outside this presentation scope. Any required handler change is a specific scope extension before code.

1. Prepare one contextual Start here card and `/help` route; preserve private `/start link_…` and rules deep-link dispatch before generic welcome. In the existing registered community, show its stored name plus Powered by Hyphae and configured Pilot status. Private/unregistered context gets a safe explanation and verified group route if known; never guess a community, register another chat or display member-specific data there.
2. Define working controls for Link wallet, Rules, My progress/score, Current brief/audit and Help. Route through existing membership/context checks, not public bearer links or a new auth system. Rules uses the pinned epoch's existing private quiz; My progress reuses `/me`, and the current brief respects the latest-active-task limitation. Show no invented brief, score, completion or payout. Missing verified invite/support values remove the corresponding action. Public score guidance contains no other member's private state.
3. Explain own-account work, evidence, the pinned rubric and raw versus credited points; distinguish score, payable allocation, published claim and paid receipt. Describe rules 6/6, verified wallet and existing hold/author/safety gates without changing policy. `/link` is a free readable message; later `/claim` is a transaction. On no-provider phones instruct use of the ORIGINAL private bot URL in a compatible wallet browser; no seed/approval request and no forwarding.
4. Define the participant command-menu labels alongside the copy, and prepare an owner-reviewable welcome/pin/menu packet. Do not auto-call `setMyCommands`/`setChatMenuButton`, change BotFather settings, greet new members automatically, send or pin a group message under local implementation authorization. Those are separate live actions, with identity/read-back and rollback in the release packet. Existing Safeguard/Raidar operation remains independently owned.
5. Acceptance: meaningful routing/rendering tests prove private link/rules starts remain first, registered vs private/unregistered/cross-community context is safe, every button has a real destination/action, missing URLs fail closed, score/payment states remain distinct, callback input cannot leak bearer/member data, and plain command fallback remains usable. Verify short mobile copy, readable labels and no silent dead button. No new dependency, database field or reward behavior for presentation.

**Done:** a reviewed local candidate welcome/help/control set plus operator packet exists. It is not a deployed menu, pin, Community placement, rename, recruitment or real phone PASS. Generic T/A can proceed after explicit build-scope approval independently of group placement and missing MYCEL links. B remains wallet work with fresh other-family review; activation waits for a real own-account phone PASS and the operator dependencies.

## Exact prospective writable files

These are the exact ownership limits for the October 3 approved local implementation. Historical proposal wording does not authorize additional files or live effects. New files are explicitly marked. Everything else, including API schemas/routes/store/session, DB/migrations, reward jobs, SDK package/lockfile, chain code, vault, Organic, Sentinel and public-program repo, stays outside this bounded implementation.

| Responsibility | Exact files |
|---|---|
| Telegram T presentation and routing | `apps/api/src/bot/index.ts`; **new** `apps/api/src/bot/commands/onboarding.ts`, `apps/api/src/bot/commands/onboarding.test.ts`, `apps/api/src/bot/commands/onboarding-content.ts`, `apps/api/src/bot/commands/onboarding-content.test.ts` |
| Generic community onboarding presentation | `apps/web/components/views.tsx`, `apps/web/components/views.test.tsx`, `apps/web/app/c/[mint]/page.tsx`, `apps/web/app/globals.css` |
| Validated optional presentation configuration | `apps/web/lib/community-presentation.ts` **new**, `apps/web/lib/community-presentation.test.ts` **new** |
| API signing-page copy handoff and error/retry UX | `apps/api/src/link/page/client.ts`, `apps/api/src/link/page/index.html`, `apps/api/src/link/page/handoff.ts` **new**, `apps/api/src/link/page-handoff.test.ts` **new**, `apps/api/src/link/page.test.ts` |
| Documentation and reviewed screenshots | `docs/community/OPERATING-GUIDE.md`, `docs/community/2026-10-03-onboarding-desktop.png` **new**, `docs/community/2026-10-03-onboarding-mobile.png` **new**, `docs/BUILDLOG.md`, `docs/HANDOFF.md`, `docs/handoffs/2026-10-03-onboarding-implementation.md` **new** |

Use actual implementation-date screenshot/receipt names if the future prompt approves that substitution. Do not rewrite the historical October 2 screenshots. No file needs parallel ownership or helpers in this arc.

## Milestone A — generic product UI

1. Add a minimal optional presentation record keyed by exact mint with `pilot`, verified Telegram invite and support URL. Validate HTTPS, expected invite host and complete destination; do not permit arbitrary URL schemes or token-bearing URLs. Unknown mint returns no presentation record. No name override; heading and metadata continue to use API data. **Initially no production MYCEL invite/support entry exists**, so absent inputs render honest guidance and no actionable placeholder.
2. The community route supplies that optional record to the pure `CommunityView`. Reuse existing `Panel`, `ButtonLink`, `StatusPill` and classes; retain epochs, intake, UTC timestamps and `AsOf`. Show the community's own name, attribution and configured Pilot badge. Add an ordered “Start here” region with join (only verified invite), group `/link`, phone/browser instruction, pinned rules/`/rules`, and current epoch contributions. Bot link can open the official bot but must state that `/link` starts in the registered group; no public API UUID/session assumption.
3. Resolve current epoch from response data, not a hardcoded 2. No open epoch → no current-epoch shortcut. Rules remain pinned on that epoch; no universal MYCEL quiz link, private completion state, login or checkbox pretending to know a member's progress. Use existing audit/settlement views for actual score/payment truth; add concise explanation and evidence links without inventing new API fields.
4. Tests: render MYCEL's stored old name and another unrelated mint/name without leakage; configured pilot versus absent status; missing/malformed invite/support values; no open epochs; paused intake; unavailable read remains unavailable, not zero. Check links stay under the selected mint and no action claims to create a session. Test score/payment distinction and existing settlement rendering regressions through `views.test.tsx`. No mirrored snapshot-only tests.

**Done:** UI works with generic fixtures and live-shape responses, preserves multi-community rendering, and no absent owner value can become a clickable placeholder. This does not prove real multi-community onboarding or scale.

## Milestone B — hand-off-to-wallet-in-app-browser

1. Extract a small handoff helper that validates the original 43-character token and builds the copy URL from the page's fixed current HTTPS origin and `/link`, never from arbitrary query/return/vendor parameters. `client.ts` captures token before `replaceState`; keep it only in memory. Copy is explicit and uses Clipboard API; if unavailable, reveal a readonly selectable field only after explicit user action. Clear feedback, accessible label, no automatic clipboard writes, external requests, storage or logging.
2. Add the original-link copy action and instructions to `index.html`/client alongside the existing wallet list and status region. With zero wallets explain wallet in-app browser; Desktop explains compatible external extension. With invalid token, disable/hide copy and offer return to the group's `/link`. Never offer the stripped address-bar URL. Warn not to forward and distinguish free message verification from later claim transactions.
3. Preserve Wallet Standard discovery, late registration, connect/sign APIs, exact bytes and existing `/request` → `/verify` → uncertain `/status` sequence. No automatic resubmission or changed SDK message. On connect/sign refusal, retain the handoff guidance and offer deliberate retry with wallet rendering; on `wallet_taken`, direct owner help; on expiry, fresh group `/link`; on uncertainty, `/me` check first. Reload does not persist the token: state that the original bot message or a fresh session is required.
4. Tests: copy includes the original fragment despite address-bar removal; refuses invalid tokens and non-HTTPS origins; explicit action only; Clipboard failure exposes a labeled manual fallback; token absent from logs/storage/network GET paths; no token copied from location after stripping. Simulate no wallet and late registration, signature cancel, expiry, taken wallet and unavailable outcome. Existing page/wallet/flow tests must continue proving message-only features, unchanged bytes and reconciliation without proof resend. Add a DOM/browser test inside the listed test file with existing tools where feasible; if a new harness/dependency is necessary, park it for explicit scope extension rather than editing a manifest.
5. Run the attended device matrix again against the candidate under separately approved deployment/test authorization. Copy-original-link → wallet browser → sign → `/me` must pass with the same member/wallet. Record OS/app versions and exact surfaces with private identifiers redacted. **No vendor buttons in this milestone**; a future vendor builder needs official documentation, device evidence and a new writable-file contract.

**Local candidate done:** the copy affordance preserves the original fragment and security invariants, with tests and fresh other-family exact-range review. **Activation done:** separately authorized real phone journey passes. Mock Wallet Standard tests alone cannot clear activation. The forwarded-link residual remains explicitly recorded; no confirmation code/account display is claimed.

## Candidate and release packet — October 3

**Approval recorded:** Cisco replied “yes” to the concrete local T → A → B scope and recommended disjoint Hyphae briefs/Raidar separate, one active brief and hidden pilot until phone PASS. No owner URLs, read-only credentials, attended phone-test scope or live-effect authorization was supplied.

This is the approved and locally completed scope: **T, then A, then B**, using only the table above and normal engineering documentation. All three are approved and complete locally; authorize each live effect separately from concrete release rows. T/A are independently buildable with fixtures while phone/type/owner URLs wait. The recorded approval authorizes local implementation only; deployment, attended testing and Telegram operations remain separate. The [alignment receipt](../../handoffs/2026-10-03-onboarding-scope-packet.md) records the completed document gate and source limits. Recheck changed refs/code/platform guidance before a later build; do not repeat unchanged accepted sensitive reviews.

### T: concrete welcome, destinations and context

Use one short Start here card on generic `/start`, and `/help` for fuller rules/score guidance. Preserve the current private dispatch in `index.ts` verbatim in order: **`linkStart` first, `rulesStart` second, generic welcome last**. Keep migration middleware first. No automatic join greeting or startup API mutation. Register only the new `/help` presentation handler; do not intercept `/link`, `/rules`, `/me`, `/submit`, `/effort`, `/raid` or `rt:` callbacks.

Proposed registered-chat card (stored name, not a MYCEL override):

```text
Hyphae Lab
Powered by Hyphae · Pilot [only if configured]

Start here
/link — Link your own wallet privately. This signs a free message.
/rules — Read and pass this epoch's rules in the private bot chat.
/me — Check your wallet and this epoch's progress.
/help brief — Read the current brief and open its audit.
/help — How scores and payment work.

Work and evidence appear in the public audit. Points do not promise payment.
On a phone, use your ORIGINAL private bot URL in a compatible wallet browser.
Never forward it or send it to support. Return to your own /me after signing.
```

The candidate uses a small, one-time reply keyboard with exact command text. The card supplies readable descriptions; no friendly-label text that an existing command handler would ignore. T needs no new callback protocol. Existing private quiz callbacks remain owned by `rules.ts`. Plain typed commands remain the fallback when a client cannot show the keyboard. Keyboard/command activation still requires separately approved deployment and an attended Telegram check.

| Control / sample destination | Real action and guard |
|---|---|
| Link wallet: keyboard `/link` | Existing group handler resolves that chat's row, then returns `https://t.me/<actual bot username>?start=link_<same row UUID>`. Its existing private start checks Telegram membership before issuing the bearer URL. UUID/bot binding are operator inputs, not invented sample IDs. |
| Rules: keyboard `/rules` | Existing group handler returns the private `start=rules_<same row UUID>` link. Existing rules start requires that community's member and pinned test. No universal quiz, website completion badge or bypass. |
| My progress: keyboard `/me` | User sends the existing command in that registered chat; existing handler scopes by sender and community. T never calls it with a synthetic callback context or puts somebody else's summary on the welcome. Its existing reply is in the group; do not promise private score output. |
| Current brief/audit: keyboard `/help brief` | New read-only presentation branch resolves the chat, selects the latest task with `status=open`, `closes_at > now`, ordered by `opens_at DESC`, matching `submit.ts`. Show actual brief/target/window and permanent community audit URL. No task → “No active brief”; no open epoch → no epoch shortcut. No task creation, scoring or submission. |
| Score help: keyboard `/help` | Public explanation, pinned epoch/rubric if present, command fallbacks; no member query or private result. Unexpected help arguments produce usage, never arbitrary query/URL routing. |
| Community audit sample | `https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg`; runtime uses configured `PUBLIC_WEB_URL` plus the resolved mint. Check its actual production value before activation. |
| Current epoch sample | `https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2`; runtime derives the open epoch, never permanently assumes 2. |
| Optional Join / Support | Omitted until the genuine destination is verified for the resolved community. No clickable sample invite or contact value. T initially carries no production per-mint owner URLs/Pilot configuration; the A configuration is web-only, not an API import. Adding API configuration later needs an exact file-scope amendment. |

Private generic start/help has no chat-to-community binding: explain that commands begin in the registered group, show no community-specific keyboard, name, brief, member data or guessed MYCEL context. A verified group route may be shown only if a later approved input unambiguously supplies it; initially it is absent. Unregistered group: explain registration is operator-assisted, show no rewards actions and never upsert a community/member. Another registered group gets its own name/mint/task/config, without MYCEL URLs. Read failure is unavailable, never “zero points” or “no brief.” Senderless/channel updates cannot produce a personal journey. Render untrusted names/briefs safely as plain text; public help asks for no token, signature, seed phrase or private author evidence.

### A and B: exact implementation tasks and checks

For each task: add the behavioral test in the named file, run it and record the failing result, implement the smallest change within the contract, rerun and record PASS. Reuse the repository's Vitest conventions; no harness/dependency/script change is approved. Then complete the manual candidate checks. Commit T/A independently before B; do not push B until its fresh other-family exact-range review is accepted.

| Task / files in contract | Meaningful verification |
|---|---|
| T content + handler + index wiring, `onboarding-content.test.ts` / `onboarding.test.ts` | Feed real grammY-shaped mocked updates through exported composition/wiring: private link/rules starts each run before generic reply; plain `/start` and `/help`; every keyboard payload reaches the intended existing command; unknown help arguments fail safely; private/unregistered/other-community/senderless/error cases. Assert no session, member, task, pass, model or payment write from generic help. A forged `rt:` callback cannot be handled by T or leak bearer/member data. Missing inputs omit actions; escaped hostile name/brief stays text. Current brief uses the same active-task restriction, absence and outage distinct. |
| A optional map, `community-presentation.test.ts` | Exact mint lookup; valid complete HTTPS invite/support only, no credentials, bearer fragments/query values, look-alike invite host, arbitrary scheme or name override; unknown mint/missing values omitted. No production owner values initially. |
| A route/views/CSS, `views.test.tsx` | Old stored Hyphae Lab name and unrelated mint remain correct; optional Pilot; selected-mint paths; current/no-open epoch; pause/unavailable. Render score vs allocation vs claimable vs paid separately using existing fixture states; paid requires the existing claim transaction. No new community API settlement fields invented. |
| B helper/client/HTML, `page-handoff.test.ts` / `page.test.ts` | Capture original valid 43-character token before stripping history; build only the fixed current HTTPS origin plus `/link#token`; reject malformed token, origin credentials, non-HTTPS and injected return/vendor URLs. Explicit copy only; clipboard rejection reveals readonly selectable fallback; no persistence, GET leakage, referrer/analytics/logging, auto-connect/sign/navigation. Preserve current strict CSP/no-store/no-referrer and no inline script/style. |
| B retry/copy/error paths, `page-handoff.test.ts` | No wallet/late registration; connect/sign cancel then deliberate retry; known expiry/consumed disables copy, restart via group; taken wallet → owner; uncertain commit → existing status reconciliation and own `/me` before new proof. Never auto-resend; success names shortened wallet and own `/me`. Test client DOM with available tooling; if impossible within contract, stop for a named harness extension. |

Historical implementation verification commands (files now exist; do not rebuild accepted source for this documentation arc):

```sh
pnpm --filter @hyphae/api exec vitest run src/bot/commands/onboarding.test.ts src/bot/commands/onboarding-content.test.ts src/bot/commands/link.test.ts src/bot/commands/rules.test.ts src/bot/commands/me.test.ts src/bot/chat-migration.test.ts
pnpm --filter @hyphae/web exec vitest run lib/community-presentation.test.ts components/views.test.tsx
pnpm --filter @hyphae/api exec vitest run src/link/page-handoff.test.ts src/link/page.test.ts src/link/page-wallet.test.ts src/link/page-flow.test.ts src/link/routes.test.ts src/link/session.test.ts src/link/store.test.ts src/link/wallet-links.test.ts
pnpm test
pnpm typecheck
pnpm lint
git diff --check
```

Existing sensitive tests above are regression runs, not authorized edits to their files. Compare SDK manifest/lockfile, message bytes, wallet/flow/session/store/routes, rules/scoring/reward/DB/program paths against the approved start. The only B edits are those in the ownership table. No confirmation protocol, identity text inserted into the signed message, adapter/vendor button or DB change. Forwarded-link account-binding risk remains: show own-link warnings and get owner consideration before activation; a blocker from review parks B rather than widening it silently.

Manual local candidate checks: desktop and 320/390px, both themes, 200% zoom, wrapping/no overflow, 44px targets, keyboard order/visible focus, status/error announcements, copy fallback selection and restored focus. Mocked-browser signing validates UI behavior only. Telegram keyboard rendering and Android actual message signing are separate attended device results; iOS stays UNKNOWN unless attempted. Screenshots use actual implementation date and are labeled local/fixture/preview/live; no private link or fake payment evidence.

### Rules and score help, without changing reward policy

Proposed help copy: “Raw quality is the model's assessment. Credited quality applies this epoch's pinned rules; the reason and correction history explain any difference. Timing and accepted effort determine exact point units, combined before whole-point rounding. Pending has no score yet; open-epoch points are provisional. Final points belong to the closed snapshot and are not SOL.” Show available pinned values; unsupported/unreadable rules direct the member to the owner, never MYCEL's quiz by default.

“A rules pass, positive points and a wallet verified at close are only part of eligibility. The existing holder, author/duplicate and safety gates also apply. Allocation states what was assigned; published/claimable needs publication; paid needs a confirmed claim receipt. `/link` signs a free readable message. `/claim` later signs a transaction.” For this pinned MYCEL epoch, existing rules require **6/6 strictly before close** and the hold threshold/window remain those in the money packet. No new reward tier, cross-Raidar exclusion, promised return or purchase instruction.

### Separate live effects, read-back and rollback

All rows below are **UNAUTHORIZED / NOT EXECUTED** in this document arc. Local implementation approval alone clears none of them. Missing access is UNKNOWN, not a deployment failure.

| Effect to authorize concretely | Required record / read-back | Recovery |
|---|---|---|
| Attended external tester phone test | Registered Lab, own Telegram/wallet, OS/app versions; actual Telegram, system-browser and compatible wallet-browser results separately. ORIGINAL private bot URL/fragment → unchanged free message → same wallet in own `/me`. No model call/funds. | Cancel/refuse safely; uncertainty checks `/me` before a new session. No link/member-history deletion; a wrong binding needs separate reviewed repair. Real FAIL parks activation; request conditional isolated pattern probe only if needed, Sentinel remains parked. |
| T API/Fly and A web deployment; B page/Fly deployment | Exact reviewed commits/artifacts, owner-approved frozen-runtime disposition, API + worker/image read-back, page/header/assets and selected-mint paths; no restart/deploy pulled into C14–C22. | Separately authorized revert to prior accepted artifact; keep records/sessions/SDK intact. Remove only optional presentation entry when appropriate. |
| Command menu registration | First read `getMe`, exact chat binding and existing `getMyCommands` per scope/language. Proposed private scope: `start` “What Hyphae does”, `help` “How to participate; begin in your group”. Proposed exact registered-chat scope: `start`, `help`, `link`, `rules`, `me`, `submit`, `effort`, with truthful labels below. Snapshot inherited/scoped lists before calling `setMyCommands`. | Restore exact prior list/scope/language; if previously absent, delete only that newly created scope and verify inherited behavior. Registration grants no authority. |
| Chat menu button / BotFather settings | Not needed for this candidate; no Mini App URL or wallet link menu. If later requested, name exact setting/target and capture old value first. | Restore the captured setting under separate authorization; no token rotation or username change. |
| One owner-reviewed Start here message and pin | Exact registered chat, final text/destinations, current name/epoch, previous pins and message ID; owner approves send and pin independently, including notification choice. Read back content, pin and links as tester. No auto-greeting. | Unpin only the new message and restore prior approved pin state. Message removal/edit and notifications require their own authorized disposition; no bulk deletion. |
| DB name correction / Telegram title-description | Use [name plan](2026-10-03-mycel-display-name-operator-plan.md), single guarded row; only name changes. Telegram branding is a separate target/action. Same UUID/mint/members/epochs/config/binding. | Guarded old-name restore; title/description restore from captured values. Generic UI always reads stored name. |
| In-place upgrade and MYCEL placement/visibility | Use [placement plan](2026-10-03-lab-community-placement-operator-plan.md) only if live type makes it relevant. Same UUID/mint/members/epochs/config; changed chat ID only as expected. Read-back bot/admin/webhook/handler and Community membership. | Upgrade has no promised reversal; preserve chat/history and stop on mismatch. Placement removal/visibility restoration is a separate effect; no replacement registration or blind DB repair. |

Registered-chat menu labels: `start` “Start here”; `help` “Rules, score help and current brief”; `link` “Link your own wallet privately”; `rules` “Take this epoch's rules test”; `me` “Your wallet and epoch progress”; `submit` “Submit your own work”; `effort` “Nominate substantial work”. Keep existing admin `/raid` handler and any previous admin scope untouched; no unsupported `/propose`, `/rubric` or `/claim` bot command added. `/help brief` is an argument, not a second menu command. Installation should be scoped to the registered pilot first, not replace the bot's global menu for other communities.

### Owner input and activation checklist

1. **Build decision — COMPLETE:** October 3 “yes” approves local T/A/B using this exact contract. No production MYCEL URLs required for generic T/A; activation and publication remain gated.
2. **Technical read-only access:** use an existing owner-configured connection, never paste secrets; require one registered row, exact bot/chat binding, current `getChat.type` and migration health. Current access/result is UNKNOWN. Ownership is settled; Testers stays separate. No upgrade merely because the old record said basic.
3. **Attended test:** separately authorize/attend the existing fifteen-minute external-tester Lab test. Android actual signing UNEXECUTED; iOS UNKNOWN. Phone PASS gates recruitment/activation, not T/A design. `/link` PASS does not establish C21.
4. **Owner values:** genuine registered-Lab invite, support and official publishing-account URLs, verified round trips/expiry/rights. Missing values remove actions; publishing URL is an operator record, no social feed/post integration.
5. **Operating choice — RECORDED:** disjoint Hyphae paid briefs with Raidar separate, one active Hyphae brief and hidden pilot until phone PASS. No imported points/retroactive rules; no live brief or visibility setting changed. Wider Community joining must not be confused with registered Lab access.
6. **Concrete live scopes:** approve only relevant rows above with targets, old values, exact commits/text and read-back. Desired MYCEL / Powered by Hyphae / Pilot; production remains Hyphae Lab. Deployment, name, upgrade, placement, menu, message/pin and activation are distinct effects. Absent input parks that effect while independent documentation/candidate work continues. Publish nothing from this arc without its authorization.

## Milestone C — MYCEL configuration, owner only

1. Obtain and verify genuine invite/support/publishing URLs; never commit `TODO`, example domains or fake `t.me` slugs as values that can ship. Supply only the verified per-mint presentation entry. Unknown inputs leave actions absent and final activation parked. The publishing account stays in the verified operator guide; no post is sent.
2. Owner read-only verifies the registered chat and its place in the existing MYCEL Community. Future Telegram pin/branding changes require explicit external-action authorization. Do not rerun the legacy seed script, replace the community, change the chat ID or grant a second chat the same mint.
3. Execute the separate display-name operator plan only when live DB-write authorization is supplied. Generic UI must already render whatever API name is returned; MYCEL is configuration/data, never a shared-code condition.

**Done:** round-trip group/bot/dashboard paths verified, stored name read back, and owner chooses any live group branding. Ship no claim that owner actions occurred just because code/config passed tests.

## Verification, accessibility and screenshots

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `git diff --check`; complete every required check without hook bypass. Because Milestone B changes wallet UX, its fresh independent review is required before push/release. No production scoring/evaluation experiments. Preserve SDK manifest/lockfile version and compare sensitive runtime paths with the approved baseline.

Render real empty state and honest unavailable/expired/no-wallet states at desktop and 320/390px mobile in light/dark mode; keyboard, screen reader status announcements, visible focus, 44px targets, 200% zoom and contrast. Confirm every URL/invite destination and no horizontal overflow. Reuse historical screenshots for baseline comparison; capture new screenshots only after candidate exists, label local/preview/live and the actual timestamp. Never include fragments, messages/signatures, member identities or fixture payment claims.

## Rollback and unchanged operator gates

Generic web UI/config rollback: revert the bounded UI commit or remove the verified presentation entry; keep real API name/epochs intact. Signing page rollback: revert only the page/handoff commit and redeploy the previously reviewed image **under separate deployment authorization**; existing sessions/proofs/history remain unchanged, and the original-bot-link fallback still applies. No schema migration, SDK rollback or refund mechanism is introduced. DB display-name rollback is the guarded old-name update in the separate plan; Telegram branding rollback is owner-controlled.

Do not deploy by convenience into the dated money sitting. C14–C18 stay October 8; intake pause **23:00Z**, final C18b **after 23:45Z**, all author/duplicate corrections accepted **strictly before October 9 00:00Z**. After **00:00Z**, close/snapshot/hold/safety gates precede Ledger publication, genuine claim and P14. Empty/no-payable/unknown-availability remain honest outcomes. Frozen deployment and the proposed combined rollout must be reconciled in the release packet before separately authorized deployment; implementation is already complete.

## Local completion checkpoint — October 3

[Implementation/review receipt](../../handoffs/2026-10-03-onboarding-implementation.md): T/A/B built and committed, 803 tests passed/1 skipped, typecheck/lint/build exit 0, local browser/keyboard/zoom checks pass. Fresh Opus5.5-high split exact-range reviews ACCEPT/no blockers through source 8841a01e8abdcec4398f1255a8ccd3d1c9423212. No push/deployment, real phone PASS or live effect. Owner URLs/access/attended test remain inputs; operating choices are recorded. Existing latest-epoch/latest-open-task behavior retained, task opening time displayed; keyboard selective and delayed clipboard fallback blocked during signing. Original private link/rules starts, SDK/message/reconciliation and DB/rewards/program unchanged.

## Combined release continuation — October4

The [single combined packet](../../demo/2026-10-04-combined-release-packet.md) now owns source/artifact/target pins, selected-effect approvals, timestamped technical preflight, phone matrix, private-manifest readiness, Organic consumer requirements and the one bundled input list. Both candidates remain complete at source/checkpoint **e5ee300d6ce65231ec2325fef60be1f1ecbcba05**, local-only. Prior latest gate851/1 skip + Postgres50/50 is prior evidence; no runtime tests/builds ran in this preparation. Current next gate: existing read-only access/genuine URLs and concrete publication/deployment/test/setup scope.

Fresh Oct4 public/API/site reads passed; internal Lab UUID/chat/admin/type/webhook/migration/Fly health remain UNKNOWN. Vercel production target/source is freshly confirmed, and main auto-deploy is enabled: source publication must account for its web deployment. Recommend coupled publication+selected web release and API-only image update with frozen v11 worker retained after preflight. No actual image build, push, deploy or configuration change.
