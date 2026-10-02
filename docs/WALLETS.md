# Hyphae wallet and program-key registry

Verified October 2, 2026. This registry covers the keys and authority used in the current mainnet deployment arc. Public addresses and storage locations belong here; private key bytes, recovery phrases and RPC credentials never do. Historical devnet activity is recorded in [the completed Ledger rehearsal](handoffs/2026-10-01-ledger-devnet-rehearsal.md).

## Current inventory

| Identity | Public address | Role and control | Current state |
|---|---|---|---|
| Temporary mainnet deployer — retired | `CpBum8ynMAawJSdNCKS9NLZXc6hySE1aDCqna7XhmyNT` | Software key paid deployment costs and returned all unused balance. It was never the deployed program's upgrade authority. | Sweep finalized, balance **0** at 11:34:18Z; **key file deleted and absence verified at 11:34:53.582Z**. Do not fund this retired address. |
| Temporary mainnet buffer identity — retired | `E8MhkV28a4918ZpqRZHAf6ANqK8GxkroEy82GEFAdBSF` | Software key created/resumed the verified buffer; C11 handed authority to the Ledger. | **Key file deleted after C11 gates at 11:24:18.368Z**. Buffer consumed in C12; C13 finalized AccountNotFound. Do not fund or recreate this address. |
| Persistent program identity | `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E` | Existing program-address keypair; possession alone does not authorize upgrading/closing a deployed program. | Deployed on mainnet and devnet. Mainnet ProgramData `CHm2qHs1Mj3FF4pmRdwmtEYBrL2WkupesoayiwxiNp3J`; C13 finalized read-back passed. Persistent key file retained. |
| Persistent Ledger authority | `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR` | Cisco's Ledger, derivation `44'/501'/2'/0'`; CLI locator `usb://ledger?key=2/0`. Sole verified mainnet upgrade/closure authority. Private signing key remains on hardware. | C12 recorded one Approved device prompt; C13 finalized authority matched. Hardware/recovery arrangement retained. |

## Exact storage and recovery

WSL distro **Ubuntu**, Linux user **fcisco95**. The two temporary keys were generated silently on October 2 with file mode **600**, without overwriting existing files. No recovery phrase or private key bytes were printed; no additional backup copy was made.

| Identity | Canonical key location | Windows access to the same file |
|---|---|---|
| Deployer | Former location `/home/fcisco95/hyphae-mainnet/deploy-hot-2026-10-02.json`; **deleted after C13 gates** | Former path `\\wsl.localhost\Ubuntu\home\fcisco95\hyphae-mainnet\deploy-hot-2026-10-02.json`; **absent** |
| Buffer identity | Former location `/home/fcisco95/hyphae-mainnet/deploy-buffer-2026-10-02.json`; **deleted after C11 gates** | Former path `\\wsl.localhost\Ubuntu\home\fcisco95\hyphae-mainnet\deploy-buffer-2026-10-02.json`; **absent** |
| Program identity | Repo-relative `target/deploy/hyphae-keypair.json` in the owning Hyphae checkout; Git-ignored | Same file in the Windows checkout's `target\deploy` directory |
| Ledger authority | Existing Ledger device; recovery depends on Cisco's existing Ledger recovery backup | No software key file was created/exported; recovery backup was not inspected |

The former UNC paths accessed the same WSL files, not additional copies. Both temporary key files completed their recovery gates and are now absent; this registry preserves their metadata, not secret backups. Do not recreate or fund retired identities. Preserve the persistent program identity and Ledger recovery material beyond this deployment.

## Lifecycle and deletion gates

1. **Deployer:** actual funding **1.22 SOL**, finalized. Cisco accepted the extra funding while keeping the approved **1.2 SOL spending cap** and confirmed return of all unused funds to **`Fjgmfymca7zPDcCr4e9CJLr9GEyqi68HvHrYJ7Tj1Sd7`**. Do not repeat funding. Use this exact address; do not substitute a later history entry.
2. **Buffer key:** retain until C11 verifies Ledger authority, data length 229,432 and executable hash `7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac`. Only then delete this specific key file, as required by the approved runbook. Retain its public address and deletion receipt here. This prevents recreating the consumed buffer address with other bytes.
3. **Deployer key:** retain until C13 verifies the deployed program and consumed buffer, sweeps the unused balance to Cisco's named address, confirms the sweep signature succeeded and reads deployer balance 0. Only then delete this specific key file and record the signature/time here. Any uncertainty means retain the file.
4. **Program authority:** deleting the temporary keys does not remove Cisco's Ledger control. Closing the deployed program later requires the Ledger and a separate instruction from Cisco; it is not part of C13's deployer cleanup.

