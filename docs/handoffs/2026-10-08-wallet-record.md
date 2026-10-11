---
date: 2026-10-08
summary: Public wallet track record built on branch FCisco95/wallet-record (not pushed, not merged). GET /v1/wallets/:wallet/record, a /wallet/[wallet] page linked from the leaderboard and the claim page, migration 0018 (an index on member_wallet_links.wallet, approved by the coordinator), read client getWalletRecord. Release needs the migration before the API image, a Codex review, and Cisco's yes on the new strings.
---

# Wallet record, 2026-10-08

Roadmap item "After Oct 10 / Track record per wallet". Worker task `task_05fe46cdeb76`. Branch `FCisco95/wallet-record`, commits `5c54993` (API, schema, migration, client) and `8eafc99` (web) on top of `2380d59`. Nothing pushed, merged or deployed (hold until 2026-10-10T00:00Z).

## What works

- **`GET /v1/wallets/:wallet/record`** (paged by epoch: `offset`, `limit` 1 to 100, default 50). For every epoch, in any community, whose public reads show the wallet for a member:
  - Per epoch: community, index, window, status, member id; each contribution's id, kind, time, state, credited quality and exact points; counts (contributions, counted, credited), average credited quality, exact points.
  - Per epoch, the payout. `allocated`: the amount of this wallet's leaf in the recorded publication, with its payment read against the chain. The payment is `paid` only with the claim transaction the chain shows; otherwise `claimable`, or `unavailable` with a reason. Otherwise the payout is `unavailable` with one of `no_settlement`, `before_first_paid_epoch`, `no_allocation` or `no_stored_intent`.
  - Totals per community and overall, covering every epoch, not just the page.
  - Same cache header as the other public reads (`public, max-age=15`), same rate limit and error bodies.
- **Which epochs a wallet's record holds.** The member's signed link valid at the epoch's close, or now while the epoch is open. This is exactly the rule the public epoch, leaderboard and contribution reads use to show a wallet (`publicWallets`), and the rule the payout gate uses (`walletAt(closesAt)`). Every epoch in a record therefore shows the same wallet on its own epoch page. A relink never moves a closed epoch to the new wallet. A pasted (unsigned) wallet has no record.
- **Validation and 404.** The wallet must be base58 for exactly 32 bytes (`isAddress`), else 400. The existing wallet routes keep their looser check. A wallet with no such epoch is 404, including a wallet that is signed but has no contribution yet. So the route never reveals whether a wallet is linked to a member somewhere: the response for such a wallet is the same as for an unknown one.
- **Data minimization.** No Telegram id or username and no X handle. The contribution URL is left out on purpose: an X link names the account that posted it. Each contribution's receipt page still shows it, as it does today. The exposure test walks the new route too.
- **Web page `/wallet/[wallet]`.** Shortened wallet, totals, a per-community table when there are several, then one card per epoch, newest first, with its contributions. Each epoch links to its epoch page and each contribution to its receipt. Claimable links to the epoch's claim page. Paid shows the explorer link of the claim transaction. The empty state is a plain "No public record" page; the route's `not-found.tsx` gives it a `noindex`.
- **Links in.** A verified wallet on the leaderboard, the epoch contributions table and the contribution page links to its record. The wallet on the claim page's summary does too. Neither link can point to an empty record: a wallet shown as verified for an epoch, or holding a leaf, is in that epoch's record by the rule above.
- **OpenAPI** documents the route, its definitions (counted, credited, average) and the 404. **Read client**: `getWalletRecord(wallet, { offset, limit, signal })`, with type `WalletRecord`. The README and the package verify script are updated.
- **Migration 0018** `member_wallet_links_wallet`: `CREATE INDEX ... ON member_wallet_links (wallet)`. Additive, no data change. Approved by the coordinator. Without it, every request (even for an unknown wallet) scans the table.
- **Demo seed.** Its two wallets are now random real addresses (they were `DemoSigned…Wallet111…`, which is not base58). That lets wallet routes serve them in tests and in local runs. Every existing test that uses them still passes.

## How it was checked

