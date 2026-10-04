---
type: review
project: hyphae
summary: "Fresh Claude Opus 5.5 ACCEPT of the pinned local Hyphae starter/SDK range, four optional Low findings and explicit verification limits."
updated: 2026-10-04
---

# Other-family review — FCisco95/hyphae a646abc883131ff411d5dd7bbba536176364fe38..ff97f71595b7fde2de88da0f5b788d166aef56cd
Reviewer: Claude Opus 5.5 (claude-opus-5-5), Claude Code; effort level not observable from inside the session. Read-only; nothing was edited, committed, built, installed or published.

## Verdict: ACCEPT (no blocking findings). Four Low and three Info follow-ups, all optional.

## Coverage (read at pinned refs with git show/diff)
- packages/read-client/src/index.ts (full), package.json, tsup/tsconfig, copy-license, .gitignore, README, examples/consumer.mjs, scripts/verify-package.mjs (full), test/client.test.ts (test list plus the cancellation, deadline and closed-body tests)
- packages/core/src/read-api.ts: the diff (namespace import only) and the ReadApiV1Loose shapes for every operation
- apps/api/scripts/read-community.ts (full); its test only run, not read line by line
- apps/api/src/http/routes.ts validators and CORS/Retry-After headers, to check compatibility
- pnpm-lock.yaml diff, docs/community/INTEGRATING.md, README.md diff, both 2026-10-04 handoffs
- Not reviewed: BUILDLOG, HANDOFF, combined-release-packet, publication-approval docs (process records, not code); the onboarding ranges accepted earlier.

## Confirmed good
- Only GET is used. credentials: "omit", redirect: "error", cache: "no-store". The only header is `accept`, which is CORS-safelisted, so browsers send no preflight. There is no write, registration, signing or transaction surface, and verify-package checks at compile time that registerCommunity is absent.
- Input validation matches the API validators exactly (routes.ts:20-24: MINT, INDEX 1..999999999, COUNT, UUID, WALLET; limit 1..100). Path segments are regex-gated, so there is no path or query injection. The base-URL guard rejects non-HTTPS except loopback, userinfo, query, fragment, and any path other than /v1 (dot segments are normalized before the check).
- Every operation checks that the response matches the request: mint, epoch, wallet, UUID, offset and limit, plus member_id on every row when a member filter is used. Mint-scoped reads never fall back to a default community.
- Errors are redacted: the message is the code only, and raw network errors are not exposed. 429 carries the status and the parsed Retry-After value (integer seconds or HTTP-date).
- The deadline covers the body read. The finally block's controller.abort() closes an unread error body, and a test proves this against a real socket. Timer and listener are cleaned up. An already-aborted signal short-circuits before fetch. A throwing refinement is contained as schema_mismatch.
- The core change from `import { z }` to `import * as z` is equivalent at runtime; no schema definitions changed. The lockfile adds only the new importer, and its versions already resolve elsewhere. The public v1 contract is unchanged. @organichub/verify is untouched. package.json is private: true, so an accidental npm publish is blocked.

## Findings
L1 Low — packages/read-client/src/index.ts:132-139 (deadline depends on fetch honoring the signal). Scenario: a caller passes a custom `fetch` (an older polyfill, or a test or SSR wrapper) that ignores `signal`. If the server stalls, the timer fires and aborts the controller, but the awaited promise never settles, so the call hangs past timeoutMs and the "10-second deadline" is not enforced. The README documents this requirement, so it is not a contract violation. Minimal fix: race fetchImpl and response.json() against a promise that rejects on controller.signal "abort", and add a test with a fetch that ignores the signal.

L2 Low — apps/api/scripts/read-community.ts:70-75. Scenario: the API sends headers, then the body stalls for more than 10 s. AbortSignal.timeout rejects response.json() with a TimeoutError, which the code reports as `invalid_json` instead of `timeout`. INTEGRATING.md says "Each request has a ten-second deadline", which holds, but the error label is wrong. Fix: in the json catch, map an error named "TimeoutError" to "timeout" (as the fetch catch already does).

L3 Low — apps/api/scripts/read-community.ts:76. Scenario: an epoch response with a malformed integer string makes a shared arithmetic refinement throw. The SDK comment at index.ts:164 confirms this is possible, and the SDK fixed it. In the starter, the exception escapes readCommunity as a non-ReadError, so callers of the exported function get a raw error, and the CLI prints {"error":"unavailable"} instead of schema_mismatch. Fix: wrap safeParse in try/catch and convert the error to ReadError("schema_mismatch"), as the SDK does, and port the SDK's throwing-refinement test.

L4 Low (docs) — packages/read-client/README.md and docs/community/INTEGRATING.md (also the handoffs). Spaces are missing between words and numbers throughout: "Node22+", "Zod4.6.5", "A429", "limit1–100 (default50)", "BUSL1.1", "@hyphae/read-client0.1.0", "exactly0.1.0 throughOct12", "task3.6". These are plain ASCII in the files, not non-breaking spaces. Adopter-facing docs read as corrupted. Fix: restore the spaces in the two adopter docs.

I1 Info — apps/api/src/http/routes.ts:94 sets ACAO:* but no Access-Control-Expose-Headers. Browser adopters therefore never see Retry-After or RateLimit-* from production, and retryAfterSeconds is always undefined in browsers. The README says CORS "may hide" the header, and verify-package runs with requireRetryAfter=false in the browser. This is accurate but understated. Optional fix, outside this range: expose Retry-After and RateLimit-* (a header-only change; the v1 body contract is unchanged).

I2 Info — index.ts:137 sends `cache: "no-store"` on every read. Node 22+ and browsers accept it (the Node and Chromium runs passed in prior evidence). Some edge runtimes (older Cloudflare Workers compatibility dates) throw on the `cache` field, and the SDK would map that to network_error. The README scopes support to Node22+ and modern browsers, so no change is needed. no-store also bypasses the API's public max-age caching for non-claim reads, which raises rate-limit consumption in browsers. That was an intentional choice.

I3 Info — index.ts:3 imports the schemas by relative path into core source. The packed d.ts imports only 'zod', and the consumer tsc check passed (prior evidence), so this is fine now. Any new core import in read-api.ts is pulled silently into the SDK bundle, so keep read-api.ts dependency-light.

## Checks run now (HEAD == ff97f71; working-tree drift for packages/read-client, packages/core/src/read-api.ts and apps/api/scripts versus ff97f71 is zero)
- pnpm --filter @hyphae/read-client test → 23/23 passed
- pnpm --filter @hyphae/read-client typecheck → exit 0
- vitest run apps/api/scripts/read-community.test.ts → 12/12 passed
- Existing ignored dist tarball sha256 = 023e3ff0…a07d8e, which matches the recorded package-verification.json. I did not rebuild it, so I have not shown that dist was built from ff97f71.
## Prior evidence only (not rerun): 886 passed/1 skip full suite, repository lint/typecheck, SDK/API/web builds, isolated packed install, consumer type check, Node and cross-origin Chromium 151 runs, live Lab read.

## Remaining uncertainty
- Packing has not been reproduced at ff97f71. The tarball and verification timestamps (11:41) come from the author's run.
- No live production read was made in this review.
- I did not exercise behavior with a real stalled body against real undici (it was covered by mocked tests plus the 503 socket test).
- main is 21 commits ahead of origin and unpushed. That is noted only; pushing is out of scope.
