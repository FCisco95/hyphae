---
date: 2026-09-30
summary: Close of the Oct 2 arc's pre-Oct-2 work. The CLAUDE.md CI note is corrected on main, the Jev eval ran live (Jev and Sonnet, both rubrics), Cisco ruled nine times on the questions, and feat/jev-eval is at 707d7da, pushed and unmerged. Nothing on the production path changed: production 86ff258, Neon 0000-0009, Runbook C candidate b3c82c7, nothing merged, deployed or migrated. Steps 3 to 6 of the arc (epoch proof, Ledger rehearsal, C1 to C13) wait for 2026-10-02T00:00Z and Cisco.
---

# Session close, 2026-09-30 (for /organic-sync)

Detail lives in [Jev eval run](2026-09-30-jev-eval-run.md), the eval report `docs/evals/jev-first-run-2026-09-30.md` on `feat/jev-eval`, and `docs/BUILDLOG.md`. This file is the receipt the arc asks for.

## Arc status

| Step | State |
|---|---|
| 1. CLAUDE.md CI correction | **Done.** Vault patch applied after `git apply --check`; `main` `2302224`. |
| 2. Rulings, question update, paid eval | **Done.** Nine rulings, question set v3, 4 live runs, other-family review. |
| 3. Epoch 1 close proof | **Waits** for 2026-10-02T00:00Z. |
| 4. Ledger devnet rehearsal, browser claim | **Waits** for Oct 2 and Cisco. |
| 5. Runbook C C1 to C7 on `b3c82c7` | **Waits** for Cisco, one attended step at a time. |
| 6. Integrate `ad40b77`, timing fixes, C8 to C13, `b95d0ab` | **Waits** behind 5. |
| 7. Handoff | This file and `docs/HANDOFF.md`. |

## Branches and merge disposition

| Branch | SHA | Disposition |
|---|---|---|
| `main` | `0b54ecd` plus this close commit | Pushed, in sync with `origin/main`. API tree equals `b3c82c7` (checked: no diff under `apps`, `packages`, `pnpm-lock.yaml`). |
| `feat/jev-eval` | `707d7da` | Pushed, unmerged until after the first payout in epoch 3. |
| `feat/rules-v2` | `158452f` | Unchanged. Unmerged until epoch 3; activation epoch 4 (O4). |
| `fix/timing-budgets` | `02ee74e` | Unchanged. Merge after C7. |
| `docs/runbook-c-truths` | `b95d0ab` | Unchanged. `ad40b77` after C7, `b95d0ab` after C13. |

Stage of the production path: candidate `b3c82c7`, image `deployment-01M3P9QRW519BGZY986E1GV539` (production `86ff258`), Neon 0000 to 0009, no migration, deploy or signer action this session.

## Models, effort, usage

- Runner: Claude Code **Sonnet 5.5** (`claude-sonnet-5-5`), effort **high**. No subagents, no helpers.
- Reviewer: Codex **`gpt-6.1-sol`**, reasoning **high**, read-only, fresh session each time, three rounds (range `7c00629..0a33384`; `4fe3815..9f822f2`; `7b8c605..96b5a48`). Eight findings in total (four, two, two), all P2 or P3, all fixed. No round reviewed the last two commits (`5882fb3`, `707d7da`): both are documentation.
- Token usage: the runtime did not expose it. The session's budget counter moved by about 45k tokens (unverified).
- Paid provider spend: Jev about $0.07 in total (an estimate from about 290 scored items; the three recorded runs account for $0.0129: $0.0059, $0.0046, $0.0024); Sonnet $0.464 recorded plus about $0.19 estimated for one crashed attempt. Every paid call used only synthetic text, or Cisco's own replies and the public posts they answered, which Cisco approved in session.

## Checks

- Final gate on the last code commit (`6246763`): `pnpm test` exit 0 (106 + 79 + 614 API, 1 skipped), typecheck 0, lint 0; drizzle check 0 earlier on the branch. No DB or reward code changed, so `test:pg` was not rerun. On an earlier commit, two of three suite runs failed on the known settlement deadline flake (`fix/timing-budgets` fixes it); the next runs passed.
- `main`: the CLAUDE.md commit ran the full local gate (test, typecheck, lint, all exit 0); later commits on `main` are documentation and ran lint and typecheck.
- Replay: Jev's first-run recordings reproduce 4/16 and 5/16 with no key, at `4fe3815` only.

