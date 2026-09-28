---
date: 2026-09-28
summary: The program's verifiable build reproduces. Two clean clones built in Anchor's pinned Docker image give the same bytes as every earlier build, sha256 cb4ffdd8…8d79, and the program the seven devnet runs used is byte-identical. The mainnet deploy sequence then ran on devnet with throwaway keys at a throwaway address. A hot key wrote the buffer, handed it to a key standing in for the Ledger, and only that key could deploy it. The chain reads back the stand-in as upgrade authority and the build's hash. No mainnet action, and the Ledger was not used.
---

# 2026-09-28 — verifiable build and deploy rehearsal

Authority: the session prompt's steps 2 and 3, under the verifiable-build ruling (`2026-09-27-keys-and-fee-rulings.md`, ruling 3) and the throwaway-key devnet deploys (`2026-09-25-gate-and-r6-rulings.md`). Nothing touched mainnet, Neon, Fly, Vercel or Cisco's Ledger.

## Verifiable build

**Source.** Commit `328e3dd` (the program's source last changed in `82657db`, its tests in `eaa8f1a`). `Cargo.lock` sha256 `0e0b5d93ec3b7ad98ba541009eccca07123bd38c2ca38c4839e6bdc3a1416024`, unchanged. No dependency or toolchain change was needed.

**Image.** `solanafoundation/anchor:v1.0.1`, digest `sha256:afa0c004f1ec96b5f420990dda46140298de00c528d177b62d6841242d2db0be`. Inside it: solana-cli 3.1.10, anchor-cli 1.0.1, and cargo-build-sbf 3.1.10 with platform-tools v1.52 (rustc 1.89.0).

**Command.** In WSL Ubuntu, Docker 28.1.1, from a fresh clone:

```sh
git clone --no-local <repo> ~/vb/run1 && cd ~/vb/run1/programs/hyphae
anchor build --verifiable --ignore-keys
sha256sum ../../target/verifiable/hyphae.so
solana-verify get-executable-hash ../../target/verifiable/hyphae.so
```

`--ignore-keys`: a fresh clone has no program keypair, and `declare_id!` already pins the address (the same flag CI uses). Anchor prints `Using image "solanafoundation/anchor:v1.0.1"` and builds inside the container.

| Run | Clone | Time (UTC) | `hyphae.so` sha256 | `solana-verify` hash |
|---|---|---|---|---|
| 1 | `~/vb/run1` at `328e3dd` | 15:18:14 → 15:21:44 | `cb4ffdd8074442310f7953b5233a4c2df4eaf8c3f7627cdf259efb84ebf98d79` | `7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac` |
| 2 | `~/vb/run2` at `328e3dd` | 15:22:41 → 15:24:54 | `cb4ffdd8…8d79` | `7e902d1b…43ac` |

The file is 229,432 bytes. `solana-verify` (0.5.2) hashes the program without trailing zero padding, so its hash is the one to compare with the chain.

**The same bytes everywhere.**
- The plain WSL build and CI's `Program` run `36332048980` give sha256 `cb4ffdd8…8d79` too.
- The devnet program the seven runs used, `EAz8WkyU…d6E`, reads back `7e902d1b…43ac` from the chain (`solana-verify get-program-hash`). The code proven on devnet is the code the verifiable build makes.
- On mainnet, `EAz8WkyU…d6E` does not exist yet.

## Deploy rehearsal (devnet, throwaway keys)

The mainnet sequence:
1. A hot key writes the verifiable `.so` to a buffer.
2. The hot key hands the buffer's authority to the Ledger.
3. The Ledger signs the one deploy, so the program never has a hot upgrade authority.

Here a file key stands in for the Ledger, and the program address is a fresh throwaway.

**Keys** (WSL `~/hyphae-devnet/`, generated for this run; never `target/deploy/hyphae-keypair.json`):

| Role | Address | File |
|---|---|---|
| Hot key (fee payer, first buffer authority) | `Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM` | `admin-2026-09-25.json` (the throwaway devnet admin) |
| Ledger stand-in (upgrade authority) | `GQxUJZyGqm1GJzQCxjDEA9ApJu1szXdYg5XY45XpKaTA` | `ledger-standin-2026-09-28.json` |
| Program (throwaway address) | `6opWfFKkJwU6S63i2vruHvTuoJN4f2P8oSBAy5g4e1ox` | `rehearsal-program-2026-09-28.json` |
| Buffer | `6WTVL212DZNDpkMMQE3JJhngvcy9dm3kAEsxRVRTkkh6` | `rehearsal-buffer-2026-09-28.json` |

The `.so` is run 2's `target/verifiable/hyphae.so`.

**Steps** (`-C config.yml` points at devnet and the hot key):

| # | Who signs | Command | Result |
|---|---|---|---|
| 1 | hot key | `solana program write-buffer hyphae.so --buffer rehearsal-buffer-2026-09-28.json` | Buffer created (`2dMjq44ff9jyFZdUnW8r39KWiRGf8xdhBnvwRVTTcNXx6t782zdSXXTiqrqKR319neGpRMbUPeXT7Vebb84af68S`), then 227 write transactions, 15:25:21–15:25:42Z. Rent 1.1663934 SOL. |
| 2 | hot key | `solana program set-buffer-authority 6WTVL… --new-buffer-authority GQxUJ…` | `3Ksut2p8cRSnLawdFKFm9EGiEM7Wc8uvUCHi1kQNDSTPG7anQ8RoXfDmn1EH71rs7pwFeeoJaQiCPdiqqTFXDgj4`. From here the hot key can't write the buffer. |
| 3 | nobody (reads) | `solana program show 6WTVL…` and `solana-verify get-buffer-hash -u devnet 6WTVL…` | Authority `GQxUJ…`, 229,432 bytes, hash `7e902d1b…43ac` = the build. **This is the check before the upgrade key signs:** it proves the buffer holds the verified bytes and only the upgrade key controls it. |
| 4 | hot key (payer), program key, **stand-in** | Windows Solana CLI 3.1.10: `solana program deploy --buffer 6WTVL… --program-id rehearsal-program-2026-09-28.json --upgrade-authority ledger-standin-2026-09-28.json --keypair admin-2026-09-25.json --url devnet` | `3z9yFgmu9URNsSqhHQeoGUwwnL3MtfewAkpUR3oU61EKwLoKsV4aKt8VGwvCX2Debrhg1vrh8DuWNy8xbD5e1358`, 15:26:18Z, slot 505201263. One transaction: create the program account, then `DeployWithMaxDataLen` (max length 229,432). |
| 5 | nobody (reads) | `solana program show 6opWf… --output json`; `solana-verify get-program-hash -u devnet 6opWf…` | Below. |

**Read back from devnet (15:26:24Z):**
- Program `6opWfFKk…e1ox`, owner `BPFLoaderUpgradeab1e…`.
- ProgramData `3pUn7GoxgWCLs9Z9ixCNRuGrpbwTg6RhJ2cBNyx9NjL4`, 229,432 bytes, 1.1663934 SOL.
- **Authority: `GQxUJZyGqm1GJzQCxjDEA9ApJu1szXdYg5XY45XpKaTA`, the stand-in.**
- **On-chain hash: `7e902d1b…43ac`, equal to both builds.**
- The buffer account is gone: the deploy drained it into the payer.
- The deploy's signers are exactly the fee payer, the program key and the stand-in. The hot key was never an upgrade authority, and the stand-in signed only the deploy.

**Cost on devnet.** The hot key went from 3.20720688 to 2.03881536 SOL. The ProgramData rent (1.1663934 SOL) is the buffer's rent carried over. The rest is the program account (0.00083312 SOL) and 0.001165 SOL in fees for 230 transactions. Mainnet rent reads the same (`solana rent 229477 -u mainnet-beta`: 1.1663934 SOL).

**What it does not prove.**
- **The Ledger signing the deploy.** On mainnet the stand-in becomes `usb://ledger?key=2/0` (`44'/501'/2'/0'` = `2kz1Zq…`). That needs Cisco's device, which this arc did not touch.
- **A working program at `6opWf…`.** The bytes declare `EAz8WkyU…d6E`, and Anchor's entrypoint refuses any instruction sent to another address (`DeclaredProgramIdMismatch`, 4100). This rehearses the deploy mechanics and the readback; the seven devnet runs already proved the program itself.

## Where the Ledger connects

The Ledger is plugged into the Windows machine. WSL can't see USB devices here (no `usbipd`), and Windows had no Solana CLI. So the mainnet deploy runs from the **Windows Solana CLI**: Agave v3.1.10's official `solana-release-x86_64-pc-windows-msvc.tar.bz2` (sha256 `84abbbf25a463a0b53aec04df0ede9cb4f00d6bf2ea1ab6870e7a4306b39c06b`). It reports the same build as WSL's (`src:7bc9c805`). Step 4 above ran from that binary, reading the keys from WSL. The program keypair also lives on Windows (`target/deploy/`), so the deploy's three signers meet there. Runbook C (`2026-09-28-runbook-c.md`) carries the setup and the device approvals.

The rehearsal program stays deployed on devnet as evidence. Closing it with the stand-in would return about 1.167 devnet SOL if the throwaway admin runs short; it holds 2.04 SOL now.
