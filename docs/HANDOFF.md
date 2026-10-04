---
date: 2026-10-04
summary: Private raid alerts implemented and accepted locally; exact minimal candidate c58aa27 fully gated. Live migration/API release awaits new explicit approval; existing a646 web remains live.
---

# Hyphae handoff

## Metadata

Last Updated: 2026-10-04T21:28:06Z
Project: Hyphae. Scope: locally completed private raid notification feature and prepared live release.

## TL;DR

**Private raid alerts are built, tested and reviewed; not live.** Current source **050753615b456645ac7d95f5de243bec59ec68c4**, minimal outgoing **c58aa27efdb5bc5492c2f96d45c090c9fc91d379**, retained in local tag **candidate/raid-alerts-2026-10-04**. Exact candidate **876tests/1optional skip**, types/lint297/Drizzle/Postgres55/API+web builds green. Fresh Claude Opus5.5 **ACCEPT** after actual signal/delivery/consent repairs. [Full completion receipt](handoffs/2026-10-04-raid-notifications.md), [review/verbatim/advisories](reviews/2026-10-04-raid-alerts-opus.md), [member flow](community/RAID-ALERTS.md).

**Needs Cisco only for the new live scope:** approve the [prepared release plan](demo/2026-10-04-raid-alerts-release-plan.md): exact candidate publication/automatic Vercel behavior, bounded API artifact build+registry publication, guarded additive0013 migration and API-only update with old API/web rollback, frozen worker untouched. One async approval question issued; **pending, no approval inferred from time or preselection**. Original “That would be perfect” authorized local feature work. Original exact-a646 web approval and read-only Fly login persist and must not be re-asked.

**Existing web release stays complete:** GitHub main **a646abc883131ff411d5dd7bbba536176364fe38**, CI37230455538 success, Vercel **dpl_A9BMEHKgNn8r9NtGtJhFWAunPY5q READY/production**, alias hyphae-delta.vercel.app/source/assets/Lab/new token recognition PASS, no rollback used. [Portable release receipt](handoffs/2026-10-04-web-release.md). No notification source/migration/API artifact live, no real Telegram message/subscription or phone test.

## Current Objective

Await the explicit named migration/API release approval; finish no other source arc. If approved, execute only the plan's exact candidate/target/source/hash/guard effects and acceptance/recovery, retaining the frozen reward worker and every other scope. No unchanged SDK/adopter rebuild/review queue. Caller opted-in notifications never grant target creation, council, wallet or reward authority.

## Current State

| Component | Actual stage / next gate |
|---|---|
| Notification source | Local f8a360b19352b76a78e57adce2d4222795d20d5f + reviewed repairs050753615b456645ac7d95f5de243bec59ec68c4. Actual bot/API transport intercepted, no live messages. |
| Minimal outgoing candidate | Publisheda646 → c73b04d8dfbbc53362eb47d5cb62fa88409b8455 (initial feature, prior NEEDS-FIXES) → c58aa27efdb5bc5492c2f96d45c090c9fc91d379 (accepted repairs). All feature-changed files equal reviewed main0507536. Excludes later SDK/adopter source. Tag local-only. |
| Consent and delivery | Registered group /notifications → official private Start offer → explicit named Enable → live exact membership → caller/community-only consent. Future admin raids delivered privately with target/excerpt/brief/UTC window/Engage/Stop. Atomic task/outbox, event dedupe, consent revision fencing, membership/window rechecks, safe claim recovery, uncertain started sends never blindly resent. |
| Runtime design | Existing API handles outbox one message/sec/process,4s Telegram calls. No extra VM, no reward worker/queue source change. API SIGINT/SIGTERM drain/exit proved with real child processes; ten-second app backstop, platform may stop earlier. |
| Schema | New0013 adds3tables/enum only, SHA2567e0f951e3548d335dd8f299390daba14f6d8a6a3f79277a2068b2ecd4cc4b022. Historical0000–0012 unchanged. Snapshot tracked, drizzle-kit generate no changes. Production still unmigrated; no consent backfill. |
| Scope approval | New live plan NOT AUTHORIZED/NOT EXECUTED, async question pending. No fresh login/old web approval needed. Image digest UNKNOWN/not built; must be recorded before a later approved API update. |
| Fly | Existing API6839d31b317318 / worker817400c9901de8, hyphae-api/cdg, frozenv11 digestsha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2. No new remote write, restart, env/secret export or deployment. MacFly0.4.111 read-only login available. Signing-page T/B fix still undeployed. |
| Engagement authority | [Cisco ruling](handoffs/2026-10-04-engagement-authority.md): admin + verified council stewards choose targets; members submit their own engagement evidence. Current /raid only designated admin; council bridge absent, untargeted submission and structural target/author proof gaps remain. No new authority/allowlist invented. |
| Local SDK/adopter | Accepted through202fe957, private read-client0.1.0, CLI/reference demo complete but unpublished. Closing reviews accepted. [Adopter close](handoffs/2026-10-04-adopter-close.md), [SDK receipt](handoffs/2026-10-04-read-sdk.md). Native Windows/real phone/scale/two real registrations unknown. |
| Organic | Owning organic-sync consumes the producer receipt. Task3.6/DEP-09 authority/settings/transport remains open; only public settlement GET currently permitted. Siblings/vault read-only, no shared write/message. |

