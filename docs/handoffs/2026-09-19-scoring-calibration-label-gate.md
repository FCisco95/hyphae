# Hyphae scoring calibration label gate

## TL;DR

The evaluation harness and candidate MYCEL rubric 1.3.0 remain local and unshipped. A 16-case synthetic policy review set now exists at `docs/rubrics/eval/mycel-synthetic-review.json`, but it deliberately has no numeric founder labels and is not accepted by the paid-run harness. No model credits, database writes, or deployments occurred. Next: obtain founder grades/ranges and complete real examples, then run identical 1.2.0 versus 1.3.0 comparisons.

## Current state

- The synthetic set covers praise/criticism parity, engagement metrics, holder language, grounded and unsupported price claims, buy/guarantee language, reward disclosure, answered questions, project-name context mistakes, AI-writing controls, missing image context, and code-only spam.
- Every case identifies itself as synthetic, records qualitative policy expectations, and leaves founder grade/reason/raw/credited fields null.
- The private Masterblox files still contain 12 qualitative examples without complete targets or numeric grades. Do not infer labels from original/revamped order.
- Candidate `docs/rubrics/mycel-1.3.0.json` is not live and has not been tested through a provider.
- Public README text describes Hyphae generally, but a founder-approved MYCEL/Hyphae prompt description is still needed or the founder must explicitly approve the README as sufficient context.

## Inputs needed

1. Founder review of approved synthetic cases: grade 0-5, short reason, raw range, credited range, and any correction to required/forbidden flags.
2. Full target and contribution text for the known Organic_Bonk 4/5 case, plus acceptable ranges and flags.
3. A small balanced real set with full target/contribution text and founder labels. Include high quality, low effort, a breach, criticism, and an AI-writing control if available.
4. Confirmation that `README.md` is sufficient project context, or a canonical MYCEL/Hyphae description.

## Validation

- Parsed `docs/rubrics/eval/mycel-synthetic-review.json`: 16 cases, 16 unreviewed.
- `pnpm.cmd lint`: passed; 66 files checked, no fixes.
- Earlier harness verification remains: 75 tests passed and workspace typecheck passed.
- No live scoring behavior has been validated.

## Next actions

1. Fill the missing founder labels without changing the synthetic/real provenance markers.
2. Create separate runnable fixtures for approved synthetic and private real cases; reserve a holdout.
3. Dry-run fixture validation.
4. Run rubric 1.2.0 and 1.3.0 with the same cases and model; compare score, credited score, flags, reasoning, hashes, latency, and cost.
5. Use TDD for prompt changes revealed by the comparison. Apply Humanizer patterns as structured, evidence-based signals; do not infer authorship from one word, punctuation, polished structure, or a reward disclosure.

## Suggested skills

`handoff-memory`, `superpowers:test-driven-development`, `humanizer:humanizer`, `handoff`.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Synthetic policy review set | `docs/rubrics/eval/mycel-synthetic-review.json` | 16 assistant-authored cases; numeric founder labels remain null |
| Review-set documentation | `docs/rubrics/eval/README.md` | Explains provenance and conversion boundary |
| Canonical handoff refresh | `docs/HANDOFF.md` | Records the founder-label gate |
| Session snapshot | `docs/handoffs/2026-09-19-scoring-calibration-label-gate.md` | This file |

No credentials, external resources, scheduled jobs, or deployed artifacts were created.

## Next-session prompt

```text
Continue Hyphae scoring calibration from docs/HANDOFF.md. Preserve all uncommitted work. The harness and candidate rubric 1.3.0 exist, and 16 synthetic review cases await founder numeric labels; no live model comparison or rubric publication has happened.

Files: docs/HANDOFF.md, docs/rubrics/eval/mycel-synthetic-review.json, docs/rubrics/eval/README.md, docs/rubrics/mycel-1.2.0.json, docs/rubrics/mycel-1.3.0.json, apps/api/scripts/eval-scoring.ts, packages/core/src/score.ts
Model: Codex Opus 5 (high) — scoring calibration requires judgment against human labels.
Skills: handoff-memory, superpowers:test-driven-development, humanizer:humanizer, handoff.

Collect founder labels for the synthetic review set and complete real target/reply examples, keeping synthetic policy cases separate from founder-labelled real evidence. Convert only approved cases into fixtures, dry-run them, then compare 1.2.0 and 1.3.0 with identical paid model calls. Do not invent grades, ranges, target text, image content, or authorship evidence; keep platform eligibility separate from scoring calibration.
```