- **Schema tests (core):** 6 new; the suite is 125 passed. They cover every payout state; paid without a claim transaction refused; Telegram, X handle and contribution URL keys refused; impossible counts and an average without a counted contribution refused; the loose variant accepts additive fields.
- **Service tests (PGlite):** 5 new in `read-service.test.ts`. They cover:
  - Demo totals: 3 contributions, 3 counted, 2 credited, average 51.67, 325 points. Epoch 1 average 42.5.
  - Paging that keeps the totals.
  - Pending, unresolved and late contributions shown without a score.
  - Relink attribution: the old wallet keeps epoch 1, the new wallet gets the open epoch 2.
  - No record for unknown, pasted, or signed-without-contributions wallets.
  - The no-row-lock test now includes the record read.
- **Payout tests with the chain fakes:** 3 new in `settlement.test.ts`. They cover:
  - Paid with `CLAIM_TX` and claimable, across two communities ordered by mint.
  - Chain down (`chain_unavailable`) and no reader (`chain_unconfigured`), keeping the allocated amount.
  - `before_first_paid_epoch`, and `no_allocation` when a member without a rules-test pass has no leaf.
- **Route tests:** valid (200, schema, cache header), unknown and pasted (404), and malformed (400). The malformed cases are a non-base58 string, two base58 strings that decode to 33 bytes, and `limit=101`. A published epoch read with the chain down shows the allocation.
- **pg (Postgres 17, postgres-js):** `read-service.pg.test.ts` passes 3 of 3. It checks that the plan uses `member_wallet_links_wallet` with `Index Cond: (wallet = …)` and that the full record reads through the production driver.
  - Full `pnpm --filter @hyphae/api test:pg` (`scripts/test-pg.sh`): 74 of 76. The 2 failures are 200 s timeouts in `rewards/concurrency.pg.test.ts` (50-round races that never touch wallet links).
  - That file alone: 9 of 9, the two slow tests at 132 s and 118 s. A machine-load timeout, not a regression.
- **Web:** `lib/record.test.ts` (7) and `components/wallet.test.tsx` (9). They cover the fixtures against the strict schema, shortened wallet only, every epoch and contribution link, paid, claimable and none sentences, the never-paid wording when unsettled, no `x.com` or `t.me`, paging, the empty state, and the leaderboard and claim links. The web suite is 140 passed. `next build` succeeds, with `/wallet/[wallet]` as a dynamic route.
- **Local run against fixture data:** a disposable Postgres 17 with migrations 0000 to 0018, the audit demo, and a published second community (`seedReadyEpoch` + `publishEpoch`, fake chain) sharing the demo's signed wallet. Only the read routes were served (no bot, no queue).
  - `curl`: 200 with `cache-control: public, max-age=15` for the signed wallet (3 epochs in 2 communities, 410 points, one `allocated` epoch with payment `chain_unconfigured`); 404 for the pasted wallet; 400 for `zzzz…` (44 chars) and `0OIl`.
  - Production build screenshots: [390 px](../screenshots/wallet-390.png), [1180 px](../screenshots/wallet-1180.png), [empty state, 390 px](../screenshots/wallet-none-390.png). No horizontal scroll at 390 px.
- **Gate:** `pnpm typecheck` 0, `pnpm lint` 0, `drizzle-kit check` "Everything's fine". `pnpm test`: core 125, read-client 26, web 140. API: see "Gate (API suite)" below.

## Gate (API suite)

