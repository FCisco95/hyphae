---
date: 2026-09-27
summary: Draft only, not published anywhere. This is the public custody wording that Q1 (trusted-publisher pilot) requires before the first payout. It is Cisco's decision 2 on the Integration Board, unanswered at the time of writing. The draft adds one fact the board's text leaves out: the program's upgrade authority, which the Sep 27 security review raised. It also lists where the approved text goes.
---

# Custody wording: draft for decision 2

## Why a draft, not the site

Q1 ruled a disclosed trusted-publisher pilot, and the public wording is Cisco's to approve (`2026-09-27-completion-and-custody-rulings.md`). Decision 2 was not answered when this was written, so the text lives only here. What changed in public copy now is limited to removing overclaims:

- README: no soulbound points, no live audit, devnet only.
- Whitepaper § 5: it said "nothing withdraws from it". It now states that the admin key publishes each root and so chooses where each epoch's pot goes.

## The board's recommended text

> Pilot policy: we keep the publisher key on a hardware wallet and fund one epoch at a time, just before it pays. That key sets each epoch's payout list, so you trust it with that epoch's pot. The program has no withdraw: SOL leaves the vault only through member claims and the 3% fee.

## Recommended text (the board's, plus the upgrade authority)

> **Pilot policy.** Hyphae's publisher key sets each epoch's payout list, so you trust it with that epoch's pot. We keep that key on a hardware wallet and fund one epoch at a time, just before it pays. The program has no withdraw instruction: SOL leaves the vault only through member claims and the 3% fee. The program can still be upgraded. The upgrade key is held the same way, and any upgrade is announced here before it is used.

Why the addition:
- The security review (Codex gpt-6-astra, Sep 27) found that "no withdraw instruction" holds only for the deployed program. Whoever holds the upgrade authority can replace it.
- Without that sentence, "the program has no withdraw" reads as a permanent guarantee, which it is not.
- The last sentence commits to a practice (hardware custody, announce before use), so it needs Cisco's yes like the rest.

The alternative is to make the program immutable at mainnet deploy. Then the last two sentences become "The program cannot be upgraded." It is not recommended for the pilot: a bug found after deploy could not be fixed, and the pot could then only be paid out through the existing claim path.

## Where it goes, once approved

| Place | What |
|---|---|
| `/rules` in the bot | The full text, after the scoring rules. |
| Epoch page, settlement panel (`apps/web/components/views.tsx`) | The first two sentences, linking to the full text. |
| README, "Funding a community's vault" | The full text, replacing the bullet about how SOL leaves the vault. |
