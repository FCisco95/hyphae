---
date: 2026-10-04
summary: Windows unavailable; approved a646abc release blocked on existing configuration. Local validated integration reader complete; standalone read-only SDK proposed next.
---

# Hyphae handoff

Last Updated: 2026-10-04T09:53:36Z

## TL;DR

**Original phone result still Needs Cisco:** reviewed signing page is not live and registered-Lab phone PASS is untested. Cisco approved exact **a646abc883131ff411d5dd7bbba536176364fe38** P1+D2 publication, automatic Vercel production deployment and named old-web rollback **once existing configuration checks pass**. Those guards remain UNKNOWN. **Windows PC unavailable here**, confirmed by Cisco; do not repeat the Windows question or release approval.

Independent local result completed after Cisco asked for better community/launchpad adoption: a schema-validated executable public reader and [integration guide](community/INTEGRATING.md). **863 tests passed/1 optional skip**, typecheck and lint passed; live Lab read passed. This is repository tooling, not a published SDK, self-service setup or proof of scale. Next recommendation: the guide's concrete **local standalone read-only SDK** milestone; wider code approval remains pending.

## Current Objective

Keep the original approved release ready to resume when existing operator access returns. While blocked, improve adoption through local tooling. The reader and guide are complete; do not rebuild them. The next SDK scope would produce an independently installable local artifact; it includes no npm publication, deployment, new server API or website redesign.

## Current State

| Component | Actual stage / next gate |
|---|---|
| Reviewed onboarding/setup | Complete combined source **e5ee300d6ce65231ec2325fef60be1f1ecbcba05**. T/A/B and owner-doc patch done; operator setup accepted at **cd4c4ef**. Reuse accepted unchanged reviews and existing group setup. |
| Approved release | **a646abc883131ff411d5dd7bbba536176364fe38 only**, including its automatic Vercel deployment and rollback to **dpl_G3xB3NRa78G9UR5GzZmXmsBa62mz** if acceptance fails. [Approval receipt](handoffs/2026-10-04-publication-approval.md). No execution while private configuration guards are UNKNOWN; later local commits are excluded. |
| Vercel | Verified project **prj_zGEwnzy5ATqVXru7apeDkPfrcHSM**, team **team_d8lkX495txxwACU8i2Ode2KF**, root **apps/web**, Node24.x. Current READY rollback deployment above, Git **312cc0ffae1c4efbf5fd69c2b58a5aaf98af28ac**, alias **https://hyphae-delta.vercel.app**. Main Git deployment and aliases automatic. |
| Fly / phone fix | Candidate signing page/bundle differ from live bytes. New registry digest unbuilt/UNKNOWN. Later API-only update must reverify machine **6839d31b317318** and retain worker **817400c9901de8** on frozen v11 digest **sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2**. D1 and T1 remain separate gates. |
| Integration starter | `apps/api/scripts/read-community.ts` reads a named registered mint/current epoch through public v1, validates shared consumer schemas and returned identity, preserves exact strings/unavailable states. Public GET only; no credentials, redirects, automatic retry or writes. Local executable/tests complete. |
| Standalone SDK | Proposed `packages/read-client/`: seven typed GETs, ESM/types, shared validation, structured errors, identity/pagination/no-store claim handling, local pack and isolated browser/server install tests. Exact scope in guide; not built/approved/published. |
| Organic sync | Portable loader and four canonical references resolve. Read-only format/ownership check done; producer→consumer notes ready in guide/HANDOFF. **Full cross-repository/vault sync NOT RUN**; owning sync carries changes into existing task3.6/DEP-09 and plans. |
| Settled operation | Cisco owns Lab, bot admin, owner+bot; Testers separate. Each token has its own contribution group. Disjoint Hyphae briefs/Raidar separate, one active brief, pilot hidden and recruitment blocked until real phone PASS. Founder prior wallet linking/scoring accepted. |

## Validation