## Validation

Final candidate **876passed/1optional skip** (106core/107web/663API), **55/55 real disposable Postgres**, types0/lint0/297files, Drizzle0, API+web builds0, diff0; Node24.14.0/pnpm10.29.3. New25unit/integration+5PG cases: intercepted actual commands/API, explicit Enable and scoped Stop, unsafe identifiers, no outsider grants, membership/expiry/consent, one-use dispatch including lost DB receipt, concurrent events/consumers/recoveries, no raid block during send, SIGINT/SIGTERM real process exit. Native Windows signal cases skip by platform; no native execution claim.

Owner closing main **916tests/1skip**, typecheck/lint320/Drizzle/API+web builds green, PG55/55. Initial root/candidate909/870 receipts retained as earlier stages, not latest. Required workspace checks incidentally include existing SDK tests; no new SDK implementation/review. Original web exact-a646 gate851/1skip/PG50/Vercel/browser proofs remain dated prior evidence.

Fresh initial Claude static review NEEDS-FIXES, closing f8a360b..0507536 **ACCEPT**; actualclaude-opus-5-5, high requested/effort unobserved. Tools disabled, reviewer reused owner-reported gates; no independent test claim. Actual primarymodelgpt-6.1-sol/xhigh from turn metadata, no borrowed usage/cost. Counterfactual marker removal failed lost-receipt test, exact implementation restored/passed; signal bug reproduced with actual SIGKILL then fixed to drain/exit0.

## Recent Changes

Implemented the accepted opt-in private alert flow, source-gated target creation unchanged, additive schema/outbox and API runner, membership helper extraction, tests and member guide. Fixed actual production-driver Date parameter encoding. Applied fresh review fixes: signal drain/exit, explicit Enable, community Stop controls/edit recovery, pre/post membership deadline, nonblocking subscriber snapshot, safe unstarted-claim recovery. Retained generated snapshot (review input omission was not a missing file). Built a fully validated minimal candidate from a646 so later SDK source is excluded. No external/live effect.

## Git State and publication hold

Current public originmain remains exacta646. Main last source0507536,13ahead/0behind before this documentation checkpoint. No reset/switch/rebase/prune/feature branch/PR/full-main push. Sourcefeatf8 and fix050 are local; local release candidate lives under the tag above. Receipt/docs checkpoint subject `docs: record reviewed private raid alert candidate and release scope` remains local-only. Publish only the plan's exact candidate if newly approved, never main. After accepted publication, preserve local SDK/ref history by merging the published candidate locally, then hold remaining source; no reset/rebase/delete/push-all to clear divergence.

Unpublished existing IDs:

