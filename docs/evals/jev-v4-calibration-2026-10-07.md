# Jev question set v4: calibration (2026-10-07)

Question set `v4-2026-10-07` ([questions and composition](jev-questions-v4.md)) on Jev `jev-1.13.0`, rubric `mycel-1.2.0` (epoch 2's rubric), three runs per reply. Session A (Claude Opus 5.5), evening of 2026-10-07. Nothing here is deployed: the production scorer is unchanged.

## Result

| Set | Replies | Runs | Right | Wrong | Cost (USD) |
|---|---|---|---|---|---|
| Reward cases (`docs/rubrics/eval/reward-eval-cases.json`) | 28 | 84 | 84 | 0 | 0.0173 |
| Holdout 3, tune half | 32 (29 judged) | 87 | 84 | 3 (one reply) | 0.0194 |
| Holdout 3, report half | 32 (31 judged) | 93 | 87 | 6 (two replies) | 0.0194 |

- Cisco's own replies R1 to R3 and the sincere replies P1 to P5 pass in 3 of 3 runs, credited 74 to 95. Every zero case in the reward set scores 0 in every run, including all eight injection cases.
- About USD 0.0002 per scored reply (Claude Sonnet 5.5 at medium effort cost about USD 0.0088 per reply on the same 28 cases).
- Answers are stable: across the 64 holdout replies, no reply changed between pass and zero from one run to the next.

## Confusion matrix, all 64 holdout replies (runs)

Labels are Cisco's, after the reconciliation below; replies he marked unsure are not judged.

| | scored pass | scored zero |
|---|---|---|
| **labeled pass** (36 replies, 108 runs) | 102 | 6 |
| **labeled zero** (24 replies, 72 runs) | 3 | 69 |

## The holdout

64 new replies under four posts (two real raid posts, two written for the holdout), written by the agent to cover normal crypto-social engagement: organic opinions, banter, jokes, questions, improvements, restatements of the post in polished or AI wording, gm/gg/lfg, hype, price and buy shills, other-project plugs, an airdrop ask, injections, and replies in Portuguese, Spanish, Indonesian, French and Vietnamese. Cisco labeled all 64 blind (pass, zero or unsure) in four batches before seeing any score or the agent's own labels. The split into a tune half and a report half was fixed before he labeled, stratified by post. File: [jev-holdout-3.json](jev-holdout-3.json), with his blind label, the reconciled label and the split on every reply.

**Reconciliation.** After labeling, nine of his passes contradicted his own written rules or the published rubric, so he ruled on them before any tuning (the [rulings](jev-questions-v4.md#rulings-cisco-2026-10-07-during-labeling)): three injections, two price or buy shills (zero under the pinned rubric's "never" list), and four empty slogans or polished restatements of the post. All nine are zero. With his blind labels, those nine would count as nine more misses.

## Tuning (tune half and the reward cases only)

| Attempt | Change | Reward cases | Tune half wrong | Kept |
|---|---|---|---|---|
| 0 | v4 as drafted (one earlier change: `promotes_other` no longer reads a member pitching the post's own project as a plug) | 84/84 | 2 replies (1, 40) | yes |
| 1 | New `polished` question; a polished restatement of the post zeroes with `restates_post`. `generic` says a greeting turned into a joke about the post is not generic | 84/84 | 1 reply (40) | yes |
| 2 | `generic` reframed as "would it make the same sense under an unrelated post" | 84/84 | 1 reply (40, worse: 0.94) | no, reverted |
| 3 | `generic` lists asking for an airdrop, free tokens, a whitelist spot or a follow (Cisco's reason on reply 3: "we dont mention airdrop") | 84/84 | 1 reply (40) | yes |
| 4 | `addresses_grader` says that saying what a score or receipt should show, or how scores should be given, is talking about scoring, not directing the scorer | 84/84 | 1 reply (40) | yes |

Attempt 3 was prompted by a report-half reply (3), so that reply is not a clean holdout result any more. The clean report-half measurement, before any tuning, had three replies wrong: 3, 20 and 26. After all attempts it has two: 20 and 26. Attempt 4 came from four good tune-half replies about scoring (41, 45, 52, 62) whose `addresses_grader` sat at 0.31 to 0.42, close to the 0.5 that zeroes; it now sits at 0.10 to 0.32, while the readable injections stay at 0.95 to 0.99 (the two hidden in Unicode or control characters sit at 0.57 to 0.66 and are also zeroed as spam).

## What is still wrong, and the recommendation

1. **Jokes built on a cheer are zeroed (replies 20 and 40, labeled pass).** "gm (sorry, couldn't resist)" under a post about gm spam, and "grind mode activated, coffee number 4" under a "Grind mode" post. `generic` reads them at 0.76 and above. Two wordings did not move them under 0.5. **Recommendation:** accept for now. It is the cheaper error: a false zero costs one member one reply's points, and a public admin correction can restore them. Reopen with real epoch 2 replies, not more wording against these two.
2. **Reply 26 is labeled zero and scores 74.** "every correction visible is the part i didn't expect. most projects hide that". It is related, organic and short, which Cisco's rule ("a reply related to the project that feels organic earns a nice score") passes. **Recommendation:** keep v4's pass unless Cisco's reason for zero is a rule v4 should learn.
3. **`addresses_grader` sets no flag.** None of the six production flags means "spoke to the scorer", so an injection is zeroed through the raw score and the reasoning names the gate, while `creditReason` shows "below the 60 floor". The production path should show the reasoning; a later rubric version can add a flag.
4. **Not measured yet:** posts on other subjects, a second labeler, and real traffic. Jev reads text only: it cannot see images, links or a quoted post other than the raid post, so a quote with no raid post is judged against the community only.

**Cisco's decision (2026-10-07, about 20:50Z):** release Jev with these known misses, as recommended.

## Files

- Questions and composition: [jev-questions-v4.md](jev-questions-v4.md), code `apps/api/src/scoring/jev-questions.ts` and `jev.ts`.
- Holdout and labels: [jev-holdout-3.json](jev-holdout-3.json).
- Every answer of the final runs (attempt 4), and the baseline on all 64 with v4 as drafted (attempt 0): [runs/2026-10-07-v4/](runs/2026-10-07-v4/).
- Reproduce (from `apps/api`, with `TYPESAFE_API_KEY` set): `node --import tsx scripts/eval-reward-jev.ts --cases ../../docs/evals/jev-holdout-3.json --rubric ../../docs/rubrics/mycel-1.2.0.json --questions v4-2026-10-07 --runs 3`.
