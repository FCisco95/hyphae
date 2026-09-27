---
date: 2026-09-27
summary: The Hyphae program is deployed on devnet with a throwaway admin key, and the whole payout path ran against it. The run published an epoch from its stored intent, paid one claim, and the chain refused the same claim a second time. The public audit then read P14 back from devnet, where every transaction it shows is one the chain proves. Every signature is below. No mainnet, Neon, Fly or Vercel action.
---

# 2026-09-27 — devnet proof

## Authority and keys

- Authority: local/devnet R6 + Anchor with a throwaway-key deploy (`2026-09-25-gate-and-r6-rulings.md`), and step 1 of the Sep 27 afternoon arc.
- Throwaway keys from WSL `~/hyphae-devnet/` (generated Sep 25). Not the Lab wallet.
  - Admin and upgrade authority: `Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM`.
  - Claimant: `3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk`.
  - Fee recipient: `AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR`.
- Admin balance: **5 SOL** at 2026-09-27T13:48:58Z (one read, no faucet request), **3.70 SOL** after runs 1–2 (13:57:34Z), **3.51 SOL** after runs 3–5 (15:27Z).

## Deploy

The `2026-09-25-r6-anchor-built.md` § Devnet procedure, exactly:

| Step | Result |
|---|---|
| `anchor build` in WSL | exit 0. `hyphae.so` sha256 `cb4ffdd8074442310f7953b5233a4c2df4eaf8c3f7627cdf259efb84ebf98d79`, the same bytes as Sep 25. |
| `solana program deploy` | Program `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`, slot 504803569.<br>Signature `2qbf2LvkSBrXfZZax1ymiA75iYnXs6DTKDvXe4ccLabat1KLmHGtiRCGrJQ3Xf763qTh53bYfWdoMtoJVqFJxDqK`.<br>ProgramData `CHm2qHs1Mj3FF4pmRdwmtEYBrL2WkupesoayiwxiNp3J`. |
| `spl-token create-token` (run 1) | Mint `27E7sYygzkYW1gjjimVbFGBykiNTo47xqKPSjPjdqkyN`.<br>Signature `4zRuAzQf9p7udekmgiYoUiJwg3XHR91c1qCQuEPn3niJTLpDbAvdx7NHokX5fGHTmaN3Rztu5HgF4HobMdhxkc57`. |

## Run 2: the proof (passed)

`HYPHAE_DEVNET_RUN=1 … vitest run src/payout/publish.devnet.test.ts`, exit 0.

- A fresh mint gives a fresh community, so epoch 1 is new: mint `H9sDQTr8cGfHNMb2FRoaCDUdKNfPqxYdJcSR2PvGxT5h` (signature `3Nzv9ATF6JXdX4d5zxRPM7T8PQ9o8bAoGoa8ksotEcfHvSZfWeEwtxqSvi3VePgG784kw6rTDYcSU9XkcYBkYY3u`).
- Community `GB8f697SMn9hXU6JNow8epbjSL9g7FegmGjxYFV3Rh6r`, vault `973snjzFD8HTkNVuMLgruXqyEt9QwmEMWDy3LfKvvyfG`, epoch 1 `9goN1Nnz3tyqbJhUopJQLvzpLkWh2EbMCsXmDdtFKkgg`.

