# Submission checklist (October 11–13, 2026)

**Deadline: October 13 06:59Z (October 12 23:59 PDT).** No deployment after **October 12 12:00Z**, except a single-commit broken-link or README correction. Cisco records and submits the videos.

## Verified scope

Epoch 2 paid on mainnet on October 10. Four of four payees claimed 1,238,881,509 lamports, unclaimed 0; three payees are non-founder community members. The community, vault, publish, claim and IDL signatures and October 11 full program hash are in the [public receipts](https://github.com/FCisco95/hyphae-program/blob/main/docs/2026-10-10-mainnet-payout.md). Cisco approved E0–E6: API/worker `next-3a3e294`, migrations 0018+0019 and web `77e575d` are released; CI and browser/Cisco smoke passed. [Release Record](2026-10-11-release-plan.md#record). Epoch 3 remains on `reward-eval/2`; scorer amendment, announcements and publication are outside this arc.

Both [app](https://github.com/FCisco95/hyphae) and [program](https://github.com/FCisco95/hyphae-program) repositories are public. The former collaborator-access step is removed; judges can open them without an account. Both are BUSL 1.1, source available, not open source.

| Runbook rows | State | Evidence |
|---|---|---|
| C14–C15 | Done October 10: admin funded, Ledger address and initialization plan checked | [Payout session](../handoffs/2026-10-10-payout-session.md#rows) |
| C16–C18 | Done October 10: community created, API binding read back, vault funded with 1.5 SOL | [C16/C18 finalized signatures](https://github.com/FCisco95/hyphae-program/blob/main/docs/2026-10-10-mainnet-payout.md#finalized-transactions), payout session C17 |
| C18b | Done after close on the unchanged frozen snapshot; author attestation recorded; pause skipped because the epoch had closed | [Audit and ruling](../handoffs/2026-10-10-payout-session.md#c18b-audit-late) |
| C19–C20 | Done October 10: four-leaf allocation stored and published; numbers and Treasury fee match | [Publication receipt](https://github.com/FCisco95/hyphae-program/blob/main/docs/2026-10-10-mainnet-payout.md#finalized-transactions) |
| C21–C22 / P14 | Done October 10: founder's browser claim, API/page readback; later all four claimed; IDL published | [All four claims and IDL receipts](https://github.com/FCisco95/hyphae-program/blob/main/docs/2026-10-10-mainnet-payout.md#finalized-transactions) |

Soulbound Token-2022 points, Codama client and the web admin dashboard are not built. Operator-attested X accounts are not verified ownership. Do not present fixture screenshots as mainnet evidence. The member-journey API was exercised by Cisco; do not infer member use or a real-phone test.

## Preparation (agent)

1. **Status done.** Both READMEs cite October 10 mainnet receipts, 4/4 paid, 0 unclaimed and the hash read. Program docs main `e574a99` pushed; app truth `35c0692` included in release `77e575d`.
2. **Links passed.** [Clean-browser audit](2026-10-11-judge-links.md): site/proof/trust, epoch/claim, docs/OpenAPI, both public repos and every explorer/Solscan receipt. Added signed-wallet and Actions routes passed after release. Actual content and identifiers checked.
3. **Approval recorded.** One-screen member copy/privacy sheet preceded Cisco's exact `yes, run the post-payout release (E0–E6)`. Public aggregates/member checklist private selected. E7–E8 remain excluded.
4. **Release and claim fix passed.** [Record](2026-10-11-release-plan.md#record) filled; both histories preserved; automatic gate and CI green; db.mjs precheck/migrations/postcheck passed; API, worker and web live. Fresh other-family claim/privacy ACCEPT. Epoch 2, wallet, Actions/CORS and Cisco's private /me passed. [11 production screenshots](screenshots/2026-10-11-live/README.md), dark 1920×1080 and 390 phone. No rollback required.
5. **Final handoff saved.** [HANDOFF](../HANDOFF.md) carries actual source SHAs, checks, full program hash, judge links and Organic impacts. Cisco still records/uploads/submits below. Held histories and the existing next worktree stay intact; only the release's disposable exact-source worktree is cleaned up.

## Recording and submission (Cisco)

1. **Record the demo.** Use [the script](2026-10-09-final-video.md), under three minutes. Beats 4–6 carry C16, C18, C20, C21 and all three non-founder claims; the duplicate refusal is optional and explicitly devnet. Read every number from the receipts or live epoch page.
2. **Record/upload the Colosseum videos.** Use the script and build log; open each uploaded video's viewer link while signed out. No unrecorded video is marked complete.
3. **Save the Colosseum form.** Include the public site, both public repos, video links and a description matching the README. Category: Governance & DAOs. Keep the no-token and prior-work disclosures from the September 17 build-log entry. State BUSL 1.1, Change Date 2028-10-12 and GPL-2.0-or-later.
4. **Submit before October 13 06:59Z.** Read back the saved form and confirm Colosseum displays the submission. Record the final video and submission URLs.
5. **Record the submission receipt.** Give the agent the actual saved URLs and confirmation time for BUILDLOG and HANDOFF. No posts, payout, new keys, epoch-3 publication or scorer amendment in this arc.
