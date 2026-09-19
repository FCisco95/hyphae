## Mac transfer checkpoint — 2026-09-19

Resume branch: `sync/mac-handoff-2026-09-19`. This is a preservation checkpoint, not a release or merge approval.

Checkpoint preserves the offline scoring-evaluation harness, candidate rubric 1.3.0 and local calibration documentation. This is not a production rubric promotion or paid scoring run. Private docs/plans remain outside this public repo and are preserved in the private cisco-brain vault under Organic/research/hyphae-private-handoff-2026-09-19.

Read the latest transfer report in cisco-brain `docs/orca/MAC-RESUME-2026-09-19.md` for the final commit and validation results. Current session evidence takes precedence over older clean/unpushed claims below.

This run: 75 offline tests, workspace typecheck and Biome lint passed. No paid model calls or live changes.

### Suggested skills

`handoff-memory`; the repo's existing task-specific verification skills; `handoff` at session end.

### Next-session prompt

```text
Resume this repo on sync/mac-handoff-2026-09-19. Read docs/HANDOFF.md, inspect Git status and compare HEAD with the Mac transfer report in cisco-brain. Preserve local Mac work. Continue only the documented next task after checking its remaining gates.
```

### Generated artifacts

This handoff overlay and docs/handoffs/2026-09-19-mac-transfer.md. No credentials or deployed resources generated.

---

# Hyphae engineering handoff

## TL;DR

Founder calibration is complete for all 16 synthetic policy cases. Exact target scores/reasons/flags are saved in `docs/rubrics/eval/mycel-synthetic-review.json`; one case has an explicit 75–80 range, while the other exact scores still need conversion into harness acceptance ranges based on reward bands. A new high-effort reward design is partially approved: seven-day epochs, one high-effort submission per member per epoch, a configurable 3× multiplier, and a two-epoch configuration cooldown. AI eligibility is proposed but not yet approved. No paid calls, code changes to scoring/rewards, database writes, rubric publication, or deployment happened. Prior tracked HEAD: `454843f`.

## Metadata

- Last Updated: 2026-09-19
- Scope: repo (`hyphae`)
- Status: all synthetic cases founder-scored; acceptance ranges, real examples, and the unfinished high-effort eligibility design remain before paid comparison or implementation.

## Current Objective

Convert the founder's 16 synthetic target scores into reward-band acceptance ranges, obtain complete real cases, and compare rubric 1.2.0 against 1.3.0 before changing the prompt or publishing 1.3.0. Separately finish the architectural design for high-effort contribution eligibility before any reward code change. The disputed Organic_Bonk 4/5 example still lacks full target/reply text.

Founder steering 2026-09-19: preserve community coordination, contribution points, and epoch-based treasury sharing as the product's core. Do not replace it with an unrelated task-bounty product. Delayed pool allocation is the intended reward mechanism; it must not be described as having no economic incentive merely because contributors receive points first.

## Current State

The founder supplied six Masterblox coaching screenshots. They establish qualitative guidance but do not include full target posts or numeric grades; some originals are explicitly praised, so original/revamped does not imply bad/good. Selected reference material is local and gitignored under `docs/plans/`, not included in this public handoff. Founder also clarified that grounded price speculation is allowed; only unsupported hype/guarantees remain prohibited, alongside the existing direct buy/hold ban. Candidate `docs/rubrics/mycel-1.3.0.json` implements that price distinction; the database has not been updated.

The synthetic review set covers praise/criticism parity, engagement metrics, holder statements, grounded versus unsupported price claims, direct buy/guarantee language, reward disclosure, answered questions, wrong-topic project name-dropping, AI-writing true/false-positive controls, image-only context limits, and code-only spam. The founder scored all 16 cases through a question-by-question review. Target scores, reasoning, and flag expectations are durable; most exact scores still need mechanical range conversion before the harness can accept them. Private working notes are in `docs/plans/mycel-founder-calibration.md`.

Founder scores in case order: 70, 90, 35, 75, 0, 85, 50, 0 (`-100` founder verdict normalized to schema minimum), 90, 10, 50, 75–80, 70, 75, 75, 0. The founder cares primarily whether output lands in the correct reward eligibility/tier rather than matching an exact number. Do not invent the final bands without making the conversion rule explicit.

New founder product requirement: scoring must eventually include attached pictures because media often carries essential context. Until then, the scorer must disclose missing visual evidence and must not hard-zero a plausible image-specific reply solely because oEmbed supplied only text.

Approved high-effort reward direction: quality score and effort points are separate; the same quality score earns more points for a substantial thread, article, real test, video, or original contribution post. Use seven-day epochs, one evaluated high-effort submission per member per epoch, and a configurable 3× multiplier applied only after the contribution clears the 60 floor and hard-zero gates. Active epoch settings are immutable; changes activate on a future epoch boundary and then have a two-epoch cooldown. Continue using contribution points → epoch treasury allocation. Do not implement yet: architectural brainstorming stopped before the founder answered whether AI should decide `highEffortEligible` with public reasoning and append-only admin correction.

