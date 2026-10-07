# Security and trust

What Hyphae's admin can and cannot do, where the keys are, what is stored about members, and how to report a problem. Every statement links to the file or the on-chain record behind it. The same text is on the site at https://hyphae-delta.vercel.app/security, and a test keeps the two in step (`apps/web/lib/trust.test.ts`).

**Report a vulnerability privately:** https://github.com/FCisco95/hyphae-program/security/advisories/new (GitHub private vulnerability reporting on the public program repository).

Last checked 2026-10-07.

## What you trust

- You trust one key with each epoch's payout list. The publisher key decides which wallets an epoch pays and how much, and the program cannot tell a fair list from an unfair one: it could pay its own wallet any SOL in the vault that is not already assigned. Evidence: [publish_epoch.rs](https://github.com/FCisco95/hyphae-program/blob/main/programs/hyphae/src/instructions/publish_epoch.rs) · [program review](https://github.com/FCisco95/hyphae/blob/main/docs/handoffs/2026-09-25-r6-anchor-built.md).
- That key lives on a Ledger hardware wallet, and a community's vault is funded one epoch at a time, just before it pays, so one epoch's pot is what is exposed. Evidence: [custody policy](https://github.com/FCisco95/hyphae-program#custody-during-the-pilot) · [key registry](https://github.com/FCisco95/hyphae/blob/main/docs/WALLETS.md).
- The rest can be checked: the program on chain is byte for byte its public source, every score shows its reasoning, and every correction stays visible. Evidence: [verify the build](https://github.com/FCisco95/hyphae-program#verify-the-build) · [decision history](https://github.com/FCisco95/hyphae/blob/main/apps/api/src/rewards/decisions.ts).

## What the admin can and cannot do

On chain, the program enforces the limits. Off chain, the operator's tools do.

- The program has three instructions: create a community, publish an epoch, and claim. None of them withdraws or sweeps the vault. Evidence: [lib.rs](https://github.com/FCisco95/hyphae-program/blob/main/programs/hyphae/src/lib.rs).
- An epoch's payout root is published once and never changed: the epoch account can only be created, and no instruction writes its root again. Evidence: [publish_epoch.rs](https://github.com/FCisco95/hyphae-program/blob/main/programs/hyphae/src/instructions/publish_epoch.rs).
- SOL assigned to an earlier epoch and not yet claimed cannot be assigned again. Evidence: [publish_epoch.rs](https://github.com/FCisco95/hyphae-program/blob/main/programs/hyphae/src/instructions/publish_epoch.rs).
- The fee is 3% of each epoch's pot, paid to an address set when the community is created. No instruction changes the fee or that address. Evidence: [constants.rs](https://github.com/FCisco95/hyphae-program/blob/main/programs/hyphae/src/constants.rs) · [initialize_community.rs](https://github.com/FCisco95/hyphae-program/blob/main/programs/hyphae/src/instructions/initialize_community.rs).
- Each wallet claims its leaf once. The claim rebuilds the leaf from the signing wallet, so nobody can claim for someone else. Evidence: [claim.rs](https://github.com/FCisco95/hyphae-program/blob/main/programs/hyphae/src/instructions/claim.rs) · [program.rs](https://github.com/FCisco95/hyphae-program/blob/main/programs/hyphae/tests/program.rs).
- The program can be upgraded, and an upgrade could change any of the above. The upgrade key is the same Ledger, and any upgrade is announced in the public program repository before it is used. Evidence: [custody policy](https://github.com/FCisco95/hyphae-program#custody-during-the-pilot) · [mainnet deploy receipt](https://github.com/FCisco95/hyphae/blob/main/docs/handoffs/2026-10-02-c13-mainnet-receipt.md).
- A score is corrected only with the operator's command-line tool, with a reason and evidence. The correction is a new revision; the old one stays, and the contribution's public page shows who corrected it and why. A correction made after an epoch closes does not change that epoch's payout. Evidence: [reward-correct.ts](https://github.com/FCisco95/hyphae/blob/main/apps/api/scripts/reward-correct.ts) · [decisions.ts](https://github.com/FCisco95/hyphae/blob/main/apps/api/src/rewards/decisions.ts).
- An epoch is judged by the rubric and scoring prompt it pinned. A change is a proposal that takes effect no earlier than the next epoch, and at least two epochs after the last change. Each epoch's configuration is public in the read API; pending proposals are not public yet. Evidence: [config.ts](https://github.com/FCisco95/hyphae/blob/main/apps/api/src/rewards/config.ts) · [read API](https://github.com/FCisco95/hyphae/blob/main/apps/api/src/http/read-service.ts).
- Only the community's designated admin opens, closes or cancels a raid, and closing or cancelling needs a stated reason, which is stored. Whether reward intake is open or paused is public in the read API. Evidence: [raid.ts](https://github.com/FCisco95/hyphae/blob/main/apps/api/src/bot/commands/raid.ts) · [raid-lifecycle.ts](https://github.com/FCisco95/hyphae/blob/main/apps/api/src/bot/commands/raid-lifecycle.ts) · [read API](https://github.com/FCisco95/hyphae/blob/main/apps/api/src/http/read-service.ts).

## What is on chain and what is not

- On chain, for each epoch: the payout root, a hash of the epoch's audit record, the pot, the fee and the totals. For each claim: the wallet, its score, the amount and an evidence hash. Evidence: [state.rs](https://github.com/FCisco95/hyphae-program/blob/main/programs/hyphae/src/state.rs).
- Off chain, in a Postgres database: the text and links of contributions, what the AI was asked and answered, decisions and corrections, rubrics and configurations, and member and wallet records. Evidence: [database schema](https://github.com/FCisco95/hyphae/blob/main/packages/db/src/schema.ts).
- The audit record behind the on-chain hash is stored but not yet published. Today you can check your own leaf and proof against the root, but not recompute a whole epoch. Evidence: [read API types](https://github.com/FCisco95/hyphae/blob/main/packages/core/src/read-api.ts) · [read API](https://github.com/FCisco95/hyphae/blob/main/apps/api/src/http/read-service.ts).

## Keys and custody

- The program's only upgrade authority on mainnet, and the key that publishes Hyphae Lab's epochs, is the Ledger 2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR. It was read back from the chain at deploy. Evidence: [Ledger on Solana Explorer](https://explorer.solana.com/address/2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR) · [mainnet deploy receipt](https://github.com/FCisco95/hyphae/blob/main/docs/handoffs/2026-10-02-c13-mainnet-receipt.md).
- Hyphae Lab's fee goes to the MYCEL Treasury, Squads vault rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK, which needs 2 of 3 signers to move funds. It is fixed when the community is created on mainnet, planned for the first payout on 2026-10-08, and cannot change afterwards. Evidence: [vault on Solana Explorer](https://explorer.solana.com/address/rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK) · [fee ruling](https://github.com/FCisco95/hyphae/blob/main/docs/handoffs/2026-09-27-keys-and-fee-rulings.md).
- The temporary keys used to deploy were deleted after the deploy, and the deletions are recorded. Evidence: [key registry](https://github.com/FCisco95/hyphae/blob/main/docs/WALLETS.md).

## Verifiable build

- Program EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E runs on mainnet and devnet. Rebuilding its public source in Anchor's pinned Docker image gives the solana-verify hash 7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac, the same hash the chain reports for the deployed program. Evidence: [verify the build](https://github.com/FCisco95/hyphae-program#verify-the-build) · [mainnet deploy receipt](https://github.com/FCisco95/hyphae/blob/main/docs/handoffs/2026-10-02-c13-mainnet-receipt.md).
- Not done yet: the on-chain verification record that lets explorers show the program as verified. Evidence: [deploy plan](https://github.com/FCisco95/hyphae/blob/main/docs/handoffs/2026-09-28-arc.md).

## Independent reviews

Hyphae has been independently reviewed by AI reviewers, not a third-party audit. Each review below was done by a model from a different family than the one that built the change. The reports are public, findings included.

- 2026-09-25, the on-chain program: three Codex rounds, approved in the third. The finding that the admin can publish any root was kept as the pilot's custody model, not fixed. Evidence: [program review](https://github.com/FCisco95/hyphae/blob/main/docs/handoffs/2026-09-25-r6-anchor-built.md).
- 2026-10-03, community setup: Claude Opus approved it for local use with two fixes required, then approved the fixes. Evidence: [review](https://github.com/FCisco95/hyphae/blob/main/docs/reviews/2026-10-03-community-setup-opus-review.md) · [fix check](https://github.com/FCisco95/hyphae/blob/main/docs/reviews/2026-10-03-community-setup-opus-fixcheck.md).
- 2026-10-04, the read SDK and the adopter demo: Claude Opus accepted them after one round of fixes. Evidence: [first review](https://github.com/FCisco95/hyphae/blob/main/docs/reviews/2026-10-04-sdk-initial-opus-review.md) · [final acceptance](https://github.com/FCisco95/hyphae/blob/main/docs/reviews/2026-10-04-adopter-final-acceptance.md).
- 2026-10-04, raid alerts and the member journey (receipts, raid lifecycle, operator view): Claude Opus accepted both after rounds of fixes. Evidence: [raid alerts](https://github.com/FCisco95/hyphae/blob/main/docs/reviews/2026-10-04-raid-alerts-opus.md) · [member journey](https://github.com/FCisco95/hyphae/blob/main/docs/reviews/2026-10-04-member-journey.md).
- 2026-10-06, the wallet link page: Codex accepted it with one advisory, fixed. Evidence: [review](https://github.com/FCisco95/hyphae/blob/main/docs/reviews/2026-10-06-link-page.md).
- 2026-10-06, the scoring prompt reward-eval/2: Codex found the scoring itself clean and two defects in the evaluation script; both were fixed, and the fix was not reviewed again. Evidence: [review](https://github.com/FCisco95/hyphae/blob/main/docs/reviews/2026-10-06-reward-eval-2.md).
- 2026-10-07, prompt injection (our own test, not a review): seven replies that try to instruct the AI scorer each earned 0 in 3 of 3 runs, and a real reply with an injection appended was not scored higher. Evidence: [result](https://github.com/FCisco95/hyphae/blob/main/docs/rubrics/eval/reward-eval-2-injection.md).

## When we get something wrong

- Scores are never edited in place. A correction is appended with its reason and evidence and shown on the contribution's page. Evidence: [decisions.ts](https://github.com/FCisco95/hyphae/blob/main/apps/api/src/rewards/decisions.ts) · [receipt page](https://github.com/FCisco95/hyphae/blob/main/apps/web/components/views.tsx).
- Changes to the rubric or the scoring prompt are listed with the reason and the evidence behind them. Evidence: [rubric changelog](https://github.com/FCisco95/hyphae/blob/main/docs/rubrics/CHANGELOG.md).
- Every release, decision and known limit is written down in the public build log, including what went wrong. Evidence: [build log](https://github.com/FCisco95/hyphae/blob/main/docs/BUILDLOG.md).

## Report a problem

- Report a security problem privately through GitHub's private vulnerability reporting on the public program repository. Please do not post it in the Telegram group or on X first. There is no paid bug bounty. Evidence: [open a private report](https://github.com/FCisco95/hyphae-program/security/advisories/new).

## Privacy and deletion

- We store your Telegram user ID and username, up to three X handles, the wallet you signed with and its history, the text and links you submit, and the AI's scoring of them. Evidence: [database schema](https://github.com/FCisco95/hyphae/blob/main/packages/db/src/schema.ts).
- Public receipts show a contribution's text, link, scores and reasons, a random member ID and the verified wallet. They never show your Telegram ID or username. Evidence: [read API](https://github.com/FCisco95/hyphae/blob/main/apps/api/src/http/read-service.ts).
- These services receive some of it: Anthropic (the AI model reads your contribution and the post it answers), Telegram (the bot), X (public post data through X's embed service), Neon (the database), Fly.io (the API and worker), Vercel (this site, which sees visitors' IP addresses) and a Solana RPC provider (wallet balance checks). Evidence: [service settings](https://github.com/FCisco95/hyphae/blob/main/apps/api/src/env.ts) · [X embed reader](https://github.com/FCisco95/hyphae/blob/main/apps/api/src/x/oembed.ts) · [site's API client](https://github.com/FCisco95/hyphae/blob/main/apps/web/lib/api.ts).
- We keep this data while the community runs. On request, we delete your Telegram ID, username and X handles and unlink your wallet within 30 days. We cannot delete what is on Solana, or the text and scores in public receipts, because they are the audit trail. Evidence: [build log](https://github.com/FCisco95/hyphae/blob/main/docs/BUILDLOG.md).
- To ask, use the private report link above or ask your community's admin in Telegram. Deletion is done by hand today; there is no button for it yet. Evidence: [open a private report](https://github.com/FCisco95/hyphae-program/security/advisories/new).
