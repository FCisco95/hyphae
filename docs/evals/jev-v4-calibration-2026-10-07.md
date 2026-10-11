# Jev question set v4: calibration (2026-10-07)

Question set `v4-2026-10-07` ([questions and composition](jev-questions-v4.md)) on Jev `jev-1.13.0`, rubric `mycel-1.2.0` (epoch 2's rubric), three runs per reply. Historical experiment from October 7. These results do not imply that a live epoch selects this scorer.

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

**Reconciliation.** After labeling, nine of his passes contradicted his own written rules or the published rubric, so he ruled on them before any tuning (the documented gate policy): three injections, two price or buy shills (zero under the pinned rubric's "never" list), and four empty slogans or polished restatements of the post. All nine are zero. With his blind labels, those nine would count as nine more misses.


## Known misses and limits

Two replies labeled pass were consistently zeroed: a gm joke under a gm-spam post and a coffee/grind joke under a grind-mode post. One reply labeled zero (about visible corrections) scored 74. The model's addresses_grader gate has no dedicated production flag; it records its reason but may show the below-floor credit reason.

Nine initial labels were reconciled against the written rules before tuning. One report-half example later influenced wording, so the final report-half measurement is partly contaminated: the clean baseline had three misses; the final report had two. This small, synthetic, founder-labeled set is not an independent or general calibration result. Other subjects, another labeler, media and real traffic are not established here.

[Question set](jev-questions-v4.md), [fixed holdout fixture](jev-holdout-3.json), [evaluation source](../../apps/api/scripts/eval-reward-jev.ts). Raw experiment recordings and owner recommendations are private.
