---
date: 2026-10-09
summary: Funding/payouts explicitly paused; website discovery opened for clearer member journeys, scalable community workspaces and possible email/wallet login. No product changes or approved architecture yet.
---

# Website experience discovery

## TL;DR

Cisco said he does not want to pay already, then asked to improve the website because it is still not straightforward. **All funding and payout actions are paused until he explicitly resumes them.** No Ledger command, transfer, publication or claim occurred. The existing schedule cannot override this pause.

Requested: better visual organization, community domains/subdomains, scalability, wallet/email login (assumption: "Pryv" means Privy). No provider account, new wallet, key, DNS change, dependency install or implementation.

Operator: Codex (GPT-6); exact runtime model ID/effort not exposed. Skills: brainstorming for architectural discovery, the-analyst, handoff. No subagents.

## Findings

- `apps/web/app/community/page.tsx` redirects to a single DEFAULT_MINT; community routes already read by mint. One underlying app can serve multiple community workspaces without a deployment per community.
- `apps/web/components/views.tsx` is largely a public audit/guide. Members are directed to Telegram for wallet-link initiation, rules, submitting work and personal progress. `site.tsx` navigation emphasizes public information and claims rather than a signed-in member workspace.
- `packages/db/src/schema.ts` requires a Telegram ID for every member and ties membership to community + Telegram identity. Community records also require a registered Telegram chat. Fully optional Telegram requires real identity/membership changes, not just a login button.
- Existing wallet-link sessions bind the member/community on the server, not from submitted browser fields. Signed payout-wallet history is separate from login; preserve this distinction and close-time eligibility.
- Privy's [authentication overview](https://docs.privy.io/authentication/overview) supports email and Solana-wallet login. This establishes provider capability, not Hyphae compatibility or an approved provider choice. Embedded-wallet creation is a separate custody/recovery choice; generic Privy connect-or-create documentation includes an EVM-only limitation, so Solana-specific implementation must use the appropriate documented flow.
- Reviewed next already includes payout status, wallet history, raid stats and Blink. Reuse that accepted work when release/integration becomes authorized; no early merge or reimplementation.

## Pending question and provisional recommendation

Asked Cisco: **should members join, find work, submit and track progress entirely on the website with Telegram optional, or should it remain a dashboard alongside the required Telegram bot?** No answer at this checkpoint.

Provisional direction: a public community home plus a clear member workspace, MYCEL first, then reusable community presentation. Use readable community paths backed by immutable community IDs/mints. A verified subdomain/custom domain can alias the same workspace; deployment/domain choices remain open.

Member flow to explore: choose community → sign in → complete required setup → find work → submit → see scored progress and exact reward status. Keep public browsing open. Distinguish login, linked payout wallet and verified account ownership; prevent duplicate members or arbitrary merging of historical records. Begin with email/existing-wallet login; decide automatic embedded-wallet creation separately.

These are recommendations under discussion, not an approved written design. No implementation started. Architecture path: clarify the journey, compare approaches, present design, then written spec/implementation plan before auth/domain implementation.

## Holds and next action

Funding/payouts paused; C14–C22 remain incomplete. Next release held; freeze Oct 9 22:00Z–Oct 11 00:00Z remains. No new publication authority, DNS change, provider credentials or rollout. Main has local documentation commits, next remains 1249fed. No runtime files changed. Full main push gate has not run for these documentation-only checkpoints.

Next: resolve website-versus-bot scope, then design the community/member screens and explicit identity linking. Existing public wording/scorer/privacy/release queue remains open independently. Preserve both Git histories.

## Generated artifacts

This checkpoint and canonical handoff/build-log updates only. No keys, provider projects, wallets, deployments or scheduled jobs.

## Suggested skills

handoff-memory, the-analyst, superpowers:brainstorming; writing-plans after the agreed written design; handoff at the next stop.

## Next-session prompt

```text
Resume Hyphae website discovery. Cisco explicitly paused all funding/payout actions; do not resume the Ledger/runbook queue. He wants a clearer scalable community website with possible email/wallet login and community domain/subdomain organization. No implementation or architecture approved yet; next remains held.
Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-10-09-web-experience-discovery.md, docs/ROADMAP.md, apps/web/components/views.tsx, apps/web/components/site.tsx, packages/db/src/schema.ts
Model: use the available architecture/reasoning model at high effort; exact prior runtime ID/effort not exposed.
Skills: handoff-memory, the-analyst, superpowers:brainstorming, handoff.
Resolve whether the website should offer the complete journey with Telegram optional or remain a dashboard alongside the bot. Design a reusable community/member workspace and explicit identity/payout-wallet linking; do not infer existing membership from email/wallet alone. Preserve held release, both histories and freeze. No funding, claims, DNS/provider-key changes or messages.
```
