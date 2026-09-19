# Scoring evaluation checkpoint — 2026-09-18

## TL;DR

The evaluation harness is implemented locally; calibration awaits the founder's full target/reply examples, grades, and project description. The existing prompt and rubric are unchanged. No paid calls or external writes were made.

## Verified State

- 75 tests pass; workspace typecheck passes.
- CLI dry run validates the documented example without credentials.
- Raw/credited ranges and flag assertions are compared using production credit rules.
- Full run evidence is emitted per case. No real dataset has been created.
- Work remains uncommitted because `.git` is read-only in the session sandbox.

## Next Actions

Collect labels, run the baseline, evaluate the planned prompt changes, then publish rubric 1.3.0 when supported by the results. See `docs/HANDOFF.md` for the execution queue and `docs/rubrics/eval/README.md` for usage.

## Suggested Skills

`handoff-memory`, `superpowers:test-driven-development`, `humanizer:humanizer`, `context7-mcp` if library calls change, `handoff`.

## Generated Artifacts This Session

Evaluation CLI and test in `apps/api/scripts/`; evaluation validation/comparison and tests in `apps/api/src/scoring/`; fixture guide in `docs/rubrics/eval/README.md`; canonical handoff in `docs/HANDOFF.md`. No credentials or external resources created.

## Next-session Prompt

```text
Resume from docs/HANDOFF.md. The evaluation harness is ready, but founder labels and project context are missing. Collect those inputs and run a baseline before tuning the scorer.
Files: docs/HANDOFF.md, docs/rubrics/eval/README.md, apps/api/scripts/eval-scoring.ts
Model: Codex Opus 5 (high) — judge prompt quality against human labels.
Skills: handoff-memory, superpowers:test-driven-development, humanizer:humanizer, handoff.
```
