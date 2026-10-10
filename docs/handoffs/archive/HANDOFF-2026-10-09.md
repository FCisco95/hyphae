---
date: 2026-10-08
summary: Hyphae on 2026-10-08 night. Cisco moved epoch 2's close to 2026-10-10T00:00Z (he cannot attend the close on the 9th), so C14 to C18 run on Oct 9, the close on Oct 10, C19 to C22 on Oct 11. Epoch 2 stays on Claude Haiku 5.5 with reward-eval/2. Overnight, all five feature branches were reviewed by Codex, every finding was fixed test-first and fix-checked ACCEPT, and the merged branch `next` also carries the epoch-page schedule notice and the migration script re-pinned to 0018+0019. Production is unchanged (jev-e5f864b). Release after C22 on Oct 11, with Cisco's yes on the written plan.
---

# Hyphae handoff

## Metadata

Last Updated: 2026-10-09T00:20Z
Project: Hyphae (Colosseum entry; first community MYCEL). Scope: the first payout sitting (Oct 9 to 11) and the post-payout release of `next`.
Updated By: Claude Fable 5.1 (`claude-fable-5-1`, xhigh), architect session on the home machine, driving Codex (gpt-6-astra, xhigh) reviewers and Claude Opus 5.5 / Sonnet 5.5 workers through Orca. Every branch note says which model built it.
Snapshot: [docs/handoffs/2026-10-08-overnight-architect.md](handoffs/2026-10-08-overnight-architect.md). Previous: [parallel build wave](handoffs/2026-10-08-orca-wave.md). Where they differ, this file wins.

## TL;DR

