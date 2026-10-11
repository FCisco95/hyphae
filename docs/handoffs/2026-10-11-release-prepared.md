# October 11: mainnet truth, demo, privacy and claim recovery prepared

Status: **prepared locally; app production release held**. Cisco approved public aggregates and a private member checklist, including the necessary API/bot contract edits. He has not supplied the original exact sentence `yes, run the post-payout release (E0–E6)`. The later replies “Whatever is your recommendation…” and “Yes, I have to write it” did not clear that explicit stop. A final async release choice was presented after both ACCEPT reviews and the one-screen copy sheet.

## Source and preserved history

| Repository/ref | Checkpoint | Remote state |
|---|---|---|
| hyphae main | `14e01bfcf1ae25a639e50e82c875bd7bc72201d5` before this handoff | Local only; 49 ahead of origin/main `d3b8c6c`. Started at `4e6b99e7acdb7bf69891934b760a29bf2ec32669`, 42 ahead. |
| hyphae next | `9d0da9b337d1b11770278603b595ebcbd60f12d7` | Local only; original reviewed `1249feddc5a7d7052fda6de8ac2ed65a0d4274b0` plus privacy implementation/fix/review. Existing integration worktree retained. |
| hyphae-program main | `e574a99127a86273e5da97afdb61b5d0bcf84528` | Pushed, clean. Prior truth commit `55396b649b359aa673ff839dce1ba5d0b13de5d7`. |

No merge, reset, branch/worktree/stash deletion or app push. Old branch disposition is report-only in [the organization report](../demo/2026-10-11-repo-organization.md). The October 10 canonical handoff was archived intact at [archive/HANDOFF-2026-10-10.md](archive/HANDOFF-2026-10-10.md).

## Evidence and ready work

- Truth checkpoint `35c0692d504a421f2fe9693d044e649c77dcb3ed`: both README Status sections cite October 10 mainnet receipts; program docs pushed, app docs local. Fresh mainnet executable hash `7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac` matches the recorded October 2 build. No new build or signing claimed. [Canonical receipt index](../demo/2026-10-10-mainnet-payout.md).
- Demo/checklist `c5146cc37a0b944c6ebb81d0ed5d5d6024bfcac8`: beats 4–6 use C16/C18/C20/C21 and three non-founder mainnet claims. C22 is a readback. Soulbound points remain not built; refused repeat claim remains explicitly devnet. C14–C22 done, late C18b audit disclosed; private-repo collaborator step removed.
- Links/decision packet `472f5ecb6fc7f5b129d674ecb75b66ad721c2322`: 33 fresh signed-out judge links opened with actual content/chain identifiers, plus five direct decoded Solscan Data tabs. [Results](../demo/2026-10-11-judge-links.md), [final one-screen strings/privacy sheet](../demo/2026-10-11-release-approval.md).
- Claim code `9777a66`, `9b9d0ba62cdf022c3b7f89f6abfe486048dd55bf`, `cc4f773eaf1d5ae15f0ef98613e6dec4993b46f9`: one picker, full wallet, 60-second wallet deadline, 10-second read deadline, cancellation/recheck, account/epoch/unmount guards, double-click fencing, cancelled polling and late-signature receipt recovery. Confirmed payment cannot regress on a late result or failed read. Transaction builder/proof/account derivation unchanged. Final [fresh other-family ACCEPT](../reviews/2026-10-11-claim-page.md).
- Privacy next `b1ec662`, `f573a68147d94e9da43b508c1c25031954eba4d0`, review record `9d0da9b`: public rows/OpenAPI/group scores omit member eligibility; group /me neutral link opens sender-bound, membership-checked private checklist. Actual public payout receipts/wallet record remain available; scoring/gate logic unchanged. First review required stale OpenAPI/PG test fixes; final [fresh ACCEPT](../reviews/2026-10-11-privacy.md).
- Home/trust checkpoint `14e01bf`: mainnet seven-receipt proof, 4/4 paid, 1.238881509 SOL claimed, zero unclaimed; treasury creation truth. [14 local screenshots](../demo/screenshots/2026-10-11/README.md) cover dark 1920×1080 and 390 phone, including epoch settlement/paid rows and wallet record. No horizontal overflow. Paid claim used a named simulated read-only wallet with signing disabled; wallet record used a read-only repeatable-read production snapshot behind a loopback-only GET adapter. No production data write.

## Checks and models

