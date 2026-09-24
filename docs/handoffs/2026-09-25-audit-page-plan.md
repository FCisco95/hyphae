---
date: 2026-09-25
summary: Build plan for the public audit page and read API v1, to run once Cisco rules H-CONTRACT Part A. The api gains five lock-free GET routes under /v1 (apps/api/src/http) backed by R4 reads and R5 snapshots, with shared zod schemas in packages/core. The new apps/web is a Next.js 16 App Router site of server components only, with four pages (community, epoch, leaderboard, contribution). Empty and unavailable states never show allocation as paid or a failure as zero. Fifteen test-first tasks, a data-exposure test and a Codex review, ending with a locally seeded epoch that renders end to end.
---

# Audit page and read API v1 — build plan

**Starts only when `docs/handoffs/` records Cisco's Part A ruling** (`2026-09-25-h-contract-proposal.md`, lines A1–A15). If a line is ruled "no", change the tasks it touches before starting. This file is tracked, not in `docs/plans/`, because `docs/plans/` is gitignored and a worker on another machine must be able to read it.

**Goal:** a reader can open the MYCEL epoch page and see every contribution, its raw and credited quality, why they differ, its exact points, which revision counted, and the member totals, with no Telegram data, no unverified wallet and nothing presented as paid.

**Architecture:** the api owns the data and the privacy boundary: a read service in `apps/api/src/http/read-service.ts`, Hono routes in `apps/api/src/http/routes.ts`, mounted at `/v1` in `server.ts`. `packages/core/src/read-api.ts` holds the zod schemas for all five responses; the api tests its output against them and `apps/web` parses with them. `apps/web` fetches server-side, parses, and renders HTML. No client JavaScript, no database access, no secrets.

## Stack recommendation for `apps/web`

**Next.js 16 (App Router), React 19, server components only, deployed on Vercel.** Why: it is the stack `CLAUDE.md` already decided for `apps/web`, Vercel runs it with no configuration, and server-rendered pages with `fetch(…, { next: { revalidate: 15 } })` give fast, cacheable, script-free audit pages. Styling: one plain CSS file with custom properties and a dark-mode media query. No Tailwind or component library for four pages. Tests: Vitest; components are rendered with `react-dom/server`'s `renderToStaticMarkup`, with no extra testing library. Pull the current Next.js 16 docs (Context7) before Task 10: route params are async in 16 (`params: Promise<…>`).

Versions checked 2026-09-24: `next` 16.3.6, `react` 19.3.0.

## Files