## Recent Changes

- `apps/api/scripts/eval-scoring.ts` calls the existing `runScoring` directly, without DB or Telegram dependencies. `--dry-run` validates inputs without credentials. JSON lines preserve full runs and comparisons; stderr summarizes pass count and cost; mismatches exit nonzero.
- `apps/api/src/scoring/eval.ts` validates unique cases, score ranges, and flag assertions; compares raw and production credited scores before timing decay.
- `docs/rubrics/eval/README.md` documents fixture format and commands. Its example is illustrative, not a founder label. There is no real dataset yet.
- `docs/rubrics/eval/mycel-synthetic-review.json` now contains founder target scores and reasons for all 16 assistant-authored cases; 15 still await final numeric ranges and fixture conversion.
- `docs/plans/mycel-founder-calibration.md` records the question-by-question judgments, scale principles, media requirement, and credited-score implications.
- The founder set the ordinary-reply ceiling around 90 and initially reserved 100 for extra-mile work. Later, effort was separated from quality through a 3× points multiplier. Whether ordinary replies remain capped at 90 after that separation is unresolved and should be made explicit during design.
- Earlier verification: 75 tests pass (32 core, 43 API); workspace typecheck passes; CLI dry run works without provider credentials. Latest documentation/data change passes `pnpm.cmd lint` (66 files).
- Changes are uncommitted. `.git` is read-only in this session. Git read commands needed command-scoped `-c safe.directory=<repo>` due to sandbox ownership; no global setting changed.
- Live service/database status was not checked in this session. The previous build log records rubric 1.2.0 as live.

## Known Issues / Watch List

