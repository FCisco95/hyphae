---
date: 2026-10-04
summary: Member journey finished, reviewed ACCEPT and published to main; GitHubCI success and Vercel READY verified. Windows can pull main. Production bot rollout remains separate.
---

# Hyphae handoff

## Metadata

Last Updated: 2026-10-04T22:49:56Z
Project: Hyphae. Scope: reviewed member journey, source publication and Windows continuation.

## TL;DR

**The member journey is implemented and reviewed ACCEPT at `23a4f9c472c1ad06741632b57f83718ddf70b535`.** Private raid reply/quote buttons bind intake to the caller, community and exact raid. Receipts, scoring issues, lifecycle controls and a private operator view work in local fixtures. **1,000 tests passed /1 optional skip; 69/69 real PostgreSQL tests; types, lint, schema checks, API/web builds and16Python contract hashes passed.** [Full review and all repair evidence](reviews/2026-10-04-member-journey.md).

**Source push is now approved; production bot rollout is not.** After the earlier pause and explanation of held source/Git-triggered Vercel effects, Cisco said: “then fix it finish work and the push and commit and merge because tomorow ill be back at working with windows pc”. This authorizes finishing/reviewing/committing/pushing current main, including prior accepted SDK/adopter work and the existing Vercel integration. It supersedes the earlier source-publication hold; do not ask again. No production migration, Fly/API/worker update, credentials, money, real Telegram, wallet signature or attended phone testing is inferred.

