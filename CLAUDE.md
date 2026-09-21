# CLAUDE.md — hyphae

Colosseum Crypto World's Fair entry (2026-09-14 → 2026-10-12). Solo build under the Organic/MYCEL umbrella. Public repo, MIT.

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
