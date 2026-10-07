---
date: 2026-10-07
summary: Session B (Jev production plumbing) handoff. Branch FCisco95/jev-plumbing, 6 local commits on 18325c6, nothing pushed or deployed. The code can pin and call a Jev scorer, and epoch 2 can be amended a second time, but it is inert until Session A registers the v4 question set and Cisco gives the exact yes. Read the "When to use this" table before touching scoring, amendments, migration 0017 or the Jev release.
---

# Handoff: Jev production plumbing (Session B), 2026-10-07 evening

Written by Claude Sonnet 5.5 (`claude-sonnet-5-5`, effort high) on the Windows PC. Branch `FCisco95/jev-plumbing`, worktree `~/orca/workspaces/hyphae/jev-plumbing`, off `origin/main` at `18325c6`. Nothing is pushed. Nothing is deployed.

## TL;DR

Cisco ruled that **Jev (`jev-1.13.0`) replaces the Anthropic scorer for epoch 2**, live, deployed before **2026-10-08T12:00Z**. Session B built the production path behind `JEV_SCORING=off` (default), drafted the release plan, and rehearsed migration 0017. The questions and their composition are Session A's (`feat/jev-reward`, worktree `hyphae-jev-reward`).

**Do next:** when Session A reports the v4 set, merge both branches, add the registry entry (code is in the map, section 4), run the whole gate, get the Codex review to ACCEPT, then follow the release plan on Cisco's exact yes.

## When to use this (read the row that matches your task)

| If you are about to… | Read first | Why |
|---|---|---|
| Write or tune the Jev questions, the composition or the holdout | session prompt `docs/handoffs/2026-10-07-jev-live-session-prompt.md` (on local `main`, unpushed, not in this branch) Session A, then the map's section 4 | A owns `jev.ts`, `jev-questions.ts`, `docs/evals/**`, `eval-reward-jev.ts`. B did not touch them. The registry entry and the SDK `dependencies` rule are the hand-over. |
| Merge `feat/jev-reward` with `jev-plumbing`, or wire v4 into the live path | [map](2026-10-07-jev-plumbing-map.md) sections 2 and 4 | Registry entry shape, deterministic-JSON requirement, `@typesafe-ai/sdk` must stay in `dependencies` (image installs `--prod`). Both branches edit `apps/api/package.json` and `pnpm-lock.yaml`. |
| Change `rewards/evaluation.ts`, `rewards/amendment.ts`, `scoring/scorers.ts`, `jev-client.ts` or the read API's amendment fields | [map](2026-10-07-jev-plumbing-map.md) sections 1 to 3 | A dispatch is committed before the call; a Jev version is pinned like a prompt version; amendments chain; effort stays on Anthropic. |
| Release Jev, set secrets, record the second amendment, or roll back | [release plan](../demo/2026-10-07-jev-live-release-plan.md) | Step order, rollback table, baseline fingerprint, Needs Cisco. Not executed. |
| Change the audit manifest, `commitments.ts` or publication | The map's section 3 | The manifest schema now checks an amendment chain; one amendment commits the same bytes as before. |
| Run or edit `scripts/rollout/db.mjs` | The release plan, Step 2 | It now pins migration 0017 (SQL SHA-256 `d630d663…`). Earlier releases' pins are in git history. |
| Decide anything about the Sonnet 5.5 or Haiku scorers | [`docs/HANDOFF.md`](../HANDOFF.md) and the session prompt | Both missed 6 of 84 on the reward cases and were not adopted. Local commit `1a85dc0` on `main` (5.5 default) is unpushed and should be dropped or reverted. |
| Anything else in Hyphae | [`docs/HANDOFF.md`](../HANDOFF.md) | That file wins; this one covers only the Jev arc. |

## State

| Item | Value |
|---|---|
| Commits | `fadf80c` Jev scorer path, `772caea` chained amendments + migration 0017, `8d12d2a` `db.mjs` for 0017, `b672657` `jev-ping.ts`, `039f94d` way back from Jev, `6f8b1ec` docs |
| Gate | `pnpm lint` 0, `pnpm typecheck` 0, `pnpm test` 0 (API 905 passed, 3 skipped), `drizzle-kit check` fine, `test:pg` 74 of 74 on the final run |
| Known intermittents | The member-journey and raid-alert Postgres tests (documented in the pilot amendment release record), and `src/link/page-handoff.test.ts` under load (passes alone) |
| Migration 0017 | `reward_config_amendments_epoch (epoch_id)` replaced by `…_epoch_from (epoch_id, from_config_id)`; rehearsed on a disposable `postgres:17`; production untouched |
| Production | Unchanged: API and worker on `amend-b265204`, Neon at `0016`, epoch 2 on `reward-eval/2` from 18:00Z |
| Registry | `apps/api/src/scoring/jev-registry.ts` is empty on purpose |

## Decisions and why (so nobody re-litigates them)

- **Epoch 2 now, not epoch 3** (Cisco's ruling). Recommended against: it adds a production migration and a second scorer change in the epoch that pays first. It is why amendments now chain.
- **Jev pinned as a version**, not a new config field: the amendment record, manifest and public pages need no new column.
- **Jev answers quality only**; effort nominations stay on `reward-eval/2` with the Anthropic model.
- **No retries, 30 s timeout, logging off** in the client: a retry after a possibly executed request could bill twice; the SDK's debug log would print member text.
- **One way back** (Jev to `reward-eval/2`), never to the epoch's own `reward-eval/1`. Contributions admitted under Jev stay pinned and need `JEV_SCORING=on`.

## Not verified

- Any live Jev call (no key was used), the Docker image build, the Anthropic path against production data.
- That Session A's `runJev` plugs into `JevScorerDef` as written in the map: the snippet was written against A's committed `jev.ts` and has not been compiled here.
- The public wording ("prompt" vs "scorer version") on the epoch page and security page.

## Needs Cisco (one at a time)

1. Label the holdout when Session A sends it.
2. The public sentence for what Jev is, and the reason recorded with the amendment.
3. The exact yes (proposed: "yes, run the Jev live scorer release"), only after the Codex review is ACCEPT.
4. `! git push origin main`, then one `fly secrets set` line for `TYPESAFE_API_KEY` and `JEV_SCORING=on`, each after the previous check passes.
5. If Jev or the review is not ready by about 2026-10-08T08:00Z: say so, keep epoch 2 on `reward-eval/2`, deploy nothing (the code is inert while off). No deploy after 12:00Z; no push or deploy from 2026-10-08T22:00Z to 2026-10-10T00:00Z.

## Suggested skills for the next session

- `superpowers:test-driven-development` for any change to the path.
- `handoff-memory:handoff-memory` to reload this arc.
- `superpowers:verification-before-completion` before claiming the gate or the release checks.
- `code-review:code-review` / Codex `/review` (Claude built this, so Codex reviews) for the money-bearing diff `18325c6..HEAD`.
- `superpowers:using-git-worktrees` and `parallel-feature-development` before merging A and B (shared files: `apps/api/package.json`, `pnpm-lock.yaml`).
