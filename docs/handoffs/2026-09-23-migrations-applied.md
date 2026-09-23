---
date: 2026-09-23
summary: Migrations 0003, 0004 and 0005 were applied to Neon in one Drizzle migrator run at 2026-09-23T22:42:49Z, from main 99f7596 after PR #10 merged. Every precondition was checked first and every result was verified read-only afterwards. No bootstrap, no deploy; the Sep 17 bot is still running and healthy.
---

# 2026-09-23 — migrations 0003–0005 applied to Neon

## Authority

- 0003/0004: R3–R5 approval ("yes to all nine + A + B + apply 0003/0004 after R3 merge"), `2026-09-23-r3-r5-approval.md`.
- 0005: Cisco's written yes ("Yes, add 0005 (Recommended)"), `2026-09-23-f3-notified.md`, which set the one-run apply and the preconditions.
- Trigger: Cisco merged PR #10 and said "I merge, you can continue".
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows. Effort is not observable in-session.

## Preconditions (all checked before the apply)

| # | Check | Result |
|---|---|---|
| 1 | PR #10 merged; native gate and `test:pg` on the merge commit `99f7596` | Merged 22:41:01Z. `pnpm -r test` exit 0 (core 54, api 163); typecheck, Biome (98 files), `drizzle-kit check` exit 0; `test:pg` 4/4 exit 0. Codex's automated review of `ebd0cbe` left no inline comments. |
| 2a | `epochs` has zero rows (read-only transaction) | 0 |
| 2b | `drizzle.__drizzle_migrations` shows 0000–0002 only | 3 rows; hash prefixes `15c45e6aa5df`, `6475c8725e3f`, `b63481133529` match the sha256 of the 0000–0002 files |
| 2c | Reward tables absent | `to_regclass` returned null for `reward_configs` and `reward_decisions` |
| — | Effect on existing tables | Only nullable `ADD COLUMN`s (`communities.reward_intake_paused_at`, `epochs.reward_config_id`) and an FK on the empty `epochs`; the Sep 17 bot selects its own column lists |

Target: Neon project in eu-central-1, database `neondb` (pooler endpoint).

## Apply

From `packages/db` on `main` `99f7596`, with `DATABASE_URL` read from the repo `.env`:

```
pnpm exec drizzle-kit migrate
```

Started 2026-09-23T22:42:49Z; `migrations applied successfully!`, exit 0. The driver's SSL-mode deprecation warning was printed but changed nothing. One earlier attempt failed while Node was loading, before any connection, because it invoked the pnpm shell shim directly. Nothing ran on that attempt.

## Verified afterwards (read-only, 22:43:01Z)

- Journal: 6 rows. The new hash prefixes `3da1313df14f`, `36b86c46cc5a` and `62a762ae2a58` match the sha256 of the 0003, 0004 and 0005 files.
- Tables: `reward_config_proposals`, `reward_configs`, `reward_decisions`, `reward_dispatches`, `reward_intakes`, `reward_nominations`, `reward_retrievals`, `reward_slots`.
- `reward_decisions.notified_at`: `timestamp with time zone`, nullable.
- Existing data unchanged: 0 epochs, 1 community, 3 contributions, 6 scoring runs (as in the 2026-09-17 build log).
- `https://hyphae-api.fly.dev/health` → `{"ok":true}`, HTTP 200.

## Not done

No bootstrap (Hyphae Lab has no reward epochs, so `/submit` stays on the legacy path even once new code is deployed). No deploy: Fly still runs the Sep 17 image. No model calls and no payments.

## Cutover (separate, not authorized here)

Deploy `main`, bootstrap the MYCEL reward configuration and first epoch, add `/effort` to the BotFather menu (and remove `/propose` and `/rubric` until they exist), and confirm the worker log shows a `reward-recovery` line about every 5 minutes.
