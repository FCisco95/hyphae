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
| C14–C18 | Open, starting now |
| C18b | Audit clean after close, attested; pause skipped (reason above) |
| C19–C22 | Open; gate ready |

Private receipts (identities): `docs/plans/operator-receipts/2026-10-10-*`. Transparency report draft for Cisco's approval: `docs/plans/2026-10-10-epoch2-transparency-report.md`, not posted.
