# Exact approved web release — October 4

Last Updated: 2026-10-04T20:06:47Z

## TL;DR

**P1+D2 complete and accepted.** GitHub main is exact **a646abc883131ff411d5dd7bbba536176364fe38**. Vercel production **dpl_A9BMEHKgNn8r9NtGtJhFWAunPY5q**, built through its Git integration from that exact source, is READY and owns **https://hyphae-delta.vercel.app**. Actual Lab rendering, static assets, default mint and new web/API token recognition PASS. Exact-source CI is green. Rollback was not used.

No Cisco input remains for this web milestone. Next human step: inspect the [live Lab page](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg). API D1 and attended registered Lab phone proof remain separate scopes.

## Authorization, ownership and source

- Reused [Cisco's October 4 exact approval](2026-10-04-publication-approval.md), including automatic production deployment and old-web rollback. No approval re-asked.
- Applied the checked technical checkpoint patch from the vault's 19:27Z connection receipt against unchanged local base **7f4494aa88580451d89c44dfe55c0c0aa8e3f1d6**. Private strategy and raw credentials stayed outside this repo; vault/siblings read-only.
- Orca reported this as the only live Hyphae writer, **term_dbfd2277-e18d-4cc3-88c1-1a37dc966204**. No worker or successor launched.
- Isolated detached checkout at exact a646; main was never switched/reset. Frozen-lock install PASS. All **7 trees, 17 file hashes, 13 migration hashes** match [source pins](../demo/2026-10-04-combined-source-pins.json). Accepted sensitive source ranges unchanged, no new source review/fix.
- No-prune fetch and immediate pre-push comparison confirmed origin **312cc0ffae1c4efbf5fd69c2b58a5aaf98af28ac** was an ancestor. Held objects/refs retained.
- Executed only `git push origin a646abc883131ff411d5dd7bbba536176364fe38:refs/heads/main`. Exit0; GitHub confirms exact SHA. Normal tool/Git path, no bypass; no installed Git pre-push hook or core.hooksPath override was present. No tool-policy rejection.
- Actual runner metadata: **gpt-6.1-sol**, effort **xhigh**, from this session's turn context; no usage/cost claim.

## Fresh exact-source gates

Node 24.14.0 / pnpm 10.29.3. Test totals **851 passed / 1 optional skip** = 106 core + 107 web + 638 API; disposable local Postgres **50/50** across 7 files. Lint **286 files**, no fixes. No production database used.

| Command | Exit | Seconds |
|---|---:|---:|
| `pnpm test` | 0 | 52.09 |
| `pnpm typecheck` | 0 | 5.1 |
| `pnpm lint` | 0 | 1.49 |
| `pnpm --filter @hyphae/db exec drizzle-kit check` | 0 | 1.04 |
| `pnpm --filter @hyphae/api test:pg` | 0 | 54.85 |
| `pnpm --filter @hyphae/api build` | 0 | 1.44 |
| `pnpm --filter @hyphae/web build` | 0 | 9.19 |
| `git diff --check` | 0 | 0.17 |

[GitHub CI37230455538](https://github.com/FCisco95/hyphae/actions/runs/37230455538): completed/success, headSha exact a646. Includes tests, types, lint, Drizzle, Postgres 17 and H-CONTRACT Python vectors. Local build warning: metadataBase defaults to localhost for social metadata; existing non-blocking warning, no source change authorized here.

## Actual Vercel result

| Field | Verified value |
|---|---|
| Project / owner | prj_zGEwnzy5ATqVXru7apeDkPfrcHSM / team_d8lkX495txxwACU8i2Ode2KF |
| Project root / runtime | apps/web / Node24.x |
| Deployment | dpl_A9BMEHKgNn8r9NtGtJhFWAunPY5q, READY, production, source=git |
| Git source | GitHub FCisco95/hyphae, ref main, gitSource.sha and githubCommitSha both exact a646abc883131ff411d5dd7bbba536176364fe38 |
| Deployment URL | https://hyphae-ftk9hms77-ciscos-projects-c3b3be54.vercel.app |
| Production alias | https://hyphae-delta.vercel.app resolves to the new deployment ID |
| Created / ready | 2026-10-04T20:00:52.043Z / 2026-10-04T20:01:36.961Z |
| Build duration | 38.530 seconds (buildingAt→ready), 44.918 seconds created→ready |
| Runtime error scan | CLI exit 0, zero error records since new deployment creation; bounded scan only |
| Rollback | Not used; retained target dpl_G3xB3NRa78G9UR5GzZmXmsBa62mz / Git312cc0ff |

All three expected settings remain sensitive/Secret with unchanged IDs, targets, timestamps and no branch/custom overrides. No value decrypted/exported: HYPHAE_API_TOKEN **mP8ebrphYjuao0so** production created/updated1790932453806; HYPHAE_API_URL **WWlHJSW7sfnZ3nAc** production+preview created/updated1790689792210; DEFAULT_MINT **grmZA3UTyiFxjVcD** same targets/timestamps. Project Git auto-deploy enabled, automatic aliases enabled, ignored-build command absent. The selected /community streamed refresh destination is exactly the recorded MYCEL /c/ route.

## Live Lab, assets and effective connection

Actual headless **Chromium151.0.7922.34** navigated the production alias at **1280px and 390px**. Both200, h1 Hyphae Lab, all four onboarding steps and score/payment guidance present; official bot link exact. Pilot badge, unverified invite and support buttons absent. **0 page errors, 0 failed requests, 0 horizontal overflow**. Screenshots visually inspected; desktop browser with a narrow viewport is not real phone proof. Epoch 2 page200, empty contributions and explicit no-payout text. Public API health 200/oktrue; exact MYCEL/HyphaeLab; epoch 2 open, closes 2026-10-09T00:00:00Z, contribution/member/count/pending fields 0, allocation/payment unavailable/no_settlement. This is not a private inventory or final C18b audit.

**New deployment token recognition PASS:** live API calibrated shared 3000 / visitor 300. Fresh web claim-read proxy for an absent system-wallet leaf returned404/not_found with no-store. Same trusted visitor bucket moved **297→295**, exactly proxy+after-probe, stable window, **2.70 seconds**. Successful proof:3 direct API GETs +1 web GET causing1 API GET =4 API GETs; preceding verification diagnostics added 2 shared calibration GETs. No quota exhaustion. Inference from the measured behavior: this new web runtime reaches the exact API machine with its recognized token. Token stayed in runtime memory; no secret or caller address saved. This was a read, not a claim/signature/transaction.

Ten browser-observed static assets all200 and independently fetched/hash-recorded. Asset paths belong to the actual aliased deployment; local Next output was not substituted for these bytes.

| Served asset | Bytes | SHA-256 |
|---|---:|---|
| `/_next/static/immutable/media/6f50022166acbf6e-s.p.0p5s766xexjbv.woff2` | 29556 | `adedef4c0363483afc02b377227742e244c2af986461614164fed0ebf893cfb8` |
| `/_next/static/immutable/chunks/0cvo9t8xqx3s3.css` | 17039 | `aa09d15c2832553915391e5691f105557d21495fb2695003b116583676a155ca` |
| `/_next/static/immutable/chunks/0ysl2660y8pea.js` | 16891 | `295d7f9fb6a7cbff0772c4c6b28e2c624352a4b9b6d7e39efb31ba0737b8d7f4` |
| `/_next/static/immutable/chunks/1wijwsjoj5a7d.js` | 14372 | `654eb50627c07fee9ae048f37a02780b9e81ce503518cf51c59f16fc15662a81` |
| `/_next/static/immutable/chunks/31u6sft92vvkw.js` | 426 | `d40735b77eeeca989f67c287bce182fa82065ba66c2101048e17ea29d446a7ca` |
| `/_next/static/immutable/chunks/turbopack-2bcrzuk9f3grf.js` | 10943 | `ea69e6930469d2eb4bd0764d0f71803dbdc5e682aebda9f0d412d3a42a6bf2bd` |
| `/_next/static/immutable/chunks/39qfrzr1wunfq.js` | 229621 | `11ea4c96d9d5f4c5aad960fe89e939cd874425830f825b9a897f66795a298b0d` |
| `/_next/static/immutable/chunks/21zlrb-9t_0te.js` | 183104 | `1ab163e4c2d2fafc855ce89acaf30a3a7571aa89d0da3c1f828840a9ec8f76cc` |
| `/_next/static/immutable/media/5da86df5ffefcee8-s.28r3zgqwx4up8.woff2` | 13336 | `f9b8aebd5c3ea2da4549c6d715bb190be8b783506bc0a26cdf914cf73c75e294` |
| `/_next/static/immutable/media/dbcb2fd8054eae9d-s.04gundfw1xkn2.woff2` | 23144 | `54c23ea733a230c5badfe9c263c6f4f4a8f7f428c69a5ec496fa60b68704c768` |

Verification helper errors were local: a streamed refresh delay assumption, an absent optional API field, a Fetch status method typo and navigation before response-body collection. Corrected checks PASS; no observed application acceptance failure and no product-source repair.

## Preserved scopes and downstream effects

- Fly API 6839d31b317318 and worker 817400c9901de8 remain started/cdg, exact recorded versions **01M3XYGFWD1ZH0VWD581K3NBWP** / **01M3XYGFCH7YQ5EDXFT62TRJNF**, v11 digest **sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2**. Runtime public origins and required presence/minimum token length PASS via safe projections only. No Fly build/rollout/restart or settings write.
- T/B API guidance source published in Git but remains undeployed on Fly. Web A guidance is live; no registered Lab phone PASS or C21 /claim proof. Keep hidden pilot/recruitment hold.
- Later read SDK/starter/adopter source through 202fe957 remains local/unpublished. No npm publication or full-main push. Reuse accepted SDK/adopter reviews and checks.
- Organic task 3.6/DEP-09 remains owner authority/settings/transport work, with public settlement GET as the current boundary. Owning organic-sync should consume this portable receipt; no sibling/vault write or message here.
- Verify0.1.0 remains frozen through October 12; scoring rules/Jev/reward refs retained. Preserve October 8 pause 23:00Z, final C18b after 23:45Z, corrections/attestation strictly before October 9 00:00Z; post-close safety/Ledger/claim/P14 and hold through October 10 00:00Z inclusive. No deploy during that sitting. Empty/no-payable means no payment.

## Git publication boundary

The nine existing commits below remain unpublished because approval covers only a646. This release's documentation checkpoint is also local-only; find it on main under `docs: record exact approved web release acceptance`. Do not push main to publish documentation: that would publish later product source and trigger Vercel.

- `5d2cf6ebf8a4071827a7a53041f6aa12cd800562` — docs: record exact publication approval and pending configuration access
- `eb454d228934c96c98b01da72520a7189561e95f` — feat: add validated public integration starter for communities
- `ff97f71595b7fde2de88da0f5b788d166aef56cd` — feat: add standalone typed public read SDK
- `fc1f379112d21dc7928fc116dabda2355b276024` — docs: authorize bounded SDK adoption arc and sync agreement v2
- `335618498ad4bb65ce9fac6ca4353ae6852816c6` — feat: adopt SDK in CLI and add local community reference app
- `010c68cfe32fd9db98fcf95e3eb273c05be4edee` — fix: harden adopter bootstrap cooldown and portable build
- `64d71bf0df4d845ee28ef91f72e232b1389bef18` — fix(demo): install tarballs portably and recover cooldown
- `202fe957af1bfba90f16ef212e940120a041f204` — fix(demo): preserve multicall entrypoint and prove timer injection
- `7f4494aa88580451d89c44dfe55c0c0aa8e3f1d6` — docs: close accepted local SDK adoption arc

## Suggested skills

handoff-memory, orca-cli for ownership checks, security-review for a separately authorized sensitive/deployment scope, handoff. Reuse accepted source reviews. organic-sync belongs to its owning vault session.

## Generated artifacts this session

| What | Canonical home | Status |
|---|---|---|
| New production web | Vercel dpl_A9BMEHKgNn8r9NtGtJhFWAunPY5q, production alias above | READY, exact a646 |
| Portable safe receipt and asset hashes | This tracked receipt, docs/HANDOFF.md, docs/BUILDLOG.md, existing release packet | Local documentation; later main publication held |
| Validation checkout/logs/screenshots | Temporary local validation only | Cleaned after receipt; no credential/env export; no durable artifact stored only in temp |
| Vercel CLI local link | Temporary auto-created .vercel/project.json + README.txt | Removed; its .gitignore addition restored, no source change |

No credential, bot message, DB/registration/config mutation, wallet signature, transaction, funds movement or schedule created.

## Next-session prompt

```text
Hyphae exact-a646 web release is complete: GitHub/CI and Vercel dpl_A9BMEHKgNn8r9NtGtJhFWAunPY5q READY/production/source/alias, ten assets, actual Chromium Lab render and new web/API token recognition PASS. No rollback used. Later SDK/adopter/main commits remain unpublished; never push full main from this approval.

Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-04-web-release.md, docs/demo/2026-10-04-combined-release-packet.md, docs/demo/2026-10-08-first-payout-readiness.md, docs/handoffs/2026-10-04-adopter-close.md
Model: Codex Sonnet 5 — bounded engineering continuation per the project routing table; recommendation only, previous actual runner gpt-6.1-sol/xhigh.
Skills: handoff-memory, orca-cli, security-review if separately needed, handoff.

Consume the release receipt in the owning organic-sync session. API D1 artifact/rollout and attended registered Lab phone test remain separate scopes with their own preconditions/authorization. No new arc is approved here. Preserve frozen v11 worker, hidden recruitment until real phone PASS, C21 separation, verify0.1.0through Oct 12, heldrefs and exact Oct 8–10 money/close/hold gates; empty means no payment. Inspect the live Lab page as the next human step, without creating a wallet/bot session.
```
