---
date: 2026-10-07
summary: Independent Codex review of 780183d..76cf244 (the epoch 2 pilot amendment: migration 0016, admission from effective_at, read API, web, audit manifest, amend-epoch, db.mjs). NEEDS-FIXES with three medium and one low finding; two were already fixed after the range, two fixed test-first in b265204. The fix check raised one medium in the release fingerprint tool, fixed in c1aec51. Second fix check ACCEPT.
---

# Epoch 2 pilot amendment: Codex review

Reviewer: Codex `gpt-6-astra`, reasoning effort xhigh, read-only sandbox, ephemeral session; another model family than the builder (Claude Opus 5.5). Scope: exactly `git diff 780183d..76cf244`: `365e442` the amendment record and admission, `e73b824` read API, web and audit manifest, `e44fe2c` the `amend-epoch` script, `d48b810` the postgres-js test, `76cf244` `db.mjs` for 0016, plus the design note `346bbdc`.

## First pass: NEEDS-FIXES (three medium, one low)

| # | Finding | Fix |
|---|---|---|
| 1 | Medium: the strict read API schemas now require `amendments` and `amendment`, but the committed `read-api-schema.test.ts` fixtures lacked them, so two core tests failed. | Already fixed after the range in `2828d81`: fixtures carry the fields, and new tests hold them required of this api and optional for a consumer of an older one. Mutation probe: dropping either requirement fails 2 tests. |
| 2 | Medium: the security page still said a scoring-prompt change takes effect no earlier than the next epoch, which the amendment would make false. | Already fixed after the range in `7a0626e`: the page and `docs/SECURITY.md` state the pilot amendment power, "Not used yet". |
| 3 | Medium: the page showed the effective time to the minute while a whole-second time was allowed, so a contribution at 18:00:30 could get the old prompt under a page saying 18:00. | `b265204`: an amendment takes effect on a whole minute (announced times are minutes), and any boundary that is not a whole minute is shown to the microsecond. Tests: a 30-second and a 1-millisecond offset are refused; a non-minute time renders exactly. |
| 4 | Low: an unscored contribution admitted under the amendment read "Scored under…". | `b265204`: "Admitted under this epoch's pilot amendment, so reward-eval/2 scores it (in effect from …)". |

**Clean in the first pass (Codex's list):**
- Shared community-lock ordering and the inclusive effective-time boundary, under the existing non-backwards-clock assumption.
- Earlier intake pins, corrections, effort upgrades, recovery and separate re-entry records.
- Prompt-only config construction, community-scoped config reuse, proposal activation and the O4 cooldown.
- Mixed-config close, commitments, allocation, and byte-identical storage and re-parsing of an amended audit manifest.
- Unamended manifest compatibility: 103 targeted tests passed and Python reproduced the 16 published H-CONTRACT hashes.
- Nested rollback of `--plan` in PGlite and postgres-js savepoints (by source inspection).
- Additive migration, pinned SQL hash, bounded lock timeout and the release checks.

## Fix check on `76cf244..b265204`: NEEDS-FIXES (one new medium)

Codex confirmed all four findings fixed: the fixture fields and strict/loose assertions, the security copy describing the exception, whole-minute enforcement with exact rendering (four formatter checks, including a one-microsecond boundary), and the "admitted under" wording. It also confirmed the security claim's mechanism against the code, and noted two limits that are procedural, not code: the announcement is a release step, and "Not used yet" cannot be confirmed offline.

| # | Finding | Fix |
|---|---|---|
| 5 | Medium: `scripts/rollout/decisions-digest.mjs` (the read-only fingerprint the release uses to prove earlier epoch 2 rows are unchanged) selected dispatches through decisions, so a dispatch started before the cutoff but unresolved, or decided later, was not fingerprinted. Codex reproduced it in memory. | `c1aec51`: dispatches are selected through the epoch's intakes with `dispatched_at` before the cutoff, independently of decisions. The production baseline was retaken with the new query at 16:03Z and is identical to the 15:22Z one (all 3 epoch 2 dispatches are decided). |

## Second fix check on `b265204..c1aec51`: ACCEPT

Codex's verdict: "ACCEPT". No findings. It checked unresolved and late-completing dispatches, re-entries (a new contribution and intake, so each dispatch stays with its own epoch), no double counting (one intake per contribution), that a later completion changes the digest as intended for manual review, and that the script stays read-only.

## Verification by the builder

- Native gate on `b265204`: `pnpm test` 0 (core 114, read-client 26, web 123, API 870 passed / 3 skipped), `pnpm typecheck` 0, `pnpm lint` 0; `drizzle-kit check` fine.
- `test:pg` (Docker Postgres 17): 73 of 73 in 4 of 7 full runs. Every failing run failed the member-journey "private journey" tests, and in some runs raid-alert tests that then claim the alert those tests leave behind. The same member-journey tests fail 2 of 3 runs alone on a fresh database on `94ce60e`, the live code without B, so the intermittency predates B. The new amendment Postgres tests passed in every run. Follow-up: make those tests claim their own delivery instead of the next due one.
- Mutation probes: the effective-time boundary (`<=` to `<`) fails 2 tests; dropping the read API's required amendment fields fails 2 tests.
- Rehearsal of 0016 and `amend-epoch` on a disposable Postgres 17 with the real public epoch 2 config payload: 11 of 11 cases as expected (see the release plan).