- **Rulings today (Cisco):** epoch 2 closes **2026-10-10T00:00Z** instead of 2026-10-09T00:00Z (applied 17:46:49Z by a guarded one-row update; the public API reads it back). The close job only fires once the database clock passes `closes_at`, so nothing was scheduled for the 9th; epoch 3 opens at the new close and runs seven days. Epoch 2 keeps Claude Haiku 5.5 on `reward-eval/2` to the end; epoch 3 moves to `reward-eval/3` after the release and a recorded amendment. The changes are said in public: a changelog entry and a schedule panel on the epoch page (drafts need Cisco's wording).
- **Live production is unchanged:** API `6839d31b317318` and worker `817400c9901de8` on `jev-e5f864b` (`sha256:b3f5617d…`), Neon journal 18. Epoch 2 at 18:13Z: 16 contributions from 8 members, 2 with a signed wallet (a96fb8b1 and c9fa23be); six members have no signed wallet.
- **`next` is reviewed and fixed** (`1249fed`, pushed to `origin/next` after the gate below). Every one of the five branches came back CHANGES REQUESTED; every finding was fixed test-first by an Opus worker and fix-checked ACCEPT by Codex. Also merged: the schedule panel (`FCisco95/notice`) and `scripts/rollout/db.mjs` re-pinned to 0018+0019 and rehearsed on Postgres 17 and 18. Records: `docs/reviews/2026-10-08-*.md` and `2026-10-09-*.md`; worker notes `docs/handoffs/2026-10-09-*.md`.
- **Gate on `next` `1249fed`:** tests green with `--maxWorkers=2` (core 130, read-client 26, web 187, API 1172 passed / 3 skipped in 107 files), `pnpm typecheck` 0, `pnpm lint` 0 (451 files), `drizzle-kit check` fine, `test:pg` 84 of 84 in 15 files. The first `test:pg` run failed 5 tests in the two known flaky files (private journey, raid alerts); both pass alone (16 of 16) and the whole suite passed on the rerun.
- **Release:** after the hold ends and after C19 to C22 (Oct 11), per [docs/demo/2026-10-11-release-plan.md](demo/2026-10-11-release-plan.md) (DRAFT, needs Cisco's yes). Until the epoch 3 amendment is effective, no raid is opened in epoch 3.
- **Schedule:** Oct 9 C14 to C18 by about 21:30Z; **freeze from Oct 9 22:00Z to Oct 11 00:00Z** (no push to `main`, no deploy); Oct 9 23:00Z pause intake; 23:00Z to 23:55Z attestation and corrections; Oct 10 00:00Z close, intake resumes, epoch 3 opens; hold to Oct 11 00:00Z; Oct 11 C19 to C22, then the release, the video, the submission (deadline 2026-10-12 23:59 PDT = 2026-10-13 06:59Z).

## Needs Cisco, in order (one at a time)

1. **Public wording** (`docs/plans/transparency-note.md`, private): the changelog entry for the moved close, the scorer entry's "why", the X and Hyphae Lab post, three README lines ("umbrella" sentence, an injection-resistance row, the status after C22), the panel text. Nothing is posted or committed to the changelog until he approves.
2. **The scorer's four answers** (`docs/plans/scorer-v3-questions.md`): receipt wording (keep), refusals to reconciliation (yes), accept H54 (yes), 65 baseline (yes).
3. **Release timing:** after C22 on Oct 11, and no raid in epoch 3 until the amendment is effective. Recommended; his call.
4. **Member-visible strings** in the branch notes: payout-status (plus the `/me` lines added by the fix: "Current link: …", "Not payable: …", "Hold: not checked, since there were no points"), wallet-record, raid-stats, Blink (plus "That request is too large.", "Send the request as JSON.", "That request could not be read. Try again."), the schedule panel. Privacy call: rules-test status becomes public per member id.
5. **The reminder to Hyphae Lab:** "To be paid for epoch 2, run /setup and pass the rules test before Oct 10 00:00 UTC." If not posted yet.
6. **Housekeeping:** revoke the temporary Anthropic key used for the scorer eval (if not done); `! rmdir ~/Desktop/DEVELOPMENTS/hyphae-jev-reward` (an empty leftover directory still listed in Orca's sidebar).

## What `next` contains (base `2380d59`; merged, reviewed, not deployed)

| Branch | What it does | Review | Fix | Fix check |
|---|---|---|---|---|
| scorer-v3 | `reward-eval/3`: Haiku 5.5 answers Jev's v4 yes/no questions, code composes the score | CR, 1 medium: the SDK timeout ended at the headers | `dd1d831`: one abort deadline per call covering the body | ACCEPT |
| payout-status | Read API `payout` per row; "Scored." plus what pay needs; `/me` checklist; one hint line per member per epoch | CR, 5 medium | `716de93`…`b63fc1d`: read clock inside the snapshot, no hold outcome before the close; `/me` names the wallet at the close; the closed checklist states `no_points`; hints serialized per member and epoch with an advisory lock; a 3 s bounded username lookup with a score-only fallback | ACCEPT |
| raid-stats | `/raids` stats; one public recap when a raid ends; migration 0019 | CR, 2 medium + 1 low | `c525c2d`, `d5cbc84`: send under the raid's lock with a terminal `skipped`; the claim rechecks the deadline; one 429 retry then `rate_limit_retry_exhausted` (`retry_used` column; 0019 regenerated, SHA `b81d6085…864b`) | ACCEPT |
| wallet-record | `GET /v1/wallets/:wallet/record`, `/wallet/[wallet]`, migration 0018 | CR, 1 medium: a timing signal for signed-but-quiet wallets | `4cca6ca`: one joined query before the empty path | ACCEPT |
| blink | Solana Action for a claim, `actions.json`, share link | CR (afternoon), 1 medium + 2 low | `138c4d0`, `a1981aa`: byte-bounded body reader (413/415/400), explorer link on 409, chain header on errors | ACCEPT, recheck ACCEPT |
| notice | "Schedule change" panel on the epoch page, computed from the window and the configured duration | (web only, architect-reviewed) | `bcba345`, `f436df3`, `20f3e01` | |
| rollout | `db.mjs` pinned to 0018 `79592f95…2302` + 0019 `b81d6085…864b`, post-payout epoch state, catalog shape checks | CR, 1 medium + 1 low | `cace96d`: detail endpoints compared; expression-index keys refused | ACCEPT (PG 18.6, 63 invocations) |

Known limits recorded in the notes: the score message's advisory lock is held for the send (grammY's 500 s bound); a hint is dropped when the username lookup fails; the recap send holds the raid's task lock for the bounded 4 s send; the wallet route still does a few extra index probes inside its one statement for a linked wallet.

## Next agent steps

1. **Oct 9, before the sitting (home machine):** `git status -sb`; `fly image show --app hyphae-api` (both on `jev-e5f864b`); `GET /v1/communities/<mint>/epochs/2` (`closes_at 2026-10-10T00:00:00Z`, one amendment); the [readiness packet](demo/2026-10-08-first-payout-readiness.md) (dates shifted; `oct8-audit` recount). Then C14 to C18 with Cisco and the Ledger.
2. **Oct 9 23:00Z to 23:55Z:** pause, attestation, corrections, final audit, strictly per the packet. Freeze starts 22:00Z.
3. **Oct 10 00:00Z:** the close; verify epoch 2 closed with one snapshot and epoch 3 open to 2026-10-17T00:00Z.
4. **Oct 11 after 00:00Z:** C19 to C22 on the deployed source; then, with Cisco's yes, the [release plan](demo/2026-10-11-release-plan.md): merge `next` into `main`, image, 0018+0019 through `db.mjs`, API, worker, push `main`, smoke, Cisco announces T, amendment for epoch 3.
5. Video, README status (D3 of the transparency note), submission.

## Current State

| Area | State |
|---|---|
| API and worker | `jev-e5f864b` (`sha256:b3f5617d804a377e8eaae1c6c67641ffe85390e47d88c162f0723206994236c4`), unchanged since 2026-10-07 21:36Z. Rollback target before any epoch pins Jev: `haiku55-328fb45`. |
| Database | Neon journal 18 (`0017_reward_amendment_chain`). Never roll back. |
| Epoch 2 | Open until 2026-10-10T00:00Z, `reward-eval/2` on `anthropic:claude-haiku-5-5`; 16 contributions, 8 members (18:13Z). |
| Epoch 3 | Materializes at the close: 2026-10-10T00:00Z to 2026-10-17T00:00Z; must activate the pending `reward-eval/2` proposal `2ce6085a…`; moves to `reward-eval/3` by amendment after the release. |
| Chain | Ledger admin 0 lamports; community, vault and epoch 2 accounts absent (C14 not started). |
| `main` | `a857678` + the records of this session (pushed before the freeze). Docs only on top of the deployed source. |
| `next` | `1249fed` = `origin/next` (pushed 2026-10-08 20:10Z after the gate). |
| Worktrees | the main checkout and `C:/hy/next` (branch `next`). No stale branches. |

## Known Issues / Watch List

- `pnpm test` from a fresh worktree needs `@hyphae/read-client` built first (its own test script builds it; a bare `vitest run` in `apps/api` fails one file otherwise).
- Orca on Windows: a Codex worker's injected prompt often sits unsubmitted in the draft; read the screen and send a bare Enter (`docs/plans` are private; the lesson is in the agent's memory).
- Machine load: run at most two or three suites at once with `--maxWorkers=2`; the known flaky pg tests (raid-alert and private-journey) rerun alone.
- Earlier items still open: trust gaps on the security page; Neon password rotation after Oct 11.

## Preserved payout safeguards

Epoch 2 closes Oct 10 00:00Z. Oct 9 pause 23:00Z, final C18b after 23:45Z, corrections and attestation strictly before Oct 10 00:00Z, then post-close safety, Ledger, claim and P14, and the hold through Oct 11 00:00Z inclusive. **No deployment or push to `main` from Oct 9 22:00Z until Oct 11 00:00Z.** Empty or no-payable epoch means no payment. Canonical runbook: [first-payout readiness](demo/2026-10-08-first-payout-readiness.md). Admin and upgrade key: Ledger `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`; fee vault Squads `rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK`. Held refs untouched: `158452fe`, `707d7daf`, `2fd2470a`, tag `c58aa27`.

## Quick Reference

- Mint `HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg`; API `https://hyphae-api.fly.dev`; site `https://hyphae-delta.vercel.app`; Hyphae Lab chat `-1003934645546`.
- Correction: `node --env-file=$hyphaeEnv --import tsx scripts/reward-correct.ts <contribution-id> --expected-revision <n> --reason "…" --evidence "<ref>" --raw-quality <0-100>` (from `apps/api`).
- Amendment: `node --env-file=<repo>/.env --import tsx scripts/amend-epoch.ts <mint> --epoch <n> --prompt <v> --effective-at <iso Z> --actor "…" --reason "…" [--plan]` (from `apps/api`).
- Migration release: `node --env-file=<repo>/.env <repo>/scripts/rollout/db.mjs precheck|migrate|postcheck` (from the exact-source worktree's `packages/db`).
- Codex review: an Orca Codex terminal (`codex -m gpt-6-astra -c model_reasoning_effort=xhigh`), or `codex exec … -s read-only --ephemeral`.

## Resume Checklist

`git pull` (brings `origin/next`); `git status -sb`; `fly image show --app hyphae-api`; `GET /v1/communities/<mint>/epochs/2`; the clock against the Oct 9 22:00Z freeze and the Oct 11 00:00Z hold end. Every new live effect needs its own yes.

## Suggested skills

- `handoff-memory` to resume from this file; `the-analyst` for the morning decisions (wording, scorer answers, release timing); `superpowers:verification-before-completion` before any live read-back is called done.
- For the sitting: the operator scripts in `apps/api/scripts` and the readiness packet, no new code; `solana-dev` only for an on-chain lookup.
- For the release on Oct 11: `orca-cli` and `orchestration` if work is delegated; a Codex review (the other model family) of anything that changes on the money path after `next` `1249fed`.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Branch `next` 1249fed and docs on `main` a067f5b | GitHub `FCisco95/hyphae` | CI success on both (runs 37837065474, 37836952246) |
| Review records and worker notes | `docs/reviews/2026-10-08-*.md`, `docs/reviews/2026-10-09-*.md`, `docs/handoffs/2026-10-09-*.md` | on `next` |
| Private drafts for Cisco | `docs/plans/transparency-note.md`, `docs/plans/scorer-v3-questions.md`, `docs/plans/judge-assessment.md`, `docs/plans/architect-state.md`, `docs/plans/architect-session-template.md` | gitignored; not approved wording |
| Worker briefs and one report | `C:/hy/briefs/*.md`, `C:/hy/reports/dates.md` on the home machine | outside the repo; disposable |
| Local worktree `C:/hy/next` | home machine | branch `next`, in sync with origin |
| Docker image `postgres:18` | home machine | pulled for the migration rehearsal; keep |
| Orca run `run_ab8efb0ad4cb` | Orca on the home machine | all dispatches settled and released |
| Keys, secrets, deployed resources | none | nothing live changed except the ruled close move (17:46:49Z) |

## Next-session prompt

```
Hyphae on 2026-10-09, home machine, on main (a067f5b = origin/main). Epoch 2 closes 2026-10-10T00:00Z; production is jev-e5f864b; `next` 1249fed is reviewed, fixed, gate-green and pushed, waiting for the release after C22 on Oct 11.

Files: CLAUDE.md, docs/HANDOFF.md, docs/plans/transparency-note.md, docs/plans/scorer-v3-questions.md, docs/demo/2026-10-08-first-payout-readiness.md, docs/demo/2026-10-11-release-plan.md
Model: Claude Opus 5.5 (xhigh) — the payout path and a founder-attended sitting; Fable 5.1 only if delegating a new wave
Skills: handoff-memory, the-analyst, superpowers:verification-before-completion

Run the morning batch with Cisco one item at a time (public wording, the scorer's four answers, release timing, the member-visible strings), commit the approved changelog and README lines, then prepare the Oct 9 sitting from the readiness packet: verify the live state, then C14 to C18 with the Ledger, the 23:00Z pause, attestation and corrections before 2026-10-10T00:00Z. Freeze from 22:00Z.
```
