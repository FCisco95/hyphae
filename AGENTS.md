# Hyphae — agent rules

The one source of process rules for every agent (Codex reads this file; `CLAUDE.md` imports it). If any other file, skill or old handoff says otherwise, this file wins.

Hyphae is Cisco's Colosseum Crypto World's Fair entry (2026-09-14 → submission 2026-10-12 23:59 PDT = 2026-10-13 06:59Z) and the first community MYCEL under the Organic umbrella. Public GitHub repo `FCisco95/hyphae`, BUSL 1.1. The program and the rubrics are also published in `FCisco95/hyphae-program`, which must be updated (with Cisco's yes: it is a publish) whenever `programs/hyphae` or `docs/rubrics/*.json` change.

## How we work

Cisco is the only developer and the only reviewer. He works from two machines (MacBook and Windows PC) with two agent families (Claude Code and Codex). Git is the only shared truth, so both machines must always see the same `main`.

1. **One branch: `main`.** No feature branches, worktrees, backup branches or PRs. If a temporary branch is truly unavoidable, merge or delete it in the same session. `next` (the reviewed post-payout release) is the last integration branch; the release plan merges it and then it goes.
2. **Session start:** `node scripts/session-check.mjs start`. It fetches, fast-forwards a clean `main` and fails when anything could strand work: another branch with commits not in `origin/main`, a worktree, a stash, a dirty tree, unpushed or diverged `main`. Resolve what it reports before working. Never delete work that exists nowhere else; ask Cisco.
3. **Session end:** commit and push `main`, then `node scripts/session-check.mjs end` must say OK. If a recorded hold blocks the push, leave the commits on local `main` and say so in `docs/HANDOFF.md`.
4. **`main` is always deployable,** because a push to `main` deploys the web to production (see below). Nothing on `main` may change production before Cisco wants it: unfinished risky web code sits behind a flag; web code that needs a newer API waits until that API is live. Migrations in `packages/db/drizzle` are inert on `main`; only `scripts/rollout/db.mjs` applies them, on Cisco's yes.
5. **The gate is automatic.** `.githooks/pre-push` runs `pnpm test`, `pnpm typecheck`, `pnpm lint` (and `drizzle-kit check` when `packages/db` changes) on every push that touches more than docs; `session-check start` points git at it. CI repeats the gate plus the Postgres suites. Don't add manual gate runs or paperwork on top. Never bypass hooks (`--no-verify`).
6. **Hard stops (ask Cisco), only these:**
   - mainnet transactions, funds, Ledger or Squads signing;
   - production writes: applying a migration, writing production data (epoch changes, corrections, amendments), deploying the API or worker to Fly, changing Vercel settings;
   - a recorded freeze or hold (the payout runbook, `docs/HANDOFF.md`): no push to `main`, no deploy, no change to payout, hold or scoring code or data while it lasts;
   - secrets and keys;
   - deleting work that exists nowhere else;
   - product decisions: money, rewards, rubrics, pricing, public claims and wording, posting to Telegram or X, publishing to `hyphae-program`;
   - writing in another repo.

   Everything else: decide, do, verify, report once at the end. A recorded approval (a ruling, a release plan Cisco said yes to) covers the steps it names.
7. **Cross-model review only for code that moves funds:** `programs/hyphae`, and the code that decides who is paid or how much (`packages/core` merkle, settle and scoring; `apps/api` payout, hold, reward jobs, wallet linking; `scripts/rollout`). Get a fresh-session review of `git diff <arc-start>..HEAD` from the other model family (Codex `/review` if Claude built it, Claude `/code-review` if Codex did) before pushing, fix findings test-first, and record the verdict in `docs/reviews/`. Not required elsewhere.
8. **`docs/HANDOFF.md` is short** (about 80 lines): current state, next step, blockers, open questions. History lives in `git log` and `docs/BUILDLOG.md`; dated `docs/handoffs/` files only for major events. When shortening, archive the old text in `docs/handoffs/archive/HANDOFF-<date>.md`; never delete it.
9. **Machine-local agent memory is not authoritative** (`~/.claude/projects/*/memory`, Codex memory). Durable facts go in the repo, or in the vault when private.
10. **Custody stays separated.** Signing keys stay on their own device (Ledger admin and upgrade key, the Squads fee vault, any machine hot key). "Same truth on both machines" never means copying keys.
11. **Talk plainly.** Short sentences, one recommendation with a one-line why, not a survey. Report what now works, the evidence, commit SHAs, what is blocked and the next human action.

## What a push to `main` triggers

| Trigger | Effect |
|---|---|
| Vercel Git integration (project `prj_zGEwnzy5ATqVXru7apeDkPfrcHSM`, root `apps/web`) | **Production deploy** of the web to `hyphae-delta.vercel.app`, even for a docs-only push. Other branches get preview deploys (Vercel default, not checked). |
| `.github/workflows/ci.yml` | The gate on every push to any branch: tests, typecheck, lint, `drizzle-kit check`, `test:pg` on Postgres 17, H-CONTRACT vectors. Build and test only. |
| `.github/workflows/program.yml` | Nothing; it runs weekly and on demand (`anchor build`, program tests). It never deploys the program. |
| Fly (`apps/api`, processes `api` and `worker`) | Nothing; images are deployed by hand on Cisco's yes. |
| Neon migrations | Nothing; only `scripts/rollout/db.mjs`, on Cisco's yes. |

## Hackathon record (until the submission)

- Each active day: at least one small, truthful conventional commit after a verifiable milestone, and a public-safe `docs/BUILDLOG.md` entry (what changed, the decision and why, numbers, commit SHAs, next step; say whether it is pushed). The build log is the script source for the judge video and the demo.
- Never manufacture activity or call review-blocked work shipped. Never commit secrets, private-vault material, generated noise or unrelated changes.

## Where things live

- **Private spec and plan (vault):** `~/Documents/cisco-brain/10 - PROJECTS/Organic/plans/2026-09-16-hyphae-design.md` and `2026-09-16-hyphae-implementation-plan.md`. Local mirror `docs/plans/` is gitignored; copy from the vault when stale, never commit it. Strategy and competitive reasoning stay out of this public repo.
- **Current state:** `docs/HANDOFF.md`. Payout runbook: `docs/demo/2026-10-08-first-payout-readiness.md`. Release plans: `docs/demo/`. Reviews: `docs/reviews/`.

## Repo boundary (hard rule)

This repo consumes Organic's **public** settlement API only: `/api/launchpad/coins/mint/[mint]/settlement` (GET). It never touches `organic-app`. Stage C1 in `organic-app` owns `supabase/migrations/**`, `messages/*.json`, `[mint]/page.tsx`, `settlement/**`. If a task seems to need any of those, stop: that is a collision with parallel work, not a Hyphae task.

## Stack (decided 2026-09-16, reasoning in the vault spec)

pnpm workspace · Anchor 1.0.1 at root (`programs/hyphae`, LiteSVM tests, `clients/js` Codama) · `packages/core` pure TS (merkle, settle, rubric, scoring contract) · `packages/db` Drizzle on Neon · `apps/api` Hono + grammY + pg-boss on Fly (processes `api`, `worker`) · `apps/web` Next.js on Vercel. Solana/Anchor commands run in WSL Ubuntu on the Windows PC.

## Standards

Comments only for non-obvious why. No speculative abstractions, no dead code, no placeholder scaffolding. Ecosystem-standard layouts. Pure modules have tests. Conventional commits. `Cargo.lock` is committed. Pull current docs (Context7 or the package's own docs) before writing against Anchor, Token-2022, grammY, pg-boss, AI SDK or Drizzle. `pnpm --filter @hyphae/api test:pg` needs Docker locally; CI runs it on every push.
