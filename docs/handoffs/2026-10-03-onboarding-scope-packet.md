---
date: 2026-10-03
summary: Owner research/document gate completed; concrete T/A/B candidate and separate operator effects prepared. No implementation, phone test or live mutation authorized/executed.
---

# Hyphae owner-document alignment and scope packet

## TL;DR

The [durable research/document gate](../superpowers/specs/2026-10-03-project-alignment-and-document-hygiene.md) is **COMPLETE for this Hyphae scope**. Applied the matching prepared three-document patch, rechecked current refs/code and dated primary sources, and finalized the existing [participant plan's candidate/release packet](../superpowers/plans/2026-10-03-participant-onboarding-plan.md#candidate-and-release-packet--october-3). **Recommend explicit approval for local T → A → B implementation**, with deployment and all live actions separate. Nothing is built from this plan yet.

Private source plans/report were read in place, read-only; no private strategy, contact/credential value or sibling/vault write. Historical dated receipts remain unchanged. No helper/reviewer, provider scoring call, group message, phone test, DB mutation, money action or branch cleanup.

## Git, overlap and provenance

- Start/main/origin `312cc0ffae1c4efbf5fd69c2b58a5aaf98af28ac`. `git fetch --no-prune origin` passed; main/origin 0/0; `git merge --ff-only origin/main` already current. One registered main worktree, no overlapping dirty files or fetched changes. Since previous code-path baseline `3a361e76801a78f0392ec0ca42dfb8ff1f1445d6`, 12 changed files are documentation only.
- Independently read [CI 37154342915](https://github.com/FCisco95/hyphae/actions/runs/37154342915): completed/success, exact requested SHA. This is start-CI evidence, not CI for the later local document commit.
- Rules remote ref `158452fe2b22a1e42e5efd42f3f7e11bfdf59c70`, Jev `707d7daf21e217d9a8a64e58514065f5e3bca45e`: preserved, pushed/unmerged until epoch 3. Local `hackathon/r1-exact-reward-points` `2fd2470` preserved (ancestor of main; no deletion). SDK manifest and lockfile exactly `@organichub/verify` **0.1.0**, unchanged through Oct 12.
- Vault inputs: current `10 - PROJECTS/Organic/plans/2026-09-16-hyphae-implementation-plan.md`, `2026-10-03-organic-30-day-launch-master-plan.md`, and `reports/organic-sync/2026-10-03-2125Z-post-ship.md`. Current amendments own execution; old code/calendar sketches are historical. Owning money packet/direct prompt wins on the exact no-payable path; no root/publication created to satisfy a historical empty-result instruction.
- Prepared `reports/organic-sync/2026-10-03-2125Z-hyphae-doc-alignment.patch`: standard `git apply --check` exit 0, then `git apply` exit 0. Corrected WHITEPAPER deployment row; retired false Sentinel WR-01 build dependency; added explicit proposed T. Original September/October evidence and dates retained.

## Current State — confirmed / prior receipt / unknown / proposed

| Claim | Class | Evidence / consequence |
|---|---|---|
| Ownership/admin/two-member Lab; Testers separate | CONFIRMED founder fact | Existing accepted owner evidence; no repeated ownership question. September 24 basic-group restriction is confirmed history, not current type. |
| One chat per mint; current generic start lacks T; no `/help` registered | CONFIRMED code | `packages/db/src/schema.ts`, `apps/api/src/bot/index.ts`; T is a proposal. No self-service or same-mint multi-chat claim. |
| Private link/rules starts run first; `/me` group-scoped | CONFIRMED code | `bot/index.ts`, `commands/link.ts`, `rules.ts`, `me.ts`, `me-summary.ts`. T reuses commands; cannot invent a private progress deep link. Existing `/me` reply goes to the group. |
| URL work uses newest still-open task | CONFIRMED code | `commands/submit.ts`, matching community/status/close-time predicate; keep one active pilot brief. |
| Signing features, token stripping and reconciliation | CONFIRMED code | `link/page/client.ts`, `wallet.ts`, `flow.ts`, session/routes/store traces and existing tests. Free unchanged message, original fragment in memory; uncertain verification asks status without proof resend. No adapter or confirmation protocol. |
| Rules/hold deployed; Neon 13 hashes 0000–0012 and Fly v11 | PRIOR RECEIPT | [October 2 readiness](2026-10-02-payout-readiness.md). Corrected WHITEPAPER is dated evidence, not a new internal-health claim. |
| Live name/intake/current epoch | CONFIRMED fresh public read | Oct 3 **21:41:03Z**, community HTTP 200, `as_of` 21:41:03.318Z: Hyphae Lab, open, epoch 2. Health 200/ok. Point availability only. |
| Public epoch-2 counts and settlement | CONFIRMED fresh public read | HTTP 200, `as_of` **21:41:03.564Z**: open Oct 2 → Oct 9 00:00Z, contributions/members/counted/pending/pending-at-close/reconciliation/excluded all 0; allocation/payment unavailable `no_settlement`. No new DB job or mainnet account read. |
| Mainnet derived community/vault/epoch absent, rubric 1.2.0 | PRIOR RECEIPT | October 3 18:41Z/slot 453017150 and October 2 readiness. No executable rehash, new initialization, balance or hold read here. |
| Single registered row/UUID and exact bot/chat binding | UNKNOWN now | No configured DB/bot access; public mint/name does not prove Telegram identity. |
| Current `getChat.type`, webhook, migration handler deployment health | UNKNOWN now | DB/bot/Fly access absent. Source handler exists and prior cutover is accepted; no current operational read inferred. |
| Real Android signing / Telegram opening / system and wallet browsers | UNKNOWN / UNEXECUTED | No separately recorded attended test authorization. No-provider FAIL is a conditional code result; real Android signing unexecuted, iOS unknown. `/link` proof never substitutes for C21. |
| Local T/A/B; MYCEL naming; disjoint briefs; hidden pilot | PROPOSED | Exact files/tests/destinations/rollback are in the amended plan; no implementation/live authorization. Production name remains Hyphae Lab. |
| Registered-Lab invite/support/publishing values; raid/visibility choice | UNKNOWN owner inputs | No fabricated URLs, guessed group identity, imported Raidar points or retroactive reward rule. |

## Dated primary-source recheck

Read October 3 in this session, rechecking the report's source table. Platform capability is not device or deployment proof.

| Primary source | Bounded finding |
|---|---|
| [Telegram Bot API](https://core.telegram.org/bots/api#message), [getChat](https://core.telegram.org/bots/api#getchat), [command registration](https://core.telegram.org/bots/api#setmycommands) | Current type can be read; migrations report changed identifiers; menus are separately scoped API effects. No live call occurred here. |
| [Telegram Bot Features](https://core.telegram.org/bots/features#commands) | Commands, deep links and keyboards support the proposed controls. No deployed welcome/menu inferred. |
| [TDLib options](https://core.telegram.org/tdlib/options), [messages.migrateChat](https://core.telegram.org/method/messages.migrateChat) | Community chat capacity concerns supergroups/channels; basic-to-supergroup conversion exists. Picker diagnosis remains an inference until exact type is read. No invented UI toggle. |
| [grammY commands](https://grammy.dev/guide/commands), [keyboards](https://grammy.dev/plugins/keyboard) | Command and reply-keyboard pattern can reuse existing handlers. Candidate tests must exercise actual wiring and payloads. |
| [Phantom browse](https://docs.phantom.com/phantom-deeplinks/other-methods/browse) | Documents in-app browsing, without establishing this fragment's retention or Hyphae signing on a named phone. No vendor control approved. |
| [Solflare browse](https://docs.solflare.com/solflare/technical/deeplinks/other-methods/browse) | This read now supplies usable URL-encoded browse parameters; the prior report's limited fetch remains historical. Still no fragment/device/signing proof and no vendor button. |

## Read-only technical dependencies and attended test packet

Availability check read only names/presence: `DATABASE_URL`, `DATABASE_READ_ONLY_URL`, `TELEGRAM_BOT_TOKEN`, Fly credential variables absent; root/API env files absent; Fly/psql tools absent. No credential retrieval/provisioning attempted. Existing owner-configured access, when available, is sufficient; no new chat, registration or ownership decision requested.

Preflight under repeatable-read READ ONLY and a short statement timeout: select exactly one row by the fixed mint; privately retain UUID/chat/admin/binding/rubric/config fields and member/epoch/contribution counts/hashes. Compare migration journal hashes/timestamps against all 13 local SQL files and `_journal.json`. With that exact bot use `getMe`, `getChat` for the row's ID, bot `getChatMember`, and `getWebhookInfo`; compare expected bot/admin/type and webhook delivery errors. Inspect current API/worker image against accepted handler source. Do not send commands, call `getUpdates`/consume events, reset webhook, seed, migrate, deploy or repair during read-only preflight.

Missing access leaves those rows UNKNOWN. Mismatch or failed health parks dependent operations. If `supergroup`, no upgrade; investigate placement eligibility. If `group`, relevant attended in-place plan remains prepared. [Name](../superpowers/plans/2026-10-03-mycel-display-name-operator-plan.md) and [placement](../superpowers/plans/2026-10-03-lab-community-placement-operator-plan.md) plans require the same UUID/mint/members/epochs/config/binding read-back, not replacement Lab/Testers registration.

The existing [fifteen-minute phone procedure](../superpowers/specs/2026-10-03-link-platform-verdict.md#fifteen-minute-operator-test--not-executed) remains prepared. Record separately:

| Surface | Current result | Required receipt |
|---|---|---|
| Telegram Android ordinary URL | UNEXECUTED | Actual opening surface, OS/Telegram version, discovery/error. Conditional no-provider FAIL is not a device test. |
| System browser | UNEXECUTED | Original own bot URL with fragment, browser/version, discovery/error. Installed wallet alone is insufficient. |
| Compatible wallet browser | UNEXECUTED | Wallet/app/version, unchanged free message signed, server commit and same shortened wallet in own group `/me`. |
| iOS / Desktop | UNKNOWN | Separate named test if available; no inferred PASS or FAIL. |

Use the external tester's own Lab account and ORIGINAL bot URL, never the stripped address bar/forwarded link. No token/signature screenshot or stored private message. Uncertainty checks `/me` before starting fresh. Phone PASS gates recruitment/activation; independent generic T/A design remains possible. On real failure request the existing conditional isolated probe only if necessary; Sentinel remains parked and this Hyphae-only arc executes no sibling diagnostic.

## Scope and owner inputs

The amended plan is the single candidate/release packet, not a competing task registry. Exact T/A/B files, test commands, mobile/keyboard checks, sample destinations, context safety, free-message versus payment copy, menu/pin scope/read-back/rollback and owner checklist are there. Existing link/rules/member/reward handlers, SDK/DB/protocol/program files stay excluded. T initially has no API per-mint owner configuration; A's optional map belongs to web. Missing links cannot block generic fixture implementation after explicit approval.

Recommend local T/A/B together, disjoint Hyphae paid briefs with Raidar separate, one active brief, and hidden pilot until phone PASS. Pending: candidate approval; existing technical access; separate attended-test scope; genuine Lab invite/support/publishing URLs; raid/visibility decision; later concrete deployment/name/upgrade/placement/menu/pin approvals. No question about settled ownership, approved funding, or a replacement chat.

## Unchanged money gates

C1–C13/readiness complete; **C14–C22 unexecuted**. October 8 admin **0.02 SOL**, gross **500,000,000 lamports**, fresh exact vault top-up/permanent recipient and author-attestation corrections remain approved. Pause **23:00Z**; final C18b **AFTER 23:45Z**; corrections/attestation accepted **STRICTLY BEFORE October 9 00:00Z**. Only post-00:00Z close/snapshot/hold/safety, Ledger publication, actual signed-wallet claimant and P14 establish payment. Hold window through **October 10 00:00Z inclusive**. Empty/no-payable remains no payment. No earlier/repeated money operation from this arc; [canonical packet](../demo/2026-10-08-first-payout-readiness.md).

## Validation and shipping

Fresh full gate: `pnpm test` **exit 0, 727 passed, 1 skipped** (106 core, 80 web, 541 API); `pnpm typecheck` **exit 0**; `pnpm lint` **exit 0, 266 files**, no fixes. Strict handoff validation passed (only the existing validator GitHub-URL portability heuristic warning); **85 local links/resume paths** verified across **9 documentation files**, runtime/SDK/schema compared unchanged, parked refs/local branch retained, and `git diff --check` passed. No fixture/candidate screenshots generated. No new runtime code, wallet/auth implementation or fresh other-family implementation review; unchanged accepted ranges need no repeat. Docs are local until separately authorized publication: this prompt explicitly says to publish nothing without its authorization, so no remote push or deployment is inferred from preparation. Packet/alignment milestone **`e7667747fcdf6d04b860f554df43a4cd18a8ec22` committed locally**, after the recorded gate. Remote main was independently re-read at **21:47Z**, still the start SHA; rules/Jev exact remote SHAs unchanged. Clean main was one ahead before this receipt closure. This documentation receipt adds that actual local SHA; its own closure SHA resolves from `git log -1 -- docs/handoffs/2026-10-03-onboarding-scope-packet.md` and final delivery. No new CI claim. Existing start CI remains the only remote CI claim.

Actual runner: Codex, GPT-6 family as identified by this session's developer contract; exact runtime identifier/configured effort and usage/cost are not exposed. Do not copy the prior session's `gpt-6.1-sol` xhigh counters as this run's usage. Skills: handoff-memory, writing-plans adapted to the existing Hyphae contract, security-review (wallet/privacy planning), handoff. No helpers.

## Suggested skills

`handoff-memory`, `security-review`, `test-driven-development` after implementation approval, relevant React/Next.js guidance for A, `handoff`. Fresh other-family exact-range reviewer for B before push/release. No automatic helper work or Sentinel lane.

## Generated artifacts this session

| What | Canonical home | Stage |
|---|---|---|
| Applied three-doc correction and finalized packet | `docs/WHITEPAPER.md`, participant design/plan under `docs/superpowers/` | Documentation only |
| Scope evidence and portable engineering state | This receipt, `docs/HANDOFF.md`, `docs/BUILDLOG.md` | Local; no code/phone/live proof |

No key, credential, deployment, transaction, schedule, community or message generated.

## Next-session prompt

```text
Work only in FCisco95/hyphae. The October 3 research/document gate is complete for this scope; recheck any changed refs/code/source guidance before implementation. The amended participant plan contains the proposed local T/A/B contract and separate live effects, none executed. Read the latest local commit; do not reset it to the old remote just to synchronize.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-03-onboarding-scope-packet.md, docs/superpowers/specs/2026-10-03-project-alignment-and-document-hygiene.md, docs/superpowers/plans/2026-10-03-participant-onboarding-plan.md, docs/superpowers/plans/2026-10-03-lab-community-placement-operator-plan.md, docs/superpowers/plans/2026-10-03-mycel-display-name-operator-plan.md, docs/demo/2026-10-08-first-payout-readiness.md.
Model: GPT-6.1 Sol (high) — current recorded sync recommendation for this bounded candidate; actual prior runner's exact identifier/effort was unavailable, not inferred from this recommendation.
Skills: handoff-memory, security-review, test-driven-development (only after build approval), handoff.
Record explicit candidate approval before code, then local T/A before B within the exact file list. Keep missing URLs absent and technical/phone checks UNKNOWN until read or attended. Preserve original private link/rules dispatch, SDK 0.1.0 through Oct 12, parked rules/Jev and local reward-points branch. Ask once for unresolved inputs with recommendations; no publication/live effect without separate authorization. Preserve every Oct 8–10 money gate, and do not continue beyond owner activation preparation.
```
