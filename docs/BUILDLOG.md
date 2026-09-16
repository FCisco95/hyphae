# Hyphae build log

One entry per work session, newest first. Written so it can be read aloud as a script.

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
