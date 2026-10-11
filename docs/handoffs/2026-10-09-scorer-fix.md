# reward-eval/3: the 90 s deadline now covers the whole Claude call (2026-10-09)

Worker note for the coordinator (Orca task `task_1be83cee10c2`). Branch `FCisco95/scorer-fix` from `origin/next` (`300eb97`), local commits only: nothing pushed, merged or deployed. Fixes finding 1 (medium) of the independent review `docs/plans/review-scorer-v3.md`. Built by Claude Opus 5.5; an independent Codex fix review follows.

Commits: `dd1d831` (fix and tests) and this note.

## What was wrong

`claudeTransport` relied on the SDK's `timeout` option for its 90 s bound. In `@anthropic-ai/sdk` 0.128.0 that timer wraps `fetch` only and is cleared when the headers arrive (`client.mjs`, `fetchWithTimeout`). The JSON body is then read in `internal/parse.mjs` with no limit. A prompt header followed by a stalled or slow body kept the call pending past 90 s, past the 180 s reward job expiry and the 5-minute reconciliation horizon.

## What changed

Only `apps/api/src/scoring/claude-client.ts`, inside the function `claudeTransport` returns:

- Each call creates its own `AbortController` and arms `setTimeout(() => deadline.abort(), timeoutMs)` before calling `client.messages.create(request, { signal: deadline.signal })`. The timer is cleared in `finally`, after the SDK has parsed the body or failed.
- The SDK forwards that signal to the request's own controller and keeps the listener until the body is settled (`releaseRequestSignal` runs in the parse `finally`). Aborting it after the headers aborts the body read: the read rejects and the connection closes.
- If the deadline fired, the transport throws `claude: no complete response within <timeoutMs> ms` (the SDK error is kept as `cause`). Without this, the SDK reports the abort as `Request was aborted.` (pre-header) or `AbortError: This operation was aborted` (mid-body), which would read like a cancellation in the dispatch record. A response that completes is returned as before.
- Any rejection still goes to the existing `runEvaluation` catch: `markReconciliation`, no decision, never a retry.

Unchanged: `maxRetries: 0`, logging off, the request body sent as committed, the SDK `timeout` option (same value; it still sets the `X-Stainless-Timeout` header, and its timer is armed a moment after ours, so ours fires first), `CLAUDE_CALL_TIMEOUT_MS` = `REWARD_CALL_TIMEOUT_MS` (90 s), the registry, prompt, question set, composition and pricing. No `Promise.race`: the abort cancels the read; nothing is left running.

## Template hash still pinned

`claude-registry.test.ts:58` still pins `48dabec502358a3a2a26365d6a8c19a27d8505055f4c49aecb989864890b047d` and passes. The request body is not touched; the signal is an SDK request option, not part of the body.

## Tests

Written first. On the unchanged code the three new deadline tests failed (the call resolved after about 1 s instead of rejecting at 40 to 50 ms; the evaluation completed instead of parking). All pass after the fix.

`apps/api/src/scoring/claude-client.test.ts` (8 → 11): a mock `fetch` returns JSON headers at once and a `ReadableStream` body. Like fetch, aborting the request's signal ends the body.

- `gives up at the deadline when the headers arrive but the body stalls`: 40 ms deadline, body due at 1 s. Rejects with the deadline error between 35 and 500 ms; the signal fetch received is aborted, the body is cancelled, one request.
- `gives up at the deadline while the body is still arriving piece by piece`: 4 bytes every 10 ms (about 0.6 s in all), 50 ms deadline. Rejects with part of the body sent; the signal is aborted, nothing more is sent 50 ms later, one request.
- `returns a body that finishes inside the deadline`: three pieces 5 ms apart, 1 s deadline. Resolves with the answer; signal not aborted, one request. This guards against a deadline that is too eager, so it passes before and after.

`apps/api/src/rewards/evaluation-claude.test.ts` (8 → 9):

- `parks a call whose response body outlives the deadline, and never calls again`: the real `claudeTransport` (40 ms deadline) through `runEvaluation`. The first run returns `pending_reconciliation` with the deadline error and no output; a second run returns `pending_reconciliation`; one HTTP request in all; no decision.

The existing pre-header timeout test (`never retries a timeout, and gives up at the configured time`) now ends through the same deadline and still passes.

Checks on this tree:

- `pnpm --filter @hyphae/api exec vitest run src/scoring src/rewards/evaluation-claude.test.ts src/rewards/evaluation-jev.test.ts --maxWorkers=2`: 16 files, 226 tests, all passed (10.1 s).
- `pnpm typecheck` exit 0. `pnpm lint` exit 0 (Biome, 448 files).
- Not run, as instructed: the full suite and `test:pg`.
- One-off probe, outside the repository, with the real Node `fetch` (undici) against a loopback server that sends JSON headers and part of a body, then stalls. Deadline 200 ms: rejected at 234 ms (`claude: no complete response within 200 ms`, cause `AbortError: This operation was aborted`), the server saw its socket close at 235 ms, one request. So the mock's "abort ends the body" matches the real fetch. No network beyond 127.0.0.1, no key, no file in the repository.

## Jev transport

Checked, not changed. `@typesafe-ai/sdk` 0.6.0 does not have this problem: its `attempt` keeps one timer around `fetch` and `bufferResponse`, which reads the whole body under the same signal and cancels the reader on abort, then raises `APITimeoutError`. `jevTransport` passes `timeout` (30 s) and `maxRetries: 0`, so a Jev call is bounded body included. No change needed.

## Open questions

1. **A deadline after the headers means Anthropic answered, so the call is probably billed.** The dispatch has no response on record, so `recordNotSentProven` would accept an operator's "not sent" for it, as it already does for a pre-header timeout. `recordNotSentProven` is meant for an operator who holds proof from the provider that nothing was sent, and that still holds. Telling the two cases apart in the error text would need a fetch wrapper; I did not add one. Recommendation: no change.
2. **The dispatch error text for a pre-header timeout changes** from `Request timed out.` to `claude: no complete response within 90000 ms`. Nothing in the code or scripts parses that text (checked with grep). Mentioned so the operator is not surprised.
