---
date: 2026-09-24
summary: Read API v1 and the audit site built test-first on Cisco's H-CONTRACT Part A ruling. Five lock-free GET routes under /v1 serve a seeded community end to end on real Postgres; the Next.js 16 site renders every contribution state, never shows allocation as paid, and never shows an unverified wallet or any Telegram data. A data-exposure test and a Codex review cover the stop rule. Not deployed.
---

# 2026-09-24 — audit page and read API v1 (local)

## Authority

- Part A ruled yes, all fifteen lines, handle `admin:cisco` (`2026-09-24-contract-and-payment-rulings.md`: "I like all your recommendations."). Ruling 1 of `2026-09-24-founder-rulings.md`: the audit-page build starts on the Part A ruling.
- Plan: `2026-09-25-audit-page-plan.md` (Tasks 1–15).
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`), effort xhigh, Windows.

## What was built

| Piece | Where |
|---|---|
| `exactPoints`, `creditRule` (checked against R1 on every raw × flag × AI-pattern input) | `packages/core/src/read-api.ts` |
| Strict and loose zod schemas for the five responses | same file |
| Demo seed through the real reward functions (every snapshot state, an upgrade, a late correction, a signed and a pasted wallet) | `apps/api/src/http/demo-seed.ts` |
| Lock-free read service (repeatable-read, read-only transactions; named columns only; microsecond timestamps from Postgres) | `apps/api/src/http/read-service.ts` |
| Routes under `/v1`, mounted in `server.ts` | `apps/api/src/http/routes.ts` |
| Data-exposure test (the arc's stop rule) | `apps/api/src/http/exposure.test.ts` |
| `/me` in a private chat points to the group; `/me` links `/c/<mint>` instead of `/w/<wallet>` | `apps/api/src/bot/commands/me.ts` |
| Audit site: `/c/[mint]`, `/c/[mint]/e/[index]`, `…/leaderboard`, `/contribution/[id]` | `apps/web` (Next.js 16.3.6, React 19.3, server components only) |
| Tester checklist for the deployed bot, public-audit notice; whitepaper status after the cutover | `docs/TESTING.md`, `docs/WHITEPAPER.md` |

## Deviations from the plan and the proposal, and why

1. **Epoch status `scheduled`.** An epoch is materialized before it opens (MYCEL epoch 1 existed a day before 2026-09-25). The ruled enum `open | closing | closed` had no honest value for it. Added before v1 is live, so no consumer breaks.
2. **Leaderboard `pending`** counts only entries still without a decision (state `pending`). It is 0 once an epoch is final; `contributions − counted − pending` are the entries that closed uncounted.
3. **`/me` links the community page** (`/c/<mint>`), not the epoch page: it is valid even before the first epoch opens.
4. **The site maps an API 400 to "not found"**: for a visitor, a malformed URL leads nowhere; it is not an outage.
5. **`apps/web` uses `moduleResolution: nodenext`** so Turbopack resolves `@hyphae/core`'s `.js` import specifiers to its TypeScript source (Turbopack enables that only under nodenext). Relative imports carry `.js`, as elsewhere in the repo.
6. **"Data as of …" on every page with a read time.** Next's fetch cache keeps serving the last good response when a refresh fails, so a page can be stale during an API outage. The read time makes its age visible. An uncached page with the API down shows "The audit API is unavailable right now. Nothing on this page is a zero."
7. **The plan's `docs/plans/` path** became `docs/handoffs/2026-09-25-audit-page-plan.md` (gitignored folder).
8. **The correction script's `--actor admin:<handle>` flag** is not built: `apps/api/scripts` was outside this arc's writable paths. The read side maps `script:reward-correct` to authority `operator_script` and `admin:*` to `community_admin`.

## Evidence

- Gate on `95d64e1`: `pnpm -r test` exit 0 three runs in a row (core 67, web 14, api 299); `pnpm -r typecheck` exit 0; Biome on tracked files exit 0 (168 files); `drizzle-kit check` exit 0; `test:pg` 11/11; `next build` exit 0; `git diff --check` exit 0. One flaky assertion was found on the way (two admissions at the same instant ordered by random id) and fixed in the test (`95d64e1`).
- The end-to-end run was repeated on the final api and site builds after the review fixes: 10/10, plus the "Data as of" line.
- Mutation probes, each killed: serving any linked wallet regardless of method (read-service tests 2 failures; exposure test fails on the pasted wallet); treating every snapshot entry as counted (6 failures); spreading raw dispatch input and output into the model provenance (exposure test fails on the `input`/`output` keys).
- Lock-freedom: a query-log test runs all five reads and finds no `FOR UPDATE/SHARE/NO KEY UPDATE/KEY SHARE`.
- **End to end, local only:** Postgres 17 in Docker, migrations 0000–0008, the demo seed through the real reward functions, the built api (`node dist/server.js`, postgres-js driver, database clock) and the built site (`next start`). Ten page checks passed: home redirect, final epoch (every state sentence, the settlement panel, the unverified marker, "255 (3×)"), open epoch (provisional banner), both leaderboards, three contribution pages (superseded/selected lineage with effort criteria and model provenance; the late `admin:cisco` correction; pending at close), and two 404s. No page contained the pasted wallet, a Telegram id or username, or the words "paid"/"claimed". With the api stopped, an uncached page showed the unavailable state.
- Test-first, stated plainly: the core helper, schema, route, API-client, freshness and `/me` tests were watched failing first. The demo-seed, read-service and view tests were written before their code but first run after it (the modules did not exist yet), so the mutation probes above stand in for a red run.

## Review (cross-model, before push)

Codex (`codex-cli` 0.155.1 via the companion, `task --fresh --effort high`, diff passed as a prompt file because its sandbox cannot read the workspace), over `201419e..HEAD` for `apps/api/src/http`, `read-api.ts`, `server.ts`, `/me` and the site's data paths, focused on A5–A8 exposure, A12 locks and cost, A9–A11 correctness, and failures rendered as numbers.

**Verdict: needs-attention**, two medium findings. It found no path from private data or unpublished model output to a response or a log line, and no failure rendered as a number.

| # | Finding | Disposition |
|---|---|---|
| C1 | Medium: the contributions list loaded every intake of the epoch and sliced in memory; the contribution read built the whole epoch to find one row. | **Fixed** in `51241ca`: the list counts and pages in SQL and computes states for the page only; the contribution read computes one row's state (the earlier `0641702` already made ranking linear). Epoch counts and the leaderboard still read the whole epoch, because they are aggregates of it. |
| C2 | Medium: past `closes_at` with no snapshot yet, rows read `pending` instead of what the close will freeze. | **Fixed** test-first in `51241ca`: states mirror `close.ts` (an unresolved model call → `pending_reconciliation`, then a late-only decision → `excluded`, else `pending_at_close`). Two tests, both watched failing on the old code. |

**Follow-up review** of `0641702^..51241ca`: **VERDICT: ship**, no findings. Both findings resolved; the state logic matches the close rule for open, closing and final epochs; ties share a rank across pages; no new exposure, lock or cost issue.

Accepted, not changed: a public caller can still make the api do work proportional to one epoch (counts, leaderboard) per request. The site reaches the api through Next's 15-second fetch cache; direct callers are not rate-limited. Add a rate limit or an edge cache if the api URL is published beyond the site.

## Not done

- Deploy: `fly deploy` of `main` (adds `/v1`), and a Vercel project for `apps/web` with `HYPHAE_API_URL=https://hyphae-api.fly.dev` and `DEFAULT_MINT=<MYCEL mint>`; `PUBLIC_WEB_URL` on Fly must then be the site's URL (default `https://hyphae.fun`, which does not resolve today). Each is a hard stop for Cisco.
- Organic's adapter changes (downstream section of the H-CONTRACT proposal).
