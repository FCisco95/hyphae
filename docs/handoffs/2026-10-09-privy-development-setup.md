# Privy development setup checkpoint

Date: 2026-10-09T20:50Z. Operator: Codex (GPT-6); exact runtime model ID/effort not exposed.

Cisco created a Privy account and **Hyphae Development** app, shown in development mode. Owner screenshots show email/external wallets and Solana enabled, preview origin listed. Subsequent public config read confirms saved EVM-off/Solana-on/signup/origin settings. Automatic embedded-wallet dashboard settings remain unverified; client creation is off. Actual partial owner smoke is recorded below.

Public development App ID is stored in ignored root `.env` as **PRIVY_DEV_APP_ID** only; original production PRIVY_APP_ID remains unconfigured. No secrets, keys, DNS, production app, private activation flags or credentials were changed. Website registration URL `https://hyphae-delta.vercel.app` returned HTTP200; that field does not configure production cookies.

The original [member design](../superpowers/specs/2026-10-09-privy-member-login-design.md) requires verified-domain production HttpOnly cookies. [Privy's development cookies](https://docs.privy.io/recipes/react/cookies) do not meet that invariant. Previous guidance incorrectly implied development setup could enable the existing private member screen; corrected before building the extra test. Cisco's **“Let's continue”** approved the explicitly proposed separate provider-only page at **http://127.0.0.1:3010/dev/privy**. It never calls private member APIs or reads tokens/member records, links Telegram, changes rewards or creates embedded wallets. SDK authentication here is only provider development status, not member authority. Keep private/production activation off.

Source **534f8079908b42ef60b331a70cb491ed6e82d040**, review fixes **60ec29a8bbe893cfb46597ddf0a5d8d2e3aba493**; arc start/setup docs **f5b311867165a5f4d521390ad8888bd46032b295**. Earlier reviewed raid/auth work remains preserved. This documentation checkpoint's SHA resolves with `git log -1 --format=%H -- docs/handoffs/2026-10-09-privy-development-setup.md`. No push/deploy; existing publication hold and Oct9 22:00Z–Oct11 00:00Z freeze apply. Origin/main d3b8c6cf92f2ffcdf8fa3094b3709177b1ca4cf9 and held next1249feddc5a7d7052fda6de8ac2ed65a0d4274b0 preserved.

## Validation and review

Exact-host/local flag/no-Vercel/distinct-ID gate; wrong Host reveals no test title/app ID. Next's streamed not-found response can be HTTP200; do not use status alone as exposure proof. Local test200 with both controls present; private member proxy404. `/community` exists and provides its existing default-mint redirect. Launcher explicitly sets HYPHAE_LOCAL_PREVIEW; root env/shell do not. Keep that flag and dev ID out of every deployed environment; remote environment values were not audited or changed. Example documents the flag off; it remains listed for existing environment coverage.

Final full **1513 passed** (139core/26read-client/224web/1124API),3existing skipped; typecheck/lint462files/web production build pass.11focused tests, including Medium logout regression, failed before implementation/fix then passed. Initial parallel test/typecheck hit Windows EPERM in shared read-client dist; rerun separately passed, no source workaround. API/schema/reward/DB code unchanged, no new DB gate or migration.

Fresh review **CHANGES_REQUESTED** at534f807, claude-opus-5-5/requested-high,82917ms/1turn: premature sign-out success. Fixed test-first, along with distinct prod/dev ID guards and honest test naming. Fresh final full-range **ACCEPT** f5b3118..60ec29a, claude-opus-5-5/requested-high,70509ms/1turn, tools/hooks/MCP off. Static code review, not real provider authentication. Remaining Low/Info queue: late SDK-clear and env/route-wiring coverage, cross-tab wording, whitespace-only ID diagnostic; code fails safely, no required defect. Production cookie proof and allowed origin/embedded dashboard confirmation remain owner tasks. Prior raid/auth ACCEPTs preserved separately.

**Actual owner smoke:** Cisco supplied the signed-in development UI screenshot and said **“with email worked.”** This confirms attended email sign-in/UI success, not production cookies or private member authority. Phantom previously showed **“Could not log in with wallet”** and Cisco answered **“I approved the login message.”** Failure cause unresolved; don't assume cancellation or claim wallet success. Sign-out, refresh persistence, successful wallet login and private/production proof remain open. The operator did not enter OTPs, sign or inspect tokens/signatures.

Read-only public app config GET at20:49Z returned200: exact `http://127.0.0.1:3010` allowed origin; email/Solana true; EVM false; external-wallet signup true; allowlist/captcha false; no custom API. Pinned SDK confirms Solana SIWS flow and callback error contract; those reads do not identify the failure. No provider config/source changes or speculative fix. Use systematic debugging to obtain only the failing wallet request status/error code next. Keep raw request/headers/tokens/signatures out of chat and logs.

Funding/payouts remain paused. All C14–C22 incomplete; actual payees/amounts/publish/claim/P14 evidence none. No final no-payable verdict. Organic-sync owns downstream status propagation; no Organic/vault writes.

## Next action

Cisco subsequently confirms **“It does sign out”**; email login and logout UI checks are complete. New email code/link request after explicit logout is expected passwordless authentication, not evidence of a session bug. Next sign in once and refresh without signing out to validate persistence. Phantom's post-signature failure remains unresolved; obtain only exact failing request status/error code, not raw requests/headers/signatures/tokens. No speculative fix or repeated signing/setup question. Private member/production cookie proof remains absent.

## Generated artifacts

| Artifact | Home | Stage |
|---|---|---|
| Owner-created development app | Privy Dashboard / Hyphae Development | Development; no login receipts |
| Public development App ID | Ignored root `.env`, `PRIVY_DEV_APP_ID` | Distinct from unconfigured production ID; no secret/key |
| Provider-only test | apps/web/app/dev/privy/page.tsx, apps/web/components/privy-development.tsx | Local534f807/fixed60ec29a; code ACCEPT, owner smoke pending |
| Review/gate logs | Ignored docs/plans/2026-10-09-privy-development-*.json/log/diff | Actual reviews and final checks; no secret/OTP capture |
| Operator screenshots | Conversation | Owner setup evidence; not auth proof |
| Owner email/wallet screenshots | Ignored docs/plans/2026-10-09-privy-owner-email-success.png and docs/plans/2026-10-09-privy-owner-wallet-failure.png | Email UI success; wallet failure after approved message; no private identity/OTP/token capture |
| This checkpoint | docs/handoffs/2026-10-09-privy-development-setup.md | Public-safe, local only |

## Suggested skills

the-analyst, superpowers:verification-before-completion for owner receipts, superpowers:test-driven-development for concrete failures, handoff. Existing bounded approval and fresh ACCEPT are complete; do not restart design. Fresh other-family review before any authorized new auth-code push.

## Next-session prompt

```text
Provider-only test534f807/fixed60ec29a ACCEPT,1513tests/type/lint/build pass. Owner email sign-in UI succeeded; Phantom failed after approved message. Public app settings verified correct. Sign-out/wallet root cause/private cookie/Telegram proof open. Private member gate off; no payout/publication.
Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-10-09-privy-development-setup.md, apps/web/lib/member-login-config.ts, apps/web/components/member-provider.tsx, apps/web/scripts/preview.mjs
Model: available coding model at high effort for concrete integration fixes; record actual runtime identity/effort.
Skills: the-analyst, superpowers:systematic-debugging, superpowers:verification-before-completion, superpowers:test-driven-development for a proven defect, handoff.
Confirm owner Sign out on http://127.0.0.1:3010/dev/privy. Then investigate exact failing wallet request status/error code; Cisco already approved its message. Do not guess a fix or request raw headers/requests/OTPs/tokens/signatures. Keep private member cookie gates unchanged/off; dev cookies aren't production proof. Do not repeat app/provider/approval questions. Preserve both histories/held next/verify0.1.0/publication freeze; no push/deploy/money/Organic/vault effects.
```
