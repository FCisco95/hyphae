# Rubric changelog

Every rubric a Hyphae community scores against is public here. A community's `rubric_version` points at one of these files; the epoch commits its hash on-chain.

## Scoring prompt reward-eval/2 — 2026-10-06 (not a rubric version)

- The rubric is unchanged (MYCEL 1.2.0 stays the pinned rubric). Only the instructions that tell the scorer how to apply it changed, after the scorer graded a sincere on-theme reply 58 ("a general crypto take") although 1.2.0 says a genuine take on the theme earns most of `context_fit`.
- An own-words reaction that relates to the post or the project (opinion, joke, question, banter) earns at least 62, and 72-90 with a concrete detail, an angle or a comparison. Describing or promoting the project the raid is about is on-topic; `off_topic` and `spam` are for unrelated plugs and verbatim copies. Lines that fit under any post, copy-paste and empty text stay below 50.
- Guidelines, flags, hard zeros (guideline_breach, spam, off_topic), AI caps (79 and 40) and the 60 floor are unchanged and enforced in code. `reward-eval/1` stays byte-for-byte (its template hash is a test); an epoch is judged by the version it pinned, so epoch 2 keeps version 1. A configuration proposed after the deploy pins version 2 and takes effect at the cooldown boundary (epoch 3). Evidence: [eval/reward-eval-2-calibration.md](eval/reward-eval-2-calibration.md).

## MYCEL 1.3.0 — 2026-09-18 (candidate, not applied)

- Founder ruling: price discussion and speculation are allowed when supported by a concrete basis. A price, market-cap figure, or target is not automatically a guideline breach. The forecast must be framed as uncertain and connected to the supplied evidence; a token hedge such as "could" does not substitute for reasoning.
- Unsupported hype such as "we are going up to 100M easy", guarantees, promised gains, and direct buy/hold instructions remain hard-zero breaches. The basis may come from the target post; every short reply need not repeat a full analysis or include a separate citation.
- This replaces the blanket price-direction/target ban in 1.2.0. Prior versions and their scoring history remain intact. Weights, timing, credit caps, and floor are unchanged.
- Founder ruling: truthful holder disclosures and first-person holding decisions are allowed ("I hold MYCEL", "I am still holding"). They are distinct from instructing another person to buy or hold. Ownership alone does not earn a high quality score or excuse unsupported price hype.
- Founder-approved direction, 2026-09-19: preserve contributions → points → epoch allocation. Score substantive participation independently of sentiment; substantiated criticism, useful questions, and explanations have the same opportunity as praise. Mere posting, repetition, popularity, and engagement counts earn no quality bonus.
- `context_fit` now distinguishes actual engagement from project name-dropping; `value_angle` explicitly includes constructive criticism. Honest reward disclosures do not themselves reduce writing quality. The candidate asks for independent authorship and transparency without pretending that the scorer can verify ownership or hidden payments from text.
- Status: candidate file and schema validation only. No live model evaluation, community rubric update, or deployment yet. Other planned scoring-calibration changes remain pending.

## MYCEL 1.2.0 — 2026-09-17 (evening)

- `context_fit` opened: naming something concrete from the post earns full marks, a genuine take on the post's theme or question earns most of it, reusable hype that fits any post earns none. Founder ruling: an on-theme reply the model graded "could sit under any project's post" is a 4/5 engagement under the Masterblox rules the guidelines come from.
- "What earns zero" narrowed the same way: reusable hype, not any reply that does not quote the post.
- Weights, timing, caps, floor and the 1.1.0 coin scoping unchanged.

## MYCEL 1.1.0 — 2026-09-17 (evening)

- The "never" list is scoped to a specific coin: MYCEL, any named coin, or the coin of the post being replied to. Telling people to buy or hold it, price direction or targets for it, promised gains or claimed returns on it: hard zero, unchanged.
- General market talk is opinion, not a breach: "holding usually beats trading", "long-term doesn't have to mean years". Founder ruling after the first live test graded such a line as a breach.
- Criteria, weights, timing, caps and floor unchanged from 1.0.0. Runs scored under 1.0.0 keep their version; re-scores under 1.1.0 are new rows next to them.

## MYCEL 1.0.0 — 2026-09-17

- Three criteria: `context_fit` 0.35 · `own_voice` 0.30 · `value_angle` 0.35.
- Compliance is not a criterion. A breach of the "never" list credits 0 whatever the score (enforced in code: `creditedScore`).
- Credit floor 60: below it pays nothing. `ai_slop` caps credit at 79 (mild) or 40 (strong).
- Timing: full credit for 6 h after a raid opens, linear to 0 at 48 h (the window X stops distributing in).
- One reply and one quote per member per raid. Likes and reposts are not credited in v1.
- Min hold 100,000 MYCEL (`100000000000` base units at 6 decimals). Stake weighting `none`.
- Per-wallet cap is ruled as a share of the pot (25% until 20 paid contributors, then 15%), not a lamport amount, so `weeklyCapLamports` is left unset until the settlement job reads a percentage.
