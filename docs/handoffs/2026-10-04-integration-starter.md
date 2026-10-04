# Working integration starter — October 4

Last Updated: 2026-10-04T09:53:36Z

## TL;DR

Cisco confirmed Windows unavailable and asked for easier community/launchpad adoption and Organic-sync handoff. Completed a local executable public reader, 12 behavioral tests and adoption guide. **863 tests passed/1 optional skip**, repository typecheck/lint288 passed; live Lab read passed. A standalone read-only SDK is the concrete next proposal, not yet approved or built. Original phone result remains blocked; this example is not a release or scalability proof.

## Working behavior / checks

- Reader: `apps/api/scripts/read-community.ts`, using existing `ReadApiV1Loose`. Reads exact mint/current epoch, refuses mismatched identity, preserves integer strings and unavailable states. No ambient credentials, redirects, writes or automatic retries; deadline10seconds and structured errors.
- Focused tests12/12: two communities, wrong mint/epoch, old/additive fields, null epoch, exact integers, rate limits/no retry,404/503,invalid JSON/schema, network/timeout, unsafe URL/path refusal.
- Full suite exit0: **863 passed/1 optional skip**,106core/107web/650API. Typecheck0; lint0/**288 files**. Initial fixture/CLI typing errors repaired.
- Documented CLI live read **2026-10-04T09:47:29.429000Z**: Lab,epoch2,allocation/payment unavailable. Public GET only; no scoring/bot/DB/signing/money.
- No dependencies/lock/schema/program/rubric/worker/bot/link changes. API script source tree is later than approveda646 and does not inherit its pins. Earlier release851/1skip+Postgres50/50/Drizzle/build receipts remain prior; no repeat PG/build/review here.
- Organic-sync loader resolves canonical skill and four references. Read-only format/ownership check; **full sync not run** and shared plans untouched.

## Next result and consumer disposition

[Integration guide](../community/INTEGRATING.md) covers seven existing routes, runnable example, schema/error/precision boundaries, operator setup and concrete SDK scope. Proposed local result: `packages/read-client/`, ESM/types/seven typed GETs/shared validation, structured errors/explicit fetch/deadline, identity/pagination/no-store claims, local pack and isolated browser/server install proof. No npm release, backend/provisioning or website redesign. Existing example requires this checkout's tsx/core/zod; independent installation is not done.

Producer Hyphae→Organic owningtask3.6/DEP-09 or another launchpad owner: reuse publicv1/reader/paused operator setup; owner authority/settings/provisioning remain unimplemented. Sync owner should carry local artifact stage, Windows unavailability and exact conditional release approval into existing plans/paired gates. No new master plan or dependency closure from local tooling.

## Retained release / device / dated gates

Cisco's **“I approve”** covers **a646abc883131ff411d5dd7bbba536176364fe38 only**, Git main publication/automatic Vercel production deployment/named rollback to **dpl_G3xB3NRa78G9UR5GzZmXmsBa62mz**, once existing configuration checks pass. Windows unavailable, Mac settings absent, private guards UNKNOWN; no push. Do not ask that approval or Windows question again. Later approval/tooling commits are excluded; never substitute HEAD.

Fly immutable artifact/API-only release and own-account phone scope/attendance remain separate. Frozen v11 worker retained. Guide one phone action then wait, original URL/close old page/named wallet browser/free message/same-wallet `/me`; phonePASS is notC21. Pilot hidden/recruitment blocked; genuine URLs/real setup held. Organic public settlementGET boundary intact, siblings/vault read-only.

SDK **@organichub/verify0.1.0 throughOct12** and held rules/Jev preserved. Oct8admin0.02SOL/gross500000000/fresh top-up/permanent recipient approvals unchanged. Pause **Oct8 23:00Z**; final audit **AFTER23:45Z**; corrections/attestation **STRICTLY BEFORE Oct9 00:00Z**. Post-close snapshot/hold/safety/Ledger/actual claim/P14; hold through **Oct10 00:00Z inclusive**. No early money; empty/no-payable means no payment.

## Pending commits

Start **5d2cf6ebf8a4071827a7a53041f6aa12cd800562**,19ahead unchanged origin **312cc0ffae1c4efbf5fd69c2b58a5aaf98af28ac**. Integration milestone adds one local commit; resolve SHA with `git log -1 --format=%H -- docs/handoffs/2026-10-04-integration-starter.md`. Prior17 full SHAs in [release ledger](2026-10-04-phone-release-gate.md#pending-local-commits), plus approved **a646abc883131ff411d5dd7bbba536176364fe38** and excluded **5d2cf6ebf8a4071827a7a53041f6aa12cd800562**. All unpushed: approved configuration guards UNKNOWN; later commits excluded from approval. Held refs unchanged.

## Suggested skills

`handoff-memory`, `karpathy-guidelines`, `security-review` as applicable, `handoff`; `organic-sync` in its owning vault session. No helper or parked-product arc.

## Generated artifacts this session

| What | Home | Stage |
|---|---|---|
| Public reader/tests | `apps/api/scripts/read-community.ts`, `apps/api/scripts/read-community.test.ts` | Local, verified |
| Adoption guide/SDK scope | `docs/community/INTEGRATING.md`, README link | Local; SDK proposed |
| Portable state/buildlog/checkpoint | `docs/HANDOFF.md`, `docs/BUILDLOG.md`, this file | Local; no release |

No credentials, registry images, deployments, registrations, messages, signatures, transactions or schedules. Runtime/effort/usage unattested.

## Next-session prompt

```text
Resume only FCisco95/hyphae. Local reader/adoption guide complete,863tests/1skip/types/lint288 green, live Lab public read passed. Windows unavailable; do not repeat presence question. Exact a646abc883131ff411d5dd7bbba536176364fe38 P1+D2 approval retained conditionalconfigPASS; no execution, later commits excluded. Original phone result blocked.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/community/INTEGRATING.md, apps/api/scripts/read-community.ts, apps/api/scripts/read-community.test.ts, docs/handoffs/2026-10-04-publication-approval.md, docs/demo/2026-10-04-combined-release-packet.md, docs/demo/2026-10-08-first-payout-readiness.md.
Model: gpt-6.1-sol (high) — October4 recorded routing for bounded client/tooling work; recommendation only.
Skills: handoff-memory, karpathy-guidelines, security-review as applicable, handoff; organic-sync with owning vault session.
Resolve concrete local standalone SDK proposal approval, then implement if approved. Preserve existing release approval/access blocker and all refs; exacta646 push only after private guardsPASS, never laterHEAD. No npm/deploy/provisioning/site redesign included in SDK proposal. Carry unchangedv1/local reader/Windows unavailable/approvalstage/task3.6DEP-09 into producer handoff for sync owner, no shared writes. SDK0.1.0throughOct12, hidden until real phonePASS, C21 distinction and exactOct8–10 gates unchanged; empty means no payment.
```