| Step | Signature |
|---|---|
| `initialize_community` | `5G3jBHbTWE3j5mf8W8Cteyc6jEWUr8ZjftbupMsh412E3q6TRZ7xXHncqVsp7sFgwLqZ3mcJjwup6mnZVwb7nPkH` |
| Vault deposit (0.05 SOL unassigned) | `4h3acSH4pXznFHv4e4PZNkaAg74zKFYCokyvEgqLLALxL6RN6zAfUjco4aKZHQSNhwZ2SzQ1uJP1vZBFr5a9cWHy` |
| Claimant funded (0.01 SOL for fees) | `5wWxgTT9JmK9fQZ1CAd86SdiaJN1rgCmYqcPFndhTG6DkNhknq2YuZo4s6DYU3pGdmN7vixn4S2gbtsC8vpLx4Mk` |
| `publish_epoch` through `publishEpoch`, from the stored intent | `5WyyaJ1mPTdTgECDTo6tcs6FRenTor4hruTs15fhtxVRfyzbTCmjgNcwou9cgWM3TZbq649qcGQGESsBiAimb1jN` |
| `claim`, 12,125,000 lamports | `56U8EoJWzB6DZJkzZSSFGYknPrmQXCDVQ2eBxkyH9iUprJm3bFH2N53mCMurBqqk9oNw7sK8wj9Yu8EQ2MC7H9an` |
| The same claim again, past preflight: **failed on-chain** | `2Nor6YKwwcyJVKfTZ9pnSxATKBr7zfv8yCSURDH5Y2ePTN4wnHDNwsTRX1pz8o64SuYoBWcxbG54HWcMxQmtxDyW` |

**Publication:** root `de0b55c9d3864b1227639a491da0d76918724b90c588337f84471dd0c44c3878`, audit hash `04a6c28ba46581d752045e43aea2c75a51095c598d775df9b4b93dbe36d82309`. Gross 50,000,000, fee 1,500,000 (3%), allocated 30,460,365, cap remainder 18,039,634, dust 1, three payable members.

**The refused duplicate:** slot 504804757, `InstructionError [0, Custom 0]`. The logs show the System Program's `Allocate: account … HEfBcN6hypi4tYF3SrEMX954NQvmNc4NTZchgP7rXtEG … already in use`: the claim receipt already exists, so the second claim reverts. The vault balance was unchanged.

**The P14 read from devnet** (`readEpoch` and `readClaim`, reader over the public devnet RPC):
- `settlement.allocation`: `published`, `publish_tx` = the publish above, root and audit hash equal to the stored intent.
- `settlement.payment`: `available`, claimed 12,125,000, unclaimed 18,335,365. The claimant is `paid` with `claim_tx` = the claim above. The other two members are `claimable`, with no transaction.
- The claim route's payment: `{ status: "paid", claim_tx: 56U8Eo… }`.

## Run 1: on-chain passed, the P14 read did not

Mint `27E7sYyg…`, community `7rq3hCvp4Kmeo9YQLGnwd4AVMJVEkUjVAbrYVfGCf8M2`, vault `DqpoTgh4trGMAMRaN8uAWE9vQcFFb51QcqPb1o3pesV9`.

| Step | Signature |
|---|---|
| `initialize_community` | `399ePmB7sCrqMEoqhhCzU5b2exT3paSqmN9ydKfJN8ZGa8CM64KfFk3owhVqaSKos2e2px2jpAuNthSLpTdaUaf3` |
| Deposit | `2YhvZCa7rXWu6c96BE16wrZfhiRrxjT87SHfU6sj6GuUmedwBQwoP3QiJ6woLEe6TsePajnAQQAP5yYHGYX19M59` |
| Fund claimant | `4yMQubqsH2NV4uGVkuwewovhQ1bGTa2ZE9WSv4bCxVwBcLcN4HW1WLhzrKQyDsQLpDnZKLEMTgJW1km1UCW2Z4hS` |
| `publish_epoch` | `53PKds4u9NfrMTLBGbAquD2kvh1f9T7BArmNUCdnkG2fBfJB9Fwj9QWGcSJYKSzPBeZJ9PCPHXLGGHidPmsR4vQb` |
| `claim` | `wNgt1jWxCCBv8isuSDYAGS1Dz8ojzXkh94ctXJdcrG6upeKvZxiqyWwV4xHxxGogKBag14PpXYV1B42Q3j9VnGm` |
| Duplicate claim, **failed on-chain** | `3V4UBnSktAjJjw3NPpXYfgGBA2hswYBPvKtfm3cjXr6jRjgUiaYozo2BdXc8tk6WncCPSWDKQVQeFtMNuRoXhwVs` |

