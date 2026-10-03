---
date: 2026-10-03
summary: Read-only uptake refreshed; wallet platform verdict, participant design, raid recommendation and bounded plans written. Phone proof and owner inputs parked; no implementation or production change.
---

# Hyphae handoff

## TL;DR

**Read the [one-page wallet verdict/test](superpowers/specs/2026-10-03-link-platform-verdict.md) first.** Hyphae signs in the browser’s registered wallet, not inside its server or Telegram. No-provider Telegram Android/Desktop surfaces FAIL by code; actual Hyphae opening behavior remains device-unconfirmed. Mobile system/wallet browsers and iOS are UNKNOWN on real devices. Sentinel’s measured discovery gap applies **partially**: same wallet requirement, different ordinary-URL flow. The existing private URL already supports manual wallet-browser handoff; copying the stripped address bar loses its token. **No attended Hyphae phone test was run. Recruitment stays parked until that path passes.**

The [onboarding design](superpowers/specs/2026-10-03-participant-onboarding-design.md), [bounded implementation plan](superpowers/plans/2026-10-03-participant-onboarding-plan.md), [raid memo](superpowers/specs/2026-10-03-raid-system-decision-memo.md) and [display-name operator plan](superpowers/plans/2026-10-03-mycel-display-name-operator-plan.md) are written and reviewable, **not implemented**. Recommend one disjoint Hyphae paid pilot brief in the registered chat while existing Raidar campaigns remain separate; this policy choice needs Cisco’s ruling.

Fresh October 3 18:41Z reads still show **Hyphae Lab**, open epoch 2, rubric 1.2.0, zero contributions/leaderboard/settlement and absent mainnet community/vault/epoch accounts. Approved naming remains **MYCEL / Powered by Hyphae / Pilot**; live rename not performed. C1–C13/readiness complete, C14–C22 dated/attended and unexecuted; SDK exactly **0.1.0 through October 12**, rules/Jev unmerged until epoch 3. No mainnet contributor payment, new funding, publication or group message.

## Metadata