Fresh integration milestone: `pnpm test` **exit0, 863 passed/1 optional skip** (106 core,107 web,650 API), including **12 reader tests**; repository typecheck0; lint0/**288 files**. Initial new-example TypeScript errors repaired; final checks green. Live CLI returned **Hyphae Lab, epoch2, unavailable allocation/payment** at **2026-10-04T09:47:29.429000Z**, using only public GETs. Tests cover two-mint isolation, wrong identity, old/additive fields, no epoch, exact integers,429/no retry,404/503,invalid JSON/schema,network/timeout and unsafe URL/path refusal.

Earlier same-conversation approved-release gate: **851/1 skip, 50/50 disposable Postgres, typecheck/lint286/Drizzle/API+web builds0**. Those remain dated earlier executions; no new Postgres/build needed for this script/docs addition. Approved **a646abc** still matches its **7 trees/17 hashes/13 migrations**; later API scripts change the source tree and must not inherit those pins. No dependency/lockfile/schema/program/rubric/worker/bot/link change. **@organichub/verify exactly0.1.0 through Oct12**.

Accepted participant R1/R2 and setup fixcheck remain valid for their original ranges, linked in the [release checkpoint](handoffs/2026-10-04-phone-release-gate.md). They do not review the later reader. No new other-family review run; review any applicable new sensitive delta before later publication. No later commit is approved for push/deploy.

## Recent Changes

Cisco confirmed Windows unavailable and steered toward adoption/process work. Added reader/tests, README link and adoption guide with a concrete next SDK proposal and Organic-sync consumer disposition. No repeated release-preparation packet.

## Known Issues / Watch List

The reader requires this checkout's existing tsx/core/zod dependencies; it is not independently installable. No throughput/load test or second real registration is claimed. Public reads prove neither owner authority nor payment eligibility. Original bearer-link/clipboard risks remain: keep original URL private, close old signing page, check own `/me` on uncertainty. Setup drift/outage/unknown COMMIT retain original read-back/conflict guards; no overwrite/reseed/delete or unsupported-quiz PASS.

## Next Actions

1. Resolve approval for the guide's **bounded local standalone SDK** scope, then implement and prove isolated installation if approved. No SDK publish/deploy or website redesign included.
2. When existing operator access returns, privately prove Vercel API URL/default mint/token linkage and API web/link origins. Recheck fast-forward refs/approved pins/hooks; only on PASS run `git push origin a646abc883131ff411d5dd7bbba536176364fe38:refs/heads/main`. Verify actual deployment/source/alias/assets/Lab; named old-web rollback only if acceptance fails. Later local commits stay excluded.
3. After separately approved API release and valid own-account scope/attendance, guide **group `/link` and wait**, then private original URL, close old page, named wallet browser, unchanged free message and same wallet in own `/me`. Record real device/surface PASS/FAIL; unattempted paths UNKNOWN. Message PASS is not C21 transaction proof.

## Parked blockers and downstream impacts

Windows unavailable; this Mac has no existing API/DB/bot/Fly settings, saved env file or Fly CLI. Do not repeat Windows checks or create/export/rotate credentials. API/web private equality and exact registered Lab identity/bot/chat/type/webhook/journal/queues/current machines remain UNKNOWN. Genuine invite/support/publishing URLs absent; missing actions stay omitted. No rename/menu/message/pin/upgrade/activation/registration inferred.

Organic owns exact-mint actor authority, permitted settings, group/admin verification, scoped expiry/replay/idempotency/conflict/receipt handling and two-community isolation before self-service. Reuse reviewed per-token paused operator setup; Hyphae's permitted Organic interface remains public settlement GET only. Sync owner carries **existing task3.6/DEP-09**, unchanged v1, local reader, Windows unavailability and approved-but-blocked a646 release into existing plans/paired gates. No dependency closes from unpublished tooling. Siblings/vault stay read-only.

## October 8 readiness

[Exact C14–C22 runbook](demo/2026-10-08-first-payout-readiness.md) unchanged; no C1–C13 replay. Existing admin **0.02SOL**, gross **500000000 lamports**, fresh exact top-up/permanent Treasury recipient and author corrections retain original preconditions. No early money. Pause **Oct8 23:00Z**; final C18b **AFTER23:45Z**; corrections/attestation **STRICTLY BEFORE Oct9 00:00Z**. Post-close only: snapshot, hold/safety, attended Ledger publication, genuine C21/P14/C22. Hold through **Oct10 00:00Z inclusive**. Empty/no-payable means no payment; no rollout during money/close/hold sitting.

## Metadata

Approval continuation started clean **a646abc**,18ahead/0behind fetched origin **312cc0ffae1c4efbf5fd69c2b58a5aaf98af28ac**. Approval receipt **5d2cf6ebf8a4071827a7a53041f6aa12cd800562** made19ahead. This integration milestone adds one local commit; full SHA resolves with `git log -1 --format=%H -- docs/handoffs/2026-10-04-integration-starter.md`. No push: original approved guards UNKNOWN; later commits excluded. Full17 prior pending SHAs in [release ledger](handoffs/2026-10-04-phone-release-gate.md#pending-local-commits), plus approveda646,5d2cf6e and this milestone.

Held rules **158452fe2b22a1e42e5efd42f3f7e11bfdf59c70**, Jev **707d7daf21e217d9a8a64e58514065f5e3bca45e** remain unmerged until epoch3; reward branch **2fd2470a26ff9a349bceeb697b2731bd1bff0e07** and review tag **2ca35057c3efbd43df191bda0d9527d526f6886f** retained. No pruning/reset/deletion of held work.

## Resume Checklist

Read current handoff/checkpoint; distinguish approved a646 pins from later local tooling. Fetch without pruning, fast-forward only when safe. Carry existing approval and Windows unavailability; skip completed prep/reviews. Full Organic-sync/vault writes belong to their owner.

## Quick Reference

[Guide/SDK scope](community/INTEGRATING.md), [integration checkpoint](handoffs/2026-10-04-integration-starter.md), [approval](handoffs/2026-10-04-publication-approval.md), [release row](demo/2026-10-04-combined-release-packet.md), [source pins](demo/2026-10-04-combined-source-pins.json), [setup contract](community/SETUP-INTEGRATION.md).

## Suggested skills

`handoff-memory`, `karpathy-guidelines`, `security-review` for new client/deployment/sensitive changes, `handoff`. `organic-sync` in its owning vault session consumes the producer handoff. No helpers or Sentinel product work.

## Generated artifacts this session

| What | Canonical home | Stage |
|---|---|---|
| Reader/tests | `apps/api/scripts/read-community.ts`, `apps/api/scripts/read-community.test.ts` | Local working example |
| Adoption guide/SDK proposal | `docs/community/INTEGRATING.md`, README link | Local; SDK not built |
| Approval/state/checkpoints | `docs/handoffs/2026-10-04-publication-approval.md`, `docs/handoffs/2026-10-04-integration-starter.md`, HANDOFF, BUILDLOG, existing packet | Local; no release |

No credential, registry image, deployment, message, registration, signature, transaction or schedule generated. Actual runtime/effort/usage unattested; no borrowed counters.

## Resume Prompt

```text
Resume only FCisco95/hyphae. Windows unavailable; do not repeat its presence question. Exact a646abc883131ff411d5dd7bbba536176364fe38 P1+D2 publication/automatic web/named rollback approved once existing config PASS, not executed; later local commits excluded. Original phone result still blocked. Local reader/adoption guide complete:863 tests/1skip,types/lint288 pass, live Lab public read passed. No standalone SDK/self-service/scale proof.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-04-integration-starter.md, docs/community/INTEGRATING.md, apps/api/scripts/read-community.ts, apps/api/scripts/read-community.test.ts, docs/handoffs/2026-10-04-publication-approval.md, docs/demo/2026-10-04-combined-release-packet.md, docs/demo/2026-10-08-first-payout-readiness.md.
Model: gpt-6.1-sol (high) — October4 recorded routing for bounded client/tooling work; recommendation only.
Skills: handoff-memory, karpathy-guidelines, security-review as applicable, handoff; organic-sync in its owning vault session.
Resolve only the guide's concrete next local SDK approval, then build if approved. Keep original release access blocker/approved a646 separate; exact-SHA push only after private guards pass, never later HEAD. Preserve reviewed onboarding/setup, SDK0.1.0 throughOct12, held refs, hidden pilot until real phonePASS, C21 distinction and exactOct8–10 money gates. Sync owner carries unchangedv1/local reader/Windows unavailable/approval stage/task3.6DEP-09 into existing plans; no Hyphae sibling/vault write or repeated prep.
```
