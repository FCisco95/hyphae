# Hyphae wallet and program-key registry

Verified October 2, 2026. This registry covers the keys and authority used in the current mainnet deployment arc. Public addresses and storage locations belong here; private key bytes, recovery phrases and RPC credentials never do. Historical devnet activity is recorded in [the completed Ledger rehearsal](handoffs/2026-10-01-ledger-devnet-rehearsal.md).

## Current inventory

| Identity | Public address | Role and control | Current state |
|---|---|---|---|
| Temporary mainnet deployer | `CpBum8ynMAawJSdNCKS9NLZXc6hySE1aDCqna7XhmyNT` | Software key on Cisco's computer. Pays buffer/program rent and deployment fees, then returns its unused balance. The agent CLI can sign with this file without a Ledger prompt. It is not the program's intended upgrade authority. | Key exists; finalized mainnet balance 0 at 2026-10-02T10:45:23.740Z. Funding pending. |
| Temporary mainnet buffer identity | `E8MhkV28a4918ZpqRZHAf6ANqK8GxkroEy82GEFAdBSF` | Software key creates/resumes the account that temporarily holds the verified program bytes. C11 hands that account's authority to the Ledger. | Key exists; C11 buffer write has not run. |
| Persistent program identity | `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E` | Existing program-address keypair. Identifies the program for deployment; possession alone does not authorize upgrading/closing a deployed program. | Existing devnet program; latest mainnet account read was AccountNotFound at C8. No mainnet deploy yet. |
| Persistent Ledger authority | `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR` | Cisco's Ledger, derivation `44'/501'/2'/0'`; CLI locator `usb://ledger?key=2/0`. Planned sole mainnet program upgrade/closure authority. Private signing key remains on the hardware device. | C8 hardware public-address read matched. C12 mainnet authority assignment/signing has not run. |

## Exact storage and recovery

WSL distro **Ubuntu**, Linux user **fcisco95**. The two temporary keys were generated silently on October 2 with file mode **600**, without overwriting existing files. No recovery phrase or private key bytes were printed; no additional backup copy was made.

| Identity | Canonical key location | Windows access to the same file |
|---|---|---|
| Deployer | `/home/fcisco95/hyphae-mainnet/deploy-hot-2026-10-02.json` (`~/hyphae-mainnet/deploy-hot-2026-10-02.json` in this WSL user) | `\\wsl.localhost\Ubuntu\home\fcisco95\hyphae-mainnet\deploy-hot-2026-10-02.json` |
| Buffer identity | `/home/fcisco95/hyphae-mainnet/deploy-buffer-2026-10-02.json` | `\\wsl.localhost\Ubuntu\home\fcisco95\hyphae-mainnet\deploy-buffer-2026-10-02.json` |
| Program identity | Repo-relative `target/deploy/hyphae-keypair.json` in the owning Hyphae checkout; Git-ignored | Same file in the Windows checkout's `target\deploy` directory |
| Ledger authority | Existing Ledger device; recovery depends on Cisco's existing Ledger recovery backup | No software key file was created/exported; recovery backup was not inspected |

The UNC paths above access the existing WSL files; they are not additional copies. The registry is metadata, not a key backup. Keep the WSL files available through their recovery gates; do not regenerate, overwrite, move or delete them because a path is inconvenient. Preserve the persistent program identity and Ledger recovery material beyond this deployment.

## Lifecycle and deletion gates

1. **Deployer:** Cisco funds exactly 1.2 SOL on mainnet; verify the balance before C11. Cisco still needs to name the return address. Do not repeat funding merely because a session resumed.
2. **Buffer key:** retain until C11 verifies Ledger authority, data length 229,432 and executable hash `7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac`. Only then delete this specific key file, as required by the approved runbook. Retain its public address and deletion receipt here. This prevents recreating the consumed buffer address with other bytes.
3. **Deployer key:** retain until C13 verifies the deployed program and consumed buffer, sweeps the unused balance to Cisco's named address, confirms the sweep signature succeeded and reads deployer balance 0. Only then delete this specific key file and record the signature/time here. Any uncertainty means retain the file.
4. **Program authority:** deleting the temporary keys does not remove Cisco's Ledger control. Closing the deployed program later requires the Ledger and a separate instruction from Cisco; it is not part of C13's deployer cleanup.

No key was deleted at this checkpoint. Future updates must record actual funding/write/deploy/sweep signatures, ProgramData address, authority/hash read-backs, and each temporary key's verified deletion. Never replace a pending state with an inferred success.

## Deployment budget and finality

At 2026-10-02T10:31:24.900Z, fresh mainnet RPC reads quoted ProgramData rent **1.1663934 SOL** for 229,477 bytes, plus **0.00083312 SOL** for the 36-byte program account. The runbook budgets approximately **0.002 SOL** in non-refundable fees; actual fees can differ. From 1.2 SOL, roughly **0.031 SOL** is expected to remain for the C13 sweep. Refresh reads before spending.

Most funding remains allocated to the deployed program while it operates; it is not returned by C13. The Ledger authority can later close the program to reclaim its large ProgramData deposit, but closure disables the program and that program address cannot be reused. See [Solana's deployment documentation](https://solana.com/docs/programs/deploying#close-your-program). No automatic refund date is promised. This deployment budget is separate from contributor rewards and does not fund the later MYCEL pot.

## Receipts

[Runbook C](handoffs/2026-09-28-runbook-c.md) governs C10-C13. [October 2 attended receipt](handoffs/2026-10-02-attended-run.md) records the actual gates; [current handoff](HANDOFF.md) records the next action. Other projects and all historical wallet files have not been inventoried by this checkpoint.
