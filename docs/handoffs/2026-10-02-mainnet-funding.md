---
date: 2026-10-02
summary: Cisco accepted 1.22 SOL funding with 1.2 SOL spending cap and named return wallet. C11 passed; buffer key deleted after finalized authority/hash gates. C12 next.
---

# October 2 mainnet funding receipt

## TL;DR

The deployer received **1.22 SOL**, not the runbook's 1.2 SOL. The amount mismatch was parked and reported. Cisco replied **"Okay, okay."** to the bundled request confirming a **1.2 SOL spending cap** and return of all unused funds to **`Fjgmfymca7zPDcCr4e9CJLr9GEyqi68HvHrYJ7Tj1Sd7`**. This clears C10. **C11 now passed**, buffer key deleted only after finalized authority/size/hash verification. Deployer key retained; **C12 next** with Cisco's Ledger. Do not repeat funding or regenerate either key.

## Actual receipt

- Signature: [ZHWxt4jvPbRvLeH2wwi7eKyTqNMp1VCrY1NxTtCLng5xLMMBnzje9fFjhGpvkujn1qRjaa6qBjPPzadhS9P5k8m](https://solscan.io/tx/ZHWxt4jvPbRvLeH2wwi7eKyTqNMp1VCrY1NxTtCLng5xLMMBnzje9fFjhGpvkujn1qRjaa6qBjPPzadhS9P5k8m).
- Block time **2026-10-02T11:14:43Z**, slot **452593580**.
- Verified at **2026-10-02T11:15:21.161Z** through the existing authenticated RPC with finalized commitment. Genesis matched mainnet `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`; transaction `meta.err = null`.
- System transfer: source `Fjgmfymca7zPDcCr4e9CJLr9GEyqi68HvHrYJ7Tj1Sd7`, destination `CpBum8ynMAawJSdNCKS9NLZXc6hySE1aDCqna7XhmyNT`, **1,220,000,000 lamports**. Source paid **79,934 lamports** transaction fee. Finalized deployer balance **1,220,000,000 lamports**.
- Solscan browser fetch was unavailable; receipt is based on direct finalized RPC transaction/balance data, not an explorer inference.

## Amount and recipient ruling — accepted

The bundled request explicitly named both the 1.2 SOL spending cap and the full source wallet above as C13 return recipient. Cisco accepted it. No inferred pot-source or custody change. A later successful transfer of **1,000 lamports** came from a different address resembling that source, signature `3WGz8EDrb5zGbxMEY4CmMoEeUGCZhmDHTCVbXDWgesiJd4hanGy2TeVbpthqbaybGgbKsaf9PreZrbC362S3yMNv`, slot 452593762. We investigated that balance increase read-only and did not substitute the later sender as recipient; the full original address remains binding. All unused funds, including that tiny additional deposit, belong in the approved C13 sweep.

## C11 — passed

- Fresh candidate `b3c82c7`, clean tracked tree, 229,432 bytes, SHA256 `cb4ffdd8074442310f7953b5233a4c2df4eaf8c3f7627cdf259efb84ebf98d79`, executable hash `7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac`; CLI 3.1.10; both original public key addresses match. Mainnet program and buffer absent before write; RPC recommended **10,000 micro-lamports/CU**.
- Initial URL forwarding attempt failed in CLI argument parsing before any transaction. Secure stdin delivery through a WSL login shell was verified against mainnet genesis, then the same approved write resumed into the same buffer. No source change or key copy.
- Write start **11:22:08.959Z**, exit 0 **11:22:15.769Z**, buffer `E8MhkV28a4918ZpqRZHAf6ANqK8GxkroEy82GEFAdBSF`.
- Authority handoff **`RGHKFzihm7wkCnDRTEthcUsqUAmuwq4SWB2rM5dR6who4H37a7ghieGvK3LrzBfJPtpeK5da5dVi991Lh4qrVJs`**, finalized slot **452595437**, no error. First buffer creation/write signature `55CWz9kQZMvESFgMBXcCbr9yzwsZRdw3ygdo4tWndei5UAnGQk3MDT7KdHqj4GV91h9ocq7o2jSYY2qtgTqNt9jP`.
- Immediate finalized read lagged the confirmed handoff; a fresh finalized read at **11:23:20.396Z** showed Ledger authority. Repeated finalized authority **`2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`**, length **229,432**, buffer hash exact at **11:24:18.198Z**. Buffer rent **1,166,393,400 lamports**.
- Canonical buffer key path resolved exactly; deleted only that file and verified absence **11:24:18.368Z**. Ledger public-address read still matched afterward; no device signing yet.
- Finalized buffer history **241 successful transactions / 0 failed**. Deployer balance **52,391,118 lamports** at **11:25:02.640Z**; C11 spend **1,167,609,882 lamports**, under cap. Mainnet program still absent. Windows CLI read the existing hot key through its UNC path and matched the deployer address without copying the key.

**Next: C12** with a clear transaction summary and one blind Ledger approval. Then C13 program/hash/authority/buffer read-back and sweep/confirm/zero before hot-key deletion.

## Validation and scope

Wallet registry commit `a8a5d0a4fd73e443902e0ce2ef83d16313606daf` pushed; exact-SHA CI **36997676179 success**. This checkpoint changes documentation only; unchanged accepted local gate is **727 passed, 1 skipped**, typecheck/lint and production web build exit 0. No new sensitive implementation or review-changing conflict. C7 remains complete; Neon 0000-0012 and Fly v11 unchanged. Original refs, candidate checkout and untracked `wsl` preserved. SDK exactly 0.1.0. No public README, vault, Organic or Sentinel edit.

## Generated artifacts this checkpoint

| Artifact | Canonical home | State |
|---|---|---|
| Funding metadata | `docs/WALLETS.md`, this receipt, `docs/HANDOFF.md`, `docs/BUILDLOG.md` | Public signature/addresses/amount and pending ruling |
| Funded existing deployer key | WSL Ubuntu `/home/fcisco95/hyphae-mainnet/deploy-hot-2026-10-02.json` | Retained; no copy/deletion; balance 0.052391118 SOL after C11 |
| Buffer identity key | Former WSL path `/home/fcisco95/hyphae-mainnet/deploy-buffer-2026-10-02.json` | Deleted after finalized C11 gates, absence verified |

No new key or secret copy. Approved hot-key C11 transactions completed; no Ledger signing or mainnet program deployment yet. Actual runner GPT-6; exact runtime effort/model variant/token/cost usage unavailable. No helpers. Deployment funding is not the MYCEL reward pot; no Organic fee or contributor payment claim.

## Suggested skills

`handoff-memory`, `solana-dev`, `superpowers:verification-before-completion`, `handoff`.

## Resume prompt

```text
Resume Hyphae at C12. Cisco accepted 1.22 SOL funding under 1.2 SOL spending cap and explicitly confirmed return of all unused funds to Fjgmfymca7zPDcCr4e9CJLr9GEyqi68HvHrYJ7Tj1Sd7. Later 1,000-lamport deposit from a similar-looking address does not change this recipient. C11 buffer E8MhkV28a4918ZpqRZHAf6ANqK8GxkroEy82GEFAdBSF finalized under Ledger 2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR, 229432 bytes, executable hash 7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac; buffer key deleted after proof. Hot key retained in registered WSL path, finalized balance 52391118 lamports at 11:25:02Z. No mainnet program deploy yet.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/WALLETS.md, docs/handoffs/2026-10-02-mainnet-funding.md, docs/handoffs/2026-10-02-attended-run.md, docs/handoffs/2026-09-28-runbook-c.md.
Model: GPT-6.1 Sol (high), current plan's runbook-execution recommendation.
Skills: handoff-memory, solana-dev, superpowers:verification-before-completion, handoff.
Refresh required safety reads; give C12's transaction summary, then run the authorized Windows deploy with one blind Ledger approval. Preserve C12 signed-error recovery and C13 sweep/confirm/zero-before-deletion gates. Then integrate C13 docs, update approved public README and finish handoff. C14-C22, rules/Jev merge and folder deletion remain out of scope.
```
