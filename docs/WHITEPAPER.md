# Hyphae

A proof-of-contribution layer for token communities. Short version, updated 2026-09-24 (after the cutover).

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
| Full input and output, latency, cost | Recorded for every call. The public audit shows the input and output hashes, which pin exactly what was sent and returned, plus latency and cost |

Corrections are appended, never written over. At the close of an epoch, one snapshot is frozen and never changes afterwards.

The public audit reads all of this through a read-only API: every contribution with its raw and credited score and the rule between them, which decision counted at the close, the member totals, and whether anything has been allocated (nothing yet). It never serves a Telegram identity or a wallet that was not linked by signing.

## 5. On-chain plan

Scores are computed off-chain. At each close, the epoch's full score set is committed to Solana as a single merkle root. Leaves and internal nodes are hashed with separate domain tags, so a node can never be replayed as a leaf. Chain writes grow with the number of epochs, not the number of contributions. Each community has one vault that anyone can fund. The deployed program has no withdraw instruction: SOL leaves the vault only as the 3% Hyphae fee at publish or as a claim against a published root. The community's admin key publishes each root, so that key chooses where each epoch's pot goes; the program checks that a claim matches the root, not that the root matches the audit. Publishing an epoch anchors the root and the hash of the epoch's full audit record, and reserves exactly what the epoch allocates. A contributor claims with a merkle proof signed by their own wallet, once, and the claim leaves a receipt on-chain. The program runs on devnet, where a publish, a claim and a refused second claim are recorded; it is not on mainnet. Soulbound Token-2022 points in the claim are planned, not built.

## 6. Status

| Label | Meaning |
|---|---|
| **Historical** | Happened and was recorded at the time; not re-run |
| **Locally tested** | Passes the test suite on a named commit; not running anywhere |
| **Deployed** | Running on Fly or Neon, as last recorded |
| **Planned** | Scoped or scheduled, not built |

| What | Label | Evidence |
|---|---|---|
| Bot in the Hyphae Lab test group: `/link`, `/raid`, `/submit`, `/effort`, `/me`, scored replies with reasoning | Deployed (production `b7bfe55`, 2026-09-24) | `docs/handoffs/2026-09-24-cutover.md` |
| First live scoring: 3 contributions, 6 scoring runs across rubric versions 1.0.0, 1.1.0 and 1.2.0; credited 85, 0 and 0; 5–11 s per score; $0.084 total spend | Historical | Build log, 2026-09-17 |
| Exact reward-point arithmetic (R1) | Locally tested, merged | PR #1 |
| Pinned configuration, cooldown and admission (R2) | Deployed 2026-09-24 | PR #2 |
| Effort slots, `/effort`, dispatch that never pays twice (R3), with a real-Postgres race suite | Deployed 2026-09-24 | PRs #6, #9 and #10; all four review findings fixed |
| Rubric 1.3.0 (grounded price talk allowed, criticism graded like praise) | Candidate, not applied | `docs/rubrics/CHANGELOG.md` |
| Epoch-scoped `/me` and corrections (R4) | Deployed 2026-09-24 | PR #12 |
| Strict close with a frozen snapshot, and re-entry of expired work (R5) | Deployed 2026-09-24; first real close 2026-10-02 00:00 UTC | PR #13; Codex review, two findings fixed |
| Verified wallet linking: private single-use link, signed message checked by `@organichub/verify` 0.1.0, append-only wallet history | Deployed 2026-09-24; a live link with Phantom verified | `docs/handoffs/2026-09-24-verified-link-implemented.md`, `2026-09-24-cutover.md` |
| MYCEL reward epoch 1 (2026-09-25 → 2026-10-02, rubric 1.2.0) | Deployed; not a paid epoch | `docs/handoffs/2026-09-24-cutover.md` |
| Public read API v1 and audit page | Locally tested on a seeded epoch, not deployed | `docs/handoffs/2026-09-25-audit-page-plan.md` |
| Rules test (`/rules`, six questions, 6/6), payout gate and token-hold gate (100,000 MYCEL, read within 24 hours of the close by two independent mainnet providers) | Locally tested on PGlite and Postgres 17, not deployed; migration 0009 not applied | `docs/handoffs/2026-09-24-payout-gates-built.md` |
| Program: per-community vault, publish (root, audit hash, 3% fee), one claim per leaf with a receipt; exact allocation, member and epoch audit manifests, publish job (R6) | Locally tested (LiteSVM, PGlite, Postgres 17), not deployed; the publish job has no production caller | `docs/handoffs/2026-09-25-r6-anchor-built.md` |
| Devnet run: publish a seeded epoch, one claim, a refused second claim | Not run: the public devnet faucet refused every airdrop to the throwaway key | `docs/handoffs/2026-09-25-r6-anchor-built.md` |
| Mainnet payout (epoch 2 at the earliest) | Planned | `docs/handoffs/2026-09-25-plan.md` |

## 7. Limits

- **Text only.** The scorer reads a post's text through X's public oEmbed. It can't see images or video. Work that depends on media it can't capture waits for evidence instead of being judged blind.
- **Only signed wallets can ever be paid.** `/link` links a wallet by signing. A wallet pasted before the cutover keeps scoring but is marked not verified and is never paid. A closed epoch pays the wallet that was verified at its close.
- **No payout yet.** Points are not money. No root has been published, no claim exists and nothing has been paid.
- **The model can disagree with the founder.** Scores are a model's reading of the rubric. When it disagrees, the answer is a public correction: a human score recorded as a new row beside the model's, with its reason.
