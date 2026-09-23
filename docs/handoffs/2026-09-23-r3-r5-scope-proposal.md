---
date: 2026-09-23
summary: Concrete scope for R3 (persistent slots, candidates and retrieval rounds; fenced idempotent dispatch; explicit nomination; admission-backed /submit; no automatic paid replay after uncertainty; atomic completion and consumption), R4 (effective reads with totalEntries and closed; append-only corrections without a route) and R5 (unfunded strict close snapshot). Resolves prompt/policy pinning and the proof of durable pre-close acceptance before code. Carries all six R2 review observations. Awaiting one written approval; stages ship sequentially with an independent review each. Nothing implemented.
---

# R3–R5 scope proposal

## What you are saying yes to (one read)

Three sequential stages on the reward lane, each on its own branch, each test-first, each independently reviewed and merged before the next starts. Approving this document once authorizes all three **in order**; a review can still return a stage.

- **R3 — submission and evaluation.** `/submit` goes through admission. A new `/effort <link or text>` command explicitly nominates work for the 3× effort slot. Slots, candidates, retrieval rounds and model dispatches become persistent rows with database constraints. Every model call is fenced and idempotent; an uncertain call is never repeated automatically. Completion writes the decision and consumes the slot in one transaction.
- **R4 — effective reads and corrections.** One service selects the effective decision per contribution; `/me` shows the current epoch only. Corrections are append-only with an expected-predecessor check, written from an operator script (no route; admin auth waits for H-CONTRACT).
- **R5 — close.** A scheduled close freezes one unfunded snapshot per epoch at `closesAt`, keeps pending and late work out of the allocation, and never changes afterwards.

Not included: applying migrations to Neon, deploying, R6, settlement, roots, claims, fixture or paid runs, Sentinel adoption code, public HTTP routes, vault edits.

Estimate: R3 about two sessions, R4 one, R5 one, plus a review per stage. Nine decisions at the end.

## Baseline read (2026-09-23)

- `main` at `dc261c7` = `origin/main`. Fresh native gate this session: core 41 tests, api 83 tests, `pnpm -r typecheck` passed, `pnpm exec biome check .` exit 0 (75 files), `drizzle-kit check` fine. The Sep 22 review's 41 + 83 is the same count, re-run rather than trusted.
- Admission exists (`rewards/intake.ts`) with no production caller. `/submit` inserts `contributions` directly and queues `score` with a `singletonKey`.
- `jobs/score.ts` reads the mutable `communities.rubric`, calls the model through `runScoring` with AI SDK `maxRetries: 2`, and has a `force` flag that adds a second paid run. pg-boss queue `score`: `retryLimit: 3`, `expireInSeconds: 120`.
- Current documentation checked this session (Context7): AI SDK `maxRetries` defaults to 2 and `0` disables retries. pg-boss fails a job whose handler exceeds `expireInSeconds` and retries it within `retryLimit`; the handler receives an abort signal but may still be running. So **two executions of one job can overlap**. A worker lease is not a fence.
- `/me` sums every `scoring_runs` row for the member with a float multiplier and calls it "Points this epoch".
- Neon has no reward tables (0003 not applied) and `epochs` is empty.

## Resolved before code

### P1 — prompt and policy pinning

O4 requires the epoch to pin "the scoring policy/prompt version" and each run to record the actual model and prompt/input/output hashes. Payload v1 pins the rubric but not the prompt or the effort criteria, so the same epoch could be scored by two different prompts after a deploy.

**Resolution:** reward configuration **payload version 2** adds

```ts
scoring: { promptVersion: "reward-eval/1", promptTemplateHash: "<sha256 hex>" },
effort: { ...v1 fields, criteria: "<public O1 criteria and evidence table text>" },
```

- Prompt templates live in `packages/core` in a registry keyed by `promptVersion`. `promptTemplateHash` is the sha256 of the template source for that version, computed when the payload is built.
- Before any dispatch the worker looks up the pinned version and recomputes its hash. Unknown version or a different hash leaves the work `ready` with reason `prompt_unavailable`, **without dispatching**. A code change to a template therefore needs a new `promptVersion` and a new activation through cooldown; it can never change an open epoch.
- The model is **not** pinned. O4 asks for it to be recorded, and `SCORING_MODEL` stays an operator setting. Every dispatch stores the model id, prompt hash, input hash and output hash.
- v2 replaces v1. No v1 row exists outside test databases (0003 is not on Neon), so there is nothing to migrate; `RewardConfigPayload` accepts `version: 2` only. The digest stays internal, as in R2, and is not the O7 configuration hash.

