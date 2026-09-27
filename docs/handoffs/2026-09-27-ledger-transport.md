---
date: 2026-09-27
summary: Decision 3 approved node-hid's native build, and only that. The Ledger USB transport now loads, and a bug that would have stopped every real-device publish is fixed. The Ledger library's create() fails on this transport whether or not a device is connected, so the transport now opens the first device directly. The fake-device tests pass. The devnet harness can make a Ledger the community admin. Below: the steps for Cisco's first real-device run on devnet, and the mainnet commands they rehearse.
---

# 2026-09-27 — Ledger transport

## What changed

| Change | Why |
|---|---|
| `pnpm-workspace.yaml`: `onlyBuiltDependencies: [node-hid]` | The non-interactive form of `pnpm approve-builds` for exactly one package (decision 3). node-hid 2.1.2's install script is `prebuild-install --runtime napi \|\| node-gyp rebuild`. On this machine it fetched the prebuilt N-API binary. Every other build script stays blocked. |
| `usbLedger()` opens the first device with `Transport.open("")`, never `Transport.create()` | `@ledgerhq/hw-transport-node-hid-noevents` 6.36 reports devices synchronously inside `listen()`. `Transport.create()` then touches its own `sub` and `listenTimeoutId` before they are initialized, a TDZ ReferenceError whether or not a device is connected. Checked on this machine: with no device, the real path now fails with the cause `NoDevice`. |
| Devnet harness: `HYPHAE_DEVNET_ADMIN_LEDGER` | Makes the Ledger the community admin, so the device signs `initialize_community`, the deposit, the claimant's funding and `publish_epoch`. The harness checks the admin's balance before asking for any signature. |

Every signer still goes through `signSimulated`: the exact message is simulated before the device is asked, and only partial signers are accepted. `ledgerSigner` verifies each device signature against the message bytes before using it.

## Real-device devnet run: Cisco's steps, one at a time

**Done 2026-09-27 18:39Z: run 6 passed.** Signatures are in `2026-09-27-devnet-proof.md`. In practice: the Ledger must be plugged into the machine running the harness; the agent read the device's addresses, funded its devnet address and created the mint; Cisco approved four prompts.

The agent runs every command. Cisco's hands are needed only on the device.

1. **Prepare the Ledger.** Update the firmware and the Solana app in Ledger Live. In the Solana app's settings, turn **Blind signing** on. The app cannot decode Hyphae's own instructions, so without it the device refuses them. Then **quit Ledger Live**, which holds the USB device.
2. **Connect, unlock, open the Solana app**, and tell the agent "Ledger ready".
3. The agent runs the harness once. It reads the device's address and stops at the balance check, before any signature. The agent sends 0.15 devnet SOL to that address from the throwaway admin. That is a devnet step, and never the Lab wallet.
4. The agent creates a fresh devnet mint and runs the harness again:
   ```sh
   HYPHAE_DEVNET_RUN=1 HYPHAE_DEVNET_ADMIN_LEDGER= HYPHAE_DEVNET_CLAIMANT_KEYPAIR=<claimant.json> \
     HYPHAE_DEVNET_FEE_RECIPIENT=AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR HYPHAE_DEVNET_MINT=<new mint> \
     HYPHAE_DEVNET_REPORT=<report.json> pnpm --filter @hyphae/api exec vitest run src/payout/publish.devnet.test.ts
   ```
   The device asks four times:
   1. `initialize_community` (blind).
   2. The vault deposit (a SOL transfer).
   3. The claimant's funding (a SOL transfer).
   4. `publish_epoch` (blind).

   Cisco approves each one. If the device times out or a prompt is rejected, that transaction is not sent. Those already confirmed stay landed, and the next run uses a fresh mint.
5. The agent records every signature, the refused duplicate claim and the P14 read, as in `2026-09-27-devnet-proof.md`.

Blind signing means the device shows a hash, not the instruction. What the operator checks is the plan printed before signing: pot, fee, allocation, root and audit hash. The code refuses a device signature over any other bytes.

## The mainnet commands this rehearses (Oct 7–8, each with Cisco's separate yes)

From `apps/api`, with the production `.env`:

```sh
node --env-file=<abs .env> --import tsx scripts/publish-epoch.ts plan \
  --mint <MYCEL mint> --epoch 2 --gross 500000000 --network mainnet --rpc <mainnet https url> --signer ledger:<Hyphae admin path>
node --env-file=<abs .env> --import tsx scripts/publish-epoch.ts publish \
  --mint <MYCEL mint> --epoch 2 --gross 500000000 --network mainnet --rpc <mainnet https url> --signer ledger:<Hyphae admin path>
```

`plan` stores the intent and prints every number. `publish` sends exactly that intent and records it. `--signer ledger` has no default account: the path of Hyphae's dedicated admin account is named every time, and a malformed path is refused. Both need, first:
- the mainnet program deploy;
- MYCEL's community, initialized by this Ledger with the P8 fee address;
- the vault funded;
- migrations 0010–0012 applied;
- `communities.chain_address` set;
- `first_paid_epoch = 2`.

Each of those is a separate hard stop for Cisco.
