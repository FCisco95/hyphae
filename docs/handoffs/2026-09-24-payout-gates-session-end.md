---
date: 2026-09-24
summary: Production still runs main b7bfe55 (MYCEL epoch 1 2026-09-25T00:00Z to 2026-10-02T00:00Z). This session scoped, planned and built the last two gates before a real payout, test-first. /rules is the six-question member quiz with a recorded 6/6 pass. evaluatePayoutGate is a fail-closed check of whether a closed epoch may be paid and who is payable. The hold gate runs checkHold per candidate after a paid epoch closes, on mainnet-verified providers, counting only a read within 24 hours of the close. Built and tested locally, not deployed. Migration 0009 is written, not applied to Neon. Codex reviewed three times: five fresh rounds, eleven findings fixed test-first, the last round's single low fixed and not re-reviewed, and one policy point (the P9 snapshot reading) parked for Cisco. Epoch 2 (the first paid epoch) is still reachable if Cisco answers the questions, applies 0009, sets two provider keys and deploys before 2026-10-02T00:00Z.
---

# Hyphae handoff

## TL;DR

**Both payout gates exist, locally.** `main` now has `/rules` (the quiz), the payout gate and the hold gate, gate-green, Codex-reviewed in five rounds (eleven fixes; one policy question parked). Nothing new is deployed and Neon is unchanged. **Next, all Cisco:** answer six questions (below; the quiz text first), then apply 0009, set `HOLD_RPC_HELIUS_URL` and `HOLD_RPC_FALLBACK_URL`, and deploy, before 2026-10-02T00:00Z. After the Oct 1 go/no-go, set `first_paid_epoch = 2`. The earlier steps still stand: token re-rotation, and the Vercel project for the audit site.

## Metadata

- Last Updated: 2026-09-24, night (second session of the day). Session record: `docs/handoffs/2026-09-24-payout-gates-built.md`. Specs: `2026-09-26-rules-test-scope-proposal.md`, `2026-09-26-hold-gate-plan.md`. Previous state: `2026-09-24-audit-built-session-end.md`.
- Branches: only `main`.
- Runner: Claude Code, **Opus 5.5 (`claude-opus-5-5`), effort xhigh**, Windows. The session prompt preferred Fable 5.1; this session ran on Opus 5.5.
- Authority: payment rulings P1–P16 (`2026-09-24-contract-and-payment-rulings.md`); the arc is next action 5 of the previous handoff, pre-approved by the session prompt, stopping before deploy, Fly, Vercel, Neon and secrets.
- Canonical private plan: read, not edited.

## Current Objective

Make epoch 2 (2026-10-02T00:00Z → 2026-10-09T00:00Z) the first paid epoch. That needs the rules test and the hold gate **deployed before 2026-10-02T00:00Z** (P12), then R6 and the Anchor claim for the payout on Oct 9–10. Cisco's go/no-go is Thu Oct 1.

## Current State

- Fly `hyphae-api`: api + worker on `b7bfe55`. Rollback image `deployment-01M2R8W6Z6NAAWYM6KT2ZDYA2H` (logs the bot token on handler errors, so a rollback means a rotation too).
- Neon: migrations 0000–0008. **0009 exists on `main` and is not applied.**
- `main` is ahead of production by the read API v1 and `apps/web` (previous session), and by this session's gates.
- **Deploy order changed:** any `main` from `5fb2aa5` onward needs 0009 on Neon first. The new schema's column is selected by existing queries (`communities.first_paid_epoch`), so the new build fails against a database without it. 0009 is additive, so the running `b7bfe55` is unaffected by applying it early.
- Anchor program: still the `initialize` stub. R6 not started.

## Recent Changes (this session)

| Commit | What |
|---|---|
| `e26794d`, `47dbc1b` | Scope proposal (rules test vs payout gate, RT1–RT6, PG1–PG10) and hold-gate plan |
| `5fb2aa5` | Migration 0009: `first_paid_epoch`, `rules_test_passes`, `hold_checks` |
| `ac50267`, `811e9b6` | The MYCEL rules test and `/rules` in a private chat |
| `4b8f889` | The payout gate |
| `b10ed7a`, `6a5c3a4` | Hold checks through the SDK; worker queue, close hook, sweep |
| `ec8e491` | Lock-audit test timeout (it migrates a fresh PGlite in the test) |
| `aab7130` | Gates on Postgres 17 through postgres-js; fixed a raw `Date` in `dueHoldChecks` that postgres-js rejects |
| `c91f253`, `42ec32d`, `8970974`, `c228839` | Codex review fixes F4, F3, F2, F1 |
| `a072ccb`, `11f42d8`, `1cd49c6` | Docs in line with the fixes; Biome hook-name fix; follow-up fixes M1, M2, L1 |
| `208fb96`, `f47d731`, `631c229` | Row claim per read (`FOR UPDATE SKIP LOCKED`), no reads before the close, window checks after the claim and after the genesis step |
| `e2e8656` | Two looping gate tests split into `it.each` (a 5.3 s timeout under load) |
| The commit after `e2e8656` | Records: build log, handoff, session record, session-end snapshot, whitepaper status |