The read that followed returned `settlement.allocation.status = "unavailable"`. The harness asserted before recording, so the reason was lost.

- **Checked straight after, read-only against devnet:** the reader's genesis check (devnet), the epoch account (community, index, gross, fee, allocation all as published), and `creation()` with the recorded hint. It found `53PKds…` finalized, and `isPublishEpoch` matched its instruction.
- **Most likely cause:** a transient failure from the rate-limited public RPC during the read burst. Any RPC error maps to `chain_unavailable`, which is the honest-unavailable behaviour P14 promises. Not proven: the reason was not captured.
- **Change:** the harness now writes the full P14 read and the claim read to its report **before** asserting. A repeat keeps its reason.

Run 2 used the changed harness and passed end to end.

## Runs 3–5: after the security fixes

Mints were created with `spl-token create-token` as above. Each run used a fresh mint, so epoch 1 was new.

**Run 3 (passed), after F1, F3 and the first F2/F5 fixes.** Its records were kept in a local Postgres (`HYPHAE_DEVNET_DATABASE_URL`) for the README examples and the screenshots.

| Step | Signature |
|---|---|
| Mint `GJDHD9Rky93aZssxET68zuhbCGYBEmaiCLR8Hb98t6Rh` | `52cwsSPuPGfRy2BsywvV6udZ7Bzg4whkja8YtEJHSBGBcMsrqCfigzrrFUKngUimfFPgEd6DXYhtAPxjucCy5WdK` |
| `initialize_community` (community `Gvgs3TJZ2FEs7saQhgCQF8hsiaTRyj4i1FLKfotzRT8w`) | `3n1rz6LEMnvKPorkPUpr8XAMP8jt1JAB2Hnd1bLZwWAf4bXyXHs3dMEDQmWrdqp6uaW3Us1qrzstfVCMhnLTtzwA` |
| Deposit | `xPY9TmyBvDXMQBdp4PY14LSrhfoUac8Df2DQcKzMpgG2sr7cfqSBbtjVUcK3CrphLCBgazwpSrhvMQAdqNiHdSX` |
| Fund claimant | `iY2ZGTE4pRTEds1ZrvPVHAiBXT88fWr8oU1LkdL4syZB6b6emRWEs3fLDLSAccF9Nz7gKfUyaZ1NzTYmnHGwD8V` |
| `publish_epoch`, simulated before signing | `2bFgfKVmYFBEH16FaY2WA2uZX6uYvr86UKMzMGbBZRy6D2kXRdnfvQL8c4q6YQUskx9myWEF8PD3t6GMDc3UXorJ` |
| `claim` | `TB1DqRMMtuokN2oDEf7Xp8KvRWjZ8uo4eSRitPCFLwY4vbYPUwU3K8P41zUKFZvp5wxDqv2ds5MXfTJDsLH8JKJ` |
| Duplicate claim, **failed on-chain** | `4dscs6cKL9LECSreDFCQqa4de65da6dix47sNQRL41wN8E2eNeoDz8UhtdoA4BCubW3s8Lkb2QZAjxJhcpV5cU8r` |

The transaction's `blockTime` and the epoch account's `published_at` are the same second, 1790519869. The publish recovery's lookup relies on that.

