# Bounded participant onboarding implementation plan

**Status: planning only; no implementation in the October 3 arc.** Depends on [the design](../specs/2026-10-03-participant-onboarding-design.md) and [platform verdict/test](../specs/2026-10-03-link-platform-verdict.md). An approved implementation prompt must identify release scope; deployment and live metadata remain separately authorized. SDK **exactly 0.1.0 through October 12**, frozen reward/scoring/program behavior, and unmerged rules/Jev remain boundaries.

## Dependency gates before activation

1. Run the owner-attended fifteen-minute test with the external tester's own account/wallet. It creates link/proof/member records, so this planning authorization does not execute it. Record Android actual URL-opening surface, system browser and wallet browser separately. Test iOS if available; otherwise label unsupported/unproven, never advertise iOS PASS. **Recommendation: test the installed wallet-browser path first after recording Telegram's failure**, because the current bearer link already works across browsers by contract.
2. If no tested wallet browser registers both required features, **park the phone release and recruitment**. A new injected adapter, vendor deeplink signing or confirmation protocol needs a separate reviewed design; do not change the SDK to meet a deadline. Sentinel WR-01 and its vendor probes remain a separately owned cross-repo dependency in the founder's launch plan; this plan neither fixes nor clears Sentinel. Hyphae's existing session does not depend on Sentinel's new cookies/handoff routes.
3. Cisco supplies the genuine registered-group invite, support contact URL, official publishing account URL and confirms the registered pilot's relationship to the existing MYCEL group set. Verify the bot identity/membership/rights and actual link round trip. **Recommendation: preserve the registered chat**, rather than silently registering Testers or Raid Team.
4. Resolve [raid ownership](../specs/2026-10-03-raid-system-decision-memo.md) before recruitment. **Recommendation: one disjoint Hyphae paid brief in the existing registered chat**, leaving Raidar campaigns separate. No retroactive duplicate/exclusion policy is implied.
5. Before releasing wallet UI changes, obtain the required fresh other-family review in a separately authorized session; address findings with meaningful tests. No helper/reviewer was run during this docs-only arc. If expanded account-confirmation is required by review, park it rather than implement an unlisted server/DB change.

## Exact prospective writable files

These are ownership limits for a **future authorized implementation**, not permission to write them in this session. New files are explicitly marked. Everything else, including API schemas/routes/store/session, DB/migrations, reward jobs, SDK package/lockfile, chain code, vault, Organic, Sentinel and public-program repo, stays outside this bounded implementation.

| Responsibility | Exact files |
|---|---|
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

**Done:** the copy affordance does not lose the bearer fragment, preserves security invariants, and a real phone journey passes. Mock Wallet Standard tests alone cannot clear this gate. The forwarded-link residual remains explicitly recorded; no confirmation code/account display is claimed.

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

Do not deploy by convenience into the dated money sitting. C14–C18 stay October 8; intake pause **23:00Z**, final C18b **after 23:45Z**, all author/duplicate corrections accepted **strictly before October 9 00:00Z**. After **00:00Z**, close/snapshot/hold/safety gates precede Ledger publication, genuine claim and P14. Empty/no-payable/unknown-availability remain honest outcomes. Frozen deployment and any proposed UI rollout must be reconciled explicitly at the next authorized implementation session.
