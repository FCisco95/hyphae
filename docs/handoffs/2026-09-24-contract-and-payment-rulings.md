---
date: 2026-09-24
summary: Cisco accepted every recommendation of the session-end report ("I like all your recommendations."). H-CONTRACT Part A (A1–A15, admin handle admin:cisco) and Part B (B1–B10) are ruled yes; the payment definitions P1–P16 are ruled yes, with a 0.5 SOL pot and the fee address still to be named; epoch 2 is the first paid epoch. The audit-page build starts on this ruling.
---

# 2026-09-24 — H-CONTRACT and payment rulings

## Words and context

At the end of the session that wrote the proposals, the report listed the open questions, each with a recommendation. Cisco answered in-session: **"I like all your recommendations."**

## What that rules

| Item | Ruling | Source |
|---|---|---|
| H-CONTRACT Part A, A1–A15 | **Yes to all.** The public admin actor handle is **`admin:cisco`**. | `2026-09-25-h-contract-proposal.md` § Part A |
| H-CONTRACT Part B, B1–B10 | **Yes to all.** Ruled early; it was due Sep 30. | same file, § Part B |
| Payment P1–P16 | **Yes to all**, including P9 (who is payable) and P12 (epoch 2 is the first paid epoch; epoch 1 stays unpaid and retained). | `2026-09-25-payment-definitions-proposal.md` |
| P2 pot amount | **0.5 SOL** for the first mainnet payout. | same |
| P8 fee recipient | A dedicated Hyphae fee address, separate from the Lab funding wallet. **The address itself is still to be named by Cisco** (needed before the mainnet publish). | same |
| Bot token re-rotation | Runbook B step 9, done by Cisco, recommended for Sep 25 before testers join. An action, not yet done. | `2026-09-24-cutover-decisions.md` |
| Parked | The correction script's `--actor admin:<handle>` flag waits for a session whose scope includes `apps/api/scripts`. The read API serves both actor forms meanwhile. | audit-page plan, Files |

## Consequences

- **Step 8 is authorized:** the read API v1 and `apps/web` build per `2026-09-25-audit-page-plan.md` (ruling 1 of `2026-09-24-founder-rulings.md`: the build starts on the Part A ruling). No task changes, since no line was ruled "no".
- The rules test and the hold gate must be live before 2026-10-02T00:00Z for epoch 2 to be payable (`2026-09-25-plan.md`). Their plans come next after the audit page.
- Deploying the api, creating the Vercel project, and any mainnet action stay separate hard stops.
