# Submission checklist (Sat 2026-10-10)

Plan Week 4 #7. The deadline is 2026-10-12 23:59 PDT; Oct 11–12 are buffer. One step at a time. Each step names who does it and the check that closes it.

## Scope, as it stands

**October 2 readiness checkpoint:** C1–C13 completed, with Fly v11 on frozen `b3c82c7`, Neon 0000–0012 and the reviewed mainnet program under the Ledger. Fresh 17:02–17:04Z reads still show no initialized MYCEL mainnet community/vault, publication or contributor payment; epoch-2 submissions/intakes are 0/0. Read the [October 8–9 operator packet](2026-10-08-first-payout-readiness.md) and [readiness receipt](../handoffs/2026-10-02-payout-readiness.md) before advancing the status. C14–C22 remain dated/attended, with publication after the October 9 close and all safety gates.

| Plan item | State | Evidence |
|---|---|---|
| Week 4 #1 API finishing | Built | `d712289`, `135a80f`, `1d56e5d` |
| Week 4 #2 vault integration note | Built | README "Funding a community's vault" (`1d56e5d`) |
| **Week 4 #3 web `/admin` page** | **Dropped by Cisco, 2026-09-27 19:43Z, for the hackathon.** The bot's `/raid` and `apps/api/scripts/set-rubric.ts` cover raids and rubric changes; funding is a Ledger transfer to the vault (Runbook C, C18). | Vault plan, 27 Sep evening amendment |
| Week 4 #4 empty, error and phone states | Built | `236905e`, screenshots `ffdfac0` |
| Week 4 #5 security review and CI | Program review 2026-09-27; whole-repo review 2026-09-28; CI on every push | `docs/handoffs/2026-09-27-afternoon-arc.md`, `docs/handoffs/2026-09-28-arc.md` |
| Week 4 #6 final video | Script: `docs/demo/2026-10-09-final-video.md` | Recorded by Cisco on Oct 9 |
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
     - the api routes that went live with C7: a wallet's claims, `/v1/openapi.json` and `/docs`;
     - the mainnet program id and its upgrade authority `2kz1Zq…`;
     - the verified hash `7e902d1b…43ac` and how to reproduce it.
   - If Parts 3–4 ran (C14–C22, Oct 8–9):
     - MYCEL's community and vault addresses;
     - the publish and claim signatures.
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
   - Closes when: the page is saved and reads back.
8. **Submit (Cisco).**
   - Closes when: Colosseum shows the submission.
9. **Record it (agent).**
   - Add a build-log entry: what was submitted, the SHA, the video link, and what was deliberately left out (the rows above).
   - Refresh the handoff and push.
   - Closes when: `git status -sb` shows `main` even with `origin/main`.
10. **Weekly video #4 (Cisco):** "submitted, here's what changed". From the same build-log entry.
11. **Oct 11–12 (both): buffer.** Do not touch the deployed program. Fix only a broken link or a wrong README line, each as its own commit.