Both temporary key-file deletions are complete. Keep this metadata after cleanup; do not recreate or fund the retired addresses. Persistent program identity and Ledger remain.

## Deployment budget and finality

At 2026-10-02T10:31:24.900Z, fresh mainnet RPC reads quoted ProgramData rent **1.1663934 SOL** for 229,477 bytes, plus **0.00083312 SOL** for the 36-byte program account. The runbook budgets approximately **0.002 SOL** in non-refundable fees; actual fees can differ. From 1.2 SOL, roughly **0.031 SOL** is expected to remain for the C13 sweep. Refresh reads before spending.

Most funding remains allocated to the deployed program while it operates; it is not returned by C13. The Ledger authority can later close the program to reclaim its large ProgramData deposit, but closure disables the program and that program address cannot be reused. See [Solana's deployment documentation](https://solana.com/docs/programs/deploying#close-your-program). No automatic refund date is promised. This deployment budget is separate from contributor rewards and does not fund the later MYCEL pot.

## Receipts

**Current C12/C13 receipt supersedes the C11 checkpoint below:** deploy [5B2are5d…oWUDVJJ](https://solscan.io/tx/5B2are5dPJqDvirkFH5CGLdPSzcvkaBeA6jEkTjq68HfHo5sNgt4SksG646wDXAcMx3f4Xw1pLAJATM7oWUDVJJ), finalized slot **452597368**, CLI recorded **Approved**, exit 0 **11:31:26.864Z**. C13 finalized authority, 229,432 bytes, reviewed executable hash and consumed buffer passed **11:33:06.704Z**. ProgramData **`CHm2qHs1Mj3FF4pmRdwmtEYBrL2WkupesoayiwxiNp3J`**.

Sweep [4n2ecxuQ…42hu7d8](https://solscan.io/tx/4n2ecxuQvHaRf8eiHuu7ujbWNMcBkZMDsugXMCtg8LZYcSo4kw79RWXWyDYTt99GoBB4MYfPsacFRQBfd42hu7d8) returned **51,537,968 lamports (0.051537968 SOL)** to the confirmed original wallet. Finalized slot **452597849**, successful verbose confirmation, deployer balance **0** at **11:34:18.872Z**. Only then deleted the hot-key file; both temporary files verified absent **11:34:53.582Z**. Total deployment costs **1.168463032 SOL**: deposits **1.16722652 SOL**, non-refundable deployer fees **0.001236512 SOL**, below the 1.2 SOL cap. Source wallet's funding fee is separate. [C13 receipt](handoffs/2026-10-02-c13-mainnet-receipt.md) records current stage and next gates.

Funding transaction [ZHWxt4jv…P5k8m](https://solscan.io/tx/ZHWxt4jvPbRvLeH2wwi7eKyTqNMp1VCrY1NxTtCLng5xLMMBnzje9fFjhGpvkujn1qRjaa6qBjPPzadhS9P5k8m): block time **2026-10-02T11:14:43Z**, slot **452593580**, finalized RPC read with `meta.err = null`. Source `Fjgmfymca7zPDcCr4e9CJLr9GEyqi68HvHrYJ7Tj1Sd7` transferred **1,220,000,000 lamports**; funding wallet paid **79,934 lamports** in fees. Cisco confirmed this source as C13 recipient in his reply to the bundled amount/recipient question. A separate later deposit added **1,000 lamports** from a different, similar-looking address; it does not change the confirmed recipient or spending cap.

C11 buffer write exited 0 at **11:22:15.769Z**. Authority handoff signature **`RGHKFzihm7wkCnDRTEthcUsqUAmuwq4SWB2rM5dR6who4H37a7ghieGvK3LrzBfJPtpeK5da5dVi991Lh4qrVJs`**, finalized slot **452595437**. Buffer history: **241 successful transactions, none failed**; first creation/write signature `55CWz9kQZMvESFgMBXcCbr9yzwsZRdw3ygdo4tWndei5UAnGQk3MDT7KdHqj4GV91h9ocq7o2jSYY2qtgTqNt9jP`. Finalized authority/229,432-byte size and hash passed again at **11:24:18.198Z**; only then the buffer key was deleted. C11 spend **1.167609882 SOL**, under 1.2 SOL cap; retained buffer rent **1.1663934 SOL**. No C12 deploy or C13 sweep yet. [Funding/C11 checkpoint](handoffs/2026-10-02-mainnet-funding.md) records the full ruling and verification.

[Runbook C](handoffs/2026-09-28-runbook-c.md) governs C10-C13. [October 2 attended receipt](handoffs/2026-10-02-attended-run.md) records the actual gates; [current handoff](HANDOFF.md) records the next action. Other projects and all historical wallet files have not been inventoried by this checkpoint.