| File | Role |
|---|---|
| `packages/core/src/read-api.ts` (+ test) | Zod schemas and types for the five responses; `creditRule()`; `exactPoints()` (moved from `me-summary.ts`'s `formatPointUnits`) |
| `packages/core/src/index.ts` | Export `read-api.js` |
| `apps/api/src/http/read-service.ts` (+ test) | Lock-free reads returning schema-shaped objects |
| `apps/api/src/http/routes.ts` (+ test) | Hono `/v1` routes: params, status codes, headers |
| `apps/api/src/http/exposure.test.ts` | Walks every route's JSON for forbidden values |
| `apps/api/src/http/demo-seed.ts` | Seeds one community and a closed plus an open epoch with every state; used by tests and the local end-to-end run |
| `apps/api/src/server.ts` | `app.route("/v1", readRoutes({ db }))` |
| `apps/api/src/bot/commands/me.ts` | `/me` links the epoch page instead of `/w/<wallet>` (which could print a pasted wallet) |
| `apps/web/**` | New Next.js app |
| `docs/TESTING.md`, `docs/WHITEPAPER.md` | Public-audit notice (A6); "recorded; hashes public" (A8) |
| `apps/api/scripts/reward-correct-args.ts` (+ test) | A14's required `--actor admin:<handle>`. Outside the Sep 25 arc's writable paths, so it needs its own yes or a later session; the read side already handles both actor forms. |

## Tasks

Each task: write the failing test, run it and watch it fail for the stated reason, write the minimum code, run it green, commit. Commands run from the repo root.

### Task 1 — `exactPoints` and `creditRule` in core

- Test (`packages/core/src/read-api.test.ts`): `exactPoints(12_750_000_000n) === "127.5"`, `exactPoints(2_400_000n) === "0.024"`, `exactPoints(0n) === "0"`. `creditRule` over the R1 table: `(84, ["off_topic"], 0) → "hard_zero"`; `(95, ["ai_slop"], 79) → "ai_cap_mild"`; `(95, ["ai_slop"], 0) → "ai_cap_strong"`; `(59, [], 0) → "below_floor"`; `(85, [], 85) → "none"`; `(70, ["ai_slop"], 70) → "none"`. Plus a property check: for every raw 0–100 × flag subset × pattern count 0–3 × template rhythm, `creditRule(raw, flags, creditedQuality(...))` is consistent with the cap that R1 applied.
- Code: `exactPoints` (move `formatPointUnits`; `me-summary.ts` imports it). `creditRule(raw, flags, credited)`.
- Run: `pnpm --filter @hyphae/core test`.
- Commit: `feat(core): exact points string and credit rule for the read API`.

### Task 2 — response schemas

- Test: each schema accepts the Part A example document and rejects: a number in `point_units`, a millisecond timestamp, a `wallet` with `wallet_status: "unverified"`, a key containing `telegram`, a `selected` on a non-`counted` row, `status: "unavailable"` without `reason`.
- Code: `CommunityV1`, `EpochV1`, `ContributionRowV1`, `ContributionV1`, `LeaderboardV1`, `ErrorV1` with `.strict()` objects (unknown keys rejected in tests; `apps/web` parses with `.passthrough()` equivalents so additive fields don't break it). Timestamp regex `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$`.
- Commit: `feat(core): read API v1 response schemas`.

### Task 3 — demo seed

- Test (`demo-seed.test.ts`): after `seedAuditDemo(db)`, epoch 1 is closed with a snapshot containing one `counted` (upgrade 85 → 255, revisions 1 superseded and 2 selected), one `counted` at raw 84 / credited 0 (`off_topic`), one `pending_at_close`, one `pending_reconciliation`, one `excluded` (a late decision) and a late correction; epoch 2 is open with one `counted`, one `pending`. Two members: one signed wallet, one pasted.
- Code: built only from the real reward functions (`admitContribution`, `nominate`, `runEvaluation`, `beginDispatch`, `completeDispatch`, `markReconciliation`, `appendCorrection`, `closeEpoch`) with injected clocks and a fake model, as `close.test.ts` does. Never raw inserts into reward tables.
- Commit: `test(http): seed an audit demo from the real reward functions`.

### Task 4 — community read

- Test: `readCommunity(db, mint, now)` returns name, `reward_intake`, `current_epoch` (index whose window contains `now`, else `null`), epochs newest first; unknown mint → `null`; legacy (unpinned) epochs are absent. Output passes `CommunityV1`.
- Code: two queries; timestamps selected as text (`to_char(ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`) via a shared `isoUs(column)` helper.
- Commit: `feat(http): community read`.

### Task 5 — epoch read

- Test: open epoch → `status: "open"`, `final: false`, counts from `selectEffective`; epoch past `closes_at` without snapshot → `"closing"`, `late` counted as `excluded`; closed epoch → `"closed"`, `final: true`, counts from snapshot reasons; `allocation` and `payment` always `{status: "unavailable", reason: "no_settlement"}`; `config.payload` equals the stored payload byte for byte after `JSON.stringify`. Passes `EpochV1`.
- Code: read-only transaction, **no community lock** (A12). Assert with a spy that no `FOR SHARE`/`FOR UPDATE` query runs.
- Commit: `feat(http): epoch read`.

### Task 6 — wallet exposure rule

- Test: `publicWallet(db, memberId, asOf)` → `{wallet, wallet_status: "verified"}` only when the link valid at `asOf` is `signature`; pasted → `{wallet: null, wallet_status: "unverified"}`; no link → `none`. A member who signed after `closes_at` shows `unverified` on the closed epoch and `verified` on the open one.
- Code: wraps `walletAt`.
- Commit: `feat(http): wallets only when signed at the relevant time`.

### Task 7 — contributions list

- Test: rows in intake order; `member` filter; `offset`/`limit` bounds; `total_contributions`; each state from Task 3 appears with its `selected` (or `null`); the 84 → 0 row has `credit_rule: "hard_zero"`; no row has `whole_points`. Passes `ContributionRowV1`.
- Commit: `feat(http): epoch contributions read`.

### Task 8 — leaderboard

- Test: final epoch reads `reward_snapshot_members`; open epoch reads R4 totals; order by units desc then member id; tied members share a rank; zero-point members included; `total_entries` = members; `whole_points` equals `wholePoints(units)`.
- Commit: `feat(http): leaderboard read`.

### Task 9 — contribution detail

- Test: revisions carry `selected`/`superseded`/`late` by the O6 rule; the closed epoch's selected revision id equals the snapshot's (mismatch → throws `snapshot_mismatch`); model provenance has hashes, latency and cost but no `input`/`output`; correction revisions show actor, authority (`script:reward-correct` → `operator_script`, `admin:*` → `community_admin`), reason and evidence; a contribution without a reward intake → `null`; `reentry_of`/`reentered_as` link both ways.
- Commit: `feat(http): contribution audit read`.

### Task 10 — routes and status codes

- Test (Hono `app.request`, as in `link/routes.test.ts`): 200 bodies pass the schemas; unknown mint, index, id → 404 `{"error":"not_found"}`; non-integer index, missing `epoch`, `limit` 0 or 101, non-UUID id → 400; a read service that throws → 503 `{"error":"unavailable"}` and the log line carries no request body; `Cache-Control` is `max-age=15` when not final and `max-age=300` when final; `Access-Control-Allow-Origin: *`; POST → 404/405.
- Code: `readRoutes({ db, clock? })`; mount in `server.ts`.
- Commit: `feat(http): mount read API v1`.

### Task 11 — data-exposure test (the stop rule, as a test)

- Test (`exposure.test.ts`): seed the demo with recognisable values (Telegram user id `987654321987`, username `tg_secret_user`, pasted wallet `PastedWallet111…`, idempotency key text, a dispatch still `dispatched` whose output contains `UNPUBLISHED_OUTPUT`), call every route over every id it can reach, and assert that none of those strings, no key matching `/telegram|chat|message_id|idempotency|nonce|session|proof/i`, and no `input`/`output` key appears anywhere in any body.
- It must fail if Task 9 is temporarily changed to spread the dispatch row. Check that once, then restore.
- Commit: `test(http): no private identifier or unpublished output leaves the read API`.

### Task 12 — `/me` link

- Test (bot): `/me` prints `${PUBLIC_WEB_URL}/c/<mint>/e/<index>` and never `/w/<wallet>`.
- Commit: `fix(bot): /me links the epoch audit page, not a wallet URL`.

### Task 13 — `apps/web` scaffold

- `apps/web/package.json` (`next` 16, `react` 19, `react-dom` 19, `@hyphae/core` workspace, `zod`, dev `vitest`, `typescript`), `tsconfig.json`, `next.config.ts` (`transpilePackages: ["@hyphae/core"]`), `app/layout.tsx`, `app/globals.css`, scripts `dev`, `build`, `start`, `test`, `typecheck`. Env: `HYPHAE_API_URL` (server-only, required at build and request).
- Test: `lib/api.test.ts`: `getJson` returns `{ok: true, data}` on a schema-valid 200; `{ok: false, reason: "not_found"}` on 404; `{ok: false, reason: "unavailable"}` on 5xx, timeout (3 s), network error or schema mismatch. Never a default object.
- Commit: `feat(web): scaffold the audit site and its API client`.

### Task 14 — pages

Each page has a test that renders it with `renderToStaticMarkup` against fixture responses and checks the text below.

| Route | Shows | Empty and unavailable states |
|---|---|---|
| `/` | Redirect to `/c/<DEFAULT_MINT>` | — |
| `/c/[mint]` | Community name, intake status, epoch list with windows and status | No epochs: "No reward epoch yet." API down: "The audit API is unavailable right now. Nothing here is a zero." |
| `/c/[mint]/e/[index]` | Window, status badge (open / closing / closed and final), rubric version, multiplier, slot limit, counts, contributions table (member, wallet or "unverified", kind, raw → credited, rule, exact points, state), pagination | No contributions: "No contributions in this epoch yet." Settlement panel always: "Not allocated. No payout exists for this epoch." Closing: "Closed at … Final numbers appear when the snapshot is written (within minutes)." |
| `/c/[mint]/e/[index]/leaderboard` | Rank, member, wallet or "unverified", exact points, whole points, counted/pending | Open epoch banner: "Provisional: this epoch is still open." |
| `/contribution/[id]` | The audit row as a sentence ("Raw 84, credited 0: off-topic is a hard zero"), the captured work and its limitations, then each revision with status, source, numbers, explanation, provenance hashes, correction details | Pending: "Not scored yet." Pending at close: "Not scored before the epoch closed; it earns nothing in this epoch." Excluded: "Scored after the close; shown for the record, it earns nothing." |

Rules the tests enforce: the words "paid", "payout sent" and "claimed" never appear anywhere; a failed fetch never renders a number; `unverified` wallets never render an address; every timestamp shows in UTC.

- Commit per page: `feat(web): <page>`.

### Task 15 — end to end, docs, review

1. Local: Postgres in Docker (`scripts/test-pg.sh` pattern), migrate, `node --import tsx apps/api/src/http/demo-seed.ts` (the file runs the seed when executed directly), start the api, `HYPHAE_API_URL=http://localhost:8080 pnpm --filter @hyphae/web build && … start`, fetch every page and check each state's text is present. Record the output in the session record.
2. `docs/TESTING.md`: public-audit notice (A6), the audit page link. `docs/WHITEPAPER.md` §4: "recorded; hashes public" (A8), status row for the audit page.
3. Full gate: `pnpm -r test`, `pnpm -r typecheck`, Biome on tracked files, `drizzle-kit check`, `test:pg`, `git diff --check`.
4. **Codex review** of `git diff <arc-start>..HEAD -- apps/api/src/http packages/core/src/read-api.ts apps/api/src/server.ts`, focused on data exposure (A5–A8), lock-freedom (A12) and status codes (A11). Fix findings test-first; record the verdict.
5. Push. Deploying the api and `apps/web` is a separate hard stop (Cisco runs `fly deploy` and the Vercel project creation).

## Done when

A locally seeded epoch renders end to end on all four pages with every state, `exposure.test.ts` passes, the gate is green, and the Codex review verdict is recorded.
