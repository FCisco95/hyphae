---
date: 2026-09-23
summary: Founder rulings on the September 22 calendar rebaseline (mainnet payout stays a committed hackathon target; the public audit page wins any time tradeoff), two recommendations awaiting confirmation (Lab-controlled wallet for the devnet demonstration; one combined R3–R5 scope approval with sequential stages and a review after each), and the standing precondition that verified tester wallet linking lands before any real mainnet payment to testers.
---

# 2026-09-23 — schedule rulings

## What this records

The R2 scope proposal (`docs/handoffs/2026-09-21-r2-scope-proposal.md`, last section) proposed a Week 2–4 calendar and asked two founder questions. Cisco answered both. This file records those answers, two recommendations that still need his yes, and one precondition that follows from the first ruling. It changes no code and authorizes no implementation.

## Confirmed founder rulings

| # | Question (from the rebaseline) | Ruling | Consequence |
|---|---|---|---|
| 1 | Does a mainnet payout remain a hackathon target? | **Yes, committed.** | H-CONTRACT (claim leaf and commitment contract, admin actor) and the fee, funding and payment definitions must close by Sep 30 so the Anchor window (Oct 3–5) and a mainnet deploy fit. They stay separate gates; this ruling schedules them, it does not decide them. |
| 2 | If only one fits, does the web audit page rank above the on-chain claim? | **Yes, the public audit page takes priority.** | When a window slips, the audit page (Oct 1–3) keeps its time and the on-chain claim work absorbs the slip. The payout target stays committed; it is the first thing to move, not the first thing to cut from the plan. |

## Precondition that follows from ruling 1

**Verified tester wallet linking before paying real testers on mainnet.** Today `/link` accepts a pasted address and `onConflictDoUpdate` rewrites the wallet on the existing member row (`apps/api/src/bot/commands/link.ts`). The `link_method` enum already has a `signature` value, but nothing writes it. A payout to a pasted, unverified, mutable address is not acceptable for real testers. Two routes, both separately authorized: adopt the released Organic verification SDK (Sentinel adoption gate), or a Hyphae signed-message link. Either must also stop a wallet change from retargeting a frozen epoch manifest (O2: account migration needs the identity/auth design). No window in the rebaseline scheduled this; the tomorrow plan places the decision, not the build.

## Recommendations awaiting confirmation

| # | Recommendation | Why | If declined |
|---|---|---|---|
| A | **Lab-controlled wallet for the devnet demonstration.** The devnet register → publish → claim run uses a wallet the Hyphae Lab controls, clearly labelled as such on camera and in the build log. | Keeps the devnet demo off the wallet-verification critical path. No real tester is paid on devnet, so an unverified tester address buys nothing and a Lab wallet is honest about what is shown. | Devnet claim waits for verified linking, which moves it behind the wallet window. |
| B | **One combined scope approval for R3–R5, sequential implementation, independent review after each stage.** Cisco approves `docs/handoffs/2026-09-23-r3-r5-scope-proposal.md` once. R3 is built, reviewed and merged before R4 starts; R4 likewise before R5. Each review can still send the stage back. | Saves two proposal round-trips (about a day of the ~1 day of slack the Sep 22 weekly review found) without merging unreviewed work. | Each stage gets its own proposal and yes, as R2 did. |

## Calendar after the rulings (proposed, not adopted)

Unchanged from the rebaseline except where the rulings and today's state move it. Colosseum ends 2026-10-12 23:59 PDT.

| Window | Ships | Depends on |
|---|---|---|
| Sep 23 | This checkpoint: rulings, R3–R5 scope proposal, tomorrow plan | — |
| Sep 24 | Public whitepaper (short), existing-evidence demo script, tester checklist. R3 starts test-first on `feat/r3-slots-dispatch` if approved | Scope approval (recommendation B) |
| Sep 24–26 | R3 implemented, reviewed, merged. Weekly video #2 (Fri Sep 25) uses existing evidence only | R3 approval |
| Sep 27–28 | R4 effective reads, `/me` epoch-scoped | R3 merged |
| Sep 29–30 | R5 unfunded close snapshot. Separately: H-CONTRACT, fee/funding/payment definitions, wallet-linking route decided | R4 merged; founder/contract gates |
| Oct 1–3 | `apps/web` public audit page on R4/R5 reads (priority per ruling 2) | R4/R5 |
| Oct 3–5 | Anchor instructions, LiteSVM tests, devnet run with the Lab wallet (recommendation A) | H-CONTRACT |
| Oct 6–8 | Verified linking, mainnet deploy, first real payout; otherwise security review and polish | H-CONTRACT, fee/funding/payment, verified linking, separate cutover and payment authorization |
| Oct 9 | Final video | — |
| Oct 10 | Submit; buffer to Oct 12 | — |

Elapsed Week 1–2 targets are not converted into extra hours. Nothing in this table is a completed prerequisite.

## Not changed

H-FIXTURES, H-CONTRACT, fee/funding/payment, campaign and Sentinel adoption gates keep their owners. No Neon migration apply, deployment, settlement, root, claim or paid run is authorized here.
