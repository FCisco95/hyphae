# Participant onboarding for the existing MYCEL pilot

**Status: proposed, reviewable design; not implemented or deployed.** Based on [the `/link` verdict](2026-10-03-link-platform-verdict.md), written first, and [fresh read-only observations](../../handoffs/2026-10-03-onboarding-preparation.md). The phone path is a release dependency, not assumed working. No new rewards, custody, registration or SDK policy is decided here.

## Outcome and boundaries

A member arriving from the existing registered Telegram pilot can identify the community, find its official surfaces, link their own wallet in a compatible browser, pass the pinned rules test, submit genuine work and understand the evidence required before payment. A coordinator can explain each blocked step without taking signing or reward authority.

Reuse the registered community with mint `HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg`; preserve UUID, registered chat, members, epochs and chain identity. The founder reports an existing MYCEL Telegram Community with Buy Calls/Safeguard, Trenches, Raid Team/Raidar, Announcements and a two-member Mycel Testers group including one external tester. **Owner screenshots now show Hyphae Lab and Mycel Testers are separate chats**, and the MYCEL list has two Mycel Testers entries. Lab shows historical Hyphae/MYCEL bot replies. Exact database chat identity still needs the operator preflight; the screenshots do not prove current bot health or phone signing. Recommend keeping the registered Lab and placing that existing chat in the MYCEL Community if Telegram offers it, then inviting the tester there; no replacement registration. Owner screenshots now establish Cisco owns Lab and the bot is admin; the September 24 handoff recorded it as basic. If still basic, Community placement may need an in-place supergroup upgrade and automatic chat-ID migration; see [the guarded placement plan](../plans/2026-10-03-lab-community-placement-operator-plan.md). Current type remains unconfirmed, and no upgrade is authorized by this design. Do not assume Testers or Raid Team is the registered chat, move the registration, or invent same-mint multi-chat support. The schema makes both mint and chat unique ([schema](../../../packages/db/src/schema.ts)). Other groups may carry an owner-approved pointer to the registered pilot; they do not gain reward intake by association.

Production still says **Hyphae Lab**. The [conditional display-name operator plan](../plans/2026-10-03-mycel-display-name-operator-plan.md) corrects this one record to **MYCEL** later under explicit mutation authorization. No replacement community. Other communities render their own API name and mint; neither a default community nor MYCEL text replaces fetched data.

## Presentation and current components

Reuse `CommunityView`, `EpochView`, contribution/leaderboard views and the existing `Panel`, `ButtonLink`, `StatusPill`, `Stats` and `AsOf` patterns in [views](../../../apps/web/components/views.tsx) and [UI](../../../apps/web/components/ui.tsx). Reuse typography, spacing, mobile table stacking and brand components; no new design system or logo. The historical [390px mobile](../../community/2026-10-02-epoch-2-mobile.png) and [desktop](../../community/2026-10-02-epoch-2-desktop.png) screenshots establish existing empty-state presentation, not a proposed UI preview or current phone-wallet proof.

```text
Community
MYCEL                         [Pilot]
Powered by Hyphae
Reward intake open · Epoch 2 · closes Oct 9 00:00 UTC
Data as of <actual API timestamp>

Start here
1 Join the registered pilot    [verified invite, when supplied]
2 Link your wallet            Send /link in that group
  On a phone: sign in your wallet app's browser
3 Read this epoch's rules     [current epoch] · then /rules in group
4 Submit your own work        [current epoch contributions]

Scores explain contribution quality. Points are provisional.
No payout exists for this epoch. [actual settlement state]
Need help? <verified owner-supplied contact, when available>
```

This is a layout proposal. Until the stored-name correction is read back, its heading must be **Hyphae Lab**, with a short clearly labeled naming note if needed; never show a fake live MYCEL name. “Powered by Hyphae” is attribution, below the community name. “Pilot” is a status badge configured for this pilot, not part of a community name, not a second brand and not a default for every community.

