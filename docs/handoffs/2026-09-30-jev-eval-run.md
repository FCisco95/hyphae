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

## Cisco's own replies and rulings 6 to 9

Cisco supplied screenshots of 11 of his own replies (local, gitignored transcription). Jev never passed 0.17 `ai_slop` on any, but `low_effort` or `off_topic` zeroed seven of the twelve scored items (jokes, banter, a link to his Hyphae article whose quoted text Jev could not see). His rulings: jokes and short opinions are not low effort (6); the scorer needs a maintained, published and pinned project brief (7); answering with the project's own material is good engagement, so intake must pass quoted-post text and image descriptions (8); an organic reaction earns the low end, about 60 to 70 raw, of the same scale, with no flat participation credit (9). `feat/jev-eval` `6246763` carries v3 (rulings 6 and 9 in the questions). A scratch experiment with a draft project brief removed false `link_mismatch` flags and raised substantive replies a few points; worked examples in the state raised banter raws 3 to 10 points, with the flags unchanged and banter still under the floor. Nothing was sent to a provider beyond these and the synthetic sets, with Cisco's yes for the real replies. Review: Codex `gpt-6.1-sol` high, two further rounds, five findings in all across the day's later commits (overstated "stopped flagging", stale titles, "no regression" overclaim, README replay text), all fixed. Next: Cisco approves the brief, grades his replies and more, then a calibration is fit and tested on a holdout.

## Parked, with recommendations

- Rewrite the criteria questions so raw scores on flagged cases stop being double-counted, then one live run (about $0.003). Recommend: yes.
- A deterministic backwards-sentence check, measured on new cases. Recommend: only as a feature for a trained classifier; a plain regex fires on the same replies Jev does, including the ones Cisco called human.
- A third, larger holdout and a second labeler before any further wording change. Recommend: yes.
- A calibration from Jev's answers to Cisco's grades (a few hundred, including jokes and short opinions), tested on a holdout. Recommend: yes; prompt text and examples did not deliver ruling 9.
- A project brief (ruling 7): Cisco approves its content; then decide whether it is part of the rubric version or a separately pinned document. Recommend: pin it per epoch and publish it.
- Intake (ruling 8): pass quoted-post text and a description of any image with each submission. Recommend: yes; it alone took his article reply from 11 to 60.
- Real labelled replies (private fixture) instead of ones I wrote. Recommend: yes when available; my own writing carries my blind spots.
- Ritual posts and the production low_effort zero: rubric version after 1.3.1.

## Models

Runner Claude Code Sonnet 5.5, effort high; reviewer Codex `gpt-6.1-sol`, high. No helpers.
