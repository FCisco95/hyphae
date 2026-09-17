# Rubric changelog

Every rubric a Hyphae community scores against is public here. A community's `rubric_version` points at one of these files; the epoch commits its hash on-chain.

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