## Eval provenance

Jev `jev-1.13.0` and Sonnet `anthropic:claude-sonnet-5`, rubrics 1.2.0 and 1.3.1 (the latter read from `feat/rules-v2`, sha256 `56e5fad1…`), 16 synthetic cases, live on 2026-09-30, question set v1 for that run. Jev 4/16 and 5/16, Sonnet 3/16 and 2/16: no superiority claim. The labeled replies (48 written by me, 12 from Cisco's own account) and their answer keys are local and gitignored under `docs/plans/`; the transcription of his screenshots is there too.

## Attended receipts

None. No Ledger, mainnet, signer, migration or deploy action ran.

## Downstream changes (for /organic-sync)

- **Applied:** vault patch `2026-09-30-1245Z-hyphae-ci.patch` (CLAUDE.md now says CI runs the gate on every push; the local gate still runs). The sync can mark it done.
- **New rulings to record** (Cisco, 2026-09-30, full text in `docs/evals/jev-questions.md` on `feat/jev-eval`): 1 `low_effort` is a hard zero (eval only); 2 keep weights; 3 no cap; 4 check raw and credited; 5 the AI tell is a backwards sentence, amended to "not enough alone; polished, abstract or stacked"; 6 jokes and short opinions are not low effort; 7 the scorer needs a maintained, published, pinned project brief; 8 answering with the project's own material is good engagement, so intake must pass quoted-post text and image descriptions; 9 an organic reaction earns the low end (about 60 to 70) of the same scale, with no flat participation credit.
- **Vault note still missing:** `13 Jev Question Set` was never written in the vault; the set now lives in `docs/evals/jev-questions.md`. The sync may link to it and close the ask.
- **Rubric-level ideas for a version after 1.3.1** (none is built): an admin tags ritual (greeting) posts at intake with a small fixed credit and no AI call; a no-AI pre-filter for a bare gm or emoji-only reply; production `creditedScore` zeroing `low_effort`; the project brief pinned per epoch and published; quoted-post text and image descriptions passed at intake.
- **Project brief:** approved with edits, `docs/evals/project-brief-mycel.md` on `feat/jev-eval`. Not wired into the scorer. One sentence (the token created as a test) needs Cisco's confirmation before it is published; two questions remain open (what people say about MYCEL that counts as on topic; what must never be rewarded).
- **Organic, as Cisco described it:** a platform that acts as a community hub for communities, building tools so they reach higher milestones and last longer than a few days, and sharing rewards through the Hyphae protocol. MYCEL was first the name of Organic's AI layer; the token began as a test and people liked it, so Hyphae became a standalone product for the hackathon. Cisco asked not to call this an "umbrella".
- **No change** to `organic-app`, the public `hyphae-program` repo (its README amendment stays a prepared patch for its owner), the vault or any sibling.

## Parked, with recommendations

1. **Calibrate Jev on Cisco's grades** (a few hundred, including jokes and short opinions), test on a holdout. Recommend yes: prompt wording and worked examples did not deliver ruling 9.
2. **Cisco answers the brief's two open questions and confirms the flagged sentence.** Recommend yes, before any wiring.
3. **A second labeler and a larger holdout** before any further wording change. Recommend yes; one person's calls on 48 synthetic replies is a direction, not proof.
4. **Intake carrying quoted-post text and image descriptions.** Recommend yes; it alone moved his article reply from 11 to 60.
5. **Optional Claude follow-up review of `0894335..7c00629`** still has no verdict (two HTTP 429 earlier).
6. **`gates.pg.test.ts` concurrent-runs hang** (two of eight `test:pg` runs under load): read `runHoldChecks`'s pool and lock path after the payout.
7. **Open from before:** Vercel Pro and alerts (Cisco's dashboard step); `hackathon@colosseum.com` access to the repo before submitting; the domain; database cost after Oct 12.

## Next gate

**2026-10-02T00:00Z, with Cisco.** The read-only epoch 1 close proof, then the Ledger devnet rehearsal (Windows CLI 3.1.10, `usb://ledger?key=2/0`), then Runbook C C1 to C13 on `b3c82c7`. Stops: epoch 1 not closed cleanly or the gate not refusing it; any change under `programs/hyphae`; a Runbook C check failing. Do not merge `feat/rules-v2` or `feat/jev-eval` before the first payout in epoch 3.
