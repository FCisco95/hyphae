# Correct the existing pilot display name to MYCEL

**Current continuation — October 4:** source/checkpoint `e5ee300d6ce65231ec2325fef60be1f1ecbcba05` contains completed, independently reviewed T/A/B onboarding and operator-assisted setup. Both remain local-only, unpushed/undeployed. The owner-doc patch is applied. Next gate: combined release/target preflight, genuine owner inputs and separately authorized attended phone/setup/live scope; no rebuild of accepted source. [Current handoff](../../HANDOFF.md).

**Status: prepared operator plan; NOT executed.** October 3, 2026. Founder naming decision is **MYCEL**, attribution **Powered by Hyphae**, status **Pilot**. This plan changes only the existing database display name after separate production-write authorization. It creates no community, Telegram group, chain account, migration or deployment.

## Exact target and preflight

Target is the single existing `communities` row whose **mint is `HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg`** and whose current API name was **Hyphae Lab** at October 3 18:41:21Z. Desired value is exactly **MYCEL**. The mint is unique ([schema](../../../packages/db/src/schema.ts)); name is mutable metadata, not the mint/admin-derived chain identity. [Current receipt](../../handoffs/2026-10-03-onboarding-preparation.md) freshly confirms absent community/vault chain accounts; changing a display name initializes neither.

Before the attended write, use an owner-configured connection and `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`, with a short statement timeout. Select `id, mint, name, telegram_chat_id, admin_telegram_user_id, rubric_version, chain_address, publisher_pubkey, first_paid_epoch, reward_intake_paused_at` for that exact mint. Require **exactly one row**. Record UUID/chat ID privately as the fixed target; those are unavailable from this session's public API. Confirm with the owner that this is the intended registered pilot, not merely one of the wider MYCEL groups. Privately record membership, contribution and epoch counts and the non-name values for comparison; no public identity list or credentials. End the read-only transaction.

If name is already MYCEL and identity matches, **done/no write**. If Hyphae Lab, continue only under the new mutation authorization. Any other name, missing row, changed UUID/chat, unexpected binding or live state contradicting the receipt parks the change for Cisco; do not seed or replace anything. Recommendation: preserve the exact row, because its identity carries all existing history.

## Guarded idempotent write (future attended action)

Use bound parameters or `psql` safely quoted variables `verified_id` and `verified_chat_id` from the read-only preflight, never guessed values. They are identity guards, not new configuration. The operator opens a transaction with `lock_timeout = '3s'`, `statement_timeout = '10s'`, locks the exact row and checks it before any update:

```sql
begin;
set local lock_timeout = '3s';
set local statement_timeout = '10s';
select id, mint, name, telegram_chat_id
from communities
where mint = 'HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg'
  and id = :'verified_id'::uuid
  and telegram_chat_id = :'verified_chat_id'::bigint
for update;
```

**Operator gate while lock is held:** exactly one matching row. If already MYCEL, rollback/end without update and verify via API. If the old name is exactly Hyphae Lab, perform only:

```sql
update communities set name = 'MYCEL'
where mint = 'HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg'
  and id = :'verified_id'::uuid
  and telegram_chat_id = :'verified_chat_id'::bigint
  and name = 'Hyphae Lab'
returning id, mint, name;
```

Require **one** returned row and the desired name; otherwise `ROLLBACK`, inspect and stop. Compare all non-name fields/counts while the transaction is held, then `COMMIT` only for the authorized one-row result. No broad `UPDATE`, insert/upsert, chat reassignment, rubric change, publisher/binding write or seed script. On timeout rollback; retry only after refreshing the target. On unknown commit outcome, read the same guarded row: MYCEL → done, old name → reviewed retry, anything else → stop. A repeated successful operation sends no update.

This is an interactive procedure with explicit row-count gates, not a paste-and-run block ending in unconditional commit. A future automated wrapper must encode those gates and is outside this docs-only arc.

## Read-back and rollback

Read DB identity/non-name fields/counts again; require only `name` changed. Read anonymous community, epoch 2 and site community/epoch/leaderboard and check the same mint, current name, actual `as_of`, state and counts. API and web revalidation are **15 seconds**; allow caches to refresh and compare timestamps. Do not claim a failed/old cached read proves rollback or force a redeploy to hide uncertainty. Save UTC time, one affected row, preserved identity/counts and owner verdict without private chat/member identifiers.

Before change, record old value exactly **Hyphae Lab**. If rollback is needed and separately authorized, lock/recheck the same UUID/mint/chat and conditionally `UPDATE ... SET name = 'Hyphae Lab' ... AND name = 'MYCEL' RETURNING id,mint,name`; require one row. Already old → no-op; third-party name/identity change → stop. Repeat DB/API/site read-backs. This reverses metadata only; it neither cancels immutable chain initialization nor withdraws a funded pot.

## Telegram branding and shared-code boundary

Owner screenshots confirm that Hyphae Lab and Mycel Testers are separate chats; the MYCEL list has two Mycel Testers entries. Lab contains historical Hyphae/MYCEL bot replies. Exact UUID/chat guards still come from the read-only preflight, not a title or screenshot. Read-back of the row does not rename Telegram, a bot profile, pins or X. Owner must confirm which registered group title/description/pins should change, keep its chat identity, and separately authorize each external branding/message action. Recommendation: align the registered pilot's participant-facing title with MYCEL after checking the group mapping; retain “Pilot” as status and “Powered by Hyphae” as attribution. Leave Buy Calls, Trenches, Raid Team, Announcements and Testers alone unless the owner names a concrete change. Do not change bot username or create a new group.

Generic UI continues rendering the API name; optional per-mint invite/support/Pilot metadata is handled in [the implementation plan](2026-10-03-participant-onboarding-plan.md). Shared code has no MYCEL name override or mint-specific rewards behavior. No SDK/version, rules/Jev, registration, scoring or October 8–9 gate changes. No database/Telegram/Vercel write has occurred here.

## Combined release continuation — October4

The [single combined packet](../../demo/2026-10-04-combined-release-packet.md) now owns source/artifact/target pins, selected-effect approvals, timestamped technical preflight, phone matrix, private-manifest readiness, Organic consumer requirements and the one bundled input list. Both candidates remain complete at source/checkpoint **e5ee300d6ce65231ec2325fef60be1f1ecbcba05**, local-only. Prior latest gate851/1 skip + Postgres50/50 is prior evidence; no runtime tests/builds ran in this preparation. Current next gate: existing read-only access/genuine URLs and concrete publication/deployment/test/setup scope.

Fresh Oct4 public/API/site reads passed; internal Lab UUID/chat/admin/type/webhook/migration/Fly health remain UNKNOWN. Vercel production target/source is freshly confirmed, and main auto-deploy is enabled: source publication must account for its web deployment. Recommend coupled publication+selected web release and API-only image update with frozen v11 worker retained after preflight. No actual image build, push, deploy or configuration change.
