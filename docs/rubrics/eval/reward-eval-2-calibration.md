# reward-eval/2 calibration (2026-10-06)

**Why.** Epoch 2's first real tester reply (a sincere answer to the post's own question, "What would make a community reward system feel fair to you?") scored raw 58 and earned 0, because the scorer called it "a general crypto take" that did not engage "the AI scoring, the public rubric, or the epoch mechanic". Rubric 1.2.0 already says a genuine take on the post's theme earns most of `context_fit`. The scorer was stricter than the published rubric, and a founder post that described the project was zeroed as `off_topic`. Prompt `reward-eval/2` tells the model how to apply the rubric. It adds and removes no rule: guidelines, flags, hard zeros, AI caps and the 60 floor are unchanged and still enforced by code (`creditedScore`).

**What changed in the prompt.** A calibration block: an own-words reaction that relates to the post or the project (opinion, joke, question, banter) earns at least 62, and 72-90 with a concrete detail, an angle or a comparison; describing or promoting the project the raid is about is on-topic, and `off_topic` and `spam` are for clearly unrelated plugs and verbatim copies; lines that fit under any post ("lfg", "gm", "nice"), copy-paste and empty text stay below 50. It also asks for `rubricHits` notes under 150 characters, because notes over the schema's 200-character limit made version 1 fail to parse (3 failures in 60 calls here).

**Method.** `pnpm --filter @hyphae/api eval:reward-prompt --cases ../../docs/rubrics/eval/reward-eval-cases.json --rubric ../../docs/rubrics/mycel-1.2.0.json --runs 3` runs the real production model (`anthropic:claude-sonnet-5`) through the real reward prompt renderer and credit rules. 20 cases, 3 runs each, both versions, 120 calls, USD 1.52. `pass` means credited 60 or more; `zero` means credited 0.

**Credited score per run (60 or more pays):**

| Case | v1 | v2 |
|---|---|---|
| R1 real reply (dev joke, Oct 5) | 0, 66, 60 | 68, 68, 72 |
| R2 real quote (describes own product) | 80, 0, 0 | 68, 65, 0 |
| R3 real reply (the 58 in the screenshot) | 0, error, error | 74, 78, 74 |
| P1-P5 sincere replies (opinion, joke, project mention, critique, short) | all 60+ in 15 of 15 runs | all 60+ in 15 of 15 runs |
| G1-G8 and A1, A4, A5 (gm, lfg, generic hype, AI slop, buy/10x, other coin, "nice", off-topic, project hype, other-project plug, price shill) | 0 in every run | 0 in every run |
| A2 polished abstract praise | 0 | 0 (one parse error) |

**Reading it.** Version 2 turns the founder's three real contributions from 3 of 9 credited runs (and 2 errors) into 8 of 9, with the guards unchanged: every spam, breach, AI-slop, price and other-project case still earns 0 in every run that returned an answer. The remaining miss is R2, a quote that is mostly a pitch for the founder's own product: the model sometimes flags `spam`. In a separate 4-run pass on the same wording R2 scored 68 in four of four runs and R1 failed once (raw 58, `low_effort`); one run of model noise either way is normal, and the admin correction exists for it.

**Limits, said plainly.** The case set is small and written by the same author as the prompt, and R1 to R3 were used to tune the wording, so it can overfit: it is a regression guard, not proof of calibration. A holdout labelled by the founder and by a second person comes before any further loosening. The floor (60) is unchanged. Epoch 2 stays pinned to `reward-eval/1`.
