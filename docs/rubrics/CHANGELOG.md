# Rubric changelog

Every rubric a Hyphae community scores against is public here. A community's `rubric_version` points at one of these files; the epoch commits its hash on-chain.

## MYCEL 1.0.0 — 2026-09-17

- Three criteria: `context_fit` 0.35 · `own_voice` 0.30 · `value_angle` 0.35.
- Compliance is not a criterion. A breach of the "never" list credits 0 whatever the score (enforced in code: `creditedScore`).
- Credit floor 60: below it pays nothing. `ai_slop` caps credit at 79 (mild) or 40 (strong).
- Timing: full credit for 6 h after a raid opens, linear to 0 at 48 h (the window X stops distributing in).
- One reply and one quote per member per raid. Likes and reposts are not credited in v1.
- Min hold 100,000 MYCEL (`100000000000` base units at 6 decimals). Stake weighting `none`.
- Per-wallet cap is ruled as a share of the pot (25% until 20 paid contributors, then 15%), not a lamport amount, so `weeklyCapLamports` is left unset until the settlement job reads a percentage.
