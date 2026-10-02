---
date: 2026-10-02
summary: C3-C13 passed; program verified on mainnet, unused funds returned, both temporary key files deleted after gates. Final C13 integrations and local/CI gate next.
---

# October 2 C13 mainnet receipt

## TL;DR

**C3-C13 completed with Cisco attending.** Mainnet program `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`, ProgramData `CHm2qHs1Mj3FF4pmRdwmtEYBrL2WkupesoayiwxiNp3J`, Ledger sole authority `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`, data length **229,432**, reviewed executable hash **`7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac`**. Buffer consumed. Returned **0.051537968 SOL**, verified finalized success/zero, then deleted hot key. Both temporary key files absent; persistent identity and Ledger retained. Next: integrate C13 truth, approved public README, fully integrated ref cleanup and final gates. C14-C22 remain out of scope.

## Attended deployment and cleanup

| Receipt | Actual result |
|---|---|
| C12 preconditions | Mainnet genesis exact, program absent, fee estimate 10,000 micro-lamports/CU; verified buffer finalized under Ledger; same hot file readable by Windows UNC, no copy |
| Device | CLI printed Waiting for your approval, then **Approved**; one blind Ledger approval, no retry |
| Deploy | `5B2are5dPJqDvirkFH5CGLdPSzcvkaBeA6jEkTjq68HfHo5sNgt4SksG646wDXAcMx3f4Xw1pLAJATM7oWUDVJJ`, finalized slot **452597368**, no error; exit 0 **11:31:26.864Z**, fee **15,030 lamports** |
| Deploy signers | Exact temporary deployer, program identity and Ledger authority |
| Finalized program | **11:33:06.704Z**: Ledger authority exact, loader owner correct, ProgramData above, length 229,432, ProgramData rent 1,166,393,400 lamports |
| Program hash | solana-verify exact **7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac** |
| Buffer | Finalized AccountNotFound for `E8MhkV28a4918ZpqRZHAf6ANqK8GxkroEy82GEFAdBSF` |
| Confirmed return wallet | **`Fjgmfymca7zPDcCr4e9CJLr9GEyqi68HvHrYJ7Tj1Sd7`**, explicitly accepted by Cisco, System-owned |
| Sweep | `4n2ecxuQvHaRf8eiHuu7ujbWNMcBkZMDsugXMCtg8LZYcSo4kw79RWXWyDYTt99GoBB4MYfPsacFRQBfd42hu7d8`, finalized slot **452597849**, **51,537,968 lamports**, fee **5,000 lamports** |
| Confirmation / zero | solana confirm -v with finalized commitment succeeded; recipient/amount verified, deployer balance **0** at **11:34:18.872Z** |
| Hot key deletion | Exact canonical path and public address rechecked, only that file deleted; both temporary files verified absent **11:34:53.582Z** |
| Claims API | **11:35:24.150Z**, HTTP **200**, Ledger wallet total_claims **0**, claims empty |

