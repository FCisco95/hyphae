# Private raid notifications — local completion and live approval boundary

Last Updated: 2026-10-04T21:25:07Z

## TL;DR

**Accepted local implementation complete; not live.** Cisco's “That would be perfect” approved building community-specific opt-in private raid notifications. Source **f8a360b19352b76a78e57adce2d4222795d20d5f**, reviewed repairs **050753615b456645ac7d95f5de243bec59ec68c4**. Fresh Claude Opus5.5 closing **ACCEPT**; [review/verbatim findings](../reviews/2026-10-04-raid-alerts-opus.md). Code/gates/intercepted actual bot+API transport and two-pool database proof are complete. No real Telegram message/subscription, DB migration, source push, API rollout, secret export or phone test.

**Nearest human action:** approve the bounded [live-release plan](../demo/2026-10-04-raid-alerts-release-plan.md). Original approval covered exacta646 web only; read-only Fly login grants no mutation. New migration/API effects require the explicit working-agreement scope. Do not re-ask the already completed web/login approvals.

## What works locally

Registered group **/notifications** button → official private bot Start → named **Enable raid alerts** button → exact Telegram membership check → only caller/community consent. Future designated-admin-created raids produce private target link/excerpt/brief/UTC deadline and Engage/Stop controls. Opening bot/link, linking a wallet and belonging to another community do not automatically opt in. Stop is per-community; repeat opt-in does not replay history. Subscribing creates no contribution, points, wallet proof or council authority. [Member guide](../community/RAID-ALERTS.md).

Task/outbox creation atomic; original Telegram source identity dedupes webhook retries. Consent revisions fence queued alerts across Stop/re-enable. Private delivery rechecks community/task, current membership and open window. Client calls bounded4seconds; one message/sec/API process. Unstarted claims recover; persisted started-dispatch ownership is one-use. Unknown sends/interrupted started sends/lost receipt writes retain uncertain and never blindly resend. Confirmed429 uses retry_after; blocked recipient stops only that community. No raw credential-bearing errors or recipient IDs in delivery logs.

Existing API process handles delivery; **no extra Fly VM or reward-worker rollout**. Signal handler now drains/exits with a bounded backstop. Schema adds three tables/one enum only; historical0000–0012 hashes unchanged. Existing `/raid` designated-admin permission retained. Council role bridge and explicit engagement-target/evidence enforcement remain their separate [authority ruling](2026-10-04-engagement-authority.md); no authority inferred from Telegram admin status or a leaderboard.

## Exact candidate and evidence

**Candidate c58aa27efdb5bc5492c2f96d45c090c9fc91d379**, local tag **candidate/raid-alerts-2026-10-04**, parent chain publisheda646 → **c73b04d8dfbbc53362eb47d5cb62fa88409b8455** (feature) → **c58aa27efdb5bc5492c2f96d45c090c9fc91d379** (repairs). No branch/worktree owner transfer or successor. Main retained its accepted SDK/adopter commits and was never reset/switched. Candidate excludes that later source; every feature-changed file equals reviewed main050753615b456645ac7d95f5de243bec59ec68c4. No new registry image digest yet; local API build is not a Fly release.

Node24.14.0/pnpm10.29.3. Exact outgoing source **876tests/1optional skip**,106core/107web/663API; new feature25unit/integration+5realPG cases. **55/55 disposable Postgres**. Types/lint297/Drizzle/API+web builds/diff0. `drizzle-kit generate` no change; snapshot tracked. Actual Node SIGINT/SIGTERM child proof and actual grammY command/transport interception, no live egress. No native Windows/real phone/scale proof.

| Exact candidate command | Exit | Seconds |
|---|---:|---:|
| `pnpm test` | 0 | 40.7 |
| `pnpm typecheck` | 0 | 5.25 |
| `pnpm lint` | 0 | 0.36 |
| `pnpm --filter @hyphae/db exec drizzle-kit check` | 0 | 0.34 |
| `pnpm --filter @hyphae/api test:pg` | 0 | 55.94 |
| `pnpm --filter @hyphae/api build` | 0 | 0.71 |
| `pnpm --filter @hyphae/web build` | 0 | 3.42 |
| `git diff --check` | 0 | 0.01 |

Current-main closing root916/1skip, types/lint320/Drizzle/API+web builds0; its full SDK tests are separate main evidence, not part of the outgoing candidate. First PG run caught3 new Date-encoding errors (repaired with ISO values) and1 unchanged reward cutoff-race failure. Subsequent complete53/53,55/55 and final-candidate55/55 passed. Cause of that original cutoff-race failure not established; record as a watch item, no reward test/runtime patch. Existing metadataBase local web-build warning retained.

Migration **0013_raid_alerts.sql SHA-256 7e0f951e3548d335dd8f299390daba14f6d8a6a3f79277a2068b2ecd4cc4b022**. Generated snapshot blob above, no additional migration. Worker/jobs/rewards/payout/core/program/rubric/lock/Fly config/Dockerfile unchanged by this arc. Source-only helper extraction preserves membership semantics, fresh review includes it.

