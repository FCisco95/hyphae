# Hyphae agent instructions

## Hackathon visibility

Hyphae is a public Colosseum Crypto World's Fair hackathon project. Make daily progress easy to inspect on GitHub without overstating it.

- On each active hackathon day, create at least one small, coherent conventional commit after a verifiable milestone. Do not manufacture commits, and identify WIP or review-blocked work plainly.
- In `docs/BUILDLOG.md`, add a same-day, public-safe entry with: what changed, a decision and why, validation numbers, commit SHA(s), and the next bounded action. Say whether the work is local-only or pushed.
- Refresh `docs/HANDOFF.md` whenever the working state, risks, validation, or next action changes. Add a dated `docs/handoffs/` snapshot for durable reviews, approvals, or checkpoints.
- Before ending an active hackathon day, push the documented commits to the configured GitHub remote and verify `git status -sb`. If that cannot happen, document why and the precise pending commit IDs in both the build log and handoff.
- Keep commits truthful and focused. Prefer implementation-plus-tests together; use separate commits for review findings and process/documentation when that gives judges a clearer history. Never commit credentials, private-vault content, or unrelated workspace changes.

## Repository safety

Read `CLAUDE.md` and `docs/HANDOFF.md` before planning or implementing. This is a public repository: keep private strategy in the vault and respect the Organic boundary described in `CLAUDE.md`.
