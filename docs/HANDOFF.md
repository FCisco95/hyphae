---
date: 2026-10-09
summary: Cisco explicitly paused all funding/payout actions, then requested a clearer scalable community website and email/wallet login. Product discovery is active; no product implementation or provider/domain changes. Prior preflight receipts remain historical; reviewed next held.
---

# Hyphae handoff

## TL;DR

**Funding and payouts are explicitly PAUSED by Cisco.** He said he does not want to pay already, then redirected work to a clearer, scalable community website with possible community domains/subdomains and email/wallet login. Do not act on the earlier Ledger-readiness question or resume C14–C22 without his explicit instruction.

Active next question: should the website offer the complete member journey with Telegram optional, or remain a dashboard alongside the bot? Recommended direction: complete member workspace, delivered in stages. This is discovery, not an approved auth/domain architecture. [Discovery checkpoint](handoffs/2026-10-09-web-experience-discovery.md).

## Recent Changes

Cisco explicitly paused funding/payouts and redirected work to website discovery. No product code changed. The pending product question and account-linking findings are saved in the discovery checkpoint.

Coordination patch checked/applied once, local commit **c64624519e9091c0a00d8963db0761b5aefd9ff2**. No push, merge, deploy, production write, transfer, message or model evaluation. **No payout exists yet; this is neither a ready verdict nor a final no-payable outcome.**

## Metadata

Last Updated: 2026-10-09T11:07Z
Project: Hyphae; community website discovery. Existing payout arc parked by Cisco.
Updated By: Codex (GPT-6). Exact runtime model ID/configured effort are not exposed in this session; do not substitute the prior operator's model/effort.
Checkpoint: [October 9 read-only receipt](handoffs/2026-10-09-payout-preflight.md). Previous feature/review details: [overnight architect](handoffs/2026-10-08-overnight-architect.md).

## Current Objective

Clarify and design a website where members understand their community, available work and their own progress, with a scalable community structure and possible email/wallet login. Assumption: "Pryv" means Privy, not yet confirmed. No provider account, keys, domain/DNS, migration or product implementation authorized by a finished design. Reviewed next and all release conditions remain held. Prior payout receipts below are dated evidence, not instructions to resume.

## Current State

| Surface | Fresh evidence, Oct 9 10:30–10:34Z |
|---|---|
| Git | Fetched origin; starting main/origin-main **d3b8c6cf92f2ffcdf8fa3094b3709177b1ca4cf9**, next/origin-next **1249feddc5a7d7052fda6de8ac2ed65a0d4274b0**; divergence **5 main-only / 62 next-only**. Both worktrees clean; no scoped writer or git lock found. Runtime diff from deployed e5f864b to main empty. Preserve BOTH histories; no reset/fast-forward assumption. |
| Fly | API 6839d31b317318 and worker 817400c9901de8 started on jev-e5f864b, digest **b3f5617d804a377e8eaae1c6c67641ffe85390e47d88c162f0723206994236c4**; health ok. |
| Database | Journal **18**, all hashes match main SQL. Read-only check; latest recovery **10:30:11.572Z**, no selected reward/hold active/created/retry/failed job groups. No epoch-2 snapshot/binding/pause. |
| Epoch 2 | Open to **2026-10-10T00:00Z**, one amendment to reward-eval/2 effective Oct 7 18:00Z. Public allocation/payment **unavailable / no_settlement**. |
| Audit | **10:30:59.502414Z**, repeatable-read/read-only: **26** admitted rows/originals, **9** members, **0** pending decisions, **0** duplicate groups, **26** completed quality dispatches, **0** nominations. All 26 URL authors parse; **0** author attestations here. |
| Prerequisites | **6** signed wallets / **3** missing; **5** rules passes; **6** members with positive points; **4** with points + signed wallet + pass. Gate **blocked / not_final**. These are provisional prerequisites, not payees or payout amounts. |
| Scorer history | **4** Sonnet reward-eval/1, **1** Sonnet reward-eval/2 at Oct 7 19:19:48Z, **21** Haiku 5.5 reward-eval/2 thereafter. The Sonnet /2 predates the recorded Haiku rollout at Oct 7 20:01Z and is documented in the pilot release receipt. No Jev dispatch in epoch 2. Current scorer remains Haiku; preserve historical model receipts. |
| Hold orientation | Separate error-checked finalized RPC: **6/6** reads successful, **5** wallets currently above raw threshold **100,000,000,000**. Pre-close reads establish no qualifying hold evidence. Audit runner alone can convert RPC errors into zero; never infer below-hold from that. |
| Chain | Finalized slot **454840464**, exact mainnet genesis; executable program's ProgramData authority matches Ledger admin. Admin **0 lamports**, community/vault/epoch-2 absent. Fixed Treasury recipient System-owned, non-executable, zero data, **895,047,823 lamports**. USB admin/Squads Receive comparison and fresh program hash not checked. |
| Epoch 3 | Not materialized yet. Expected **Oct 10 00:00Z–Oct 17 00:00Z**; read back after close. No new epoch-3 raid until scorer amendment effective while that hold applies. |