### P2 — proof of durable pre-close acceptance

O3: to affect allocation, a completed decision must be durably accepted strictly before the scheduled `closesAt`, and the implementation must establish that ordering.

**Mechanism:** every reward write that can affect allocation (admission, nomination, completion, correction, close) runs inside `withCommunityLock`: one transaction, community row lock first, then `acceptedAt = clock_timestamp()`, then the write, then commit, holding the lock throughout. R5's close takes the same lock and refuses to run unless its own locked clock reading is `>= closesAt`.

**Argument:** take any completion C and the close K of C's epoch. Both hold the same row lock, so one commits before the other starts its locked section.

- If C commits first, `acceptedAt(C) < clock(K)`, and K's snapshot (read under the lock) sees C. C is selected **iff** `acceptedAt(C) < closesAt`.
- If K commits first, C's clock is read after K's commit, so `acceptedAt(C) >= clock(K) >= closesAt`. C is late whatever the wall clock said when the model answered.

So "selected at close" is exactly "`acceptedAt < closesAt`", decided by a value written in the same transaction as the decision. Model response time, worker start, transaction start and `created_at` are never used.

**Stated assumption:** the Postgres server clock does not step backwards across a commit. This is the same assumption R2's admission already makes; R5 records it in the snapshot.

**Evidence plan:** PGlite cannot show two writers. A real-Postgres test (below) runs the completion-versus-close race and asserts the rule above over many iterations.

## Review observations from R2 (all six carried)

| # | Observation (`docs/handoffs/2026-09-22-r2-review.md`) | Stage | Disposition |
|---|---|---|---|
| 1 | `FOR UPDATE` on the community row conflicts with the `FOR KEY SHARE` every FK insert takes, so `/link` and `/raid` queue behind reward writes | R3 | Switch `withCommunityLock` to `.for("no key update")`. Reward writers still exclude each other; FK inserts no longer wait. Real-Postgres test asserts both. |
| 2 | `ensureEpochAt(tx, id, t, now)`: every caller passes `t === now` | R5 | Close decides. If close does not need a separate `t`, collapse the parameter in R5. |
| 3 | A closed legacy epoch makes admission throw; no legacy → pinned path | R3 | Admission returns `legacy_epoch` instead of throwing. The cutover checklist keeps "MYCEL `epochs` is empty before bootstrap". |
| 4 | Re-proposing the pending payload supersedes itself with a later earliest epoch | R3 | Treat it as a no-op, like re-proposing the pinned payload (R3 touches `config.ts` for payload v2). |
| 5 | `set-rubric.ts` updates staging before the reward write | R3 | Reorder: reward write first, staging update only after it succeeds. |
| 6 | `resolvedAt` on activation is the materialization instant, not the boundary | R5 | Add the comment when close reads activation history; no data change. |

## R3 — slots, candidates, retrieval, dispatch, nomination, admission-backed submission

Branch `feat/r3-slots-dispatch`, created from `main` only after approval.

### Member-facing behavior

| Command | Meaning |
|---|---|
| `/submit <link>` / `/submit quote <link>` / `/submit <text>` | Ordinary work at 1×. Same preflight as today (format, oEmbed read, handle binding, one reply and one quote per raid). Then admission. One quality evaluation. Never touches the effort slot. |
| `/effort <link or text>` | Explicit nomination. New artifact: admission, then one combined quality + effort evaluation using the slot. Artifact already admitted and scored by this member in the still-open origin epoch: an **upgrade** that evaluates effort only. |

Replies stay Telegram replies. There is **no public HTTP route** in R3.

**Communities without reward epochs keep today's path.** When admission returns `not_open` because the community has no epochs (MYCEL until the separate cutover), `/submit` falls back to the current direct insert and score job; `/effort` answers that effort rewards are not open here. Once a community is bootstrapped, both commands use only the reward lane. This keeps Hyphae Lab testers working between merge and cutover. It needs the reward tables to exist, so **after R3 merges, `main` must not be deployed before migrations 0003 and 0004 are applied**; that apply belongs to the separately authorized cutover.

### Schema (migration 0004, additive)

All new tables are insert-mostly with explicit state columns; historical rows are never deleted.