A small server-side presentation map keyed by exact mint holds optional **verified invite, support URL and pilot status**. It carries no name override, secret, private chat ID or rewards setting. Missing configuration produces ordinary generic guidance; it does not expose a fabricated invite. Owner values must be supplied and checked before enabling their actions. Shared components receive optional presentation data rather than testing for MYCEL. Official publishing-account verification belongs to the operator record/guide; no social feed or publication integration is added.

## Verified links in both directions

The existing public community/epoch/leaderboard paths are HTTP-verified in the receipt. The configured bot URL is `https://t.me/hyphaeprotocol_bot` ([links](../../../apps/web/lib/links.ts)); its ownership, group presence/permissions, invite destination and Telegram pins need the owner read-back. They are **not** all independently verified by an HTTP 200.

Before activation, the owner/coordinator opens each link as the tester: group pin/description → canonical `/c/<mint>` → verified group invite and official bot → **the same registered group**; epoch and leaderboard stay under that mint. Record date, link destination and owner approval privately where chat/member data is involved. An invite must be checked for expiry/rights and correct group. Do not reuse a wider MYCEL Community invite as the registered reward-group destination without checking.

“Link wallet” explains **send `/link` in the registered group**. A website cannot mint a link session or identify the Telegram member; the current public community API exposes no registration UUID for a `start=link_<UUID>` action. A plain bot link is a convenience beside the instructions, not a one-click signed-wallet action. “Read rules” points to the current epoch's pinned rules plus group `/rules`; no invented website quiz or self-service registration form. With no open epoch show that state instead of guessing epoch 2 indefinitely.

## Wallet linking and the phone dependency

The actual journey is group `/link` → private bot `/start` → membership check → fifteen-minute URL → wallet-browser connect → five-minute readable proof → server verification → `/me` confirms a signed wallet. The existing page discovers only Wallet Standard `standard:connect` and `solana:signMessage`. It has no bridge to an installed native wallet, and no provider means no signing button. Desktop external-browser extensions may work; mobile system browser success remains unknown.

**Required pattern: hand-off-to-wallet-in-app-browser.** Reuse the private link instead of adding a Telegram Mini App or changing the SDK. On the API signing page, preserve the original validated token in memory when stripping the fragment. Offer **Copy my private wallet link** by explicit click, reconstructing only `<exact current API origin>/link#<token>`; explain how to paste it into the installed wallet's own browser. Provide a selectable copy fallback only after user action when Clipboard API is unavailable. Never use the stripped address bar, local/session storage, query parameters, analytics, logging or automatic redirection. Do not put bearer links on Vercel pages or community pins.

When no wallet is found, show the copy action, three short wallet-browser steps and the expiry/restart instruction. On Desktop, give equivalent advice for a browser with a compatible extension. Optional named vendor browse buttons are a **later dependency**: enable only after attended Phantom/Solflare tests establish both Wallet Standard message signing and fragment-preserving behavior on the target device, with current official vendor documentation and a security review. A vendor's universal-link fallback can expose the inner URL; a copy action is the bounded default here, not proof all vendor routes are safe. No injected adapter, deeplink signing, Mobile Wallet Adapter or WalletConnect is introduced by this plan.

Keep explicit connect/sign clicks, the existing server-issued message and exact-byte check, server expiry/single-use enforcement and `/status` reconciliation. Success names the shortened wallet and tells the tester to return to their own Telegram `/me`. Relinking does not change the wallet frozen for an already closed epoch. Cancelled signatures offer a deliberate retry/restart; never resend a proof automatically. Missing/expired token, wallet taken and service uncertainty remain distinct states. Reload loses the in-memory bearer link: return to the original bot message or get a fresh `/link`, rather than adding browser persistence.

**Release dependencies:** an attended fifteen-minute Hyphae phone test with the existing external tester; compatible wallet/browser confirmed; account/link-source warning reviewed. In the private-link flow, a forwarded link can bind a signer to the issuing member. SDK 0.1.0's message does not name that Telegram account. Copy affordances do not solve this residual. Do not claim Sentinel's confirmation-code protection exists here. A new server-backed account-confirmation protocol requires a separate bounded security design, files/authorization and review; it is not silently added to this UI plan. Recruitment remains parked until the phone journey is proven and the owner has considered that residual.

