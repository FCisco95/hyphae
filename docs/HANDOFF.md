---
date: 2026-10-04
summary: Exact approved a646 published; Vercel production and live web acceptance PASS. Later local SDK/adopter source excluded; API/phone remain separate.
---

# Hyphae handoff

## Metadata

Project: Hyphae. Scope: completed exact-a646 web release.

Last Updated: 2026-10-04T20:06:47Z

## TL;DR

**Exact approved web milestone complete.** GitHub main **a646abc883131ff411d5dd7bbba536176364fe38**; [CI37230455538](https://github.com/FCisco95/hyphae/actions/runs/37230455538) **success**. Vercel **dpl_A9BMEHKgNn8r9NtGtJhFWAunPY5q READY/production**, exact Git source, [production alias](https://hyphae-delta.vercel.app) and live Lab acceptance **PASS**. Rollback not used. No Cisco input remains for this milestone. [Full portable release receipt](handoffs/2026-10-04-web-release.md) owns all measured results and asset hashes.

**Next human step:** inspect the [live Lab onboarding](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg). This arc ends here. API D1 build/rollout and real registered Lab phone proof remain separate scopes. Hidden pilot/recruitment stays held until actual phone PASS; /link is not C21 /claim.

## Current Objective

The exact approved web publication and actual Vercel acceptance are complete. End this arc; no API or phone execution is included.

## Current State

| Component | Actual stage / next gate |
|---|---|
| P1+D2 exact release | Completed under [October4 approval](handoffs/2026-10-04-publication-approval.md). Only a646 published; no full-main push. |
| Vercel | prj_zGEwnzy5ATqVXru7apeDkPfrcHSM / team_d8lkX495txxwACU8i2Ode2KF, apps/web, Node24.x; new READY deployment above owns hyphae-delta.vercel.app. Old dpl_G3xB3NRa78G9UR5GzZmXmsBa62mz/Git312cc0ff retained, not used. |
| Connection guards | Mac Fly 0.4.111 read-only login available. Exact runtime origins/presence, unchanged opaque Vercel setting IDs/targets/revisions and default-mint redirect PASS. New web token recognition 297→295 in 2.70s PASS. No secret decrypted/exported or config changed. Old access/config UNKNOWN prose in earlier receipts is superseded. |
| Fly | API 6839d31b317318 and worker 817400c9901de8 started/cdg at exact recorded versions, frozen v11 digest sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2. Signing-page fix still undeployed; D1-build artifact digest UNKNOWN. No whole-app deployment or worker restart. |
| Phone | Real registered Lab Android/iOS path UNTESTED; founder's earlier wallet/scoring history remains accepted. New API release and attended own-account T1 separate. Windows unavailable, do not repeat question. |
| Reviewed onboarding/setup | Source e5ee300d / participant8841a01e / setupcd4c4ef accepted, included in exact a646 Git publication. Web A now live; T/B API not deployed. Same registered Lab identity/history, Testers separate. Missing invite/support/publishing URLs remain omitted. |
| Local SDK/adopter | Accepted through 202fe957, privately packed read-client0.1.0, CLI/two-community reference app complete; later source stays unpublished. [Adopter close](handoffs/2026-10-04-adopter-close.md), [closing ACCEPT](reviews/2026-10-04-adopter-closing-check.md), [SDK receipt](handoffs/2026-10-04-read-sdk.md). No unchanged tests/reviews/builds queued. |
| Organic | Owning organic-sync consumes this producer receipt; task 3.6/DEP-09 actor authority/settings/transport still open. Only public settlement GET currently permitted. No sibling/shared write here. |

## Validation

Fresh exact-a646 isolated detached checkout, Node 24.14.0/pnpm 10.29.3: frozen-lock install; **851 tests/1 optional skip** (106 core/107 web/638 API), **50/50 disposable Postgres**, types 0 / lint 0/**286 files**, Drizzle 0, API + web builds 0, diff-check0. **7 trees / 17 file hashes / 13 migration hashes** match [pins](demo/2026-10-04-combined-source-pins.json). Accepted sensitive ranges unchanged, no new review or product-source fix. Normal push path succeeded; no configured Git pre-push hook present and no tool-policy rejection/bypass.

Actual Vercel source/owner/project/target/alias PASS. Chromium151.0.7922.34 at 1280 / 390: Lab 200, four onboarding steps/payment guidance, correct bot, absent unverified actions/pilot;0 page errors/0 failed requests/0 overflow, screenshots visually inspected. Ten served assets200, SHA-256 in release receipt. Epoch 2 page/API show zero contributions and no_settlement, not payment. DEFAULT_MINT exact runtime redirect and new token-recognition proof PASS; safe metadata unchanged. Bounded new-deployment runtime error scan0 records. CI exact-a646 success including H-CONTRACT vectors.

SDK/adopter receipts remain **prior evidence**: root 891/1skip, SDK 26 / starter 14, isolated real tarball/pnpm install/types, Node and actual Chromium two-community fixtures; focused/closing Claude Opus5.5 ACCEPT. NativeWindows UNKNOWN, demo main-module symlink nit documented. This release did not republish/retest that later source or infer real device/registration/scale proof.

Actual session runner **gpt-6.1-sol / xhigh**, attested from turn metadata. No usage/cost estimate.

## Recent Changes

Applied the checked technical connection checkpoint, published exact a646, verified green CI and live Vercel/Lab/asset/token behavior, and saved portable release evidence. No product source or settings changed.

## Git State and publication hold

Started clean main 7f4494aa,27ahead/0behind origin 312cc0ff. No-prune fetch preserved refs; published only exact a646. Local main retained every later commit; before this receipt commit it is7f4494aa,9ahead/0behind origin a646. Documentation checkpoint remains **local-only**, titled `docs: record exact approved web release acceptance`; final commit ID is the local main tip. Do not publish full main or these docs under the old exact-a646 approval.

Unpublished existing commit IDs:

- `5d2cf6ebf8a4071827a7a53041f6aa12cd800562` — docs: record exact publication approval and pending configuration access
- `eb454d228934c96c98b01da72520a7189561e95f` — feat: add validated public integration starter for communities
- `ff97f71595b7fde2de88da0f5b788d166aef56cd` — feat: add standalone typed public read SDK
- `fc1f379112d21dc7928fc116dabda2355b276024` — docs: authorize bounded SDK adoption arc and sync agreement v2
- `335618498ad4bb65ce9fac6ca4353ae6852816c6` — feat: adopt SDK in CLI and add local community reference app
- `010c68cfe32fd9db98fcf95e3eb273c05be4edee` — fix: harden adopter bootstrap cooldown and portable build
- `64d71bf0df4d845ee28ef91f72e232b1389bef18` — fix(demo): install tarballs portably and recover cooldown
- `202fe957af1bfba90f16ef212e940120a041f204` — fix(demo): preserve multicall entrypoint and prove timer injection
- `7f4494aa88580451d89c44dfe55c0c0aa8e3f1d6` — docs: close accepted local SDK adoption arc

Held scoring 158452fe2b22a1e42e5efd42f3f7e11bfdf59c70 and Jev 707d7daf21e217d9a8a64e58514065f5e3bca45e stay unmerged until epoch3; reward branch 2fd2470a26ff9a349bceeb697b2731bd1bff0e07 and review tag 2ca35057c3efbd43df191bda0d9527d526f6886f retained. No pruning/reset/deletion.

## Next Actions

Stop this completed web arc. No source work, review, release-gate repetition or extra publication is authorized. Owning organic-sync should propagate the receipt. Next human step is inspect live Lab page. Before any separately authorized D1/API work, reverify image/target/config and private identity/bot/webhook/schema/jobs guards; a new immutable API artifact must be named, frozen worker retained. Renew actual T1 scope/attendance only in that later arc.

## Known Issues / Watch List

Private registered UUID/chat/admin, bot/webhook/journal/queues/current intake audit remain separately unverified; runtime presence is not their health. No DB/bot/registration/rename/menu/pin/activation effect inferred. Each token has its own contribution group, one disjoint active Hyphae brief, Raidar separate. SDK validates public shapes/identity/arithmetic, not independent chain/Merkle proof. Real phone/C21/scale and actual two-registration proof absent.

C1–C13 complete; C14–C22 unexecuted. [First payout readiness](demo/2026-10-08-first-payout-readiness.md) owns exact commands/addresses/amounts. Preserve **Oct 8 pause 23:00Z**, **final C18b after 23:45Z**, corrections+author attestation **strictly before Oct 9 00:00Z**; post-close safety/Ledger/claim/P14, holder evidence through **Oct 10 00:00Z inclusive**. No deployment during money/close/hold sitting. Empty/no-payable means **no payment**. Verify0.1.0 frozen through Oct 12; held scoring refs excluded. Genuine uptake, author audit, Ledger/Receive-screen attendance, Pro / usage-alert completion before fee and final video/submission remain their original owner gates.

Original autonomous13:13:09Z checkpoint and coordinator14:10:47Z bounded arc remain historical, achieved/accepted; no deadline reset or borrowed runtime/usage. Current sole writer term_dbfd2277-e18d-4cc3-88c1-1a37dc966204 launched no successor.

## Resume Checklist

Read this receipt/CLAUDE/AGENTS before acting; check writer ownership and current refs. Fetch without pruning; never reset or push full main. Carry completed login and release approval without re-asking. Only start a new live scope when concrete authorization/preconditions exist. Shared propagation belongs to its owner.

## Quick Reference

[Release receipt](handoffs/2026-10-04-web-release.md), [combined packet](demo/2026-10-04-combined-release-packet.md), [source pins](demo/2026-10-04-combined-source-pins.json), [approval](handoffs/2026-10-04-publication-approval.md), [payout gates](demo/2026-10-08-first-payout-readiness.md), [adopter close](handoffs/2026-10-04-adopter-close.md), [SDK guide](community/INTEGRATING.md), [local demo](../examples/read-sdk-demo/README.md).

## Suggested skills

handoff-memory, orca-cli for ownership, security-review for a separately authorized sensitive/deployment scope, handoff. organic-sync in its owning vault session. Reuse accepted SDK/adopter reviews; no helpers or Sentinel product work.

## Generated artifacts this session

| What | Canonical home | Status |
|---|---|---|
| Exacta646 web deployment | Verceldpl_A9BMEHKgNn8r9NtGtJhFWAunPY5q, hyphae-delta.vercel.app | READY/accepted |
| Portable release evidence/assets | docs/handoffs/2026-10-04-web-release.md, this handoff, BUILDLOG, existing release packet | Local docs publication held |
| Temporary validation checkout/logs/screenshots and local .vercel link | Disposable verification only | Cleaned; source .gitignore restored, no durable artifacts stranded in temp |

No credential, environment export, DB/bot/config/registration mutation, wallet signature, transaction, funds movement or schedule generated. Prior SDK ignored tarball/report remain rebuildable in packages/read-client/dist; hashes in linked SDK/adoption receipts.

## Resume Prompt

Use the following prompt; the completed web arc must stay closed.

## Next-session prompt

```text
Hyphae exact a646abc883131ff411d5dd7bbba536176364fe38 is published with green CI and accepted Vercel production dpl_A9BMEHKgNn8r9NtGtJhFWAunPY5q/source/alias/assets/Lab/token-recognition proof. No rollback used; later SDK/adopter/main remains local. This web arc is complete; no successor scope inferred.

Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-04-web-release.md, docs/demo/2026-10-04-combined-release-packet.md, docs/demo/2026-10-08-first-payout-readiness.md, docs/handoffs/2026-10-04-adopter-close.md
Model: Codex Sonnet 5 — bounded engineering continuation per the project routing table; recommendation only, previous actual gpt-6.1-sol/xhigh.
Skills: handoff-memory, orca-cli, security-review if separately needed, handoff.

Propagate this release receipt through owning organic-sync; siblings/vault read-only here. Inspect live Lab as next human step. API D1 immutable build/rollout and real registered Lab phone test require their separate scope/preconditions; preserve frozen v11 worker, hidden recruitment until real phone PASS, C21 distinction, verify0.1.0through Oct 12, heldrefs/exact Oct 8–10 money/close/hold gates and no empty-payment claim. Never push full local main from exact a646 approval or repeat accepted SDK/reviews/unchanged gates.
```
