---
date: 2026-09-30
summary: Cisco ruled on the Jev question set's five open questions and the first live Jev vs Sonnet run happened. feat/jev-eval is at 4fe3815, pushed and unmerged. Jev passed 4/16 (rubric 1.2.0) and 5/16 (1.3.1), Sonnet 3/16 and 2/16. No superiority claim from 16 cases. Ruling 5's tell did not fire. Nothing merged, deployed or written to production.
---

# Jev eval run, 2026-09-30

Record of the arc's step 2. Part A and step 1 are in [Part A](2026-09-30-part-a.md) and the BUILDLOG.

## Rulings (Cisco, in session)

1. `low_effort` is a hard zero. Applied in the eval only (`compareScore`); `creditedScore` in `packages/core` is unchanged. Also asked for: a no-AI pre-filter for bare gm or emoji-only replies, and an admin tag on ritual (greeting) posts with a small fixed credit. Both are rubric-level design items for a later version.
2. Keep the rubric weights (0.35, 0.30, 0.35) and the 50/50 quality/criteria split for the first run.
3. No cap on a perfect reply.
4. Check both raw and credited on every case. A raw miss on a flagged case is a question defect to fix.
5. The AI tell is a sentence built backwards (thing first, then the speaker's verb).

## What ran

- `feat/jev-eval` `f7a3919` (ruled question set v1, eval-only low_effort zero), `58fa5d4` (a throwing case fails alone), `0a33384` (the report and recordings), `4fe3815` (review fixes). Pushed.
- Live, 16 synthetic cases only: Jev `jev-1.13.0` and Sonnet `anthropic:claude-sonnet-5`, rubrics 1.2.0 and 1.3.1 (1.3.1 read from `feat/rules-v2` `158452f`, sha256 `56e5fad1…`). Jev recordings replay to the same results with no key.
- Results, findings and provenance: `docs/evals/jev-first-run-2026-09-30.md` on `feat/jev-eval`.

## Checks

- Fake and replay tests first (red, then green); a leak guard proves no question quotes a fixture reply, including replies under five words.
- Full local gate on `4fe3815`: 106 + 79 + 612 API tests (1 skipped), typecheck 0, Biome clean, drizzle check 0. Across three full-suite runs on this branch, two failed on `settlement.test.ts` "gives up on a slow chain by the deadline…", the known flake that `fix/timing-budgets` fixes (unmerged; `main`'s API is frozen until C7); the third passed and the final run on `4fe3815` passed. No DB or reward code changed, so `test:pg` was not rerun.
- Review: Codex `gpt-6.1-sol`, reasoning high, read-only, fresh session, range `7c00629..0a33384`: four findings (three P2, one P3), all fixed test-first in `4fe3815`. No re-review of the fixes.
- Spend: Jev about $0.006; Sonnet $0.464 recorded plus about $0.19 for one crashed attempt whose calls were not recorded.

## Labeling sessions and question set v2

Cisco labeled 48 replies I wrote (session 1 tuned; session 2 was the holdout; the files and answer keys are local and gitignored under `docs/plans/`). He amended ruling 5: the backwards shape alone is not the tell. `feat/jev-eval` `9f822f2` and `7b8c605` carry question set v2 with that wording. On the holdout it cleared one false flag (0.69 to 0.19), lowered another reply already under the threshold (0.44 to 0.16) and kept his AI calls flagged (one fell from 0.80 to 0.58); it still flags the reply he could not explain and still misses fixture case 1. A second construct showed up: replies he marked "?" for overshilling or repeating the post, which is `low_effort`/`value_angle` territory, not AI authorship. Jev's `low_effort` flags several replies he called human, and ruling 1 makes that a hard zero. Review: Codex `gpt-6.1-sol` high, two findings (an overstated "stopped flagging" and a stale title), both fixed in `7b8c605`. The v1 recordings replay only at `4fe3815`.

## Parked, with recommendations

- Rewrite the criteria questions so raw scores on flagged cases stop being double-counted, then one live run (about $0.003). Recommend: yes.
- A deterministic backwards-sentence check, measured on new cases. Recommend: only as a feature for a trained classifier; a plain regex fires on the same replies Jev does, including the ones Cisco called human.
- A third, larger holdout and a second labeler before any further wording change. Recommend: yes.
- Real labelled replies (private fixture) instead of ones I wrote. Recommend: yes when available; my own writing carries my blind spots.
- Ritual posts and the production low_effort zero: rubric version after 1.3.1.

## Models

Runner Claude Code Sonnet 5.5, effort high; reviewer Codex `gpt-6.1-sol`, high. No helpers.
