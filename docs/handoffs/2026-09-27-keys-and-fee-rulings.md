---
date: 2026-09-27
summary: Cisco answered the five pre-mainnet key questions. The upgrade key is Cisco's Ledger, and only it. A verifiable build comes before the mainnet deploy. Cisco backs up the program keypair to an external SSD. MYCEL's fee goes to a MYCEL treasury that Cisco's Ledger controls for the pilot. The fee address is permanent, so one choice is still open: a plain Ledger address, or a Squads vault the Ledger controls alone for now (recommended). Also recorded: Organic's plan for 2-of-3 community treasuries, and the contract Organic and other apps read.
---

# 2026-09-27 — keys, fee address and the Organic contract

Cisco's answers, in-session, after the afternoon arc. Cisco controls Organic, so this record also serves the Organic sync.

## Rulings

| # | Question | Ruling | What it means in practice |
|---|---|---|---|
| 1 | Where MYCEL's 3% fee goes (P8) | **MYCEL's treasury.** For the pilot, Cisco controls it with his Ledger Flex. | The address is passed to `initialize_community` and **can never change**: the program has no instruction to update `fee_recipient`. One choice is still open, below. |
| 2 | Upgrade authority on mainnet | **Cisco's Ledger, and only Cisco.** | Deploy with the Ledger as upgrade authority. Read the ProgramData authority back from the chain before funding the vault. |
| 3 | Verifiable build | **Yes**, before the mainnet deploy. | `anchor build --verifiable` (or `solana-verify`) from the reviewed commit; publish the hash. CI's plain build already matches the local one (`cb4ffdd8…8d79`, run `36332048980`). |
| 4 | Program keypair backup | **Yes**: Cisco copies it to an external SSD. | See below. |
| 5 | Organic's adapter field | Cisco controls Organic; the Organic sync carries it. | Organic reads `epoch.settlement`, never the top-level `allocation`/`payment`. See the contract below. |

### The fee address shape (1): ruled Squads

Cisco chose the Squads multisig recommended below: "we can create a squad wallet".

He then chose its members: "I want to use the same if we can". MYCEL's treasury is a **new** Squads v4 multisig, 2-of-3, with the same three members as Organic's platform multisig.

That multisig is `Bai5U1Nm7A7KNmj7cUjv36VkjrjdXxmTbseePHEYuwcE`, vault `6H6gpGJo76EjQUY4ktrMuk72eJjWA8qD1KU322cbVZs1`. Read from mainnet: threshold 2, no config authority, no time lock, and three members with every permission:
- `E9JchUJ5to8AR71ttBVJ64r3NGiW8vvucRZcqagpT6KW`: the Ledger;
- `HhRcqjFs8uRcw337UB2Zko6abJiGvx9UaMgCBHzWM2Wy`: a hot key;
- `HYJCqE47aB4RxbJs4yuX5CNyw3FKvH1EnEdK7vHsR2R7`: the cold backup.

It is a separate multisig, not a second vault of Organic's. The two can then change members independently: MYCEL's treasury gains community members later, and Organic's platform admin stays as it is. No new keys; only the vault address is still open.

The address is permanent, but "the Ledger for now" implies a change of control later.

**Recommendation:** make the fee address a **Squads multisig vault**, with the Ledger as its only member for now (1-of-1). The vault address never changes, but its members and threshold can. Later, Organic, the community admin and the community can be added and the threshold set to 2-of-3, with no program change and no new community.

A plain Ledger address works for the pilot. Moving MYCEL's fees to a multisig later would then need either a program upgrade (a new admin-gated instruction, reviewed like any money change) or a new community. The new community would have a new admin key, so a new PDA and a new vault.

Checked in the program: `publish_epoch` credits `fee_recipient` with `add_lamports` and needs nothing from it but its address. Any system-owned address can receive the fee, including a Squads vault.

**Created** 2026-09-27 18:17:35Z by the Ledger `E9Jch…`, in `S6vfMef2sKCVH1jp46RpnHBY4qgbv8kYotfwwNyAjVsyHa2jxP2Xp1vyC2RxypdCzvz3dBpz5odAmaNdLMcVCCp` (`MultisigCreateV2`).

