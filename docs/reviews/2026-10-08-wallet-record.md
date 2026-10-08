---
date: 2026-10-08
summary: Independent Codex review of wallet-record at 70e5b3c and its merge into next at 300eb97; CHANGES REQUESTED for one medium membership-timing finding, with 91 targeted tests passing.
---

# Wallet record: independent review

Reviewer: Codex, independent of the Claude builder. Review only; no tracked files changed, no commit, no push, and no production access.

## Scope

- Branch diff: `2380d590c624033089a324706c2ac92656d16484..70e5b3cde7a045b98bda4bafeeb3b1175a458534` (`origin/FCisco95/wallet-record`), including implementation commits `5c54993`, `8eafc99`, and author note `70e5b3c`.
- Merged tree inspected and tested: `300eb975f33f04cb4aa56bcadf108fcaeccc9777` on `next`. Wallet merge: `2556b96132659303b5dce15265ff5c2b547edceb`.
- Read both review briefs, `CLAUDE.md`, `docs/HANDOFF.md`, the wallet-record branch note, the prior Blink review format, relevant wallet/privacy guidance, and the changed code and tests. The handoff's unmerged-branch description is stale relative to the inspected local refs; it is not evidence of deployment.
- Compared the branch's files against HEAD and inspected subsequent merges: payout-status `2198ba7`, wallet-record `2556b96`, raid-stats `1916c41`, Blink `3021959`, and scorer-v3 `7c6979f`.

## Verdict: CHANGES REQUESTED

**Findings: 0 high, 1 medium, 0 low.** Fix the distinguishable missing-record path before exposing this route. The passing tests establish returned values, not the promised absence of a membership timing signal.

1. **Medium — Do not branch on private signed-link existence before establishing a public record.** `apps/api/src/http/read-service.ts:725`, continuing at lines 726–761.

   **Failure scenario:** wallet A is unknown (or only pasted); wallet B belongs to a member who signed in a community with a current reward epoch but has never contributed. Both requests return `404 {"error":"not_found"}`, as intended. A completes after the initial wallet-link SELECT. B executes that SELECT, a communities SELECT, one awaited epoch SELECT per linked community, and an intake SELECT before returning the same 404. For one community with a matching epoch this is **one versus four sequential SELECTs**, excluding the identical clock/transaction overhead. Even an expired signed link triggers community/epoch lookups before it is rejected. Repeated unauthenticated requests can therefore distinguish a signature-linked wallet with no public record by the extra database round trips; additional linked communities amplify the difference. The route's shared rate limit does not remove that signal.

   The divergent query path is directly established by the code. Remote timing separability is an inference from those sequential database round trips, not a measured production exploit; no production or additional probe was run. Body and header construction are shared and are not the defect. This violates the brief's explicit requirement that a signed wallet without contributions must not become a membership oracle.

   **Recommended fix:** obtain candidate public records with a single joined query that requires a reward intake for the same member and epoch, the signed wallet, a served epoch, and the correct validity interval at close/now. Return the same empty result path when that query has no public rows. Load community details, decisions and payout facts only for those public rows. Avoid enumerating a wallet's private linked communities before knowing it has any public contributions; adding a fixed sleep would leave a variable amount of private-state-dependent work.

   **Tests needed:** extend the existing service/route tests with unknown, pasted-only, active signed-but-quiet, and expired signed-but-quiet wallets, including multiple linked communities. Assert the same 404 body, cache/CORS/error header policy, and database query sequence/count for all missing-record cases. Use query instrumentation or a controlled delayed database double to detect additional round trips without relying on noisy wall-clock assertions. Retain successful-record, relink, pagination and payout cases. The current service test asserts only `null`; the route's 404 table does not include the signed-but-quiet fixture.

## Checks run

All commands ran against the unchanged merged tree, with `--maxWorkers=1`.

| Command | Result |
|---|---|
| `pnpm --filter @hyphae/api exec vitest run src/http/read-service.test.ts src/http/settlement.test.ts src/http/routes.test.ts --maxWorkers=1` | Exit 0: **68 passed**, 3 files (28 service, 26 settlement, 14 routes). |
| `pnpm --filter @hyphae/core exec vitest run src/read-api-schema.test.ts -t 'wallet record' --maxWorkers=1` | Exit 0: **6 passed**, 23 unrelated tests skipped by the name filter. |
| `pnpm --filter @hyphae/web exec vitest run lib/record.test.ts components/wallet.test.tsx --maxWorkers=1` | Exit 0: **17 passed**, 2 files (7 format/record, 10 component). |
| `git diff --check 2380d59..origin/FCisco95/wallet-record` | No whitespace errors. |
| Branch/merge comparison, migration SQL and snapshot inspection | Wallet implementation preserved; journal and snapshot chain consistent through 0019. |
| `git status -sb` and ref checks | Tracked tree clean at `300eb97`; branch tip remained `70e5b3c`. This report is the sole authored file and is gitignored. |

