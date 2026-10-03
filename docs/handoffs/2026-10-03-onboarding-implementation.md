---
date: 2026-10-03
summary: Approved local T/A/B candidate built and independently reviewed; 803 tests passed/1 skipped. No push, deployment, real phone test or live activation.
---

# Local participant onboarding candidate

## TL;DR

Cisco’s **“yes”** approved local T → A → B in the existing [participant packet](../superpowers/plans/2026-10-03-participant-onboarding-plan.md), plus disjoint Hyphae briefs with Raidar separate, one active brief and hidden pilot until phone PASS. **Built, committed, reviewed and locally verified; unpushed/undeployed.** Android actual signing remains unexecuted, iOS unknown. No owner URLs/access/test attendance or live authorization arrived with approval.

The [durable research/document gate](../superpowers/specs/2026-10-03-project-alignment-and-document-hygiene.md) remains COMPLETE for this scope; [the applied alignment receipt](2026-10-03-onboarding-scope-packet.md) preserves dated evidence. Recheck changed sources/code/refs before later work. Shared vault and sibling repositories stayed read-only.

## Current State

| Milestone | Local result | Separate live gate |
|---|---|---|
| T | Contextual /start, /help and /help brief; selective one-time command keyboard; public rules/score/payment guidance and actual task/audit window. Private link/rules starts remain first; quiz callbacks and /me untouched. Generic guidance writes no member/task/reward records. | Deployment, Telegram rendering, authorized menu/message/pin effects. No startup registration or automatic greeting. |
| A | Actual API name/attribution, optional validated per-mint Pilot/invite/support, Start here and score/payment explanation, selected open epoch, narrow/zoom layout. Production map empty. | Genuine owner values and separate web deployment; no name override or fabricated link. |
| B | Original-fragment copy on click, readonly fallback after clipboard refusal, deliberate retry and honest expiry/taken/uncertainty; unchanged SDK/message/request-verify-status. Clears copy at terminal outcomes and blocks delayed fallback while signing. | Separate page deployment and attended actual phone test. Mock signing is not phone PASS or C21. |

This guides members of already registered communities. It does not register a group, authenticate an Organic owner or implement self-service setup. A concurrent untracked community-onboarding requirements document appeared during this arc; read/preserved without edits or inclusion in these commits. Setup integration remains separate scope beyond step 6.

## Git and preservation

