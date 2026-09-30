# Scoring evaluation

Compare the production `runScoring` runner against fixed, founder-labelled replies before changing the prompt or publishing another rubric. The harness does not write to the database or send Telegram messages.

Store cases as a JSON array. Each case needs a unique `id`, the full target post (`task`, when applicable), the full `contribution`, and `expected` labels. Grade each example before looking at the model output. Include on-theme replies, generic hype, guideline breaches, and known AI-written samples. Keep a few examples out of prompt development for a final check.

This is an illustrative format example, **not a founder-labelled calibration case**:

```json
[
  {
    "id": "example-only",
    "task": {
      "targetUrl": "https://x.com/example/status/123",
      "targetText": "We published the fee split and transaction receipts today.",
      "targetAuthor": "example",
      "brief": "React in your own words."
    },
    "contribution": {
      "kind": "reply",
      "text": "Can we check each payout against those receipts?"
    },
    "expected": {
      "founderGrade": 4,
      "reason": "A specific question about verifying the payouts.",
      "raw": [80, 90],
      "credited": [80, 90],
      "requiredFlags": [],
      "forbiddenFlags": ["off_topic", "guideline_breach"]
    }
  }
]
```

`founderGrade` is 0–5 for display and optional. `target`, also optional, holds the founder's own raw and credited scores as ranges (`[t, t]` for a single score); when present, each record reports `error`, the absolute distance from that target (0 inside a range). The raw and credited ranges are explicit, inclusive 0–100 ranges; the harness does not infer them from the founder grade. Credited scores use production hard-zero rules, AI caps, and the floor, before timing decay. Both ranges and every specified flag assertion must pass. Omitted flag lists default to empty.

From the repository root, validate all fixtures without credentials or model calls:

```sh
pnpm --filter @hyphae/api eval:scoring --cases ../../docs/rubrics/eval/mycel.json --rubric ../../docs/rubrics/mycel-1.2.0.json --dry-run
```

Once the labelled `mycel.json` exists, run the evaluation (uses API credits):

```sh
pnpm --filter @hyphae/api exec node --env-file=../../.env --import tsx scripts/eval-scoring.ts --cases ../../docs/rubrics/eval/mycel.json --rubric ../../docs/rubrics/mycel-1.2.0.json
```

On PowerShell use `pnpm.cmd` if execution policy blocks `pnpm.ps1`. Paths are relative to `apps/api`, where the filtered command runs. `--model provider:model` overrides `SCORING_MODEL`; otherwise the existing Sonnet default is used.

Stdout is one JSON record per case: expected labels, raw/credited scores, failures, and the complete scoring run (input, output/reasoning/flags, model, rubric version, prompt hash, evidence hash, latency, cost). Stderr ends with passed/total and cost in micro-dollars. Exit status is nonzero for any mismatch, invalid fixture, or provider error. Provider errors stop the run; preceding case records remain available. Redirect stdout to a local `.jsonl` file to compare a baseline and candidate. Results are gitignored because they contain the full input text; deliberately review any real examples before committing them to this repository.

No real labelled dataset is included yet. The previous session's Organic_Bonk example has a founder grade of 4/5 and an observed raw score of 38, but the full target and reply text still need to be supplied. Do not reconstruct them from the abbreviated handoff.

## Synthetic review set

`mycel-synthetic-review.json` holds 16 assistant-authored policy cases with the founder's target scores and reasons. It stays byte-for-byte as reviewed (SHA-256 `1b851fa0…6afd936`), as provenance; its top-level `status` and `founderScalePolicy` predate the review.

