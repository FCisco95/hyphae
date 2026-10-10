# October 10 payout session

Operator: Claude Code, claude-opus-5-5. Cisco attending with the Ledger from 11:19Z.

## Rulings recorded this session

- **11:19Z:** Cisco resumed payment and lifted the payout pause and the push freeze early (freeze was to end Oct 11 00:00Z). Push only to `hold/hyphae-member-login`, never `main`, because `main` carries the held login code.
- **Pot:** epoch 2 gross is **1,500,000,000 lamports (1.5 SOL)**, from Cisco's funding wallet straight to the vault. This replaces the earlier 0.5 SOL budget. It is not a Treasury spend.
- **Author attestation (C18b, after close):** Cisco confirms the X author of every contribution held by the four payable members is that member's own account. Non-payable members' authorship changes no amount.
- **Policy:** epoch 2 pays by the published rules only. No retroactive eligibility change and no participation minimum in epoch 2. Any gift to non-payable testers is Cisco's own transfer, outside the protocol.

## Read-only close inspection, 11:20Z

- Epoch 2 `closed`; one snapshot, `closed_at` 2026-10-10 00:00:21.741Z; 33 entries, 9 members, 6 with points. `reward-close` completed, no failed reward-close/hold-check jobs. No decision accepted at or after close.
- Epoch 3 open Oct 10 00:00Z to Oct 17 00:00Z; intake never paused; no admission after close.
- Hold checks: 4 `holder`, observed 00:00:24Z to 00:10:22Z, inside the 24-hour window.
- Gate (`oct8-audit`, repeatable-read read-only): **ready**, 4 payable, no blockers.
- Chain, finalized slot 455237281: admin 0 lamports; community and vault absent; Treasury fee recipient 895,047,823 lamports; funding wallet covers the pot.

## C18b audit, late

The 23:00Z pause and the pre-close audit did not happen. The audit ran after close on the frozen snapshot, which nothing changed: the last decision was accepted Oct 9 17:03Z, so this read sees what a 23:45Z audit would have seen.

- 33 admitted contributions, 33 distinct originals, 0 without a decision, 33 completed quality dispatches, 0 nominations, 0 duplicate groups.
- 0 repeated post URLs or status IDs; every URL names an author; no author shared between members; each member's URL authors match their bound handles.
- Pause and resume skipped: the close already froze the list, and a pause now would only block epoch 3.

## Allocation preview, 1.5 SOL

Fee 45,000,000 to the Treasury; net 1,455,000,000; cap 363,750,000 (25%). Four payees, allocated **1,238,881,509**; cap remainder 216,118,490 stays in the vault; dust 1. Two payees hit the cap. C19 prints the binding numbers.

## Rows

| Row | Stage |
|---|---|
| C14 | Done: 0.02 SOL funding wallet → admin, `5MbsKUxE…Rb1tSZ8`, finalized 12:56:23Z; admin 20,000,000 lamports. Ledger read `44'/501'/2'/0'` = recorded admin first |
| C15 | Done: plan matched program/admin/mint/community/vault/fee recipient; Cisco matched the Squads Treasury Receive address |
| C16 | Done: `initialize_community` `aensGhPg…ghNX`, 13:00:37Z; decoded mint/admin/fee recipient match, outstanding 0 |
| C17 | Done: 1 row bound, `chain_address = HRkBN4…XbRX`, read back 13:02:06Z |
| C18 | Done: 1.5 SOL funding wallet → vault, `5spBxwDa…7rjtj`, 13:03:09Z; plan rerun says the 1.5 SOL pot is covered |
| C18b | Audit clean after close, attested; pause skipped (reason above) |
| Pre-C19 | Program hash `7e902d1b…43ac` matches the Oct 2 build; upgrade authority = Ledger admin; Fly api+worker on `jev-e5f864b`; journal 18 |
| C19 | Done: intent stored; 4 leaves, allocated 1,238,881,509, remainder 216,118,490, dust 1; root `f98ff930…f5f7d1d3`, audit `c340a280…633e0a90` |
| C20 | Done: `publish_epoch` `4qhKtnsV…p6EnLm`, 13:09:22Z; decoded root/audit/gross/fee/allocated match; Treasury +45,000,000; API `published`, payment `available`, 4 claimable |
| C21 | Done: genuine claim by the founder's payable wallet `MAoRn1…VhAB` from the claim page with Phantom, `5iBbZVJE…D6sZn55`, finalized 13:16:34Z, no error. Vault −363,750,000; receipt `C7nEMEav…MDP9` created (1,305,560 rent); wallet net +362,364,440 after the 80,000 fee. The first Phantom approval returned no signature and nothing landed; the retry succeeded |
| C22 / P14 | Done 13:17Z: API `allocation = published`, `publish_tx` = C20; `payment = available`; founder `paid` with `claim_tx` = C21, the other 3 `claimable`; claimed 363,750,000 + unclaimed 875,131,509 = allocated 1,238,881,509; fee 45,000,000 and cap remainder 216,118,490 equal C19. Wallet claims API lists the paid claim; epoch page shows the claim tx |

**First mainnet payout complete.** Three payees still have to claim themselves.

## IDL published on-chain (Cisco's request, 13:3xZ)

Canonical Program Metadata account `zxj1hrV2pYRuHC65TvUVsRssMUvzu8bZ7YKWkPTrc9d` (seed `idl`, program `EAz8Wk…4d6E`), authority and payer the Ledger admin (= upgrade authority). Content `target/idl/hyphae.json` (13,211 bytes, zlib 1,682), checked first against live discriminators of the claim receipt, epoch 2 and community accounts. Two Ledger approvals, each simulated first: `4Dp1vDjs…SUEm7f`, `2sS66trK…9ArgZ`. Rent 9,682,480 lamports + 10,000 fees from the admin. Read back identical. Solscan's Data tab now decodes `ClaimReceipt` (score 274, amount, evidence hash, claimed_at) and `Epoch`. Built with `@solana-program/program-metadata` 0.10.0 instructions and the repo's Ledger signer, because the Anchor CLI runs in WSL, which cannot see the Ledger. Reversible: the Ledger can close the account and recover the rent.

## Later: claim page (Cisco's note, not now)

- One "Connect wallet" button that opens a wallet picker, replacing the seven per-wallet buttons.
- A transparency dashboard on the claim/epoch page: Treasury fee balance, total paid to members, unclaimed and vault remainder, community size.
- A visible connected-wallet state (address, disconnect) instead of the small "Connected …" line.
- An animated "waiting for your wallet" state with a timeout and retry hint: the first Phantom approval never returned and the page waited with no feedback.

Private receipts (identities): `docs/plans/operator-receipts/2026-10-10-*`. Transparency report draft for Cisco's approval: `docs/plans/2026-10-10-epoch2-transparency-report.md`, not posted.