2026-09-19 policy research uncovered a separate reward-eligibility issue: [X paid-partnership rules](https://help.x.com/en/rules-and-policies/paid-partnerships-policy) exclude crypto in the EU, and [X authenticity rules](https://help.x.com/en/rules-and-policies/authenticity) prohibit compensated metric inflation, including replies. Truthful holder disclosure and well-supported opinions do not establish eligibility for paid raids. Candidate 1.3.0 is a quality-policy draft, not compliance clearance. Recommendation: review campaign eligibility with X and Portuguese/EU counsel before activating rewarded campaigns. No service settings were changed. Full preliminary research is local in `docs/plans/x-rewards-policy-research-2026-09-19.md` (gitignored).

Additional founder ruling: truthful holder disclosures and personal holding decisions are permitted; the source coaching's restriction on claiming holder status does not apply to actual Hyphae holders. Candidate 1.3.0 explicitly distinguishes "I hold MYCEL" / "I am still holding" from directing another person to buy or hold. Apply the founder's current rules over imported coaching restrictions.

The synthetic cases now have founder-approved target scores, but they are not real contributions and most do not yet have harness ranges. Neither the private screenshot rewrites nor illustrative documentation are numeric labels. Candidate rubric 1.3.0 still needs live evaluation. The private screenshot and founder-calibration notes are gitignored and will not sync via Git.

## Validation

Earlier harness verification: `pnpm.cmd test` passed 75 tests and `pnpm.cmd typecheck` passed. Latest calibration check parsed all 16 cases, confirmed 16 scored and zero unreviewed. The previous `pnpm.cmd lint` checked 66 files with no fixes. No live model behavior has been validated.

## Next Actions

Founder approved the contribution-quality direction on 2026-09-19. Candidate rubric 1.3.0 now gives useful explanations, relevant questions, and substantiated criticism the same opportunity as praise; excludes quality bonuses for engagement metrics or bullish sentiment; and addresses independent authorship and honest reward disclosure. Points → epoch allocation is preserved. Synthetic qualitative evaluation scenarios are in `docs/rubrics/eval/policy-scenarios.md`. These are prompt/rubric instructions, not verified model behavior or new deterministic enforcement. Platform eligibility remains unresolved.

Keep campaign eligibility as a separate unresolved review before activating rewarded campaigns; it does not block local scoring calibration. No redesign, shutdown, or external outreach was authorized or performed.

1. Resume the high-effort design at the unanswered question: approve or revise AI `highEffortEligible` classification with public reasoning and append-only admin correction. Then decide whether the ordinary-reply ceiling remains 90 now that effort has a separate multiplier.
2. Finish the architectural design, write the required design spec, get founder approval, and only then create an implementation plan. Do not implement reward changes during brainstorming.
3. Convert founder target scores into explicit harness ranges using a documented reward-band rule. Keep raw quality separate from credited hard-zero/floor behavior.
4. Obtain the complete Organic_Bonk target/reply and a small balanced real set. Confirm whether `README.md` plus locked direction is sufficient project context. Do not ask again for the six screenshots already captured locally.
5. Dry-run separate synthetic and private-real fixtures, then run identical paid 1.2.0 and 1.3.0 calls. Report raw/credited scores, flags, reasoning, hashes, latency, and cost.
6. Use TDD for prompt changes revealed by the comparison, including project context, media evidence, code-only spam, and structured AI-writing signals. Keep platform/legal eligibility separate.

## Quick Reference

- Evaluation format/commands: `docs/rubrics/eval/README.md`
- Founder-scored synthetic cases awaiting range conversion: `docs/rubrics/eval/mycel-synthetic-review.json`
- Private founder review notes: `docs/plans/mycel-founder-calibration.md`
- Current rubric: `docs/rubrics/mycel-1.2.0.json`
- Prompt and credit rules: `packages/core/src/score.ts`
- Checks: `pnpm.cmd test`, `pnpm.cmd typecheck`, `pnpm.cmd lint` on Windows; `pnpm` elsewhere.
- Use `pnpm.cmd` when PowerShell execution policy blocks `pnpm.ps1`. In this environment, `pnpm exec` could not resolve package binaries; package scripts work. Direct Biome fallback: `node node_modules/@biomejs/biome/bin/biome check .`.
- Public progress: `docs/BUILDLOG.md`. Private design/plan locations remain in `CLAUDE.md`; no private strategy copied here.

## Resume Checklist

- Check git status and preserve local changes.
- Confirm the range-conversion rule before creating a runnable fixture.
- Resume the unfinished high-effort eligibility question before writing a reward design spec.
- Use the documented dry run before spending model credits.

## Suggested Skills

`handoff-memory` for resume; `superpowers:brainstorming` to finish the high-effort design; `superpowers:writing-plans` only after the written design is approved; `superpowers:test-driven-development` for implementation; `humanizer:humanizer` for AI-writing signals; `handoff` at session end.

## Generated Artifacts This Session

| What | Where it lives | Notes |
|---|---|---|
| Evaluation harness and tests | `apps/api/scripts/eval-scoring.ts`, `apps/api/scripts/eval-scoring.test.ts`, `apps/api/src/scoring/eval.ts`, `apps/api/src/scoring/eval.test.ts` | Local, not deployed |
| Synthetic policy review set | `docs/rubrics/eval/mycel-synthetic-review.json` | 16/16 founder-scored; 15 need harness ranges before execution |
| Private founder calibration notes | `docs/plans/mycel-founder-calibration.md` | All 16 judgments plus scale/media decisions; gitignored and machine-local |
| High-effort reward design checkpoint | `docs/handoffs/2026-09-19-founder-calibration-and-reward-design.md` | Approved decisions and unresolved eligibility gate |
| Fixture guide | `docs/rubrics/eval/README.md` | No founder-labelled dataset yet |
| Price-policy candidate | `docs/rubrics/mycel-1.3.0.json` | Grounded speculation allowed; not applied live |
| Private coaching reference | `docs/plans/masterblox-calibration-reference.json`, `docs/plans/masterblox-calibration-notes.md` | 12 selected examples from six screenshots; gitignored, not portable via git |
| Portable handoff | `docs/HANDOFF.md`, `docs/handoffs/2026-09-18-scoring-eval-harness.md` | Public-safe engineering state |

No credentials, external resources, or scheduled jobs created.

## Resume Prompt

```text
Continue Hyphae founder calibration and high-effort reward design from docs/HANDOFF.md. Preserve all uncommitted work. All 16 synthetic cases have founder target scores, but most still need harness ranges; no live model comparison, reward implementation, or rubric publication has happened.

Files: docs/HANDOFF.md, docs/rubrics/eval/mycel-synthetic-review.json, docs/plans/mycel-founder-calibration.md, docs/rubrics/eval/README.md, docs/rubrics/mycel-1.2.0.json, docs/rubrics/mycel-1.3.0.json, packages/core/src/score.ts, packages/core/src/settle.ts
Model: Codex Opus 5 (high) — scoring calibration requires judgment against human labels.
Skills: handoff-memory, superpowers:brainstorming, superpowers:writing-plans, superpowers:test-driven-development, humanizer:humanizer, handoff.

Resume with the unanswered high-effort eligibility question: should AI decide `highEffortEligible` with public evidence and append-only admin correction? Preserve approved design: seven-day epochs, one high-effort submission per member per epoch, configurable 3× multiplier, next-epoch activation, two-epoch config cooldown, and points → epoch treasury rewards. Finish and approve the architecture before implementation. Separately convert founder scores into explicit reward-band ranges and run the documented calibration without inventing real evidence.
```