## Next Actions

1. Resolve the pending product question: complete website journey with Telegram optional, or dashboard alongside the required bot. Explore screens/account mapping in that direction; present a concrete design before implementation.
2. Recommend one shared app with communities keyed by existing immutable IDs/mints; readable paths and verified domain aliases can map to the same workspace. No separate deployment per community.
3. Design account-to-member linking before auth implementation. Current members require Telegram IDs; email login alone cannot safely infer an existing member, wallet ownership or payout authority. Preserve wallet-link history and close-time eligibility.

### Historical payout queue — PAUSED, dates are not authority

**No C14–C22 row completed this session. Actual funding/publish/claim signatures, payees and payout amounts: none.** See checkpoint for each row's missing read-back. C1–C13 remain accepted historical receipts; never repeat their deploy/funding or fund retired keys.

1. Oct 9 attended C14–C18: verify Ledger admin first. C14 approved **0.02 SOL** rent/fees with finalized receipt; C15 exact plan and Cisco's Treasury Receive comparison; C16 simulation then Ledger init and decoded read-back; C17 Cisco's guarded binding; C18 freshly computed exact direct-vault top-up for **500,000,000 gross lamports**. Prior budget is not a fresh transfer amount.
2. Oct 9 **23:00Z** attended pause and DB/public read-backs, author attestation/corrections. Final audit **after 23:45Z**; corrections accepted strictly before Oct 10 00:00Z, stop starting by 23:55Z. Require zero unresolved evidence.
3. After Oct 10 00:00Z: read close, one matching immutable snapshot, jobs and epoch-3 Oct 10–17 window; Cisco resumes intake with read-back. Hold through Oct 11 00:00Z inclusive.
4. Oct 11 after hold and **ready**, renewed attendance: C19 production intent, C20 publish, C21 genuine claim, C22/P14. Empty/no-payable or failed evidence means no payment; no fabricated leaf/override.

## Validation

**Freeze: no main push or deploy Oct 9 22:00Z–Oct 11 00:00Z.** This checkpoint is local-only under the prompt's local-docs scope; a Vercel-triggering docs push was not inferred as publication authority. No push attempted. Before an authorized push run **pnpm test, pnpm typecheck, pnpm lint**, check clock and verify Vercel READY. Full main push gate was **not run** here. Patch check, whitespace check, runtime-source comparison and production reads passed. No DB/reward code change, so no new Drizzle/PG gate or sensitive-code review.

## Known Issues / Watch List

Next **1249fed** untouched. Five branches plus rollout fixed/ACCEPTed; records live on next, not necessarily main. Historical next gate: **130 core, 26 read-client, 187 web, 1172 API passed / 3 skipped**, typecheck/lint 0, Drizzle clean, **84/84 Postgres** after known flaky rerun. This is not a fresh combined-main gate. Keep long send-bound/score-only hint limits in prior review notes.

