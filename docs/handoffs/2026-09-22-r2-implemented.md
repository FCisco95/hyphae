---
date: 2026-09-22
summary: R2 (pinned reward configuration and epoch admission) implemented on feat/r2-pinned-config after Cisco's written yes to all five proposal decisions. Native gate green; migration generated, not applied; no production caller yet. Awaits review and PR merge.
---

# 2026-09-22 — R2 implemented, awaiting review

## Authorization

Cisco answered "yes to all five" in-session on 2026-09-22 to the decisions in `docs/handoffs/2026-09-21-r2-scope-proposal.md`. That proposal is the authorized scope and is unchanged; deviations are listed below.

## What exists now (commit `ddb2776`)

| Piece | Where |
|---|---|
| Schema: `reward_configs`, `reward_config_proposals`, `reward_intakes`, enum `reward_proposal_status`, `epochs.reward_config_id`, `communities.reward_intake_paused_at` | `packages/db/src/schema.ts` |
| Migration 0003 (generated, **not applied to Neon**) | `packages/db/drizzle/0003_reward_config_intake.sql`, `meta/0003_snapshot.json`, journal |
| Driver-agnostic `Db` type (`PgDatabase<PgQueryResultHKT, typeof schema>`) | `packages/db/src/index.ts` |
| Payload v1, digest, cooldown and window math, community lock, bootstrap, propose, cancel, materialize, pause | `apps/api/src/rewards/config.ts` |
| Artifact identity and admission | `apps/api/src/rewards/intake.ts` |
| PGlite test database + seeds | `apps/api/src/rewards/test-db.ts` (not bundled; tsup entries are server/worker only) |
| Tests: 16 pure, 17 PGlite | `config.test.ts`, `intake.test.ts` |
| `set-rubric.ts` as proposal producer (`--activate-at`, `--cancel`); `reward-intake.ts pause|resume` | `apps/api/scripts/` |

## Deviations from the proposal text

1. **Admission step order.** Idempotency is checked before the pause flag, so a redelivered Telegram message for an already admitted contribution returns the existing intake even while intake is paused. The proposal listed pause first. Everything else follows the proposal order.
2. **Clock injection.** Every write takes `deps.clock` (default `dbClock`: `clock_timestamp()` read after the community row lock). Tests inject fixed times; production never passes one. The proposal did not name this seam.
3. **`latestEpoch` is exported** so `set-rubric.ts` can print "no reward epochs yet" for an un-bootstrapped community instead of failing. MYCEL has no epochs today, so the script keeps working as before plus the message.
4. **No-op proposal** ends the script with the thrown error after the staging rubric update already happened. The staging change is real; the reward lane is unchanged.
5. **Before epoch 1 opens**, a proposal is accepted with `acceptedInEpoch = 0`, so its earliest activation is E3 (bootstrap counts as `a = 1`). The proposal said only that bootstrap counts.

## Evidence (native gate, 2026-09-22, Windows, Claude Code Fable 5.1 xhigh)

- `pnpm -r test` — core 5 files / 41 tests, api 10 files / 76 tests (33 new). All passed.
- `pnpm -r typecheck` — core, db, api passed.
- `pnpm exec biome check .` — 75 files, no fixes.
- `git diff --check` — clean.
- No CI exists. No Neon command, deploy, model call, fixture run, push to `main`, root, claim or payment.

Watched fail first: `config.test.ts` and `intake.test.ts` both failed on missing modules/tables before implementation.

## Known limitations

- PGlite is single-connection, so the two-writers race is covered by the unique indexes and the lock discipline, not by a concurrent run. A real-Postgres concurrency check belongs to the R3 review.
- After adding PGlite, pnpm created a second `drizzle-orm` instance and typecheck broke on class identity. `pnpm dedupe` merged them; the lockfile now carries one instance peered with pglite, pg and postgres. Re-run `pnpm dedupe` if a future dependency change re-splits it.
- Legacy contributions have no intake row and stay outside the reward lineage. No backfill.

## Cutover checklist (separately authorized, not done)

1. Apply migration 0003 to Neon (`pnpm --filter @hyphae/db migrate` with `DATABASE_URL`).
2. `reward-intake.ts <mint> pause`.
3. `set-rubric.ts <mint> docs/rubrics/mycel-1.2.0.json --activate-at <future whole-second UTC>`.
4. Leave paused until R3 wires `/submit` to admission; then `resume`.

## Next

Independent review of PR #2 on `FCisco95/hyphae` (branch `feat/r2-pinned-config`), then merge. R3 needs its own scope and written authorization.
