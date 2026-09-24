---
date: 2026-09-25
summary: Payment definitions for the first mainnet payout, as yes/no items for Cisco's ruling by Sep 30. The Lab funds a program-owned community vault in SOL; 3% of the gross epoch pot is deducted at publish, floored, to a Hyphae fee address; the net pot is split by exact point units among payable members (signed wallet at close, 100,000 MYCEL hold, rules test passed), capped at 25% per wallet, with dust, cap remainders and unclaimed amounts kept visible as retained; paid means an on-chain claim receipt. One finding changes the calendar: approved policy makes the first paid epoch one that opens after the rules test and raid flow are live, so epoch 1 (opened Sep 25, no rules test) cannot be paid, and the first payable epoch is epoch 2 (Oct 2 → Oct 9), if the rules test and hold gate are live before Oct 2.
---

# Payment definitions proposal

## Status and authority

- **Proposal only.** Due by Sep 30 (ruling 2, `2026-09-24-founder-rulings.md`). The mainnet payout is a committed target (`2026-09-23-schedule-rulings.md`, ruling 1); verified linking is live since the Sep 24 cutover.
- Approved policy this builds on (`2026-09-19-h-design-open-decisions.md`): **3% of the settlement pot before contributor allocation**; **100,000 MYCEL minimum hold**; **per-wallet pot cap 25% below 20 paid contributors, 15% from 20**; **the first paid epoch opens after the rules test and raid flow are live; earlier buckets are retained**. O5: allocation weight is exact point units, money is integer lamports, allocations floor, dust stays retained.
- H-CONTRACT Part B (`2026-09-25-h-contract-proposal.md`) supplies the leaf and manifests these amounts go into.
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`), effort xhigh, Windows.

## Finding that changes the plan

The rules test is not built, and epoch 1 opened on Sep 25 without it. Under the approved "first paid epoch opens after the rules test … is live" rule, **epoch 1 cannot be the first paid epoch**. Its points are retained (visible, never paid).

The first epoch that can be paid is **epoch 2 (2026-10-02T00:00Z → 2026-10-09T00:00Z)**, if the rules test and the hold gate are live before 2026-10-02T00:00Z. It closes Oct 9, three days before the deadline, so the payout lands Oct 9–10. If either misses Oct 2, no epoch that fits before Oct 12 can be paid under the current policy. That makes P12 the most time-critical item on this list.

## What you are saying yes to

| # | Proposal | Recommendation and why |
|---|---|---|
| P1 | **Pot source for the first mainnet payout: the Hyphae Lab funds it** from a Lab-controlled wallet. It is not Organic's fee collection. | **Yes.** The Organic → Hyphae funding route (DEP-02) waits on an unresolved ruling. A Lab-funded pot is honest about where the money comes from and needs nobody else. |
| P2 | **Pot amount for the first payout: 0.5 SOL.** | **Your number; 0.5 SOL recommended.** Big enough that a 25%-capped share is visible on a block explorer, small enough to be a demonstration, not an incentive promise. |
| P3 | **Asset: native SOL, in lamports.** | **Yes.** The leaf already carries lamports, and SOL needs no token account per claimant. |
| P4 | **Custody: a program-owned vault PDA per community.** Anyone can deposit. Only the publish and claim instructions move funds out: the fee at publish, each allocation at claim. No admin withdrawal and no sweep in v1. | **Yes.** The whitepaper promises a vault anyone can fund. With no withdrawal path, even the admin key can't take contributor money. |
| P5 | **Publish authority: one admin key, held by Cisco**, stored on the community account. It publishes the root, the audit hash, the epoch pot and the fee. It cannot move funds anywhere else. | **Yes.** The smallest authority that works; its power is bounded by P4. |
| P6 | **Epoch pot = gross.** At publish the admin names the epoch's gross pot `G` (at most the vault's unassigned balance). That is the amount the 3% applies to. | **Yes.** "3% of the settlement pot before contributor allocation" reads directly as a fee on the gross pot. |
| P7 | **Fee = `floor(G × 300 / 10,000)` lamports, transferred at publish** to a Hyphae fee address fixed on the community account. Net pot `N = G − fee`. | **Yes.** Rounding down favors contributors. Deducting at publish makes the fee one visible transaction before anyone claims. |
| P8 | **Fee recipient: a dedicated Hyphae fee address** that Cisco controls, separate from the Lab funding wallet. | **Yes, and you name the address.** Keeping it separate means the fee shows up as a fee in the audit, not as money moving between Lab wallets. |
| P9 | **Payable member** = all of: the wallet link valid at `closes_at` has `method = 'signature'` (`walletAt`); holds at least 100,000 MYCEL when the snapshot is taken (hold gate); passed the rules test before `closes_at`; positive exact points. | **Yes.** It enforces the approved policy and D3's "the wallet verified at close". |
| P10 | **Allocation:** each payable member gets `floor(N × units_m / Σ units_payable)`, capped at 25% of `N` (15% from 20 paid contributors). A non-payable member's weight is **left out of the denominator**; their points stay visible with the reason (`no_verified_wallet`, `below_hold`, `no_rules_test`). | **Yes.** It pays the eligible members the whole net pot, as far as the cap allows. Cap remainders are retained because policy already says so; nothing says an ineligible member's share should be, and holding it would grow a balance with no rule to release it. |
| P11 | **Retained** = cap remainders + floor dust + unclaimed allocations. It stays in the vault and is shown as three separate numbers. | **Yes.** O5 and the integration contract: retained is a reconciled number, never "pot minus something". |
| P12 | **The first paid epoch is epoch 2.** It needs the rules test and the hold gate live before 2026-10-02T00:00Z. Epoch 1 stays unpaid and retained. | **Yes.** That is what the approved policy says. The alternative is to waive the rules test for the Lab's first payout, which would be a policy change and yours alone to make. Recommended: keep the policy and build both gates by Oct 1. |
| P13 | **Evidence of payment.** Funded = a verified deposit transaction into the vault. Allocated = the published root and audit hash (publish transaction). Fee = the publish transaction's transfer. **Paid = a claim receipt PDA** (`["claim", epoch, wallet]`) plus its transaction. The audit page reads these on-chain, not from a database string. | **Yes.** The integration contract: a root or a stored `claim_tx` alone does not prove payment. |
| P14 | **How it is shown.** Per epoch: gross, fee, net, allocated, claimed, unclaimed, cap remainder, dust, each with its transaction. Per member: `allocated` (claimable) or `paid` (with transaction). Until publish, the whole section is `unavailable`. Epoch 1 shows "retained: epoch before the first paid epoch". | **Yes.** It never shows allocation as paid, and never shows a missing number as zero. |
| P15 | **No claim deadline in v1.** Claims stay open; unclaimed stays in the vault and is shown as unclaimed. | **Yes.** A deadline needs a sweep instruction, which P4 rules out. Revisit after the hackathon. |
| P16 | **Hold-gate dependence.** The hold check uses the Sentinel SDK hold gate (`checkHold`, consumer guide §6), run for every candidate payable member at snapshot time and recorded in the member-epoch manifest's settlement inputs. Its own plan comes next. | **Yes.** Without a recorded hold result, P9 can't be audited. |

A "no" on any line sends it back. P2 and P8 need a value from you: the amount and the fee address.

## Worked example (0.5 SOL, epoch 2)

- `G` = 500,000,000 lamports. Fee = floor(500,000,000 × 300 / 10,000) = 15,000,000. `N` = 485,000,000.
- Three payable members with 255, 85 and 40 exact points (units in the same ratio); one member with 60 points and no signed wallet.
- Uncapped shares: 255/380 × N = 325,460,526; 85/380 × N = 108,486,842; 40/380 × N = 51,052,631 (floored).
- Cap 25% of N = 121,250,000. The first member is capped at 121,250,000 (204,210,526 of cap remainder); the others are under the cap.
- Allocated 280,789,473; cap remainder 204,210,526; dust 1 lamport (485,000,000 − 280,789,473 − 204,210,526). All retained amounts stay in the vault, shown separately.
- The unsigned member's 60 points show with `no_verified_wallet` and get no leaf.

## Out of scope here

Organic fee collection and its mapping to Hyphae epochs (DEP-02, DEP-03); non-MYCEL square-root stake weighting; compensation after close; campaign eligibility (DEP-08).