After C22 only, Cisco's exact yes on the [DRAFT release plan](demo/2026-10-11-release-plan.md) remains required. Preserve main-only docs when integrating next; combined gate; explicitly require **published** although db.mjs permits closed/unpublished; 0018+0019 before API then worker, authorized web push/smoke, Cisco announcement, epoch-3 amendment. None executes in this arc.

Separate founder queue, **one item at a time**:

- Public wording in private docs/plans/transparency-note.md; first moved-close changelog/reason, then README/panel/announcement. Nothing approved or posted here.
- Four scorer answers in docs/plans/scorer-v3-questions.md, release timing, member-visible strings and rules-test privacy; no silent approvals.
- Existing reminder, temporary eval-key revocation, Neon rotation after Oct 11, trust-page follow-up, Vercel Pro/alerts and reviewer access remain owner items.

Both private decision files present/read; no guessed restoration or vault writes. Keep private text/identities out of Git. **@organichub/verify 0.1.0 through Oct 12**. Held refs **158452fe, 707d7daf, 2fd2470a, tag c58aa27** untouched.

## Publication ledger and organic-sync

Pending local milestone: **c64624519e9091c0a00d8963db0761b5aefd9ff2**. Checkpoint bookkeeping SHA: `git log -1 --format=%H -- docs/handoffs/2026-10-09-payout-preflight.md`; resolve its exact ID before publishing/resuming. Origin/main stays **d3b8c6c**. Only documentation changed: visibility/timetable/consumer constraints/completed review and gate status. No downstream runtime contract change. Organic-sync owns vault/Organic propagation; this session wrote neither.

## Generated artifacts this session

| Artifact | Home | Stage |
|---|---|---|
| Coordination patch | Four checked targets, c646245 | Applied once, local only |
| Public-safe checkpoint | docs/handoffs/2026-10-09-payout-preflight.md, this handoff, docs/BUILDLOG.md | Read-only evidence/exact stop |
| Private read-backs | docs/plans/operator-receipts/2026-10-09-*.json and audit stderr | Gitignored; do not publish |
| Keys/resources/jobs | None | None created/changed |

## Suggested skills

handoff-memory, the-analyst, superpowers:verification-before-completion, handoff at the stop. Existing operator scripts/runbook only. Reuse next's ACCEPTs; any new sensitive-code change requires fresh other-family review.

## Quick Reference

Canonical procedure: docs/demo/2026-10-08-first-payout-readiness.md and docs/handoffs/2026-09-28-runbook-c.md. Ledger admin and all immutable addresses are in the packet; no private RPC/token values belong in receipts.

## Resume Checklist

Fetch/status/both refs; preserve local documentation and held next; check writers and clock before any later publication. Continue website discovery. All funding/payout actions are paused; do not prompt for Ledger readiness or run publish-epoch plan. Full main gate required before any authorized push.

## Next-session prompt

## Resume Prompt

```text
Cisco explicitly PAUSED funding/payouts and requested clearer community website organization, scalable community domains/subdomains and possible email/wallet login. No product implementation yet. Prior production preflight is historical; next 1249fed held; preserve both histories and local docs commits.
Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-10-09-web-experience-discovery.md, docs/handoffs/2026-10-09-payout-preflight.md, docs/ROADMAP.md, apps/web/components/views.tsx, apps/web/components/site.tsx, packages/db/src/schema.ts
Model: use the available architecture/reasoning model at high effort; do not invent runtime ID/effort.
Skills: handoff-memory, the-analyst, superpowers:brainstorming, handoff.
Resolve whether members should complete the journey on the website with Telegram optional or use a dashboard alongside the bot. Recommend reusable community workspaces and email/existing-wallet login with explicit member/wallet linking. Treat domain aliases and embedded-wallet creation as separate design choices. Present design before implementation. Do not resume C14–C22, merge/deploy next, alter DNS/provider keys or send messages. Preserve freeze Oct 9 22:00Z–Oct 11 00:00Z.
```
