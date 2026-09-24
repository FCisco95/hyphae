---
date: 2026-09-24
summary: R5 built test-first on feat/r5-close-snapshot. Strict close under the community lock with a frozen snapshot (entries, per-member totals), expired nominations, next-epoch materialization, a close job driven by the recovery sweep, completed_after_cutoff, and O3 re-entry. Migration 0007 generated, not applied. Full gate green including test:pg 7/7 with a completion-versus-close race.
---

# 2026-09-24 — R5 strict close, unfunded snapshot

## Authority

- Scope: the R5 section of `2026-09-23-r3-r5-scope-proposal.md`, approved in `2026-09-23-r3-r5-approval.md` (build yes, apply no). The scope called its migration 0005; that number and 0006 were taken, so it is **0007**.
- Two questions put to Cisco in-session before code:
  - "Re-entry of an expired artifact in a later epoch needs the intake uniqueness constraints relaxed and a new identity rule. Split it out?" Cisco chose **"Do all of R5 in one PR"**, which read: "I pick the re-entry shape myself (a new intake row linked to the earlier one, uniqueness moved to (epoch, artifact)) and record it as an interpretation for review."
  - "O5 rounds whole points once per member after aggregation, but the scope listed whole points on each snapshot entry. Where should the frozen whole points live?" Cisco answered: **"Whatever is the best decision? Think like an expert team, what would they do?"** Chosen: a third table, `reward_snapshot_members`, one row per member. It matches O5 (rounded once, after aggregation), gets a foreign key and a uniqueness check, and gives R6 its leaf source directly. The alternative, a jsonb column, has neither check.
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows, 2026-09-24. Effort is not observable in-session.

## What changed

| Piece | Change |
|---|---|
| `rewards/close.ts` | `closeEpoch(db, { communityId, epochId })` under `withCommunityLock`. Returns `too_early` while the locked clock is before `closesAt`. Otherwise returns the stored snapshot if one exists (`created: false`), or writes one: every admitted contribution with its O6 selection at the scheduled `closesAt`, or a reason; per-member exact units and whole points; live nominations → `expired_at_close`; `epochs.status = closed`; then `ensureEpochAt(closesAt)` materializes the next epoch. `dueCloses(db, now)` lists pinned open epochs past `closesAt`. |
| `rewards/effective.ts` | The selection moved into `selectEffective(tx, epochId, cutoff, memberId?)` so close runs it inside its locked transaction. `effectiveResults` is unchanged in behavior. |
| `rewards/evaluation.ts` | A completion accepted at or after `closesAt` marks its nomination `completed_after_cutoff` (decision `affects_allocation = false`, slot still consumed). A late missing-evidence answer and a proven non-dispatch no longer move an `expired_at_close` nomination. Timing uses the original intake's acceptance for a re-entry. |
| `rewards/slots.ts` | `nominate` follows an artifact to its newest intake. If that intake's epoch has passed `closesAt`, it tries re-entry (below). The slot logic moved unchanged into `reserve()`. |
| `jobs/` + `worker.ts` | New `reward-close` queue (5 retries, backoff). The 5-minute recovery sweep sends one close job per due epoch; the job logs its status. |
| Migration 0007 | `reward_epoch_snapshots` (epoch unique, `closes_at`, `closed_at`, `cutoff_assumption`), `reward_snapshot_entries` (unique `(snapshot, contribution)`; check: a selected decision with revision, or a reason with 0 units), `reward_snapshot_members` (unique `(snapshot, member)`; nonnegative), enum `reward_snapshot_reason`, nomination states `expired_at_close` and `completed_after_cutoff`, `reward_intakes.reentry_of`, artifact uniqueness now `(epoch, artifact)` plus one original per `(community, artifact)`. |

## Interpretations for review

