# Reusable operator-assisted community setup

**Current continuation — October 4:** source/checkpoint `e5ee300d6ce65231ec2325fef60be1f1ecbcba05` contains completed, independently reviewed T/A/B onboarding and operator-assisted setup. Both remain local-only, unpushed/undeployed. The owner-doc patch is applied. Next gate: combined release/target preflight, genuine owner inputs and separately authorized attended phone/setup/live scope; no rebuild of accepted source. [Current handoff](../../HANDOFF.md).

Status: local implementation complete and independently approved through cd4c4ef; integrated at e5ee300d. Production setup, Organic changes and publication remain separate.

## Outcome

An operator can prepare and check an explicit configuration for any token community, then register its own Telegram group once. Registration starts paused with a pinned, future epoch and no payment eligibility. It neither moves the MYCEL pilot nor bootstraps paid legacy scoring.

Requirements: [shared-community clarification](../specs/2026-10-03-organic-community-onboarding-requirements.md). The [research/document alignment requirement](../specs/2026-10-03-project-alignment-and-document-hygiene.md) remains applicable; accepted history is reused and new API behavior is checked against primary documentation.

## Ownership and boundaries

This arc owns new `apps/api/src/community-setup/{manifest,telegram,registration,cli}.ts`, their tests/fixture, `apps/api/scripts/community-setup.ts`, this plan, a new setup integration guide, and this arc's engineering receipt. The README setup entry and empty operator variable in `.env.example` are necessary documentation additions. It used a separate worktree based on the committed generic participant implementation; integration and temporary worktree cleanup are complete. Existing participant source is accepted unchanged. No build helpers are spawned; the required fresh other-family reviewer is read-only.

No changes to DB schema, reward policy, SDK or lockfile, existing runtime handlers, chain instructions, Organic, Sentinel or vault. Existing reward bootstrap is reused in a single registration transaction. No public registration endpoint or website administrator dashboard is added. The independent review's F1 repair additionally owns `packages/db/src/index.ts`: an optional explicit connection target pins reviewed host/port/database/TLS without changing existing callers; complete the DB consistency and real-Postgres gates for that extension.

## Ordered milestones

1. Strict private manifest and deterministic plan hash. Require explicit community UUID, mint, name, group and administrator IDs, expected bot ID, operator approval reference, intended environment, pinned reward configuration and activation time. Reject unknown or silently discarded fields. Validate before credentials are read.
2. Read-only Telegram and database checks. Verify the exact bot/group/admin; no messages, settings, updates consumption or invitation creation. Refuse conflicting UUID/mint/chat registrations. Group admin status is not proof of Organic mint ownership: this is a trusted operator tool, with authority recorded by an approval reference.
3. Gated apply. Require the reviewed plan hash and explicit environment. Serialize overlapping UUID/mint/chat requests; atomically insert one paused community and bootstrap its pinned future epoch. An exact repeat returns the existing identity without writes. Conflicts never update another row. Unknown commit outcome requires read-back, not an automatic retry.
4. Disposable two-community tests, denied membership/identity cases, rollback and real-Postgres contention. Verify existing community history and zero payment eligibility. Complete the repo gate and fresh independent other-family review before integration/publication of sensitive changes.
5. Document the Organic-side input/authority contract, operator commands and honest capability limits. Update this arc's handoff/build log without discarding the concurrent participant arc.

## Integration boundary

Organic's existing public settlement GET is the only currently permitted Organic interface. A community-settings feed and owner-authenticated provisioning contract remain Organic-owned follow-up work. Do not invent an authenticated API or derive ownership from public page fields. The local tool can use an operator-reviewed manifest now; self-service cannot be claimed.

## Primary-source check

Context7 is unavailable in this session. Official [Drizzle transactions](https://orm.drizzle.team/docs/transactions), [grammY API](https://grammy.dev/ref/core/api) and [Telegram getChatMember](https://core.telegram.org/bots/api#getchatmember) were read October 3. Nested transactions use savepoints; API methods accept abort signals; reliable other-member lookup requires the bot to be a chat administrator. Device and deployment proof are separate.

## Done and parked

Done locally: two distinct fixture communities register safely in a disposable database; prior gate 851 passed/1 skipped and 50/50 real-Postgres checks, final other-family APPROVE. These are prior receipts, not tests run October 4. Production registration, owner credentials, Organic integration, group/menu/pin changes, payment activation, self-service authority and a full administrator dashboard remain explicit future scopes. SDK 0.1.0 through October 12 and Sentinel F-13 remain unchanged.
