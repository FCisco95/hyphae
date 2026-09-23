# Weekly video #2 — script (Fri 2026-09-25)

Built from recorded evidence only. Each beat is labelled **historical** (happened and was recorded at the time, not re-run), **locally tested** (a passing test on a named commit, not running anywhere) or **planned** (scoped, not built). Nothing is shown as live usage unless it happened in Hyphae Lab and is in the build log.

Target length: about 3 minutes. Record the terminal and the Hyphae Lab Telegram group. No staged data is presented as usage.

## Before recording

1. `git switch main && git pull --ff-only`.
2. Run `pnpm -r test` once, then write down the commit SHA and test counts on screen. Say the counts from that run, not the ones in this script.
3. Open these in tabs:
   - the Hyphae Lab thread from 2026-09-17 with the founder's test reply
   - `docs/rubrics/CHANGELOG.md`
   - `apps/api/src/rewards/config.test.ts`
   - `apps/api/src/rewards/intake.test.ts`

## Beat 1 — the bot said no to its founder (historical, 2026-09-17) · ~40 s

**Show:** the Telegram reply to "I post this to test the scoring bot": raw 3, credited 0, flag `off_topic`, with the reasoning.

**Say:** "On day one, I tested the bot with my own reply. It scored raw 3, credited zero, off-topic. That's the rubric working: it pays for engaging with the post, and a meta-joke that earns credit today is one every member sends tomorrow. The raw score and the reasoning stay on record, so you can see exactly why."

**Numbers you can say (build log, 2026-09-17):** 3 contributions, 6 scoring runs, credited 85, 0 and 0, 5 to 11 seconds per score, $0.084 total scoring spend.

## Beat 2 — re-grades sit beside the originals (historical, 2026-09-17) · ~35 s

**Show:** `docs/rubrics/CHANGELOG.md`, entries 1.0.0 → 1.1.0 → 1.2.0.

**Say:** "I disagreed with two grades that evening, so the rubric changed twice: 1.1.0 scoped the price-talk ban to a specific coin, and 1.2.0 gave on-theme takes credit. Each re-grade was a new row next to the old one. Nothing was overwritten, and all three versions are public."

**Don't claim:** that 1.3.0 is live. It's a candidate, not applied.

## Beat 3 — rules can't move under an open week (locally tested) · ~35 s

**Show:** `config.test.ts`, the tests `accepted in E11 with last activation E11 → E13` and `accepted in E12 with last activation E11 → E13`, passing.

**Say:** "Each weekly epoch pins its rubric, its timing and the exact prompt, by hash. A rubric change activates two epochs later at the earliest: activate in epoch 11, and the next change lands in 13. An admin can't rewrite the rules of a week people are already working in."

**Label on screen:** "Locally tested on `<sha>`, not deployed."

## Beat 4 — exactly at close means next week (locally tested) · ~30 s

**Show:** `intake.test.ts`, the test `assigns the half-open epoch: closesAt - 1 ms is this epoch, closesAt is the next`, passing.

**Say:** "Work is accepted under a database lock, with the time read from the database clock. One millisecond before close counts this week. Exactly at close counts next week. 'Counted' means accepted before the close, whenever the model answers."

## Beat 5 — what this week added, and what comes next (locally tested → planned) · ~40 s

**Show:** `evaluation.test.ts`, the test `an upgrade reuses quality: 85 becomes revision 2 at 255, never 85 + 255`. Then the status table in `docs/WHITEPAPER.md`.

**Say:** "This week added effort slots. Each member nominates one piece of work a week for 3×. Upgrading work that was already scored reuses its quality, so 85 becomes 255, not 85 plus 255. And every paid model call is written down before it's made: if the provider times out, Hyphae never pays twice on its own. That's merged and tested, not deployed. Next come epoch-scoped `/me`, a frozen snapshot at each close, and a public audit page where every score shows its reasoning and rubric version. After that, the on-chain root and claim."

**Label on screen:** "Merged, locally tested, not deployed" for R3. "Planned" for everything after.

## Do not say

- That testers were paid or that points are money.
- Any tester count, submission count or score not in the build log, or not read from the database on recording day with the date said out loud.
- That anything built after 2026-09-17 (R1 onward) runs in the group today.