- Repo `github.com/FCisco95/hyphae`, branch main, scope this checkout only. Start `3a361e76801a78f0392ec0ca42dfb8ff1f1445d6`; [exact-SHA CI 37050134269](https://github.com/FCisco95/hyphae/actions/runs/37050134269) independently completed/success. Fetch without pruning; fast-forward-only pull already current.
- **Actual runtime: `gpt-6.1-sol`, effort `high`**, from this thread’s local turn metadata. No helpers or live scoring/model-provider calls. Skills applied: `handoff-memory`, `security-review` for wallet/token design guidance, `handoff`.
- Runtime cumulative usage at **2026-10-03T18:54:31.466Z**: input **2,447,312**, cached input **2,298,496**, output **22,113** (reasoning output reported **2,732**), total **2,469,425**; cache-write 0. These are actual runtime counters over repeated requests, not unique context words; reasoning is not added again to total. This is a checkpoint, excludes subsequent closure calls; cost is not exposed. Final captured usage/check results are appended to the dated snapshot at closure.
- Read only: required vault master-plan §§3, 6.5, 6.6 and scope-reset §8, plus sibling Sentinel wallet-handoff design. No private strategy copied into tracked docs, no vault/Organic/Sentinel/public-program write.

## Current Objective

Complete documentation shipping/CI, then let Cisco run the fifteen-minute phone test and resolve owner inputs before any implementation or activation. `/organic-sync post-ship` consumes [the portable October 3 snapshot](handoffs/2026-10-03-onboarding-preparation.md); this session does not update the vault board or private plan.

## Current State

| Fresh October 3 read | Result / relation to prior receipt |
|---|---|
| 18:41:00–02 HTTP | API health/docs/OpenAPI/community/epoch/wallet/link assets and site home/claim/community/epoch/leaderboard 200. Sample request durations 134–1,524ms. Point availability only; no continuous uptime or new rendered screenshot proof. |
| 18:41:21 community API | `as_of` 18:41:21.208Z; Hyphae Lab, intake open, epoch 2 open Oct 2 00:00Z → Oct 9 00:00Z; epoch 1 closed. Matches prior. |
| 18:41:21 epoch/submission/scoring reads | `as_of` 18:41:21.440Z; rubric 1.2.0; contributions, members, counted, pending, pending-at-close, reconciliation and excluded all 0; points/units 0; snapshot not frozen. Contribution list empty/total 0; leaderboard entries/contributions 0/0. Matches prior empty uptake. |
| Settlement/claims/site | Allocation/payment/settlement unavailable `no_settlement`; Ledger claims 200/empty, 0. Individual leaf and actual site proxy 404 `not_found`, proxy no-store. Epoch HTML says no payout; community HTML Hyphae Lab. Matches prior. |
| 18:41:40 finalized mainnet | Genesis exact; slot 453017150: derived community `HRkBN4sX7NyPEfa4SfRoTsP1dynmPDLMYbY7qLa4XbRX`, vault `AC3zkGQ9abJs6sssaY5nDX8Qjv2UM19r4JYLgcHoG86K`, epoch 2 `J7ipBhK2eJu8QFGtXTsYWNDhPYzcerwX22UkkJTaCPXG` all absent. Matches prior. |
| Direct DB/Fly/operator checks | **Not refreshed:** `.env`/credential variables absent, Fly CLI unavailable. Neon schema/job backlog/legacy submissions, exact UUID/chat, binding/admin balance, evaluator and Fly image remain October 2 prior receipts. Zero public rows do not prove every job healthy. Parked for an owner-configured read-only connection. |

No fresh live contradiction found. Read [the snapshot](handoffs/2026-10-03-onboarding-preparation.md) for endpoints, timing and limits. No real token, signature, live submission, paid evaluation or private identity printed/committed. Telegram group/title/pin/permission information is founder context, not a fresh bot/group inspection.

Accepted C13 remains: mainnet program `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`, sole Ledger authority `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`, 229,432-byte executable and accepted hash. Deployment spend 1.168463032 SOL under 1.2 cap; 0.051537968 SOL returned, temporary keys retired/deleted. These were not replayed or freshly rehashed. [WALLETS](WALLETS.md) and [C13 receipt](handoffs/2026-10-02-c13-mainnet-receipt.md) remain canonical; never fund retired keys.

## Recent Changes

- One-page code trace/platform verdict and fifteen-minute manual phone test, written before design.
- Reviewable participant design: generic multi-community UI, exact naming hierarchy, owner-verified two-way links, explicit phone handoff dependency, rules/score/eligibility, coordinator, accessibility/mobile/empty/error states and anti-phishing copy.
- Bounded implementation plan with exact future writable files, meaningful tests, accessibility/screenshots/rollback; no runtime implementation. A proposed copy-original-link control is not shipped.
- Raid memo recommends separate campaigns and one authoritative pilot ledger; owner choice parked. Display-name operator plan is conditional/idempotent and preserves registered identity; no database/Telegram/Vercel write.
- Guide and October 8–9 packet reconciled; historical observations remain prior, phone/recruitment dependencies explicit, gates unchanged.

## Known Issues / Watch List

- Existing MYCEL Telegram Community includes Buy Calls/Safeguard, Trenches, Raid Team/Raidar, Announcements and two-member Testers with one external tester. **Which of these maps to the registered Hyphae chat is unverified.** No same-mint multi-chat or self-service support; do not change registration by assumption.
- Wallet-browser compatibility and actual Android/Desktop opening behavior need attended proof. iOS is untested. A `/link` signed-message PASS does not prove C21 transaction signing. Current bearer links can bind a signer to the issuing member if forwarded; SDK 0.1.0’s message does not display Telegram identity. Anti-phishing copy is guidance, not Sentinel’s confirmation protocol. New account-confirmation would require separate security design/review.
- Official registered-group invite, support contact and publishing account are still missing owner-supplied values. No placeholders can ship. Bot URL is configured; ownership/permissions and actual two-way group links need owner read-back.
- URL submissions choose the latest active task; use one active pilot brief. No imported Raidar points or retroactive cross-system exclusion rule. Free-form text is independent of raids.
- WHITEPAPER’s historical rules-test deployment row is stale relative to accepted C7/readiness receipts. It was read, not changed (outside this session’s writable scope); use the packet/current handoff for present deployment truth.

## Branch Disposition

Only the main checkout is registered on this Mac. Remote/remote-tracking rules `158452fe2b22a1e42e5efd42f3f7e11bfdf59c70` and Jev `707d7daf21e217d9a8a64e58514065f5e3bca45e` match, unmerged; local branch copies are absent here. Existing unrelated local `hackathon/r1-exact-reward-points` untouched. No pruning or branch cleanup. Former detached candidate is an ancestor of main; unique proof remains `docs/handoffs/assets/2026-10-02-epoch-proof.ts.txt`, historical only, not a portable operator entrypoint.

## Validation

Initial `pnpm test` failed on stale Mac dependency links, missing `@solana/kit`. `pnpm install --frozen-lockfile` repaired ignored dependencies without manifest/lockfile edits. Full rerun passed **727 tests, 1 skipped** (106 core, 80 web, 541 API); typecheck/lint exit 0 (**266 lint files**). Final pre-push rerun also passed 727 tests/1 skipped, typecheck/lint exit 0 (266 files). Strict handoff validation, 74 local Markdown links/resume-path checks, credential-shape scan and `git diff --check` passed; the validator only warns about its GitHub URL path heuristic. No sensitive implementation change; no independent other-family runtime review claimed or needed for these docs-only commits. Future wallet implementation requires that review before push.

## Commits and shipping

- `c6cac7ab0fd2cc97fe40264fafcf20655004585c` — wallet trace and fresh read-only receipts.
- `87db766b70a7486dc6e0279297900cfee189d68c` — onboarding design, raid memo and bounded implementation/name plans.
- Reconciliation/checkpoint commit follows; exact ID: `git log -1 -- docs/HANDOFF.md`. All are local until the gate/push succeeds. Final exact-SHA CI is verified after push and reported at closure; do not infer success from an older run.

## Next Actions

1. **Phone proof:** arrange the existing external tester’s owner-attended Android/wallet sitting. Recommend the fifteen-minute test before recruitment; it can establish a working manual fallback without changing production code. Record iOS UNKNOWN if unavailable.
2. **Raid policy:** choose the sole owner of pilot paid briefs and confirm Raidar’s rewards/points. Recommend disjoint Hyphae paid pilot briefs in the existing registered chat, leaving Raidar campaigns separate, because it avoids an unproven integration/double ledger. No rule change inferred.
3. **Owner values:** supply the genuine registered-group invite, support contact URL, publishing-account URL, and confirm registered chat/group mapping. Recommend reuse/verify the current pilot, then one pin linking both ways; no fabricated values or agent publication.
4. **Operational read access:** configure an existing authorized read-only DB connection locally without sending credentials in chat. Recommend rerunning schema, scoring/jobs/submission and binding checks before activation; current public counts are not a backlog audit. No secret change was performed/requested by this arc.
5. Review the written design/plan; only a later explicit implementation prompt authorizes its future files. A live DB display-name correction and Telegram branding remain separately attended external operations; recommendation correct the existing row instead of replacing it. Independent wallet security review precedes any wallet UI release.
6. Preserve [the October 8–9 packet](demo/2026-10-08-first-payout-readiness.md): approved admin **0.02 SOL**, gross **500,000,000 lamports**, exact fresh vault top-up and immutable recipient. **Oct 8 23:00Z pause; final C18b after 23:45Z; every author/duplicate correction accepted strictly before Oct 9 00:00Z** and attested. Unresolved/late-discovered work parks C19. Post-00:00Z close/snapshot, hold/safety/ready gates, Ledger publication, genuine signed-wallet claim and P14 evidence precede payment claims. Hold observations through Oct 10 00:00Z inclusive; honest empty/no-payable/unavailable outcomes remain mandatory. No repeat funding/attestation ruling needed.
7. `/organic-sync post-ship` reads this engineering checkpoint in the vault. No private board update claimed. Pro/alerts, Treasury Receive-screen, Ledger availability and reviewer/demo/submission owner evidence remain prior packet obligations, not newly completed.

## Quick Reference

[Wallet verdict](superpowers/specs/2026-10-03-link-platform-verdict.md), [design](superpowers/specs/2026-10-03-participant-onboarding-design.md), [implementation plan](superpowers/plans/2026-10-03-participant-onboarding-plan.md), [raid memo](superpowers/specs/2026-10-03-raid-system-decision-memo.md), [name operator plan](superpowers/plans/2026-10-03-mycel-display-name-operator-plan.md), [guide](community/OPERATING-GUIDE.md), [money packet](demo/2026-10-08-first-payout-readiness.md), [dated snapshot](handoffs/2026-10-03-onboarding-preparation.md), [Runbook C](handoffs/2026-09-28-runbook-c.md).

## Resume Checklist

Fetch without pruning and pull fast-forward only after checking clean status; preserve unmerged work. Verify latest exact-SHA CI and read the platform verdict before activation. Use current public timestamps; restore an owner-configured read-only connection before claiming fresh DB/jobs/Fly evidence. No bearer URL or private identity in receipts. Owner-attended device, branding, DB and money actions require their stated scopes; no helper or SDK/branch change.

## Suggested skills

`handoff-memory` on resume; `security-review` for wallet implementation/review; `handoff` for closure. `solana-dev` for the later dated attended money sitting. No helpers. Use `/organic-sync post-ship` in the owning vault session, not as a write from this repo.

## Generated artifacts this session

| What | Canonical home | State |
|---|---|---|
| Wallet verdict, onboarding design, raid memo | `docs/superpowers/specs/2026-10-03-*.md` | Documentation only |
| Implementation and guarded display-name operator plans | `docs/superpowers/plans/2026-10-03-*.md` | Not executed |
| Current checkpoint and dated read/closure receipt | `docs/HANDOFF.md`, `docs/handoffs/2026-10-03-onboarding-preparation.md`, `docs/BUILDLOG.md` | Git tracked, machine portable |

No new keys, credentials, deployment, schedule, screenshot, community, transaction or public/group message. Historical screenshots reused by link only.

## Resume Prompt

```text
Resume Hyphae from docs/HANDOFF.md and the October 3 onboarding snapshot. Phone signing is device-unproven: no-provider Telegram surfaces fail by code, manual original-bot-link wallet-browser handoff is the proposed path, and copying the stripped address bar loses the token. Designs/plans are written, not implemented; live name remains Hyphae Lab, approved hierarchy MYCEL / Powered by Hyphae / Pilot. Fresh October 3 public uptake is zero, epoch 2 open/rubric 1.2.0, no settlement and absent derived mainnet accounts; direct DB/job/Fly checks remain prior.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-03-onboarding-preparation.md, docs/superpowers/specs/2026-10-03-link-platform-verdict.md, docs/superpowers/specs/2026-10-03-participant-onboarding-design.md, docs/superpowers/specs/2026-10-03-raid-system-decision-memo.md, docs/superpowers/plans/2026-10-03-participant-onboarding-plan.md, docs/superpowers/plans/2026-10-03-mycel-display-name-operator-plan.md, docs/demo/2026-10-08-first-payout-readiness.md, docs/WALLETS.md.
Model: gpt-6.1-sol (high) — verified current runtime, suitable for bounded code-path reasoning; apply the project routing convention for the actual next implementation/review task.
Skills: handoff-memory, security-review, handoff.
Run the fifteen-minute phone test only under new owner-attended authorization. Resolve registered-group mapping, real invite/support/publishing links and raid policy before recruitment. Recommend disjoint Hyphae pilot briefs with Raidar campaigns separate. Do not implement the plan or mutate production without the next explicit scope. Preserve SDK exactly 0.1.0 through Oct 12 and parked rules/Jev. C1–C13 complete; no early C14, unchanged Oct 8 23:00Z pause / after-23:45Z C18b / before-close corrections / post-Oct 9 00:00Z close, hold, Ledger publish, genuine claim/P14 gates. No payment claim without those receipts.
```
