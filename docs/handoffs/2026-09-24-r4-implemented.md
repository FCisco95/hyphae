---
date: 2026-09-24
summary: R4 built test-first on feat/r4-effective-reads. One effective-decision read, /me for the current epoch through it, append-only operator corrections with an expected-revision check (migration 0006, approved in writing, not applied), and a real-Postgres race showing one successor. Full gate green. Nothing applied, deployed or bootstrapped.
---

# 2026-09-24 — R4 effective reads and corrections

## Authority

- Scope: the R4 section of `2026-09-23-r3-r5-scope-proposal.md`, approved in `2026-09-23-r3-r5-approval.md`. R3 and its findings are merged (`main` `5fdda31` includes PR #10 and PR #11).
- **Migration 0006, recorded verbatim.** The approved plan listed no R4 migration, but O6 requires a correction to record its reason, evidence and actor, and `reward_decisions` had no place for them. Question put to Cisco in-session: "R4 corrections must record reason, evidence refs and actor (O6), but reward_decisions has no columns for them and the approved plan listed no R4 migration. How should corrections store them?" Cisco chose **"Add 0006 (Recommended)"**, which read: "Additive, nullable columns on reward_decisions: correction_reason, correction_evidence (jsonb string[]), correction_actor, idempotency_key (unique per community). A check keeps the three correction fields all-set or all-null. Built test-first in R4; NOT applied to Neon. 0006 joins the cutover apply list, so main can't deploy before it's applied."
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows, 2026-09-24. Effort is not observable in-session.

## What changed

| Piece | Change |
|---|---|
| `rewards/effective.ts` | `effectiveResults(db, { communityId, epochId, memberId?, cutoff? })`. Per admitted contribution: the last revision with `accepted_at < cutoff` (default the scheduled `closesAt`). Returns entries, exact `pointUnits` as decimal strings, per-member totals with whole points rounded half-up once after aggregation, `totalEntries` and `closed`. Never reads `scoring_runs`. |
| `bot/commands/me-summary.ts`, `me.ts` | `/me` shows the most recently opened epoch through `effectiveResults`: open or closed, entries with pending and late counts, exact and whole points. A community without reward epochs sees `Scored contributions: N` (distinct contributions) and no points line. |
| `rewards/decisions.ts` | `appendCorrection(db, { communityId, contributionId, expectedRevision, changes, reason, evidenceRefs, actor, idempotencyKey })` under the community lock. Returns `appended` (with `created`), `stale_revision` (with the current row), `no_decision` or `effort_not_nominated`. |
| Migration 0006 | Nullable `correction_actor`, `correction_reason`, `correction_evidence`, `idempotency_key` on `reward_decisions`; partial unique `(community_id, idempotency_key)`; check that the three audit fields are all set or all null; check that a correction has a predecessor and no dispatch. Existing rows (all null) satisfy both checks. |
| `rewards/recovery.ts` | The F3 lost-message sweep now only considers dispatch-backed decisions. A correction has no member message to lose and must not be announced with the evaluation template. |
| `scripts/reward-correct.ts` | The only correction writer. Arguments are classifications (`--raw-quality`, `--flags`, `--effort`), never points. Actor `script:reward-correct`. The idempotency key is a hash of the command's content, so re-running the same command returns the same revision and a different correction never shares a key. |

## Correction rules as built

- Credit and points are re-derived: raw quality and flags go through R1's `creditedQuality`, with the AI-pattern evidence taken from revision 1's quality dispatch; timing is carried from the predecessor; the multiplier is the frozen config's for `eligible`, 1× for `ineligible`, otherwise the predecessor's. A hard flag keeps credit at 0 until a correction removes the flag itself.
- An effort correction needs a nomination of that contribution in `completed_eligible` or `completed_ineligible` whose slot is `consumed`. The slot is never restored.
- `affects_allocation = accepted_at < closesAt` of the origin epoch, under the lock. A post-close correction is stored and ignored by the effective read.

## Interpretations for review

1. **Entry states.** The proposal lists `pending`, `excluded`, `superseded`, `late`. As built, an entry is `scored` (a revision before the cutoff, possibly 0 points), `pending` (no decision) or `late` (decisions exist, all at or after the cutoff). A superseded revision is a non-selected row, not an entry state. `excluded` has no source before R5's close (expired nominations), so R5 adds it.
2. **"Current epoch" in `/me`** is the most recently opened epoch. After `closesAt`, until the next epoch is materialized by the next admission, `/me` shows the closed epoch with "these points no longer change".
3. **`closed` is final when true.** `effectiveResults` takes `FOR SHARE` on the community row before reading the clock. That waits for an in-flight reward writer (`NO KEY UPDATE`) to commit, so no decision accepted before close can appear after a `closed: true` read. `FOR SHARE` does not conflict with other readers or with foreign-key inserts. This follows the P2 argument; it is not raced in `test:pg`.
4. **O6 items left out of R4:** the actor's authority at acceptance and a predecessor hash wait for H-CONTRACT and the commitment work (R6). Members are not messaged about corrections; the operator tells them.

## Evidence (fresh, on `457aaa0`)

- `pnpm -r test` exit 0: core 54; api 187 (163 + 24 new).
- `pnpm -r typecheck` exit 0. `pnpm exec biome check .` exit 0 (108 files). `drizzle-kit check` exit 0. `git diff --check origin/main...HEAD` exit 0.
- `pnpm --filter @hyphae/api test:pg` (Docker, `postgres:17`): 6/6, exit 0. New: two corrections of one revision on two pools yield one successor and one `stale_revision`; one correction retried on two pools under the same key is appended once. 50 rounds each.
- Watched failing first: 8 effective-read tests, 4 `/me` tests, 8 correction tests, 3 argument-parser tests (all on assertions against stubs), and the sweep test (after moving its sweep past the grace window, where it had passed for the wrong reason).
- Mutation probes, each reverted: removing the late count from `/me`, inverting the idempotency-key ownership guard, and removing the expected-revision check (the `test:pg` race failed) were all killed.
- Not unit-tested: the `/me` Telegram handler and the `reward-correct.ts` entry point, consistent with the other handlers and scripts. The logic they call is tested.

## Codex review on PR #12

One P2 inline finding on `2ac0c3e`: `/me` treated any epoch row as a reward epoch, so a community whose only epochs are unpinned legacy epochs would show an empty reward summary instead of its legacy scored count. Verified valid (legacy epochs never admit reward intake). Fixed test-first in `564d3c3`: both epoch lookups in `me-summary.ts` require `reward_config_id`. The new test failed on the reported behavior first. Gate re-run on `564d3c3`: core 54, api 188, typecheck, Biome (108 files), drizzle-kit check, `git diff --check`, `test:pg` 6/6, all exit 0.

Not changed: `/submit` and `/effort` still route such a community into admission, which refuses with `legacy_epoch` (R3 observation 3). The cutover precondition "MYCEL `epochs` is empty before bootstrap" covers it, and Neon has zero epochs.

## Independent review on PR #12

A `/code-review` pass on `14ab993` returned 10 unverified findings. The top three were checked against the code:

- **Stale message after a correction (valid).** The notify sweep re-sent any unnotified dispatch decision inside the 24 h window, including one a correction or effort upgrade had replaced, so a member could be told points the effective read no longer counts. Fixed test-first in `3085ebf`: the sweep skips decisions that have a successor.
- **Blank `--raw-quality` became 0 (valid).** `z.coerce.number()` accepted `""` and whitespace (reproduced), so an unset shell variable would append a zero-quality correction. Fixed test-first in `b3e5872`: digits only.
- **Effort correction "records disagree" (kept as is, Cisco's call).** The nomination state records how its dispatch completed; rewriting it would break append-only (O6), and its only reader is the correction's own eligibility check. No code reads `reward_decisions.nomination_id`; a correction reaches its origin through `predecessor_id`. The copied `effort_criteria` is the model's record, and the correction reason carries the operator's override. Nothing reads it today.

Gate re-run on `b3e5872`: core 54, api 189, typecheck, Biome (108 files), drizzle-kit check, `git diff --check`, `test:pg` 6/6, all exit 0.

Two more findings, on Cisco's call:

- **Closed epoch still said "pending" (valid).** `/me` printed "N pending" beside "these points no longer change", though a decision accepted after close is late. Fixed test-first in `eacb402`: after close, pending and late entries read "not scored before close".
- **Newer unpinned epoch hides behind a pinned one (not reachable).** Every epoch insert pins a config, `ensureEpochAt` refuses to extend an unpinned epoch, and bootstrap refuses when any epoch exists, so an unpinned epoch never follows a pinned one. No change. Related, by design: epochs materialize lazily under the lock, so `/me` shows the last materialized epoch until the next intake opens the next one.

Gate re-run on `eacb402`: core 54, api 190, typecheck, Biome (108 files), drizzle-kit check, `git diff --check`, `test:pg` 6/6, all exit 0. Findings 6–10 (unbounded `inArray`, `FOR SHARE` on every `/me`, duplicated point formula, `--flags` parsing, lineage-map copying) are deferred: none changes what members see.

## Preconditions added to the cutover

Migration 0006 joins the apply list: `main` after R4 must not be deployed before 0006 is applied to Neon. The apply needs its own authorization, like 0003–0005.

## Next

1. Merge on Cisco's yes; review findings 6–10 are deferred.
2. Merge only on Cisco's yes. R5 after that.
