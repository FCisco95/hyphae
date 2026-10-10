---
date: 2026-10-10
summary: First mainnet payout complete. Epoch 2 published with 1.5 SOL, all four payees claimed, IDL on-chain. Next is the hackathon submission; the held release and main push still need Cisco's decision.
---

# Hyphae handoff

## TL;DR

**Epoch 2 is fully paid on Solana mainnet (2026-10-10).** Community `HRkBN4…XbRX` and vault `AC3zkG…oG86K` were created and bound. Epoch 2 was published with the Ledger: 1.5 SOL gross, 0.045 fee to the MYCEL Treasury, 1.238881509 SOL to 4 wallets, 0.216 SOL cap remainder kept in the vault. **All 4 claimed**, so claimed = allocated and unclaimed = 0. The canonical IDL is published, and Solscan decodes claim receipts (score, amount, evidence hash) in plain text. Final read and every receipt: [payout complete](handoffs/2026-10-10-payout-complete.md), [payout session](handoffs/2026-10-10-payout-session.md).

**Next:** the hackathon submission (deadline Oct 12): demo video, post 4, Colosseum form. Then Cisco's decision on the held `next` release and on pushing `main`.

## Current state

| Surface | State |
|---|---|
| Git | `main` 36+ commits ahead of `origin/main` (includes held member-login code). Payment docs pushed to `origin/hold/hyphae-member-login` only. `next` 1249fed held, untouched |
| Production | Fly API and worker on `jev-e5f864b`, journal 18, health ok. Epoch 3 open Oct 10 → Oct 17 00:00Z on Haiku `reward-eval/2` |
| Chain | Program `EAz8Wk…4d6E`, hash `7e902d1b…43ac`, upgrade authority = Ledger admin. Admin holds 0.0069 SOL. Vault holds the 0.216 SOL remainder + rent. IDL metadata `zxj1hrV2…c9d` |
| Website | Live site unchanged (serves `origin/main`). Local member login stays disabled |

## Next actions

1. **Submission:** record the demo video (prints folder + Solscan decoded receipt), post 4 on X, Colosseum form, reviewer access. Post 3 is scheduled for Oct 11 morning.
2. **Held release:** the "after C22" precondition is met. Ask Cisco for an exact yes on [the release plan](demo/2026-10-11-release-plan.md) before merging `next`, applying 0018+0019 or amending epoch 3. Preserve both histories.
3. **Pushing `main`:** needs Cisco's release decision and the full local gate (`pnpm test`, `pnpm typecheck`, `pnpm lint`). Until then push only `main:hold/hyphae-member-login`.
4. **Product follow-ups (not built):** claim page (single wallet picker, visible connected state, waiting state with timeout, treasury dashboard); a one-command weekly publish with one Ledger approval; pre-raid eligibility enforcement (needs Cisco's strictness ruling); admin dashboard; publisher-key design for automatic Organic communities.
5. **Carried over:** member login (Phantom failure, refresh persistence), participation-minimum proposal, scorer-v3 questions, `@organichub/verify` 0.1.0 through Oct 12. See [session end Oct 10](handoffs/2026-10-10-session-end.md) and the Oct 9 checkpoints.

## Watch list

- The admin balance funds the epoch account rent (about 0.0014 SOL) and fees for each publish. Top it up before it runs low.
- The vault has no withdraw. Fund one epoch at a time with the existing `init-community plan --gross` top-up formula.
- Keep member identities out of Git. Payee wallets are public on-chain; X handles stay in private notes.
- Repo boundary: never touch `organic-app` or the vault from here.

## Suggested skills

handoff-memory, the-analyst, superpowers:verification-before-completion, hyperframes or faceless-explainer (pitch video), social-media (post 4), superpowers:brainstorming (dashboard and pre-raid enforcement), handoff.

## Next-session prompt

```text
Resume Hyphae after the first mainnet payout. Read docs/HANDOFF.md and docs/handoffs/2026-10-10-payout-complete.md.
Epoch 2 is fully paid (4/4 claimed), IDL on-chain. Focus: hackathon submission by Oct 12 (demo video, post 4, Colosseum form).
Do not push main or merge next without Cisco's exact yes; push only main:hold/hyphae-member-login. No organic-app or vault edits.
```
