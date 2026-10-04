---
date: 2026-10-04
summary: Needs Cisco — fresh release checks pass; exact conditional publication/web-release row awaits approval, API rollout and registered-Lab phone PASS remain held.
---

# Hyphae handoff

Last Updated: 2026-10-04T09:39:54Z

## TL;DR

**Needs Cisco. The requested result is not done:** the reviewed signing flow is not live and no actual registered-Lab phone PASS has been observed. T/A/B, operator-assisted setup and the owner-doc patch are complete; reuse them and accepted unchanged reviews. This continuation ran the fresh release gate and narrowed the next approval to **one P1+D2 action**, detailed in the existing [combined packet](demo/2026-10-04-combined-release-packet.md#current-result-gate--october-4-release-checks). Preparation is not the live/device result. Stop the prep loop while the human action is pending.

## Current Objective

Make the exact approved build usable on Cisco's phone. Next human step: approve the exact closure SHA's **FCisco95/hyphae main publication, automatic Vercel production deployment and bounded rollback to the captured old web deployment**. The final approval question names the full SHA. Conditional approval cannot bypass the remaining private configuration guards. It grants no Fly rollout, test scope, rename, menu/message/pin, setup or activation. Keep remaining blockers here rather than asking a questionnaire.

## Current State

| Component | Actual stage / next gate |
|---|---|
| Reviewed runtime | Combined source **e5ee300d6ce65231ec2325fef60be1f1ecbcba05** unchanged through starting **40a9b4c294e3fca60ab405a9051f60fbc4d557ef** and this docs-only closure. T/A/B final **8841a01e8abdcec4398f1255a8ccd3d1c9423212**; setup final **cd4c4ef8a3ed4b47669ecd2dd0c4cd73ed9b437f**, reviewed **072e99ba7918ed30c36bacd5c6cbb66255ec55b5..cd4c4ef**. No rebuild of features or new sensitive source delta. |
| Web target | Fresh scoped Vercel project **prj_zGEwnzy5ATqVXru7apeDkPfrcHSM**, team **team_d8lkX495txxwACU8i2Ode2KF**, root **apps/web**, Node24.x. Main automatic Git deployment/alias assignment enabled. READY rollback **dpl_G3xB3NRa78G9UR5GzZmXmsBa62mz**, source **312cc0ffae1c4efbf5fd69c2b58a5aaf98af28ac**, alias **https://hyphae-delta.vercel.app**. Candidate not deployed. |
| API phone fix | Fresh09:37Z live page/bundle hashes differ from reviewed local outputs; **B is not live**. Local API/web builds passed but are not release artifacts. API image registry digest UNKNOWN/unbuilt. P1+D2 cannot itself deliver T/B. |
| Fly disposition | Reverify existing API **6839d31b317318**/worker **817400c9901de8**, app **hyphae-api/cdg**, before later D1. API-only immutable-image update proposed, frozen v11 worker retained, digest **sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2**. Current machines/config/worker/journal/webhook UNKNOWN without existing access. Whole-app deployment excluded. |
| Public state | Fresh09:36–09:37Z health, correct `/v1` Lab/community/epoch2 and selected website200. Lab/open epoch2, cutoffOct9 00:00Z. These reads do not prove exact private UUID/chat/admin, webhook, live migrations or queues. |
| Phone/history | No attended named-device test. Founder linking/historical scoring remain accepted. Own-account T1 scope/attendance must be valid after actual API artifact proof. One step at a time, wait for Cisco; `/link` free message is not C21 transaction proof. |
| Operating choices | Cisco owns registered Lab, bot admin, owner+bot, Testers separate. Each token has its own contribution group; Lab is not a catch-all. Disjoint Hyphae briefs/Raidar separate, one active brief, pilot hidden and recruitment blocked until phonePASS. |
| SDK/policy | **@organichub/verify exactly0.1.0 throughOct12**. Schema/migrations0000–0012, rubric/core/worker/jobs/program unchanged; no migrations or reward edits. Sentinel stays PARKED F-13. |

## Validation

**Fresh this continuation:** `pnpm test` exit0, **851 passed/1 optional skip** (106core/107web/638API); `pnpm typecheck`0; `pnpm lint`0/286files; DB `drizzle-kit check`0; API `test:pg`0/**50/50** against disposable local Docker Postgres; API/web builds0. Node24.14.0/pnpm10.29.3. The older identical numbers remain prior receipts. Source bounds **7trees/17file hashes/13migration hashes** match pins. Live page/bundle HTTP200/no-store/no-referrer/restrictive CSP; local/live bytes differ. Full details/hashes in [checkpoint](handoffs/2026-10-04-phone-release-gate.md).

Accepted unchanged participant R1 **d26357e1..e003cdf** and R2 **e003cdf..8841a01**, ACCEPT/no blockers; setup **072e99b..cd4c4ef**, APPROVE/no actionable findings. Review receipts retain actual reviewer metadata. No new review required for this docs-only delta. Do not label local builds as deployed artifacts or test receipts as phone proof. Before executing a delayed approved push, refresh changed evidence and rerun required gate if source/dependencies/environment changed.

## Recent Changes

Fresh release gate and both builds completed; existing release row narrowed to one conditional P1+D2 approval. Live signing-page bytes differ from reviewed local output. No source, registry or live mutation.

## Known Issues / Watch List

Inherited forwarded bearer-link binding and clipboard history/sync risks remain. No account-confirmation protocol added; keep original URL private and close old signing page before reopening. Setup drift/outage and unknown-COMMIT retain original read-back/conflict guards. No device proof or payment inferred from static review/local builds.

## Resume Checklist

Read this handoff and latest checkpoint, verify exact approved outgoing SHA, fetch without pruning and compare fast-forward ancestry/pins/held refs. Preserve all local work. Perform only the approved action after named prerequisites pass; do not rebuild accepted features or repeat unchanged reviews.

## Metadata

Started clean main **40a9b4c294e3fca60ab405a9051f60fbc4d557ef**, **17ahead/0behind** unchanged origin **312cc0ffae1c4efbf5fd69c2b58a5aaf98af28ac** after no-prune fetch/ff-only. This docs-only milestone adds one commit; resolve full outgoing SHA using `git log -1 --format=%H -- docs/handoffs/2026-10-04-phone-release-gate.md`. Approval question freezes that SHA; stop for any different outgoing runtime/source. All17 prior full SHAs are in the checkpoint pending ledger. Publication remains held, no push/CI/new deployment claimed; hold overrides ordinary daily push convention.

Rules **158452fe2b22a1e42e5efd42f3f7e11bfdf59c70** and Jev **707d7daf21e217d9a8a64e58514065f5e3bca45e** remain remote/unmerged until epoch3; reward branch **2fd2470a26ff9a349bceeb697b2731bd1bff0e07** and review tag **2ca35057c3efbd43df191bda0d9527d526f6886f** preserved. No prune/reset/cleanup of held work. Siblings/vault read-only; current master/private plan and2026-10-04-0844Z-pre-work scope/rulings read, no sync or external authorization inferred.

## Next Actions

1. Resolve Cisco's **one P1+D2 approval** for the exact closure SHA/destination/effect/rollback. Prove remaining existing private configuration guards before its push; preserve hooks. Verify actual Vercel deployment ID/GitSHA/alias/assets and selected Lab rendering. If acceptance fails, only the named old-web rollback is included in that requested scope; Git publication remains.
2. With existing operator access, verify exact registered Lab identity/bot/chat/type/webhook/live journal and Fly/API/web configuration privately. New immutable D1 image must be recorded before separately approving API-only rollout. Retain frozen v11 worker/config/start state and healthy queues; stop on mismatched target or unavailable safe rollback.
3. After actual served API artifact and valid own-account test scope/attendance: guide **group `/link` first and wait**. Then private original URL, close old signing page before reopening, named wallet-browser surface, unchanged free readable message, same wallet in own `/me`. Record real device/app/surface and PASS/FAIL, keep unattempted surfaces UNKNOWN. Uncertain result→own `/me` before retry. No token/signature screenshots.

## Parked blockers and downstream impacts

Existing DB/bot/Fly settings/login absent here; earlier Windows operator environment remains the likely, unconfirmed access path. No credential creation/rotation/export authorized. Private Vercel API URL/default mint/token linkage and API `PUBLIC_WEB_URL`/`LINK_ORIGIN` equality remain UNKNOWN; selected URL/mint API values were unreadable in the prior receipt. Public rendering cannot clear these guards.

Genuine Lab invite/support/publishing URLs still absent; reviewed empty presentation map omits missing actions. They are not needed to rebuild onboarding. Real group setup needs its own named token/authority/admin/group/DB/environment/manifest hash and authorization; existing Lab must not be registered again. No menu/message/pin/name/upgrade/activation effect inferred.

Organic owns authenticated actor authority over exact mint, permitted settings/actions, group/admin verification, expiry/replay/idempotency/conflict/receipt contract and two-community isolation before self-service. Reuse the completed operator tool; Hyphae's permitted cross-repo interface stays public settlement GET only. No invented provisioning API. Setup starts paused/non-payable; registration does not prove unsupported quiz PASS or payments. Drift/outage/unknown-COMMIT→original identity read-back, never overwrite/reseed/delete.

## October 8 readiness

[C14–C22 exact runbook](demo/2026-10-08-first-payout-readiness.md) unchanged; no replay of C1–C13. Existing approvals admin **0.02SOL**, gross **500000000lamports**, fresh exact top-up/permanent Treasury recipient and original author corrections retain original preconditions. No early money action. Pause **Oct8 23:00Z**; finalC18b **AFTER23:45Z**; corrections/attestation **STRICTLY BEFORE Oct9 00:00Z**. After close only: immutable snapshot, hold/safety, attended Ledger publication, genuine claimant/C21 and P14/C22. Hold through **Oct10 00:00Z inclusive**. Empty/no-payable means no payment. No rollout during the money/close/hold sitting; attendance/genuine contribution/author/rules/hold/dashboard proofs still pending.

## Quick Reference

[Existing release row](demo/2026-10-04-combined-release-packet.md#current-result-gate--october-4-release-checks), [source pins](demo/2026-10-04-combined-source-pins.json), [fresh checkpoint/pending SHAs](handoffs/2026-10-04-phone-release-gate.md), [participant receipt](handoffs/2026-10-03-onboarding-implementation.md), [setup close](handoffs/2026-10-04-community-setup-close.md), [setup contract](community/SETUP-INTEGRATION.md), [setup review](reviews/2026-10-03-community-setup-opus-fixcheck.md), [phone procedure](superpowers/specs/2026-10-03-link-platform-verdict.md).

## Suggested skills

`handoff-memory`, `vercel:vercel-cli`, `security-review` for any new sensitive delta/authorized deployment, `handoff`. Reuse accepted reviews; no automatic helpers or Sentinel product work.

## Generated artifacts this session

| What | Canonical home | Stage |
|---|---|---|
| Existing conditional release-row amendment | `docs/demo/2026-10-04-combined-release-packet.md` | Local; no new packet |
| Current state/buildlog and dated checkpoint | `docs/HANDOFF.md`, `docs/BUILDLOG.md`, `docs/handoffs/2026-10-04-phone-release-gate.md` | Local, publication held |
| API/web build output | Ignored `apps/api/dist`, `apps/web/.next` | Local validation only |

No credential, registry image, deployed resource, message, registration, signature, transaction or schedule generated. Actual runtime/effort/usage not independently inspected; no borrowed prior counters.

## Resume Prompt

```text
Resume only FCisco95/hyphae. Needs Cisco: exact reviewed build not live and registered-Lab phonePASS missing. T/A/B/setup/owner-doc patch complete; fresh release851/1skip+Postgres50/50, typecheck/lint/Drizzle/API+web builds0. Local signing page/bundle differs from live. Preserve closure and all local/held refs; no-prune/ff-only, never reset to old origin312cc0ff.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-04-phone-release-gate.md, docs/demo/2026-10-04-combined-release-packet.md, docs/demo/2026-10-04-combined-source-pins.json, docs/community/SETUP-INTEGRATION.md, docs/demo/2026-10-08-first-payout-readiness.md.
Model: gpt-6.1-sol (high) — October4 recorded routing for bounded release/attended runbook work; recommendation only.
Skills: handoff-memory, vercel:vercel-cli, security-review for new sensitive deltas/deployment, handoff.
Resolve Cisco's exact P1+D2 publication/automatic-web/old-web-rollback approval; privately prove outstanding config guards before execution and verify actual deployed SHA/assets. D1-build/API and own-accountT1 remain separate, require existing operator access/immutable image/live-target proof and attendance. Retain frozen v11 worker, SDK0.1.0 throughOct12 and held rules/Jev. Once API live/test scope valid, guide one phone action then wait, originalURL/close-old-page/named wallet-browser/unchanged free message/own me; real surfacePASS gates recruitment and is notC21. Remaining blockers stay in handoff, no prep loop, no invented setup/self-service or sibling/vault writes. Preserve exactOct8 23:00Zpause/after23:45Zfinalaudit/preOct9 00:00Zcorrections/Oct10inclusivehold; no early money, empty means no payment.
```
