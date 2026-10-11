---
date: 2026-10-08
summary: Independent wallet-record fix check ACCEPT at 4cca6ca; the missing-record paths use one joined SELECT and identical HTTP responses, with 70 HTTP tests and 3 isolated PostgreSQL tests passing.
---

# Wallet record timing fix: independent review

Reviewer: Codex, independent of the builder. Review only: no tracked files changed, no commit, no push, no production access.

## Scope

- Requested diff: `origin/next..4cca6ca`, resolved to `300eb975f33f04cb4aa56bcadf108fcaeccc9777..4cca6cac547995f5d0370663dd5bf9573bbe46ca`.
- Inspected and tested worktree: `C:/hy/wallet`, branch `FCisco95/wallet-fix`, HEAD `1a758fe10d123c4300c629a4559099b837ce7a4a`. The sole change after the fix commit is the builder note, `docs/handoffs/2026-10-09-wallet-fix.md`; tested code therefore matches the requested fix.
- Follow-up to finding 1 (medium, private membership timing) in the coordinator's `C:/hy/next/docs/plans/review-wallet-record.md`. Read both coordinator briefs, that original review, `CLAUDE.md`, `AGENTS.md`, `docs/HANDOFF.md`, and the builder note. The canonical handoff predates the local merged `next` tree; it is not evidence of the current local branch state or a release.
- Four changed files: `apps/api/src/http/read-service.ts`, its unit and PostgreSQL tests, and `apps/api/src/http/routes.test.ts`.

## Verdict: ACCEPT

**Findings: 0 high, 0 medium, 0 low.** Finding 1 is resolved for its demonstrated defect: private link existence no longer adds application-controlled database round trips before a missing-record response. Attribution and returned record behavior remain covered by the existing regressions.

This accepts the one-statement mitigation requested by the original review. It does **not** establish constant execution time or prove that all statistical timing inference is impossible.

## Checks run

All tests ran against the unchanged code with one worker.

| Check | Result |
|---|---|
| `pnpm --filter @hyphae/api exec vitest run src/http/read-service.test.ts src/http/settlement.test.ts src/http/routes.test.ts src/http/exposure.test.ts --maxWorkers=1` | Exit 0: **70 passed**, 4 files: service 28, settlement 26, routes 15, exposure 1. |
| From `apps/api`, `pnpm exec vitest run --config vitest.pg.config.ts src/http/read-service.pg.test.ts --maxWorkers=1`, with `HYPHAE_TEST_PG_URL` pointing only to the disposable local server | Exit 0: **3 passed**, 1 file, including the route-query wallet-index assertion and production-driver record read. |
| `git diff --check origin/next..4cca6ca` | No whitespace errors. |
| Diff file list and `git diff --name-only 4cca6ca..HEAD` | Only the four scoped source/test files in the fix; only the builder note after it. No web, schema, migration, client, OpenAPI, or route implementation change. |
| Report ownership | `docs/plans/review-wallet-fix.md` was absent, untracked, and matched `.gitignore` before creation. It is the sole authored file. |
| Final workspace/resource check | Tracked and staged diffs empty; branch and all three refs unchanged. The review container is absent from `docker ps -a`. |

**Total: 73 passing tests.** The PostgreSQL 17 container was named `hyphae-wallet-review-ff4aad-pg`, used the existing local image with `--pull=never`, and exposed only `127.0.0.1:55741`. It was started with `--rm`, used only for this review, then stopped successfully. No shared test database or another worker's container was changed.

Initial sandbox process creation failed with Windows access denied; authorized execution outside that process sandbox succeeded. No full suite, whole `test:pg`, typecheck, lint, additional benchmark, or production probe ran. The builder's claimed pre-fix failing run was read, not independently repeated.

## Checked and found sound

### Missing-record paths and query instrumentation

`apps/api/src/http/read-service.ts:719` selects intakes through the wallet-link, epoch, and intake joins. It requires the requested signed wallet, a served epoch, the same member and epoch on the intake, and the valid link interval. At line 745 it returns `null` immediately if there are no intakes. Communities, `findEpochs`, decisions, publication facts, and chain reads are reached only after public rows exist. The initial statement never joins the communities table.

The passing logger regression at `apps/api/src/http/read-service.test.ts:705` checks six missing cases: unknown, pasted-only, active signed but quiet, expired signed but quiet, one wallet signed by quiet members in two communities, and a contributor's short-lived link replaced before the epoch close. Every case returns `null`; the full logged query sequences are equal, with exactly **one SELECT** in each. This is a query-count/shape assertion, not a wall-clock assertion.

The HTTP regression at `apps/api/src/http/routes.test.ts:124` runs the first five cases through fresh route instances with the same clock and rate-limit starting state. Status, exact body, every returned header, and query sequence are equal: `404 {"error":"not_found"}`. The common route code at `apps/api/src/http/routes.ts:107` still returns the same missing-response body without adding the success cache header; CORS and error middleware are unchanged. Production's database-clock SELECT is a shared extra read before the service call, independent of link existence; the injected-clock tests omit it uniformly.

