---
date: 2026-10-02
summary: MacBook-ready session close; only main worktree registered, parked branches pushed, unique proof archived. MYCEL naming correction recorded; live rename/UI pending. No contributor payment.
---

# Hyphae handoff

## TL;DR

**Resume on the MacBook by pulling Hyphae main and reading this file.** The readiness packet and community guide are shipped. Cisco confirmed the participant-facing community name must be **MYCEL**, with **Powered by Hyphae** as attribution; “Pilot” is a status badge. The live database/group still use Hyphae Lab: no production rename or new onboarding UI has been performed. Next work is the bounded community onboarding/presentation design, before inviting the cohort.

**Only the main checkout is registered.** The detached candidate was removed after its unique untracked proof was committed byte-for-byte. Its former folder is empty but Windows holds it open; it is not a Git checkout/worktree and contains no work. Other sibling folders were untouched. The empty untracked `wsl` artifact was inspected (0 bytes) and removed at Cisco's cleanup request. Both unmerged feature branches are clean and already pushed; keep them parked for epoch 3.

C1–C13 and the October 8–9 readiness preparation are finished. C14–C22 remain dated/attended and unexecuted. **No mainnet community/vault or contributor payment is evidenced.** Never repeat completed deployment/funding or fund retired temporary keys. SDK remains exactly 0.1.0 through October 12.

## Metadata

