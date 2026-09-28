# Final video — script (Fri 2026-10-09)

Plan Week 4 #6. Under 3 minutes, recorded in Loom. Built from `docs/BUILDLOG.md` and shipped evidence only.

Every claim carries its evidence in brackets: a commit, a devnet signature (open it at `https://explorer.solana.com/tx/<signature>?cluster=devnet`) or a page. Each beat has one label:
- **historical:** happened and was recorded at the time;
- **devnet:** on Solana devnet, with signatures;
- **locally tested:** a passing test on a named commit;
- **mainnet:** only if Runbook C ran, with the signatures it recorded.

No traction number is said unless the build log recorded it. Nothing is called live unless the build log says it was deployed.

## Before recording

1. Read the newest build-log entries. If Runbook C's steps C12–C22 ran (`docs/handoffs/2026-09-28-runbook-c.md`), use the **mainnet swap-ins** below with the signatures that entry records. Otherwise every chain beat says "devnet" on screen.
2. `git switch main && git pull --ff-only`. Note the SHA and the latest CI run; say those, not the numbers in this file.
3. Open in tabs:
   - the Hyphae Lab thread from 2026-09-17 with the founder's test reply;
   - the devnet explorer links in beats 4–6;
   - the audit site (the Vercel URL, or `pnpm --filter @hyphae/web dev` against a local api);
   - `docs/screenshots/epoch-1180.png` and `claim-390.png` as a fallback;
   - `/docs` on the api;
   - the README sections "Funding a community's vault" and "Custody during the pilot".

## Beat 1 — who this is for (framing) · ~15 s

**Show:** the README's first paragraph.

**Say:** "Every coin has people doing its work: replying, quoting, explaining. They get paid in vibes, or by whoever the admin remembers. Hyphae pays them from a community vault, by published rules, and anyone can check every payout."

**Evidence:** the claims are beats 2–7; this beat only frames them.

## Beat 2 — the bot grades a reply and shows why (historical, 2026-09-17) · ~25 s

**Show:** the Hyphae Lab reply to "I post this to test the scoring bot": raw 3, credited 0, `off_topic`, with the reasoning.

**Say:** "A member sends the bot their reply. It's graded against a public rubric, and the reasoning is posted back. My own test reply scored raw 3, credited zero: off-topic. The raw score, the rules version and the prompt hash are stored with every grade."

**Evidence:**
- the scoring loop: build log 2026-09-17 (evening), commits `22b0875` (queue and job), `4b76770` (`/submit`, `/raid`), `48e61f9` (credit rules);
- the rubric: `docs/rubrics/mycel-1.0.0.json` … `mycel-1.2.0.json`;
- numbers you may say: 3 contributions, 6 scoring runs, credited 85, 0 and 0, $0.084 total spend (same entry).

## Beat 3 — only a wallet that signed gets paid (historical, 2026-09-24) · ~20 s

**Show:** `/link` in Hyphae Lab, then Phantom's signing prompt, then `/me` showing "verified".

**Say:** "To be paid, a member proves their wallet by signing a message. Pasting an address isn't enough. A closed week always pays the wallet that was verified at its close."

**Evidence:**
- the linking build and the wallet-at-close rule: build log 2026-09-24 (night), commits `a4265f7`..`3e00174`;
- live: build log 2026-09-24 (evening), the cutover deployed `b7bfe55` and Phantom signed in Hyphae Lab (`docs/handoffs/2026-09-24-cutover.md`).

## Beat 4 — a community's vault on Solana, set up from a hardware wallet (devnet) · ~25 s

**Show:** the explorer on `initialize_community`, then the vault deposit.

**Say:** "Each community gets a vault that only the program controls. Here, Hyphae's admin key on my Ledger sets one up and funds it. There's no withdraw instruction. Money leaves the vault only as the 3% fee or as a valid claim."

**Evidence:**
- run 7, from Hyphae's admin `2kz1Zq…` on the Ledger: `initialize_community` `2xkfBYCqiJhQupUL6gB7P9m6DkpgomVkysYMw5bRVveAZvBDmSwzZ7C3kfSVDpaY5PFoN7mcwXbQ8KPHhStvsENo`, deposit `2Af95ffYBU6fE11G7hJryYeASkD85HsZ1ikfbbHu1srBp72hWHSzaJRAiqZuRVj65EFxoYJQgRu6Z3dKb8agaoof` (`docs/handoffs/2026-09-27-devnet-proof.md`);
- the program: `b782495` (program), build log 2026-09-25 (third session).

**Mainnet swap-in:** C16's `initialize_community` and C18's vault funding. Fee address: the MYCEL Treasury vault `rRceAUBN…u7MK`.