`mycel-synthetic.json` is the runnable fixture made from it by `apps/api/scripts/founder-grades.ts` (then Biome's formatter), under the founder's range rule of 2026-09-28:

- Raw and credited scores each land within the founder target ±5, clamped to 0–100.
- The credited target is the production credit rule (hard zeros, AI caps, the 60 floor) applied to the founder's raw target and the case's required flags. The expected AI signals stand in for `aiSlop.patterns`, so three or more take the strong cap.
- A credited score is either 0 or at least 60, so a credited target of 0 is exact: every hard-zero and below-floor case must credit exactly 0.
- Case 12 (`synthetic-polished-strong-original-control`) keeps the founder's own 75–80, raw and credited.

A test keeps the fixture equal to the generator's output. Keep real founder-labelled contributions in a separate private fixture until their text is cleared for this repository, and never combine the Masterblox screenshot pairs with this synthetic set.

## Jev backend

`--backend jev` scores each case with TypeSafe's Jev instead of the Sonnet scorer. It is offline only: production scoring never calls it, and it writes nothing.

- The model is pinned to `jev-1.13.0`; an answer from any other model is refused.
- The questions come from `apps/api/src/scoring/jev-questions.ts`. The default is set `v3-2026-09-30`, written out in `docs/evals/jev-questions.md` (a test holds the code to that document, word for word): agent-drafted, then ruled on and amended by Cisco on 2026-09-30. `--questions <id>` picks another set. The recordings in `docs/evals/recordings/jev-*.json` were made under v1 at commit `4fe3815`. Later sets changed the `ai_slop`, `low_effort`, `context_fit` and `value_angle` questions and the quality ladder, so the recordings replay only at that commit; a replay against the current set is refused. The eval's credited score also zeroes `low_effort` (Cisco's ruling 1); production's credit rule does not yet.
- Jev answers yes/no probabilities and one quality level. `apps/api/src/scoring/jev.ts` composes them to 0–100 (half the quality level, half the rubric's weighted criteria) and sets each flag at P(yes) ≥ 0.5; the harness then applies the production credit rule plus the eval-only `low_effort` zero.
- Cost is $0.042 per million input tokens (output tokens are free), reported per case in micro-dollars.
- `--questions`, `--record`, and `--recorded` require `--backend jev` and a nonempty value. `--record` and `--recorded` are mutually exclusive; invalid combinations stop before any provider call.
- Every Jev result records the rubric version, composition version, criterion weights, quality/criteria weights, yes-threshold, and quality maximum. `configurationHash` fingerprints the full rubric and that composition; `requestHash` separately fingerprints the model input.
- A case whose scorer throws (a reply that breaks the output schema, a missing recording) prints a `runError` line with the full message and its causes, counts as failed and as `errored`, and the remaining cases still run. Its cost is unknown, so the stderr summary's `costMicroUsd` excludes it and says so.
- `mode` is `live` or `replay`. In replay mode, `metricsSource` is `recorded-call`: latency, usage, per-case cost and the stderr cost total describe the original calls, not new API spending. Live results use `current-call`.

```sh
# Check the cases and the question set: no key, no call.
pnpm --filter @hyphae/api eval:scoring --backend jev --cases ../../docs/rubrics/eval/mycel-synthetic.json --rubric ../../docs/rubrics/mycel-1.2.0.json --dry-run
# Live, with TYPESAFE_API_KEY in .env, keeping every answer for replay.
pnpm --filter @hyphae/api exec node --env-file=../../.env --import tsx scripts/eval-scoring.ts --backend jev --cases ../../docs/rubrics/eval/mycel-synthetic.json --rubric ../../docs/rubrics/mycel-1.2.0.json --record jev-1.2.0.json
# Replay that recording with no key and no network.
pnpm --filter @hyphae/api eval:scoring --backend jev --cases ../../docs/rubrics/eval/mycel-synthetic.json --rubric ../../docs/rubrics/mycel-1.2.0.json --recorded jev-1.2.0.json
```

A recording keeps each answer under the hash of its exact request (model, state and questions), so a replay refuses changed model inputs. Rubric weights and composition settings are applied locally: they may change without another API call, and the result's configuration fingerprint and recorded settings make that change visible.
