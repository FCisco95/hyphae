# Hyphae: proof of contribution

Hyphae rewards work done for token communities. Members submit text or an X post, an AI scores it against a public rubric, and an epoch's payout is committed to Solana. A member claims the allocation with their own wallet signature and Merkle proof.

## Live proof

On October 10, 2026, MYCEL epoch 2 paid **four wallets**, **1,238,881,509 lamports**, with **zero unclaimed**. Three payees are non-founder members. [Finalized mainnet receipts](evidence/2026-10-10-mainnet-payout.md); [live epoch](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2).

The program is on mainnet and devnet. Its reproducible executable hash is `7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac`. [Verify the build](https://github.com/FCisco95/hyphae-program#verify-the-build).

## Contribution and scoring

A registered Telegram community has its own raids, pinned epoch configuration and public audit page. Members submit work through the bot. The scorer reads text and the raid's target text, applies the public rubric and records its reasoning. Scores become exact points after the published caps, hard zeros, timing decay and effort rules. [Rubrics](rubrics/CHANGELOG.md); [member receipts](community/MEMBER-RECEIPTS.md).

Epochs pin their rubric and scorer. The pilot supports publicly recorded, prospective scorer amendments; an amendment does not rewrite already admitted work or change payout rules. Corrections append a new decision with its reason and evidence, keeping the original. A correction after close does not rewrite the frozen payout.

## Allocation and claims

An epoch closes into a frozen audit. Only members who satisfy the existing eligibility gates can be allocated funds. Points are not payments. Exact integer arithmetic applies the 3% fee and per-member cap; allocation cannot exceed available funds.

The publisher commits a payout root and an audit hash to a program-derived epoch account. Each community has its own SOL vault and fixed fee recipient. A claim reconstructs the leaf from the signing wallet and pays it once, recording the wallet, score, amount and evidence hash on chain. [Program source](https://github.com/FCisco95/hyphae-program/tree/main/programs/hyphae); [read API](https://hyphae-api.fly.dev/docs).

## What users can verify

The public site shows contribution decisions and revisions, scorer/configuration history, allocations and chain-confirmed payments. The API supplies individual claim leaves and proofs. A signature or stored allocation alone does not establish payment. A wallet record shows actual published claim history across communities.

Public contribution/payment receipts and aggregates remain visible. Per-member rules-test and hold checklists are private. Telegram IDs and usernames are not in public receipts. [Privacy and security](SECURITY.md).

## Trust and limits

The publisher chooses the payout list; the program cannot judge whether that list is fair. Its upgrade authority can change the program. Funding one epoch at a time limits exposure but does not remove that trust. The complete off-chain audit manifest is stored but not yet publicly downloadable.

The scorer reads text, not image/video content. A model score does not prove account ownership or a reply's relationship to the target post. AI review is not a third-party audit. [Review results and known limits](evidence/REVIEWS.md).

Soulbound Token-2022 points, a generated Codama client, npm SDK publication and self-service administrator setup remain not built/published. Current integrations use the public read API and operator-assisted registration.
