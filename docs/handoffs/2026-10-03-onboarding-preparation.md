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

Recommendation: one disjoint Hyphae paid pilot in the existing registered chat while Raidar campaigns remain separate; founder policy decision pending. Confirm Raidar rewards/points and registered-chat mapping to the existing MYCEL group stack. Supply genuine registered-group invite, support contact URL and official publishing-account URL; no placeholders. Attend the fifteen-minute external-tester phone test before recruitment, and configure existing read-only DB access locally for the missing direct backlog/schema reads (no credentials in chat). Future implementation, live name correction and group branding remain separately authorized.

Preserve C14–C18 on October 8 (approved admin 0.02 SOL, gross 500,000,000 lamports, exact fresh vault top-up/permanent recipient); pause 23:00Z, final C18b after 23:45Z, owner author attestation/duplicate mappings and corrections accepted strictly before October 9 00:00Z. After 00:00Z require closed epoch/immutable snapshot, hold/safety/ready gates, Ledger publication, genuine signed-wallet claimant and P14 evidence. Hold window through October 10 00:00Z inclusive. Empty/no-payable/unavailable stays honest; no funding/attestation ruling repeated. Phone message signing does not prove the later C21 claim transaction surface.

## Suggested skills

`handoff-memory` to resume; `security-review` for wallet handoff review; `handoff` to close. No helpers.

## Generated artifacts this session

Platform verdict, participant design, raid memo, two bounded plans, reconciled guide/packet, BUILDLOG and canonical/dated public-safe receipts. No credentials, keys, deployed resources or schedules.

## Next-session prompt

```text
Read docs/HANDOFF.md and docs/superpowers/specs/2026-10-03-link-platform-verdict.md. Do not recruit until an attended phone test establishes the signed-link journey. Preserve the recorded October 8–9 packet, SDK 0.1.0 and parked rules/Jev branches. No production mutation is authorized by this receipt.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/demo/2026-10-08-first-payout-readiness.md, docs/superpowers/specs/2026-10-03-link-platform-verdict.md.
Model: gpt-6.1-sol (high) — actual current runtime, for bounded code-path reasoning; apply project routing for the next implementation/review task.
Skills: handoff-memory, security-review, handoff.
Run the owner-attended phone check only under its separate authorization and record surface-specific results without tokens or private member details.
```