## Beat 5 — the week's payout list goes on-chain as one root (devnet) · ~25 s

**Show:** the explorer on `publish_epoch`, then the audit page's settlement panel for that epoch.

**Say:** "When the week closes, every member's payout goes into a merkle root, and the root goes on-chain with the hash of the full audit record. The 3% fee goes to a fixed address set when the community was created. Only what's allocated is reserved; the rest stays for next week."

**Evidence:**
- run 7 `publish_epoch` `3oJ4T6NeYonVRgi1JBfofsRHEkd5RfuTKaEhUc7AHqFL8Pio2r2s6o4n7YtLm7zMPpLCw38mDa1efEzBBpAgy6DD`: gross 50,000,000 lamports, fee 1,500,000, 30,460,365 allocated across 3 payable members;
- the settlement panel: commit `4ca3abf`; screenshot `docs/screenshots/epoch-1180.png` (`ffdfac0`).

**Mainnet swap-in:** C20's `publish_epoch`, with C19's printed numbers.

## Beat 6 — a member claims, and can't claim twice (devnet) · ~25 s

**Show:** the claim transaction, then the refused duplicate, then the member shown as "paid" on the audit page.

**Say:** "The member claims with their proof and gets exactly their share. A receipt is left on-chain, so a second claim of the same share fails on-chain. The page marks someone paid only when the chain holds that receipt."

**Evidence:**
- run 7 claim `5ccGT1xLySoRKjUZftCooXmbxk35WrJ71XFVuH8rfXxaKNiufPkzgLRdAbywRoLjoTL4DvFv3daYTgGyp8a3SmK`, 12,125,000 lamports;
- the duplicate, refused on-chain: `5ob9A3Sg7DYoxCAMLDyX5EpuT2jSF6QBsruPRLf4tdTdTCSkfZCdXSkMuWLuqkFEPQC3eQJVGgzosxdLQbA2EknP`;
- the claim page: commit `44c495d`; screenshot `docs/screenshots/claim-390.png` (`ffdfac0`).

**Mainnet swap-in:** C21's claim and C22's P14 read.

**Don't claim:** soulbound points in the wallet. The Token-2022 points mint (plan Week 3 #1) was not built.

## Beat 7 — anyone can check it (devnet, locally tested) · ~25 s

**Show:**
1. The terminal: `solana-verify get-program-hash -u devnet EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E` prints `7e902d1b…43ac`.
2. The same hash from `anchor build --verifiable`.
3. The README's custody section.

**Say:** "The program on chain is byte for byte what this repo builds in Anchor's pinned Docker image. The custody rules are public. The key that publishes each root decides where that week's pot goes, and the program can be upgraded. The policy keeps both keys on a hardware wallet."

**Evidence:**
- the verifiable build and its readback: `docs/handoffs/2026-09-28-verifiable-build-and-deploy-rehearsal.md`, commit `a6da160`;
- the custody policy: `37d09cc`, and `CUSTODY_POLICY` in `packages/core`; the key rulings: `docs/handoffs/2026-09-27-keys-and-fee-rulings.md`;
- the program security review (three rounds, no fund-loss path): `docs/handoffs/2026-09-27-afternoon-arc.md`.

**Mainnet swap-in:** `solana-verify get-program-hash -u mainnet-beta EAz8…` and C13's readback, upgrade authority `2kz1Zq…`.

## Beat 8 — any project can fund a vault, and read everything (locally tested) · ~20 s

**Show:**
1. The README section "Funding a community's vault": the PDA seeds.
2. `/docs`, the OpenAPI reference.
3. One `GET /v1/wallets/{wallet}/claims` response.

**Say:** "A vault's address comes from the coin and its admin, so any project can find it and fund it. Everything on the page is in a public API: communities, weeks, every score with its reasons, and every claim with its proof."

**Evidence:**
- the wallet-claims route and rate limits: `d712289`, `6e48b12`; OpenAPI and `/docs`: `135a80f`;
- the README integration: `1d56e5d`.

Say "deployed" only if Runbook C's C7 ran: production `b7bfe55` has no `/v1` (`docs/HANDOFF.md`).

## Close · ~5 s

**Say:** "Hyphae: pay the people who do the work, and show everyone how."

## Out of the video

These were not built or are not live; the video must not imply them:
- soulbound Token-2022 points;
- the Codama client;
- the web `/admin` page (plan Week 4 #3, dropped by Cisco on 2026-09-27);
- tester or member counts past what the build log records;
- any mainnet transaction that Runbook C did not record.
