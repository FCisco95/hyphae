# Submission checklist (October 11–13, 2026)

**Deadline: October 13 06:59Z (October 12 23:59 PDT).** No deployment after **October 12 12:00Z**, except a single-commit broken-link or README correction. Cisco records and submits the videos.

## Verified scope

Epoch 2 paid on mainnet on October 10. Four of four payees claimed 1,238,881,509 lamports, unclaimed 0; three payees are non-founder community members. The community, vault, publish, claim and IDL signatures and October 11 full program hash are in the [public receipts](https://github.com/FCisco95/hyphae-program/blob/main/docs/2026-10-10-mainnet-payout.md). API and worker last recorded image: `jev-e5f864b`; reviewed `next` release is held until Cisco approves E0–E6. Epoch 3 remains on `reward-eval/2`; scorer amendment, announcements and publication are outside this arc.

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

1. **Make Status truthful.** Both READMEs must cite mainnet receipts, 4/4 paid, 0 unclaimed, the Ledger authority and full verified hash. Program docs push: `55396b6`; app truth checkpoint: `35c0692`, local until release.
2. **Check clean-browser links.** Open [site](https://hyphae-delta.vercel.app/), [proof](https://hyphae-delta.vercel.app/#proof), [trust](https://hyphae-delta.vercel.app/#trust), [epoch 2](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2), [claim page](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2/claim), [API docs](https://hyphae-api.fly.dev/docs), [OpenAPI](https://hyphae-api.fly.dev/v1/openapi.json), and every explorer/Solscan link in the READMEs and script. Record actual page results, not just HTTP 200 from an explorer shell.
3. **Resolve release approval.** Show the branch notes' member-visible strings and privacy call first. Run [release-plan E0–E6](2026-10-11-release-plan.md) only after Cisco says exactly `yes, run the post-payout release (E0–E6)`. No E7–E8 scorer switch. Without approval, retain local work and the hold.
4. **Verify the approved release and claim fix.** Fill the release Record. Let the pre-push hook run its gate; preserve both main/next histories. Smoke epoch 2, `/actions.json`, Action OPTIONS and the signed wallet record. Claim-page transaction changes require a fresh other-family ACCEPT before push. Capture dark 1920×1080 and 390 phone screenshots. If migration precheck refuses or smoke fails, follow the release rollback.
5. **Save final state.** Record actual SHAs, checks, judge links, confirmed hash, release state and remaining human steps in the short handoff. Never mark a held or review-blocked change shipped. No branch or worktree deletion without Cisco's yes.

## Recording and submission (Cisco)

1. **Record the demo.** Use [the script](2026-10-09-final-video.md), under three minutes. Beats 4–6 carry C16, C18, C20, C21 and all three non-founder claims; the duplicate refusal is optional and explicitly devnet. Read every number from the receipts or live epoch page.
2. **Record/upload the Colosseum videos.** Use the script and build log; open each uploaded video's viewer link while signed out. No unrecorded video is marked complete.
3. **Save the Colosseum form.** Include the public site, both public repos, video links and a description matching the README. Category: Governance & DAOs. Keep the no-token and prior-work disclosures from the September 17 build-log entry. State BUSL 1.1, Change Date 2028-10-12 and GPL-2.0-or-later.
4. **Submit before October 13 06:59Z.** Read back the saved form and confirm Colosseum displays the submission. Record the final video and submission URLs.
5. **Record the submission receipt.** Give the agent the actual saved URLs and confirmation time for BUILDLOG and HANDOFF. No posts, payout, new keys, epoch-3 publication or scorer amendment in this arc.