[Mainnet deployment](https://solscan.io/tx/5B2are5dPJqDvirkFH5CGLdPSzcvkaBeA6jEkTjq68HfHo5sNgt4SksG646wDXAcMx3f4Xw1pLAJATM7oWUDVJJ) and [returned balance](https://solscan.io/tx/4n2ecxuQvHaRf8eiHuu7ujbWNMcBkZMDsugXMCtg8LZYcSo4kw79RWXWyDYTt99GoBB4MYfPsacFRQBfd42hu7d8). Receipt rests on direct finalized RPC/CLI reads.

## Funding versus payment

Cisco funded **1.22 SOL** and explicitly accepted the amount departure under the original **1.2 SOL spending cap**, confirming the original sender as return recipient. A later **1,000-lamport deposit** from a different similar-looking address was investigated; that address was never substituted as recipient. All unused funds returned to the exact confirmed original address.

| Deployer accounting | SOL |
|---|---:|
| Total received, including 1,000-lamport deposit | 1.220001 |
| Returned | 0.051537968 |
| ProgramData and program-account deposits | 1.16722652 |
| Deployer transaction fees, including sweep | 0.001236512 |
| Total deployment costs | **1.168463032**, below cap |
| Final deployer balance | **0** |

Source wallet funding fee **0.000079934 SOL** is separate. Most funding remains allocated to program storage. Later Ledger-authorized closure can reclaim the large storage deposit but permanently disables that program address; no automatic refund date. No mainnet MYCEL community/vault/epoch publication created by this arc, no contributor payment or new Organic fee collection claimed. Treasury/pot/custody policy unchanged.

## Prior receipts, review and gates

- [Epoch proof](2026-10-02-epoch-proof.md) passed after October 2 00:00Z. Epoch 1 empty snapshot/before_first_paid_epoch; epoch 2 open to October 9 00:00Z, first_paid_epoch 2. Completed devnet rehearsal/C1/C2 were not repeated.
- [Attended C3-C7](2026-10-02-attended-run.md): frozen `b3c82c7`, Fly v11 `deployment-01M3XYDW5XW7AEAY68CKVPKC2X`, digest `sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2`; Neon 0000-0012 exact hashes/counts, direct endpoint/3-second lock timeout/attempt 1; API/site and ten-minute worker recovery passed.
- C7 through `4a41655` pushed, exact CI **36990943344 success**. `9a7e681` and registry `a8a5d0a` pushed, CI **36992801247 / 36997676179 success**. C11 `bb45993` committed locally before C12; push follows final gates.
- [Funding/C11](2026-10-02-mainnet-funding.md): candidate SHA256/executable hash rechecked, 241 successful buffer transactions / 0 failed, finalized authority/size/hash before buffer-key deletion. Initial CLI URL parser failed before a transaction; corrected secure stdin delivery verified, same buffer retried. Immediate finalized authority read lag resolved before deletion.
- Existing accepted local gate **727 passed, 1 skipped**, typecheck/lint/web build exit 0. Final gate required after C13 truth integration. No new sensitive implementation or conflict-altered accepted patch; unchanged accepted reviews reused. SDK **0.1.0 exactly** through October 12.

## Uptake and request prepared for Cisco

Latest recorded uptake **10:02:50Z**: epochs 1/2 submissions/intakes **0/0**, lifetime community submissions **3**; refresh for final handoff. Prepared request for Cisco to send himself: **Please bring real MYCEL reply/quote contributions through the existing Hyphae bot submission flow during epoch 2, before October 9 00:00 UTC. Invite original work now so scoring and the October 8 author/duplicate audit have time to run.** No agent community message or payout promise.

## /organic-sync fields

Runner **Codex / GPT-6**; exact runtime model variant, effort and token/cost usage unavailable. No helpers/paid scoring calls. Program/image/migrations and attended read-backs above; append final integration/public SHAs, exact-SHA CI, branch disposition and fresh uptake after gates. Vault/Organic/Sentinel unchanged; SDK pinned. Downstream public read API v1 remains available with truthful empty/unavailable payment status; deploying the program does not bind a mainnet community or change the pot source.

## Generated artifacts

| Artifact | Canonical home | State |
|---|---|---|
| Mainnet program | Program/ProgramData addresses above | Reviewed hash, Ledger sole authority |
| Temporary deployer and buffer keys | Former exact WSL paths in [wallet registry](../WALLETS.md) | Both files deleted after gates; retired addresses, do not fund |
| Persistent program identity | Git-ignored repo target/deploy/hyphae-keypair.json | Retained; not program upgrade authority |
| Ledger | Existing device/recovery arrangement | Retained; no export/software key created |
| Receipts | docs/WALLETS.md, docs/HANDOFF.md, docs/BUILDLOG.md, this snapshot | No secret/vault strategy copied |

## Suggested skills

`handoff-memory`, `superpowers:verification-before-completion`, `vercel:vercel-cli`, `handoff`. No helpers.

## Resume prompt

```text
Resume Hyphae after C13. Mainnet program/ProgramData/authority/hash verified, buffer consumed, 0.051537968 SOL returned to the confirmed original wallet, sweep finalized/zero and both temporary key files deleted after gates. Never fund retired addresses, repeat funding or redeploy.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/WALLETS.md, docs/BUILDLOG.md, docs/handoffs/2026-10-02-c13-mainnet-receipt.md, docs/handoffs/2026-10-02-mainnet-funding.md, docs/handoffs/2026-09-28-runbook-c.md.
Model: GPT-6.1 Sol (high), current plan runbook-execution recommendation.
Skills: handoff-memory, superpowers:verification-before-completion, vercel:vercel-cli, handoff.
Verify Git state; integrate only b95d0ab C13 patch by rebase/fast-forward, sync approved public README, delete only proven fully integrated refs, gate/push/exact-SHA CI and append final receipt/current uptake. Stop before C14-C22, rules/Jev merge and optional folder/devnet-close work.
```
