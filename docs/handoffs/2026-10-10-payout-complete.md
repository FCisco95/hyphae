# Epoch 2 payout complete

Saved 2026-10-10 15:17Z. Operator: Claude Code, claude-opus-5-5. Cisco attended from 11:19Z with the Ledger.

## TL;DR

Hyphae's first mainnet payout is finished end to end. Epoch 2 closed on schedule, the MYCEL community and vault were created, a 1.5 SOL pot was published with the Ledger, and **all four payable wallets claimed** (claimed 1,238,881,509 = allocated, unclaimed 0). The program's IDL is now published on-chain, so Solscan decodes claim receipts and epochs in plain text. Every step's receipt is in [the payout session record](2026-10-10-payout-session.md).

## Final state, 15:17Z read (finalized slot 455301915)

| Item | Value |
|---|---|
| Epoch 2 API | `allocation = published`, `payment = available`, 4/4 `paid`, claimed + unclaimed = allocated |
| Vault `AC3zkG…oG86K` | 216,814,451 lamports = cap remainder 216,118,490 + dust 1 + rent 695,960 (exact) |
| Ledger admin `2kz1Zq…gofjR` | 6,944,720 lamports, enough for epoch 3's account rent and fee |
| Treasury fee recipient `rRceAU…u7MK` | 940,047,823 (+45,000,000 epoch 2 fee) |
| IDL metadata `zxj1hrV2…c9d` | 9,682,480 lamports rent, owned by Program Metadata |
| API health | ok |

Claims (wallet → lamports → tx):

| Wallet | Lamports | Claim tx |
|---|---:|---|
| `MAoRn1…VhAB` (founder) | 363,750,000 | `5iBbZVJE…D6sZn55` |
| `2BsmXz…neB8` | 363,750,000 | `59kNeiZ5…nGtAZvSy` |
| `4a5G78…igvN` | 288,030,435 | `63tutuXC…DvWRLCHzq` |
| `Gsirkx…Xgt3` | 223,351,074 | `2gbAmxM6…8QWh4ek1tK` |

## Rulings this session

- Payout pause and push freeze lifted early by Cisco. Pushes go to `hold/hyphae-member-login` only, never `main`: `main` carries the held member-login code.
- Epoch 2 pot 1.5 SOL from Cisco's funding wallet, not the Treasury. Total out of the funding wallet 1.52 SOL plus fees (option B).
- Pay by the published rules only. No retroactive eligibility change. Gifts to unpaid testers, if any, are Cisco's own transfers outside the protocol.
- C18b audit ran after close on the unchanged frozen snapshot. Cisco attested the four payees' X accounts. Pause/resume skipped (the close had already frozen the list).
- Publish the canonical IDL on-chain (done, reversible by the Ledger).
- Operations direction (manual now, admin dashboard next, automatic for Organic communities, eligibility enforced before raiding) is recorded in the session record; not built.

## Communication

Cisco posted from @FCisco95: post 1 "First Hyphae payout is out", post 2 with the payout breakdown and a summary card, and scheduled post 3 ("your score is on-chain") for Oct 11 morning. Post 4 (pitch video, lessons, what's next) is for Oct 11–12. Private drafts: `docs/plans/2026-10-10-epoch2-transparency-report.md`. Screenshots and a receipts index live in Cisco's local presentation folder outside the repo (`Desktop/Mycel/Hyphae/prints`, 13 images + README).

## Open items

1. **Hackathon submission (deadline Oct 12):** demo video, post 4, Colosseum submission form, reviewer access. Use the prints folder and the Solscan decoded receipt as proof shots.
2. **Held release (`next` 1249fed):** the release plan's precondition "after C22" is now met. It still needs Cisco's exact yes on `docs/demo/2026-10-11-release-plan.md` (migrations 0018+0019, image, worker, epoch 3 amendment to reward-eval/3). Not started.
3. **Pushing `main`:** 36 commits ahead of `origin/main`, including the held member-login code. Only `hold/hyphae-member-login` is current. A `main` push needs Cisco's release decision and the full local gate.
4. **Claim-page fixes (not built):** single wallet picker, visible connected state, waiting state with timeout (first Phantom approval never returned), treasury/payout dashboard.
5. **Pre-raid eligibility enforcement:** needs Cisco's strictness ruling (strict block vs. per-submission warning); reverses the Oct 7 "earn first" ruling.
6. **Epoch 3** closes Oct 17 00:00Z. Next sitting: one command + one Ledger approval (option A, not yet built), funding top-up computed by the existing plan.
7. **Unchanged from before:** member login disabled (Phantom login failure and refresh persistence unresolved), participation-minimum proposal undecided, scorer-v3 questions, `@organichub/verify` 0.1.0 through Oct 12.

## Suggested skills

handoff-memory (resume), the-analyst (release and policy decisions), superpowers:verification-before-completion (any read-back), hyperframes or faceless-explainer (pitch video), social-media (post 4), superpowers:brainstorming (admin dashboard and pre-raid enforcement design), handoff (session end).
