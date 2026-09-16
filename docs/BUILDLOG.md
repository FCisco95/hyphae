# Hyphae build log

One entry per work session, newest first. Written so it can be read aloud as a script.

## 2026-09-16 (evening) · Day 3 of 28 — toolchain and scaffold

**Shipped:** the workspace. pnpm monorepo, Anchor 1.0.1 program at the root that builds and emits its IDL, Biome for lint, LF enforced. WSL toolchain complete (Node 22, pnpm 10, Rust 1.90, Anchor 1.0.1, solana-cli 3.1). Infrastructure provisioned: Fly app `hyphae-api` with secrets staged, Neon Postgres in Frankfurt (round-trip verified), Telegram bot `@hyphaeprotocol_bot` live and admin of the `Hyphae Lab` test group, Anthropic key verified.
**Decisions:**
- `anchor-lang` pinned to exactly 1.0.1 to match the CLI. Cargo had resolved 1.2.0 on its own; a CLI/crate mismatch is a class of IDL bug not worth debugging mid-hackathon.
- Generated mocha test stays until week 3 replaces it with LiteSVM. No dead scaffolding beyond that: `app/` and prettier dropped at init.
**Numbers:** 0 testers on the bot yet · 0 contributions · $0.00 scoring spend.
**Commits:** 600a4fa, f705c5f
**Next:** `packages/core` merkle test-first, then settle, rubric, Drizzle schema, bot on Fly.

## 2026-09-16 · Day 3 of 28 — plan locked

**Shipped:** the design and the 4-week plan. Week 1 is hour-by-hour; testers touch the bot on Saturday.
**Decisions:**
- Scores are computed off-chain and every epoch's full score set is committed on-chain as a merkle root, so an unfair score is provable. Chain writes scale with epochs, not contributions.
- One vault per community, one permanent deposit address. Anyone can fund it; contributors claim with a proof and receive soulbound Token-2022 points in the same transaction.
- Stake weighting is a per-community rubric setting (`none` or `sqrt`), published and hashed into the epoch. The protocol does not pick the economics; it makes them auditable.
- Long-running pieces (Telegram webhook, job queue, epoch keeper) run in containers on Fly. The public pages run on Vercel. Postgres on Neon, jobs in pg-boss, no Redis until Postgres says so.
- Every AI score records the model, rubric version and prompt hash. Switching models is visible in the audit trail by construction.
**Numbers:** 0 testers on the bot yet · 0 contributions · $0.00 scoring spend.
**Commits:** see `git log` for this date.
**Next:** toolchain, accounts, workspace scaffold tonight; DB + merkle + bot on Fly tomorrow.
