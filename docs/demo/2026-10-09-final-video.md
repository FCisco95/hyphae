# Final video — script (Sun 2026-10-11)

Plan Week 4 #6. Under 3 minutes, recorded in Loom. Built from `docs/BUILDLOG.md` and shipped evidence only. Rescheduled 2026-10-08: epoch 2 now closes 2026-10-10T00:00Z, so the recording moved to October 11, after C22.

Every claim carries a commit, a linked mainnet receipt or a page as evidence. Devnet evidence is explicitly labeled and used only for the historical refused duplicate claim. Each beat has one label:
- **historical:** happened and was recorded at the time;
- **devnet:** on Solana devnet, with signatures;
- **locally tested:** a passing test on a named commit;
- **mainnet:** the October 10 finalized transactions in the public receipt index.

No traction number is said unless the build log recorded it. Nothing is called live unless the build log says it was deployed.

## Before recording

**Verified October 11:** epoch 2 was published on Solana mainnet on October 10. All four payees claimed 1,238,881,509 lamports, unclaimed 0; three payees are non-founder community members. C14–C22 are complete. The community, vault, publication, claims, IDL and fresh program hash are in the [public receipt index](https://github.com/FCisco95/hyphae-program/blob/main/docs/2026-10-10-mainnet-payout.md). The API and worker last recorded image is `jev-e5f864b`; the reviewed post-payout release is held until Cisco approves E0–E6. Epoch 3 still uses `reward-eval/2`; no scorer amendment is part of this recording arc. Re-read the live pages before recording. Never describe a local commit as deployed.

1. Open the [epoch 2 settlement](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2). It must show published on mainnet and four paid claims; compare it with the public receipt index.
2. Read `git status -sb` and the latest approved release record. Do not pull, reset or push held main to prepare a recording. Note the actual deployed SHA and image separately from local main.
3. Open the tabs in the recording guide. Use the literal links below; the mainnet explorer links have no devnet query.
4. If a live page fails, show its actual error. Screenshots in `docs/showcase/` are fixture data, not a mainnet receipt. Record with the real mainnet explorer and Solscan receipts instead.

## Recording guide

- **Window:** the page area exactly 1920 × 1080: Chrome in full screen (F11) on a 1080p display, or DevTools' device toolbar set to 1920 × 1080. Zoom 100%. A clean profile: no bookmarks bar, no extensions in view.
- **Theme:** dark (the operating system's setting; the site follows it). It is the brand banner's look, and every page is built for it.
- **Motion:** reload `/` just before beat 1, so the filaments grow on camera; they grow once per load, in about three seconds.
- **Scrolling:** each landing section starts at the top of the window when opened from its anchor (`/#how`, `/#proof`, `/#trust`, `/#integrate`).
- **Pages, in order** (`<site>` is https://hyphae-delta.vercel.app, `<mint>` MYCEL's mint, `<n>` the epoch the beat names):

| Beat | Page on the site | Also on screen |
|---|---|---|
| 1 | `<site>/` (the hero) | — |
| 2 | `<site>/#how`, step 2 | the Hyphae Lab reply of 2026-09-17 |
| 3 | `<site>/c/<mint>/e/<n>`, the Wallet column | `/link`, Phantom's prompt, `/me` in Hyphae Lab |
| 4 | [Community](https://solscan.io/account/HRkBN4sX7NyPEfa4SfRoTsP1dynmPDLMYbY7qLa4XbRX), then [vault](https://solscan.io/account/AC3zkGQ9abJs6sssaY5nDX8Qjv2UM19r4JYLgcHoG86K) | C16 [aensGhPg…aQJSghNX](https://explorer.solana.com/tx/aensGhPgR8XBz5unAugUd9bJai3WbyUoJFwCLKmGn5kqUjsTNYNSQXR9oraAx9FitJac74tK9fYyCTBaQJSghNX) and C18 [5spBxwDa…i1c7rjtj](https://explorer.solana.com/tx/5spBxwDa9jbMbvZup3bR1aU5t2HVoYb24U2JLvX4dx8U6GJehDr1i1pgepxqTtodJf2ykRTP95dHGMBqi1c7rjtj) |
| 5 | [Epoch 2 settlement](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2) | C20 [4qhKtnsV…Xop6EnLm](https://explorer.solana.com/tx/4qhKtnsVD78xpvRPdi7TQ1fcF86FjiueCFZNq6a11yfSQ7Q4UeXboGaRtzTDtyMnFbDtVywHGzgytrXqXop6EnLm) |
| 6 | [Epoch 2 claim page](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2/claim), then the four paid rows | C21 [5iBbZVJE…vD6sZn55](https://explorer.solana.com/tx/5iBbZVJEnjr9tvpHZ2dFYgsKAxy5tSvqQ3bUCaXY4fDGgH9PfomphF8SuTFrFqvpbFdLLE89AHZSSQRUvD6sZn55) and the three member claims below |
| 7 | `<site>/#trust` (the build hash and the custody policy) | the terminal's `solana-verify` |
| 8 | `<site>/#integrate` | the public README's vault section; live `/docs` on the api (C7 completed October 2) |
| Close | `<site>/` | — |

## Beat 1 — who this is for (framing) · ~15 s

**Show:** the landing page's hero at `<site>/`, reloaded so its filaments grow.

**Say:** "Every coin has people doing its work: replying, quoting, explaining. They get paid in vibes, or by whoever the admin remembers. Hyphae pays them from a community vault, by published rules, and anyone can check every payout."

**Evidence:** the claims are beats 2–7; this beat only frames them.

## Beat 2 — the bot grades a reply and shows why (historical, 2026-09-17) · ~25 s

**Show:** the Hyphae Lab reply to "I post this to test the scoring bot": raw 3, credited 0, `off_topic`, with the reasoning. Then the site's `<site>/#how`, step 2.

**Say:** "A member sends the bot their reply. It's graded against a public rubric, and the reasoning is posted back. My own test reply scored raw 3, credited zero: off-topic. The raw score, the rules version and the prompt hash are stored with every grade."

**Evidence:**
- the scoring loop: build log 2026-09-17 (evening), commits `22b0875` (queue and job), `4b76770` (`/submit`, `/raid`), `48e61f9` (credit rules);
- the rubric: `docs/rubrics/mycel-1.0.0.json` … `mycel-1.2.0.json`;
- numbers you may say: 3 contributions, 6 scoring runs, credited 85, 0 and 0, $0.084 total spend (same entry).

## Beat 3 — only a wallet that signed gets paid (historical, 2026-09-24) · ~20 s

**Show:** `/link` in Hyphae Lab, then Phantom's signing prompt, then `/me` showing "verified". Then an epoch page, `<site>/c/<mint>/e/<n>`: a verified wallet is shown in green, any other as "unverified".

**Say:** "To be paid, a member proves their wallet by signing a message. Pasting an address isn't enough. A closed week always pays the wallet that was verified at its close."

**Evidence:**
- the linking build and the wallet-at-close rule: build log 2026-09-24 (night), commits `a4265f7`..`3e00174`;
- live: build log 2026-09-24 (evening), the cutover deployed `b7bfe55` and Phantom signed in Hyphae Lab (`docs/handoffs/2026-09-24-cutover.md`).

## Beat 4 — a community's vault on Solana mainnet (mainnet, October 10) · ~25 s

**Show:** the MYCEL [community](https://solscan.io/account/HRkBN4sX7NyPEfa4SfRoTsP1dynmPDLMYbY7qLa4XbRX) and [vault](https://solscan.io/account/AC3zkGQ9abJs6sssaY5nDX8Qjv2UM19r4JYLgcHoG86K), then C16 [aensGhPg…aQJSghNX](https://explorer.solana.com/tx/aensGhPgR8XBz5unAugUd9bJai3WbyUoJFwCLKmGn5kqUjsTNYNSQXR9oraAx9FitJac74tK9fYyCTBaQJSghNX) and C18 [5spBxwDa…i1c7rjtj](https://explorer.solana.com/tx/5spBxwDa9jbMbvZup3bR1aU5t2HVoYb24U2JLvX4dx8U6GJehDr1i1pgepxqTtodJf2ykRTP95dHGMBqi1c7rjtj). These are mainnet links.

**Say:** "On October 10, my Ledger created MYCEL's community vault on Solana mainnet. I funded it with 1.5 SOL from my own wallet. The vault has no withdraw instruction: funds leave as the fixed 3% fee or a valid member claim."

**Evidence:** C16 creates community `HRkBN4…XbRX` and vault `AC3zkG…oG86K`; C18 transfers 1,500,000,000 lamports. The fee recipient is the MYCEL Treasury `rRceAUBN…u7MK`. The [public program source](https://github.com/FCisco95/hyphae-program/tree/main/programs/hyphae/src) defines publish and claim, with no withdraw. [Receipt index](https://github.com/FCisco95/hyphae-program/blob/main/docs/2026-10-10-mainnet-payout.md).

## Beat 5 — the week's payout list goes on-chain (mainnet, October 10) · ~25 s

**Show:** [epoch 2's settlement panel](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2), then C20 [4qhKtnsV…Xop6EnLm](https://explorer.solana.com/tx/4qhKtnsVD78xpvRPdi7TQ1fcF86FjiueCFZNq6a11yfSQ7Q4UeXboGaRtzTDtyMnFbDtVywHGzgytrXqXop6EnLm) and the [decoded epoch account](https://solscan.io/account/J7ipBhK2eJu8QFGtXTsYWNDhPYzcerwX22UkkJTaCPXG#accountData).

**Say:** "The week's payout list is committed as one merkle root, beside the hash of its audit record. This mainnet epoch allocated 1.238881509 SOL to four wallets, including three community members other than me. The Treasury received 0.045 SOL. The cap remainder stayed in the vault."

**Evidence:** C20 `publish_epoch` at 2026-10-10 13:09:22Z; gross 1.5 SOL, fee 45,000,000 lamports, allocation 1,238,881,509; cap remainder 216,118,490, dust 1. C19's recorded plan and C20's decoded account match the [receipt index](https://github.com/FCisco95/hyphae-program/blob/main/docs/2026-10-10-mainnet-payout.md) and [live API](https://hyphae-api.fly.dev/v1/communities/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/epochs/2). These are allocation amounts; do not call the remainder the vault's rent-inclusive balance.

## Beat 6 — all four members claimed (mainnet, October 10) · ~25 s

**Show:** [epoch 2's claim page](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2/claim), then its four paid rows and the [decoded founder claim receipt](https://solscan.io/account/C7nEMEavZm9BE8i2jFVK3Lq1sWA1TKTqtHws9iUxMDP9#accountData). Open C21 [5iBbZVJE…vD6sZn55](https://explorer.solana.com/tx/5iBbZVJEnjr9tvpHZ2dFYgsKAxy5tSvqQ3bUCaXY4fDGgH9PfomphF8SuTFrFqvpbFdLLE89AHZSSQRUvD6sZn55), then one non-founder claim. No new transaction is needed for this recording.

**Say:** "I claimed my own allocation through Phantom. The other three payees claimed too: all 1.238881509 SOL is paid, with zero unclaimed. Each claim leaves a receipt containing its score, amount and evidence hash. The page says paid only when that receipt is on-chain."

**Evidence:**

- **C21, founder:** [5iBbZVJE…vD6sZn55](https://explorer.solana.com/tx/5iBbZVJEnjr9tvpHZ2dFYgsKAxy5tSvqQ3bUCaXY4fDGgH9PfomphF8SuTFrFqvpbFdLLE89AHZSSQRUvD6sZn55) — 363750000 lamports to `MAoRn1JFD66gcXHiCqcAgppXBCR4TP8pKT4XV7HVhAB`; [decoded claim receipt](https://solscan.io/account/C7nEMEavZm9BE8i2jFVK3Lq1sWA1TKTqtHws9iUxMDP9#accountData).
- **Member claim 1:** [2gbAmxM6…Wh4ek1tK](https://explorer.solana.com/tx/2gbAmxM6Q4LPC8R68wRbRyGKn7nD97vRZJ4FVD8eZucJab82LtDGFB1oK3d2TnzkkXM2m45aG6EpQc8QWh4ek1tK) — 223351074 lamports to `GsirkxvyAaNsvDCXFUJBh7vf3cMpv5X1wmBTwvHeXgt3`; [decoded claim receipt](https://solscan.io/account/Hti2rp3dNmzkdQjWoHxcYSa58tJc2b6D5my2hqmVrioa#accountData).
- **Member claim 2:** [59kNeiZ5…nGtAZvSy](https://explorer.solana.com/tx/59kNeiZ53TqEk9RU5Ujr5Wb6SfkjaRwtXBdBeovR9ZDPQC6H3qcRCd6YyspLDPwXGMmCmLxeZM99bcBsnGtAZvSy) — 363750000 lamports to `2BsmXzsH9fjDVTmkR2hGXfRPFcfv7EHvvF6JdjotneB8`; [decoded claim receipt](https://solscan.io/account/7NGcK4KiMG12Jfre5xBQq1BEHPtD34mMEGrDzTx8NYt#accountData).
- **Member claim 3:** [63tutuXC…vWRLCHzq](https://explorer.solana.com/tx/63tutuXCGdRvHrMZBaF973jDgQoweV5RFRCkmmP9xRG51xga9Xe7dDuAY78YbZA9EZR8WiRc92X88YoDvWRLCHzq) — 288030435 lamports to `4a5G78Rns6g7EUEmRw15Rk6NwNsUeZnQjPDgHbhdigvN`; [decoded claim receipt](https://solscan.io/account/3JfF36qcrxFpm2LgV6dmha2sSvLz7jmiWd82VwnGvGsS#accountData).

C22/P14 is the readback after C21, not a separate signature. The final October 10 read and the fresh October 11 API read both show 4/4 paid, claimed = allocated and unclaimed 0. The IDL publication transactions in the [receipt index](https://github.com/FCisco95/hyphae-program/blob/main/docs/2026-10-10-mainnet-payout.md) explain Solscan's decoded fields.

**Duplicate-claim evidence, optional:** the program rejects a second claim for the same leaf. The recorded refused attempt is [on devnet](https://explorer.solana.com/tx/5ob9A3Sg7DYoxCAMLDyX5EpuT2jSF6QBsruPRLf4tdTdTCSkfZCdXSkMuWLuqkFEPQC3eQJVGgzosxdLQbA2EknP?cluster=devnet). Label that shot **devnet**; do not imply a refused mainnet attempt occurred.

**Don't claim:** soulbound points in the wallet. The Token-2022 points mint was not built. X ownership is operator-attested, not verified by the system.

## Beat 7 — anyone can check it (mainnet hash, recorded reproducible build) · ~25 s

**Show:**
1. The terminal: `solana-verify get-program-hash -u https://solana-rpc.publicnode.com EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E` prints `7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac`.
2. The recorded reproducible build hash in the public [program README](https://github.com/FCisco95/hyphae-program#verify-the-build). Rebuild from a fresh clone only if showing a new build; the October 11 check re-read the chain hash.
3. The site's `<site>/#trust`: the same hash, and the custody policy word for word.

**Say:** "The program on chain is byte for byte what its public repository builds in Anchor's pinned Docker image. The custody rules are public. The key that publishes each root decides where that week's pot goes, and the program can be upgraded. The policy keeps both keys on a hardware wallet."

**Evidence:**
- the verifiable build and its readback: `docs/handoffs/2026-09-28-verifiable-build-and-deploy-rehearsal.md`, commit `a6da160`;
- the custody policy: `37d09cc`, and `CUSTODY_POLICY` in `packages/core`; the key rulings: `docs/handoffs/2026-09-27-keys-and-fee-rulings.md`;
- the program security review (three rounds, no fund-loss path): `docs/handoffs/2026-09-27-afternoon-arc.md`.

**Mainnet evidence:** the October 11 full hash read is in the [public receipt index](https://github.com/FCisco95/hyphae-program/blob/main/docs/2026-10-10-mainnet-payout.md); C13 records deployment and Ledger authority. No on-chain explorer verification registration is claimed.

## Beat 8 — any project can fund a vault, and read everything (locally tested) · ~20 s

**Show:**
1. The site's `<site>/#integrate`: the read API and the proof check.
2. The section "Funding a community's vault" of the public `hyphae-program` README: the PDA seeds.
3. `/docs`, the OpenAPI reference, and one `GET /v1/wallets/{wallet}/claims` response; C7 completed October 2. An empty result is shown as empty, not as evidence of payment.

**Say:** "A vault's address comes from the coin and its admin, so any project can find it and fund it. Everything on the page is in a public API: communities, weeks, every score with its reasons, and every claim with its proof."

**Evidence:**
- the wallet-claims route and rate limits: `d712289`, `6e48b12`; OpenAPI and `/docs`: `135a80f`;
- the README integration: `1d56e5d`.

Say "deployed" for the community/epoch routes, wallet claims, `/v1/openapi.json` and `/docs`: they have answered 200 from production since October 2 C7 and again on October 5 (receipts in the packet). The API and the worker now both run image `jev-e5f864b` (`sha256:b3f5617d…`, since 2026-10-07 21:36Z); never say "Fly v11" for the API. Cite the packet's newest read-back, not a deployment inferred from current `main`.

## Close · ~5 s

**Show:** `<site>/`.

**Say:** "Hyphae: pay the people who do the work, and show everyone how."

## Out of the video

These were not built or are not live; the video must not imply them:
- soulbound Token-2022 points;
- the Codama client;
- the web `/admin` page (plan Week 4 #3, dropped by Cisco on 2026-09-27);
- the fixture data in `docs/showcase/`'s settled-epoch and claim pages, as if it were real;
- "open source" (both repositories are BUSL 1.1, source available; both the application repo and the program/rubric repo are public in `FCisco95/hyphae-program`);
- tester or member counts past what the closed epoch records: epoch 2 had 33 contributions from 9 members, with 4 payees; this is one pilot epoch, not an active-user claim;
- members using the private raid buttons, receipts, `/issue` or raid alerts: they are deployed on the API since October 5 and the operator view and receipt lookup were exercised by Cisco only; no member has used them, and no alert subscriber or real-phone test exists;
- X relation or account ownership as verified (the system records an attestation, not proof);
- any mainnet transaction that Runbook C did not record.
