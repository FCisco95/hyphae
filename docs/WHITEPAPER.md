# Hyphae

A proof-of-contribution layer for token communities. Short version, 2026-09-24.

## 1. The problem

Token communities pay people for engagement: replies, quotes, explanations, raids. Nobody outside the admin team can check how that money was split. Scores live in a spreadsheet or a private bot, the rules change without notice, and a member who thinks they were underpaid has nothing to point at. Rewards that can't be audited end up rewarding whoever games the admin, not whoever did the work.

## 2. What Hyphae does

A community publishes a rubric, a versioned JSON file that says what good work looks like. Members send their work to a Telegram bot. A model scores each piece against the rubric, and code, not the model, decides what that score is worth.

- **Public rubric.** Every version is in `docs/rubrics/`, and changes are listed in its `CHANGELOG.md`. A score always names the rubric version it used.
- **Model score, code-enforced credit.** The model returns a raw quality score from 0 to 100, flags and its reasoning. `creditedScore` then applies the community's gates: a guideline breach, spam or an off-topic reply credits zero whatever the raw score; text that reads as AI-written is capped at 79 (mild) or 40 (strong); anything under the floor of 60 earns nothing. The raw score stays on record, so "raw 84, credited 0, and why" is visible.
- **Reasoning shown.** The bot replies in the group with the score, the flags and the model's reasoning.
- **Append-only records.** A re-grade or correction is a new row next to the old one. Nothing is overwritten.

## 3. Rewards design

Rewards run in epochs of seven days each.

- **Pinned configuration.** Each epoch pins one immutable configuration: rubric, timing, credit gates, effort multiplier, slot limit and the exact prompt text, by hash. A deploy or a rubric edit can't change how an open epoch is scored. If the running code's prompt no longer matches the pinned hash, no call is made.
- **Cooldown.** A rubric change activates no earlier than two epochs after the current one. Activate a rubric in epoch 11, and the earliest replacement lands in epoch 13, even if it was proposed during epoch 11 or 12.
- **Admission.** A submission is accepted inside one database transaction under a per-community lock, and the time is read from the database clock after the lock is taken. Epochs are half-open: work accepted exactly at an epoch's close belongs to the next one. "Counted" means exactly "accepted before `closesAt`", whenever the model answers.
- **One effort slot.** Each member can nominate one piece of work per epoch with `/effort` for a 3× effort multiplier. Plain `/submit` never touches the slot. Upgrading work that was already scored reuses its quality and asks the model about effort only, so 85 becomes 255, never 85 + 255.
- **Exact points first.** Points are computed exactly with integer arithmetic and rounded to whole points only once, at the end. Timing decays linearly: full credit for 6 hours after a raid opens, zero at 48 hours. Nominated effort work credited at 85 and submitted at 27 hours is worth 85 × 3 × 0.5 = 127.5 exact points. If that's the member's only contribution, it rounds to 128 whole points.
- **Paid calls never repeat on their own.** Every model call is a database row committed before the call is made. If the provider times out or returns something unusable, Hyphae doesn't call again. The work waits for the original answer or for an operator's written proof that nothing was sent.

## 4. Audit trail

Every score records:

| Field | Why |
|---|---|
| Model id | Switching models shows up in the record |
| Rubric version | Which rules the work was judged by |
| Prompt version and template hash | Exactly what the model was asked |
| Evidence hash | Changes whenever the model, rubric version or output changes |
| Full input and output, latency, cost | Anyone can re-check the reasoning and the spend |

Corrections are appended, never written over. At the close of an epoch, one snapshot is frozen and never changes afterwards.

## 5. On-chain plan

Scores are computed off-chain. At each close, the epoch's full score set is committed to Solana as a single merkle root. Leaves and internal nodes are hashed with separate domain tags, so a node can never be replayed as a leaf. Chain writes grow with the number of epochs, not the number of contributions. Each community has one vault that anyone can fund. A contributor claims with a merkle proof and receives soulbound Token-2022 points in the same transaction. The claim-leaf format and the contract are still being designed; none of this is deployed.

## 6. Status

| Label | Meaning |
|---|---|
| **Historical** | Happened and was recorded at the time; not re-run |
| **Locally tested** | Passes the test suite on a named commit; not running anywhere |
| **Deployed** | Running on Fly or Neon, as last recorded |
| **Planned** | Scoped or scheduled, not built |

| What | Label | Evidence |
|---|---|---|
| Bot in the Hyphae Lab test group: `/link`, `/raid`, `/submit`, `/me`, scored replies with reasoning | Deployed (last recorded 2026-09-17) | Build log, 2026-09-17 |
| First live scoring: 3 contributions, 6 scoring runs across rubric versions 1.0.0, 1.1.0 and 1.2.0; credited 85, 0 and 0; 5–11 s per score; $0.084 total spend | Historical | Build log, 2026-09-17 |
| Exact reward-point arithmetic (R1) | Locally tested, merged | PR #1 |
| Pinned configuration, cooldown and admission (R2) | Locally tested, merged, not deployed | PR #2 |
| Effort slots, `/effort`, dispatch that never pays twice (R3); 198 tests plus a real-Postgres race suite | Locally tested, merged, not deployed; database tables applied to Neon on 2026-09-23 | PRs #6, #9 and #10; all four review findings fixed |
| Rubric 1.3.0 (grounded price talk allowed, criticism graded like praise) | Candidate, not applied | `docs/rubrics/CHANGELOG.md` |
| Epoch-scoped `/me` and corrections (R4) | Locally tested, merged, not deployed; migration 0006 not applied | PR #12 |
| Strict close with a frozen snapshot, and re-entry of expired work (R5) | Locally tested, in review, not deployed; migration 0007 not applied | PR #13 |
| Public audit page, on-chain root and claim, devnet run, mainnet payout, verified wallet linking | Planned | Target: before 2026-10-12 |

## 7. Limits

- **Text only.** The scorer reads a post's text through X's public oEmbed. It can't see images or video. Work that depends on media it can't capture waits for evidence instead of being judged blind.
- **Wallets are pasted, not verified.** `/link` accepts an address without a signature and lets a member change it. That's fine for a test group with no payouts, but not for paying real people, so verified linking is a precondition for any real payout.
- **No payout yet.** Points are not money. No root has been published, no claim exists and nothing has been paid.
- **The model can disagree with the founder.** Scores are a model's reading of the rubric. When it disagrees, the answer is a public correction: a human score recorded as a new row beside the model's, with its reason.