**Run 4, on the final code.**
- Mint `2kV8AqSEXQQQLbTwY72cJ1LG2KA6ryLS8wX8GPR3nqQZ`, community `Hbw1xWZ1zPeTeYjpAwPUefswzJcS6rvYVq85QacCFrKz`.
- Landed:
  - initialize `5bSk5BAykW61v35cJCgwSTJhBuBjPPCfYGxxrKvWDBEszs6Haceg44hq8PF3dxEBTBCveYikZBgNeJP8drsvN8JQ`
  - deposit `Wy2gPMLc73Pkt2rqEaah3SgCwVKytJBoQPh9x9dQ19TVxF9VuGfNm2dCthDiELyX4t8QgbckjfdFBxwxHjkUZJC`
  - fund claimant `62FzssyaR5uca7ZL5ovcvB9qaayjJReKq53q7QLq4QKwA3Z6JKKzzTPxrsuXpUkS8YzU8BcKxejAWmSA1i7exzEb`
  - publish `R19qcUxoNeqm9mhMWHetPRfqdT8hUPZArsTUW65Kut6GfcAmVVcgqPvKFDyz6K3CzJgoYWrh76Zzg7nozjjAN3X`
  - claim `5eM6DMzj6sxWMKr4G22KNZgtV9Hy8NVHTE9tgz88kfkVeru3TQ5icELgHrSwmTjGf59CmZqsJW5guEtStbMPAVpd`
- **Not sent:** the duplicate claim. The public devnet RPC answered `HTTP 429 Too Many Requests`.

**Run 5, on the final code.**
- Mint `HxjGoZ7xLuhPu2BUNAVENezfqAMEjZbSUKuPh8yF6fQ8`, community `GLKEgUuDmZoNfnaACUtfp6neRWwfmzyFeJ86x1J4cEqu`.
- Landed:
  - initialize `wrufQnaAFtciYEWPjL57bGEm11hGVLUmHC7m5jjNnBJMe4FmWdZyRSJKovZQiuVyQ61WZkAULekvKwzK7MSuAAG`
  - deposit `2qizppqpg1RMRdfqHHmZZ6aL3JUDXvXoU6rHGg4FwPp81qkrLN8ygWUBhthf6qWwigQrSTo5uxM8Z39fYgmWv2Jk`
  - fund claimant `4vnMhg18ZvjL3boytfayJpZS9pYyWR39tqS7rEHVXwSctzvzMBf5QJKfXoUbrBJiaZ3nLXJGy1CNyd5G8GTzFiJn`
  - publish `26Zsp2jubqMUNJPtcDieUZAtq2emaY9UifM7zGRzj2QLhzhQMxkVhbUAdJtV2WsWxpPtyYwi2ttQz4trmdkrFvR9`
  - claim `2R5yQ8GVj7y8YFa7rVSYtttR5kwRyjayx2BHmeMQAcj7phBw4WFmeBpnLAgW5nGDkC14ft3QSopNXC7Z6xApyDfi`
  - duplicate claim, **failed on-chain** `452fGCV7YNShXxkKr92PRwxP61uhEDtiGSTwHAo62f3k6T8DxpxSXtEC44U5KwnKb3jGVTp8waR9bQ1ypECxK62z`
- **Not completed:** the balance read after it hit the same 429, so the in-harness P14 read did not run.

