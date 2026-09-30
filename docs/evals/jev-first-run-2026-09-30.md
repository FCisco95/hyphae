# Jev vs Sonnet, first live run (2026-09-30)

16 synthetic cases (`docs/rubrics/eval/mycel-synthetic.json`), both rubrics, both scorers. No real member text was sent to any provider. **This is 16 cases: it supports no claim that either scorer is better, only where each one disagrees with the founder.**

## Provenance

| | Jev | Sonnet |
|---|---|---|
| Model | `jev-1.13.0`, question set `v1-2026-09-30` (`docs/evals/jev-questions.md`) | `anthropic:claude-sonnet-5` (the harness default), production scoring prompt |
| Rubrics | 1.2.0 (`docs/rubrics/mycel-1.2.0.json`), 1.3.1 (`feat/rules-v2` `158452f`, sha256 `56e5fad1…`) | same |
| Mode | live, `current-call` metrics; every answer recorded in `docs/evals/recordings/jev-<version>.json` and replays to the same 4/16 and 5/16 with no key | live |
| Code | `feat/jev-eval` `f7a3919` (Jev runs, Sonnet 1.2.0) and `58fa5d4` (Sonnet 1.3.1) | |
| Credit rule | production `creditedScore` plus the eval-only `low_effort` zero (Cisco's ruling 1), the same for both scorers | |
| Raw results | `docs/evals/recordings/{jev,sonnet}-{1.2.0,1.3.1}.jsonl` | |

Sonnet's first 1.3.1 attempt crashed on case 12: its reply broke the production output schema (an `aiSlop.patterns` string over 60 characters), so the harness aborted with 5 cases unscored. That is a finding about Sonnet as the production scorer, and it is why `58fa5d4` makes a throwing case fail alone. The rerun completed 16 of 16 with no error; the two runs are not the same output. The crashed attempt's partial output is not kept. Its 12 calls are not in the cost table (about $0.19 at the rerun's average per call).

## Totals

| Run | Passed | Mean error, raw | Mean error, credited | Median latency | Max latency | Cost |
|---|---|---|---|---|---|---|
| Jev 1.2.0 | 4/16 | 17.3 | 8.4 | 248 ms | 344 ms | $0.0028 (66.0k input tokens) |
| Jev 1.3.1 | 5/16 | 17.6 | 3.2 | 266 ms | 375 ms | $0.0031 (73.8k input tokens) |
| Sonnet 1.2.0 | 3/16 | 18.7 | 11.8 | 6.6 s | 9.1 s | $0.215 |
| Sonnet 1.3.1 | 2/16 | 18.7 | 12.2 | 5.7 s | 9.7 s | $0.249 |

Error is the distance in points from the founder's target, 0 inside it. A pass needs both scores inside the founder's ±5 range and every required flag with no forbidden one. Sonnet's records carry cost and latency but no token counts.

## Rubric 1.3.1, per case (raw/credited; founder target in brackets)

| # | Case | Founder | Jev | Sonnet |
|---|---|---|---|---|
| 1 | receipt-specific-praise | 70/70, ai_slop | 87/87, no flags ✗ | 78/78, no flags ✗ |
| 2 | receipt-specific-criticism | 90/90 | 88/88 ✓ | 82/82 ✗ |
| 3 | popularity-no-quality-bonus | 35/0, low_effort | 11/0 ✗ (raw) | 4/0 ✗ (raw) |
| 4 | holder-with-product-reason | 75/75 | 80/80 ✓ | 68/68 ✗ |
| 5 | holder-only | 0/0, low_effort | 17/0 ✗ (raw) | 10/0 ✗ (raw) |
| 6 | grounded-uncertain-price | 85/85 | 89/89 ✓ | 72/72 ✗ |
| 7 | unsupported-price-with-hedge | 50/0, guideline_breach | 19/0 ✗ (raw) | 0/0 ✗ (raw) |
| 8 | buy-guaranteed-gains | 0/0, guideline_breach | 38/0 ✗ (raw) | 0/0 ✓ |
| 9 | honest-reward-disclosure | 90/90 | 79/79 ✗ | 84/84 ✗ |
| 10 | question-already-answered | 10/0, low_effort | 30/0 ✗ (raw) | 22/0 ✗ (raw) |
| 11 | project-name-wrong-topic | 50/0, off_topic | 17/0 ✗ (raw) | 10/0 ✗ (raw) |
| 12 | polished-strong-original-control | 75-80 | 67/67 ✗ | 58/0 ✗ |
| 13 | multiple-ai-writing-signals | 70/0, ai_slop, low_effort | 10/0 ✗ (raw) | 18/0 ✗ (raw) |
| 14 | single-ai-word-false-positive-control | 75/75 | 71/71 ✓ | 33/0 ✗ |
| 15 | image-context-limitation | 75/75 | 74/74 ✓ | 72/72 ✓ |
| 16 | code-only-spam | 0/0, spam | 6/0 ✗ (raw) | 0/0 ✗ (missing spam) |

## Findings

1. **Ruling 5 did not work.** Case 1's first sentence is built backwards, and Jev did not flag it: `ai_slop` P(yes) 0.09, `own_voice` 0.86, quality 3.31 of 4. Sonnet missed it too. An instruction alone does not teach Jev this pattern. It is a syntactic shape, so a deterministic check is the natural next experiment, with Jev left for judgment.
2. **Ruling 4 exposes a raw-score problem on flagged cases.** On the eight flagged cases (3, 5, 7, 8, 10, 11, 13, 16) Jev's credited score is right (0), but its raw lands outside the founder's ±5 range by 1 to 55 points, in both directions: too low on 3, 7, 11 and 13 (the criteria questions punish the same faults the flag already does), too high on 5, 8, 10 and 16 (the founder gives 0 or 10; Jev gives partial credit to a reply it has just flagged). Under "check both" all eight fail on raw. Sonnet misses raw on the same cases except 8 and 16. This is the defect Ruling 4 says to fix, and it is a question-design change, not a threshold change.
3. **Ruling 3 (no cap) did not bite.** Case 2 composed to 88 and case 9 to 79; neither reached 100. Case 9 is the real miss: 11 points under the founder's 90 for an honest reward disclosure.
4. **Rubric sensitivity.** Under 1.2.0 Jev flags case 6 as a `guideline_breach` (credited 0), as that rubric's text says a price forecast is; under 1.3.1 it does not (credited 89). The fixture's targets are written for 1.3.1. Sonnet flagged neither.
5. **Flag disagreements, 1.3.1.** Jev raised `spam` on case 16 (required); Sonnet did not. Jev raised `link_mismatch` on case 11; Sonnet did not, and no case requires it either way. All other flags agree, including four `low_effort` calls on cases 7, 8, 11 and 16 that the fixture does not require.
6. **False positives on the controls.** Jev raised no `ai_slop` on cases 12 or 14 in either rubric. Sonnet flagged both under 1.2.0 (credited 0) and, under 1.3.1, credited both as 0 with no flag (58 and 33 fall under the 60 floor).
7. **Speed and cost.** Jev answered in about a quarter of a second per case against about six seconds for Sonnet, at roughly 1/80th of the recorded cost.

## Not established

- Whether Jev generalises: the questions were written and amended while reading these 16 cases' notes, Sonnet's prompt was not.
- Any 1.2.0 vs 1.3.1 effect beyond case 6; the differences elsewhere are single-run noise until repeated.
- Run-to-run variance: Sonnet's two 1.3.1 attempts differ (the first crashed). Jev was run once per rubric.

## Recommended next steps

1. Fix the double count: rewrite the three criteria questions to judge the writing as a person would before any flag, so raw stays near the founder's raw on flagged cases. Then replay is impossible (the questions change), so it needs one live run at about $0.003.
2. Add a deterministic backwards-sentence check for Ruling 5, and measure it on new cases, not these 16.
3. Ask Cisco for 30 or more real, labelled AI-sounding and natural replies (a private fixture) before tuning anything else against these 16.
