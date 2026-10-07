---
date: 2026-10-07
summary: Snapshot at 20:54Z. The Jev live scorer release is assembled on local branch jev-live and accepted by Codex; nothing is pushed or deployed. Live is haiku55-328fb45 (Claude Haiku 5.5). Waiting for Cisco's exact yes.
---

# Jev live release merged and accepted (snapshot, 2026-10-07 20:54Z)

Written by Claude Opus 5.5, Session A. Where this differs from [HANDOFF.md](../HANDOFF.md), the handoff wins.

## What exists

- **Branch `jev-live`** (worktree `hyphae-jev-reward`, local only), head `1185ad1` plus these records. It is `ed32b4f` + the session prompts + Session B's production path (`99bc61a` to `82e21e9`) + `feat/jev-eval` + question set v4 and its calibration + the registry entry `reward-jev/1` and receipt wording (`2473c62`) + the security page (`3942112`) + five review fixes (`9f1da15`, `f581a27`, `fe48d72`, `1185ad1`) + merges of `origin/main` (`e4a204c`) and `feat/haiku-55` (`00ce8f4`).
- **Calibration:** [report](../evals/jev-v4-calibration-2026-10-07.md). Cisco accepted the three known misses.
- **Review:** [record](../reviews/2026-10-07-jev-live.md). Codex gpt-6-astra xhigh: NEEDS-FIXES (2 medium), fix check (2 gaps), re-review on the Haiku base (1 medium), final fix check ACCEPT.
- **Plan:** [release plan](../demo/2026-10-07-jev-live-release-plan.md), with Cisco's approved reason, announcement and site line, the live image `haiku55-328fb45` as rollback target, and Step 0.0 to put `main` on `jev-live`.

## Verified

- Gate on `a4c5063`: tests (core 119, read-client 26, web 123, API 1035, 3 skipped), typecheck, lint, drizzle check, all 0. Final gate on `1185ad1`: tests (API 1037, web 123, core 119, read-client 26), typecheck, lint, drizzle check all 0; `test:pg` 74 of 74 (also 74 of 74 in a clean worktree on `2473c62`, `f581a27` and `1185ad1`).
- Live through the production client (`jev-client.ts`) and `reward-jev/1`: 28 reward cases right, the holdout with only the accepted misses, 0 errors, slowest call 607 ms, every request hash equal to the committed one.

## Not done

- Nothing pushed, nothing deployed, no secret set, no amendment recorded.
- Five private-journey and raid-alert Postgres tests fail when the machine is under heavy load (three runs while Codex ran test suites); they pass otherwise. Not touched by this release.

## Next

Cisco's exact yes, then the plan from Step 0.0, one live effect at a time, before 2026-10-08T12:00Z.
