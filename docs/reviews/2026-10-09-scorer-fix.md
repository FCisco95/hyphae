---
date: 2026-10-08
summary: Independent Codex fix check of dd1d831 accepts the Claude whole-call deadline; 226 targeted tests pass and the original delayed-body probe rejects at 52 ms with one request and cancellation.
---

# Claude scorer deadline: independent fix check

## Scope

Reviewer: Codex, independent of the Claude builder. Worktree: `C:/hy/scorer`, branch `FCisco95/scorer-fix`.

- Reviewed `git diff origin/next..dd1d831`: `300eb975f33f04cb4aa56bcadf108fcaeccc9777..dd1d83100c662483607673b729de2275eb928ebb`.
- Tested HEAD `631a80d25c6775168684113e1475bbfd1029919c`. The only change after `dd1d831` is the builder note, `docs/handoffs/2026-10-09-scorer-fix.md`; the tested implementation and tests match the reviewed fix.
- Scope is finding 1 of `C:/hy/next/docs/plans/review-scorer-v3.md`: the Claude transport deadline must include response-body consumption. Read both assigned briefs, `CLAUDE.md`, `docs/HANDOFF.md`, the original review, the builder note, relevant transport/evaluation source, and installed SDK code.
- The note is dated October 9; this check ran on October 8 according to the machine clock. Its filename is not evidence that any release hold has ended.

## Verdict: ACCEPT

**Findings: 0 high, 0 medium, 0 low.** Finding 1 is resolved. No required code change remains within this fix-check scope. This verdict is not merge, push, activation, or deployment approval.

## Checks and evidence

The only test command run was:

```text
pnpm --filter @hyphae/api exec vitest run src/scoring src/rewards/evaluation-claude.test.ts src/rewards/evaluation-jev.test.ts --maxWorkers=1
```

Exit 0: **226 tests passed across 16 files**, duration **18.30 seconds**. Included Claude transport 11, Claude evaluation 9, Jev evaluation 14, and Claude registry 7. Evaluation fixtures use local PGlite. No full suite, `test:pg`, typecheck, or lint was run.

An inline offline Node probe imported the unchanged `claudeTransport` through `tsx`, supplied a fake key and mocked fetch, and returned JSON headers immediately. It created no file and made no network request. It checked that the HTTP JSON body equals the supplied request and that no additional request or body delivery occurred after settlement.

| Probe | Deadline | Body schedule | Result |
|---|---:|---:|---|
| Original reproduction shape | 40 ms | Complete body after 300 ms | Rejected at **52 ms** with `claude: no complete response within 40 ms`; cause `AbortError`; **1 request**, signal aborted, body delivery cancelled, body never completed. |
| Completion and timer disposal | 80 ms | Complete body after 10 ms | Resolved at **16 ms**; **1 request**; no abort after waiting beyond the deadline. |

The original review recorded the first shape resolving successfully at 307 ms without an abort. This check independently reran the fixed transport; it did not rerun the old revision or mutate tracked code. The builder's separate real-fetch loopback probe was read but not independently repeated.

`git diff --check origin/next..dd1d831` passed. The diff contains only `claude-client.ts`, `claude-client.test.ts`, and `evaluation-claude.test.ts`. The worktree was clean before the review; this ignored report is the only file created by the worker.

## What was checked and found sound

