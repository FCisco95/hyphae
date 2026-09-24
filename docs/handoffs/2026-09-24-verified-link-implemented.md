---
date: 2026-09-24
summary: Verified wallet linking built test-first from the 2026-09-24 plan (D1–D6 as decided). /link hands out a private single-use link; a page on the api origin has the wallet sign a readable message; @organichub/verify 0.1.0 checks it; one Postgres transaction consumes the proof and the session and writes the member wallet plus append-only history. Migration 0008 generated, not applied. Locally tested, not deployed.
---

# 2026-09-24 — verified wallet linking (local)

## Authority

- Plan: `docs/handoffs/2026-09-24-verified-link-sdk-plan.md`. Cisco decided D1–D6 as recommended (2026-09-24). D6's two conditions: R5 merged (landed on `main` at `a4d8cd7` this session) and an explicit yes (the session prompt: "start the verified-link build from the plan … finish it the same trunk way").
- Working agreement (`AGENTS.md`): trunk-based, a cross-model review replaces the PR.
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`, as reported by the session environment), Windows, 2026-09-24. Effort is not observable in-session.

## What changed

| Piece | Change |
|---|---|
| Dependency | `"@organichub/verify": "0.1.0"` exact; `npm audit signatures`: registry signatures verified, SLSA provenance attestation present. `@wallet-standard/app` 1.1.1 exact (dev, bundled into the page only). |
| Env | `LINK_ORIGIN` (bare `https:` origin, required), `LINK_CHAIN` (`solana:mainnet` default, D5). `assertProofConfig()` fails the api at boot on a config the SDK would reject. |
| Migration 0008 | `link_sessions` (token digest only, 15 min), `wallet_proof_requests` (SDK snapshot; `expires_at = issued_at + 5 min` check), `member_wallet_links` (one open row per member; a `signature` row must name its proof; `valid_to > valid_from`). Backfill: every existing member gets its pasted wallet as an open row. |
| `link/wallet-links.ts` | `walletAt(db, memberId, at)`, the only wallet read a payout may use (D3); `applyVerifiedWallet` inside the proof transaction (D2: no takeover). |
| `link/session.ts` | `openLinkSession`, `resolveLinkSession` (open, unexpired), `findLinkSession` (any), `digestToken`. |
| `link/store.ts` | `createLinkStore(db, ctx)`: the SDK `VerificationStore` bound to one link session. `verifySignature` locks session, request and member, writes the wallet and history, consumes proof and session, all judged by `clock_timestamp()` after the waits; `wallet_taken` via the pre-check or the unique index (SQLSTATE read through Drizzle's error `cause`). |
| `link/routes.ts` | `GET /link`, `GET /link/app.js` (strict CSP), `POST /link/request`, `/link/verify`, `/link/status`. Strict bodies, 4 KB limit, `no-store`, `no-referrer`; fixed codes only. |
| `link/page/` | Static page + client bundle (`tsup.page.config.ts`, own DOM tsconfig). Uses only `standard:connect` and `solana:signMessage`; refuses altered signed bytes; reconciles through `/status`. |
| Bot | Group `/link` → `t.me` deep link only. Private `/start link_<community>` → membership check (`getChatMember`) → session URL. `/link <address>` is gone (D1). `/me` marks pasted wallets "not verified … needed before any payout". |

## Deviations from the plan, and why

1. Postgres error codes: the plan read `err.code`; Drizzle 0.45 wraps driver errors, so `sqlState()` walks `cause`. Without it the concurrent `wallet_taken` race surfaced as 503 (a mutation that disables the branch fails the race test).
2. `/link` routing: `bot.chatType(...).command(...)` does not typecheck under `exactOptionalPropertyTypes`; one `/link` handler branches on `ctx.chat.type`.
3. `build:page` copies `index.html` with `node -e` instead of `cp`, which pnpm cannot run on Windows.
4. The pg suites share one database, so `vitest.pg.config.ts` runs files one at a time, and the link race file seeds communities with random ids.
5. PGlite hook timeout raised to 30 s (29 files migrate PGlite in parallel; two hooks passed 10 s on a full run).
6. Added: an index on `member_wallet_links (member_id, valid_from)` for `walletAt`; a backfill test that migrates to 0007, seeds a pasted member, then applies 0008.

## Consumer guide §7 acceptance matrix

Guide: `FCisco95/mycel-sentinel` `docs/guides/hyphae-verify-sdk-consumer.md` §7. PGlite tests run the real SDK against the real store; "pg" means Postgres 17 in Docker.

| §7 bullet | Test |
|---|---|
| Body-supplied community/user/origin/chain cannot override the session | `routes.test.ts` "rejects identity fields in the body (strict schema)"; the store takes identity only from `LinkContext` |
| Request for one Telegram user cannot be consumed by another | `store.test.ts` "a request made in one member's link session cannot be consumed through another's" |
| Request/session from one community absent in another | `store.test.ts` "a request from another community is absent, not forbidden" |
| Wrong origin/chain, wallet, request, nonce, message or signature: no mutation | `store.test.ts` "another origin or chain", "signature from another key", "snapshot field that differs"; `routes.test.ts` "a rewritten message", "non-base58 wallet" |
| Expired, used, unknown, wrong-user sessions refused | `session.test.ts` "refuses malformed, unknown, used and expired tokens"; `store.test.ts` "expired before signing"; `routes.test.ts` "unknown or used token is link_expired" |
| Issuance and precheck time from the database; lifetime exactly 5 min | `databaseNow()` reads `clock_timestamp()`; DB check `wallet_proof_lifetime`; `session.test.ts` "expires 15 minutes after it opens" |
| Six concurrent valid submissions: exactly one link | pg "six concurrent submissions of one valid proof commit exactly one link" (20 rounds) |
| Replay of the winner fails without changes | `store.test.ts` "rejects a replay of the winning proof" |
| Expiry during lock waits fails after acquisition | pg "a proof that expires while waiting for the session lock loses" |
| Mutated snapshot field: zero-row update | `store.test.ts` "a snapshot field that differs from the stored request links nothing" |
| Forced member/uniqueness/session/commit-abort failures leave proof pending, session open | `store.test.ts` "refuses a wallet another member holds", "expired before signing"; `routes.test.ts` "lost acknowledgement before commit" |
| Lost commit acknowledgement, committed and aborted | `routes.test.ts` "lost commit acknowledgement after commit", "lost acknowledgement before commit" |
| Different valid proofs in one session, and competing member-wallet links | pg "two different valid proofs in one session: exactly one links", "two members racing for one wallet" (20 rounds each) |
| Zero-row conditional update cannot be followed by member linking | Same transaction: the member write rolls back with it; "snapshot field that differs" asserts no member |
| Fixed public messages and codes for SDK, validation and store errors | `routes.test.ts` asserts exact bodies for `proof_rejected`, `wallet_taken`, `link_expired`, `link_unavailable` |
| No secret in responses or logs | By construction: `fail()` logs `{ link: op, code }` only; responses are fixed codes or `{ requestId, nonce, message }` to the session holder. No automated log-capture test. |
| Retry after a rolled-back failure sees no partly used proof or session | `routes.test.ts` "lost acknowledgement before commit … the session still works" |
| Hold gate | Out of scope (separate plan, guide §6) |

## Review (cross-model, replaces the PR)

Codex adversarial review of `main...feat/verified-link-sdk` at `9358c0e`, focused on the plan's Review Focus and the points above. Verdict: **needs-attention**, one medium finding.

| # | Finding | Disposition |
|---|---|---|
| L1 | Medium (`page/client.ts`): if `/verify` commits but the network drops, `fetch` rejects and the page says "Link failed" without asking `/status`, so a linked member is told to start again. | **Fixed** test-first in `3e00174`: `verifyAndReconcile()` (pure, 5 tests, watched failing) treats a dropped `/verify` like `link_unavailable`, asks `/status`, never resends the proof. |

It raised nothing on sessions, the store transaction, D2, the migration or the bot flow. The acceptance tests in `0f6c464` and the fix in `3e00174` came after the reviewed commit; the fix is the finding's own recommendation.

## Evidence (fresh, on `3e00174`)

- `pnpm -r test` exit 0: core 54; api 252 (213 before this build; new: proof config 2, wallet history + backfill 3, sessions 3, store 11, routes 9, page 1, page flow 5, bot link 3, `/me` wallet lines 2).
- `pnpm -r typecheck` exit 0 (api and the page's DOM config) · `pnpm exec biome check .` exit 0 (134 files) · `drizzle-kit check` exit 0 · `git diff --check` exit 0.
- `test:pg` on Postgres 17: 11/11 exit 0 (7 reward, 4 link races at 20 rounds each).
- Mutation probes, each killed: backfill INSERT removed; unique-violation branch disabled; session expiry check removed; session single-use check removed.
- `pnpm --filter @hyphae/api build` exit 0; `dist/public/app.js` references only `standard:connect` and `solana:signMessage` as wallet features (`standard:app`/`standard:register` are the registry's discovery events).
- Test-first notes, stated plainly: the backfill test and the four §7 acceptance tests in `0f6c464` were written after the code they cover, so each was confirmed by the mutation listed above instead of a red run. Everything else was watched failing first.
- 0 migrations applied, deployments, secrets set, package publishes or mainnet transactions.

## Payout rule for R6 and settlement

Resolve every recipient with `walletAt(memberId, epoch.closesAt)` and require `method = 'signature'`. A pasted wallet is never payable. A relink applies only to epochs closing after it commits.

## Documented behavior (Review Focus 5)

Membership is checked when the session opens, not when the member signs. A member who leaves the group within those 15 minutes can still finish linking; the session then expires or is used. Accepted.

## Not done here

- Manual check with real wallets (plan Task 8 step 3): needs Cisco, a test bot token, a test group and an HTTPS tunnel. Not run.
- Hold gate (`checkHold`, guide §6): its own plan.
- Neon apply of 0008 (with 0006 and 0007), deploy, `LINK_ORIGIN` in Fly secrets (required at boot: the new image will not start without it), BotFather menu text: each under separate authorization.