**Published and accepted.** Main publication `774b97e61ae71cf6704908b28822c36c019ca097` succeeded; GitHub CI37241042904 (linked in the build log) completed **success**. Vercel production **READY**, exact source774b97e, deployment `dpl_JDXN7V9yUZzRpFkYdQpmNgSUdjwp`, alias [hyphae-delta.vercel.app](https://hyphae-delta.vercel.app). Home/community/Lab/API-health HTTP200 and8referenced assets passed. API and worker remain started on the original frozen digest. No rollback was needed. This final documentation checkpoint follows that verified source publication; it changes no runtime code.

## Current Objective

**Source arc complete.** Leave the final documentation synchronized on main for Windows. Current feature work is already integrated directly on main; no separate feature branch or PR merge is needed. Do not merge the older epoch-held reward/scoring/Jev refs. Next source work requires a new task; production bot activation remains separately gated.

## Current State

| Area | Completed behavior / limit |
| --- | --- |
| Exact intake | Private expiring prompt/explicit prompt ID binds caller, community, raid and reply/quote kind. No latest-task fallback. Current membership checked before/after evidence retrieval, outside the community reward lock; chat/member/window and duplicate/kind checks are authoritative under the lock. |
| Receipts and queue | Contribution and receipt persist once. The pg-boss job and queued confirmation commit atomically under a receipt-only lock; concurrent retries, rollback and lost acknowledgement tested with the real driver. Reward receipt time equals canonical intake acceptance. Saved legacy work without dispatch requires member retry; operator view shows it. |
| Verification | Target relation and X account ownership are separate and explicitly unverified. oEmbed supplies text/displayed author, not structured target relation or control of that account. First-seen handle claims and model opinion are not proof. Current payout's approved human attestation remains required. |
| Results/disputes | `/receipt`/Refresh shows received, pending, scored, counted/excluded and reason using existing effective/frozen results. Distinguishes provisional points, eligibility, allocation, chain claimability and confirmed payment. `/issue` appends a caller-scoped report without changing any score or decision. Exact retries reuse the report. |
| Lifecycle/authority | Current designated admin chooses targets and closes/cancels an exact brief with a reason and audit event. One active brief is enforced. Historical non-raid open briefs have an authorized exit. Cancellation stops new intake/alerts, preserving earned credit/history. Task NKU before community NKU keeps reward writes available during alert waits; authority rechecked after waiting. |
| Operator | `/ops <community ID>` in the designated admin's own private chat reads raid states, delivery failures/uncertainty, scoring/queue backlog, retained jobs, issue reports and recorded/unknown model cost. Read-only, community-scoped and reauthorized before returning. Missing job telemetry is unknown, not zero. |
| Technical bounds | 10 new prompts per caller/community per rolling hour; 3 reports per receipt,60seconds between distinct reports; exact message retries exempt. These bound abuse, not spending or reward entitlement. Unicode/control-safe receipts/operator messages;4-second notification call bounds. |
| Frozen behavior | Worker/jobs/rewards/payout/core/program source unchanged through this arc. Existing scorer still announces in group, disclosed before intake and on receipt; only group raid message IDs are passed to it. Private legacy intake respects pause; old standalone group-text behavior remains unchanged. |
| Phone | Actual bot/notifier transport fixtures cover reply/quote, cancellation/retry, receipt/dispute, and reward scoring→effort upgrade→public audit parsing. [Phone script](community/MEMBER-PHONE-TEST.md) also maps joining/wallet/rules fixtures. No real phone/signature/claim execution or native Windows proof. |

## Validation

Final source `23a4f9c472c1ad06741632b57f83718ddf70b535`: `pnpm test --maxWorkers=4` **1,000 passed /1 optional skip** (106core,26read-client,107web,761API); real disposablePostgres **69/69**,10files; typecheck0,lint343files0,Drizzlecheck0,API+webbuilds0,diffcheck0; Python16H-CONTRACT hashes reproduced. Final source unit/type/lint gate repeated before publication. First milestone96b3629 had974/59; first repairsf3aa3e0 had997/67. Those earlier counts are historical.

Fresh Claude Opus5.5 static reviews: initial NEEDS-FIXES; second confirms those fixed but finds transitive lock contention; final **ACCEPT**, session `8a60ccd2-de25-4de3-b26b-191549521c68`. High requested, tools disabled, no independent reviewer test execution claim. Real regressions were observed failing before fixes: malformed Unicode boundaries, capture compatibility, network-held community lock, duplicate standard-queue jobs, mutable cancellation time, transitive alert/cancel lock, canonical receipt time and injected status-line controls. Details/verbatim responses are tracked in the review.

Migrations0000–0013 unchanged. `0013_raid_alerts.sql` SHA256 `7e0f951e3548d335dd8f299390daba14f6d8a6a3f79277a2068b2ecd4cc4b022`; additive0014 SHA256 `fa479c949a4c2c96234be8ddb2034c8ddaec00df836bcc8e14e199cc743e5485`; snapshot/journal tracked, no generation delta. Migration fixtures only; production remains unmigrated for these features.

## Recent Changes

- `96b36296902775b6618c584b37fdaf973f3eb291` — member journey implementation.
- `0c3fd20` — portable pause checkpoint with the initial findings.
- `f3aa3e08477ca1f95c68ed8245f9aa539d76678e` — membership lock/capture/Unicode/atomic queue repairs and advisory fixes.
- `23a4f9c472c1ad06741632b57f83718ddf70b535` — transitive cancellation lock, explicit call bounds, canonical receipt time and control-safe fields.
- `774b97e61ae71cf6704908b28822c36c019ca097` — accepted-review/authorization checkpoint, pushed with all preceding main commits; remote CI and Vercel passed.
- This final documentation checkpoint records the actual publication receipts and Windows continuation; its commit subject is `docs: record successful publication and Windows handoff`.

Earlier SDK/adopter/private-alert commits on main are also now on GitHub. Do not repeat their implementation/reviews. SDK package publication was not performed. Historical pending lists in older dated entries are superseded by this completed source push. `git log origin/main..HEAD` should be empty after the final docs sync.

## Git and live state

Main source publication through774b97e is complete. Vercel project `prj_zGEwnzy5ATqVXru7apeDkPfrcHSM`, team `team_d8lkX495txxwACU8i2Ode2KF`, root `apps/web`, Node24 verified. Alias `hyphae-delta.vercel.app` served productionREADY `dpl_JDXN7V9yUZzRpFkYdQpmNgSUdjwp`, exact774b97e. Repository isPUBLIC; no private vault/secret material added. CI/program workflows contain no Fly/API deployment or production migration; repository webhooks empty. Final documentation pushes can trigger the same existing web integration; compare runtime trees if the displayed Git SHA is newer than this source-publication receipt.

After source push, Fly API `6839d31b317318` and worker `817400c9901de8` both freshly read as **started**, image tag `deployment-01M3XYDW5XW7AEAY68CKVPKC2X`, actual digest `sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2`. No machine/config change. Source publication does not make the bot feature live. A future API rollout requires a new approved artifact/database plan and migrations0013+0014 first, preserving the frozen worker; no live DB connection, migration or message was used for this arc.

Old tag `candidate/raid-alerts-2026-10-04` remains exactly `c58aa27efdb5bc5492c2f96d45c090c9fc91d379`, retained locally. Its old exact-source migration/API plan is not permission for current main. Held scoring158452fe2b22a1e42e5efd42f3f7e11bfdf59c70 andJev707d7daf21e217d9a8a64e58514065f5e3bca45e remain unmerged until epoch3; rewardbranch2fd2470a26ff9a349bceeb697b2731bd1bff0e07/reviewtag2ca35057c3efbd43df191bda0d9527d526f6886f retained. No reset/rebase/prune/tag movement/force push.

## Known Issues / Watch List

- Organic task3.6/DEP-09 must supply verified community-role/Telegram binding, grant/revoke authority, authenticated issuer/transport, freshness/revocation and replay-safe audit before steward permissions can be implemented. Current designated-admin fallback is intentional; no invented allowlist or Telegram-admin equivalence.
- Independent X relation/ownership verification is unavailable from existing oEmbed. Keep unverified status and current human attestation; no payment proof inferred.
- Production bot release, actual Telegram messages, attended phone, wallet signatures and claim transactions need their separate scope. Spending caps or cancellation effects on credit/allocation require a founder decision; none chosen.
- Accepted low advisories: app-level append-only audit under trusted DB operators; optional prompt lookup index; permissive-but-canonicalized X URL suffix; cosmetic empty keyboard/ZWJ flattening; PG tests rely on their serial disposable runner. No review blocker remains.

## Preserved payout safeguards

C1–C13 complete; C14–C22 unexecuted. `docs/demo/2026-10-08-first-payout-readiness.md` remains canonical. Preserve Oct8 pause23:00Z, finalC18b after23:45Z, corrections/attestation strictly beforeOct9 00:00Z, post-close safety/Ledger/claim/P14 and hold throughOct10 00:00Z inclusive. No deployment during that sitting. Empty/no-payable means no payment. Verify0.1.0 throughOct12; one disjoint Hyphae brief/Raidar separate. Original13:13:09Z checkpoint not reset. Recruitment stays hidden until registered-Lab real-phone PASS; actual uptake/authorship/hold and owner attendance remain unproved. Siblings/shared vault read-only.

## Next Actions

On Windows, inspect `git status -sb`, preserve any unrelated local changes, switch to main if needed, then `git pull --ff-only origin main`. Read this handoff. Do not reset/stash/drop unknown work automatically. Current source is on GitHub; no secrets or local logs need copying from this Mac. Node22.12+ is required by installed pg-boss; locally validated onNode24.14/pnpm10.29.3 and GitHubCI onNode22. Native Windows execution remains unobserved. PostgreSQL runner uses bash/Docker (WSL where needed); never point it at production.

**API rollout plan written, awaiting Cisco's exact yes (2026-10-05):** [docs/demo/2026-10-05-api-rollout-plan.md](demo/2026-10-05-api-rollout-plan.md) pins runtime source `774b97e`, migrations 0013+0014 (hashes verified) in one atomic run, an update of only API machine `6839d31b317318`, the frozen worker untouched, and a rollback to the frozen digest. Prepared, not authorized, not executed; this Mac has no `.env` (open item 1). Not during the Oct 8 23:00Z to Oct 10 00:00Z sitting.

The next bounded live step, if Cisco wants it, is a separately approved current-source API-only release plan with migrations0013+0014 and frozen-worker/epoch guards. Existing c58aa27plan is historical and must not be reused for newer source. Actual Telegram/phone/signatures/claims remain their own scopes. Organic's verified role/Telegram contract is the independent steward integration dependency.

## Quick Reference

[Review](reviews/2026-10-04-member-journey.md) · [member guide](community/MEMBER-RECEIPTS.md) · [authority dependency](community/COUNCIL-AUTHORITY.md) · [phone script](community/MEMBER-PHONE-TEST.md) · [prior paused snapshot](handoffs/2026-10-04-member-journey-paused.md) · [payout runbook](demo/2026-10-08-first-payout-readiness.md).

## Resume Checklist

Read guidance and this handoff, verify Git/CI/live evidence stage, reuse accepted source reviews and completed tests. Source push is authorized; older dated pause/source-hold notes do not override the latest user instruction. Production migration/API/money holds still apply. Preserve held refs and payout dates. Native Windows and real-phone execution are unknown until observed.

## Suggested skills

handoff-memory; Vercel deployment/CLI for existing Git integration acceptance; security-review/karpathy-guidelines only for concrete new findings; handoff. Organic role-contract work belongs to its owner. Use parallel-feature-development if delegating with explicit ownership; do not launch another implementation arc without need.

## Generated artifacts this session

| What | Canonical location | Stage |
| --- | --- | --- |
| Member journey and fixes | source commits96b3629/f3aa3e0/23a4f9c; `apps/api/src/member-journey/`, bot/alerts | On GitHub main, reviewedACCEPT; bot rollout pending |
| Additive schema | `packages/db/drizzle/0014_member_journey.sql`, snapshot/journal | Production unapplied |
| Review and proof | `docs/reviews/2026-10-04-member-journey.md`, member/operator/phone guides | Portable, no secret or private-vault content |
| Handoff/build log | `docs/HANDOFF.md`, `docs/BUILDLOG.md`, `docs/handoffs/2026-10-04-member-journey-published.md` | Portable completed publication checkpoint |
| Temporary logs/review JSON | ignored `.member-journey-*.log` inside repo | Optional local diagnostics; necessary facts preserved in tracked docs |

GitHub main updated and its automatic Vercel web deployment created; no other production resource changed. No credential, OS privilege change, real message/signature/transaction, payout or schedule created. Test PostgreSQL containers removed by runners. No active source worker remains; final review complete.

## Resume Prompt

Use the next-session prompt after pulling main on Windows. The implementation/review/publication arc is complete; do not restart it.

## Next-session prompt

```text
Resume Hyphae on Windows after pulling main. The member journey is finished and published: source23a4f9c, publication774b97e, fresh ClaudeOpus5.5 ACCEPT;1000unit/1skip,69PG,types/lint343/Drizzle/API+web builds and16Python hashes pass. GitHubCI37241042904 success; VercelREADY dpl_JDXN7V9yUZzRpFkYdQpmNgSUdjwp served exact774b97e at hyphae-delta.vercel.app; home/community/Lab/APIhealth and8assets pass. Later documentation-only HEAD may differ; runtime source is unchanged. All prior accepted SDK/adopter/private-alert main commits were pushed. No feature branch merge remains.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-04-member-journey-published.md, docs/reviews/2026-10-04-member-journey.md, docs/community/MEMBER-RECEIPTS.md, docs/community/COUNCIL-AUTHORITY.md, docs/community/MEMBER-PHONE-TEST.md, docs/demo/2026-10-08-first-payout-readiness.md
Model: Codex Sonnet5 per repository routing recommendation — bounded continuation; use the available runtime truthfully.
Skills: handoff-memory, handoff; security-review/Vercel skills only if the next authorized task needs them.
Verify local Git status and preserve any unrelated Windows changes. Reuse this completed work. Production bot features are NOT deployed: FlyAPI6839d31b317318 andworker817400c9901de8 remain started on originalsha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2. API-only rollout needs a newly approved current-source artifact/migrations0013+0014 plan; oldc58aa27candidate is retained but not the current release. Keep frozen worker/epoch/payout calculations and Oct8–10 safeguards, held refs and sibling/vault boundaries. Council contract and independent X verification remain missing; designated-admin guard, explicit unverified receipt states and current human attestation remain. Real Telegram/phone/signatures/claims need separate scope. Native Windows tests are unproved until run. No OS password task remains.
```
