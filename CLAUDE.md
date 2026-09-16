# CLAUDE.md — hyphae

Colosseum Crypto World's Fair hackathon entry (2026-09-14 → 2026-10-12). Solo build under the Organic/MYCEL umbrella.

**Read the full handoff before doing any planning or implementation work:**
`~/Documents/cisco-brain/_memory/HANDOFF.md` (product decision, architecture, 4-week build shape, open items).

## Hard rule — repo boundary

This repo consumes Organic's **public** settlement API only:
`/api/launchpad/coins/mint/[mint]/settlement`

It never touches `organic-app` internals. Stage C1 in `organic-app` owns:
- `supabase/migrations/**`
- `messages/*.json`
- `[mint]/page.tsx`
- `settlement/**` (internals)

If a task looks like it needs to modify any of the above, stop — that's a collision with parallel work in `organic-app`, not a Hyphae task. Build additively against the public API surface only.
