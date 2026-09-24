---
date: 2026-09-24
summary: Cisco's 2026-09-24 rulings on the Hyphae schedule, given at ~13:00 Lisbon ("do your recommendation"). H-CONTRACT Part A (read wire schema, admin actor) is ruled by Sep 27 and the audit-page build starts on that ruling; Part B and the fee, funding and payment definitions by Sep 30; cutover Mon Sep 28 after Runbook A on Fri Sep 25. Both runbooks then ran early, on Sep 24, on Cisco's in-session yes, so the cutover is done and only the H-CONTRACT and payment rulings remain open.
---

# 2026-09-24 — founder rulings (schedule)

## Words and source

Cisco approved the organic-sync board's recommendations at about 13:00 Lisbon time (WEST) on 2026-09-24, in these words: **"do your recommendation"**. The board is private; this file records the three rulings that concern Hyphae. The others concern other repositories and are recorded there.

## Rulings

| # | Ruling | Why (the board's recommendation) |
|---|---|---|
| 1 | **H-CONTRACT Part A** (public read wire schema, admin actor) is ruled **by Sep 27**. The public audit page's build starts on that ruling. | Part A is all the audit page needs. |
| 2 | **H-CONTRACT Part B and the fee, funding and payment definitions** stay due **by Sep 30**. | The money terms keep their own time and reading. |
| 3 | **Runbook A (manual wallet check) Fri Sep 25; cutover (Runbook B) Mon Sep 28.** | The code was ready; the weekend is family time. |

Ruling 1 is the authority for building the read API and `apps/web` once Part A itself is ruled. It does not rule Part A: Part A's content still needs Cisco's yes, recorded in `docs/handoffs/` with his words.

## What happened after the ruling

Both runbooks ran earlier than ruled, each on Cisco's own in-session yes:

- **Runbook A** ran on the afternoon of Sep 24, a day early (`2026-09-24-manual-wallet-check.md`).
- **The cutover** ran on the evening of Sep 24, four days early. Cisco said to run it at session start and gave a separate yes at each hard stop: Neon apply, Fly secret, deploy, bootstrap, BotFather menu (`2026-09-24-cutover.md`). Production runs `main` `b7bfe55`; MYCEL epoch 1 runs 2026-09-25T00:00Z → 2026-10-02T00:00Z on rubric 1.2.0.

So ruling 3 is executed and nothing about the cutover date is pending. It took no weekend time, which was the ruling's reason for Monday.

One cutover follow-up stays open. It is an action, not a ruling: the precautionary bot-token rotation after the deploy (Runbook B addendum in `2026-09-24-cutover-decisions.md`). Cisco does it himself, on his own yes.

## Still open after these rulings

| Item | Due | Where |
|---|---|---|
| H-CONTRACT Part A ruling (yes/no list) | Proposed for Fri Sep 25; due Sep 27 | `2026-09-25-h-contract-proposal.md` § Part A |
| H-CONTRACT Part B ruling | Sep 30 | same file, § Part B |
| Fee, funding and payment definitions | Sep 30 | `2026-09-25-payment-definitions-proposal.md` |