- `5d2cf6ebf8a4071827a7a53041f6aa12cd800562` — docs: record exact publication approval and pending configuration access
- `eb454d228934c96c98b01da72520a7189561e95f` — feat: add validated public integration starter for communities
- `ff97f71595b7fde2de88da0f5b788d166aef56cd` — feat: add standalone typed public read SDK
- `fc1f379112d21dc7928fc116dabda2355b276024` — docs: authorize bounded SDK adoption arc and sync agreement v2
- `335618498ad4bb65ce9fac6ca4353ae6852816c6` — feat: adopt SDK in CLI and add local community reference app
- `010c68cfe32fd9db98fcf95e3eb273c05be4edee` — fix: harden adopter bootstrap cooldown and portable build
- `64d71bf0df4d845ee28ef91f72e232b1389bef18` — fix(demo): install tarballs portably and recover cooldown
- `202fe957af1bfba90f16ef212e940120a041f204` — fix(demo): preserve multicall entrypoint and prove timer injection
- `7f4494aa88580451d89c44dfe55c0c0aa8e3f1d6` — docs: close accepted local SDK adoption arc
- `b5ba48a42c6ac4a029d21d16bd04282ca63af35d` — docs: record exact approved web release acceptance
- `3d23691f8afc1ea7535c2e440efed0eb19bbb662` — docs: clarify engagement target authority and intake gaps
- `f8a360b19352b76a78e57adce2d4222795d20d5f` — feat: add opt-in private community raid alerts
- `050753615b456645ac7d95f5de243bec59ec68c4` — fix: harden raid alert consent recovery and API shutdown

Held scoring158452fe2b22a1e42e5efd42f3f7e11bfdf59c70 andJev707d7daf21e217d9a8a64e58514065f5e3bca45e unmerged until epoch3; rewardbranch2fd2470a26ff9a349bceeb697b2731bd1bff0e07/reviewtag2ca35057c3efbd43df191bda0d9527d526f6886f retained. Candidate tag is local retention, not registry/Git publication.

## Next Actions

One required human action: approve or hold the exact prepared live plan. Approval question is pending; elapsed time is not an answer. With approval, fresh live writer/ref/target/env/database/bot/journal/queue guards, exact-source normal gate/hooks, immutable artifact capture, only guarded0013 and API update, exact Git/CI/Vercel/API/outbox acceptance/bounded recovery. Source/ref/pin/environment/timing drift or tool-policy rejection is a real stop; no alternate push/PR. Do not execute real subscription/group/private message or phone/money steps from this plan without their own scope/attendance.

## Known Issues / Watch List

Closing static review ACCEPT retains low advisories: callback toast failure may block Stop/Enable before any success confirmation; UTF-16 clipping can reject rare long emoji-bearing alerts; platform stop budget may end an in-flight drain early (uncertain retained); test cwd portability; permanent membership failures retry conservatively until task expiry. `/help brief` exists, verified. No new source fix bundled after accepted050/c58 pins. Unknown sends intentionally may miss an alert; no resend guarantee, no raw errors/recipient IDs in logs.

Initial Postgres run:3 new Date-binding failures fixed plus1 unchanged reward cutoff-race failure; later complete53/53,55/55 and final-candidate55/55 pass. Original timing-failure cause unestablished; retain watch item, no reward/runtime/test patch. Local web metadataBase warning unchanged. No live/device/load proof from fixtures or static review.

Private DB registered identity/bot/webhook/journal/queues need fresh exact live preflight before later approved API work; presence/public200 do not prove them. Windows unavailable (do not ask again). No genuine invite/support/publishing URLs; absent buttons stay absent. Pilot hidden/recruitment held until registered-Lab phone PASS. T/B source was published in a646 but Fly bytes stilloldv11; notification release alone is not phone or C21 proof.

C1–C13 complete; C14–C22 unexecuted. [Payout readiness](demo/2026-10-08-first-payout-readiness.md) owns commands/addresses/amounts. Preserve **Oct8 pause23:00Z**, **finalC18b after23:45Z**, corrections/attestation **strictly beforeOct9 00:00Z**, post-close safety/Ledger/claim/P14 and hold through **Oct10 00:00Z inclusive**. No deployment during that sitting. Empty/no-payable means no payment. Verify0.1.0 throughOct12, one disjoint active Hyphae brief/Raidar separate. Original13:13:09Z autonomous checkpoint/historical coordinator arc not reset. Real uptake/authorship/hold, Ledger/Receive attendance, Pro/alerts before fee and final video/submission remain owner gates.

