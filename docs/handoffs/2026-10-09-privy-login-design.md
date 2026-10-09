# Privy login design checkpoint — October 9

## TL;DR

Cisco selected **email + existing Solana wallet login through Privy**, explicit linking to existing Telegram membership and no automatically created wallet. This decision is answered. The [written auth spec](../superpowers/specs/2026-10-09-privy-member-login-design.md) is drafted and self-reviewed; next human action is written-spec review. No auth code/dependency/configuration was added. Payouts remain explicitly paused and all release holds remain.

## State and evidence

- Checkpoint: October 9, approximately 13:10 UTC. Codex (GPT-6); exact runtime model ID/configured effort not exposed.
- Latest pre-design main: `acd56168b68d596e0ae9c86e06e2c2e870d99581`. Public website foundation remains `a717c17` + text-only `b750dd9`; prior gate/build results in the [foundation checkpoint](2026-10-09-community-web-foundation.md).
- No product code changed in this design turn. Runtime still has no website login or quiz. Existing local preview on port 3010 remains the public-read foundation.
- Current official Privy docs support native Telegram linking and a linked numeric Telegram user ID. Proposed server-side fresh provider/user/group verification resolves the existing member without new tables or migrations. This refines the earlier draft custom account-linking ceremony; that alternative remains future work, not approved architecture.
- Metadata-only npm lookup: `@privy-io/react-auth` 3.48.0 accepts React 18/19 and Solana Kit >=3.0.3; `@privy-io/node` current 0.35.0. Installed Node 22.21.0. No SDK was installed and no compatibility smoke was performed.
- Spec self-review covered scope, token/subject/community proof, current linked identity, unknown/unavailable states, no private shared cache, no wallet mutation and backend startup with auth disabled. SDK cookie/server-user behavior still needs implementation tests. No raw identity/provider credentials were collected.
- No C14–C22 completed; payees/amounts/publish/claim/P14 receipts none. No production write, funding, signing, DNS/provider/credential changes, deployment or messages.
- Origin/main remains `d3b8c6cf92f2ffcdf8fa3094b3709177b1ca4cf9`; next/origin-next remains `1249feddc5a7d7052fda6de8ac2ed65a0d4274b0`. No merge/reset. Existing 0018+0019 sequence and verify 0.1.0 preserved.

## Next action and exact stop

The brainstorming skill's architectural path requires written-spec approval before writing-plans, and implementation-plan review/execution choice before implementation. User approved the provider choice, not a written auth spec that did not exist when asked. Spec is now concrete and ready for review; do not ask the provider question again. No provider account/key setup is requested before local design/implementation is reviewable.

Payouts and publication are separate: do not resume money actions or infer release authority from login approval. Preserve Oct 9 22:00Z–Oct 11 00:00Z freeze. New auth implementation requires fresh other-family review before any permitted publication; held next ACCEPTs do not cover it. No downstream/API changes in this turn; Organic-sync owns vault/Organic propagation, neither edited here.

## Generated artifacts

| Artifact | Home | Stage |
|---|---|---|
| Written login spec | `docs/superpowers/specs/2026-10-09-privy-member-login-design.md` | DRAFT, self-reviewed, awaiting Cisco |
| Checkpoint | This document, `docs/HANDOFF.md`, `docs/BUILDLOG.md` | Local-only docs |
| Keys/accounts/SDK installations/resources/jobs | None | None created |

## Suggested skills

handoff-memory, the-analyst, superpowers:brainstorming (written-spec review), writing-plans only after approval, verification-before-completion, handoff. No implementation skill before the architecture prerequisites. Fresh other-family review for future auth code.

## Next-session prompt

```text
Cisco selected Privy email/existing Solana wallet login with explicit Telegram linking and no auto-created wallet. Written login spec is drafted/self-reviewed and awaits review; provider selection is answered. Public home/context/join work locally at b750dd9, no auth/quiz implemented. Payouts PAUSED; next 1249fed and publication holds remain.

Files: CLAUDE.md, docs/HANDOFF.md, docs/superpowers/specs/2026-10-09-privy-member-login-design.md, docs/handoffs/2026-10-09-privy-login-design.md, apps/api/src/server.ts, packages/db/src/schema.ts, apps/web/components/community.tsx
Model: available architecture/reasoning model at high effort — private identity boundaries need careful design; report actual runtime model/effort honestly.
Skills: handoff-memory, the-analyst, superpowers:brainstorming, writing-plans after written-spec approval, verification-before-completion, handoff.

Read the spec and any review reply. After spec approval, write the implementation plan for native Privy Telegram linking, app-bound backend verification and read-only existing-member access, without a DB migration. Preserve member records, wallet-proof separation, verify 0.1.0 through Oct 12, both histories and held 0018+0019. Do not re-ask the provider choice or change accounts/keys/DNS, publish, merge next or resume C14–C22.
```
