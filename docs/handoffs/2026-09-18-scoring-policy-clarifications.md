# Scoring policy checkpoint — 2026-09-18

## TL;DR

Six supplied coaching screenshots were reviewed and 12 qualitative examples captured locally. Founder clarified that grounded price speculation and truthful personal holding statements are allowed. Candidate `docs/rubrics/mycel-1.3.0.json` records both rulings; no live evaluation or community update occurred.

## Current State and Next Actions

Use `docs/HANDOFF.md` as canonical state. Full target posts, numeric grades, the disputed reply text, and project context remain missing. Do not infer that every original is bad or every rewrite is 4/5. Several originals received positive feedback. The private source reference under `docs/plans/` is gitignored and will not sync through git.

The candidate retains the distinction between a personal holding statement and an instruction for someone else to buy or hold. Price figures alone do not trigger a breach; unsupported hype and guaranteed gains do. Evaluate the candidate with labelled examples before applying it live.

## Validation

Core schema/score tests and lint passed after the price change. Full harness checks from earlier in the session passed (75 tests plus typecheck). These are software checks, not proof of model grading quality.

## Suggested Skills

`handoff-memory`, `superpowers:test-driven-development` for code changes, `humanizer:humanizer` for planned writing-signal calibration, `handoff`.

## Generated Artifacts This Session

Candidate rubric: `docs/rubrics/mycel-1.3.0.json`. Private selected reference and notes: `docs/plans/masterblox-calibration-reference.json` and `docs/plans/masterblox-calibration-notes.md` (gitignored). No credentials, paid model calls, external resources, or deployments.

## Next-session Prompt

```text
Resume from docs/HANDOFF.md. The evaluation harness is ready, screenshot feedback has been reviewed, and candidate rubric 1.3.0 allows grounded price speculation and truthful personal holder statements. Do not apply obsolete source-coaching restrictions.
Files: docs/HANDOFF.md, docs/rubrics/mycel-1.3.0.json, docs/rubrics/eval/README.md
Model: Codex Opus 5 (high) — interpret qualitative feedback against founder policy.
Skills: handoff-memory, superpowers:test-driven-development, humanizer:humanizer, handoff.
Obtain the missing full target posts and labels, then evaluate the candidate before applying it live.
```