## Validation

On `e2e8656`: `pnpm -r test` exit 0 three runs in a row (core 67, web 14, api 372); `pnpm -r typecheck` exit 0; Biome on tracked files exit 0 (179 files); `drizzle-kit check` exit 0; `test:pg` 15/15 (Postgres 17 in Docker); `git diff --check` exit 0. 18 mutation probes: 17 caught on the first run, and a test was added for the one that survived. The real SDK was exercised behind a fake JSON-RPC server for guide §7's hold-gate cases. Evidence stage: **built and tested locally, not deployed.**

Review, all fresh Codex sessions, read-only, diff passed as a prompt file:
| Round | Verdict | Outcome |
|---|---|---|
| 1 (`1b46b33..aab7130`) | needs-attention | F1 late hold reads → 24 h window (`c228839`); F2 network not attested → genesis check (`8970974`); F3 wrong quiz test → current test only (`42ec32d`); F4 ms rounding → microseconds (`c91f253`) |
| 2 | needs-attention | H1 (post-close buy inside the window) **parked as policy, Q6**; M1 genesis reply validation, M2 per-read clock, L1 inclusive boundary (`1cd49c6`) |
| 3 | needs-attention | H1 agreed as correctly parked policy; concurrent duplicate reads → row claim `FOR UPDATE SKIP LOCKED`; pre-close answers → `too_early` / `before_close` (`208fb96`) |
| 4 | needs-attention | window recheck after the pooled connection (`f47d731`) |
| 5 | needs-attention | deadline passed into the checker after its genesis step (`631c229`); residual: the SDK's own reads can't be interrupted, and late answers stay uncertain. Not re-reviewed. |

## Known Issues / Watch List

- **Open policy point (Q6 below):** P9 says "when the snapshot is taken", and no RPC reads a past balance. The gate counts the first confirmed read after the close (at most 24 h). A member who buys right after the close and is read inside the window counts.
- **Unverified outside this machine:** the gates have run on PGlite and local Postgres 17, never on Neon's pooler, and never against real Helius or fallback endpoints. The first real hold check happens after epoch 2 closes. A dry run against mainnet endpoints, with a known wallet before Oct 9, is recommended (read-only; needs the two keys).
- `/rules` goes live with the deploy. Its questions are the RT2 proposal, so answer Q1 first.
- The Telegram webhook must keep delivering `callback_query` updates. It does by default; `setWebhook` was never given `allowed_updates`.
- Carried over: bot token re-rotation (Runbook B step 9); `PUBLIC_WEB_URL` after the Vercel site; the public api is not rate-limited; the correction script's `--actor` flag; no CI.

## Next Actions