### Residual server-side timing work

The joined statement is **not constant-work**. An absent wallet can terminate after the wallet lookup; matching signed links can cause epoch lookups and intake probes for each candidate link/epoch before yielding no public rows. A community's epoch history and the wallet's link history can therefore affect server work. The SQL removes application-side enumeration and extra round trips; it does not remove this data-dependent work inside PostgreSQL.

I accept that residual for this finding's requested mitigation. The demonstrated one-versus-three/four/five sequential-SELECT signal is eliminated, the same empty response is preserved, and the actual query remains indexable by wallet. There is no evidence from the permitted checks establishing a remaining remotely distinguishable signal. Conversely, the builder's assertion that the difference is below network jitter, and the source comment at `apps/api/src/http/read-service.ts:716` that timing cannot reveal a link, are stronger than the evidence: neither was measured here. They should be understood as removal of the extra-round-trip signal, not a constant-time privacy guarantee. If that stronger guarantee becomes a release requirement, it needs a separate design and measurement scope; these tests cannot certify it.

The PostgreSQL test at `apps/api/src/http/read-service.pg.test.ts:42` logs `readWalletRecord`'s actual SELECT and parameters, requires it to be the only SELECT for an unknown wallet, and explains that captured statement. The passing assertions establish `member_wallet_links_wallet` and `Index Cond: (wallet = ...)`. The test forces `enable_seqscan = off` on a tiny database: it proves the index is usable by the actual route query, not that the production optimizer always chooses it or that timing is indistinguishable. The full plan is not printed by the test, so no unobserved secondary plan nodes or costs are claimed here.

### Attribution and record behavior

At `apps/api/src/http/read-service.ts:735`, write `F = valid_from`, `T = valid_to`, `C = closes_at`, and `N = now`. `F <= C AND F <= N` equals `F <= min(C,N)`. `T IS NULL OR T > C OR T > N` equals `T IS NULL OR T > min(C,N)`. Together with `method = signature`, these are exactly the half-open interval used by `publicWallets`, `walletTime`, and `walletAt`. Equality at `valid_from` is accepted; equality at `valid_to` is excluded. Link timestamps have millisecond precision, matching the existing JavaScript-date boundary comparison.

`now` is supplied to typed Drizzle column comparisons instead of interpolated as a raw Date into SQL. The real PostgreSQL driver tests pass for both an unknown wallet and successful closed/open record reads, exercising the encoding path. `reward_config_id IS NOT NULL` matches `findEpochs`' existing served-epoch filter. The join binds both member and epoch, so it does not mix another member's intake into a historical wallet record.

The unchanged successful-record, relink, pending/unresolved/excluded, pagination, totals, paid/claimable, chain-unavailable, retained, and missing-allocation cases pass. The new replaced-before-close case also passes. Community and epoch loading now derives only from returned public intakes; downstream state selection, arithmetic, sorting, pagination, and payout computation are unchanged. The same read-only repeatable-read transaction surrounds both stages. With the existing foreign keys and served-epoch predicate, a nonempty initial result still produces a shown epoch, supporting the simplified final null guard.

## Coordinator handoff

Next bounded action: record this ACCEPT against `4cca6ca` and integrate it under the coordinator's existing merge/release process. Any later change to the joined query needs another scoped check. This review grants no push, production migration, or deployment approval and does not resolve unrelated wording or release decisions.

The handoff skill was applied to these continuation notes. This dispatch explicitly permits only this report, so canonical `docs/HANDOFF.md`, dated tracked snapshots, and `docs/BUILDLOG.md` updates remain the coordinator's responsibility.

### Suggested skills

- `the-analyst` for preserving the distinction between the proven query-count fix and unmeasured timing claims.
- `handoff` when consolidating this review into the canonical tracked project checkpoint.
- `orchestration` for the dispatch result and any subsequent work assignment.

### Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Independent fix review | `docs/plans/review-wallet-fix.md` | Sole authored file; local and gitignored, delivered to the coordinator through Orca. |
| Disposable PostgreSQL test server | `hyphae-wallet-review-ff4aad-pg`, loopback port 55741 | Stopped after the authorized three-test file; automatic container removal enabled. No persistent service created. |

### Next-session prompt

```text
The wallet-record timing fix at 4cca6ca has an independent ACCEPT: 70 HTTP tests and 3 isolated PostgreSQL tests passed. Extra database round trips on missing-record paths are removed; constant-time execution was not established.

Files: docs/plans/review-wallet-fix.md, docs/handoffs/2026-10-09-wallet-fix.md, docs/HANDOFF.md
Model: keep the coordinator's existing model and effort for evidence consolidation.
Skills: the-analyst, handoff.

Read the review, record the verdict in the tracked checkpoint, and continue the already authorized integration process while preserving release holds.
```
