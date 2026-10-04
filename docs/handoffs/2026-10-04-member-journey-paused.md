---
date: 2026-10-04
summary: Paused by user. Member journey committed locally at96b3629; tests pass, fresh Claude review NEEDS-FIXES. No review repairs or release performed.
---

# Hyphae handoff

## Metadata

Last Updated: 2026-10-04T22:13:23Z
Project: Hyphae. Scope: local raid-specific submission, receipts/disputes, lifecycle and operator visibility.

## TL;DR

**Member journey is built locally at `96b36296902775b6618c584b37fdaf973f3eb291`.** Private raid reply/quote buttons → caller/community/raid-bound prompt → membership/window/admission checks → durable receipt → refreshable provisional/frozen result → original-submission issue report. Close/cancel preserve history and credit; one active brief is enforced. `/ops <community ID>` is a private read-only designated-admin view. New schema is additive `0014_member_journey.sql` (4 tables).

**Paused by the user. Fresh Claude review returned NEEDS-FIXES; no repairs started.** Three blockers: Unicode truncation in operator messages; new unproved labels in the frozen reward capture; Telegram network lookup held under the community reward lock. All13 advisories are retained, especially possible duplicate legacy enqueue/lost acknowledgement. Read the [complete review and repair order](reviews/2026-10-04-member-journey.md). Tests passing is not release acceptance.

**All work remains local.** User explicitly authorized implementation/testing/commits, forbade deployment/production writes/full-main push/held-ref changes. Original private-alert candidate `candidate/raid-alerts-2026-10-04` still points to `c58aa27efdb5bc5492c2f96d45c090c9fc91d379`; its release approval remains pending. New source is not that candidate and cannot inherit its old plan or pin.

## Current Objective

**Paused.** User requested “maybe lets pause and note everything that got done and whats not”. This checkpoint records completed local work and open review findings; it authorizes no continued implementation while paused. On a later resume, reproduce and fix the review findings test-first, rerun affected gates, and get a fresh closing review. No live work is authorized.

No agent, test or reviewer remained active when checked. The unrelated macOS administrator dialog was understood to be cleared after the user said “clean now”; no OS privilege, credential or system change was made and no password action is pending.

## Current State

| Area | Working local behavior / boundary |
| --- | --- |
| Private intake | Exact session ID and forced-reply message bind caller/community/raid/kind; no latest-task fallback. Current membership rechecked after evidence fetch; database clock and community lock fence expiry/close/admission. **B3 open:** move the external lookup outside that shared lock. Existing linked-member, account cap, duplicate/kind, pause/epoch rules reused. |
| Retry/cancel | One receipt/contribution per accepted prompt; same artifact replay returns it. Failed queue dispatch stays pending and retryable without a new contribution; concurrent/lost-ack enqueue safety remains advisory4, unproved. Cancel prompt affects only future input. Close/cancel stop future intake/alerts and retain history. |
| Evidence | X oEmbed captures text/displayed author, not structured reply/quote-parent proof or caller account ownership. Both verification states remain explicitly unverified; no model/handle binding treated as proof. **B2 open:** remove/prove compatibility of new labels appended to frozen capture metadata. Approved current-payout human attestation preserved. |
| Member result | `/receipt`/Refresh uses existing effective decision and frozen snapshot. Shows received/pending/scored/counted/excluded and reason, separates provisional points, eligibility, allocation, chain claimability and confirmed payment. No chain-payment claim from cached rows. |
| Disputes | `/issue <receipt ID> <reason>` stores bounded, append-only caller-scoped report; retry returns same ID. `/ops` shows count/latest3 references/reasons. No automatic rescoring/correction/frozen overwrite. |
| Lifecycle/authority | Current designated admin only, checked under community lock for open/close/cancel. `/close_raid` and `/cancel_raid` require exact group/task/reason and write actor/time audit. Cancellation is status closed plus cancelled event for frozen-worker compatibility, never credit reversal. |
| Council | Grant/revoke blocked on Organic task3.6/DEP-09 contract: verified community-scoped role and Telegram principal binding, issuer/transport/audience, grant/revoke capabilities, version/freshness/revocation fence and replay-safe audit. No local steward allowlist or Telegram-admin equivalence. See `docs/community/COUNCIL-AUTHORITY.md`. |
| Operator | `/ops <community ID>` own private chat, current designated admin checked before/after read. Raid states, failed/uncertain sends, scoring/queue backlog, retained attributed jobs, issue reports, known model-cost estimate and unknown usage. Read-only; no spending limits chosen. **B1 open:** operator text clipping can split emoji. |
| Frozen worker | Jobs/rewards/payout/core/worker bytes unchanged. Existing scorer still announces results in group; submission prompt discloses this, and contribution references the group's raid message rather than any private message ID. Private receipt refresh is available. |
| Phone | Actual bot/notifier intercepted fixture flow passes; existing joining/wallet/rules fixtures reused. `docs/community/MEMBER-PHONE-TEST.md` contains the unexecuted attended phone script. No real Telegram message/signature/phone/claim proof. |

