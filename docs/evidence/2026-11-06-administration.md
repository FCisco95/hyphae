# Local administration candidate — November 6

This is source and local-fixture evidence. The candidate is committed locally and has not been
pushed, installed or activated. It does not establish current provider permissions or production behavior.

## Implemented scope

The management page at `/c/{mint}/manage` groups existing public community and reward-vault reads.
Reward-vault balance and obligations to published epochs remain separate exact amounts. Neither is
presented as a spendable balance or the fee-recipient wallet's balance.

Private controls and the `/admin/v1` API are disabled by default. An enabled API requires a current
app-bound user credential, a unique linked Telegram identity, the designated community administrator
and a fresh group administrator/creator check. A wallet connection or technical web token grants no
authority. PUT serializes with reward admission and compares the observed pause timestamp before
changing new-intake state. It does not change payouts, epoch dates, scoring, rubrics or custody.

The web controls require confirmation, avoid optimistic updates and read back after success.
Conflicts and ambiguous write results require deliberate recovery. The local private
[`@hyphae/admin-client`](../../packages/admin-client/README.md) obtains a fresh token per operation,
bounds deadlines and response bodies, has no application-level write retry loop and ships an OpenAPI 3.1
contract. The contract adds no runtime endpoint or assumed deployment URL.

## Verification

| Check | Local result |
|---|---|
| Canonical unit gate at `769f517` | 2,332 package tests passed; four intentional API skips. Session-check tests 7/7 and pre-push hook fixtures passed. |
| Workspace types and lint | Passed; Biome checked 619 files. |
| Full PostgreSQL suite | 113 tests passed across 23 files against a fresh disposable PostgreSQL 17 database (262.47 seconds), including the eight new administration concurrency cases: queued abort/deadline, designation/chat changes, concurrent CAS and read-only overview behavior. |
| Actual SDK/API/database integration | Four tests passed through the SDK, real Hono administration routes and disposable PGlite. |
| Built public management page | Sanitized production build passed. Synthetic healthy, paused, missing-vault, missing-epoch and unavailable states checked at 1,440, 390 and 320 pixels with no horizontal overflow or console errors. |
| Actual administration component in a browser | Production component bundled with isolated fake login hooks and a synthetic localhost API. Confirmation/cancel, pause/resume/read-back, stale-edit refresh, accepted write with truncated response, explicit recovery and sign-out passed. Confirmation and logged-out views had no overflow at 320/390/1,440 pixels; browser errors and console were empty. |
| Packed standalone SDK | Six expected files; installed offline without scripts outside the workspace. Read/pause/conflict/resume, per-request tokens, Node import, TypeScript consumer and OpenAPI subpath passed. |
| OpenAPI consistency | Canonical schemas, actual served paths/methods, exact Allow headers and generated artifact checked. Independent Draft 2020-12 validation passed seven overview and three request cases. |

The canonical unit gate intentionally excludes real-PostgreSQL suites; the full PostgreSQL suite
above was executed separately. These fixtures do not verify real Privy, Telegram, Fly, Neon or Vercel behavior.

## Review and source

- `d65494f`: strict shared administration schemas.
- `127ba58`: gated API, web controls and local typed client. Fresh Claude Opus review accepted the
  full `9d57d97..127ba58` range with no Critical, High or Medium findings.
- `769f517`: packaged generated OpenAPI contract and drift checks. Fresh Claude Sonnet review
  accepted `127ba58..769f517` with no Critical, High or Medium findings.
- `cbb3927`: three Low documentation findings corrected: ambiguous gateway failures, read-only
  GET error wording and exact per-path Allow headers. The Allow regression failed before the fix;
  SDK 65 tests, API contract 3 tests, both typechecks, schema corpus and packed contract passed
  afterwards. The SDK runtime bundle remained byte-identical, so the full runtime gate was not repeated.

These are AI source reviews, not a third-party audit. Provider calls under the mutation lock can
delay that community's intake within the deadline. A lost or unreadable write response may follow
a committed change; read the current state before another confirmed update. The pause timestamp
records current state rather than a permanent action history. Real login, public-host Origin behavior,
installation and activation remain separate and unverified.

The browser also replayed a PUT after a pre-header socket disconnect. The first request changed
state; timestamp CAS rejected the replay with 409. An application having no retry loop does not
prevent its HTTP transport from replaying a request. The SDK, OpenAPI and integration documentation
now state that distinction. A truncated successful response exercised the separate unknown-outcome
recovery path without a duplicate PUT from that transport scenario.