- **Deadline lifetime and cancellation.** `apps/api/src/scoring/claude-client.ts:29` creates a fresh controller and timer inside each call, before invoking the SDK. `:36` awaits `messages.create` with the caller signal; `:48` clears the timer in `finally` after success or failure. There is no abandoned `Promise.race`. The installed `@anthropic-ai/sdk` 0.128.0 forwards the signal to its fetch controller (`client.mjs:637`), retains that listener after headers, and removes it only after non-streaming body parsing settles (`internal/parse.mjs:29` and `:34`). HTTP error-body consumption also retains the listener until the read settles (`client.mjs:602` and `:613`). The mock probe confirms the signal reaches the body read and cancels its outstanding delivery.
- **Failure accounting and retry fence.** The deadline rejection reaches the existing catch at `apps/api/src/rewards/evaluation.ts:743`, which records `pending_reconciliation`. No returned body means no fabricated output, cost, or scoring decision. The new integration test at `evaluation-claude.test.ts:174` exercises the real transport, checks the deadline error and null output, runs evaluation twice, and verifies one request and zero decisions. `maxRetries: 0` is unchanged at `claude-client.ts:24`; existing pre-header timeout and HTTP 500/529/429 tests still pass. Existing-dispatch handling at `evaluation.ts:691` prevents an automatic second provider call.
- **Request and pin preservation.** The signal is a request option, not part of the Messages body. Both the existing transport equality test and the independent probe check the actual serialized request. `claude-registry.test.ts:55` still pins `48dabec502358a3a2a26365d6a8c19a27d8505055f4c49aecb989864890b047d`, and all seven registry tests pass. No registry, prompt, question set, composition, price, or dependency file changed. The SDK timeout value and 90-second production constant are preserved.
- **Regression-test relevance.** The stalled-body test at `claude-client.test.ts:127` checks rejection near the shortened deadline, signal abort, body cancellation and exactly one request. The slow-chunk test at `:147` requires partial progress, cancellation before completion, and no additional chunks after rejection. The timely-body test at `:163` guards successful completion. Critical reading against the original implementation confirms the two body-deadline tests would resolve late instead of rejecting; the evaluation regression would complete instead of park. The timely-body guard should pass both versions. No claim is made that this reviewer independently performed a red run.
- **Jev SDK claim verified.** The installed package is `@typesafe-ai/sdk` **0.6.0**. In `apps/api/node_modules/@typesafe-ai/sdk/dist/index.mjs:628`, `attempt` arms a single timer before fetch, awaits `bufferResponse` at `:645`, and clears the timer only in `finally` at `:659`. `bufferResponse` at `:459` reads a response clone under the same signal, cancels both reader and original body on abort, and checks the signal before and after reading. Expiry maps to `APITimeoutError` at `:654`. `apps/api/src/scoring/jev-client.ts` supplies 30 seconds and zero retries. The builder's buffering claim is supported; no separate Jev deadline finding was identified. This was source inspection plus existing Jev tests, not an additional live Jev call.

## Operator wording: the two open questions

1. **Keep the no-retry policy; describe billing as uncertain.** The note's phrase “a deadline after the headers means Anthropic answered, so the call is probably billed” is too strong as a general statement: headers alone do not establish a completed model response or billing outcome. Use “the request may have reached the provider and may have been billed; a timeout is not proof of non-dispatch.” This is a non-blocking wording clarification. The new error makes no billing claim, and retaining an uncertain call for reconciliation is correct. `recordNotSentProven` (`evaluation.ts:611`) still accepts an operator assertion only on a pending row with null output; it does not itself verify provider evidence. The script requires an audit reason and describes the proof requirement. Neither a null body nor this timeout error supplies that proof. No automatic budget release was added by this fix.
2. **The new error text is accurate.** `claude: no complete response within 90000 ms` describes both pre-header and mid-body expiry without asserting that nothing was sent. The original SDK error is retained as `cause`; the existing dispatch path stores the outer string. A search of application source and scripts found no consumer parsing the previous `Request timed out.` literal or the new message. No operator-facing code change is needed for this fix.

## Handoff

**Next:** the coordinator records this ACCEPT verdict for `dd1d831`, carries the billing-wording clarification into its operator checkpoint if needed, and proceeds only within existing integration/release authorization. Other scorer rollout rulings, founder approvals and release holds remain outside this check.

The worker was explicitly authorized to write only this ignored report. No tracked handoff/build log was modified, no commit or push was made, and no production service, provider, database, Telegram endpoint, wallet, or external network was contacted. The coordinator owns the canonical tracked handoff and build-log update.

### Suggested skills

`the-analyst` for evidence and operator wording; `superpowers:verification-before-completion` for any subsequent integration milestone; `handoff:handoff` for the coordinator's tracked checkpoint. Orca reporting follows the `orchestration` and `orca-cli` skills.

### Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Independent fix-check report | `docs/plans/review-scorer-fix.md` | Ignored review artifact; coordinator must carry the verdict into its portable tracked checkpoint. |

No credentials, deployed resources, scheduled jobs, or probe files were created.

### Next-session prompt

```text
The independent fix check accepts dd1d831's whole-call Claude deadline on scorer-fix; 226 permitted tests passed and the delayed-body probe rejected at 52 ms with a 40 ms deadline, one request and body cancellation. This is local review evidence, not release authorization.

Files: docs/plans/review-scorer-fix.md, docs/handoffs/2026-10-09-scorer-fix.md, docs/HANDOFF.md, CLAUDE.md
Model: the coordinator's current model and effort; no new model selection is required for recording this verdict.
Skills: the-analyst, superpowers:verification-before-completion, handoff:handoff

Record the ACCEPT verdict in the canonical tracked checkpoint, preserve the uncertain-billing proof requirement and existing holds, and continue the authorized integration arc.
```