**Total: 91 passing targeted tests.** Initial sandbox process creation failed with Windows access denied before any command ran; authorized execution outside that process sandbox succeeded. No full suite, `test:pg`, typecheck, lint, browser build or production check ran. Exposure, OpenAPI, read-client and PostgreSQL query-plan tests were inspected, not executed, because they were outside the brief's explicit runnable list. No new test/probe files were created.

## Checked and found sound

- **Attribution:** `walletTime` is shared with public reads. The record tests signature method and `validFrom <= at < validTo`, matching `publicWallets` and `walletAt`; wallet-link timestamps have millisecond precision. Relinking preserves the prior closed epoch and assigns the open epoch to the new wallet. Filtering each intake by both epoch ID and member ID prevents cross-member mixing when the same wallet has different historical holders. Closed-but-unsnapshotted epochs use the close, not the current wallet. No divergence found in this rule.
- **Decisions and arithmetic:** the record calls the existing `statesFor` and `decisionsById` paths, including frozen snapshot selection. Pending, unresolved and excluded entries have null scores/points. Counted zeroes remain in the average; totals sum BigInt point units and format exact decimal points. Overall and community totals are computed before slicing. Ordering uses close time, mint and epoch index; no missing tie-breaker found under the existing non-overlapping wallet-link invariant.
- **Payment evidence:** the new wrapper checks the leaf's member ID and delegates payment to `walletClaimOf`. Its existing publication/receipt verification requires the matching claim transaction before `paid`, preserves allocated amounts when chain reads fail, and shares the list deadline and concurrency bound. No new signing or allocation-writing path exists. Record tests cover paid, claimable, chain down/unconfigured, retained epochs and no allocation; `no_stored_intent` is handled explicitly in the wrapper but has no dedicated new record-level test.
- **Response boundaries:** the route uses `isAddress`, bounded paging, the shared 429/error middleware and 15-second success cache. Named projections and explicit output construction omit Telegram identifiers, X handles and contribution URLs. The strict schema rejects added identity/URL keys; the exposure test now visits this route. OpenAPI registers the same wallet-record schema and documents the attribution and payout meanings. Finding 1 qualifies only the missing-record timing property.
- **Migration:** 0018 is exactly a non-concurrent, non-unique btree index on `member_wallet_links(wallet)`. Snapshot 0018 adds only that index to 0017; 0019 retains it and adds `raid_recaps`, with both `prevId` links correct. Journal entries are 18/19 in that order. The PostgreSQL test explicitly asserts the wallet index and `Index Cond`; that test was not rerun. Migration-before-image remains a release prerequisite, not a completed production action.
- **Client and web:** the read-client method encodes paging, parses the loose schema and verifies response wallet/offset/limit identity. Shared verified-wallet cells provide the leaderboard, epoch and contribution links; claim summaries link the published leaf's wallet. At one consistent database state, these sources imply a nonempty record. Open-epoch relinks can still change that state between separate cached reads. The wallet page displays transaction evidence for paid claims, no external social links, and uses `notFound()` for the empty state; production noindex rendering was not independently rerun.
- **Fixtures and merge:** old demo wallet prefixes no longer have consumers in apps/packages; unrelated synthetic wallet strings remain in link tests. Later changes to shared read/schema/view files belong to payout-status, the claim share control to Blink, and database additions to raid-stats. Wallet service, settlement wrapper, route, wallet page/helpers, client and 0018 migration have no subsequent behavioral change. The merge's read-service test conflict retains the wallet tests alongside payout-status tests. The issue in finding 1 exists on the original branch as well as HEAD.

## Coordinator handoff

Next action: fix finding 1 in the owning implementation session, run the targeted regressions, then request an independent fix review. Cross-community point totals and member-facing wording remain the author's recorded founder decisions; this review does not resolve them or authorize release.

Suggested skills: `the-analyst` for evidence and scope; `superpowers:systematic-debugging` for the privacy regression; `handoff` when consolidating the result into the coordinator's canonical handoff. The dispatched task permits only this report, so tracked HANDOFF/BUILDLOG updates belong to the coordinator.

Generated artifact: `docs/plans/review-wallet-record.md` only, a local gitignored review report. No resources, credentials, deployments or scheduled jobs were created.
