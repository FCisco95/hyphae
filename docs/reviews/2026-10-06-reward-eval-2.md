---
date: 2026-10-06
summary: Independent Codex review of the reward-eval/2 scoring prompt (ba0e12b): core and open-epoch integrity clean, two script findings fixed test-first in 6b2a4e3.
---

# Review: reward-eval/2 (`ba0e12b`)

Reviewer: Codex `gpt-6-astra`, reasoning effort xhigh, read-only, ephemeral session, other model family than the builder (Claude Sonnet 5.5). Asked for real defects only: open-epoch integrity (does anything change how `reward-eval/1` renders or hashes, or how epoch 2's pinned config is evaluated; shared inputs outside the template hash; callers of `buildRewardConfigPayload`), rule creep and hard-zero bypass in the v2 wording, test quality, the new eval script, and the committed case set.

## Verdict on the first pass: NEEDS-FIXES (script only)

- **Core, clean:** `reward-eval/1` keeps the exact pinned hash; all 60 comparisons across the three prompt purposes rendered identically to `ba0e12b^`; the shared flag definitions, rubric and rendering inputs are unchanged; config callers keep existing pins and the proposal cooldown. No new injection path or hard-zero bypass: "at least 62" only affects the raw score, and returned hard-zero flags, AI caps and the floor still apply in `creditedScore` (3,030 credit-equivalence checks passed, 44 tests passed, API typecheck passed). No database write, Telegram send, key logging or secret in the script or case set.
- **Should-fix:** `scripts/eval-reward-prompt.ts` left provider and parse errors out of the miss count and exited 0 after failed expectations (40 failed calls reported `misses 0`).
- **Advisory:** `--runs oops` or `--runs 0` skipped every case and printed a zero-miss summary.

## Disposition

Both fixed test-first in `6b2a4e3`: new pure helpers in `src/scoring/reward-cases.ts` (`judge`, `parseRuns`, `exitCode`) with 13 tests (red, then green); the script now counts errors and exits 1 on any miss or error, and refuses a run count that is not a positive whole number. Gate on `6b2a4e3`: `pnpm test` 0 (core 110, read-client 26, web 107, API 822 passed / 3 skipped), `pnpm typecheck` 0, `pnpm lint` 0. The fix commit was not re-reviewed by Codex; it touches only the eval script and its helpers, not the prompt, scoring or reward code.
