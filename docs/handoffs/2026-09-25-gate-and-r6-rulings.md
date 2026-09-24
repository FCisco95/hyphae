---
date: 2026-09-25
summary: Cisco answered the six open questions of the payout-gates handoff with "all yes" (2026-09-24 ~22:40Z, recorded on the vault Integration Board). Q1–Q6 are accepted exactly as recommended, so no gate code changes. The same ruling authorizes the Anchor program and R6 now, for local and devnet work only; mainnet stays a hard stop. The P8 fee address is still to be named by Cisco before Oct 1 and stays a parameter until then.
---

# 2026-09-25 — gate questions and the R6 + Anchor authorization

## Words and context

The payout-gates handoff (`docs/HANDOFF.md` at `86ff258`, "Open questions") listed six questions, each with a recommendation. The vault's Integration Board then asked Cisco for six decisions, two of them about Hyphae: the six questions, and whether R6 and the Anchor program could start before the Sep 30 checkpoint. Cisco answered on 2026-09-24 at about 22:40Z: **"all yes"**.

## What that rules

| Item | Ruling | Source |
|---|---|---|
| Q1, RT2 quiz text | **Yes.** The six questions as built, with Q2 naming the coin, Q3 saying "count" and Q5 without "a strike". | `2026-09-26-rules-test-scope-proposal.md` RT2; `apps/api/src/payout/rules-test.ts` |
| Q2, RT3 | **Yes.** The rules test gates payment only, not `/submit`. | RT3 |
| Q3, PG5 + PG10 | **Yes.** An undecided hold holds the whole epoch. Only a read within 24 h of the close counts. A member still undecided after that keeps the epoch blocked until Cisco rules. | PG5, PG10; `gate.ts` `hold_checks_pending` |
| Q4, PG6 | **Yes.** Nobody payable means publish nothing and take no fee. | PG6; `gate.ts` `no_payable_members` |
| Q5, PG8 | **Yes.** The first paid epoch lives in `communities.first_paid_epoch`, set by Cisco after the Oct 1 go/no-go. Nothing is payable until then. | PG8; migration 0009 |
| Q6, P9 reading (Codex H1) | **Yes.** "Held at the close" means the first confirmed two-provider read after the close, within 24 h. | `2026-09-24-payout-gates-built.md`, review round 2 |
| R6 + Anchor | **Authorized now, local and devnet only.** This lifts, for local and devnet work, the exclusion of "R6, settlement, root, claim, pot" in `2026-09-23-r3-r5-approval.md`. Any mainnet action (program deploy, vault funding, publish) stays a hard stop needing Cisco's separate yes. | Integration Board ruling 2 |
| P8 fee address | **Cisco names it before Oct 1.** Not yet given. Code takes it as a parameter; nothing defaults to a real address. | Integration Board ruling 6 |

## Consequences

- **No gate code changes.** Every recommendation was accepted, and the built gates already implement them (`86ff258`).
- The quiz text is final, so the deploy no longer waits on Q1. Cisco's deploy steps are unchanged: apply 0009, set `HOLD_RPC_HELIUS_URL` and `HOLD_RPC_FALLBACK_URL`, deploy, before 2026-10-02T00:00Z.
- The Anchor program and R6 are built in this arc against H-CONTRACT Part B and payment rulings P1–P16 (`2026-09-24-contract-and-payment-rulings.md`), tested on LiteSVM, and run once on devnet with a throwaway keypair. Nothing in them gets a production caller until Cisco turns it on.
- Out of scope, still separate yeses: mainnet program deploy, vault funding (P2, 0.5 SOL), the mainnet publish, and `first_paid_epoch = 2`.