1. **Entry reasons, in precedence order.** Selected decision → no reason. No selected decision and a dispatch still `dispatched` or `pending_reconciliation` → `pending_reconciliation`. Only decisions accepted at or after `closesAt` → `excluded`. Nothing → `pending_at_close`. A pending upgrade leaves the entry selected at 1×.
2. **Close scheduling is the sweep.** The close job is sent by the existing 5-minute recovery sweep, not scheduled when an epoch is materialized, because materialization happens inside several transactions with no queue access. A close up to 5 minutes late changes nothing: the cutoff is the scheduled `closesAt`, never the time the job runs.
3. **One epoch at a time.** Close materializes only the next epoch. After an outage longer than an epoch, the sweep finds each later epoch due in turn, so windows stay contiguous.
4. **No new core module.** The scope named `packages/core/src/reward-aggregation.ts`. R1 already ships exact aggregation and once-only whole-point rounding (`aggregatePointUnits`, `wholePoints` in `reward-points.ts`, tested), and close reuses them.
5. **`completed_after_cutoff`** is set whenever the completion is accepted at or after `closesAt`, including before the close job has run. It is the acceptance time, not the job, that decides.
6. **Re-entry shape.** `/effort` on an artifact whose epoch has closed:
   - `epoch_closed` if the close is not yet recorded, or if any intake of the artifact ever got a decision (a completed ordinary score counts, as O3 says);
   - `reentry_blocked` while any of its dispatches is `dispatched` or `pending_reconciliation`;
   - `paused` if intake is paused;
   - otherwise a new contribution and a new intake in the current epoch with `reentry_of` pointing at the original intake, then an ordinary new-work reservation. The reservation runs in a savepoint: if the slot refuses, the new intake is rolled back, so the sweep never scores an orphan.
   - The artifact is captured again when it is nominated (O3: the new attempt uses the new epoch's evidence); the earlier intake keeps its own capture (O7). Retrieval rounds count fresh for the new contribution. The task is kept, and timing counts from the original submission (O3), so a re-entry is neither penalized nor backdated in points. *Changed after review; the first version reused the old capture (finding C1 below).*
   - `/submit` of the artifact still answers `duplicate_artifact` with the original intake.
7. **Decision hashes** are not in the snapshot yet. Entries keep the selected decision id and revision; the O7 hash waits for H-CONTRACT and R6, as in R4.
8. **`/me` unchanged.** It reads the effective result at `closesAt`, which selects exactly what the snapshot froze; it does not show the snapshot's reasons.
9. **Review observations.** 2: `ensureEpochAt` keeps its separate `t`; close is the first caller with `t ≠ now` (`t = closesAt`). 6: comment added where materialization writes `resolvedAt`.

## Evidence (fresh, on `082cffa`)

- `pnpm -r test` exit 0: core 54; api 208 (190 + 18 new: 11 close, 7 re-entry).
- `pnpm -r typecheck` exit 0 · `pnpm exec biome check .` exit 0 (112 files) · `drizzle-kit check` exit 0 · `git diff --check` exit 0.
- `pnpm --filter @hyphae/api test:pg` on Postgres 17: 7/7 exit 0. New: completion versus close, 50 rounds on the real database clock with `closesAt` 300 ms ahead and the completion delayed at random. Every round: the decision counts exactly when `accepted_at < closesAt`; otherwise the entry is `excluded` if the completion committed first, `pending_reconciliation` if the close did. Both sides of the boundary were hit.
- Test-first notes, stated plainly: every close and re-entry unit test was watched failing before its code, except two. The "intake exactly at close" test passed on the existing admission code, which already handled it. The "`/submit` after re-entry returns the original" test passed by row order before `isNull(reentry_of)` pinned it. The `test:pg` race was written after the close code, so it has no red run.
- 0 migrations applied, deployments, bootstraps, model calls, roots, claims or payments.

## Review (cross-model, replaces the PR)

Two Codex passes on `origin/main...feat/r5-close-snapshot`: the Codex GitHub review of PR #13 (commit `5b27b71`, one inline comment) and a local Codex adversarial review focused on the interpretations above. Adversarial verdict: **needs-attention**, two medium findings. It raised nothing against interpretations 1–6 or 8.

| # | Finding | Disposition |
|---|---|---|
| C1 | P2 (PR #13, `slots.ts:355`): re-entry copied the original text and capture, so an edited or deleted post was judged on stale evidence, against O3's "new epoch's evidence". | **Fixed** test-first in `6015c91`. `nominate` answers `needs_evidence` for an eligible re-entry without a fresh capture; `/effort` fetches the post (or takes the text) and nominates again. An unreadable post is refused like `/submit` ("Could not read that post. Is it public?"). `/submit` and re-entry now share `capturedEvidence()`. Tests: 2 re-entry, 2 `capturedEvidence`, each watched failing. |
| C2 | Medium (`schema.ts`, snapshot members): the database accepted whole points that disagree with the exact units (149,000,000 units as 2 points). | **Fixed** test-first in `22779c3`: check `whole_points = (point_units + 50000000) / 100000000`, O5's half-up at 10^8 units per point. Folded into the unapplied 0007. |
| C3 | Medium (`schema.ts`, snapshot entries): entries keep the selected decision id and revision but no decision hash, which O6 asks the frozen manifest to retain. | **Deferred to R6, as interpretation 7 already states.** O7 makes concrete hash field schemas and cross-language vectors a contract gate ("not permission to invent consumer fields today"), so a hash cannot be added before H-CONTRACT. Until R6 adds it, the snapshot is an internal close record, not the auditable allocation record: nothing publishes a root or claim from it. R6 must add the versioned decision hash before any root. |

Fresh gate after the fixes (on `22779c3`): `pnpm -r test` exit 0 (core 54, api 213); `pnpm -r typecheck` exit 0; `pnpm exec biome check .` exit 0 (112 files); `drizzle-kit check` exit 0; `test:pg` 7/7 exit 0; `git diff --check` exit 0.

`/effort`'s re-entry glue (fetch, second `nominate`) is bot wiring with no unit test, like the rest of the command handlers; the logic it calls is tested.

## Next

Land R5 on `main` (trunk-based, working agreement adopted 2026-09-24). Migration 0007 joins 0006 on the cutover apply list; `main` must not deploy before both are applied.