## Validation

Committed milestone unit gate: `pnpm test --maxWorkers=4` **974 passed /1 optional skip** (106 core,26 read-client,107 web,735 API). Types exit0; Biome338files exit0; Drizzle check0/generate no changes; API build0; diff-check0. Final exact-source disposable Postgres **59/59** (9files), including4 new two-pool races. New58unit/integration cases include actual bot buttons→prompt→receipt→refresh→issue, wrong/cross-community users, revoked admin/membership, duplicate retries, queue failure, expiry, cancellation, frozen late results, cost uncertainty and read-only view. All Telegram/provider traffic in tests is intercepted/fixtures. Existing optional devnet test remains skipped.

Initial new PG fixture mint collision was repaired with unique IDs; final run green. Early broad test run overlapped edits and failed stale assertion/SQL/fixture variants; stable rerun above passed. No runtime reward patch. No new dependency, program, payout math or safeguard changes.

Migration0013 SHA256 remains `7e0f951e3548d335dd8f299390daba14f6d8a6a3f79277a2068b2ecd4cc4b022`; new0014 SHA256 `fa479c949a4c2c96234be8ddb2034c8ddaec00df836bcc8e14e199cc743e5485`. Historical0000–0013 unchanged; generated0014 snapshot/journal tracked. Local migration fixtures only, never production.

## Git State and release holds

Local main15ahead before this documentation checkpoint. The checkpoint will be committed locally; full-main push is forbidden by the current prompt. Public origin/main remains last known `a646abc883131ff411d5dd7bbba536176364fe38`; no network verification or release in this arc. Existing accepted web/Vercel receipt remains `docs/handoffs/2026-10-04-web-release.md`. Fly API6839d31b317318 and worker817400c9901de8 were last recorded frozenv11 digest `sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2`; no runtime change. Original `docs/demo/2026-10-04-raid-alerts-release-plan.md` is for its old exact candidate, not new member-journey source. Do not republish changed source under it.

Held scoring158452fe2b22a1e42e5efd42f3f7e11bfdf59c70 andJev707d7daf21e217d9a8a64e58514065f5e3bca45e remain unmerged until epoch3; rewardbranch2fd2470a26ff9a349bceeb697b2731bd1bff0e07/reviewtag2ca35057c3efbd43df191bda0d9527d526f6886f retained. No branch/reset/rebase/ref alteration/push. SDK/adopter work remains held and was not rebuilt separately except normal workspace gate dependency scripts.

Exact unpublished commits at milestone:

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
- `e1f2c51cc4d3060aaa695a79b001503cb04e05f1` — docs: record reviewed private raid alert candidate and release scope
- `96b36296902775b6618c584b37fdaf973f3eb291` — feat: complete private raid submissions and member audit journey

## Next Actions

Remain paused until the user resumes. Then follow `docs/reviews/2026-10-04-member-journey.md`: regressions first for B1/B2/B3, explicit queue concurrency/lost-ack investigation, triage all advisories, appropriate gates, a fix commit and fresh closing review. No source repair has been applied after96b3629.

## Genuine Dependencies

 Organic contract is the nearest dependency for actual steward grant/revoke; retain designated-admin guard until provided. Verified X target/account evidence is unavailable from existing oEmbed; maintain explicit unverified status and approved human attestation. Any earned-credit/allocation cancellation effect or spending cap is a founder decision; none implemented. New release plan/pin and explicit publication/migration/API authorization are required before live changes. Real Telegram/phone/wallet signatures and claim transactions remain separate scopes. No prompt for old web/login approval is needed.

## Preserved payout safeguards

C1–C13 complete; C14–C22 unexecuted. `docs/demo/2026-10-08-first-payout-readiness.md` remains canonical. Preserve Oct8 pause23:00Z, finalC18b after23:45Z, corrections/attestation strictly beforeOct9 00:00Z, post-close safety/Ledger/claim/P14 and hold throughOct10 00:00Z inclusive. No deployment during that sitting. Empty/no-payable means no payment. Verify0.1.0throughOct12; one disjoint Hyphae brief/Raidar separate. Original13:13:09Z autonomous checkpoint not reset. Hidden recruitment until registered-Lab real-phone PASS, real uptake/authorship/hold and owner attendance remain unproved. Siblings/shared vault stay read-only.

## Known Issues / Watch List

