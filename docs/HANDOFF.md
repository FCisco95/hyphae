---
date: 2026-10-10
summary: Hyphae during the first-payout freeze. Last recorded live state is 2026-10-09T00:20Z (production jev-e5f864b, epoch 2 closing 2026-10-10T00:00Z, `next` 1249fed reviewed and waiting for the post-payout release). 2026-10-10 adopted the one-branch workflow (AGENTS.md, session-check, pre-push gate), committed locally and not pushed because a push to main deploys the web during the freeze.
---

# Hyphae handoff

Last updated 2026-10-10 ~10:30Z on the MacBook (Claude Opus 5.5, Orca worker, process-only task). Full previous handoff: [archive/HANDOFF-2026-10-09.md](handoffs/archive/HANDOFF-2026-10-09.md). Rules: [AGENTS.md](../AGENTS.md).

## Read this first

- **The freeze is on until 2026-10-11T00:00Z:** no push to `main` (it deploys the web), no deploy, no change to payout, hold or scoring code or data.
- **Nothing after 2026-10-09T00:20Z is recorded on `origin/main`.** The Oct 9 sitting (C14 to C18, pause, attestation) and the 2026-10-10T00:00Z close may have happened on the Windows PC. Check that machine's `git status -sb` and the live state before trusting the rest of this file.
- **Local commits waiting to be pushed (MacBook):** the workflow change below, on top of `origin/main` `d3b8c6c`. Push only after 2026-10-11T00:00Z and with Cisco's OK, once the Windows PC's own records are pushed (rebase if needed).

## Current state (last recorded)

| Area | State |
|---|---|
| API and worker | `jev-e5f864b` (`sha256:b3f5617d…`), machines `6839d31b317318` and `817400c9901de8`. Rollback target before any epoch pins Jev: `haiku55-328fb45`. |
| Database | Neon journal 18 (`0017_reward_amendment_chain`). Never roll back. |
| Epoch 2 | `reward-eval/2` on Claude Haiku 5.5; closes 2026-10-10T00:00Z (ruled and applied 2026-10-08 17:46:49Z). 16 contributions, 8 members, 2 signed wallets at 2026-10-08 18:13Z. |
| Epoch 3 | Opens at the close, to 2026-10-17T00:00Z; moves to `reward-eval/3` by amendment after the release. No raid in epoch 3 until that amendment is effective. |
| Chain | Ledger admin `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`; fee vault Squads `rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK`. |
| `next` | `1249fed`, reviewed (five branches, every finding fixed, Codex ACCEPT), gate green, not deployed. Contents and review table: archive. |

## Schedule

- Oct 10 00:00Z: epoch 2 close; epoch 3 opens. Hold through Oct 11 00:00Z.
- Oct 11 after 00:00Z: C19 to C22 on the deployed source ([readiness packet](demo/2026-10-08-first-payout-readiness.md)).
- Then, with Cisco's yes ("yes, run the post-payout release"): [release plan](demo/2026-10-11-release-plan.md) (DRAFT): merge `next`, image, 0018+0019 via `db.mjs`, API, worker, push `main`, smoke, Cisco announces T, epoch 3 amendment.
- Video, README status, submission by 2026-10-13 06:59Z.

## Needs Cisco, in order

1. Public wording (`docs/plans/transparency-note.md`, private): changelog entry for the moved close, the scorer's "why", X and Hyphae Lab post, README lines, panel text.
2. The scorer's four answers (`docs/plans/scorer-v3-questions.md`).
3. Release timing: after C22 on Oct 11 (recommended).
4. Member-visible strings in the branch notes on `next`; the privacy call (rules-test status public per member id).
5. Branch disposition, a proposal for Cisco to decide after the freeze (nothing deleted or scheduled; exact commands in the 2026-10-10 Orca W4 report): the merged `feat/jev-eval` and local `hackathon/r1-exact-reward-points` could go; `next` and the five `FCisco95/*` branches (all inside `next`) after the release; `feat/rules-v2` (7 unmerged commits: rubric 1.3.1, `/rules` study page, rules-test changes) needs his call.
8. Outside this repo: the global Claude hook `~/.claude/hooks/docs-only-push-guard.sh` blocks any command naming a push to `main` and asks for a PR, which contradicts AGENTS.md rule 1; align it with the one-branch rule.
6. Housekeeping: revoke the temporary Anthropic key from the scorer eval if not done; rotate the Neon password after Oct 11; `rmdir ~/Desktop/DEVELOPMENTS/hyphae-jev-reward` on the home machine.
7. Outside this repo: the cisco-brain `organic-sync` skill still manages a v2 "working agreement" block (worktree-branch rule) that this repo no longer carries; update or retire it so it does not re-add the block.

## Next agent steps

1. `node scripts/session-check.mjs start` on each machine. It will fail on the remote branches until item 5 is done; that is expected, not a reason to delete anything.
2. After 2026-10-11T00:00Z and with Cisco's OK: rebase local `main` on `origin/main` once the Windows PC's records are pushed, then push `main` (the pre-push hook runs the gate; the push deploys the web).
3. C19 to C22 with Cisco, strictly per the readiness packet. Then the release plan on his yes.

## Known issues

- `pnpm test` in a fresh checkout needs `@hyphae/read-client` built first (its own test script does it).
- Machine load: at most two or three suites at once with `--maxWorkers=2`; the raid-alert and private-journey pg tests are flaky and pass alone.
- Open: trust gaps on the security page.

## Quick reference

- Mint `HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg`; API `https://hyphae-api.fly.dev`; site `https://hyphae-delta.vercel.app`; Hyphae Lab chat `-1003934645546`.
- Correction, amendment and migration commands: archive, "Quick Reference".
- Codex review: an Orca Codex terminal, or `codex exec … -s read-only --ephemeral`.
