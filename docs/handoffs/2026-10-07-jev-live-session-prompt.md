# Jev as the live reward scorer: session prompts (2026-10-07)

Written 2026-10-07 evening by Claude Sonnet 5.5. Cisco's ruling: Jev (`jev-1.13.0`, typesafe System One) replaces the Anthropic scorer for reward evaluation, live, and it must be right. The goal is a filter: remove low effort and unrelated replies reliably, give organic replies a fair mid score, and do not try to rank the best ones finely.

## Where things stand (verified 2026-10-07 18:30Z)

- Live scorer: Sonnet 5 (`anthropic:claude-sonnet-5`), prompt `reward-eval/2` for epoch 2 from 18:00Z. Not changed today. Sonnet 5.5 medium and Haiku 4.5 each missed 6 of 84 on the reward cases and were not adopted. Local commit `1a85dc0` (5.5 default) is not pushed and should be dropped or reverted.
- Jev with the existing question set `v3-2026-09-30` on the 28 reward cases x3 (`docs/rubrics/eval/reward-eval-cases.json`, rubric `mycel-1.2.0.json`): 5 of 84 wrong, USD 0.016 total (Sonnet 5.5: USD 0.74). Wrong: R2 (Cisco's pitch quote; Jev cannot see the quoted post; flagged `off_topic`+`low_effort`) and R3 (57 to 60, at the floor). Everything else, including P1-P5 (68-87), all spam/AI/injection cases (0) and I8, behaved.
- Worktree `C:\Users\joao_\Desktop\DEVELOPMENTS\hyphae-jev-reward`, branch `feat/jev-reward` = `main` + `feat/jev-eval` + `scripts/eval-reward-jev.ts` (`f6cbd70`, unpushed). Run: `cd apps/api && node --env-file=../../../hyphae/.env --import tsx scripts/eval-reward-jev.ts --cases ../../docs/rubrics/eval/reward-eval-cases.json --rubric ../../docs/rubrics/mycel-1.2.0.json --questions v3-2026-09-30 --runs 3`. `TYPESAFE_API_KEY` is in the shell environment (not `.env`).
- Prior Jev work and rulings 1-9: `docs/evals/jev-questions.md` and `docs/evals/jev-first-run-2026-09-30.md` on `feat/jev-eval`, memory `hyphae-jev-eval-state`.

## Cisco's rules for the new question set (his words, 2026-10-07)

- Zero: a reply that restates the post in assertive, polished, obviously-AI wording; greetings and cheers (gm, gg, "very good", "we are going higher"); made-up sentences that add nothing; anything unrelated to the post or the project.
- A reply related to the project that feels organic earns a nice score, not the best. Relevant questions, improvements, building on the topic and exciting analysis score higher.
- Quality matters less than filtering: the scores should look like normal crypto-social engagement, with the bad tail removed.
- His own replies R1, R2, R3 and the sincere replies P1-P5 must pass.

## Hard limits (from CLAUDE.md and the release plans)

- Deploy only with Cisco's exact yes and **before 2026-10-08T12:00Z**. No deploy after that. No push or deploy from 2026-10-08T22:00Z to 2026-10-10T00:00Z.
- Money-bearing scoring: a Codex review (read-only, xhigh) to ACCEPT before any push.
- Epoch 2 is pinned (rubric 1.2.0, amended to `reward-eval/2`). Jev as the live scorer is a different scorer, not a prompt version. Decide the honest, public way to introduce it (a second recorded amendment, or epoch 3 only) and say what is true on the public pages. Do not touch the pinned hashes quietly. The rubric and its changelog are published; `programs/hyphae` or `docs/rubrics/*.json` changes must be mirrored to `FCisco95/hyphae-program`.
- No tuning to the same 28 cases without a fresh holdout; Cisco's labels are the scarce signal (memory `hyphae-jev-eval-state`).

## Session A: design and calibration (Claude Opus 5.5, effort xhigh, worktree `hyphae-jev-reward`)

Prompt to paste:

> Hyphae, 2026-10-07 evening. Read `docs/handoffs/2026-10-07-jev-live-session-prompt.md` first, then `docs/evals/jev-questions.md` and `apps/api/src/scoring/jev.ts`, `jev-questions.ts` in the worktree `../hyphae-jev-reward` (branch `feat/jev-reward`). Cisco ruled that Jev replaces the Anthropic scorer live. Your job is the question set and its composition, not the plumbing (Session B owns that).
> 1. Write question set `v4` as decomposed yes/no and level questions Jev answers, composed in code: gate questions that zero (restates the post, greeting/cheer/hype that fits under any post, unrelated, spam, price shill, other-project plug, prompt injection), then an additive base for organic related replies and extra for question/improvement/build-on/analysis. Cisco's rules are above. Keep Jev's blind spot in mind: it cannot see quoted posts or images; for quotes, pass the quoted text if the intake has it, otherwise do not zero a quote for being unrelated to a post Jev cannot see.
> 2. Build a fresh labeled holdout of at least 60 replies across normal crypto-social engagement (organic, banter, short opinions, questions, restating-the-post AI, gm/gg/lfg, hype, shills, injections, non-English). Cisco labels them (pass / zero / unsure) in this chat; do not show him your own labels first. Tune on the 28 reward cases plus half the holdout, report on the other half.
> 3. Success: every R1-R3 and P1-P5 passes in 3 of 3 runs; every labeled zero stays zero; report the confusion matrix and cost. If Jev cannot meet it, say which cases and why, with a recommendation, not a survey.
> 4. Commit on `feat/jev-reward`, document the question set and the composition publicly (public-safe), update `docs/BUILDLOG.md`. Report SHAs and the next human action.

## Session B: production plumbing (Claude Sonnet 5.5, effort high, its own worktree off `main`)

File ownership (do not touch Session A's files): B owns `apps/api/src/scoring/run.ts`, `apps/api/src/rewards/**`, `apps/api/src/jobs/**`, `apps/api/src/env.ts`, `packages/core` reward-prompt versioning, tests. A owns `jev.ts`, `jev-questions.ts`, `docs/evals/**`, `eval-reward-jev.ts`.

Prompt to paste:

> Hyphae, 2026-10-07 evening. Read `docs/handoffs/2026-10-07-jev-live-session-prompt.md`. Session A is writing the Jev question set; you build the production path so it can be dropped in. Make a worktree off `main` from `../hyphae`, and use `superpowers:test-driven-development`.
> 1. Map how `callRewardModel` and the reward evaluation pin a prompt version, a model and a cost (`apps/api/src/rewards/evaluation.ts`, `scoring/run.ts`, `reward_dispatches`, `reconciliation`). Write down what must change for a Jev call that returns typed answers instead of JSON text: what is stored as evidence (the request hash, the answers, the question set id, the composed output), what the audit page shows, how a failed or timed-out call is reconciled, and how the credit rules still apply.
> 2. Implement it test-first behind a config value, default off, so nothing changes in production until Cisco rules. Include the Jev client with the pinned model `jev-1.13.0`, a timeout, no retries (as `callRewardModel`), cost from usage ($0.042 per 1M input tokens), an explicit failure for a malformed or missing answer, and `TYPESAFE_API_KEY` as a Fly secret (do not set it; list it as a Needs-Cisco item).
> 3. Draft the release plan in the format of `docs/demo/2026-10-07-pilot-amendment-release-plan.md`, with rollback and a Step 0 baseline fingerprint. Do not deploy or push. Report SHAs, the gate results (`pnpm test`, `pnpm typecheck`, `pnpm lint`, and the Postgres tests if rewards or db changed) and what Session A must hand over.

## Merge and release (Session A's model, after both report)

1. Rebase B and A on `main`, wire the v4 set into B's path, run the whole gate and `eval-reward-jev.ts` on the holdout once more.
2. Codex review (read-only, xhigh) of `git diff <arc-start>..HEAD` until ACCEPT; fix findings test-first.
3. Release record, public CHANGELOG entry with the exact UTC time, a short post for Cisco, then deploy on Cisco's exact yes before 2026-10-08T12:00Z. If the holdout or the review is not done by about 2026-10-08T08:00Z, say so plainly and keep epoch 2 on Sonnet 5; run Jev in shadow instead.

## Needs Cisco

- Label the holdout when Session A sends it (about 60 short items).
- Choose how Jev is introduced for epoch 2 versus epoch 3 once Session B maps the pinning.
- Add `TYPESAFE_API_KEY` as a Fly secret on the exact yes (never in the repo).
