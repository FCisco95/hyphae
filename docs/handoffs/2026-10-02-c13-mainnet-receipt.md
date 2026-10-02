---
date: 2026-10-02
summary: C3-C13 and integrations complete, pushed and CI green; public README synced, integrated refs deleted, rules/Jev preserved. Wallet lifecycle recorded. Next clock gate October 8-9.
---

# October 2 C13 mainnet receipt

## TL;DR

**C3-C13 and post-C13 integrations completed.** Mainnet program `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`, ProgramData `CHm2qHs1Mj3FF4pmRdwmtEYBrL2WkupesoayiwxiNp3J`, Ledger sole authority `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`, data length **229,432**, reviewed hash **`7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac`**. Buffer consumed. Returned **0.051537968 SOL**, finalized success/zero, then deleted hot key. Both temporary key files absent; persistent identity/Ledger retained. C13 `874fa19` pushed/CI **37003102460 success**; public README `d1a9f34` pushed; fully integrated timing/docs refs deleted. Final documentation checkpoint follows. C14-C22 remain outside this arc.

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

Fresh read-only uptake **11:48:42.858Z**: epoch 1 closed, epoch 2 open to October 9 00:00Z; epochs 1/2 submissions/intakes **0/0**, lifetime community submissions **3**. Prepared request for Cisco to send himself: **Please bring real MYCEL reply/quote contributions through the existing Hyphae bot submission flow during epoch 2, before October 9 00:00 UTC. Invite original work now so scoring and the October 8 author/duplicate audit have time to run.** No agent community message or payout promise.

## /organic-sync fields

Runner **Codex / GPT-6**; exact runtime model variant, effort and token/cost usage unavailable. No helpers/paid scoring calls. Program/image/migrations and attended read-backs above; final SHAs/checks/branches below. Vault/Organic/Sentinel unchanged; SDK pinned. Downstream public read API v1 remains available with truthful empty/unavailable payment status; deploying the program does not bind a mainnet community or change the pot source.

## Final integration, public read-back and branch receipt

| Milestone | SHA / verification |
|---|---|
| C7 accepted truth | Original ad40b77 integrated as `fa6c35d93dbd40b2c4f856fd0152f6e76cc2ed5f` |
| Accepted timing patches | `9df0f41e36a3e36dcba925b40e7b314dbb2b7513`, `ca054d9413067bce30c67f43cc8c92303ae59f36` |
| Dependency cleanup | `37f2f8f07e06b7e7abbeca4cb71820b62516686a`, unused root Anchor removed/test-only web zod moved, no retained version upgrade, SDK 0.1.0 |
| C11 receipt | `bb4599318aeecd8f82f69bee6751f7f9b7a58601`, pushed |
| C13 receipt | `311830f97a53051f76ffb25b086fe6ef72aa9243`, pushed |
| C13 accepted truth | Original b95d0ab integrated as **`874fa199f0e689b3243f0a653b7f2660c4cf0371`**, pushed; range-diff identical, no conflict |
| Exact integration CI | **37003102460 success**, all tests/typecheck/lint, drizzle check, Postgres 17 and H-CONTRACT vectors |
| Public README C7/C13 | `1caeebb5f30366c7cb9cfa5d9502e76106b69ad4` / **`d1a9f347f3f62731e7ce4d69e222a556d3d7dd95`**, both pushed from owning checkout; README only, no conflicting edit |
| Fresh local gate | **727 passed, 1 skipped** (106 core/80 web/541 API), typecheck/lint exit 0, 266 files; production web build exit 0 |
| Site C13 deployment | **dpl_E7jkDXr6cKZrtAftHAoYz349fANy**, Ready/aliased; browser 11:50:16Z renders mainnet/devnet trust, community/network funding gate, API/public README links |
| Mainnet empty state | Finalized program-owned accounts query **11:46:42Z: 0 accounts**; claims route 200/empty; no inferred mainnet community/vault/payout |
| Integrated refs deleted | Timing 02ee74e and docs b95d0ab local/remote, only after pushed CI green and identical patch mappings; atomic SHA leases protected remote tips |
| Preserved refs | Rules **158452fe2b22a1e42e5efd42f3f7e11bfdf59c70**, Jev **707d7daf21e217d9a8a64e58514065f5e3bca45e**, still local/pushed unmerged |
| Worktrees/scratch | Only main and detached c1-gate registered. Candidate/leftover folders/untracked wsl preserved; only task test log/browser snapshot removed |

API/db/program production files match the frozen candidate, excluding the accepted timing tests; C13 changes only approved web/docs/tests copy. No new sensitive implementation or conflict-altered code; unchanged accepted reviews reused, no mandatory fresh review triggered. Final receipt commit changes docs only and reuses this accepted local gate; push/exact-SHA CI checked afterward. No hook bypass.

Final live read **11:59:28Z**: API `6839d31b317318` and worker `817400c9901de8` both **started** on C7's v11 image; `/health`, `/docs`, `/v1/openapi.json` all **200**. Strict handoff validator passed (only existing candidate-checkout portability warning), diff check passed, all **13 resume paths** exist and verified C13 fields match. No new production mutation.

## Next clock gates and parked items

This arc ends here. Recommend Cisco invite genuine contributions promptly; current uptake is zero. Next attended C14-C18 on **October 8**, C18b author/duplicate audit from **23:00Z**, then C19-C22 only after epoch 2 closes **October 9 00:00Z** and fresh close/hold/safety proofs pass. No overnight proof assumed. Video/submission **October 9-10**. SDK freeze through **October 12**.

No unresolved C3-C13 stop remains: amount/recipient ruling accepted, device readiness cleared, finalized proofs passed, public README conflict check clean. Rules/Jev remain deferred to epoch 3; existing Postgres multi-pool/calibration/project-context follow-ups remain in September 30 receipts. Recommend retain candidate/leftover folders and optional devnet program for now; deletion/devnet closure are outside this arc. Founder dashboard/domain/cost follow-ups remain parked; no new spend/custody/public claim decision inferred. /organic-sync can reconcile this post-ship receipt with the private plan without an agent vault write.

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
Resume Hyphae after the completed C3-C13 arc and integrations. Mainnet program/ProgramData/Ledger authority/hash verified, buffer consumed, 0.051537968 SOL returned, sweep finalized/zero, both temporary key files deleted after gates. C13 874fa19 pushed/CI 37003102460 success, public README d1a9f34 pushed, timing/docs refs deleted; rules/Jev/wsl preserved. Final documentation checkpoint follows 874fa19; verify actual HEAD/CI. Never fund retired addresses or redeploy.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/WALLETS.md, docs/BUILDLOG.md, docs/handoffs/2026-10-02-c13-mainnet-receipt.md, docs/handoffs/2026-10-02-mainnet-funding.md, docs/handoffs/2026-09-28-runbook-c.md.
Model: GPT-6.1 Sol (high), current plan runbook-execution recommendation.
Skills: handoff-memory, superpowers:verification-before-completion, vercel:vercel-cli, handoff.
Verify Git/CI and read receipts. Cisco needs real epoch-2 contributions (0 submissions/intakes at 11:48:42Z). Prepare the next authorized sitting: C14-C18 October 8, C18b from 23:00Z, C19-C22 after October 9 00:00Z and fresh safety gates, video/submission October 9-10. Do not execute these later steps in this completed arc. Preserve rules/Jev/candidate/wsl; optional folder/devnet-close work remains outside scope.
```
