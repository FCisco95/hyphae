---
date: 2026-09-27
summary: Cisco answered three of the four Integration Board decisions in-session, each as recommended. Decision 1, build the completion scope now (durable publication bytes, recovery from them, the operator publish script behind a signer interface, P14 and /claim). Q1, a disclosed trusted-publisher pilot for the first payout. Q3, reserve allocated claims only. P8, the fee address, is still to be named by Oct 1.
---

# 2026-09-27 — completion scope, custody and reserve rulings

## Words and context

The Sep 27 session reached step 4 of its arc with steps 1–2 pushed (`355067e`). Step 4 needed decision 1, which the vault Integration Board listed with a recommendation but no answer. The session asked in-session, one question per decision, each with the board's recommendation first. Cisco chose the recommended option for all three.

## What that rules

| Item | Ruling | Consequence |
|---|---|---|
| Decision 1, completion scope | **Yes, build now**, in this session, after the hash work was pushed. | Step 4 runs: migration 0011 (publication and member manifest bytes and hashes stored before any send), recovery from those exact bytes, `apps/api/scripts/publish-epoch.ts` behind a signer interface (file keypair on devnet, hardware wallet on mainnet, no key export), the read API's P14 allocation/claim section with honest unavailable states, and an `apps/web` `/claim` page. Then a fresh Codex Astra xhigh review (step 5). |
| Q1, custody | **Trusted-publisher pilot**: one epoch funded just in time, the publish key on a hardware wallet, the limit stated publicly. | The admin key chooses every root, so it is trusted with each epoch's pot. P4's "even the admin key can't take contributor money" overpromises and is narrowed: no instruction withdraws from the vault, but the publisher decides where an epoch's pot goes. The program is unchanged. The public wording is Cisco's to approve before it ships. |
| Q3, reserves | **Allocated claims only.** Unclaimed allocations stay reserved; cap remainder and dust stay free for later epochs and are tracked separately. | This is what the program already does (`outstanding` reserves the allocated total). No code change; P11's three retained numbers stay separate in the audit. |
| P8, fee address | **Still open.** Needed by Oct 1. | Code keeps it a parameter; nothing defaults to a real address. |

## Not ruled here

Mainnet program deploy, vault funding (P2, 0.5 SOL), the mainnet publish, `first_paid_epoch = 2`, Neon migrations and production deploys each still need Cisco's separate yes.