- Project: hyphae; project ID: github.com-fcisco95-hyphae; branch main; repo root `.`.
- Last updated: October 2, 2026, MacBook close after 18:42Z.
- Runner: Codex/GPT-6 family; exact runtime model ID, effort and token/cost telemetry unavailable. No helpers or paid scoring/model calls.
- Community guide: `b1431489aec99d20e99630f0eb9e992ecc984f33`, shipped with receipt `a69dc93ccad675ca38b476c2e80667848a1e1821`; exact-SHA [CI 37045390806](https://github.com/FCisco95/hyphae/actions/runs/37045390806) independently completed/success at this close.
- Readiness: `b05059cc8fe0b220cdcd31e878eb855109d88900` / CI 37039599645 success, then `0b1cd61992f39bec6b69788b22d97ce45a59e768` / CI 37040306523 success.
- Proof preservation: `e81ba54a9943124a1adf081184b944170a1e387d`; final close receipt follows. Both close commits ship together after the required local gate; final exact-SHA CI is checked and reported at session close. Resolve the receipt SHA with `git log -1 -- docs/HANDOFF.md`.

## Current Objective

Finish the machine-portable close, then resume MYCEL's participant onboarding preparation on Mac. The repo owns engineering state; `/organic-sync post-ship` should consume this handoff and the dated [MacBook snapshot](handoffs/2026-10-02-macbook-handoff.md). No vault/Organic/Sentinel/public-program writes were needed for this handoff. The private plan remains in cisco-brain; no private strategy or credential was copied here.

## MacBook resume

From the existing Hyphae repository (`~/Desktop/projects/hyphae` by the Mac convention; verify the actual clone):

```bash
git status -sb
git fetch --no-prune origin
git switch main
git pull --ff-only
cat docs/HANDOFF.md
```

If that checkout is dirty or diverged, preserve its work and reconcile before switching/pulling; do not reset or force-push. No Windows worktree path is needed. Source, guide, screenshots, proof archive and handoffs arrive through Git. `.env`, wallet keys, Ledger device access and tool installations do not arrive through Git and must be verified separately when the future authorized sitting needs them. Do not put those secrets in a commit.

The engineering checkpoint is stored in this repo, so no separate Cisco Brain commit is required to read/resume it. On a subsequent cross-repo sync, use `/organic-sync post-ship` in cisco-brain with this pulled checkpoint; this close is not a claim that the Integration Board or private plan was updated.

## Branch Disposition

| Ref | Full SHA | Disposition |
| --- | --- | --- |
| main | Final close SHA: resolve from Git | Documentation close pushed after local gate; exact-SHA CI checked at close |
| feat/rules-v2 | `158452fe2b22a1e42e5efd42f3f7e11bfdf59c70` | Local = origin, distance 0/0; clean, unmerged, parked until epoch 3 |
| feat/jev-eval | `707d7daf21e217d9a8a64e58514065f5e3bca45e` | Local = origin, distance 0/0; clean, unmerged, parked until epoch 3 |
| Former detached candidate | `b3c82c790e129b1f4a24ada6b34407e5f6d57ec9` | Verified ancestor of pushed main; extra registration/checkout removed, unique proof archived |

Fetch was performed without pruning. No feature branch was merged or deleted merely for tidiness. These two remote branches are visible after a Mac fetch without requiring their own worktrees. Previously integrated timing/docs branches remain deleted as recorded in earlier receipts.

## Current State

- **Fresh browser presentation, October 2 17:55–17:58Z:** epoch 2 open, rubric 1.2.0, contributions/count 0/0, leaderboard 0 contributing members, no payout. Epoch visually inspected at desktop 1689/mobile 390 with no horizontal overflow; mobile home/community/leaderboard also no overflow. Community read timestamp refreshed from 17:02Z to 17:57Z on revisit, cause untraced. No new claim/wallet/dark-mode proof or uptime measurement. [Guide and real screenshots](community/OPERATING-GUIDE.md).
- **Prior read-only operational receipt, October 2 17:02–17:08Z:** Fly v11 frozen candidate, all 13 Neon migrations 0000–0012 matched, recovery completed 2,301/latest 17:00:04Z, pending/stranded/failed 0; epoch-2 submissions/intakes/decisions/backlog/intents/leaves all 0. Author/duplicate inventory 0/0 is provisional, not C18b. Community/vault absent, binding null, admin 0 SOL. [Readiness receipt](handoffs/2026-10-02-payout-readiness.md). These reads were not repeated at this cleanup close.
- **Accepted C13:** deployed mainnet program `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`, sole Ledger authority `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`, reviewed hash and 229,432-byte size. Returned 0.051537968 SOL to the owner-confirmed wallet, finalized/zero before deleting the temporary hot key; both temporary files absent. Total costs 1.168463032 SOL under 1.2 cap. [C13 receipt](handoffs/2026-10-02-c13-mainnet-receipt.md), [wallet inventory](WALLETS.md). No repeat action authorized by a resume.
- Existing site: https://hyphae-delta.vercel.app; API: https://hyphae-api.fly.dev. A deployed program, a healthy read endpoint and points do not prove community initialization, payment or continuous availability.

## Recent Changes

The close archives the unique candidate proof, removes the extra registered worktree and empty `wsl` artifact, records MYCEL's exact naming decision and replaces the canonical handoff with this MacBook resume packet. The guide and screenshots were shipped previously. No runtime, production state or private vault changed.

## Known Issues / Watch List

- Community naming decision is now exact: **MYCEL**. Update the stored display name and group branding consistently through an explicitly authorized metadata operation; do not hardcode MYCEL over every community or create a replacement community. No live rename was done in this session.
- Clear member actions/two-way verified links, wallet/rules instructions and score/eligibility explanations remain proposed UI work. New-community setup is operator-assisted; unique mint/chat registration allows one registered chat per mint. Self-service, same-mint multi-chat support and multi-community scale are unproven.
- Submission currently chooses the latest active task. Keep one active brief per community; daily useful content does not require daily tasks. Recommended cadence one original post/day, 5–7/week, voluntary useful contributions.
- Former candidate directory is empty and unregistered; Windows denied deleting the final directory because another process holds it. No process was stopped. This residue does not travel through Git or block Mac resume.
- Author attestation, real uptake, future Ledger attendance, owner dashboard evidence and actual confirmed claim/payment remain future evidence. Existing funding/policy rulings need no repeat decision.

## Validation

The community-guide push passed a fresh full gate: **727 tests passed, 1 skipped** (106 core, 80 web, 541 API); typecheck/lint exit 0, 266 lint files, strict handoff validation and link/path checks passed. Its exact-SHA CI 37045390806 is independently success. **The MacBook close's required fresh local rerun also passed: 727 tests, 1 skipped, typecheck/lint exit 0, 266 lint files.** Strict handoff validation passed after restoring required sections, with only the documented Mac-convention/GitHub path warnings. No runtime/DB/reward code changed and accepted sensitive reviews remain unchanged.

Cleanup verification: candidate ancestor check exit 0; proof original/archive SHA256 equal `e81e755de7e02b3815a22ae260c422110102ddbcc422c5d4e911a6d4aab7fe61`; candidate Git status clean before removal; only main registered afterward. Rules/Jev refs match origin exactly, each 0 ahead/0 behind. Empty `wsl` was removed only after the 0-byte check.

## Next Actions

1. Pull on Mac and use the next-session prompt below. Use the current guide to agree a bounded MYCEL onboarding/presentation design, recording the exact naming correction and the production-metadata boundary. Preserve multi-community rendering and the frozen deployment boundary.
2. Cisco supplies genuine group invite, support contact and official publishing account. Recommendation: reuse the registered pilot, one coordinator and 5–10 willing contributors; pin verified dashboard/rules links. Agent has not sent content/messages.
3. Keep [October 8–9 operator packet](demo/2026-10-08-first-payout-readiness.md) canonical: Oct 8 attended C14–C18, approved admin 0.02 SOL, exact gross 0.5 SOL vault capacity/top-up formula, immutable recipient and Ledger plan checks. No early money sitting.
4. Pause intake Oct 8 **23:00Z**; final C18b after **23:45Z**, with duplicates/unconfirmed authors corrected and attested **before Oct 9 00:00Z**. C19–C22 after **00:00Z**, close/snapshot and hold/safety gates; publication and genuine claim/P14 evidence precede payment claims. Use honest empty/no-payable fallbacks.
5. `/organic-sync post-ship` can update the private board/plan on Mac from this checkpoint. SDK exactly 0.1.0 through Oct 12; rules/Jev remain parked until epoch 3. Never infer owner publication, attendance or dashboard settings from this handoff.

## Suggested skills

`handoff-memory` to resume; `superpowers:brainstorming` for participant-flow design; `frontend-design` for subsequently authorized UI implementation; `content-strategy-sms` and `social-media-trends-research` for content planning; `handoff` for closure. `/organic-sync post-ship` in the vault for cross-repo reconciliation. No helpers.

## Quick Reference

`CLAUDE.md`, `AGENTS.md`, `docs/BUILDLOG.md`, [community guide](community/OPERATING-GUIDE.md), [MacBook snapshot](handoffs/2026-10-02-macbook-handoff.md), [October 8–9 packet](demo/2026-10-08-first-payout-readiness.md), [Runbook C](handoffs/2026-09-28-runbook-c.md), [wallet inventory](WALLETS.md). Private plan remains in `cisco-brain/10 - PROJECTS/Organic/plans/2026-09-16-hyphae-implementation-plan.md`.

## Generated artifacts this session

| What | Canonical home | Notes |
| --- | --- | --- |
| Community guide and live empty-state screenshots | `docs/community/OPERATING-GUIDE.md`, two PNGs beside it | Shipped, no new UI or social publication |
| Original candidate proof archive | `docs/handoffs/assets/2026-10-02-epoch-proof.ts.txt` | Byte-for-byte historical scratch script, not an operator entrypoint; includes old Windows env path, so do not execute unchanged on Mac |
| MacBook checkpoint | `docs/HANDOFF.md`, `docs/BUILDLOG.md`, `docs/handoffs/2026-10-02-macbook-handoff.md` | Git tracked and machine-portable; post-ship evidence for organic-sync |

No new secret, key, deployed resource, scheduled job or published content. No vault or other-product writes.

## Resume Checklist

Verify pulled HEAD/exact-SHA CI, clean status and branch inventory. Read the named files before design or the future attended sitting. Refresh operational reads when needed; preserve dates, signatures and prior/fresh labels. The archived script is evidence only; no Windows checkout is required.

## Resume Prompt

```text
Resume Hyphae on my MacBook from pulled main and docs/HANDOFF.md. Read the MacBook snapshot and community guide. C1–C13 and readiness are finished; no mainnet community/vault or contributor payment is evidenced. Cisco's naming decision is MYCEL, attributed Powered by Hyphae, with Pilot as status; the live name still says Hyphae Lab and no rename/UI work has shipped. Only main was registered at Windows close; candidate is in pushed history and its unique proof is archived. Rules/Jev are clean/pushed/unmerged for epoch 3.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-02-macbook-handoff.md, docs/community/OPERATING-GUIDE.md, docs/demo/2026-10-08-first-payout-readiness.md, docs/handoffs/2026-10-02-payout-readiness.md, docs/WALLETS.md.
Model: GPT-6.1 Sol (high) — bounded participant-flow preparation and documentation.
Skills: handoff-memory, superpowers:brainstorming, frontend-design, handoff.
Verify current Git/CI, then agree the bounded MYCEL member onboarding design and safe name-correction path. Keep other communities generic, use a genuine invite/support contact supplied by Cisco, and distinguish proposed/shipped/live. Preserve SDK 0.1.0 and Oct 8–9 attended gates; no early C14 execution, branch merge, production metadata mutation or social publication from this preparation prompt. Engineering truth is in this repo; organic-sync post-ship consumes this handoff from the vault.
```
