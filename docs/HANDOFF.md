---
date: 2026-10-05
summary: Oct 8 first-payout prep done on Windows (Claude Sonnet 5.5, effort high): three demo docs refreshed against live receipts, read-only audit runner added, epoch 2 has one counted member (the founder). Member journey LIVE on the API since 2026-10-05T14:26Z; worker frozen. Founder-as-only-payee wording confirmed by Cisco (plain).
---

# Hyphae handoff

## Metadata

Last Updated: 2026-10-05T20:10Z (Windows)
Project: Hyphae. Scope: October 8 first-payout preparation (docs and read-only checks); the API rollout is done and accepted.

## TL;DR

**Setup fix on `main`, release plan written, NOT deployed (2026-10-05T20:10Z, Claude Sonnet 5.5, effort high, Windows).** Evidence: 1 Telegram account (Cisco's) has ever opened a link session, so invited members never reached the wallet step. Fix: guided `/setup` (group → private five-step checklist), wallet-link message with Phantom/Solflare-browser instructions and a tap-to-copy link, "what payment needs" text and the exact token hold read from the pinned rubric and the mint's decimals. Commits `1f4a9a3` (feature) and `5808972` (review fixes). **Independent review (Codex `gpt-6-astra` xhigh, read-only, `1f4a9a3`): NEEDS-FIXES, 2 should-fix + 1 advisory, all fixed test-first in `5808972`:** hold minimum was rounded down (500000 units showed "0" and dropped the hold line; now exact decimals), payment text omitted gate conditions (now: wallet linked by signing and rules test passed before close, at least one counted reply, hold read once in the 24 h after close, per `payout/gate.ts`), and the group-callback test never used a group (now both callbacks tested from a real group chat). Verdict otherwise: no auth bypass, no link-token leak, no HTML-escaping defect, no callback collision. The fix commit itself was not re-reviewed by Codex; it is covered by the new tests. Native Windows gate on `5808972`: 788 API tests passed / 3 skipped, typecheck 0, lint 0. **Release plan:** [docs/demo/2026-10-05-setup-release-plan.md](demo/2026-10-05-setup-release-plan.md) (API machine `6839d31b317318` only, no migration, worker frozen, rollback to `sha256:798e1888…`). **Needs Cisco:** the exact sentence "yes, run the 2026-10-05 setup release plan at 5808972". After deploy: Cisco's attended phone test (group `/setup` → Start setup → Link my wallet → open in Phantom/Solflare browser → sign → Refresh → rules test) from a second Telegram account or a stuck member's phone; record where it fails. Open only if that test shows copy-and-paste is the blocker: "Open in Phantom/Solflare" deep links (threat model and a Codex review first; a one-time confirmation code is preferred over the full token in a URL). HARD STOP: no deploy and no push to `main` from 2026-10-08T22:00Z to 2026-10-10T00:00Z.

**Oct 8 prep done (2026-10-05T19:05Z, Claude Sonnet 5.5, effort high, Windows).** The [operator packet](demo/2026-10-08-first-payout-readiness.md), [video script](demo/2026-10-09-final-video.md) and [submission checklist](demo/2026-10-10-submission-checklist.md) now state only what the October 5 read-only receipts show (web runtime = source `774b97e`, API `sha256:798e1888…` with migrations 0013+0014, worker frozen `sha256:1c2d6dd5…`, chain accounts absent, Ledger authority on the program). Added to the packet: a computed one-member allocation (gross 500,000,000; fee 15,000,000; the member 121,250,000; 363,750,000 stays in the vault; **not a receipt**), a sitting timeline in UTC, the recommended plain wording if the founder is the only payee, and a **push hold on `main` from Oct 8 22:00Z to Oct 10 00:00Z** (a docs push redeploys the web). New `docs/demo/oct8-audit.mts` runs the packet's C18b SQL plus the real payout gate and allocation in one read-only transaction; rehearsed against production (1 row, 0 undecided, 0 duplicate groups, gate `not_final`). Commits: `e1b4125` (packet, video, checklist, audit runner) and the record commit that carries this paragraph. Gate before push (native Windows, 106 core + 26 read-client + 107 web + 759 API): 998 passed / 3 skipped, typecheck 0, lint 346 files 0, diff check 0.

**Remaining blockers.** (1) **Decided:** Cisco confirmed the plain wording for the founder-as-only-payee case on 2026-10-05 (“Yes, let's continue”, answering the recommendation). **Still open:** real members before the Oct 9 00:00Z close were not authorized; it stays a separate approval and would change the wording. (2) Re-run `oct8-audit` and the live reads about an hour before the Oct 8 sitting (not done: the sitting is three days out). (3) Oct 8 attended C14 to C22 needs Cisco, the Ledger and about 0.52 SOL plus fees. (4) Oct 10 00:00Z or later: Neon password rotation (Cisco). (5) Not claimed anywhere: Vercel Pro, Colosseum collaborator access, any real phone/signature/claim.

**Now (2026-10-05T14:40Z): the member journey is live on the API.** Cisco gave the exact yes; the [rollout plan](demo/2026-10-05-api-rollout-plan.md#execution-record-2026-10-05) ran end to end with every check PASS. Image `member-journey-774b97e` = `sha256:798e18880fd0ce8684c6f4627010e0653ede8a3e3e33584654f6e53cc31ac90c` on API machine `6839d31b317318` only (updated 14:26:31Z, by digest). Migrations 0013+0014 applied on the first attempt (journal 13 → 15, new tables empty, no row deltas). Worker `817400c9901de8` untouched on `sha256:1c2d6dd5…` (updated Oct 2 09:19:01Z) and still completing `reward-recovery`. `/ops` and `/receipt` answered from the new code in Cisco's private chat. Rollback (not used): `fly machine update 6839d31b317318 --app hyphae-api --image registry.fly.io/hyphae-api@sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2 --yes`; the additive tables stay.

**Windows resume (2026-10-05T15:27Z).** Native Windows gate PASS: 998 passed / 3 skipped (2 POSIX-signal shutdown tests skip on win32 by design, 1 optional devnet), typecheck 0, lint 0. Fly read: API on `sha256:798e1888…`, worker on `sha256:1c2d6dd5…` unchanged, `reward-recovery` every 5 min, no new errors. **Read-only epoch 2 preview** (one repeatable-read read-only transaction plus one finalized RPC balance read; no writes): 1 admitted contribution (a reply accepted 12:03Z today), scored and counted, **66 points**; its one member has a **signature-linked wallet**, a **rules-test pass before close** (`mycel-rules-1`, Sep 29) and a current balance **above the 100,000 MYCEL threshold**. The URL author is the founder's own X account. `chain_address` is null and intake is open, as expected before C16/C17. So unless something changes, the Oct 9 gate would likely become `ready` with **one payable member: the founder**. The preview script was session scratch; the packet's C18b SQL remains the canonical audit.

**Open human items:** (0) **Founder decision (made 2026-10-05, plain wording confirmed; real-member invitation still unauthorized):** epoch 2's only payable member is Cisco's own account. Existing rules pay it (no ruling excludes the founder), so the sitting can proceed as written. What is Cisco's to decide is the public wording (recommended: say plainly that the first mainnet payout went to the founder's own counted reply, because a payout claim that hides that would not survive a judge's check of the chain) and whether to invite real members before the Oct 9 00:00Z close (that is the separately authorized "real raid use" scope). (1) **rotate the Neon database password after Oct 10 00:00Z** (scheduled credential rotation; reason recorded privately). Rotation means Neon, then Fly `DATABASE_URL` (restarts both machines, including the worker, which is why it waits for the payout window to end), then the local `.env`. (2) `/ops` shows one pre-existing active raid (`f6799bae…`, until Oct 7 11:56Z); private alerts have 0 subscribers, so nothing is sent. Using it with members, alert subscriptions and the registered-Lab phone test need their own approval.

**The member journey is implemented and reviewed ACCEPT at `23a4f9c472c1ad06741632b57f83718ddf70b535`.** Private raid reply/quote buttons bind intake to the caller, community and exact raid. Receipts, scoring issues, lifecycle controls and a private operator view work in local fixtures. **1,000 tests passed /1 optional skip; 69/69 real PostgreSQL tests; types, lint, schema checks, API/web builds and16Python contract hashes passed.** [Full review and all repair evidence](reviews/2026-10-04-member-journey.md).

**Source push is now approved; production bot rollout is not.** After the earlier pause and explanation of held source/Git-triggered Vercel effects, Cisco said: “then fix it finish work and the push and commit and merge because tomorow ill be back at working with windows pc”. This authorizes finishing/reviewing/committing/pushing current main, including prior accepted SDK/adopter work and the existing Vercel integration. It supersedes the earlier source-publication hold; do not ask again. No production migration, Fly/API/worker update, credentials, money, real Telegram, wallet signature or attended phone testing is inferred.

**Published and accepted.** Main publication `774b97e61ae71cf6704908b28822c36c019ca097` succeeded; GitHub CI37241042904 (linked in the build log) completed **success**. Vercel production **READY**, exact source774b97e, deployment `dpl_JDXN7V9yUZzRpFkYdQpmNgSUdjwp`, alias [hyphae-delta.vercel.app](https://hyphae-delta.vercel.app). Home/community/Lab/API-health HTTP200 and8referenced assets passed. API and worker remain started on the original frozen digest. No rollback was needed. This final documentation checkpoint follows that verified source publication; it changes no runtime code.

## Current Objective

**Current:** API rollout done and accepted (2026-10-05). Next live scopes need their own approval. Earlier: **source arc complete.** Current feature work is already integrated directly on main; no separate feature branch or PR merge is needed. Do not merge the older epoch-held reward/scoring/Jev refs. Next source work requires a new task; production bot activation remains separately gated.

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

Old tag `candidate/raid-alerts-2026-10-04` remains exactly `c58aa27efdb5bc5492c2f96d45c090c9fc91d379` and, with `review/community-setup-initial-2026-10-03` (`2ca35057`), was pushed to GitHub on 2026-10-05 so every ref exists off this Mac. Its old exact-source migration/API plan is not permission for current main. Held scoring158452fe2b22a1e42e5efd42f3f7e11bfdf59c70 andJev707d7daf21e217d9a8a64e58514065f5e3bca45e remain unmerged until epoch3; rewardbranch2fd2470a26ff9a349bceeb697b2731bd1bff0e07/reviewtag2ca35057c3efbd43df191bda0d9527d526f6886f retained. No reset/rebase/prune/tag movement/force push.

## Known Issues / Watch List

- Organic task3.6/DEP-09 must supply verified community-role/Telegram binding, grant/revoke authority, authenticated issuer/transport, freshness/revocation and replay-safe audit before steward permissions can be implemented. Current designated-admin fallback is intentional; no invented allowlist or Telegram-admin equivalence.
- Independent X relation/ownership verification is unavailable from existing oEmbed. Keep unverified status and current human attestation; no payment proof inferred.
- Production bot release, actual Telegram messages, attended phone, wallet signatures and claim transactions need their separate scope. Spending caps or cancellation effects on credit/allocation require a founder decision; none chosen.
- Accepted low advisories: app-level append-only audit under trusted DB operators; optional prompt lookup index; permissive-but-canonicalized X URL suffix; cosmetic empty keyboard/ZWJ flattening; PG tests rely on their serial disposable runner. No review blocker remains.

## Preserved payout safeguards

C1–C13 complete; C14–C22 unexecuted. `docs/demo/2026-10-08-first-payout-readiness.md` remains canonical. Preserve Oct8 pause23:00Z, finalC18b after23:45Z, corrections/attestation strictly beforeOct9 00:00Z, post-close safety/Ledger/claim/P14 and hold throughOct10 00:00Z inclusive. No deployment during that sitting. Empty/no-payable means no payment. Verify0.1.0 throughOct12; one disjoint Hyphae brief/Raidar separate. Original13:13:09Z checkpoint not reset. Recruitment stays hidden until registered-Lab real-phone PASS; actual uptake/authorship/hold and owner attendance remain unproved. Siblings/shared vault read-only.

## Next Actions

On Windows, inspect `git status -sb`, preserve any unrelated local changes, switch to main if needed, then `git pull --ff-only origin main`. Read this handoff. Do not reset/stash/drop unknown work automatically. Current source is on GitHub; no secrets or local logs need copying from this Mac. Node22.12+ is required by installed pg-boss; locally validated onNode24.14/pnpm10.29.3 and GitHubCI onNode22. Native Windows execution remains unobserved. PostgreSQL runner uses bash/Docker (WSL where needed); never point it at production.

**API rollout done (2026-10-05T14:26Z).** Do not rerun the plan; its migrations are applied and its `migrate` refuses a 15-row journal. Before the Oct 8 sitting: watch `/ops` and worker logs read-only if useful. No deployment from Oct 8 23:00Z to Oct 10 00:00Z. After Oct 10: Neon password rotation (Cisco). Separate approvals: real raid use with members, alert subscriptions, phone test.

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
| Rollout scripts and rehearsal | `scripts/rollout/`, plan Step 2 | Committed; rehearsed on disposable Postgres only |
| Temporary logs/review JSON | ignored `.member-journey-*.log` inside repo | Optional local diagnostics; necessary facts preserved in tracked docs |

GitHub main updated and its automatic Vercel web deployment created; no other production resource changed. No credential, OS privilege change, real message/signature/transaction, payout or schedule created. Test PostgreSQL containers removed by runners. No active source worker remains; final review complete.

## Resume Prompt

Use the next-session prompt after pulling main on Windows. The implementation/review/publication arc is complete; do not restart it.

## Resume on Windows (2026-10-05)

Everything needed is on GitHub: `main`, the held branches `feat/rules-v2` (scoring `158452fe`) and `feat/jev-eval` (Jev `707d7daf`), and every tag. The reward branch `2fd2470a` is already in `main`. Nothing on the Mac is required.

1. `git fetch origin --tags`, then `git switch main` and `git pull --ff-only origin main`. Expect the head of `main` at or after the commit carrying this section.
2. Keep the existing Windows `.env`. It must have the same `DATABASE_URL` and `TELEGRAM_BOT_TOKEN` as production. Never commit it.
3. `pnpm install --frozen-lockfile`, then the gate: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
4. Read the TL;DR above. The API rollout is done; do not rerun it.

Mac-only items you can ignore: `.member-journey-*.log` diagnostics (their facts are in `docs/reviews/`); the rollout check reports in the Mac session scratchpad (their results are in the plan's execution record; the raw files hold the DB host and Telegram IDs, so they stay off the repo); generated `apps/web/AGENTS.md`/`CLAUDE.md`, `next-env.d.ts` and `packages/read-client/LICENSE`; the `docs/plans/` mirror (copy from the vault when needed). The Mac `.env` stays on the Mac; after the Oct 10 password rotation, update the Windows `.env` too.

## Next-session prompt

```text
Continue Hyphae. Read CLAUDE.md, docs/HANDOFF.md, docs/demo/2026-10-08-first-payout-readiness.md (live receipts, timeline, founder wording) and the execution record in docs/demo/2026-10-05-api-rollout-plan.md.
Oct 8 prep is done (packet, video script and checklist refreshed; docs/demo/oct8-audit.mts is the read-only audit runner). Next: Cisco confirms the founder-as-only-payee wording; about an hour before the sitting, re-run oct8-audit and the live reads; then the attended sitting. No push to main Oct 8 22:00Z - Oct 10 00:00Z.
The member journey is LIVE since 2026-10-05T14:26Z: API 6839d31b317318 on sha256:798e18880fd0ce8684c6f4627010e0653ede8a3e3e33584654f6e53cc31ac90c, migrations 0013+0014 applied, worker 817400c9901de8 frozen on sha256:1c2d6dd5... and unchanged. Acceptance passed. Do not rerun the rollout.
Next priorities: the Oct 8 first-payout sitting per docs/demo/2026-10-08-first-payout-readiness.md (no deployment Oct 8 23:00Z - Oct 10 00:00Z); after Oct 10, Cisco rotates the Neon DB password (Neon -> Fly DATABASE_URL -> local .env; restarts both machines).
Separately authorized only: real raid use with members, private alert subscriptions, registered-Lab phone test, Telegram messages, signatures, claims.
Preserve: reward/epoch/payout rules, held refs (158452fe, 707d7daf, 2fd2470a, tag c58aa27), designated-admin fallback until Organic's council contract, X relation/ownership unverified.
```
