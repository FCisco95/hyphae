# Hyphae build milestones

Public technical milestones for Colosseum. Each item names what shipped and its evidence. Owner planning, approvals, release procedures and recording scripts are private.

## October 11 — Community setup prompt

The homepage offers a copyable agent prompt linked to the [community setup guide](community/SETUP-INTEGRATION.md). It prepares a private setup brief for operator review and states the current assisted-registration boundary. Copy confirmation, manual-copy recovery and dismissal pass three interaction tests. Fresh desktop and phone checks cover both color schemes, clipboard success/denial, and layouts down to 320 pixels. The prompt shipped in 1fa0f78; the copy button now identifies Cursor, Claude Code and OpenAI with locally served official logo assets and [source attribution](../apps/web/public/brand/agents/NOTICE.txt).

## October 11 — Curated public evidence

Public documentation now contains technical interfaces, published rubrics, reproducible fixtures and curated [program](evidence/PROGRAM.md), [review](evidence/REVIEWS.md), [release](evidence/2026-10-11-release.md) and [mainnet payout](evidence/2026-10-10-mainnet-payout.md) evidence. Proof links no longer depend on owner working notes. Before publication, Markdown links were checked against the proposed Git tree. This changes documentation and trust-page links; no claim transaction, payout, scorer, API or program behavior changes.

## October 11 — Claim recovery and private eligibility live

The claim page has one wallet picker, a visible connected address, waiting deadlines and deliberate recovery/retry. Wallet records, Actions and schedule notices are live. Public pages and group messages expose no per-member rules-test or hold verdicts. [Released behavior, CI and smoke evidence](evidence/2026-10-11-release.md); [curated review results](evidence/REVIEWS.md).

## October 10 — First mainnet payout

MYCEL epoch 2 paid four wallets: **1,238,881,509 lamports**, **0 unclaimed**, three non-founder payees. Community and vault created, a 1.5 SOL pot funded, payout root published and all four claims finalized. The 3% fee was 0.045 SOL. The IDL is published so Solscan decodes the receipts. [Full transaction index](evidence/2026-10-10-mainnet-payout.md).

## October 7 — Public scorer history and injection checks

Epoch 2 adopted reward-eval/2 from its recorded effective time while retaining rubric MYCEL 1.2.0 and payout rules. The epoch API lists the amendment and each contribution records its scorer. [Rubric/scorer changelog](rubrics/CHANGELOG.md); [injection evaluation and limits](rubrics/eval/reward-eval-2-injection.md).

## October 7 — Public privacy policy

Data is kept while the community runs. On request, Telegram ID, username and X handles are deleted and the wallet link ended within 30 days. Solana records and the contribution text, links, scores and wallet in public receipts remain as the audit trail. Deletion is manual today. Security reports use the program repository's private vulnerability reporting. [Full public policy](SECURITY.md#privacy-and-deletion).

## October 3–6 — Community and member interfaces

Operator-assisted community registration, member receipts, raid lifecycle and alerts, wallet linking, and the read SDK were built and reviewed. Their current public interfaces are documented in [integration](community/INTEGRATING.md), [setup](community/SETUP-INTEGRATION.md), [receipts](community/MEMBER-RECEIPTS.md) and [alerts](community/RAID-ALERTS.md). The SDK is locally packable; npm publication and self-service setup remain absent.

## October 2 — Mainnet program deployment

Program EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E was deployed with the Ledger as its upgrade authority. The executable matches the reproducible public build. [Deployment transaction, hash and custody limits](evidence/PROGRAM.md).

## September — Scoring, exact settlement and devnet proof

The Telegram contribution workflow, published rubrics, immutable reward decisions, exact allocation, shared Rust/TypeScript/Python commitment vectors and claim receipts were built. The devnet rehearsal published an epoch, claimed and refused a duplicate. [Public program and devnet receipts](https://github.com/FCisco95/hyphae-program#a-full-run-on-devnet); [source and tests](../README.md#develop).
