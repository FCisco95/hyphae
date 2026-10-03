---
date: 2026-10-03
summary: Participant candidate and reusable operator-assisted community setup built/reviewed locally; 851 tests/1 skip and 50 Postgres checks passed. Organic owner integration and all live effects remain gated.
---

# Hyphae handoff

Last Updated: 2026-10-03T22:54:52Z

## TL;DR

**Shared community setup is now implemented and independently reviewed locally.** Cisco clarified that each Organic community must use its own group, then instructed this session to continue. The [setup tool/contract](community/SETUP-INTEGRATION.md) validates a private per-community manifest, verifies bot/group/admin, binds the database target, and atomically registers a paused community with its pinned future epoch and no payment eligibility. It preserves existing MYCEL history. **Operator-assisted, not self-service or a full admin dashboard.**

Final setup source **cd4c4ef8a3ed4b47669ecd2dd0c4cd73ed9b437f**, reviewed exact range **072e99b..cd4c4ef**: fresh other-family **APPROVE, no actionable findings** after F1/F2 test-first repairs. Final local gate **851 passed/1 skipped**, real Postgres **50/50**, typecheck/lint/build/DB consistency exit 0. [Setup receipt](handoffs/2026-10-03-community-setup.md), [review](reviews/2026-10-03-community-setup-opus-fixcheck.md). No source delta after that review. Publication remains held under the earlier local-only scope.

**Local T → A → B candidate built, reviewed and verified.** Cisco’s “yes” approved this bounded implementation and the disjoint-Hyphae/Raidar-separate, one-active-brief, hidden-until-phone-PASS choices. It did not supply genuine URLs, technical access, test attendance or live authorization. **No push/deployment/activation or real phone PASS.**

