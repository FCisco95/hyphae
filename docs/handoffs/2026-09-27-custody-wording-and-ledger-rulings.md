---
date: 2026-09-27
summary: Cisco answered decisions 2 and 3 in-session. Decision 2 ships the amended custody wording, which is the board's text plus the upgrade-key sentences. Decision 3 approves node-hid's native build, and only that, for the Ledger USB transport.
---

# 2026-09-27 — custody wording and Ledger build rulings

## Words and context

The Sep 27 afternoon arc reached steps 6–7, which the vault Integration Board's decisions 2 and 3 gated (27 Sep 13:29Z, recommendations only). The session asked in-session with one recommendation each. The security review had meanwhile found that "the program has no withdraw" holds only while nobody upgrades the program. So the decision-2 question offered the board's text with two added sentences about the upgrade key. Cisco chose the recommended option both times.

## What that rules

| Item | Ruling | Consequence |
|---|---|---|
| Decision 2, public custody wording | **The amended text** from `2026-09-27-custody-wording-draft.md`: the board's wording plus "The program can still be upgraded. The upgrade key is held the same way, and any upgrade is announced here before it is used." | Placed on `/rules`, the epoch page's settlement panel and the README. It commits to holding the upgrade key on a hardware wallet and announcing any upgrade before it is used. |
| Decision 3, `node-hid` native build | **Approve node-hid only.** | `node-hid` alone is allowlisted for pnpm's build scripts. The Ledger USB transport is built and fake-device tested; a real-device devnet `plan`/`publish` is Cisco's step. |

## Not ruled here

The mainnet program deploy, who holds the upgrade authority and on which device, the P8 fee address, vault funding, the mainnet publish, Neon migrations and production deploys each still need Cisco's separate yes.
