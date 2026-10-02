---
date: 2026-10-02
summary: Wallet registry added at Cisco's request; exact deployment key paths and roles verified. C10 funding and return address pending; C11-C13 not run.
---

# October 2 wallet registry checkpoint

## TL;DR

Cisco reaffirmed continuation and asked to retain a durable record of the wallets created for his programs. [docs/WALLETS.md](../WALLETS.md) is the canonical Hyphae inventory for this mainnet arc. It records both temporary software keys, the persistent program identity and the existing Ledger authority. It changes no custody rule and contains no private key or recovery phrase. Continue at C10 funding verification; never regenerate an existing deployment key or repeat funding without reading state.

## Verified receipt

- WSL Ubuntu, user fcisco95: deployer `/home/fcisco95/hyphae-mainnet/deploy-hot-2026-10-02.json` resolves to `CpBum8ynMAawJSdNCKS9NLZXc6hySE1aDCqna7XhmyNT`; buffer `/home/fcisco95/hyphae-mainnet/deploy-buffer-2026-10-02.json` resolves to `E8MhkV28a4918ZpqRZHAf6ANqK8GxkroEy82GEFAdBSF`. Both file modes **600**. Public-address commands read the files without printing private material.
- Persistent `target/deploy/hyphae-keypair.json` public address matches `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`; `git check-ignore` confirms the file is ignored.
- Ledger address `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR` was read successfully in C8. It will be the mainnet program authority after C12; the temporary deployer cannot close that deployed program merely by holding its fee-paying key.
- Finalized deployer balance **0** at **2026-10-02T10:45:23.740Z**. Cisco's transfer signature and named return address remain pending. No mainnet buffer/deploy/sweep executed.
- Fresh mainnet rent at 10:31:24.900Z: ProgramData **1,166,393,400 lamports**, program account **833,120 lamports**. Large storage deposit remains allocated while the program operates; later Ledger-authorized closure can reclaim it but permanently disables that program address. Fees are non-refundable; no whole-budget immediate refund promised.
- Read-only uptake refresh at 10:02:50.337Z: epoch 1 closed, epoch 2 open to October 9 00:00Z, both submissions/intakes **0**, lifetime community submissions **3**.

## Validation and state

Prior C8-C10 checkpoint `9a7e6817a93c4fb6b8ec2db55d0bd6b47c8aa1e6` is pushed, exact-SHA CI **36992801247 success**. Registry changes only documentation; accepted unchanged local gate remains **727 passed, 1 skipped**, typecheck/lint exit 0 and web build exit 0. No new sensitive implementation or conflicting integration; accepted review unchanged. Vault, Organic, Sentinel and public-program checkout unchanged by this checkpoint. SDK stays exactly 0.1.0. Original refs and untracked `wsl` preserved.

## Generated artifacts this checkpoint

| Artifact | Canonical home | State |
|---|---|---|
| Wallet metadata | `docs/WALLETS.md` | Public addresses/locations/roles; not a key backup |
| Portable checkpoint | This file, `docs/HANDOFF.md`, `docs/BUILDLOG.md` | Tracks pending funding and exact deletion gates |

No new wallet, secret copy or key deletion. Existing temporary keys remain only at their recorded canonical WSL paths. Ledger recovery backup was not inspected.

## Suggested skills

`handoff-memory`, `solana-dev`, `superpowers:verification-before-completion`, `handoff`. No helpers.

## Resume prompt

```text
Resume Hyphae at C10 funding verification. C3-C9 passed, C7 integrations and CI green, prior main checkpoint 9a7e681 pushed with exact-SHA CI 36992801247 success. Wallet inventory added at Cisco's request; two existing WSL temporary keys verified, no copies/deletions. Deployer CpBum8ynMAawJSdNCKS9NLZXc6hySE1aDCqna7XhmyNT finalized balance 0 at 10:45:23Z. Await the 1.2 SOL mainnet transfer and Cisco's named return address; don't regenerate keys or fund twice.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/WALLETS.md, docs/handoffs/2026-10-02-wallet-registry.md, docs/handoffs/2026-10-02-attended-run.md, docs/handoffs/2026-09-28-runbook-c.md.
Model: GPT-6.1 Sol (high), current plan's runbook-execution recommendation; recorded runner GPT-6, exact runtime effort/usage unavailable.
Skills: handoff-memory, solana-dev, superpowers:verification-before-completion, handoff.
Verify funding and refresh required safety reads, then attended C11-C13. Update the registry with actual signatures, ProgramData and verified key deletion receipts. Finish C13 integration/public README/final handoff only after read-back. Preserve all current gates, unmerged rules/Jev refs and wsl; C14-C22 and folder deletion remain out of scope.
```
