# Privy development setup checkpoint

Date: 2026-10-09T20:03Z. Operator: Codex (GPT-6); exact runtime model ID/effort not exposed.

Cisco created a Privy account and **Hyphae Development** app, shown in development mode. Email/external wallets appear enabled; Cisco enabled Solana, subsequently shown checked. Preview origin `http://127.0.0.1:3010` is listed. EVM disable/save and automatic embedded-wallet dashboard settings have not been confirmed. No real email/wallet login has been tested.

The public App ID supplied by Cisco is stored in ignored root `.env`. The agent changed that public field only. No secrets, keys, DNS, production app, activation flags or credentials were changed by the agent. Existing preview/member login gates remain off. Focused member-login-config tests: **3 passed**. Website registration URL `https://hyphae-delta.vercel.app` returned HTTP200; that registration field does not configure production cookie support.

The original [member design](../superpowers/specs/2026-10-09-privy-member-login-design.md) requires verified-domain production HttpOnly cookies. [Privy's documented development cookies](https://docs.privy.io/recipes/react/cookies) do not meet that invariant. Previous guidance incorrectly implied this development setup would enable the existing private member screen. An isolated loopback provider-only login test is a proposed bounded addition; not approved, implemented or claimed working. It must never call the private member API, read member data, modify reward wallets or masquerade as production cookie proof. Keep production/member activation off.

Source remains **0dfab10bab28d0ae421b5747434ed82887f49a8a**, reviewed local feature **77a15f76b261da1705eb8b8ed6af31894b2d4925** plus fixes **0c79cd4ae73a8541f6fab221a97604fa0db8a036**. This documentation checkpoint's SHA can be resolved with `git log -1 --format=%H -- docs/handoffs/2026-10-09-privy-development-setup.md`. No push/deploy; existing publication hold and Oct9 22:00Z–Oct11 00:00Z freeze apply. Origin/main d3b8c6cf92f2ffcdf8fa3094b3709177b1ca4cf9 and held next1249feddc5a7d7052fda6de8ac2ed65a0d4274b0 preserved.

Funding/payouts remain paused. All C14–C22 incomplete; actual payees/amounts/publish/claim/P14 evidence none. No final no-payable verdict. Organic-sync owns downstream status propagation; no Organic/vault writes.

## Next action

Present the bounded isolated provider-only development sign-in test design and obtain Cisco's approval before building that addition. Full private activation still requires a dedicated production app, owned domain/cookie proof, server configuration, Telegram linking and attended real login/refresh/logout receipts. Do not ask Cisco to paste secrets or buy a domain merely to finish developer registration.

## Generated artifacts

| Artifact | Home | Stage |
|---|---|---|
| Owner-created development app | Privy Dashboard / Hyphae Development | Development; no login receipts |
| Public App ID | Ignored root `.env`, `PRIVY_APP_ID` | Saved only; no secret/key |
| Operator screenshots | Conversation | Owner setup evidence; not auth proof |
| This checkpoint | docs/handoffs/2026-10-09-privy-development-setup.md | Public-safe, local only |

## Suggested skills

the-analyst, superpowers:brainstorming for the bounded isolated-test design, superpowers:test-driven-development if approved, superpowers:verification-before-completion, handoff. Fresh other-family review before any authorized auth-code push.

## Next-session prompt

```text
Hyphae Development is owner-created. Public App ID saved in ignored root .env; preview origin listed; Solana enabled. Existing private login remains off: production HttpOnly/owned-domain/server/Telegram receipts are absent. No live login or payout. Three focused member gate tests pass; prior full1502-test/source ACCEPT preserved. Source0dfab10; new docs checkpoint SHA resolves via git log.
Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-10-09-privy-development-setup.md, apps/web/lib/member-login-config.ts, apps/web/components/member-provider.tsx, apps/web/scripts/preview.mjs
Model: available coding model at high effort for an approved test slice; record actual runtime identity/effort.
Skills: the-analyst, superpowers:brainstorming, superpowers:test-driven-development if approved, superpowers:verification-before-completion, handoff.
Present the isolated loopback provider-only sign-in test design; obtain bounded approval before adding it. Do not weaken private member cookie gates or claim development cookies are production proof. Do not repeat app/provider choice questions or request secrets in chat. Preserve both histories/held next/verify0.1.0/publication freeze; no push/deploy/money/Organic/vault effects.
```