- **Multisig account (MYCEL Treasury):** `34wSn95ZFMsvsq7w6g8Rej7GSagGmpc6Vq5aHiCebu51`. Read from mainnet: threshold 2, no config authority, no time lock, the three members above with every permission. **Never send funds here.**
- **Vault, index 0 (the fee address):** `rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK`. Derived from seeds `["multisig", multisig, "vault", 0]` under `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`. Squads' `isSquad` endpoint returns `v4` for it and `false` for the multisig account. It is System-owned with no data and held the 0.001 SOL Squads funds at creation.
- **Confirmed twice:** the Squads app's Receive screen shows the same address for "Account 1". Cisco checked it against the chain derivation above.

Squads v4 facts that matter here, from its docs:
- Deposit to the **vault** (index 0), a PDA. The multisig account is a different address.
- Creating it costs about 0.103 SOL (a one-time 0.1 SOL fee plus rent).
- A Ledger connects through Phantom or Solflare, with blind signing on.
- 2-of-3 from the start, so one lost key does not lock the treasury. Members change later through a 2-of-3 vote, with no change to the vault address. Nothing uses it until MYCEL's community is initialized on mainnet (Oct 7–8, its own hard stop).

### The program keypair (4)

- **File:** `C:\Users\joao_\Desktop\DEVELOPMENTS\hyphae\target\deploy\hyphae-keypair.json` (232 bytes, gitignored).
- **Checked:** its public key is the program address `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`.
- **Why it matters:** until the mainnet deploy, whoever holds this file can deploy *any* program at that address on mainnet. After the deploy it has no power; the upgrade key governs.
- **How to keep it:** copy the file to the SSD, keep the SSD offline, and never put the file in cloud sync, chat or a repo.
- **Done:** Cisco copied it to his external SSD on 2026-09-27.

## For Organic and other integrators

Organic is the first consumer of Hyphae's public read API; others follow the same contract.

**The contract**
- **Read API v1**, `/v1/...`. The machine-readable contract is `GET /v1/openapi.json` (OpenAPI 3.1, generated from `ReadApiV1` in `@hyphae/core`). A test fails if a served route is undocumented. Human docs: `/docs`.
- **Routes:** communities `{mint}`, epochs `{mint}/epochs/{index}`, contributions, leaderboard, contribution `{id}`, a wallet's claim in one epoch, and `GET /v1/wallets/{wallet}/claims` (every claim of a wallet, with proofs, paged at most 100).
- **Payout data lives in `epoch.settlement`.** Its `allocation` and `payment` sections are the P14 read. The top-level `allocation` and `payment` keep their first v1 shape and always say `unavailable` with reason `see_settlement` (rule A4). Organic's adapter must read `settlement.allocation` and `settlement.payment`.
- **v1 changes are additive only.** New fields may appear, and nothing is renamed or removed. Unknown fields must be ignored. Errors use a closed set of values.
- **Honest states:** a payment shows as paid only when the chain holds the member's receipt. A transaction is shown only when the chain proves it created that receipt. Anything that can't be read says `unavailable` with a reason, never a guess.
- **Funding a community's vault:** PDA seeds `["community", mint, admin]` and `["vault", community]`. See the README section "Funding a community's vault".

**Limits and access**
- Every caller gets 300 requests a minute per IP, with `RateLimit-*` headers and a 429 `unavailable` when exceeded.
- Only Hyphae's own web has a token (`READ_API_WEB_TOKEN`), which lets it name each visitor. Organic's server calls share its IP's budget. If Organic needs more, the next step is one token per integrator, not a shared one.
- **Not deployed yet:** production (`b7bfe55`) has no `/v1`. The Oct 7–8 candidate (`main`) serves it after migrations 0010–0012.

### Organic-side proposal: 2-of-3 community treasuries (not Hyphae work)

Cisco's direction for Organic, recorded so the Organic sync can plan it:
- When a community bonds on Organic, Organic creates its treasury wallet.
- **Signers:** Organic, the community's admin or developer, and the community.
- **Threshold:** any 2 of the 3 can move funds or change the wallet.
- **Organic's role:** the tiebreaker if the developer or the community goes silent.

The link to Hyphae:
- Each community's Hyphae fee address is permanent, so the treasury must exist *before* the community is initialized in Hyphae.
- Organic would pass the treasury's address as `fee_recipient`.
- A Squads vault address fits this directly. It is the same shape recommended for MYCEL above, so MYCEL would not need special handling later.

This needs its own design in Organic: who holds the community's signer, and how a signer is replaced. That design includes custody and money calls for Cisco. Nothing in Hyphae changes for it.