1. **Cisco:** answer the six questions below (10 minutes). Q1, the quiz text, has to come before the deploy.
2. **Cisco:** Runbook B step 9, token re-rotation (still open), one step per message.
3. **Cisco:** apply 0009 on Neon, then `fly secrets set HOLD_RPC_HELIUS_URL=… HOLD_RPC_FALLBACK_URL=…`. The fallback must be a non-Helius mainnet provider, for example Alchemy or QuickNode. Then deploy `main` (repo root, `--depot=false`). The agent verifies read-only: `/health`, `/v1/communities/<MYCEL mint>`, and `/rules` in Hyphae Lab.
4. **Cisco:** the Vercel project for `apps/web`, then `PUBLIC_WEB_URL` on Fly.
5. **Cisco, Oct 1 go/no-go, before epoch 2 closes:** `update communities set first_paid_epoch = 2 where mint = '<MYCEL mint>' and first_paid_epoch is null;`
6. **Agent:** R6 (manifests, exact allocation from `evaluatePayoutGate`, P14's allocation section with reason `awaiting_hold_checks`) and the Anchor vault, publish and claim, per `2026-09-25-plan.md` (Oct 1–8).

## Open questions (each with a recommendation)

1. **RT2, quiz text:** approve the six questions, with Q2 naming the coin, Q3 saying "count" and Q5 without "a strike"? **Recommended: yes.** Every answer is then true under rubric 1.2.0 and today's code.
2. **RT3:** the rules test gates payment only, not `/submit`. **Recommended: yes.** That is what P10 and `docs/TESTING.md` already say.
3. **PG5 + PG10:** an undecided hold holds the whole epoch, and only a read within 24 h of the close counts. A member still undecided after that keeps the epoch blocked until you rule. **Recommended: yes.** Nothing in P1–P16 says how to pay the others around a held member.
4. **PG6:** nobody payable means publish nothing and take no fee. **Recommended: yes.**
5. **PG8:** the first paid epoch lives in `communities.first_paid_epoch`, set by you after the go/no-go. **Recommended: yes.** Nothing is payable until you set it.
6. **P9 reading (Codex H1):** "held at the close" means the first confirmed two-provider read after the close, within 24 h. **Recommended: accept.** A perfect snapshot is gamed the same way (buy before, sell after); bracketing or time-weighted holding can come after the hackathon. The only strict alternative is paying nobody.

Parked, not asked: the fee address (P8) is still yours to name before the mainnet publish.

## Epoch 2 deadline

**Still reachable, not yet secured.** Nothing agent-side blocks 2026-10-02T00:00Z. What remains is Cisco's: Q1, 0009 on Neon, two provider keys (a fallback account may need creating) and one deploy. That is about an hour attended, due by Thu Oct 1. If the deploy misses Oct 2, P12 means no epoch can be paid before Oct 12 unless Cisco changes the policy on Oct 1.

## Quick Reference

- Gates: `apps/api/src/payout/{rules-test,gate,hold-gate}.ts`; bot `apps/api/src/bot/commands/rules.ts`; worker `apps/api/src/jobs/reward-jobs.ts` (`checkEpochHolds`, close hook, sweep).
- `evaluatePayoutGate(db, { communityId, epochId })` → `ready | blocked` with per-member `payable | not_payable | held` and reasons. R6 must refuse to publish anything but `ready`.
- Env: `HOLD_RPC_HELIUS_URL`, `HOLD_RPC_FALLBACK_URL` (optional; without them every candidate stays held).
- Local gate: `pnpm -r test; pnpm -r typecheck; git ls-files -z '*.ts' '*.tsx' '*.json' '*.js' '*.css' | xargs -0 pnpm exec biome check; pnpm --filter @hyphae/db exec drizzle-kit check; pnpm --filter @hyphae/api test:pg` (Docker); `git diff --check`.

## Suggested skills

- `handoff-memory` (resume).
- `superpowers:test-driven-development` (R6).
- `superpowers:writing-plans` (R6 and the Anchor window).
- `solana-dev` (Anchor vault, publish and claim; LiteSVM).
- `handoff` (session end).

## Resume Checklist

- `git fetch --prune && git status -sb` (expect `main` = `origin/main`).
- Docker Desktop running before `test:pg`.
- No deploy, Neon change, Fly secret, token change, Vercel project, package publish, public post or mainnet transaction without Cisco's separate yes. Cisco runs Fly and Neon-write commands in his own terminal, one manual step per message.

## Next-session prompt

```text
Resume Hyphae. Read CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-09-24-payout-gates-built.md, 2026-09-26-rules-test-scope-proposal.md and 2026-09-26-hold-gate-plan.md. Production runs b7bfe55; main adds read API v1, apps/web, /rules, the payout gate and the hold gate, gate-green and Codex-reviewed, not deployed; migration 0009 is not applied. First record Cisco's answers to the six open questions in docs/handoffs/. Then, with Cisco, ONE manual step per message: token re-rotation; apply 0009 on Neon; fly secrets HOLD_RPC_HELIUS_URL and HOLD_RPC_FALLBACK_URL; fly deploy of main from the repo root with --depot=false; verify /health, /v1/communities/<MYCEL mint> and /rules read-only; the Vercel project; after the Oct 1 go/no-go, first_paid_epoch = 2. Everything must be live before 2026-10-02T00:00Z. Then R6 and the Anchor window per 2026-09-25-plan.md.
Hard stops (each needs Cisco's explicit yes): deploys, Fly secrets, token changes, Vercel project creation, Neon writes, mainnet transactions, package publishes, public posts, writes outside this repo.
```