Privacy: core schema 26, targeted API 83, web 35, OpenAPI 5, isolated Docker Postgres 17 concurrency 1: **150 passed**. Claim: 12 mounted UI, 8 transaction, 7 view: **27 passed**. Home/trust: **27 passed**. Relevant core/API/web typechecks and changed-file Biome passed. Confirmed-payment regression was reproduced with a failing mounted test before its fix. No redundant full gate: E0 combined-source gate awaits authorized merge, and the pre-push hook runs its own required gate.

Builder actual runtime: Codex/GPT-6, effort not exposed. Fresh independent reviews: Anthropic Claude Opus 5.5 (`claude-opus-5-5`), high, restricted read-only CLI sessions. Reviewers inspected source/tests; they did not run the reported verification commands.

End session-check: NOT OK from the held unpushed main, retained refs/integration worktree and pre-existing untracked `.codex/`. Those were not resolved by deleting work. No app session commit has reached the other machine. Program docs alone were pushed.

## Production and next action

Read-only `fly image show` October 11 confirms both API `6839d31b317318` and worker `817400c9901de8` remain on `jev-e5f864b`, digest `sha256:b3f5617d804a377e8eaae1c6c67641ffe85390e47d88c162f0723206994236c4`. Last recorded journal is 18 (through 0017). Release tools Fly/Docker/gh available. No registry push, db.mjs precheck/migrate/postcheck, machine update, main push or new deployment. The release plan Record stays unexecuted.

With the exact yes, run [E0–E6](../demo/2026-10-11-release-plan.md) in order: merge both histories, combined gate, clean exact-source image `next-<sha7>` after registry 404, pinned db.mjs 0018 then 0019 with preconditions/liveness, API then worker, main push, smoke. Any script refusal or failed smoke invokes the plan's stop/rollback. Then fill actual Record and short handoff, push. E7–E8/scorer amendment/announcement are excluded. Epoch 3 public reads already show activity; do not claim no replies existed. No raid opened or changed here.

Deploy cutoff October 12 12:00Z, then single-commit link/README fixes only. Submission deadline October 13 06:59Z. Cisco still records/submits pitch/demo, weekly summary and presentation. The prepared script/checklist carry real receipts, but no video or submission was made by this session.

Organic follow-through after ship: use canonical judge links and full program hash in docs/HANDOFF.md and the executed release Record. Mainnet settlement status exists today; the new wallet record and private eligibility contract are still held. Public consumers should read allocation/payment receipts rather than removed per-member eligibility. No Organic/vault edits or posts.

## Generated artifacts this session

| Artifact | Canonical home | State |
|---|---|---|
| Mainnet receipt/demo/checklist/link/approval records | docs/demo/ and public hyphae-program README/docs | Tracked; app local, program pushed. |
| Claim/privacy ACCEPT records | docs/reviews/ | Tracked; privacy identical on both local histories. |
| 14 browser PNGs | docs/demo/screenshots/2026-10-11/ | Tracked local previews, not live release smoke. |
| Canonical handoff, old archive, this snapshot | docs/HANDOFF.md and docs/handoffs/ | Tracked and portable. |

No keys, credentials, scheduled jobs or deployed resources created. Local preview servers stopped; disposable Postgres test container removed. Docker Desktop remains running. Ephemeral helper/review logs are not authoritative; their evidence is in these tracked records.

## Suggested skills

handoff-memory, the-analyst, handoff; hyperframes/faceless-explainer for Cisco's recording session. /organic-sync follows actual ship in its separately authorized scope.

## Next-session prompt

```text
Resume Hyphae from docs/HANDOFF.md. Steps 1–3 and local claim/privacy fixes are committed; both fresh reviews ACCEPT, but exact E0–E6 approval and all app deployments are still held. Preserve main/next histories and delete nothing.
Files: docs/HANDOFF.md, docs/demo/2026-10-11-release-approval.md, docs/demo/2026-10-11-release-plan.md, docs/demo/2026-10-09-final-video.md, docs/demo/2026-10-10-submission-checklist.md
Model: Claude Opus 5.5 (high) — careful production state checks; record actual runtime.
Skills: handoff-memory, the-analyst, handoff.
Check the pending release decision. Only with exactly 'yes, run the post-payout release (E0–E6)', execute E0–E6, fill Record, smoke and refresh/push the Organic-sync handoff; exclude E7–E8. No deploy after October 12 12:00Z except single-commit link/README fixes. Without that yes, keep app changes local and report the hold.
```
