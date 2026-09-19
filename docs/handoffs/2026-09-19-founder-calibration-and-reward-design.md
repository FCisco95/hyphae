# Founder calibration and high-effort reward design checkpoint

## TL;DR

The founder scored all 16 synthetic evaluation cases. The repo now has durable target scores, reasons, and policy flags, but 15 cases still need explicit harness ranges. A high-effort contribution design is partly approved: seven-day epochs, one evaluated high-effort submission per member per epoch, a configurable 3× points multiplier, and a two-epoch configuration cooldown. Architectural brainstorming paused before approval of AI-based high-effort eligibility. No live model calls, production code, database writes, rubric publication, or deployment occurred.

## Founder calibration results

Case order and target raw score:

1. Specific receipt praise: 70; relevant but the staged "is the bit I care about" structure feels AI-written.
2. Specific constructive criticism: 90; genuine, organic product interest.
3. Popularity/LFG reply: 35; blind shilling and low effort.
4. Holder statement plus product reason: 75; natural and relevant, modest added value.
5. "I hold MYCEL" alone: 0; permitted but adds nothing.
6. Grounded uncertain valuation: 85; natural reasoning and uncertainty.
7. "$1 easy, NFA": 50 raw; NFA adds slight caution but does not ground the prediction; credited zero.
8. "Buy now, guaranteed 10x": founder verdict -100, normalized to 0; hard breach.
9. Honest reward disclosure plus mechanism explanation: 90; knowledgeable and clear.
10. Question already answered in target: 10; permitted but adds nothing.
11. MYCEL AI-agent comment under score-page post: 50 raw; unclear relation, off-topic hard zero.
12. Polished audit-trail paraphrase: accepted range 75–80; normal and acceptable, not automatically AI-written.
13. Promotional AI-vocabulary cluster: 70 raw; coherent but over-complimentary and non-organic; AI cap applies.
14. Specific reply containing only one AI-associated word: 75; organic, no AI flag.
15. Plausible image-specific reply: 75; requires media context for confident grading.
16. Code-only text: 0; spam.

Canonical data: `docs/rubrics/eval/mycel-synthetic-review.json`. Private conversational notes: `docs/plans/mycel-founder-calibration.md`.

## Calibration rules learned

- Correct reward eligibility/tier matters more than matching an exact score. A formal range-conversion rule is still required before harness execution.
- Below 60 receives no points. Hard flags apply before any effort multiplier.
- A strong ordinary reply can reach 90. The founder initially reserved 100 for extra-mile work; whether that ceiling remains after effort is separated from quality is unresolved.
- Useful criticism can score as highly as praise.
- Truthful holder or reward disclosures are not penalties. They still need substance.
- "NFA" may modestly improve raw caution but never grounds an unsupported price target by itself.
- Do not infer ownership or AI authorship from tone alone. Use supplied evidence and multiple textual signals.
- Images must eventually be included in scorer input. Until then, disclose missing visual evidence and avoid unsupported off-topic hard zeros.

## Approved high-effort design direction

- Preserve contributions → points → epoch treasury rewards.
- Quality score remains 0–100; effort changes points, not the underlying quality judgment.
- Seven-day epochs.
- One evaluated high-effort submission per member per epoch to prevent spam and repeated scoring spend.
- Qualifying examples: substantial original post, thread, article, real product/protocol test, or video.
- High-effort points multiplier: 3× after credited quality clears the 60 floor and hard-zero gates.
- Multiplier, limit, and epoch duration are public community configuration and should be included in the epoch's auditable configuration/hash.
- Active epoch configuration is immutable. Changes activate at an epoch boundary and then have a two-epoch cooldown. Feedback can change later versions, never active or historical epochs.

## Unresolved design gate

The founder invoked handoff before answering this proposal:

> The AI returns quality plus a separate `highEffortEligible` decision with textual evidence. Code applies 3× only when score is at least 60 and eligibility passes. Admin corrections remain append-only and public. Failed URL/media retrieval does not consume the weekly slot; a completed evaluation does.

Resume by approving, rejecting, or revising that eligibility mechanism. Then decide whether ordinary replies remain capped at 90 now that effort has its own multiplier. Architectural brainstorming is incomplete; do not implement yet.

## Validation and safety

- `docs/rubrics/eval/mycel-synthetic-review.json` parses: 16 cases, 16 scored, zero unreviewed.
- Previous checks: 75 tests passed, typecheck passed, and lint checked 66 files with no fixes.
- No paid provider calls, DB changes, external outreach, deployment, or live rubric changes.
- Platform/legal eligibility remains separate from local scoring and reward design.

## Next actions

1. Finish high-effort eligibility and ordinary-reply ceiling decisions through `superpowers:brainstorming`.
2. Present the complete architecture in sections, obtain founder approval, write the design spec, self-review it, and request final review.
3. Invoke `superpowers:writing-plans` only after design approval; use TDD for implementation.
4. Separately define numeric acceptance ranges from the founder scores, obtain complete real examples, and run 1.2.0 versus 1.3.0 calibration.

## Suggested skills

`handoff-memory`, `superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:test-driven-development`, `humanizer:humanizer`, `handoff`.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Founder-scored synthetic review set | `docs/rubrics/eval/mycel-synthetic-review.json` | 16/16 scored; most harness ranges pending |
| Private calibration notes | `docs/plans/mycel-founder-calibration.md` | Voice, policy, media, and score judgments; gitignored |
| Canonical handoff refresh | `docs/HANDOFF.md` | Current resume source |
| Design checkpoint | `docs/handoffs/2026-09-19-founder-calibration-and-reward-design.md` | This snapshot |

No credentials, external resources, scheduled jobs, or deployed artifacts were created.

## Next-session prompt

```text
Continue Hyphae founder calibration and high-effort reward design from docs/HANDOFF.md. Preserve all uncommitted work. All 16 synthetic cases have founder target scores, but most still need harness ranges; no live model comparison, reward implementation, or rubric publication has happened.

Files: docs/HANDOFF.md, docs/rubrics/eval/mycel-synthetic-review.json, docs/plans/mycel-founder-calibration.md, docs/rubrics/eval/README.md, docs/rubrics/mycel-1.2.0.json, docs/rubrics/mycel-1.3.0.json, packages/core/src/score.ts, packages/core/src/settle.ts
Model: Codex Opus 5 (high) — scoring calibration and reward architecture require judgment.
Skills: handoff-memory, superpowers:brainstorming, superpowers:writing-plans, superpowers:test-driven-development, humanizer:humanizer, handoff.

Resume with the unanswered high-effort eligibility question: should AI decide `highEffortEligible` with public evidence and append-only admin correction? Preserve approved design: seven-day epochs, one high-effort submission per member per epoch, configurable 3× multiplier, next-epoch activation, two-epoch config cooldown, and points → epoch treasury rewards. Finish and approve the architecture before implementation. Separately convert founder scores into explicit reward-band ranges and run the documented calibration without inventing real evidence.
```