## Resume Checklist

Read this handoff/receipt/plan and actual approval before action. Verify source/candidate/ref/one writer without pruning. Reuse completed web/login/SDK reviews; never publish fullmain. Concrete new release stays blocked only by its missing approval/guards; other original scopes do not become implicitly approved. Current writerterm_dbfd2277-e18d-4cc3-88c1-1a37dc966204 launched no successor; Claude reviewer read-only/no tools, not another editor.

## Quick Reference

[Notification receipt](handoffs/2026-10-04-raid-notifications.md), [release plan](demo/2026-10-04-raid-alerts-release-plan.md), [review](reviews/2026-10-04-raid-alerts-opus.md), [member flow](community/RAID-ALERTS.md), [authority ruling](handoffs/2026-10-04-engagement-authority.md), [completed web](handoffs/2026-10-04-web-release.md), [combined historical packet](demo/2026-10-04-combined-release-packet.md), [SDK/adopter close](handoffs/2026-10-04-adopter-close.md).

## Suggested skills

handoff-memory, orca-cli for ownership/live reads, security-review, Vercel deployment/CLI for newly approved Git-triggered acceptance, handoff. karpathy-guidelines only if a new scoped repair is needed. organic-sync in its owning vault session. No Sentinel/helper product work.

## Generated artifacts this session

| What | Canonical home | Stage |
|---|---|---|
| Notification source/tests/schema/guide | apps/api/src/raid-alerts, bot commands, packages/db/drizzle/0013*, docs/community/RAID-ALERTS.md | Local, committed/reviewed |
| Exact minimal candidate | Git candidate/raid-alerts-2026-10-04 → c58aa27efdb5bc5492c2f96d45c090c9fc91d379 | Local retention, unpublished |
| Portable proof/approval scope | Notification receipt/review/release plan, this handoff/BUILDLOG | Local, committed checkpoint; shared propagation pending |
| Temporary isolated checkout/logs/model JSON | Disposable local verification | Cleaned after facts/hash retention; no durable artifact stored only in temp |

No credential, image/registry resource, VM, migration, real message/subscription/registration, wallet signature, transaction, funds movement or schedule created. ExistingSDK ignored tarball/report rebuildable and unchanged source.

## Resume Prompt

Use the next-session prompt and current recorded approval; this completed local feature needs no repeated build preparation.

## Next-session prompt

```text
Private raid alerts are built/reviewed at050753615b456645ac7d95f5de243bec59ec68c4, minimal outgoingc58aa27efdb5bc5492c2f96d45c090c9fc91d379 retained under candidate/raid-alerts-2026-10-04. Exact876/1skip/types/lint297/Drizzle/Postgres55/API+web builds PASS, fresh ClaudeOpus5.5 ACCEPT with low advisories. Current public web remains accepted exacta646; notification source/migration/API not live. Async new-release approval question issued, pending unless an actual later response records approval.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-04-raid-notifications.md, docs/demo/2026-10-04-raid-alerts-release-plan.md, docs/reviews/2026-10-04-raid-alerts-opus.md, docs/community/RAID-ALERTS.md, docs/demo/2026-10-08-first-payout-readiness.md
Model: Codex Sonnet 5 — bounded prepared release per project routing table; recommendation only, previousactualgpt-6.1-sol/xhigh.
Skills: handoff-memory, orca-cli, security-review, Vercel deployment/CLI if newly approved, handoff.
Without the new explicit approval, hold production and give only that nearest human action; do not repeat old web/login approvals. With approval, execute only namedplan guards/exactcandidate source/immutableartifact/0013/API-only effect and acceptance/rollback, preserving frozenv11worker. No fullmain/SDK publication, secret export, invented council roles, sibling write, registration/recruitment/realphone/money/message scope inferred. Preserve exactOct8–10 gates, verify0.1.0throughOct12, heldrefs and no empty-payment claim. Source changes invalidate this release pin. After accepted publication merge candidate locally to preserve held SDK work, never reset/delete/push-all.
```
