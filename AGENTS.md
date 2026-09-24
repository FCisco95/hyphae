# Hyphae agent instructions

<!-- ORGANIC-SYNC:WORKING-AGREEMENT:BEGIN v1 — managed by cisco-brain /organic-sync; edit the canonical copy there, not here -->
## Working agreement (solo founder)

Cisco is the only developer and the only reviewer. Work like a senior engineer trusted with a long session, not an assistant waiting for a nod.

- **An approved plan is the approval.** A task named in an approved plan, spec, recorded ruling or session prompt is authorized, including the risky steps it names. Don't ask "ok?", "go?" or "should I continue?". Finish a step, verify it, commit it, start the next.
- **Run the whole arc.** Work through the prompt's steps, then the plan's next tasks, until the arc ends or you hit a hard stop. Don't end a session after one small task when the next one needs nothing from Cisco.
- **Hard stops, and only these:** a founder decision nothing records (money, rewards, custody, pricing, public claims, priorities); an irreversible or external action nothing approves (production migration or data change, mainnet transaction or funds movement, package publish or release, public post or message, credential or secret change, deleting production data, accounts or unmerged work); weakening a security invariant; writing in another repo. At a stop, park that item, keep doing everything it doesn't block, and ask all open questions together at the end.
- **Recommend, don't survey.** Every choice gets one recommendation and a one-line why. Pick what a senior engineer who will own this codebase for years would pick: correct, secure, maintainable, honest about what is and isn't done, even when it's more work. Never pick an option because it's easier for you. If the right option doesn't fit the deadline, say so and name what gets deferred.
- **Trunk-based git, no PRs.** Commit to `main` after each verified milestone and push once the repo's local gate passes; never bypass hooks. No feature branches or PRs unless Cisco asks. Two sessions in one repo at once: each works on a short-lived worktree branch, rebases on `main`, fast-forward merges it locally, pushes `main` and deletes the branch. Finish any existing feature branch the same way instead of opening a PR.
- **A review replaces the PR.** For money, rewards, auth, RLS, wallet, security or migration changes, get a fresh-session review of `git diff <arc-start>..HEAD` from the other model family (Codex `/review` if Claude built it, Claude `/code-review` if Codex did) before pushing. Fix findings test-first and record the verdict in the handoff.
- **Report once, at the end:** commits shipped (SHAs), checks run with results, anything parked and why, and each open question with your recommendation. No status pings between steps.
<!-- ORGANIC-SYNC:WORKING-AGREEMENT:END -->

## Hackathon visibility

Hyphae is a public Colosseum Crypto World's Fair hackathon project. Make daily progress easy to inspect on GitHub without overstating it.

- On each active hackathon day, create at least one small, coherent conventional commit after a verifiable milestone. Do not manufacture commits, and identify WIP or review-blocked work plainly.
- In `docs/BUILDLOG.md`, add a same-day, public-safe entry with: what changed, a decision and why, validation numbers, commit SHA(s), and the next bounded action. Say whether the work is local-only or pushed.
- Refresh `docs/HANDOFF.md` whenever the working state, risks, validation, or next action changes. Add a dated `docs/handoffs/` snapshot for durable reviews, approvals, or checkpoints.
- Before ending an active hackathon day, push the documented commits to the configured GitHub remote and verify `git status -sb`. If that cannot happen, document why and the precise pending commit IDs in both the build log and handoff.
- Keep commits truthful and focused. Prefer implementation-plus-tests together; use separate commits for review findings and process/documentation when that gives judges a clearer history. Never commit credentials, private-vault content, or unrelated workspace changes.

## Repository safety

Read `CLAUDE.md` and `docs/HANDOFF.md` before planning or implementing. This is a public repository: keep private strategy in the vault and respect the Organic boundary described in `CLAUDE.md`.
