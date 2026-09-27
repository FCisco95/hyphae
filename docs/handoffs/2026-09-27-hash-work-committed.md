---
date: 2026-09-27
summary: The Codex-built B3/B5/B6 hash work passed the full local gate on real Postgres 17, was reviewed by Claude (one reviewer APPROVE, one with eight findings), fixed test-first and committed to main in five milestone commits. The main fix is that the publish job now stores a ready epoch's hashes before building; a fresh Codex gpt-6-astra xhigh review of that fix approved it. Devnet stays blocked at 0 SOL. The durable publication/claim extension is parked on decision 1.
---

# 2026-09-27 — hash work verified, reviewed and committed

## Runner and reviewers

- **Runner:** Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, effort xhigh, Windows. It is the preferred runner the session prompt named, so no switch to Fable 5.1 was needed.
- **Capabilities confirmed first:** git writes (no index lock), Docker (Docker Desktop was stopped, started, server 28.1.1), and WSL Ubuntu. None was denied.
- **Step-2 reviews of the Codex-built range, both Claude (the other family for Codex's work):**
  - `/code-review high` (forked Claude reviewer, Opus 5.5) of the uncommitted diff: 8 findings.
  - A fresh Claude subagent (Opus 5.5, no session context), read-only, with the prompt's checklist (migration/schema agreement, null-only writes, mismatch refusal, lock order, frozen selection, pending entries, leaf/root compatibility): **APPROVE**, lows only.
- **Review of the Claude-written fix (`acd83fc`):** Codex CLI 0.157.1, **`gpt-6-astra`, reasoning xhigh**, read-only sandbox, ephemeral session, run fresh. Verdict: see [Review](#review).

## Step 1 — gate on the unchanged implementation

| Check | Result |
|---|---|
| `pnpm test` (first run) | 413 passed, **3 failed**, 1 skipped. All three were 5 s timeouts in the new PGlite cases under full parallel load. Each case migrates a fresh database inside the test. Fixed in the Vitest wrapper only, with the repo's 30 s timeout for such tests (`read-service.test.ts`); no implementation change. |
| `pnpm test` (after) | core 89, web 14, api 416 + 1 skipped (devnet): **519 passed**. The `eval-scoring` CLI test, which failed in the Sep 26 sandbox, **passes** here. |
| `test:pg`, Docker Postgres 17 | **37/37**: the 17 earlier tests, the 19 shared hash cases on postgres-js, and the new race case. |
| New race case | Backfill against a late correction, two pools, 12 rounds, asserted on final rows. Both orders occurred (11 backfill-first, 1 correction-first). **Mutation probe:** with the backfill's community lock removed, it fails in round 1 (`row … has no computed commitment`). |
| Typecheck | core, db, api (+ link page), web: exit 0. |
| Lint | `pnpm lint` exits 1 on one file: the globally git-ignored `.claude/settings.local.json` (Biome reads only the repo `.gitignore`). Tracked + new files: **200 clean**. Fixing it needs `.gitignore` or `biome.json`, outside this arc's writable paths. |
| `drizzle-kit check` | Pass. |
| WSL | `anchor build` exit 0; `cargo test -p hyphae --tests` **21 + 6** passed. |
| Python vectors | **16** hashes reproduced. |
| `git diff --check` | Clean, including the new files. |
| Supplemental runner | 19/19 (then removed on review, below). |

## Review

### Step 2 findings and what happened

| # | Source | Finding | Disposition |
|---|---|---|---|
| 1 | code-review; checklist L1 | Nothing in production fills the stored hashes (the only non-test caller of the backfill was the seed), so publishing any real epoch would throw `missing stored … hash`. | **Fixed** (`acd83fc`). `publishEpoch` asks the gate first. A blocked epoch returns with no write. A ready epoch gets the ruled B6 backfill under the reward-writer lock, then the unchanged strict build. |
| 2 | code-review | A late correction after an on-chain send but before the DB record strands the recovery run: the rebuild throws before it can read the on-chain epoch. | **Fixed** by the same change; the recovery test sends, crashes, appends a late correction and recovers with no second send. |
| 3 | code-review; checklist L1 (optional) | Missing or mismatched hashes throw instead of returning a typed blocker. | **Declined.** After fix 1, a missing hash reaches the build only if a correction commits between the backfill and the build, and a rerun fixes it. A mismatch is an integrity failure and must throw. A new `Blocker` would change the gate type the read API serves (`apps/api/src/http`, outside this arc). |
| 4, 5 | code-review | Rows re-read after `epochCommitments`; one UPDATE per row under the lock. | **Declined for now.** A MYCEL epoch has tens of rows. The backfill runs once per publish, and the second read is the post-write verification. Revisit if an epoch passes about 1,000 rows. |
| 6 | code-review | Altitude: store each hash when the row is inserted, instead of backfilling. | **Parked.** B6 ruled the backfill approach, and the writers live in `apps/api/src/rewards/**`, outside this arc. Fix 1 closes the operational gap. Hashing at insert time would pin commitments earlier; recommended as a post-hackathon change. |
| 7 | code-review | `predecessor outside its lineage` was unreachable after the contiguous-revision check. | **Fixed** (removed). |
| 8 | code-review; checklist L5 | `tests/run-payout-commitments.mjs` was sandbox scaffolding no gate ran, in the folder reserved for LiteSVM. | **Fixed** (removed). The same cases run in Vitest on PGlite and on Postgres. |
| L2 | checklist | The race's backfill-first branch runs only if that order happens. | **Fixed**: a deterministic shared case (backfill, late correction, refusal, backfill of exactly one row, a publication deep-equal to before). |
| L3 | checklist | 0010 takes ACCESS EXCLUSIVE on four hot tables inside one migration transaction. | **Recorded** for the payout-candidate deploy: apply 0010 with the worker stopped (or a `lock_timeout`), then deploy. |
| L4 | checklist | Backfill counts are attempts, not writes. | **Fixed**: counted from `RETURNING` rows. |
| L6 | checklist | 0010's snapshot was written through the drizzle-kit API (key order differs from the CLI's). The CHECK test covered one column. | Snapshot **kept** (semantically identical, `drizzle-kit check` passes; regenerating renames the migration). CHECK test **extended** to all four columns and to the no-hash-without-selection rule. |

Checklist verdicts, all OK: migration/schema agreement, null-only writes, mismatch refusal, lock order, frozen selection, pending entries, leaf/root/audit compatibility.

The fix was built test-first: 6 new or changed cases failed with `missing stored … hash`, then passed. A second **mutation probe** confirms the design: without the gate-first check, "the publish job neither fills nor sends for a blocked epoch" fails.

### Codex review of `acd83fc`

Codex CLI 0.157.1, self-reported **`gpt-6-astra`, reasoning xhigh**, read-only sandbox, ephemeral, fresh; about 115k tokens; source review, no test runs. **Verdict: APPROVE, no verified defects.**

- (a) Gate, then backfill, then strict build: correct. A correction committed between the backfill and the build's snapshot makes the build refuse; a rerun fills it. **Noted:** if readiness changes between the first gate read and the build, the backfill's hash writes stay committed. They are B6 bookkeeping only; nothing is built, sent or recorded.
- **Noted, predates this commit:** two simultaneous publish runs can both find no on-chain epoch and both attempt a send. The epoch PDA's `init` lets only one succeed, and the DB record locks the epoch, so there is no double settlement, but not a single attempted send either. Input for the operator script's design (one run at a time).
- (b) No wrong-hash, overwrite or mismatch-to-pass path. (c) Leaf, roots, audit bytes, allocation, fee and reserve unchanged; the predecessor simplification is equivalent. (d) Recovery still refuses a differing on-chain epoch and never sends twice. (e) The six new cases fail against the parent; the blocked case catches a backfill moved before the gate. Coverage it would add: forced interleavings across the whole `publishEpoch` sequence, simultaneous publishers, all four hash tables for an initially held epoch.

## Commits

| SHA | Commit | Author of the work |
|---|---|---|
| `dabfb56` | feat(db): stored reward commitment hash columns (migration 0010) | Codex, Sep 26 |
| `82c1c2e` | feat(rewards): backfill stored commitment hashes; publication refuses without them | Codex, Sep 26 |
| `2a9afc4` | test(rewards): stored-hash cases on PGlite and Postgres, and a backfill/correction race | Codex cases; Claude race and timeout |
| `acd83fc` | fix(rewards): the publish job stores a ready epoch's hashes before building (review) | Claude |
| `a69f59f` | docs: record the Sep 26 recovery and hash/backfill sessions | Codex's Sep 26 records, as written |

Commits 1–3 restore the exact Codex files (diffstats match the Sep 26 record), so the review fix is its own commit. The gate after the fix: **523 passed** + 1 skipped, `test:pg` **41/41**, typecheck 0, 199 tracked files clean, `drizzle-kit check` pass, `git diff --check` clean. `programs/**` and `packages/core/**` did not change after the Rust and Python runs above.

Pushing deploys nothing. Neon stays at 0000–0008; production stays Fly `b7bfe55` (last recorded, not queried).

## Devnet (step 3)

**Not run: blocked on funds.** Keys are present in WSL `~/hyphae-devnet/` and derive to the recorded addresses (admin `Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM`, claimant `3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk`, fee `AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR`); contents were not displayed. The admin held **0 SOL** on two reads, the second at 2026-09-27T10:38:46Z. Program `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E` is not on devnet. No faucet request, no Lab wallet. **Signatures: none.** The harness still fits: `seedReadyEpoch` stores hashes, and `publishEpoch` would fill them anyway.

## Parked

- **Step 4–5 (durable manifest bytes, operator script, P14, `/claim`, Codex review):** decision 1 has a recommendation on the Integration Board but no recorded answer.
- **Hashing at insert time** (finding 6): outside this arc's paths; post-hackathon.
- **`pnpm lint` on the ignored local settings file:** one line in `.gitignore` (`.claude/settings.local.json`) fixes it for every clone; outside this arc's paths.
