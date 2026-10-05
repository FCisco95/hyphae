# Submission checklist (Sat 2026-10-10)

Plan Week 4 #7. The deadline is 2026-10-12 23:59 PDT; Oct 11–12 are buffer. One step at a time. Each step names who does it and the check that closes it.

## Scope, as it stands

**Live state, October 5:** web serves `main` with the runtime of source `774b97e`; the API runs image `sha256:798e1888…` (migrations 0013+0014 applied) and the worker the frozen `sha256:1c2d6dd5…`; the reviewed mainnet program is under the Ledger (C1–C13, October 2). No MYCEL community, vault or payout exists on mainnet as of the October 5 reads; epoch 2 holds one counted contribution from one member, the founder. Read the [October 8–9 operator packet](2026-10-08-first-payout-readiness.md) (its [live receipts](2026-10-08-first-payout-readiness.md#live-receipts-october-5-read-only) are the source for every status line) before advancing the status. C14–C22 remain dated and attended, with publication after the October 9 close and all safety gates.

**Push hold:** do not push to `main` from 2026-10-08T22:00Z until 2026-10-10T00:00Z, because a docs push redeploys the web and the sitting forbids any deployment in that window. This checklist starts on October 10; its pushes begin after 00:00Z.

| Plan item | State | Evidence |
|---|---|---|
| Week 4 #1 API finishing | Built | `d712289`, `135a80f`, `1d56e5d` |
| Week 4 #2 vault integration note | Built | README "Funding a community's vault" (`1d56e5d`) |
| **Week 4 #3 web `/admin` page** | **Dropped by Cisco, 2026-09-27 19:43Z, for the hackathon.** The bot's `/raid` and `apps/api/scripts/set-rubric.ts` cover raids and rubric changes; funding is a Ledger transfer to the vault (Runbook C, C18). | Vault plan, 27 Sep evening amendment |
| Week 4 #4 empty, error and phone states | Built | `236905e`, screenshots `ffdfac0` |
| Week 4 #5 security review and CI | Program review 2026-09-27; whole-repo review 2026-09-28; CI on every push | `docs/handoffs/2026-09-27-afternoon-arc.md`, `docs/handoffs/2026-09-28-arc.md` |
| Week 4 #6 final video | Script: `docs/demo/2026-10-09-final-video.md` | Recorded by Cisco on Oct 9 |
| Member journey (private raid buttons, receipts, `/issue`, `/ops`, raid alerts) | Live on the API since 2026-10-05T14:26Z; Cisco exercised `/ops` and `/receipt` only. No member use, alert subscriber or real-phone test yet | [Execution record](2026-10-05-api-rollout-plan.md#execution-record-2026-10-05) |
| Not built | Soulbound Token-2022 points (Week 3 #1); the Codama client (Week 3 #5) | No points mint in `programs/hyphae`, no `clients/`; the README's Status says "Planned, not built" |

## Steps

1. **Freeze `main` (agent).**
   - Run the full gate on the final commit: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `drizzle-kit check`, `test:pg`, and `git diff --check`. If the program changed, also the WSL `anchor build` and `cargo test`.
   - Check the latest `CI` run on that commit is green.
   - Check the public repo `FCisco95/hyphae-program` holds the same `programs/hyphae` and `docs/rubrics/*.json` as that commit; if either changed, copy it there and re-verify the build.
   - Closes when: every check passes, recorded with the SHA and the CI run id.
2. **README status matches reality (agent writes, Cisco reads).**
   - The README's "Status" says exactly what is deployed: the api image, the Vercel site (https://hyphae-delta.vercel.app, live since the Sep 29 cutover), and whether the program is on mainnet. It is updated from the build log, not from this file.
   - Runbook C's Parts 1–2 completed October 2 (C1–C13; see the C13 receipt):
     - the api routes that went live with C7: a wallet's claims, `/v1/openapi.json` and `/docs`; and the API image and migrations of October 5 as the packet's receipts state them;
     - the mainnet program id and its upgrade authority `2kz1Zq…`;
     - the verified hash `7e902d1b…43ac` and how to reproduce it.
   - If Parts 3–4 ran (C14–C22, Oct 8–9):
     - MYCEL's community and vault addresses;
     - the publish and claim signatures;
     - who was paid, in the [plain wording](2026-10-08-first-payout-readiness.md#when-the-founder-is-the-only-payable-member) Cisco confirmed (as of October 5 the only possible payee is the founder), never as a community payout.
   - If only Parts 1–2 ran: the program is on mainnet, and MYCEL has no community, vault or payout there. Say that, not "mainnet payouts".
   - If no eligible epoch-2 members or a safety gate blocks Parts 3–4, retain the actual blocker and say mainnet program deployed, no contributor payment. Do not substitute fixture leaves or the devnet payout as mainnet evidence.
   - Closes when: every status line cites a build-log entry or a signature.
3. **Public-safe pass (agent).**
   - `git grep` for key material, `.env` values and private paths finds nothing.
   - No private plan or vault text is in the repo.
   - The untracked `wsl` file is not committed.
   - Closes when: all three finds are empty.
4. **Colosseum reviewer access (Cisco).**
   - The app repo `FCisco95/hyphae` is private. Add `hackathon@colosseum.com` as a collaborator (GitHub: Settings, Collaborators) before submitting. A collaborator on a personal repo gets write access; there is no read-only role.
   - Closes when: the repo's collaborator list shows `hackathon@colosseum.com`, pending or accepted.
5. **Links work (agent).**
   - Each of these opens from a clean browser: the public program repo `FCisco95/hyphae-program`; the site's `/`, `/claim` and an epoch page; the api's `/health`, `/docs` and `/v1/openapi.json` (live since C7 on October 2); each explorer link in the README and the video. A wallet with no leaf correctly receives an empty claims list and 404 on its individual leaf route; unavailable settlement is not evidence of a payout.
   - The private app repo does not open without access. Check it from a signed-in account that has it.
   - Closes when: every link answers; a dead one is fixed or removed.
6. **Video (Cisco).**
   - Upload the Oct 9 recording (Loom). Check it is under 3 minutes and viewable without a login.
   - Closes when: the link plays from a private window.
7. **Colosseum project page (Cisco).**
   - Fields:
     - the repo link: the private `FCisco95/hyphae`, which reviewers can open only once step 4 is done (the public program and rubrics repo is `FCisco95/hyphae-program`);
     - the video link;
     - a description consistent with the README's first paragraph;
     - the category, which stays **Governance & DAOs**.
   - The "anything else judges should know" field keeps the no-token disclosure and the prior-work disclosure (build log 2026-09-17, afternoon).
   - State the licence as the README does: Business Source License 1.1 on both repositories (Change Date 2028-10-12, Change License GPL-2.0-or-later). Never "open source".
   - Say mainnet only if step 2 did.
   - Any member-journey claim stays inside what the receipts show (live on the API; no member use).
   - Closes when: the page is saved and reads back.
8. **Submit (Cisco).**
   - Closes when: Colosseum shows the submission.
9. **Record it (agent).**
   - Add a build-log entry: what was submitted, the SHA, the video link, and what was deliberately left out (the rows above).
   - Refresh the handoff and push.
   - Closes when: `git status -sb` shows `main` even with `origin/main`.
10. **Weekly video #4 (Cisco):** "submitted, here's what changed". From the same build-log entry.
11. **Oct 11–12 (both): buffer.** Do not touch the deployed program. Fix only a broken link or a wrong README line, each as its own commit.
