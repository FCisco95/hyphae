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

`founderGrade` is 0–5 for display. The raw and credited ranges are explicit, inclusive 0–100 ranges; the harness does not infer them from the founder grade. Credited scores use production hard-zero rules, AI caps, and the floor, before timing decay. Both ranges and every specified flag assertion must pass. Omitted flag lists default to empty.

From the repository root, validate all fixtures without credentials or model calls:

```sh
pnpm --filter @hyphae/api eval:scoring --cases ../../docs/rubrics/eval/mycel.json --rubric ../../docs/rubrics/mycel-1.2.0.json --dry-run
```

Once the labelled `mycel.json` exists, run the evaluation (uses API credits):

```sh
pnpm --filter @hyphae/api exec node --env-file=../../.env --import tsx scripts/eval-scoring.ts --cases ../../docs/rubrics/eval/mycel.json --rubric ../../docs/rubrics/mycel-1.2.0.json
```

On PowerShell use `pnpm.cmd` if execution policy blocks `pnpm.ps1`. Paths are relative to `apps/api`, where the filtered command runs. `--model provider:model` overrides `SCORING_MODEL`; otherwise the existing Sonnet default is used.

Stdout is one JSON record per case: expected labels, raw/credited scores, failures, and the complete scoring run (input, output/reasoning/flags, model, rubric version, prompt hash, evidence hash, latency, cost). Stderr ends with passed/total and cost in micro-dollars. Exit status is nonzero for any mismatch, invalid fixture, or provider error. Provider errors stop the run; preceding case records remain available. Redirect stdout to a local `.jsonl` file to compare a baseline and candidate. Results are gitignored because they contain the full input text; deliberately review any real examples before committing them to this public repository.

No real labelled dataset is included yet. The previous session's Organic_Bonk example has a founder grade of 4/5 and an observed raw score of 38, but the full target and reply text still need to be supplied. Do not reconstruct them from the abbreviated handoff.

## Synthetic review set

`mycel-synthetic-review.json` contains assistant-authored policy cases for founder review. It is intentionally **not** a harness fixture: every numeric founder label and range is `null`, and the file records its source as synthetic. Its qualitative flag expectations come from the locked policy direction, not from observed model behavior.

Before a paid run, review each case, fill the founder grade, reason, raw range, and credited range, then copy only the approved cases into a harness-compatible JSON array. Keep real founder-labelled contributions in a separate private fixture until their text is cleared for this public repository. Never combine the Masterblox screenshot pairs with this synthetic set or infer grades for them from their original/rewrite relationship.
