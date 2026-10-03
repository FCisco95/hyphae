# Organic community onboarding: scope clarification

Date: 2026-10-03
Status: requirements clarification and proposed follow-up; no new runtime or live operation implemented by this document.

## Required outcome

Cisco clarified that Hyphae must work for Organic's communities in their own Telegram groups. Preparing Hyphae Lab alone does not deliver this outcome. Lab remains the existing pilot and its identity, members, wallet links and scored history must be preserved.

Community setup and member onboarding are separate flows. Generic welcome/help and audit-page presentation improve an already registered community; they do not register another group, establish administrator authority or configure the Organic integration.

## Confirmed implementation boundary

- [The schema](../../../packages/db/src/schema.ts) scopes members, tasks and epochs by community and currently permits one registered contribution chat per token mint.
- [The bot](../../../apps/api/src/bot/index.ts) resolves registered groups. Adding it to a group does not register that group.
- [The current participant plan](../plans/2026-10-03-participant-onboarding-plan.md) covers reusable welcome/help, community-page presentation and private-link copy guidance. Local changes in progress are not deployment evidence.
- [Presentation configuration](../../../apps/web/lib/community-presentation.ts) is currently a code-owned map; it is not an owner settings screen or an Organic configuration feed.
- [The public API](../../../apps/api/src/http/routes.ts) is a read interface. It does not authenticate community owners or provision communities.
- [The legacy seed script](../../../apps/api/scripts/seed-community.ts) contains Lab defaults and is not a safe new-community setup procedure.
- A full web administrator dashboard was previously deferred beyond the hackathon. This clarification does not silently reverse that priority or authorize new funding, publisher or reward policies.

## Proposed shared setup experience

1. The owner starts from the selected Organic token community's page and sees the Telegram setup checklist and official bot link.
2. The owner selects or creates that community's own group and adds the shared Hyphae bot. The bot does not create the group.
3. A setup operation verifies the exact group, bot access and administrator identity. Telegram group ownership alone does not prove authority over an Organic token community; the Organic authorization contract must be established before self-service registration.
4. The community's verified configuration supplies its display name, official group/support links and applicable contribution guidance. Owner inputs, public reads and permitted mutable fields must be specified explicitly; a public page or a client-supplied mint cannot authorize a write.
5. Registration or binding succeeds once for the intended community/group. Duplicate mints, conflicting chats and attempts to overwrite an existing community refuse safely. Existing pilot history is not reassigned merely to test setup.
6. Members receive that community's contextual welcome and use existing wallet, rules, submission and progress commands. Audit links stay under that community's mint.
7. The designated administrator operates briefs through the existing command path and reviews evidence on that community's audit pages. Any new management controls need their own action authorization and frozen-epoch safeguards.

First-release recommendation: one contribution group per token community, using the existing schema. Several chats for the same token and delegated administrator roles require a separate scoped design.

## Next bounded engineering task

Finish or reuse the existing generic participant implementation without changing its ownership. Then prepare the community setup integration contract and operator-assisted setup procedure:

- Define what the Organic community page supplies, how it is obtained and which system verifies owner authority.
- Define the group-binding request, conflict behavior, allowed settings and read-back receipt.
- Reuse existing commands and public audit routes; list every genuinely new API/auth/schema need before implementation.
- Keep Organic implementation in its owning repository/lane. Hyphae consumes only its permitted public interface until an explicit integration amendment exists.
- Prove the procedure with two distinct token communities in a disposable environment before any real second-community setup.

Self-service registration is not complete until owner authority and action-scoped authentication are implemented and independently reviewed. Operator-assisted setup must be labeled as such. No registration, button, dashboard or live bot configuration is claimed by this document.

## Acceptance checks

- Two distinct communities use their own groups, names, rules and audit destinations.
- An unauthorized account cannot bind a mint, configure another community or operate its briefs.
- Bot presence alone confers no community ownership or registration authority.
- Forged configuration, duplicate registration and conflicting group/mint bindings are refused without replacing history.
- Members, submissions, scores and administrator actions remain community-scoped.
- Missing configuration or an unavailable source is explicit; no guessed invite, default MYCEL rules or fake completion state.
- Existing MYCEL wallet links, contributions and epochs remain intact.
- Creating a setup record does not activate rewards, publish a root, fund a vault or move funds.

## Preserved boundaries

Sentinel stays PARKED under F-13. SDK remains exactly 0.1.0 through October 12. Existing reward/scoring policy, frozen epochs and dated money gates remain unchanged. No production registration, Telegram setting/message/pin, deployment, Organic/sibling write or publication follows from this clarification.

No participant needs to repeat a completed wallet link or scoring exercise to define these engineering requirements. New-community/device acceptance evidence remains a separate validation task.