**P14 on the final code (15:27:36Z).** The rebuilt API, with `READ_RPC_URL` on devnet, read run 3's publication from devnet:
- allocation `published`, `publish_tx` `2bFgfK…`, `published_at` `2026-09-27T14:37:49.000000Z` (the chain's second);
- payment `available`, claimed 12,125,000: the claimant `paid` with `TB1Dq…`, the other two `claimable`;
- the claim route: `paid` with the same transaction.

Runs 1, 4 and 5 all met the public RPC's rate limit during a burst of reads. The API turns such a failure into `chain_unavailable`, never a zero.

## Run 6: Cisco's Ledger signs (passed)

The first real-device run, on the final code (`a71bccf`), 18:39Z. Cisco's Ledger Flex, connected over USB to the Windows machine, was the community admin at the code's default path `44'/501'/0'` (`BpmEA1WV2252o4LPEvJ2Lhj1PpGbQJN2zPCjAnnbkhcQ`).

Before any signature:
- The agent read the device's addresses; that signs nothing.
- The throwaway admin funded the device's devnet address with 0.15 SOL (`4dEAxtDt9Z95adAnxT6XSwnPnZpUMw1LoUCFAcSHF9iFUbqnecBJjGrKDuVhLXKLYDGcbatLTQ8RuJdYSkCbaPxR`).
- A fresh mint `8qPHREpU7vAyzXC2RcW4WiNMs82eLyvuJMWGMH81cCDg` was created by the throwaway admin (`38MiLLvUSt9Gac77xWZ5UJHKfhWMtW2fdfnPNy6sx3xCGyZTtHDitmq4PXMPpf3JwRJqwrJpBjoQwhG3KAKzDbL9`).

`HYPHAE_DEVNET_RUN=1 HYPHAE_DEVNET_ADMIN_LEDGER= … vitest run src/payout/publish.devnet.test.ts`: exit 0, 39.6 s. Every admin transaction was simulated first, then signed on the device after Cisco approved it:

| Step | Signed on the Ledger | Signature |
|---|---|---|
| `initialize_community` (blind) | yes | `4yjYLxhRhqbn6iRPGhH8gMb5HNNwV72wg4cz7z2J4ibzah2wUEEmoTwrtCemaCJwojs2eMYQ6uPPdqMX2mCujDcs` |
| Vault deposit, 0.05 SOL | yes | `28G48rffXsqhoUBcZyj3br1V2EJ8zkUJYy4fJrqFhiooHj4EZbaSEgrz1hoMxvF3FUxPbQSKgbeM9vXX1Qoi7gjF` |
| Claimant funding, 0.01 SOL | yes | `2ekamAB3NMMAZ1NVec9zBwJ5SHRogKL9T7DMqPWiDmkXKbTu53nuFgK5stH8DjHXW3i2mDh1gebwsJwQS6GPmpA3` |
| `publish_epoch` (blind) | yes | `5BsZvrhnvNTchDKjVHgGmjnC4mgFLHhdKQ2MsQBSQHCGfXhJhqxEYvYXJepfDU2u4aFxTRSgm2LJ1FmXXNBwkbCm` |
| Claim, 12,125,000 lamports | file key (claimant) | `2JcFjfs8wBEYSaMYwZdwsk1amCq6Ki5jA5PbieLfU2pyBiDj1HxnH7uqQt3DnoLViWF13wguwcsw6kuyve5hJFf7` |
| Second claim of the same leaf | refused on-chain, `Custom program error: #0` | `3H7pBKUPAy3EAfpqNYCDknkRoWxbdznHV9kgS2VA97FNAEpug3YF8BQk4r5LceeHCRZtG8S37TF6BoMWuaYVXyqw` |

- Accounts: community `2jQq2uhM9L5X1HfDWi1KUP4ynRBfbVgFjGQ2jj9xEQ6o`, vault `62iBWa6eWPLX6xnHenZTxZrMS4kH9eQufrxUKzLj4gb`, epoch `41oWtKDSaFJq9JKuVq3kuV2UCHnTCfH1zhjrcBjkBp5B`, receipt `7DCj2UQXRxVTfuAxaaEPn899R19dR5vwzznv3BN6TdRc`.
- Root `d25c2dba…2faa`, audit hash `0fb7e449…4b2e`.
- **P14 read from devnet:**
  - `published`, `published_at` 18:39:45Z;
  - gross 50,000,000 lamports, fee 1,500,000 (300 bps), net 48,500,000;
  - allocated 30,460,365 across 3 payable members;
  - the claimant `paid` with the claim transaction, the other two `claimable`.
- **The claim route:** `paid`, with the same transaction.

## Run 7: Hyphae's own admin account signs (passed)

The rehearsal of the mainnet admin, 18:58Z, on the code at `ae90dad`. The Ledger served `44'/501'/2'/0'` = `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`, the account Cisco ruled as Hyphae's admin and upgrade key.

Setup:
- Devnet funding from the throwaway admin: 0.15 SOL (`5aEJThDFbJDq1TRnEjCv2XfjeExwZGKX6CWLUygEsgKYmPHKns6ttVj692TSynFVaaqra3SV3VCYFB6fjE4CpPWr`).
- A fresh mint, `362QrubZ1pj3Nm9Kvwy6uAkSkM6q5s85pecv5guw8yBY` (`35fRxcGMqykXVzfDxqVJF1CpEiBrQRxaW9xeiKBoEvx1tN7b3cHeF84HExw6DpekvkpNPN3UunoXBTDbs88dWqnt`).

`HYPHAE_DEVNET_ADMIN_LEDGER="44'/501'/2'/0'"`: exit 0, 54.0 s.

| Step | Signed on the Ledger | Signature |
|---|---|---|
| `initialize_community` (blind) | yes | `2xkfBYCqiJhQupUL6gB7P9m6DkpgomVkysYMw5bRVveAZvBDmSwzZ7C3kfSVDpaY5PFoN7mcwXbQ8KPHhStvsENo` |
| Vault deposit, 0.05 SOL | yes | `2Af95ffYBU6fE11G7hJryYeASkD85HsZ1ikfbbHu1srBp72hWHSzaJRAiqZuRVj65EFxoYJQgRu6Z3dKb8agaoof` |
| Claimant funding, 0.01 SOL | yes | `5b8dVyNGABSPNSRYKaLVcMcr1D9bR1vuiEF2n97gHP5troutWJuqokYkwMvhkcoVkpNALh23UQo5pNEmokbay7sJ` |
| `publish_epoch` (blind) | yes | `3oJ4T6NeYonVRgi1JBfofsRHEkd5RfuTKaEhUc7AHqFL8Pio2r2s6o4n7YtLm7zMPpLCw38mDa1efEzBBpAgy6DD` |
| Claim, 12,125,000 lamports | file key (claimant) | `5ccGT1yLxySoRKjUZftCooXmbxk35WrJ71XFVuH8rfXxaKNiufPkzgLRdAbywRoLjoTL4DvFv3daYTgGyp8a3SmK` |
| Second claim of the same leaf | refused on-chain, `Custom program error: #0` | `5ob9A3Sg7DYoxCAMLDyX5EpuT2jSF6QBsruPRLf4tdTdTCSkfZCdXSkMuWLuqkFEPQC3eQJVGgzosxdLQbA2EknP` |

- Accounts: community `Bzatx3tHH1YrjuJhB3SffdiSTqpCnLYjpVxiuzjUX5iA`, vault `EtwTx2dms6Gn1T87g4Kdrb2j7N2R1bTefVpvQ1LG3Hpx`, epoch `5oYrnxoUqZz1GWbRnBNpvLWBwxXDFEFjhm1ud3CtgYnV`, receipt `BEtuSyCwVCVw6AN8WfFoQkHskHtggnaFZXWzANaS8oFc`.
- Root `576b76de…5a30`, audit hash `6d137b65…1853`.
- **P14 read from devnet:**
  - `published` at 18:58:59Z;
  - gross 50,000,000 lamports, fee 1,500,000, allocated 30,460,365 across 3 payable members;
  - the claimant `paid`, the other two `claimable`.
- **The claim route:** `paid`.

## What this proves, and what it does not

- **Proves on devnet:**
  - The deployed program accepts a publish built from the stored intent's bytes.
  - It pays exactly the leaf amount.
  - It refuses a second claim of the same leaf on-chain.
  - The read API's P14 shows only transactions the chain proves.
  - A Ledger Flex signs `initialize_community`, the deposits and `publish_epoch` through Hyphae's own signer, each simulated before the device is asked (run 6). It signs again from Hyphae's ruled admin account `2kz1Zq…` (run 7).
- **Does not prove:**
  - A browser claim through `/claim` with a real wallet.
  - Anything on mainnet.
