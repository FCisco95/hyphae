# Live raids and account visibility — October 9, 18:29Z

## TL;DR

Cisco accepted the repaired preview baseline, then asked for visible Privy login and live raids/deadlines/X cards. Local implementation **77a15f76b261da1705eb8b8ed6af31894b2d4925**, review fixes **0c79cd4ae73a8541f6fab221a97604fa0db8a036**, work at http://127.0.0.1:3010/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg#raids. Two actual open raids at18:22Z; original post text is a stored snapshot with a source link, not a live X widget/media embed. Privy options are visible **disabled**. No configured app/domain/cookie/login proof; no actual sign-in claimed. Next human action: open Privy Dashboard and select the dedicated Hyphae app. Do not ask for secrets in chat.

## What works and evidence

New additive GET `/v1/communities/:mint/raids` plus strict schema and OpenAPI, locally committed only. Up to20 approved active/scheduled and up to6 recent closed/cancelled records, safe canonical X links, bounded escaped text. No member/chat/message/proposal/session/moderation fields. Cancelled/scheduled records hide post content/briefs. No lifecycle/reward write. Deadline checks use actual database time; cards do not extend epoch2 reward intake past Oct10 00:00Z. Cached-open epoch cutoff is guarded before showing submission guidance. Missing/wrong-community/unavailable feed never means no raids.

Shared15second anonymous fetch cache, no web token/visitor header.30second visible-page refresh and15second focus debounce. Exact loopback origin requires explicit local-preview flag and is ignored on Vercel. Host/config decision is shared by account page and overview; no provider imports or login activation on disabled surface. Existing email/wallet/Telegram/wallet-auto-creation invariants unchanged.

`pnpm preview` starts loopback3011 reader for raids only; other reads use deployed API. Minimal reader environment. Actual postgres-js read-only proof before listening. Neon pooler refused session-default startup options with08P01; original DSN retained and every proof/clock/data query runs in an explicit read-only transaction. No production role/session/default change or attempted data write. Health confirms transaction mode. No bot/worker/jobs/private auth/migration/signer starts. PID health check, spawn/port/exit failures, optional .env and BOM handled. Reader and web are left running for Cisco.

Final full gate: **139core /26read-client /213web /1124API =1502 passed,3 existing skipped**. Typecheck/lint457files, web production build/start and API bundle/link-page build pass. Initial privacy/cache/availability regressions failed then passed. Real cards at1440×1000 and390×844, disabled buttons/no overflow, final browser errors/warnings0. One actual raid expired at17:59:49.992Z during checks: effective active count3→2 without a lifecycle write. Remaining deadlines Oct9 20:52:41.992Z and Oct10 03:52:21.688Z. These are activity receipts, not payability/payment evidence. No DB-package/schema/reward change; no migration/Drizzle/PG test gate required. Actual driver live reads were verified read-only.

## Review and remaining limits

Initial fresh claude-opus-5-5/requested-high review ofab87b9e..77a15f7: **CHANGES_REQUESTED**,132301ms,1turn. Four Mediums and initial Low queue addressed. Fresh final whole-range review **ACCEPT** forab87b9e..0c79cd4, actual claude-opus-5-5, requested high effort,157458ms,1turn; tools/hooks/MCP disabled. Its required L1 callsite check passed: rg finds one production route rendering CommunityView, which supplies raids/login state; homepage is separate marketing content. No route uses the missing-raids fallback. Original auth ACCEPT at3ffd0f5 stays separate and is not a live provider receipt. Initial/final review artifacts ignored under docs/plans/2026-10-09-raids-initial-review.json and raids-review.json. First CLI bare-mode attempt could not use keychain auth; no review/cost/credential change, retried with tools/hooks/MCP disabled.

Non-blocking follow-up queue before authorized publication: distinguish intentionally withheld scheduled/cancelled content from unavailable links; apply the same latest-feed cutoff to the overview's lower participation CTA; document/confirm legacy closed raids with no cancellation event; make OS env allowlist/preview startup ergonomics clearer. Ingestion canonicalizes X targets in apps/api/src/x/oembed.ts, so the parser's lack of photo/video suffix support does not drop current ingested targets. The proof confirms transaction mode, **not a SELECT-only role**; no role/key change is authorized. Review notes for future authorized release: API before web; check anonymous shared-cache rate-limit headroom across communities. Existing post-C22 release conditions remain governing. No source changes after0c79cd4's ACCEPT.

