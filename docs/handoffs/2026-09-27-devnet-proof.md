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
- Admin balance: **5 SOL** at 2026-09-27T13:48:58Z (one read, no faucet request), **3.70 SOL** after both runs (13:57:34Z).

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

## What this proves, and what it does not

- **Proves on devnet:**
  - The deployed program accepts a publish built from the stored intent's bytes.
  - It pays exactly the leaf amount.
  - It refuses a second claim of the same leaf on-chain.
  - The read API's P14 shows only transactions the chain proves.
- **Does not prove:**
  - A Ledger signature: the file key is devnet-only, and the Ledger transport is parked.
  - A browser claim through `/claim` with a real wallet.
  - Anything on mainnet.