Final source **8841a01e8abdcec4398f1255a8ccd3d1c9423212**; fresh split other-family reviews ACCEPT/no blockers. Gate **803 passed, 1 skipped**, typecheck/lint/build exit 0. [Full implementation receipt](handoffs/2026-10-03-onboarding-implementation.md), [operator/release packet](superpowers/plans/2026-10-03-participant-onboarding-plan.md#candidate-and-release-packet--october-3), [local mobile preview](community/2026-10-03-onboarding-mobile.png).

**Research/document gate COMPLETE for this scope.** Preserve [the durable requirement](superpowers/specs/2026-10-03-project-alignment-and-document-hygiene.md) in later handoffs and recheck changed refs/code/sources. Prepared three-doc patch applied in [the prior scope receipt](handoffs/2026-10-03-onboarding-scope-packet.md); original dated receipts retained. Vault shared alignment remains the owning Brain lane.

## Metadata

- Only FCisco95/hyphae writable. Implementation start d26357e101195019688b981c3ab6c938d1a8ed73, two local docs commits ahead of remote 312cc0ffae1c4efbf5fd69c2b58a5aaf98af28ac. No-prune/ff-only checks preserved local work; no fetched overlap.
- Start [CI 37154342915](https://github.com/FCisco95/hyphae/actions/runs/37154342915) success belongs to remote 312cc0ff only. All new commits remain local; **publication/deployment not authorized**. Closure SHA from git log -1 -- docs/handoffs/2026-10-03-onboarding-implementation.md and final delivery.
- Main runner Codex/GPT-6 family; exact runtime ID/configured effort/usage/cost unavailable. Reviewers actual **claude-opus-5-5/high**, isolated read-only processes, exact ranges and counters in receipt. No implementation helpers or scoring-provider experiment; no prior counters copied.
- Vault/siblings read-only. Concurrent untracked community-onboarding requirements doc read/preserved, not edited or included. New-community setup/auth/provisioning is separate scope beyond step 6.

## Current Objective

The participant candidate and newly authorized shared setup foundation are complete locally. Next: Organic’s owning lane establishes its community-owner authority/settings contract before self-service, plus the existing technical/attended inputs for any live release or registration. Current setup remains operator-assisted, one contribution chat per token. No production operation or full admin dashboard is authorized by this checkpoint.

## Current State

| Stage | Result / limit |
|---|---|
| T built locally | Contextual welcome/help/brief, selective command keyboard, pinned public guidance. Original private link/rules dispatch first, callbacks and personal /me unchanged; no generic guidance writes. |
| A built locally | Generic stored identity/attribution, optional validated Pilot/invite/support, Start here/score explanation and open-epoch actions. Production configuration empty; no MYCEL name override. |
| B built locally | Original-fragment explicit copy/selectable fallback, cancel/retry and expiry/taken/uncertain UX. SDK/message/request-verify-status unchanged; no vendor/adapter/confirmation protocol. |
| Local verified | 803 tests/1 optional skip; typecheck/lint and both builds 0. Desktop/mobile, light/dark preference, 200% CSS zoom, keyboard/focus and simulated wallet flow pass. Screenshots are local fixtures. |
| Prior production evidence | Last public read Oct 3 21:41:03Z: Hyphae Lab, epoch 2/intake open, public counts 0/no settlement. Oct 2 Neon 13 hashes/rules/hold/Fly v11 and Oct 3 prior absent derived chain accounts remain dated receipts, not refreshed internal health. |
| UNKNOWN technical | Single registered row/UUID, exact bot/chat binding, current getChat.type/webhook/migration health; configured DB/bot/Fly access absent. Ownership settled: Cisco owner, bot admin, owner+bot only, Testers separate. September basic-group history is not current type. |
| UNEXECUTED live/phone | Android actual signing, iOS unknown, Telegram/system/wallet-browser matrix, deployment/name/upgrade/placement/menu/message/pin/recruitment. /link message PASS will not establish C21. |

C13 deploy/hash/Ledger/key-retirement evidence remains in [WALLETS](WALLETS.md) and [C13](handoffs/2026-10-02-c13-mainnet-receipt.md). No new initialization/funding/payment; never repeat deployment/funding or fund retired identities.

## Recent Changes

T/A 0e97582; zoom 5907a76; B e003cdf; packaging 5e4b994; review fixes 8f395b4; consistent header 8841a01. Exact source paths only; no manifest/script/DB/reward/program changes. Candidate screenshots and this engineering close added. Review accepted d26357e..e003cdf and e003cdf..8841a01; no unchanged-range repeat.

## Known Issues / Watch List

- Forwarded bearer identity binding and clipboard history/sync remain inherited residuals, not solved by copy/warnings. SDK message has no Telegram identity. New account-confirmation/protocol needs separate authorization/review.
- Close the previous signing page before reopening original/fresh bot URL: same-document hash navigation does not reload client. Copy only ORIGINAL URL with fragment, never stripped address bar. No real device result inferred.
- Same registered Lab, no replacement/Testers registration or same-mint multi-chat support. If current type is supergroup, skip upgrade; if basic, relevant attended in-place plan/read-back preserves UUID/mint/members/epochs/config. Upgrade reversal not promised.
- Low static-review notes and existing newest-active-task/highest-epoch constraints recorded in receipt. No new reward policy. Existing metadataBase build warning left outside scope.
- This candidate serves registered communities; self-service/Organic owner setup is not implemented by welcome/help or the code-owned presentation map.

## Branch Disposition

Rules **158452fe2b22a1e42e5efd42f3f7e11bfdf59c70**, Jev **707d7daf21e217d9a8a64e58514065f5e3bca45e** preserved pushed/unmerged until epoch 3. Local hackathon/r1-exact-reward-points **2fd2470a26ff9a349bceeb697b2731bd1bff0e07** retained. No pruning/deletion/merge/cleanup. SDK exactly 0.1.0 through Oct 12.

## Validation

Shared setup final gate: **851 passed, 1 skipped** (core 106, web 107, API 638); **50/50** real-Postgres cases including 6 setup cases; typecheck/lint (285 files), both builds and drizzle-kit check exit 0. Two synthetic actual-CLI plans ran offline with zero provider/DB calls. Fresh complete setup fix check APPROVE; F1/F2 repaired, F3 operational limits documented. Source/rubric/schema/SDK/lockfile boundaries preserved; only the DB connection factory gained an optional reviewed-target argument, with existing caller defaults unchanged.

Final pnpm test **exit 0, 803 passed/1 skipped** (106 core, 107 web, 590 API); typecheck **0**; lint **0**, 274 files/no fixes; web production build and wallet bundle **0**. Fresh Opus5.5-high static reviews **ACCEPT/no blockers** for complete split source coverage through 8841a01. Original private dispatch and immutable SDK/wallet/flow/store/routes/config/reward/DB/program source checked. Diff/handoff/local-path checks at closure.

Browser: desktop 1280/mobile 390/320, light/dark preference, 200% CSS zoom at 390, 0 overflow/errors; web controls ≥46px/copy 53px; keyboard/focus and local simulated copy/cancel/retry/status flow pass. No physical screen-reader, real wallet/phone, bot binding, new Postgres/production or C21 proof claimed.

## Next Actions

0. **Shared setup:** use the new operator/integration guide only under an explicitly authorized real-community sitting. Organic settings/provisioning remain outside this repo’s public-settlement-only boundary. Establish the owner-authority contract in its owning lane before self-service; never derive it from Telegram admin status or a public page. Original-manifest replay after legitimate name/chat/admin/rubric drift, or unavailable Telegram, needs authorized read-only diagnosis; no overwrite/reseed.

1. Supply/use **existing owner-configured read-only access** for one registered row, exact bot/chat/type/webhook/migration health. Absent access stays UNKNOWN; no credentials pasted, new registration or repeated ownership question.
2. Separately authorize/attend external tester’s own-account Lab phone matrix: /link → ORIGINAL private URL/fragment, close old signing page → Telegram/system/compatible-wallet-browser surfaces recorded separately → unchanged free message → same wallet in own /me. Android signing unexecuted/iOS unknown. Only real qualifying failure/need can request conditional isolated probe; Sentinel stays parked.
3. Supply genuine Lab invite/support/publishing URLs and verify round trips/expiry/rights. Disjoint Hyphae briefs/Raidar separate, one active brief, hidden pilot until PASS already recorded; no repeated choice. Missing URLs leave actions absent.
4. Approve only concrete live packet rows: publication/deployment, name, relevant upgrade/placement/visibility, menu, message and pin each have targets/read-back/rollback. Desired MYCEL / Powered by Hyphae / Pilot; no live name correction. No startup API calls or activation from local approval.
5. C1–C13/readiness complete; **C14–C22 unexecuted**. Oct 8 admin **0.02 SOL**, gross **500000000 lamports**, fresh exact top-up/permanent recipient/author corrections remain approved. Pause **23:00Z**, final C18b **AFTER 23:45Z**, corrections/attestation **STRICTLY BEFORE Oct 9 00:00Z**. Only post-00:00Z close/snapshot/hold/safety, Ledger publication, actual claimant/P14 precede payment claims. Hold through **Oct 10 00:00Z inclusive**; empty/no-payable means no payment. No earlier/repeated operation.

## Quick Reference

[Implementation/review receipt](handoffs/2026-10-03-onboarding-implementation.md), [candidate/operator packet](superpowers/plans/2026-10-03-participant-onboarding-plan.md), [durable gate](superpowers/specs/2026-10-03-project-alignment-and-document-hygiene.md), [phone procedure](superpowers/specs/2026-10-03-link-platform-verdict.md), [placement](superpowers/plans/2026-10-03-lab-community-placement-operator-plan.md), [name](superpowers/plans/2026-10-03-mycel-display-name-operator-plan.md), [guide](community/OPERATING-GUIDE.md), [money packet](demo/2026-10-08-first-payout-readiness.md).

## Resume Checklist

Read latest local checkpoint before syncing. Fetch without pruning; compare local/remote/parked refs and ff-only only, never reset local candidate. Preserve concurrent untracked work. Reuse accepted unchanged reviews/research gate and recheck changed evidence. No publication/live effect without concrete authorization. Vault shared plans remain read-only; this receipt is ready for organic-sync post-ship, not a claim that sync ran.

## Suggested skills

For shared setup: `handoff-memory`, `karpathy-guidelines`, `security-review`, `orca-cli` for worktree state, `model-router` for required fresh other-family review, `handoff`. Parent runtime observed `gpt-6.1-sol` high; reviewers actual `claude-opus-5-5`, high requested with named effort independently unconfirmed.

handoff-memory, security-review if new sensitive changes, handoff; device/browser guidance for separately authorized sitting. No automatic Sentinel/setup lane or implementation helpers.

## Generated artifacts this session

| What | Canonical home | Stage |
|---|---|---|
| T/A/B code/tests | Exact participant contract, source through 8841a01 | Local reviewed, unpushed/undeployed |
| Candidate previews | docs/community/2026-10-03-onboarding-desktop.png and -mobile.png | Captioned local fixtures |
| Engineering receipt | docs/handoffs/2026-10-03-onboarding-implementation.md, HANDOFF, BUILDLOG, existing plan/guide | Portable checkpoint |

No key/credential/community/public message/transaction/deployment/schedule. Local fixture/dev processes stopped at closure; ignored build outputs not releases.

## Resume Prompt

~~~text
Resume only FCisco95/hyphae from latest local docs checkpoint; source 8841a01e8abdcec4398f1255a8ccd3d1c9423212 built/reviewed, final gate803/1 skipped, types/lint/build0. No push/deployment/real phone PASS. Durable research/document gate complete for this scope; recheck changed refs/code/sources. Preserve local commits/concurrent untracked work and old remote312cc0ff, no reset.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-03-onboarding-implementation.md, docs/superpowers/specs/2026-10-03-project-alignment-and-document-hygiene.md, docs/superpowers/plans/2026-10-03-participant-onboarding-plan.md, docs/demo/2026-10-08-first-payout-readiness.md.
Model: GPT-6.1 Sol (high) — recorded sync recommendation; actual previous main ID/effort unavailable.
Skills: handoff-memory, security-review (new changes only), handoff.
Use approved scope/operating choices; obtain existing read-only access, genuine Lab URLs and separately authorized tester attendance. Verify row/bot-chat/type/migration health or UNKNOWN. Own-account phone matrix uses ORIGINAL URL/fragment, close prior signing page, unchanged free message, own /me. Android unexecuted/iOS unknown/C21 distinct. No publish/deploy/name/upgrade/placement/menu/message/pin without concrete approval. Preserve SDK0.1.0 throughOct12, parked rules/Jev, reward branch and exactOct8–10 gates. End at step6; new-community setup is separate scope.
~~~

## Shared setup continuation

Read the setup receipt/contract before repeating owner setup instructions. Completed founder wallet linking and historical scoring remain accepted; a missing named-device receipt does not mean they never happened. Lab is the existing pilot; other token communities get their own groups and scopes. Current quiz catalog support is explicit and registration alone enables no payments. Sentinel remains PARKED at local d6dfbbe, one docs commit ahead of 7210266; 0.2.0 stays unpublished by its recorded state. Hyphae SDK remains 0.1.0 through October 12. No sibling/vault write, probe, live message, community registration, deployment or money action occurred in this setup arc.

```text
Continue Hyphae from current local main. Participant UI and private operator-assisted setup are implemented, reviewed and verified; publication/live effects remain unapproved. Read docs/HANDOFF.md, docs/handoffs/2026-10-03-community-setup.md and docs/community/SETUP-INTEGRATION.md. Preserve the completed research/document alignment requirement, accepted wallet/scoring history, SDK 0.1.0 and dated payout gates. Use the current model-routing reference; gpt-6.1-sol high was the observed setup runtime for this bounded engineering arc. Skills: handoff-memory, security-review, model-router for reviews, handoff. Keep Organic authority/settings implementation in its owning lane, Sentinel parked, and actual registration/deployment/group changes under separate concrete authorization.
```
