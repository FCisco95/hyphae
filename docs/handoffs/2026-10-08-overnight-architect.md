---
date: 2026-10-08
summary: Night checkpoint. The close of epoch 2 moved to 2026-10-10T00:00Z (Cisco), the operator docs shifted one day, and the five feature branches of the afternoon were reviewed by Codex, fixed test-first and fix-checked ACCEPT into `next`, with the epoch-page schedule notice and the migration script re-pinned to 0018+0019. Production unchanged. Where this differs from HANDOFF.md, the handoff wins.
---

# Overnight architect checkpoint, 2026-10-08

Architect: Claude Fable 5.1 (xhigh) on the home machine, coordinating through Orca: Codex gpt-6-astra (xhigh) for every review and fix check, Claude Opus 5.5 (xhigh) for reward, payout, wallet, raid and migration fixes, Claude Sonnet 5.5 (high) for docs and web.

## Rulings applied (Cisco, 2026-10-08)

1. Epoch 2 closes 2026-10-10T00:00Z, one day later, because Cisco cannot attend the close on the 9th. Applied 17:46:49Z by a guarded one-row update; verified in code that the close job fires only when the database clock passes `closes_at` and that epoch 3's window is computed from the new close. Operator docs shifted one day on `main` (`e57d774`, `a857678`).
2. Epoch 2 stays on Claude Haiku 5.5 with `reward-eval/2`; epoch 3 moves to `reward-eval/3` after the release and a recorded amendment.
3. Changes are said plainly in public: a changelog entry and a "Schedule change" panel on the epoch page (built; wording for Cisco's approval in the morning).

## Reviews and fixes (all on `next`)

| Branch | Review | Fix (model) | Fix check |
|---|---|---|---|
| scorer-v3 | 1 medium | `dd1d831` (Opus) | ACCEPT |
| payout-status | 5 medium | `716de93`…`b63fc1d` (Opus) | ACCEPT |
| raid-stats | 2 medium, 1 low | `c525c2d`, `d5cbc84` (Opus); migration 0019 regenerated | ACCEPT |
| wallet-record | 1 medium | `4cca6ca` (Opus) | ACCEPT |
| blink | 1 medium, 2 low (afternoon) | `138c4d0` (Sonnet), `a1981aa` (architect) | ACCEPT, recheck ACCEPT |
| notice (new) | architect | `bcba345`, `f436df3`, `20f3e01` (Sonnet, architect) | |
| rollout (new) | 1 medium, 1 low | `2e240eb`, `05207fd`, `cace96d` (Opus); rehearsed on Postgres 17 and 18 | ACCEPT |

Records: `docs/reviews/2026-10-08-{scorer-v3,payout-status,raid-stats,wallet-record}.md`, `docs/reviews/2026-10-09-{scorer-fix,blink-fix,raid-fix,wallet-fix,payout-fix,rollout}.md`; worker notes `docs/handoffs/2026-10-09-*.md`.

## Not done, on purpose

- No push to `main` of code; no deploy; no production write beyond the ruled close move. The release waits for C22 on Oct 11 and Cisco's yes on `docs/demo/2026-10-11-release-plan.md`.
- No post, changelog entry or README change until Cisco approves the wording.

## Lessons

- Every branch needed fixes after an independent review, including a timeout that did not cover the response body and a read that could carry a hold verdict from after the close. The review step is not optional for money paths.
- One worktree per worker on a short path, one Codex terminal per review, and a bare Enter when the injected prompt sits in the draft.