| Table | Key columns | Constraints that do the enforcing |
|---|---|---|
| `reward_slots` | community, member, epoch, `ordinal`, `state` (`open`, `reserved`, `consumed`), `generation`, `candidates_used`, `consumed_at`, `consumed_decision_id` | unique `(epoch, member, ordinal)`; check `candidates_used between 0 and 3`; ordinal ≤ pinned `slotLimit` checked in code under the lock |
| `reward_nominations` (candidates) | slot, `candidate_ordinal`, contribution, intake, `kind` (`new_work`, `upgrade`), `state`, `pending_reason`, idempotency key | unique `(slot, candidate_ordinal)`; unique `(community, idempotency_key)`; partial unique on `contribution` where state is not `withdrawn` (one live nomination per artifact) |
| `reward_retrievals` | contribution, epoch, `round`, started/finished, outcome, limitations, capture hash | unique `(contribution, epoch, round)`; check `round between 1 and 3` |
| `reward_dispatches` | contribution, nomination (null for ordinary), slot (null for ordinary), `purpose` (`quality`, `quality_effort`, `effort`), `fence`, idempotency key, `state` (`dispatched`, `completed`, `pending_reconciliation`, `not_sent_proven`), model id, prompt version/hash, input hash, raw output, output hash, latency, cost, error | unique idempotency key; partial unique on `slot` where state ≠ `not_sent_proven` (**one possibly billable dispatch per slot**); partial unique on `contribution` where purpose = `quality` and state ≠ `not_sent_proven` |
| `reward_decisions` | contribution, `revision`, `predecessor_id`, source dispatch or correction, raw quality, credited quality, flags, effort (`eligible`, `ineligible`, `not_nominated`), effort criteria hits, timing bps, multiplier bps, `point_units` (bigint), explanation, config, `accepted_at`, `affects_allocation` | unique `(contribution, revision)`; unique `predecessor_id` (linear lineage, no forks) |

Nomination states follow O2 exactly: `pending_evidence`, `ready`, `evaluating`, `pending_reconciliation`, `completed_eligible`, `completed_ineligible`, `withdrawn`. `expired_at_close` and `completed_after_cutoff` belong to R5.

`reward_decisions` appears in R3 because completion must write a decision atomically and an upgrade appends revision 2 to an ordinary revision 1. R4 adds corrections and reads on the same table; it does not create a second ledger. `scoring_runs` is left for the legacy path and is not overloaded.

### Modules

- `packages/core/src/score.ts`: extend the scoring contract with the effort output (three O1 criteria as booleans with evidence-citing notes, `eligible`, `missingEssentialEvidence: string | null`, public explanation), the `reward-eval/1` prompt templates (combined and effort-only), the template registry and `promptTemplateHash`. Pure, unit-tested. The ordinary legacy prompt is unchanged.
- `apps/api/src/rewards/slots.ts`: `nominate`, `withdrawNomination`, slot/candidate accounting. All under the community lock.
- `apps/api/src/rewards/evaluation.ts`: `beginDispatch`, `completeDispatch`, `markReconciliation`, `recordNotSentProven`; decision derivation through R1 (`creditedQuality → timingBps → multiplier → pointUnits`) with the pinned config.
- `apps/api/src/jobs/reward-evaluation.ts` and `jobs/reward-retrieval.ts`: pg-boss handlers; `jobs/queue.ts` and `worker.ts` register them.
- `apps/api/src/scoring/run.ts`: reward dispatch path passes `maxRetries: 0` and an explicit timeout; the legacy call is unchanged.
- `apps/api/src/bot/commands/submit.ts` (rewired), new `bot/commands/effort.ts`, registration in `bot/index.ts`.
- `apps/api/scripts/reward-reconcile.ts <dispatch-id> not-sent --reason "<text>"`: operator record of a proven non-dispatch (see below). No route.
- `rewards/config.ts`: payload v2, observations 1, 3, 4; `scripts/set-rubric.ts`: observation 5.

### Nomination and capacity

`nominate(db, { communityId, memberId, contributionId | new artifact, idempotencyKey })`, inside the lock:

1. Same idempotency key → return the existing nomination.
2. Upgrade only: the contribution must belong to this member, its origin epoch must still be open (`now < closesAt`), and it must have a completed decision. If quality is still pending → `quality_pending`, no candidate used.
3. Find the lowest slot ordinal ≤ `slotLimit` that is `open`, or create it. A slot that is `reserved` with a live nomination in `ready`, `evaluating` or `pending_reconciliation` refuses a new candidate (no replacement while a request may be in flight). All slots consumed → `slot_used`.
4. `candidates_used < 3` or → `candidates_exhausted`. Increment; never decrement.
5. Insert the nomination (`candidate_ordinal = candidates_used`), slot → `reserved`.

