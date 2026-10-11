---
date: 2026-10-09
summary: Fix for the wallet-record review's medium finding on branch FCisco95/wallet-fix (from origin/next 300eb97, not pushed). GET /v1/wallets/:wallet/record now finds a wallet's public intakes in one joined query, so every missing-record wallet, signed or not, costs that one query and gets the same 404. Test-first with logged query sequences. Needs an independent Codex fix review before merge.
---

# Wallet record fix, 2026-10-09

Worker task `task_73dc09940747`. Finding 1 (medium) of the independent review of `FCisco95/wallet-record`: a signed wallet with no public contribution got the same 404 as an unknown wallet, but only after 2 to 5 more sequential SELECTs, so the route could be timed into a membership oracle. Branch `FCisco95/wallet-fix`, commit `4cca6ca` (fix and tests) on `300eb97`. Nothing pushed, merged or deployed.

## The new query, in words

`readWalletRecord` (`apps/api/src/http/read-service.ts`) now starts with one statement. It returns the reward intakes (contribution id, member id, accepted at, raid id, epoch id, community id), in intake order, for which all of the following hold:

- a wallet link with this wallet and method `signature`;
- an epoch of the link's community that is served (it has a reward configuration, as `findEpochs` requires);
- an intake of the link's member in that epoch;
- the link is valid at the epoch's wallet time, `least(closes_at, now)`: `valid_from <= closes_at and valid_from <= now`, and `valid_to` null or `> closes_at` or `> now`. That is `walletTime` and the `publicWallets` rule, written without `least()` so `now` is bound through the column's encoder (a raw `Date` in `sql` passes PGlite but fails on postgres-js).

No rows: the function returns `null`, the route answers `404 {"error":"not_found"}`, and nothing else was read. Rows: communities, epochs (`findEpochs`), contribution kinds, states, decisions and publication facts load only for the communities and epochs those rows name. Attribution, counts, average, totals, paging, ordering, payout facts and the 404 body and headers are unchanged; the existing record, relink, paging and payout tests pass without changes.

## Query sequence per missing-record case

Logged by drizzle's logger inside the read transaction. Every case starts with `set transaction isolation level repeatable read read only`. Over HTTP without a test clock, the route adds the same `clock_timestamp()` read before it for every request.

| Wallet | Before (SELECTs) | After |
|---|---|---|
| Unknown | links (1) | the joined query (1) |
| Pasted only | links (1) | the joined query (1) |
| Signed, member never contributed | links, communities, epochs, intakes (4) | the joined query (1) |
| Signed, link ended, member never contributed | links, communities, epochs (3) | the joined query (1) |
| Signed by quiet members in two communities | links, communities, epochs ×2, intakes (5) | the joined query (1) |
| Signed by a contributor for one hour of epoch 1, replaced before its close | links, communities, epochs (3) | the joined query (1) |

## Tests

- `read-service.test.ts` › readWalletRecord › "has no record for an unknown wallet, a pasted one, or a signed one without contributions": extended from 3 wallets to the 6 above. Each returns `null`, every logged sequence equals the unknown wallet's, and it holds exactly one SELECT. **Failed on the unchanged code** (sequences of 1, 1, 4, 3, 5, 3 SELECTs) and passes now.
- `routes.test.ts`:
  - "answer 404 for anything unknown…": the 404 table now also has the three signed-but-quiet wallets.
  - New, "answer a missing record alike, with the same queries, whether or not its wallet is signed": unknown, pasted and the three signed-but-quiet wallets through the route, each with a fresh app so the rate-limit headers start alike. Status, body, every header and the logged query sequence must be equal. **Failed on the unchanged code** (query lists differ) and passes now.
- `read-service.pg.test.ts` › "finds a wallet's public intakes through an index led by the wallet": replaces the hand-written `explain select member_id from member_wallet_links where wallet = 'W'`. It captures the route's own query through a logged postgres-js drizzle, checks it is the only SELECT for an unknown wallet, and explains it with its parameters (`enable_seqscan = off`, as before). The plan: Bitmap Index Scan on `member_wallet_links_wallet` with `Index Cond: (wallet = 'W'::text)`, then `epochs_community_index`, then an index scan on `reward_intakes`. This test is a plan check; it also passed on the old query, which started from the same index.

Runs:

| Command | Result |
|---|---|
| `pnpm --filter @hyphae/api exec vitest run src/http/read-service.test.ts src/http/settlement.test.ts src/http/routes.test.ts src/http/exposure.test.ts --maxWorkers=2` | 4 files, **70 passed** (service 28, settlement 26, routes 15, exposure 1). The review's 68 plus the new route test plus exposure. |
| pg plan test on my own container (below) | 1 file, **3 passed** |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 (448 files) |

The full suite and the full `test:pg` were not run, as the brief asks.

pg command (own container and port, not `scripts/test-pg.sh`):

```bash
docker run -d --rm --name hyphae-wallet-fix-pg -p 55733:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_DB=hyphae postgres:17
cd apps/api
HYPHAE_TEST_PG_URL=postgres://postgres:test@127.0.0.1:55733/hyphae pnpm exec vitest run --config vitest.pg.config.ts src/http/read-service.pg.test.ts
docker stop hyphae-wallet-fix-pg
```

## Open questions

- **Work inside the one statement still differs a little.** For a wallet with links, Postgres probes `epochs` and `reward_intakes` for each link before finding no rows; for an unknown wallet it stops after the wallet index. That is the same number of round trips, with an in-server difference of index probes per link, far below network jitter. Making that constant would need padding work. I recommend accepting it; the reviewer's fix asks for exactly this one-statement shape.
- **A wallet with a public record runs more queries, growing with its public epochs.** By design: which epochs show a wallet is already public on each epoch page.
- **Plan on production volume** is not measured here. The test forces index use on a tiny table, as the earlier test did. The query is led by the same wallet index the earlier one used, so the plan should not get worse.
- Not changed, as the brief requires: web, schema, migrations, the read client, OpenAPI, `routes.ts`.

## Next

1. An independent Codex fix review of `300eb97..` this branch.
2. Then merge into `next` with the other reviewed branches, per the release plan. Migration 0018 still goes before the API image.
