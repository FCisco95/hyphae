# CLAUDE.md — hyphae

Colosseum Crypto World's Fair entry (2026-09-14 → 2026-10-12). Solo build under the Organic/MYCEL umbrella. Public repo, BUSL 1.1 (visibility re-ruled by Cisco 2026-10-07); the program and the rubrics are published in the public repo `FCisco95/hyphae-program`, which must be updated whenever `programs/hyphae` or `docs/rubrics/*.json` change.

<!-- ORGANIC-SYNC:WORKING-AGREEMENT:BEGIN v2 — managed by cisco-brain /organic-sync; edit the canonical copy there, not here -->
## Working agreement (solo founder)

Cisco is the only developer and the only reviewer. Work like a senior engineer trusted with a long session, not an assistant waiting for a nod.

- **An approved plan is the approval.** A task named in an approved plan, spec, recorded ruling or session prompt is authorized, including the risky steps it names. Don't ask "ok?", "go?" or "should I continue?". Finish a step, verify it, commit it, start the next.
- **A working result is the goal.** Name what will work and the check proving it. Build/fix/test the approved steps; reuse accepted work. Docs support the result. Never repeat completed preparation or audits to fill a session. If only human input remains, say Needs you and give the next action.
- **Run the whole arc.** Work through the prompt's steps, then the plan's next tasks, until the arc ends or you hit a hard stop. Don't end a session after one small task when the next one needs nothing from Cisco.
- **Hard stops, and only these:** a founder decision nothing records (money, rewards, custody, pricing, public claims, priorities); an irreversible or external action nothing approves (production migration or data change, mainnet transaction or funds movement, package publish or release, public post or message, credential or secret change, deleting production data, accounts or unmerged work); weakening a security invariant; writing in another repo. At a stop, park that item, keep doing everything it doesn't block, and surface the nearest human blocker plainly. Guide Cisco through one concrete action at a time, wait for the result, then give the next action. Keep other blockers in the handoff.
- **Recommend, don't survey.** Every choice gets one recommendation and a one-line why. Pick what a senior engineer who will own this codebase for years would pick: correct, secure, maintainable, honest about what is and isn't done, even when it's more work. Never pick an option because it's easier for you. If the right option doesn't fit the deadline, say so and name what gets deferred.
- **Trunk-based git, no PRs.** Commit to `main` after each verified milestone and push once the repo's local gate passes and recorded release conditions permit it; never bypass hooks. Preserve publication/production holds, including docs pushes that trigger deployment. No feature branches or PRs unless Cisco asks. Two sessions in one repo at once: each works on a short-lived worktree branch, rebases on `main`, fast-forward merges it locally, pushes `main` and deletes the branch. Finish an existing feature branch the same way only after its release preconditions and authorization pass; preserve unmerged work while held.
- **A review replaces the PR.** For money, rewards, auth, RLS, wallet, security or migration changes, get a fresh-session review of `git diff <arc-start>..HEAD` from the other model family (Codex `/review` if Claude built it, Claude `/code-review` if Codex did) before pushing. Fix findings test-first and record the verdict in the handoff.
- **Talk plainly.** Short sentences, simple words, direct point. Explain what we are doing and why a human is needed. One step, one expected result, then wait; never a wall of instructions.
- **Report the outcome:** what now works, checks and evidence stage, commit SHAs, what is blocked, and the next human action. Surface human blockers when discovered; routine updates stay brief.
<!-- ORGANIC-SYNC:WORKING-AGREEMENT:END -->

## Where the plan lives
- **Canonical spec + plan (private, vault):** `~/Documents/cisco-brain/10 - PROJECTS/Organic/plans/2026-09-16-hyphae-design.md` and `2026-09-16-hyphae-implementation-plan.md`. Current repo handoff: `docs/HANDOFF.md`. Read these before planning or implementing.
- **Local mirror:** `docs/plans/` (gitignored). Copy from the vault at session start if it is stale; never commit it. This repo is public; strategy and competitive reasoning stay out of it.
- **Public build log:** `docs/BUILDLOG.md`, one entry per session (shipped · decision + one-line why · numbers · commits · next). Update it before ending a session. It is the script source for the weekly judge video and the final demo.
- **Portable engineering handoff:** `docs/HANDOFF.md` (current) and `docs/handoffs/` (snapshots). Keep these public-safe; private strategy stays in the vault.

## Hackathon progress on GitHub

- On every active hackathon day, make at least one small, coherent conventional commit after a verifiable milestone. Commit the real state of the work; never manufacture activity or label incomplete/review-blocked work as shipped.
- Update `docs/BUILDLOG.md` on the same day with what changed, the decision and why, validation numbers, resulting commit SHA(s), and the next bounded action. Keep entries public-safe and distinguish local-only work from pushed work.
- Refresh `docs/HANDOFF.md` whenever material state, risks, or next actions change. Add a dated `docs/handoffs/` snapshot for a review, approval, or other durable checkpoint.
- Before ending an active hackathon day, push the documented commits to the configured GitHub remote and verify the branch state with `git status -sb`. If a push is intentionally deferred, record why and the exact pending commits in the build log and handoff.
- Keep commits focused: implementation/tests together; review findings, progress records, and process rules separately when that makes the timeline clearer. Do not commit secrets, private-vault material, generated noise, or unrelated changes.

## Hard rule — repo boundary
This repo consumes Organic's **public** settlement API only: `/api/launchpad/coins/mint/[mint]/settlement` (GET). It never touches `organic-app`. Stage C1 in `organic-app` owns `supabase/migrations/**`, `messages/*.json`, `[mint]/page.tsx`, `settlement/**`. If a task seems to need any of those, stop: that is a collision with parallel work, not a Hyphae task.

## Stack (decided 2026-09-16, reasoning in the vault spec)
pnpm workspace · Anchor 1.0.1 at root (`programs/hyphae`, `tests/` LiteSVM, `clients/js` Codama) · `packages/core` pure TS (merkle, settle, rubric, scoring contract) · `packages/db` Drizzle on Neon · `apps/api` Hono + grammY + pg-boss on Fly (processes `api`, `worker`) · `apps/web` Next.js on Vercel. Solana/Anchor commands run in WSL Ubuntu.

## Standards
Comments only for non-obvious why. No speculative abstractions, no dead code, no placeholder scaffolding. Ecosystem-standard layouts. Pure modules have tests. Conventional commits. `Cargo.lock` is committed. Pull current docs via Context7 before writing against Anchor, Token-2022, grammY, pg-boss, AI SDK, or Drizzle.

**Local gate before every push to `main`:** `pnpm test`, `pnpm typecheck`, `pnpm lint` (check the exit code). When `packages/db` or reward jobs change, also `pnpm --filter @hyphae/db exec drizzle-kit check` and `pnpm --filter @hyphae/api test:pg` (Docker). CI runs the gate on every push; the local gate still runs before each push.