Linked handles cannot bypass this: the slot key is the stable `members.id`, and all nominations for a community serialize on one lock. Withdrawal is allowed only while no dispatch row exists for the slot; it releases the reservation (`slot → open`, `generation + 1`) and keeps `candidates_used` and every retrieval row.

### Retrieval rounds and essential evidence

Round 1 is the capture at admission. Deterministic essential-evidence gaps:

- the post could not be read (`post_unavailable`);
- the post carries media (the oEmbed text contains a `pic.x.com`/`pic.twitter.com` link) that the text-only oEmbed capture cannot include (`media_not_captured`).

A gap puts the nomination in `pending_evidence` with the reason and schedules round 2 at +1 minute and round 3 at +5 minutes after the preceding failed round (pg-boss `startAfter`). A round refetches the one oEmbed document; nothing recurses. After round 3 the nomination stays `pending_evidence` until withdrawal or close; it is never ineligible and never consumes the slot. No paid retrieval fallback. Text submitted through Telegram is its own complete evidence.

Media capture is not in R3, so a media-dependent effort claim cannot complete in R3. The public reason says so.

If the model itself reports `missingEssentialEvidence` after a dispatch, the decision is **not** written, the nomination returns to `pending_evidence` with the model's reason, the slot stays reserved and unconsumed, and the slot's single dispatch is spent (O2's conservative spend rule). That nomination can only be withdrawn — which does not refund the dispatch — or expire at close.

### Fenced, idempotent dispatch

1. **Begin** (locked transaction): nomination `ready` → `evaluating`; slot `generation + 1`; insert `reward_dispatches` in state `dispatched` with `fence = generation` and idempotency key `dispatch:<nomination-id>` (ordinary: `dispatch:quality:<contribution-id>`). The unique indexes make a second begin fail. After commit the call **may have happened**; nothing later assumes otherwise.
2. **Call** the provider once, `maxRetries: 0`, explicit timeout, input built only from the captured evidence, the pinned rubric and the pinned prompt version. Ordinary quality work uses the same begin/complete path with purpose `quality` and no slot.
3. **Complete** (locked transaction): requires the dispatch state `dispatched` or `pending_reconciliation`, and for slot work `fence = slot.generation`. Store raw output and hashes, derive the decision through R1, insert `reward_decisions`, nomination → `completed_eligible`/`completed_ineligible`, slot → `consumed` with the decision id, dispatch → `completed`. One transaction. Credited quality 0 and effort rejection consume the slot. A repeat call on a completed dispatch returns the stored decision.
4. **Any provider error** (timeout, network, HTTP error, refusal, schema-invalid output) → dispatch and nomination `pending_reconciliation` with the error. No automatic second call. The raw body is kept when there is one.
5. **Lost write**: if step 3's database write fails, the worker retries only the database write a bounded number of times (free); it never re-calls the model. If the process dies, the response is lost and the work stays in reconciliation.

**Job re-runs.** A pg-boss job that finds its dispatch `dispatched` does not call the model. If the dispatch is younger than the reconciliation horizon (provider timeout plus margin, ~5 minutes), it reschedules itself; older → `pending_reconciliation`. A slow original worker that finishes later still completes, because completion accepts `pending_reconciliation` with the matching fence — that is recovering the original outcome, not a new call. A fence changes only on begin and withdrawal, so a worker holding an old fence cannot finalize.

**Reconciliation without paying again.** This design relies on no provider idempotency or replay feature. `reward-reconcile.ts` lets an operator record a proven non-dispatch (for example, the provider's usage log shows no request) with a written reason; the dispatch becomes `not_sent_proven` and the slot may dispatch once more. Without that record the work stays pending until R5 expires it. The `force` flag and generic re-scoring are removed from the reward path.

**Notifications** run after commit and are retried independently; a Telegram failure never fails a scoring job.

### Timing and points

`timingBps` from `intake.acceptedAt` minus `task.opensAt` in integer milliseconds through R1 with the pinned `timing` fields; no task → 10000. `multiplierBps` = pinned `effort.multiplierBps` for `completed_eligible`, else 10000. `pointUnits = creditedQuality × timingBps × multiplierBps` as bigint. No rounding per contribution. An upgrade copies raw and credited quality and flags from the predecessor and changes only effort and multiplier: 85 ordinary upgraded to eligible becomes revision 2 at 255 points; the lineage never sums 85 + 255.

`affects_allocation = accepted_at < closesAt` of the origin epoch, computed in the same locked transaction (P2).

### R3 acceptance tests

PGlite unless marked **pg** (real Postgres, below).

| Case | Expected |
|---|---|
| Two linked handles of one member nominate at once (**pg**, repeated) | One reservation; the other sees the existing reservation; at most one dispatch row. |
| Candidates never reset | Withdraw → nominate → withdraw → nominate → fourth attempt `candidates_exhausted`; URL alias and retry do not add candidates. |
| Retrieval rounds never reset | Three failed rounds → `pending_evidence` with reason; a user retry does not create round 4; unique `(contribution, epoch, round)` rejects it directly. |
| Duplicate job | Same job twice, or two workers on one dispatch (**pg**): one provider call on the mock, one decision. |
| Uncertainty blocks a second paid call | Mock times out → `pending_reconciliation`; re-run jobs make zero further calls; only `not_sent_proven` re-enables one. |
| Late original outcome | Mock answers after the job was marked `pending_reconciliation` → completes with the matching fence. |
| Stale fence | Withdraw after begin is refused; a forged older fence cannot complete. |
| Rejection consumes, missing evidence does not | Effort ineligible → slot consumed, 1× points; quality 59 → consumed, 0 points; `media_not_captured` → reserved, unconsumed. |
| Upgrade | Ordinary 85 then `/effort` on it → revision 2 = 255 points, one consumed slot, quality not re-scored (effort-only prompt, mock asserts no quality request). Upgrade in a closed origin epoch → refused. |
| Prompt pinning | Pinned `promptVersion` with a changed template hash → no dispatch, `prompt_unavailable`. |
| Admission-backed `/submit` | Bootstrapped community: `/submit` admits then queues; legacy community (no epochs): today's path, byte-identical inserts. |
| Observations | 1: FK insert on the community completes while a reward lock is held (**pg**, `lock_timeout`); 3: closed unpinned epoch → `legacy_epoch`; 4: re-proposing the pending payload → no-op; 5: failing bootstrap leaves staging rubric unchanged. |
| Crash recovery | Crash after begin (dispatch row committed, no call) → job re-run → reconciliation, zero calls. Crash after response before completion → same. Crash after completion before notify → notify retried, no second decision. |

No test calls a real model; the provider is injected and counted.

### Real-Postgres concurrency evidence

- `postgres:17` in local Docker (available on this machine: Docker 28.1.1), started by `apps/api/scripts/test-pg.sh`, migrations 0000–0004 applied by the Drizzle migrator, disposable volume. **Not Neon.**
- `*.pg.test.ts` files run through `pnpm --filter @hyphae/api test:pg` with `HYPHAE_TEST_PG_URL`. They are excluded from `pnpm -r test` so the default gate never silently skips them; the review records the `test:pg` output as separate evidence.
- Races use two independent `postgres-js` pools and `Promise.all`, repeated (≥ 50 iterations per case), asserting final row counts, not timing.

## R4 — effective reads and corrections

Branch `feat/r4-effective-reads` after R3 merges.

- `apps/api/src/rewards/effective.ts`: `effectiveResults(db, { communityId, epochId, memberId?, cutoff? })`. For every admitted contribution in the epoch (optionally one member): the selected revision (last revision with `accepted_at < cutoff`, default `closesAt`) or a state (`pending`, `excluded`, `superseded`, `late`). Returns exact `pointUnits` as a decimal string, whole claim points through R1's half-up-after-aggregation, and:
  - `totalEntries`: count of admitted contributions in scope, including zero, pending and excluded ones, so a reader can tell "three entries, one scored" from "one entry";
  - `closed`: whether the epoch's scheduled `closesAt` has passed (by the database clock), i.e. whether the result can still change for allocation.
- `bot/commands/me.ts`: the current epoch only, through `effectiveResults`: exact points, whole points, entries, pending count, `closed`. Communities without reward epochs: scored count only; the misleading "Points this epoch" line is removed.
- `apps/api/src/rewards/decisions.ts`: `appendCorrection(db, { contributionId, expectedRevision, changes, reason, evidenceRefs, actor })` under the lock. Loser of a concurrent correction gets `stale_revision`. Credit and points are re-derived; a hard flag cannot be overridden while it stays asserted; an effort correction must reference a consumed nomination. Accepted at or after close → `affects_allocation = false`.
- `apps/api/scripts/reward-correct.ts`: operator-only writer, actor recorded as `script:reward-correct` until H-CONTRACT defines actors. No route, no Telegram command, no web UI.

R4 tests: concurrent corrections yield one successor (**pg**); stale correction reloads; upgrade selects 255 not 85 + 255; `/me` ignores superseded, late and legacy runs; post-close correction is explanatory only; `totalEntries` counts pending and zero entries; `closed` flips exactly at `closesAt`.

## R5 — strict close, unfunded snapshot

Branch `feat/r5-close-snapshot` after R4 merges.

- Schema (migration 0005): `reward_epoch_snapshots` (epoch unique, `closes_at`, cutoff assumption text, membership, created at) and `reward_snapshot_entries` (snapshot, contribution, member, selected decision id or reason: `pending_at_close`, `pending_reconciliation`, `excluded`, exact points, whole points), unique `(snapshot, contribution)`. `epochs.status` → `closed`.
- `apps/api/src/jobs/close-epoch.ts`: scheduled for each epoch's `closesAt` and retried; under the community lock it refuses if `now < closesAt`, returns the existing snapshot if one exists, otherwise freezes membership and O6 selections through `effectiveResults(cutoff = closesAt)`, marks unfinished nominations `expired_at_close`, and materializes the next contiguous epoch. A late completion afterwards is stored as `completed_after_cutoff` with `affects_allocation = false` and never changes the snapshot.
- `packages/core/src/reward-aggregation.ts`: exact per-member aggregation, whole points once. Pure.
- Re-entry: an expired artifact may be nominated in a later epoch only when no evaluation ever completed and no dispatch is `dispatched` or `pending_reconciliation`; linked to the earlier record, new slot and config.
- Observations 2 and 6 resolved here.

R5 creates **no** root, leaf, pot, allocation in lamports, claim or publication. `epochs.root` and `pot_lamports` stay null.

R5 tests: a delayed close still uses the scheduled `closesAt`; intake exactly at close is next epoch; completion versus close race follows P2 (**pg**, repeated); pending new work gets no points; pending upgrade keeps the ordinary 1× result; retry returns the identical snapshot; re-entry only when terminal and never completed.

## Native gate (every stage, reported unfiltered with exit codes)

```text
pnpm -r test
pnpm -r typecheck
pnpm exec biome check .            # unfiltered; exit code recorded
pnpm --filter @hyphae/db exec drizzle-kit check
pnpm --filter @hyphae/api test:pg  # real Postgres in local Docker; from R3 on
git diff --check
```

No CI exists; this gate plus the independent review is the evidence. Historical counts are never reported as fresh runs.

## Out of scope for R3–R5

Applying any migration to Neon, bootstrapping MYCEL, deploying; R6 (public routes, commitment hashes, wire schemas, admin auth); settlement, root, claim, pot, `settle.ts`, the Anchor program; fixture conversion or paid runs; Sentinel adoption code and wallet re-linking; media capture; vault edits.

## Decisions requested (yes/no each)

1. **Combined approval, sequential delivery**: this document authorizes R3, then R4, then R5, each merged only after its own independent review.
2. **Payload v2** pins `promptVersion` and `promptTemplateHash` and adds effort criteria; v1 is retired (no persisted v1 exists); the model stays unpinned and recorded per dispatch.
3. **`/effort`** as the explicit nomination command (new work and in-epoch upgrade); plain `/submit` never touches the slot.
4. **Legacy fallback**: communities without reward epochs keep today's `/submit` path until cutover; `main` after R3 is not deployed before 0003 and 0004 are applied under the separate cutover authorization.
5. **Every provider error is uncertain**: no automatic paid retry; only an operator `not_sent_proven` record (with reason) re-enables one dispatch.
6. **Deterministic evidence gate**: `post_unavailable` and `media_not_captured` are essential gaps for effort nominations; ordinary `/submit` keeps scoring the captured text with the limitation recorded.
7. **A model-reported evidence gap spends the slot's dispatch** without consuming the slot (work stays pending until withdrawal or close).
8. **Real Postgres in local Docker** as a separate `test:pg` gate, not Neon.
9. **Corrections only through an operator script** in R4; routes and admin auth wait for H-CONTRACT.

Decision 6 is the one deviation from a literal reading of O1, which also covers quality: gating ordinary work on media would stop most raid replies with images from scoring, because oEmbed never captures media. The alternative is to gate ordinary work too; say so and R3 will do it.

A "yes" to all nine is authorization for R3, then R4, then R5. A "no" on any item returns this document for revision, not partial implementation.