## Rules, score explanations and eligibility

The group `/rules` deep link runs a private test after a member exists, resolves the latest epoch's pinned rubric, and records a pass for that Telegram member ([rules command](../../../apps/api/src/bot/commands/rules.ts)). For MYCEL 1.2.0 all **six answers** must pass **strictly before October 9 00:00Z**. A static dashboard cannot read private quiz progress; show instructions, not fabricated completed checkmarks. Unsupported current rules say “No rules test available; ask the owner,” never reuse MYCEL questions for another community.

Explain alongside existing contribution evidence: raw quality is the model's 0–100 assessment; credited quality applies the pinned code rules; hard-zero flags override raw score, AI caps and floor 60 apply; timing/effort then give exact point units, aggregated/rounded whole points. Preserve reasoning, rule, rubric version and correction history. Pending means no decision yet; provisional means an open epoch; excluded/corrected needs the actual reason/revision; final refers to the immutable snapshot, not guaranteed payment. Free-form text is assessed independently; URL submissions select the latest active task. Keep one active pilot task and show/confirm its brief before submitting ([submit](../../../apps/api/src/bot/commands/submit.ts)).

Payment additionally needs positive points, a signed wallet valid at close, the pinned rules pass, the holder gate and clean author/duplicate/safety audit; then publication and a claim by that wallet. The current raw hold threshold is **100,000,000,000 MYCEL units**, with post-close observation in the existing 24-hour window. Do not ask users to buy or promise returns. Read every value from the pinned config where available; do not hardcode MYCEL's gates into generic views. Existing settlement views remain the authority: no settlement, blocked, unavailable, published/claimable and paid are distinct. Paid requires a confirmed claim transaction. `/claim` signs a transaction later; `/link` only signs a free readable message.

## Coordinator and empty/error/mobile states

One coordinator welcomes willing testers, verifies the path/pins with Cisco, explains `/link`, `/rules`, `/me`, evidence and deadlines, and maintains a private minimal issue list: blocked step, relevant evidence and owner escalation. They cannot register communities, open admin tasks unless they are the registered admin, attest another author's identity, correct scores or publish. No seed phrase, bearer URL, signature or unnecessary personal data in support. Two Telegram members and one external tester are founder-reported membership, **not scored contributors or paid uptake**.

Empty epoch: “No contributions yet” and existing no-payout sentence, actual timestamp and actionable instructions; no fixture leaderboard or dummy reward value. API unavailable: existing `UnavailableView`, never zero or cached success without its timestamp. Unregistered group, non-member, expired link, unavailable rules, unreadable X evidence, duplicate/wrong kind, paused intake and unknown score outcome have a bounded next action; ask the owner when evidence/policy is needed. No invitation/support input means the corresponding action is absent with honest owner-contact guidance.

At 320/390px and desktop, headings/wallet addresses wrap, actions stack, table labels remain readable, no horizontal overflow; 44px tap targets, visible focus, keyboard order, descriptive link labels, sufficient contrast, status region announced, no meaning conveyed only by color. Test light/dark themes, 200% zoom and screen-reader status/error announcements. Copy only on click and restore focus to its control after transient feedback.

Anti-phishing copy: **“Use only your own private link from the official bot. Never open a forwarded wallet link. Check the exact API domain in your wallet browser. `/link` asks for a readable message and moves no funds; cancel any transfer, approval or seed-phrase request. Never forward this link or send it to support. After linking, check your own `/me`.”** Official domains/invite/contact are owner-verified inputs; no look-alike convenience domains.

## Acceptance and next work

The [bounded plan](../plans/2026-10-03-participant-onboarding-plan.md) separates generic UI, the phone fallback and MYCEL configuration. [Raid ownership](2026-10-03-raid-system-decision-memo.md) is an unresolved founder policy choice; no campaign/intake change follows this design. The [October 8–9 packet](../../demo/2026-10-08-first-payout-readiness.md) remains canonical. No implementation, deployment, database rename, Telegram branding or social publication is authorized by this document alone.