## Release boundary and preserved operation

GitHub/Vercel remain exact **a646abc883131ff411d5dd7bbba536176364fe38** at **dpl_A9BMEHKgNn8r9NtGtJhFWAunPY5q**, production alias hyphae-delta.vercel.app, per [completed web receipt](2026-10-04-web-release.md). API/worker stay existingv11 image; no production check/mutation here beyond read-only Git ref confirmation. Existing Mac Fly0.4.111 login available for read-only checks, configuration opaque, no re-login/Windows question.

Future release must name candidate source, immutable new API image after build, same verified DB target and SQL/journal guard, API6839d31b317318 only and frozen worker817400c9901de8/digestsha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2. It includes exact candidate Git publication/automatic Vercel behavior, image build/publication and additive production migration under the plan's guards. No full-main/SDK push, whole-app deploy, current-epoch/rubric edit, bot rename/menu/registration/recruitment, wallet signature, funds or source fix under old approval. Actual own-account smoke check/genuine target/phone attendance remain separate.

Original a646 approved phone-signing source is in this minimal candidate but not live on Fly yet. Hidden pilot/recruitment stays held until real registered-Lab phone PASS; notifications are not C21 /claim. Organic owner-authority/task3.6/DEP-09 remains open; only public settlement GET permitted. No sibling/vault write; normal owning organic-sync consumes this portable record.

Keep verify0.1.0 throughOct12, held scoring/Jev/reward refs and original two-hour arc checkpoint13:13:09Z historical, not reset. Preserve Oct8 pause23:00Z, finalC18b after23:45Z, corrections/attestation strictly beforeOct9 00:00Z; post-close safety/Ledger/claim/P14 and holder window throughOct10 00:00Z inclusive. No deployment during money/close/hold sitting; empty/no-payable means no payment.

## Pending local commits

All following IDs are unpublished. Original exacta646 approval cannot publish full main; this receipt's documentation commit is also local-only, identified by subject `docs: record reviewed private raid alert candidate and release scope`.

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

## Suggested skills

handoff-memory, orca-cli for ownership/target reads, security-review, karpathy-guidelines for any new repair, Vercel deployment/CLI for approved Git-triggered acceptance, handoff. organic-sync only in its owning vault session. Reuse accepted SDK/adopter reviews.

## Generated artifacts this session

| What | Canonical home | Stage |
|---|---|---|
| Source/tests/additive SQL/snapshot/member guide | apps/api/src/raid-alerts, bot commands, packages/db/drizzle/0013*, docs/community/RAID-ALERTS.md | Local, committed, reviewed |
| Minimal release object | Git tag candidate/raid-alerts-2026-10-04 → c58aa27efdb5bc5492c2f96d45c090c9fc91d379 | Local retention only, no publication |
| Review verdicts and gate evidence | docs/reviews/2026-10-04-raid-alerts-opus.md, this receipt, HANDOFF/BUILDLOG/release plan | Portable, local-only |
| Isolated validation checkout/logs/model responses | Transient local verification, facts preserved above | Cleanup after retention; no durable secret/artifact stranded in temp |

No credential, registry image, VM, migration, actual subscription/message, registration, signature, transaction, funds movement or schedule generated. Actual root modelgpt-6.1-sol/xhigh; reviewerclaude-opus-5-5/high requested, effort unobserved. No usage/cost claim.

## Next-session prompt

```text
Private community raid alerts are locally complete/reviewed at050753615b456645ac7d95f5de243bec59ec68c4, minimal outgoing candidatec58aa27efdb5bc5492c2f96d45c090c9fc91d379 retained under candidate/raid-alerts-2026-10-04. Exact876/1skip/types/lint297/Drizzle/Postgres55/API+web builds green, closing ClaudeOpus5.5 ACCEPT; low advisories retained. No live migration/API rollout/messages. Current public web remains accepted exacta646.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-04-raid-notifications.md, docs/demo/2026-10-04-raid-alerts-release-plan.md, docs/reviews/2026-10-04-raid-alerts-opus.md, docs/community/RAID-ALERTS.md, docs/demo/2026-10-08-first-payout-readiness.md
Model: Codex Sonnet 5 — bounded prepared release per project routing table; recommendation only.
Skills: handoff-memory, orca-cli, security-review, Vercel deployment/CLI if approved, handoff.
Read the recorded live approval before any external effect. Without it, nearest action is approve the named migration/API-only release plan. With it, fresh exact-source/target/config/DB/bot/journal/queue guards, normal hooks, publish only candidate SHA, build/pin immutable API artifact, apply only guarded0013 and update only API with frozenworker retained; verify actual Git/CI/Vercel/API/outbox result and bounded rollback. No fullmain/SDK publication, secret export, current-epoch changes, sibling write, real phone/money/registration/recruitment action inferred. Preserve exactOct8–10 gates and no empty-payment claim. Source changes invalidate this exact pin/approval. Reconcile a published candidate into localmain by a preserving merge after acceptance, retaining existing unpushed SDK work and refs; never reset/delete it or push allmain.
```
