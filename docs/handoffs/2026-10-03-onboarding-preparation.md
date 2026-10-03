---
date: 2026-10-03
summary: Read-only pilot observations and code-path wallet verdict; onboarding design and operator plans, no production changes.
---

# October 3 onboarding preparation receipt

## TL;DR

Epoch 2 is still empty and open; the live name remains Hyphae Lab. Signing requires a wallet registered in the actual browser. Telegram's no-provider surface fails; a phone wallet-browser journey is untested and blocks recruitment. Use [the platform verdict and fifteen-minute test](../superpowers/specs/2026-10-03-link-platform-verdict.md) first. Design/planning only; no attended test or production mutation in this session.

## Fresh read-backs versus prior receipt

Arc start `3a361e76801a78f0392ec0ca42dfb8ff1f1445d6`, clean `main = origin/main`; fetch without pruning and fast-forward-only pull succeeded, already current. [CI 37050134269](https://github.com/FCisco95/hyphae/actions/runs/37050134269) independently returned completed/success for that exact SHA. Only this main worktree is registered. On this Mac the parked branches exist as remote-tracking refs and on the remote, not local branches: rules `158452fe2b22a1e42e5efd42f3f7e11bfdf59c70`, Jev `707d7daf21e217d9a8a64e58514065f5e3bca45e`. Neither merged/deleted. The unrelated existing local `hackathon/r1-exact-reward-points` branch was untouched.

| Fresh observation (UTC, October 3) | Comparison / limit |
|---|---|
| 18:41:00–02: API health/docs/OpenAPI/community/epoch/wallet claims/link assets HTTP 200; website home, claim, community, epoch and leaderboard HTTP 200. Observed request durations 134–1,524 ms in this small concurrent sample. | Matches October 2 reachability. Point availability only; no continuous uptime percentage, rendered device/visual proof, or scoring-provider availability claim. |
| 18:41:21: API `as_of` 18:41:21.208Z, stored name **Hyphae Lab**, intake open, epoch 2 open Oct 2 00:00Z → Oct 9 00:00Z; epoch 1 closed. | Matches prior receipt; MYCEL rename not live. Telegram group names/permissions are founder-supplied context, not freshly read from Telegram. |
| 18:41:21: epoch API `as_of` 18:41:21.440Z, rubric **1.2.0**, counts contributions/members/counted/pending/pending-at-close/pending-reconciliation/excluded **all 0**, point units/points **0**, snapshot not frozen. | Fresh public submission/scoring inventory is empty, matching October 2. No live submission or scoring/model call performed. |
| 18:41:21–22: contributions endpoint total **0**, empty list; leaderboard total entries/contributions **0/0**; epoch allocation/payment/settlement unavailable **`no_settlement`**; Ledger wallet claims **0**, empty. | Matches prior uptake/no-payment truth. Public counts do not expose the full pg-boss backlog or every legacy submission. |
| Individual Ledger claim leaf 404 `not_found`; actual website claim proxy 404 `not_found`, **no-store**. Epoch HTML says “No payout exists”; community HTML still says Hyphae Lab. | Expected empty state, not evidence of payment or service failure. HTTP/HTML inspection only; reuse prior real mobile/desktop screenshots as historical. |
| 18:41:22: `/link` no-store, no-referrer, self-only CSP; served bundle contains existing no-wallet instruction and fragment removal. | Confirms corresponding code-path behavior is represented in served assets; no real token/proof request used. |
| 18:41:40: public mainnet RPC genesis exact; finalized slot **453017150**, community `HRkBN4sX7NyPEfa4SfRoTsP1dynmPDLMYbY7qLa4XbRX`, vault `AC3zkGQ9abJs6sssaY5nDX8Qjv2UM19r4JYLgcHoG86K`, epoch 2 `J7ipBhK2eJu8QFGtXTsYWNDhPYzcerwX22UkkJTaCPXG` **all null/absent**. | Matches prior absent accounts; no initialization or funding. Program hash/authority/admin balance remain prior C13/readiness receipts, not refreshed here. |
| Direct Neon transaction, schema hashes, pg-boss/scoring backlog, Fly machine image and `evaluatePayoutGate`: **not refreshed**. | Root/API `.env` and required credential environment variables are absent; Fly CLI unavailable. No secret was fetched/changed or printed. October 2 17:02–17:08Z counts/image remain explicitly prior. Refresh using an owner-configured read-only connection; never infer all jobs healthy from zero public rows. |

No live observation contradicted the prior receipt. No database, Telegram, Vercel or sibling/vault write; no group/public message. The fixed October 8–9 gates remain in [the operator packet](../demo/2026-10-08-first-payout-readiness.md); C1–C13 are complete, C14–C22 are unexecuted. SDK stays exactly 0.1.0 through October 12.

## Current State

Code-path verdict written before onboarding design; [participant design](../superpowers/specs/2026-10-03-participant-onboarding-design.md), [implementation plan](../superpowers/plans/2026-10-03-participant-onboarding-plan.md), [raid memo](../superpowers/specs/2026-10-03-raid-system-decision-memo.md) and [display-name operator plan](../superpowers/plans/2026-10-03-mycel-display-name-operator-plan.md) subsequently written, not implemented. Guide/packet reconciled. Signature happens in the selected wallet's browser, not in Telegram/server. Android/Telegram Desktop without a registered provider FAIL by code; their actual Hyphae URL-opening behavior and system/wallet browsers remain device-unconfirmed. Sentinel's discovery finding applies partially, not as proof of the entire Hyphae flow.

## Validation

Initial local test failed because Mac dependency links were stale (`@solana/kit` missing). `pnpm install --frozen-lockfile` restored ignored dependencies without manifest/lockfile changes. Full rerun: **727 passed, 1 skipped** (core 106, web 80, API 541); typecheck exit 0, lint exit 0 (**266 files**). No source implementation changed. Final pre-push rerun also passed **727/1 skipped**, typecheck/lint exit 0, **266 files**; strict handoff, 74 local links/resume paths, credential-shaped-content and diff checks passed. Shipping and final CI receipt follow below after execution.

## Owner inputs and unchanged gates

Recommendation: one disjoint Hyphae paid pilot in the existing registered chat while Raidar campaigns remain separate; founder policy decision pending. Confirm Raidar rewards/points and the exact chat identity before any mutation; the screenshot-level distinction between Lab and Testers is resolved below. Supply genuine registered-group invite, support contact URL and official publishing-account URL; no placeholders. Attend the fifteen-minute external-tester phone test before recruitment, and configure existing read-only DB access locally for the missing direct backlog/schema reads (no credentials in chat). Future implementation, live name correction and group branding remain separately authorized.

Preserve C14–C18 on October 8 (approved admin 0.02 SOL, gross 500,000,000 lamports, exact fresh vault top-up/permanent recipient); pause 23:00Z, final C18b after 23:45Z, owner author attestation/duplicate mappings and corrections accepted strictly before October 9 00:00Z. After 00:00Z require closed epoch/immutable snapshot, hold/safety/ready gates, Ledger publication, genuine signed-wallet claimant and P14 evidence. Hold window through October 10 00:00Z inclusive. Empty/no-payable/unavailable stays honest; no funding/attestation ruling repeated. Phone message signing does not prove the later C21 claim transaction surface.

## Suggested skills

`handoff-memory` to resume; `security-review` for wallet handoff review; `handoff` to close. No helpers.

## Generated artifacts this session

Platform verdict, participant design, raid memo, two bounded plans, reconciled guide/packet, BUILDLOG and canonical/dated public-safe receipts. No credentials, keys, deployed resources or schedules.

## Shipping and runtime closeout

Milestones **`c6cac7ab0fd2cc97fe40264fafcf20655004585c`**, **`87db766b70a7486dc6e0279297900cfee189d68c`** and **`ef41856f89eee52e83a65bc32787e5c2728419eb`** are pushed on main. Reconciliation [exact-SHA CI 37146347200](https://github.com/FCisco95/hyphae/actions/runs/37146347200) independently **completed/success**, including tests/typecheck/lint, migration consistency, Postgres 17 and H-CONTRACT vectors. Post-push `git status -sb` was clean `main...origin/main`. Rules/Jev are verified unmerged; candidate is an ancestor of main. Only the ten authorized documentation files changed across the arc; source, manifests and lockfile are byte-unchanged.

This final documentation-only receipt commits the observed result. Its own SHA is resolved with `git log -1 -- docs/handoffs/2026-10-03-onboarding-preparation.md`; its own push/exact-SHA CI is checked at final closure, not assumed from the reconciliation run. Required fresh local gate before this receipt push: **727 passed, 1 skipped**, typecheck/lint exit 0 (**266 files**). Strict handoff, all **74** local Markdown links, resume paths, credential-shaped-content scan and diff checks passed; only the validator's GitHub URL path heuristic warning. No independent runtime review claimed because no wallet/auth/reward/DB code changed; a future wallet implementation requires fresh other-family review.

Actual runtime `gpt-6.1-sol`, effort **high**. Latest captured cumulative usage at **2026-10-03T19:05:10.854Z**: input **5,457,210**, cached input **5,282,688**, output **35,481** (reasoning output reported **6,964**), total **5,492,691**; cache-write **0**. These runtime counters include repeated requests/cache reads; reasoning is not added to total again. Capture excludes later receipt commit/push/CI-wait/final-response calls. Cost unavailable; no helpers or live paid scoring/provider experiments.

## Owner screenshot follow-up

Owner-provided screenshots, October 3: **Hyphae Lab and Mycel Testers are separate chats**. Hyphae Lab shows existing Hyphae bot replies tied to the MYCEL community; the shown messages are historical (September 29/epoch 1), not a fresh bot/phone proof. The MYCEL Community list shows **two distinct entries named Mycel Testers**; check the intended chat before inviting or configuring anything. No raw screenshots, tester identity or unrelated chats were saved. Recommendation: retain the registered Hyphae Lab chat, add that existing chat to the MYCEL Telegram Community if the owner UI offers it, and invite the existing external tester there. Simple placement is distinct from registration; a basic-to-supergroup upgrade changes chat ID and requires existing-handler read-back; no Telegram or database action was performed.

Fresh October 3 19:29:59Z read-only API follow-up: health 200/ok, name Hyphae Lab, intake/epoch 2 open, all public contribution/count/pending fields 0, no settlement. Prior final receipt `a1104cd9b8acc62a0593a12c99bf871a148e05b4` has independently verified [exact-SHA CI 37146676986](https://github.com/FCisco95/hyphae/actions/runs/37146676986) completed/success. This new docs-only checkpoint passed its fresh gate: **727 tests, 1 skipped**, typecheck/lint exit 0 (266 files), strict handoff, 64 local links/resume paths and diff check. Its push/exact-SHA CI are verified at closure; no runtime source changed.

## Ownership / eligibility correction

**Ownership established, not an open question:** Cisco created Hyphae Lab on September 17; owner-provided group information shows Cisco as owner and Hyphae as admin, the only two members. The September 16 build log already recorded the bot as Lab admin. **Historical group type:** `docs/handoffs/2026-09-24-afternoon-session-end.md` says to keep Lab a basic group until deployment. Telegram's current Community documentation refers to supergroups/channels, so basic-group type is the leading explanation for the missing picker entry; current `getChat.type` remains unconfirmed. Read-only Computer Use captured the existing historical chat but could not open settings: `window_not_focused` twice, including after the permitted restore retry; no click/settings effect or production write. Do not ask for ownership proof again or claim the type is freshly verified. The [bounded placement/upgrade operator plan](../superpowers/plans/2026-10-03-lab-community-placement-operator-plan.md) requires read-only type/binding checks, explicit owner-attended upgrade authorization and read-back of the same community's new chat ID. Hyphae already has the reviewed migration handler. No upgrade, placement, rename, invite or message was performed.

Primary source: [Telegram Community limits](https://core.telegram.org/tdlib/options), plus the historical basic-group ruling cited above. Live type is inferred, not measured. The reviewed code path is `apps/api/src/bot/chat-migration.ts`; migration support is already built and accepted in the cutover. Prior correction `e830dc8e3fee708df79b0d92a42298fec2535677` pushed, CI 37148464379 success. This new documentation-only checkpoint passed **727 tests, 1 skipped**, typecheck/lint exit 0 (266 files), strict handoff, 73 local links/resume paths and diff check; push/exact-SHA CI are checked at closure. Raw images remain uncommitted; no private identifiers copied.

Latest diagnostic checkpoint: actual model `gpt-6.1-sol`, effort **xhigh** (earlier design work used high), at **2026-10-03T20:52:08.395Z**: cumulative input **15,381,339**, cached input **14,598,144**, output **64,686** (reasoning output reported **21,042**), total **15,446,025**, cache-write 0. These counters include repeated requests; reasoning is not added again to total. Excludes later shipping/wait/final calls; cost unavailable. No helpers or live paid scoring calls.

## Next-session prompt

```text
Read docs/HANDOFF.md and docs/superpowers/specs/2026-10-03-link-platform-verdict.md. Do not recruit until an attended phone test establishes the signed-link journey. Preserve the recorded October 8–9 packet, SDK 0.1.0 and parked rules/Jev branches. No production mutation is authorized by this receipt.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/demo/2026-10-08-first-payout-readiness.md, docs/superpowers/specs/2026-10-03-link-platform-verdict.md.
Model: gpt-6.1-sol (high) — actual current runtime, for bounded code-path reasoning; apply project routing for the next implementation/review task.
Skills: handoff-memory, security-review, handoff.
Run the owner-attended phone check only under its separate authorization and record surface-specific results without tokens or private member details.
```