Implementation start **d26357e101195019688b981c3ab6c938d1a8ed73**, already two local docs commits ahead of remote **312cc0ffae1c4efbf5fd69c2b58a5aaf98af28ac**. No-prune fetch/ff-only synchronization retained them; no fetched changes or overlapping edits. [CI 37154342915](https://github.com/FCisco95/hyphae/actions/runs/37154342915) succeeded for remote 312cc0ff only; no candidate CI/deployment claim.

| Commit | Result |
|---|---|
| 0e97582ac0d1a7e84d52084330c3f9b32708a707 | T/A candidate and scope approval |
| 5907a76402aac87d4592168b9a7d521ba78ce6e2 | Narrow zoom/test typing correction |
| e003cdf114fc5bd50bf767fb8fa84b855c940e52 | B copy/error candidate |
| 5e4b994b8de5fdfcaadd6f583b3ff179f9383385 | Validator without test-only runtime import |
| 8f395b43b2c7d79d00fad9ef074c62cf33228ae0 | Independent-review corrections |
| **8841a01e8abdcec4398f1255a8ccd3d1c9423212** | Final reviewed source; consistent closed-epoch header |

Documentation closure SHA resolves from git log -1 -- docs/handoffs/2026-10-03-onboarding-implementation.md and final delivery.

Exact T/A/B source contract honored. SDK manifests/lockfile, wallet/flow/routes/session/store/proof config/history, original link/rules/member/submission handlers, DB/core/rewards/jobs/program paths compared unchanged. No dependency/script change.

Rules **158452fe2b22a1e42e5efd42f3f7e11bfdf59c70**, Jev **707d7daf21e217d9a8a64e58514065f5e3bca45e** remain pushed/unmerged until epoch 3. Local hackathon/r1-exact-reward-points **2fd2470a26ff9a349bceeb697b2731bd1bff0e07** preserved. SDK exactly **0.1.0 through October 12**. No pruning/deletion/merge or sibling/vault write.

## Validation and review

Test-first failures covered missing welcome/UI/copy behavior, delayed clipboard/signing race, selective keyboard, Unicode truncation, task opening/no-epoch wording, contradictory closed-epoch header and test-only runtime dependency. Corrections stayed inside the named files.

| Check | Actual final result |
|---|---|
| pnpm test | **Exit 0: 803 passed, 1 skipped** — core 106, web 107, API 590. Optional devnet publication skip; no live chain operation. |
| pnpm typecheck | **Exit 0**, repository-wide; initial test-fixture typing errors fixed. |
| pnpm lint | **Exit 0**, 274 files, no fixes/warnings in final run. |
| Web production build | **Exit 0**; existing metadataBase fallback warning, no out-of-contract metadata edit. Local fixture API only. |
| Wallet bundle | **Exit 0**, 6.74 KB minified; ignored build output, no deployment. |
| Scope / diff / handoff | Exact contract, sensitive-source equality and original dispatch verified; diff check passed. 101 local links/resume paths verified; strict handoff passed with only its GitHub-URL heuristic warning. |

Two fresh other-family static reviews used separate Claude CLI processes, safe mode, all tools/hooks/customizations disabled, no session persistence, **actual claude-opus-5-5, high effort**. Neither reviewer executed tests or live operations.

| Review | Exact range | Verdict |
|---|---|---|
| R1 | d26357e101195019688b981c3ab6c938d1a8ed73..e003cdf114fc5bd50bf767fb8fa84b855c940e52 | **ACCEPT, no blockers** |
| R2 | e003cdf114fc5bd50bf767fb8fa84b855c940e52..8841a01e8abdcec4398f1255a8ccd3d1c9423212 | **ACCEPT, no new blockers** |

Useful Low findings fixed: HTTP flow/copy eligibility separated, clipboard race, selective keyboard, no-epoch wording, task opening time, Unicode truncation, addressed-command and real verify-stage wallet-taken tests. R2 confirmed manual validator unknown-key/prototype/type/URL refusals and no runtime test dependency. Unchanged accepted range was not reviewed again.

Prompt SHA-256 R1: 95bc7c46a8cf09249f96814167183de5d216096f446fe60a99d02dae2e11a3cc; R2: 04863939a8ea16a029705cef65c917881ba3c83e7eddfe5803b5d80be8dbc4a9. Durations 140290/103183 ms. CLI counters R1 input 2/cache-read 531/cache-created 40091/output 14473 (thinking 12090); R2 input 2/cache-read 1463/cache-created 18182/output 10313 (thinking 8471). Thinking is not added again to output. Reported list-cost estimates $0.6103022/$0.3520166 are not verified charges.

Main runner: Codex, GPT-6 family in session contract; exact runtime identifier/configured effort and usage/cost unavailable. No prior-session counters reused. No implementation helpers; only the required review processes. Skills: handoff-memory/handoff, TDD, React best practices, requesting-code-review/security-review and local verification. Official Telegram/grammY/Drizzle plus installed Next page docs used; Context7 was not exposed.

## Local browser evidence

Existing cached Playwright and installed Chromium; no dependency installation. Initial executable mismatch resolved with an already installed executable. Local Next → fixture read API → real schema parsing → community/epoch/unavailable rendering. Wallet page used the actual bundle, simulated Wallet Standard and mocked HTTP, never a real account or production connection.

- Desktop 1280, mobile 390/320, light/dark preference: both pages **0 horizontal overflow/0 page errors**. Web controls ≥46px, copy button 53px.
- **200% CSS zoom at 390px** passes after header/table correction. Rendered zoom simulation, not a physical phone. Keyboard order/focus, retry focus, selectable fallback and return-to-copy focus checked. ARIA labels/live statuses inspected; no physical screen-reader claim.
- Selected-mint audit navigation, another-mint identity, no-payout fixture and unavailable fixture verified. No real invite/support/join/bot-health inference.
- Original fragment survives copy after history removal; no automatic request/copy/connect/sign. Clipboard success/refusal, late wallet registration, cancel/retry, unchanged message, cleared manual field, uncertain request→verify→status exactly once and invalid-token refusal pass.
- Harness corrections: wait for streamed unavailable heading; use a fresh document between wallet cases. Same-page hash navigation does not reload client. UI directs closing the previous signing page before reopening original/fresh bot URL. Not a phone failure; no Sentinel probe.

Reviewed screenshots, visibly captioned **LOCAL CANDIDATE · fixture data · not deployed**: [desktop](../community/2026-10-03-onboarding-desktop.png), [mobile](../community/2026-10-03-onboarding-mobile.png). No bearer/signature/payment proof. October 2 historical screenshots unchanged.

## Residuals and operator inputs

Forwarded-link account binding and clipboard history/sync remain inherited risks. Copy/warnings do not provide account confirmation. New protocol/vendor work needs separate scope; SDK bytes unchanged.

Low review notes retained: dependency source guard covers this file’s direct imports only; code-point truncation can split a grapheme; token regex is duplicated/tested; selected latest-open/unexpired task may be future-dated and now shows its opening time. No new reward/selection rule. Existing latestEpoch chooses highest index; materialization creates next at/after previous close, bootstrap refuses an existing chain. Manual overlapping/future rows remain operator integrity concerns.

Single registered row/exact bot-chat binding/current getChat.type/webhook/deployed migration health **UNKNOWN without configured access**. October 2 rules/hold/13-hash/Fly v11 receipt stays prior. Ownership settled; no replacement Lab/Testers registration or repeat owner question.

**Android actual signing UNEXECUTED; iOS UNKNOWN.** Separately authorize and attend external tester’s own Lab account/wallet: group /link → ORIGINAL private URL/fragment → record Telegram/system/compatible-wallet-browser separately → unchanged free message → same wallet in own /me. Phone PASS gates recruitment/activation; not C21. Sentinel remains parked; conditional isolated probe only after qualifying real failure/need.

Owner inputs: genuine registered-Lab invite/support/publishing URLs, existing read-only access and separate test attendance. Disjoint Hyphae briefs/Raidar separate, one active brief and hidden until phone PASS are recorded, not repeated questions. Actual brief/visibility/name changes remain unexecuted.

The existing participant packet owns separate menu, message/pin, deployment, name, relevant in-place upgrade/placement and visibility targets/read-backs/rollback. Preserve same UUID/mint/members/epochs/config. No automatic calls; upgrade has no promised reversal. All live effects require concrete approval.

## Money gates

C1–C13/readiness complete; **C14–C22 unexecuted**. Oct 8 admin **0.02 SOL**, gross **500000000 lamports**, fresh exact vault top-up/permanent recipient and existing author-attestation corrections approved. Pause **23:00Z**; final C18b **AFTER 23:45Z**; corrections/attestation accepted **STRICTLY BEFORE Oct 9 00:00Z**. Post-00:00Z close/snapshot/hold/safety, Ledger publication, actual claimant/P14 before payment claims. Hold through **Oct 10 00:00Z inclusive**. Empty/no-payable means no payment. No early/repeated money/deployment/funding or SDK/rules/Jev release.

## Suggested skills

handoff-memory, security-review if new sensitive changes, handoff. Reuse accepted unchanged review ranges. Device guidance only for separately authorized sitting; no automatic Sentinel/setup lane.

## Generated artifacts this session

| What | Home | Stage |
|---|---|---|
| T/A/B source/tests | Exact participant files and commits above | Local, reviewed, unpushed/undeployed |
| Screenshots | docs/community/2026-10-03-onboarding-desktop.png and -mobile.png | Local fixture evidence |
| Engineering checkpoint | This receipt, HANDOFF, BUILDLOG and existing plan/guide | Portable docs |

No key/credential/community/public message/transaction/deployment/schedule generated. Local fixture/dev processes stopped at closure; ignored build outputs are not a release.

## Next-session prompt

~~~text
Resume only FCisco95/hyphae. Final local source 8841a01e8abdcec4398f1255a8ccd3d1c9423212 is built and accepted by fresh split exact-range Opus5.5-high reviews. Gate 803 passed/1 skipped; typecheck/lint/build exit0. No push/deployment/actual phone PASS. Durable research/document gate complete for this scope; recheck changed refs/code/sources. Preserve local commits and concurrent untracked work; never reset to old remote 312cc0ff.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-03-onboarding-implementation.md, docs/superpowers/specs/2026-10-03-project-alignment-and-document-hygiene.md, docs/superpowers/plans/2026-10-03-participant-onboarding-plan.md, docs/demo/2026-10-08-first-payout-readiness.md.
Model: GPT-6.1 Sol (high) — current recorded sync recommendation; main runner exact ID/effort unavailable.
Skills: handoff-memory, security-review (new changes only), handoff.
Obtain existing read-only access, genuine Lab URLs and separate tester attendance. Verify one row/bot-chat/type/migration health or leave UNKNOWN. Run own-account phone matrix only when authorized, ORIGINAL URL/fragment, close prior signing page before reopening, unchanged free message and own /me. Android unexecuted/iOS unknown/C21 distinct. No push/deploy/name/upgrade/placement/menu/message/pin without concrete authorization. Preserve SDK0.1.0 through Oct12, rules/Jev until epoch3, local reward branch and exact Oct8–10 gates. Arc ends at step6; community setup integration separate.
~~~
