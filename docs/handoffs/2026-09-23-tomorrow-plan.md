---
date: 2026-09-23
summary: Plan for 2026-09-24. Three public documents from existing evidence only (short whitepaper, demo script, tester checklist), then R3 test-first on feat/r3-slots-dispatch if the R3–R5 scope is approved in writing. Evidence labels kept distinct: historical, locally tested, deployed, planned.
---

# Plan for 2026-09-24

## Order

1. **Check approval.** If Cisco has approved `docs/handoffs/2026-09-23-r3-r5-scope-proposal.md` in writing (all nine decisions) and ruled on recommendations A and B in `2026-09-23-schedule-rulings.md`, record the exact words in a dated handoff before any code. No approval → do steps 2–4 only.
2. **Public whitepaper** — `docs/WHITEPAPER.md`, about two pages.
3. **Demo script from existing evidence** — `docs/demo/2026-09-25-weekly-video-2.md`, for Friday's weekly video.
4. **Tester checklist** — `docs/TESTING.md`, what a Hyphae Lab tester does and what they should see today.
5. **R3, test-first**, only after step 1 succeeds: `git checkout main && git pull --ff-only && git checkout -b feat/r3-slots-dispatch`. First commit is failing tests for payload v2 and the lock-mode change; then slots and nomination; then dispatch.

Steps 2–4: about three hours together. Step 5 starts the ~two-session R3 estimate.

## Evidence labels (use these words in all three documents)

| Label | Meaning | Examples today |
|---|---|---|
| **Historical** | Happened and was recorded at the time; not re-run | Sep 17 build log: 3 contributions, 6 scoring runs over 3 rubric versions, credited 85/0/0, $0.084 scoring spend, 5–11 s per score |
| **Locally tested** | Passes the native gate on a named commit; not running anywhere | R1 exact points, R2 pinned config and admission: 41 core + 83 api tests at `dc261c7` (fresh run 2026-09-23) |
| **Deployed** | Running on Fly or Neon, checked in that session | Last recorded Sep 17 (not re-checked 2026-09-23): bot `@hyphaeprotocol_bot`, `/link`, `/submit`, `/raid`, `/me`, the score job, three migrations on Neon. Re-check with `fly status` and a read-only query before calling anything deployed |
| **Planned** | Scoped or scheduled, not built | R3–R5, audit page, Anchor claim, devnet run, mainnet payout, verified wallet linking |

Rules: no tester counts, submission counts or scores that are not in the build log or read from the database in that session; if a number is read fresh, say when. R2 is locally tested and merged, **not deployed**: migration 0003 is not on Neon. The devnet demo and any payout are planned. Nothing is described as live that is not deployed.

## Whitepaper outline (`docs/WHITEPAPER.md`)

1. Problem: communities pay for engagement they cannot audit.
2. What Hyphae does: public rubric, model score plus code-enforced credit gates, reasoning shown, append-only records.
3. Rewards design: seven-day epochs, pinned configuration with cooldown (E11 → E13), one nominated 3× effort slot, exact points before whole points (85 at 27 h → 127.5 exact).
4. Audit trail: model, rubric version, prompt hash and evidence hash per score; corrections append, never overwrite; frozen close.
5. On-chain plan: merkle root per epoch, claim with proof (planned; H-CONTRACT pending).
6. Status table using the four labels above.
7. Limits: text-only capture, no media; unverified pasted wallets; no payout yet.

Public-safe: no fee strategy reasoning, no competitor analysis, no private plan content.

## Demo script outline (weekly video #2, Fri Sep 25)

Existing evidence only, each beat labelled:

1. The founder's own test reply scored raw 3, credited 0, off-topic — and why that is the rubric working (historical, Sep 17).
2. Rubric 1.0.0 → 1.1.0 → 1.2.0 re-grades as new rows beside the old ones (historical).
3. Pinned configuration and the E11 → E13 cooldown, shown as the passing test (locally tested).
4. Admission at exactly `closesAt` landing in the next epoch (locally tested).
5. What R3 adds this week and what the audit page will show (planned).

Record from the terminal and the Telegram group; no staged data presented as usage.

## Tester checklist outline (`docs/TESTING.md`)

For Hyphae Lab testers today (deployed behavior only): join the group, `/link <wallet>` (note: pasted, not verified; no payout exists yet), wait for an admin `/raid`, reply on X, `/submit <link>`, read the scored reply, `/me`. What to report: a wrong score (with the link), a missing reply, a confusing reason. What not to expect: points are not money, `/me` totals are not epoch rewards, images are not seen by the scorer.

A second section, marked planned, lists what changes after R3–R5 (`/effort`, epoch-scoped `/me`).

## Not tomorrow

Neon migration apply, deployment, R6, settlement, root, claim, fixture or paid runs, Sentinel adoption code, vault edits. Organic-sync owns the private-plan update for today's rulings.

## Model

Preferred: Fable 5.1 xhigh (Claude Code) or Astra xhigh (Codex). Record the model the session actually reports; a preference is not runtime proof, and effort is recorded only if the session exposes it.
