# Final video — script (Sun 2026-10-11)

Plan Week 4 #6. Under 3 minutes, recorded in Loom. Built from `docs/BUILDLOG.md` and shipped evidence only. Rescheduled 2026-10-08: epoch 2 now closes 2026-10-10T00:00Z, so the recording moved to October 11, after C22.

Every claim carries its evidence in brackets: a commit, a devnet signature (open it at `https://explorer.solana.com/tx/<signature>?cluster=devnet`) or a page. Each beat has one label:
- **historical:** happened and was recorded at the time;
- **devnet:** on Solana devnet, with signatures;
- **locally tested:** a passing test on a named commit;
- **mainnet:** only if Runbook C ran, with the signatures it recorded.

No traction number is said unless the build log recorded it. Nothing is called live unless the build log says it was deployed.

## Before recording

**Live state, October 8, 18:00Z (re-read it before recording):** web serves `main` (6425b99, docs only on top of the `jev-e5f864b` source). The API machine and the worker both run image `jev-e5f864b` (`sha256:b3f5617d804a377e8eaae1c6c67641ffe85390e47d88c162f0723206994236c4`) since 2026-10-07 21:36Z; the Neon journal is at 18 (migration `0017_reward_amendment_chain`). C1–C13 are complete: the mainnet program, hash and Ledger authority are recorded in [C13](../handoffs/2026-10-02-c13-mainnet-receipt.md). On October 8 no MYCEL community, vault or epoch account exists on mainnet (Ledger admin 0 lamports; C14 not started) and no payout has happened. Epoch 2 held 16 contributions from 8 members on the 18:13Z read, all decided; six of the eight have no signed wallet, so the payable set is recounted at the sitting and no figure here is a payout figure. Epoch 2 keeps Claude Haiku 5.5 on `reward-eval/2` to the close; epoch 3 moves to `reward-eval/3` after the hold. The [live receipts](2026-10-08-first-payout-readiness.md#live-receipts-october-5-read-only) are the October 5 reads, and the packet's current-state paragraph is the October 8 one; read both before making a live claim. Beats 4–6 keep their devnet evidence until their specific October 9–11 receipts exist; beat 7 may use the verified mainnet program, and beat 8 may show the live read API. If the epoch is empty or blocked, show its actual unavailable settlement and say “mainnet program deployed; no contributor payment” instead of implying a first payout. If it pays only the founder, use [the plain wording](2026-10-08-first-payout-readiness.md#when-the-founder-is-the-only-payable-member) (confirmed by Cisco on 2026-10-05).

1. Read the newest build-log entries. Runbook C (`docs/handoffs/2026-09-28-runbook-c.md`) runs in two blocks: Parts 1–2 (C1–C13, the candidate on Fly and Vercel, then the program on mainnet) on Oct 2–3, and Parts 3–4 (C14–C22, MYCEL's community and vault, then the first payout) on Oct 9–11: C14–C18 on Oct 9, the close on Oct 10 at 00:00Z, C19–C22 on Oct 11. Use each **mainnet swap-in** below only if the steps it names ran, with the signatures the build log records for them. Otherwise that beat says "devnet" on screen.
2. `git switch main && git pull --ff-only`. Note the SHA and the latest CI run; say those, not the numbers in this file.
3. Open the tabs in the order of the recording guide below. The site is https://hyphae-delta.vercel.app, live since the Sep 29 cutover (`docs/handoffs/2026-09-29-cutover-run.md`, step 15).
4. Fallbacks, if the site can't be reached: `docs/showcase/` has every page in both themes. Its settled-epoch and claim pages show the web tests' fixture data, so don't present them as real numbers. A real devnet settlement panel, in the earlier design, is `git show ffdfac0:docs/screenshots/epoch-1180.png`.

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
| 4 | `<site>/#proof`, the first two devnet rows | the explorer on `2xkfBY…` and `2Af95f…` |
| 5 | `<site>/#proof`, the publish row; after Runbook C, `<site>/c/<mint>/e/2`'s settlement panel | the explorer on the publish |
| 6 | `<site>/#proof`, the claim and the refused claim; after Runbook C, `<site>/c/<mint>/e/2/claim` | the explorer on both |
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

## Beat 4 — a community's vault on Solana, set up from a hardware wallet (devnet) · ~25 s

**Show:** the site's `<site>/#proof`, the first two rows of the devnet run, then each row's explorer link: `initialize_community`, then the vault deposit.

**Say:** "Each community gets a vault that only the program controls. Here, Hyphae's admin key on my Ledger sets one up and funds it. There's no withdraw instruction. Money leaves the vault only as the 3% fee or as a valid claim."

**Evidence:**
- run 7, from Hyphae's admin `2kz1Zq…` on the Ledger: `initialize_community` `2xkfBYCqiJhQupUL6gB7P9m6DkpgomVkysYMw5bRVveAZvBDmSwzZ7C3kfSVDpaY5PFoN7mcwXbQ8KPHhStvsENo`, deposit `2Af95ffYBU6fE11G7hJryYeASkD85HsZ1ikfbbHu1srBp72hWHSzaJRAiqZuRVj65EFxoYJQgRu6Z3dKb8agaoof` (`docs/handoffs/2026-09-27-devnet-proof.md`);
- the program: `b782495` (program), build log 2026-09-25 (third session).

**Mainnet swap-in:** C16's `initialize_community` and C18's vault funding. Fee address: the MYCEL Treasury vault `rRceAUBN…u7MK`.

## Beat 5 — the week's payout list goes on-chain as one root (devnet) · ~25 s

**Show:** the publish row in `<site>/#proof` and its explorer link on `publish_epoch`. After Runbook C, the settlement panel on `<site>/c/<mint>/e/2`.

**Say:** "When the week closes, every member's payout goes into a merkle root, and the root goes on-chain with the hash of the full audit record. The 3% fee goes to a fixed address set when the community was created. Only what's allocated is reserved; the rest stays for next week."

**Evidence:**
- run 7 `publish_epoch` `3oJ4T6NeYonVRgi1JBfofsRHEkd5RfuTKaEhUc7AHqFL8Pio2r2s6o4n7YtLm7zMPpLCw38mDa1efEzBBpAgy6DD`: gross 50,000,000 lamports, fee 1,500,000, 30,460,365 allocated across 3 payable members;
- the settlement panel: commit `4ca3abf`; a real devnet publication in it: `git show ffdfac0:docs/screenshots/epoch-1180.png` (the earlier design).

**Mainnet swap-in:** C20's `publish_epoch`, with C19's printed numbers. If the founder is the only payable member, say so here: “One member is paid this week, and it is me.” Do not call it a community payout; the unallocated remainder stays in the vault, and the figure is C19's, not the computed preview.

## Beat 6 — a member claims, and can't claim twice (devnet) · ~25 s

**Show:** the claim and refused-claim rows in `<site>/#proof`, and their explorer links. After Runbook C: the claim page `<site>/c/<mint>/e/2/claim`, then the member shown as "paid" on `<site>/c/<mint>/e/2`.

**Say:** "The member claims with their proof and gets exactly their share. A receipt is left on-chain, so a second claim of the same share fails on-chain. The page marks someone paid only when the chain holds that receipt."

**Evidence:**
- run 7 claim `5ccGT1yLxySoRKjUZftCooXmbxk35WrJ71XFVuH8rfXxaKNiufPkzgLRdAbywRoLjoTL4DvFv3daYTgGyp8a3SmK`, 12,125,000 lamports;
- the duplicate, refused on-chain: `5ob9A3Sg7DYoxCAMLDyX5EpuT2jSF6QBsruPRLf4tdTdTCSkfZCdXSkMuWLuqkFEPQC3eQJVGgzosxdLQbA2EknP`;
- the claim page: commit `44c495d`; its phone layout in `docs/showcase/claim-390-dark.png` (fixture data).

**Mainnet swap-in:** C21's claim and C22's P14 read. Say “paid” only with C21's claim signature and the receipt C22 shows. Say “my own reply, my own signed wallet” if that is the claimant; the system records Cisco's attestation of the author and does not verify the X account.

**Don't claim:** soulbound points in the wallet. The Token-2022 points mint (plan Week 3 #1) was not built.

## Beat 7 — anyone can check it (devnet, locally tested) · ~25 s

**Show:**
1. The terminal: `solana-verify get-program-hash -u devnet EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E` prints `7e902d1b…43ac`.
2. The same hash from `anchor build --verifiable`, in a fresh clone of the public program repo, `FCisco95/hyphae-program`.
3. The site's `<site>/#trust`: the same hash, and the custody policy word for word.

**Say:** "The program on chain is byte for byte what its public repository builds in Anchor's pinned Docker image. The custody rules are public. The key that publishes each root decides where that week's pot goes, and the program can be upgraded. The policy keeps both keys on a hardware wallet."

**Evidence:**
- the verifiable build and its readback: `docs/handoffs/2026-09-28-verifiable-build-and-deploy-rehearsal.md`, commit `a6da160`;
- the custody policy: `37d09cc`, and `CUSTODY_POLICY` in `packages/core`; the key rulings: `docs/handoffs/2026-09-27-keys-and-fee-rulings.md`;
- the program security review (three rounds, no fund-loss path): `docs/handoffs/2026-09-27-afternoon-arc.md`.

**Mainnet swap-in:** `solana-verify get-program-hash -u mainnet-beta EAz8…` and C13's readback, upgrade authority `2kz1Zq…`.

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
- "open source" (both repositories are BUSL 1.1, source available; the application repo is private, and the program and rubrics are public in `FCisco95/hyphae-program`);
- tester or member counts past what the build log records (on October 5: one member with a counted contribution, the founder; on the October 8 18:13Z read: 16 contributions from 8 members, six without a signed wallet);
- members using the private raid buttons, receipts, `/issue` or raid alerts: they are deployed on the API since October 5 and the operator view and receipt lookup were exercised by Cisco only; no member has used them, and no alert subscriber or real-phone test exists;
- X relation or account ownership as verified (the system records an attestation, not proof);
- any mainnet transaction that Runbook C did not record.