The machine was at 100% CPU on 8 cores (other workers' suites and a review running at the same time).

- **Plain `pnpm test`: exit 1 three times, each time from a different timeout.** No assertion failed.
  - Run 1: two `beforeAll` PGlite setups over 30 s (`bot/commands/member-phone`, `onboarding`). Both files pass alone, 19 of 19.
  - Run 2: one 5 s test timeout (`bot/commands/setup`).
  - Runs 3 and 4 (default and 3 workers): all 1046 tests passed, but vitest's own `Timeout calling "onTaskUpdate"` RPC error set exit 1.
- **As the coordinator asked (`vitest run --maxWorkers=2`): exit 0, 98 files passed, 2 skipped; 1046 tests passed, 3 skipped, no errors** (505 s).

## New member-visible strings (for Cisco's approval)

Web, `/wallet/[wallet]`:
- Eyebrow "Wallet record". Lead: "The epochs where this was a member's wallet, verified by signature, when the epoch closed or while it is open."
- Stats: "Communities", "Epochs", "Contributions" (note "{n} scored, {n} credited"), "Average credited score", "Exact points".
- Explainer: "Scored: the contribution has a judgement. Credited: scored above zero. The average is over scored contributions. Points from an open epoch are provisional, and points do not promise payment."
- Community table: "Community", "Epochs", "Contributions", "Average score", "Exact points".
- Epoch card: heading "{community} · Epoch {n}" with the existing Open, Closing or Final pill; "{opens} → {closes} · member {id}". Stats "Contributions", "Average credited score", "Exact points", "Payout". Table "Work", "Submitted", "Credited score", "Points", "State" (the state sentences are the existing ones).
- Counts: "{n} contribution(s): {n} scored, {n} credited." / "{n} contribution(s): none scored yet."
- Payout:
  - "{amount}, paid in {tx}"
  - "{amount} allocated, not claimed yet." plus the link "Claim page"
  - "{amount} allocated. {existing unavailable sentence}"
  - "No allocation for this wallet in this epoch."
  - "No payout before the epoch closes and is published."
  - Otherwise the existing sentences ("Not allocated. No payout exists for this epoch.", "Retained: this epoch is before the first paid epoch.", the chain sentences).
- "No epochs on this page."; pager "← Newer", "Older →", "{a}–{b} of {n} epochs".
- Empty state: "No public record", "No epoch shows this wallet.", "A wallet's record lists the epochs where it was a member's wallet, verified by signature, when the epoch closed or while it is open. It starts with that member's first contribution. A wallet that was only pasted, not signed, has no record."
- Page metadata:
  - Title: "Wallet {short}".
  - Description: "{n} epoch(s) in {n} communit(y/ies). {counts sentence} {points} exact points."
  - Description when there is no record: "No public record for this wallet."
  - Description when it can't be read: "This record can't be read right now."
- Links: the verified wallet on the leaderboard, epoch and contribution pages, and the wallet on the claim summary, are now links (no new text).

API docs (OpenAPI):
- Summary "A wallet's record", with three description paragraphs: the attribution rule; the definitions and payout; and "No contribution link is served here".
- 404 "No epoch's public reads show this wallet."
- Parameter "A Solana address: base58 for exactly 32 bytes."

## Release needs

1. **Migration 0018 before the API image.** It is a plain `CREATE INDEX`, so it briefly blocks writes to `member_wallet_links` (a tiny table). If the release uses `scripts/rollout/db.mjs`, that script is pinned to 0017 and needs a 0018 entry and hash. Renumber at merge if another branch takes 0018 (the coordinator will).
2. **A fresh-session Codex review** of `2380d59..8eafc99` before push (a new public wallet surface).
3. **Cisco's yes on the strings above**, in particular the wording choice below.
4. API image and web deploy after the hold. No new config, secret or env var.

## Decisions taken (each one recommended, and reversible before release)

- **"Scored" and "credited", not "verified contributions".** The security page says Hyphae does not verify authorship ("A score is not proof of authorship"), so "verified contributions" would claim more than we prove. API fields: `counted` (as in the epoch counts) and `credited`.
- **Average = mean credited quality over counted contributions, zeros included**, to two decimals. That is the honest track record; an average over credited ones only would hide zeros.
- **404 for a signed wallet with no contributions**, so the route is not a membership oracle.
- **No contribution URL on the new surface** (data minimization; the receipt keeps it).
- **Totals add points across communities.** The per-community table and every epoch show them separately. Points of two communities are not the same unit; see the open questions.

## Open questions

- Should the overall "Exact points" add points across communities? The roadmap asks for total points. A per-community total only would be stricter.
- The site-wide not-found pages return HTTP 200 (with `noindex`): Next streams them behind the root `loading.tsx`, as documented. That's pre-existing, not changed here.
- In local `next dev`, the not-found UI stayed on "Reading the audit data…" in headless Edge, for the existing contribution page as well (the dev HMR WebSocket failed). The production build renders it correctly.
- Not built: a social card image for the wallet page, and the on-chain attestation the roadmap mentions for later.