Actual operator: Codex (GPT-6), exact runtime model ID/effort not exposed. Reviewer actual model is recorded from the returned receipt; no invented operator routing label.

Web quiz, native web raid submission and independent member creation remain unfinished. Existing bot submission/setup continues. Provider ownership/app/server settings, owned domain/HttpOnly support, Telegram login-only bot and actual attended login/link/refresh/logout smoke remain open owner steps. Existing separate privacy/wording/scorer/timing queues are not approved by this UI work.

## Publication and organic-sync

Local only. Origin-main **d3b8c6cf92f2ffcdf8fa3094b3709177b1ca4cf9**, next/origin-next **1249feddc5a7d7052fda6de8ac2ed65a0d4274b0**, both histories/held refs preserved. Production API has no new raid route. No push/merge/deploy, accounts/keys/DNS, messages, funding/signing/payment or Organic/vault edits. Freeze Oct9 22:00Z–Oct11 00:00Z and other publication/release holds preserved. All C14–C22 incomplete; actual receipts/payees/amounts none. No Ledger prompt. Keep verify0.1.0 through Oct12 and next0018+0019 untouched.

Organic-sync should propagate local-only raid route/schema/cache contract, account availability and remaining owner/provider proof; do not say website/login shipped. The route needs an authorized API/web release before Organic can use it publicly. Pending source SHAs above plus earlier13 local commits in canonical HANDOFF; resolve this documentation commit with git log for this file.

## Generated artifacts this session

| What | Canonical home | Stage |
|---|---|---|
| Raid schema/service/API/docs | packages/core/src/public-raids.ts; apps/api/src/http/read-raids.ts; routes.ts/openapi.ts | Tracked, local only |
| Cards/refresh/availability | apps/web/components/raids.tsx, raid-refresh.tsx; lib/member-login-server.ts | Tracked; disabled login |
| Preview reader/launcher | apps/api/scripts/preview-raids.ts; apps/web/scripts/preview.mjs | Loopback3011/3010 running; read-only |
| Review/check/screenshots | docs/plans/2026-10-09-raids-* and live-raids-* | Ignored local, no payment/private login receipt |
| Durable checkpoint | docs/HANDOFF.md, docs/BUILDLOG.md, this file | Tracked, public-safe |
| Keys/resources/jobs | None | None created or changed |

## Suggested skills

handoff-memory, the-analyst, verification-before-completion, frontend-design for subsequent member journey, handoff. Existing approved local website/provider direction is answered. Use fresh other-family review for new sensitive changes, and preserve the held next reviews separately.

## Next-session prompt

```text
Payouts/publication/next held. Real raid cards/deadlines/X snapshots and visible disabled Privy controls built77a15f7, fixed0c79cd4. Full1502 tests/type/lint/both builds pass; fresh new-feature ACCEPT at0c79cd4, required route check passed. Production API unchanged. pnpm preview serves real raids through verified read-only loopback reader; other reads stay deployed. Login lacks owned app/domain/provider/cookie proof.
Files: CLAUDE.md, docs/HANDOFF.md, apps/api/src/http/read-raids.ts, apps/api/scripts/preview-raids.ts, apps/web/components/raids.tsx, apps/web/lib/member-login-server.ts, apps/web/scripts/preview.mjs
Model: available coding model at high effort — verify and finish the member journey; record actual runtime identity separately.
Skills: handoff-memory, the-analyst, verification-before-completion, frontend-design, handoff.
Read the checkpoint's latest review verdict and preserve receipts. Show the working Live raids section. Guide Cisco to select the owned dedicated Hyphae app in Privy's dashboard, one action at a time; do not ask for secrets or repeat provider choice. Actual configured HttpOnly/login/link/refresh/logout proof remains necessary before activation. Web quiz/native raid submission remain unfinished. Preserve both histories, next0018+0019, verify0.1.0 through Oct12 and release/freeze holds. No payments, main push/deploy, keys/accounts/DNS or messages.
```
