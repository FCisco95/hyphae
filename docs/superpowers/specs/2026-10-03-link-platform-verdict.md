# Can a Telegram participant sign Hyphae’s `/link`?

**Current continuation — October4, source/checkpoint e5ee300d6ce65231ec2325fef60be1f1ecbcba05:** The October3 trace below describes its earlier source baseline. Its “no copy/handoff control exists” statement is superseded by completed local B through8841a01; source B has ORIGINAL-fragment copy/selectable fallback, still unpushed/undeployed. Device surfaces remain UNKNOWN/unexecuted; founder wallet linking/historical scoring remain successful prior history. This is not C21 proof. Local-only stage; next gate is the [combined release/preflight and attended-input packet](../../demo/2026-10-04-combined-release-packet.md), not a new build or live operation.

Code-path verdict at `3a361e76801a78f0392ec0ca42dfb8ff1f1445d6`, October 3, 2026. **The participant’s wallet produces the signature in the browser opening the private URL.** No Hyphae device test ran here.

| Platform | PASS / FAIL / UNKNOWN | Required surface |
|---|---|---|
| Telegram Android internal browser without registered wallet | **FAIL by code; Hyphae device confirmation pending** | No wallet button/signature. Sentinel measured absence in its Mini App; Hyphae’s ordinary-URL webview is untested. Move the original bot URL into a wallet browser. |
| Telegram Desktop internal browser without registered wallet | **FAIL by code; actual opening behavior UNKNOWN** | Sentinel’s Mini App lacked providers. If Hyphae’s ordinary URL opens externally, that external browser’s compatible wallet extension decides success. |
| Mobile system browser | **UNKNOWN on device; FAIL without registered wallet** | Installed wallet alone is insufficient. No native bridge, injected fallback, WalletConnect or Mobile Wallet Adapter exists here. |
| Wallet’s mobile in-app browser | **UNKNOWN end-to-end; conditional PASS by contract** | Must register `standard:connect` + `solana:signMessage`, sign unchanged bytes, and commit server verification. Phantom/Solflare and iOS need testing. |

**Sentinel applies partially:** no-provider discovery fails identically, but Sentinel measured a Mini App; Hyphae already issues a portable bearer URL, needs no Telegram `initData` in the signing browser, and has a manual wallet-browser fallback. Neither iOS failure nor Hyphae’s complete phone journey was measured.

## Exact trace and evidence

1. [Bot command](../../../apps/api/src/bot/commands/link.ts) resolves the registered group and emits `t.me/<bot>?start=link_<community UUID>`. Private `/start` checks `getChatMember`, then issues `LINK_ORIGIN/link#<token>`; [session](../../../apps/api/src/link/session.ts) stores only its digest, with fifteen-minute single use. Private `/link` alone redirects users to the group ([registration](../../../apps/api/src/bot/index.ts)).
2. [API routes](../../../apps/api/src/link/routes.ts) serve the page, independently of Vercel `/claim`. [Client lines 4–5](../../../apps/api/src/link/page/client.ts) immediately strip the fragment. `render()` shows wallet buttons or no-wallet advice; **no copy/handoff control exists. The loaded address bar loses the token; use the original bot message.**
3. [Wallet code](../../../apps/api/src/link/page/wallet.ts) discovers only the two required Wallet Standard features. After selection/connect (first returned account), `/request` creates the readable five-minute proof. The wallet’s `solana:signMessage` prompts the user and signs exact UTF-8 bytes; client rejects changed bytes and posts proof to `/verify`. No transaction is constructed.
4. SDK **0.1.0** verifies nonce/domain/chain/expiry/signature; [store](../../../apps/api/src/link/store.ts) atomically consumes session/proof and writes [wallet history](../../../apps/api/src/link/wallet-links.ts). [Flow](../../../apps/api/src/link/page/flow.ts) reconciles uncertain outcomes through `/status`, never resending proof. SDK’s generic message **does not display Telegram identity**; server session binds it. A historical desktop/unspecified Phantom success proves no mobile result.

## Fifteen-minute operator test — not executed

- **0–2 min:** owner-attended external tester uses their own Telegram/wallet. Verify registered group/official bot; record OS and app/browser versions. This test creates link/proof/member records and needs separate authorization; no submission/model call/funding.
- **2–5:** group `/link` → private bot deep link → open URL in Telegram. Record actual surface, wallet buttons/no-wallet text. No token screenshots. FAIL applies to that surface.
- **5–8:** privately copy the **original bot URL with fragment** into the system browser; record discovery. Missing/expired token → fresh group `/link`, never stripped address bar or someone else’s link.
- **8–12:** fresh own link → installed wallet’s in-app browser → select detected wallet. Check exact API domain/address and readable free message; cancel transfers/approvals/seed requests. Sign; return to own group `/me`, confirm same wallet verified. On uncertainty check `/me` before restarting.
- **12–15:** record PASS only for committed link matching `/me`; otherwise FAIL with surface/error, or UNKNOWN if unattempted. Record shortened wallet only; no tokens/messages/signatures. A second wallet/iOS/Desktop needs its own fresh sitting. Recruitment stays parked until a real phone path passes.

Prior measured source (read only): sibling `mycel-sentinel/docs/superpowers/specs/2026-10-01-wallet-browser-handoff-design.md`, Problem/Overlap. Its confirmation-code protection is not implemented in Hyphae.