The complete review has3 blockers and13 advisories; all are open. Besides the blockers: stale `/effort` guidance/new standalone URL behavior, non-raid active-brief close gap, mutable repeat-cancel timestamp, concurrent/ambiguous enqueue, missing-queue read inside an outer transaction, retry after membership loss, fallback group messageID0, unbounded prompt/report creation, confirmation of old intake gates, app-only audit immutability, scheduled/upcoming naming drift, existing alert emoji clipping, and actual-bot reward-lane coverage. No speculative fix was implemented during pause.

## Recent Changes

One implementation milestone96b3629 adds the local member journey and4 additive tables. This documentation-only pause checkpoint adds the full review, current handoff, dated snapshot and build log. Prior alert acceptance remains scoped only to0507536/c58aa27. New implementation is review-blocked, not accepted for release.

## Quick Reference

[Review / repair order](reviews/2026-10-04-member-journey.md) · [member receipts](community/MEMBER-RECEIPTS.md) · [authority dependency](community/COUNCIL-AUTHORITY.md) · [phone fixture / attended script](community/MEMBER-PHONE-TEST.md) · [prior notification receipt](handoffs/2026-10-04-raid-notifications.md) · [preserved payout runbook](demo/2026-10-08-first-payout-readiness.md).

## Resume Checklist

Confirm the user resumed. Read guidance, this handoff and full review; verify HEAD/status/held refs without resetting work. Reuse974/59 gate evidence and existing alert reviews, then run meaningful regressions for the actual repairs. Preserve main, frozen worker, payout dates, original candidate and sibling/vault read-only boundary. Do not mistake this pause checkpoint for review acceptance or release permission.

## Suggested skills

handoff-memory; security-review and karpathy-guidelines for concrete review repairs; parallel-feature-development if explicitly delegating with file ownership; handoff. Organic integration belongs to its owning workstream, not a sibling write from Hyphae. Vercel/orca release skills only for a separately authorized live arc.

## Generated artifacts this session

| What | Canonical location | State |
| --- | --- | --- |
| Member journey source/tests | `apps/api/src/member-journey/`, new bot commands and alert controls | Committed locally96b3629 |
| Additive schema | `packages/db/drizzle/0014_member_journey.sql`, snapshot/journal | Committed; production untouched |
| Member/operator/phone guides | `docs/community/` | Committed; phone live script unexecuted |
| Full review and provenance | `docs/reviews/2026-10-04-member-journey.md` | NEEDS-FIXES; verbatim response and repair order retained |
| Review input/output and logs | Ignored `.member-journey-*.log` files inside repo | Disposable; necessary facts are in tracked documents |
| Handoff/build evidence | `docs/HANDOFF.md`, `docs/handoffs/2026-10-04-member-journey-paused.md`, `docs/BUILDLOG.md` | Documentation-only local pause checkpoint |

No credential, OS admin change, deployed image, real message, wallet signature, transaction, payout, new schedule or remote resource created. Disposable test PostgreSQL container removed by test runner.

## Resume Prompt

Use the following after the user explicitly resumes. Do not rerun completed preparation as a substitute for fixing the findings.

## Next-session prompt

```text
Resume Hyphae's local member-journey arc, paused by user after implementation commit96b36296902775b6618c584b37fdaf973f3eb291. Unit974/1skip, PG59/59, types/lint338/Drizzle/API build passed. Fresh actual ClaudeOpus5.5 review is NEEDS-FIXES; no review repairs have started. The three blockers and all13 advisories are preserved verbatim in the tracked review; passing tests are not release acceptance.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/reviews/2026-10-04-member-journey.md, docs/community/MEMBER-RECEIPTS.md, docs/community/COUNCIL-AUTHORITY.md, docs/community/MEMBER-PHONE-TEST.md, docs/demo/2026-10-08-first-payout-readiness.md
Model: Codex Opus 4.8 (high) per repository routing recommendation — sensitive review repair; report actual runtime truthfully and do not invent availability.
Skills: handoff-memory, security-review, karpathy-guidelines, handoff.
Reproduce/fix Unicode clipping, preserve frozen capture semantics, move Telegram membership I/O outside the shared reward lock while retaining acceptance checks, and investigate concurrent/lost-ack legacy enqueue before closing the review. Triage every advisory, add actual-bot reward-lane coverage, run appropriate gates, commit locally, and obtain fresh other-family closing review. No push/deployment/production changes are authorized. Keep frozen worker/payout rules/safeguards, candidate/raid-alerts-2026-10-04 atc58aa27 and all other held refs unchanged. Organic role/Telegram contract and independent X ownership/relation evidence remain unavailable; preserve explicit unverified status and current human attestation. Real phone/signatures/claims need separate scope. No OS password task remains pending.
```
