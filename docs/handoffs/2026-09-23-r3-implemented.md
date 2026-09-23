---
date: 2026-09-23
summary: R3 (slots, candidates, retrieval rounds, fenced dispatch, explicit nomination, admission-backed /submit) implemented test-first on feat/r3-slots-dispatch under the 2026-09-23 approval. Native gate green (core 54, api 144) plus a new real-Postgres test:pg gate (4 tests, three 50-round races). Migrations 0003/0004 not applied; not deployed. Awaiting independent review.
---

# 2026-09-23 — R3 implemented

## Authority and runner

- Scope: `docs/handoffs/2026-09-23-r3-r5-scope-proposal.md`, approved in `docs/handoffs/2026-09-23-r3-r5-approval.md` ("yes to all nine + A + B + apply 0003/0004 after R3 merge").
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows, 2026-09-23. Effort not observable in-session.
- Branch `feat/r3-slots-dispatch`, based on `docs/2026-09-23-scope-checkpoint` (PR #5) so the docs do not conflict; its code commits start from `main` `dc261c7` content.
- No Neon command, deployment, model call, fixture or paid run, settlement, root, claim, Sentinel code or vault edit.

## Commits

| Commit | What |
|---|---|
| `f4fd68e` | core: `reward-eval/1` prompt templates (quality, combined, effort-only), template hash per version, one-pass placeholder filling, effort output with the three O1 criteria; eligibility decided in code |
| `be42e4a` | payload v2 pins `promptVersion` + `promptTemplateHash` and the effort criteria; caps candidates and retrieval rounds at 3; review observations 3 (closed legacy epoch → `legacy_epoch`), 4 (re-proposing the pending payload is a no-op), 5 (`stageRubric`: reward write first, staging update in the same transaction) |
| `b374834` | migration 0004 (`reward_slots`, `reward_nominations`, `reward_retrievals`, `reward_dispatches`, `reward_decisions`), `nominate`, `withdrawNomination` |
| `13715dc` | `beginDispatch`, `completeDispatch`, `markReconciliation`, `recordNotSentProven`, `runEvaluation`; `callRewardModel` with `maxRetries: 0` and a 90 s timeout |
| `c66485f` | `recordRetrieval`, `captureLimitations`, `routeSubmission`, `submitEffort`, `admittedIntake`, `rewardMessage` |
| `692b288` | `/submit` rewired, `/effort`, three pg-boss queues and handlers, `scripts/reward-reconcile.ts` |
| `7992bb2` | review observation 1: community lock `FOR NO KEY UPDATE`; `test:pg` gate |

## Evidence (fresh, this session)

Native gate on the R3 tip before the rebase (`adef9f6`; the rebase changed only the docs base):

- `pnpm -r test` exit 0: core 6 files / 54 tests (41 + 13 new); api 15 files / 144 tests (83 + 61 new).
- `pnpm -r typecheck` exit 0. `pnpm exec biome check .` exit 0, 95 files, no warnings. `pnpm --filter @hyphae/db exec drizzle-kit check` exit 0. `git diff --check` clean. `pnpm --filter @hyphae/api build` succeeded.
- `pnpm --filter @hyphae/api test:pg` (Docker `postgres:17`, two `postgres-js` pools): 4 passed. Lock mode: an FK insert completes while a reward lock is held, and a second reward writer times out with `55P03`. Races, 50 rounds each: two handles nominating at once → one reservation, one `slot_in_use`, one slot row; two workers beginning one nomination → one `begun`, one `exists`, one dispatch row; a redelivered submission on two connections → created once.
- Watched failing first: every new test file failed on a missing module or function before its code existed; observations 3/4 failed as "throws" and "resolved instead of rejecting"; the lock-mode test failed with `lock timeout ... FOR KEY SHARE` under `FOR UPDATE`, and fails again if `FOR UPDATE` is restored.
- Mutation probes on `evaluation.ts` / `run.ts`, each reverted: dispatch fence check removed, `affectsAllocation` forced true, horizon wait removed, 3× on an ineligible effort, prompt-pin check removed, reconciliation falling through, `maxRetries: 2` → each made 1 test fail. One probe survived: removing the slot-generation comparison in `completeDispatch` broke nothing, because the dispatch's own state already covers every stale path; that redundant check was removed (see deviations).

No test calls a real model; the provider is injected and counted. No test touches Neon.

## Behavior now on the branch (not deployed)

- `/submit`: same preflight as before. A community without reward epochs keeps the legacy insert and `score` job unchanged. A bootstrapped community admits through `admitContribution` and queues `reward-evaluation` for one ordinary quality dispatch.
- `/effort <link or text>`: legacy communities are told effort rewards are not open. Admitted work is nominated directly (upgrade if it has a completed ordinary decision). New work goes through the `/submit` preflight, admission, then nomination. Uncaptured media → `pending_evidence` and retrieval rounds at +1 min and +5 min.
- Dispatch: row committed before the call; one call per begun dispatch; any provider error, refusal or schema-invalid output → `pending_reconciliation`; a re-run within the 5-minute horizon waits, after it reconciles; only `reward-reconcile.ts <id> not-sent --reason` re-enables one call. Completion writes the decision, consumes the slot and stores the output in one locked transaction; `affects_allocation = accepted_at < closesAt`.
- Upgrade: 85 ordinary → revision 2 at 255 points with the predecessor's quality, flags and timing; the effort-only prompt carries the prior result.
- Notifications go through their own `reward-notify` queue and retry independently.

## Deviations from the proposal

1. **No slot-generation check at completion.** The proposal said completion requires `fence = slot.generation`. The mutation probe showed it is redundant: withdrawal is refused while a dispatch may be in flight, and a proven non-dispatch changes the dispatch state, so the dispatch's state and fence are the complete check. Removed rather than kept untested; the slot generation still numbers fences and moves on withdrawal and `not_sent_proven`.
2. **Queues use pg-boss's standard policy, no `singletonKey`.** With the standard policy a `singletonKey` alone does not deduplicate (Context7, 2026-09-23), and an in-flight recheck sent from inside a job must not be dropped. Duplicate jobs are harmless because the dispatch and retrieval rows are the idempotency.
3. **Ordinary quality dispatch is refused after the origin epoch closes** (`not_ready: epoch_closed`), the same rule as nominations. O3: no close-time dispatch; pending new work allocates nothing.
4. **Withdrawal condition** is expressed as nomination state (`pending_evidence` or `ready`) rather than "no dispatch row for the slot"; equivalent, because beginning a dispatch moves the nomination to `evaluating`.
5. **Retrieval rounds are scheduled only by nomination.** A model-reported evidence gap never schedules retrieval: its dispatch is spent, so capturing the evidence later could not be judged in that epoch.

## Known gaps (for review and later stages)

- **Withdrawing a new-work nomination leaves the artifact without an ordinary quality score** (its quality job was refused as `nominated`). No bot withdraw command exists in R3, so no live path reaches it; whoever adds withdrawal must re-queue quality.
- `/me` still sums legacy `scoring_runs`; a bootstrapped community's reward decisions are not shown until R4.
- BotFather's command menu does not list `/effort` yet (manual step at cutover).
- Telegram delivery, oEmbed retrieval and the real provider call are exercised only through injected fakes; nothing ran against live services.
- Completion-versus-close ordering (P2) is argued and the lock mode is now tested on real Postgres; the close race itself is an R5 test.
- `main` after R3 merges must not be deployed before 0003 and 0004 are applied (approved; preconditions in the approval record).

## Next

1. Independent review of the PR (a different model family preferred, as with R2's Codex pass).
2. Cisco's yes → merge.
3. Apply 0003 and 0004 to Neon per the approval preconditions (zero MYCEL epochs; journal shows 0000–0002), record it; no bootstrap, no deploy.
4. R4 on `feat/r4-effective-reads` only after R3 is merged.
