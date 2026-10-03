# Community setup final independent fix check

**Verdict: APPROVE** for the final code in `072e99b..cd4c4ef`. F1 and F2 are fully fixed, and I found no defect in the rest of the setup integration. I have three informational notes and no actionable findings.

This review was read-only. I ran no tests, services or providers, and I edited nothing. Every test count below is your reported evidence.

## F1: the reviewed database target is pinned in the driver — fixed

- **Explicit port:** a missing port is refused (`cli.ts:80`).
- **Ambiguous authority refused:** a comma, more than one raw `@`, or any whitespace is rejected (`cli.ts:67-74`).
- **Connection overrides refused:** the URL may carry at most one query parameter, and only `sslmode=require|verify-full` (`cli.ts:88-92`).
- **The pinning is the real guarantee; the URL checks are a second layer.** `verifyDatabaseTarget` returns the host, port and database from the manifest, not from the URL (`cli.ts:98-103`). The script passes that target straight into `createDb(url, target)` (`scripts/community-setup.ts:25-26`), which spreads it into the postgres-js options (`packages/db/src/index.ts:19`). In postgres-js 3.4.9, explicit options take priority over both the URL and the environment:
  - host: `o.host` comes before the multi-host value, the URL host and `PGHOST` (`index.js:438`);
  - port: `o.port` comes before the URL port and `PGPORT` (`index.js:439`), and the port mapping falls back to it (`index.js:467`);
  - database: `o.database` comes before the URL path and `PGDATABASE` (`index.js:469`).

  The manifest only allows hosts matching `^[a-z0-9.-]+$` (`manifest.ts:46`), so the pinned host can't trigger the driver's comma or `:` splitting or its Unix-socket path (`index.js:466-468`). Even if the URL check and the driver's own URL parsing disagreed, the driver would still connect to the reviewed target. Credentials still come from the URL or `PGUSER`/`PGPASSWORD`, which is acceptable because they don't choose the target.
- **Existing callers unchanged:** every other `createDb(url)` call (`db.ts:4`, `demo-seed.ts`, the pg tests) gets `{ ...undefined, max: 10, prepare: false }`, the same options as before. The target is spread first, so it can't override `max` or `prepare`. I'm relying on the code here; I didn't diff the base.
- **Tests:** an implicit port is refused, the comma plus two-`@` case is refused, and a test confirms an ambient `PGPORT=55432` is ignored in favour of the pinned port 55433 (`cli.test.ts:11-48`).

## F2: remote production requires verified TLS — fixed

- Remote production (not localhost or 127.0.0.1) requires `sslmode=verify-full`; a missing mode or `require` is refused (`cli.ts:95-97`, tested at `cli.test.ts:50-67`).
- The target also carries `ssl: "verify-full"`. Because the option is set explicitly, it takes priority over the URL query and `PGSSL` (`index.js:474`).
- In `connection.js:275-286`, the string `"verify-full"` keeps Node's default certificate checking (`rejectUnauthorized` stays on) and sets `servername` to the host. If the server refuses TLS, the connection still attempts TLS and fails, so it fails closed.

## The rest of the setup integration — accepted

- **Operator vs community authority:** `approvalReference` is an unverified attestation, and both the plan output and the guide say so. Telegram checks are read-only and confirm the exact bot, a group or supergroup, the bot as administrator, and a designated admin who is a non-bot creator or administrator with a matching ID (`telegram.ts:25-54`). The new cases with the wrong ID and with `is_bot: true` are covered (`telegram.test.ts:7-21`). Provider errors are replaced by a fixed code.
- **Strict and discarded fields:** the top-level schema is strict, a canonical comparison catches fields that nested schemas would silently drop (`manifest.ts:88`), and the rubric must belong to this community.
- **Full-plan receipt:** the plan hash covers the whole manifest, including the database target. The hash is checked before any Telegram call (`registration.ts:114`). The receipt `setup:<ref>:<hash>` is stored in the bootstrap proposal and checked on replay (`registration.ts:73`). A changed port, approval reference or bot ID is reported as a conflict (`registration.test.ts:117-135`).
- **Locking:** three advisory locks are taken in sorted order, then rows are locked with `for no key update`, then the database clock is read (`registration.ts:120-131`). Real-Postgres tests cover identical concurrent requests over five rounds, plus concurrent conflicting mint and chat bindings.
- **Atomic pinned bootstrap, paused, no payments:** the community insert and `bootstrapRewardEpochs` run in one transaction, and rollback is tested with a trigger. Intake is paused at the insert time. `firstPaidEpoch` and `chainAddress` stay null. `admitContribution` returns `paused`, so the legacy scoring path is excluded (`registration.test.ts:71-101`).
- **Activation after a lock wait:** activation is checked against the database clock after the locks are held (`registration.pg.test.ts:108-146`). An exact replay after activation has passed returns `existing` for both `check` and `apply` (`:41-56`).
- **Unknown COMMIT:** any error that isn't a setup error becomes `setup_outcome_unknown`. The test reconciles to `existing` with a single epoch (`:92-106`).
- **F3:** the guide documents it accurately (`SETUP-INTEGRATION.md:78`), including that another registration must never be overwritten to recover. It is fail-closed, as accepted.

## Informational notes (nothing blocks approval)

1. **Untested TLS pin.** `cli.test.ts:50-67` doesn't check that the returned target, or `db.$client.options.ssl`, contains `"verify-full"`. If `cli.ts:102` were later deleted, no test would fail. Verification would still happen, because the required URL `sslmode=verify-full` reaches the driver through the query (`index.js:443,474-476`). This is a small test gap, not a defect.
2. **No TLS required on loopback production.** Production on localhost or 127.0.0.1 doesn't require TLS (`cli.ts:95-97`). This matches the disposition (non-loopback only) and the target is bound into the manifest hash. Noting it only so the choice is visible.
3. **`.env.example` not verified by me.** Reading it was denied by permissions, so the F4 resolution (`# COMMUNITY_SETUP_DATABASE_URL=`, environment test 2/2) rests on your evidence. The plan text (`plan.md:13`) is consistent with it.

## Code acceptance vs production authorization

- **Code:** approved. This depends on the final full gate and the 50-test real-Postgres suite, which you said were still running, coming back green.
- **Production:** not authorized by this review. Each real production `apply` is still a separate production data operation. It needs its own external operator verification of the community and mint authority, and the explicit `production` label in both the manifest and the command. No production apply or real group has been run. There is no browser provisioning endpoint and no admin UI, and none is claimed.

## Reviewer metadata

- **Model:** `claude-opus-5-5`, read from the session environment. Effort and thinking settings aren't visible to me, so the requested high effort is unconfirmed.
- **Tools:** Read, Grep and Glob only; no helpers spawned. The pre-existing Codex-built arc means this is an other-family review.
- **Connectors:** the Vercel, Gmail, Google Drive, Genie Agent and test connectors are unauthorized and unavailable in this session. None was needed.

## Observable execution metadata

Requested: installed Opus alias, high effort, fresh read-only session. Named effort remains requested unless independently evidenced.

```json
{
  "exit_code": 0,
  "is_error": false,
  "session_id": "76f477a2-7258-4cd3-bdce-ba9693004636",
  "num_turns": 26,
  "duration_ms": 135480,
  "duration_api_ms": 133468,
  "usage": {
    "input_tokens": 24,
    "cache_creation_input_tokens": 71387,
    "cache_read_input_tokens": 553593,
    "output_tokens": 14031,
    "output_tokens_details": {
      "thinking_tokens": 8369
    },
    "server_tool_use": {
      "web_search_requests": 0,
      "web_fetch_requests": 0
    },
    "service_tier": "standard",
    "cache_creation": {
      "ephemeral_1h_input_tokens": 71387,
      "ephemeral_5m_input_tokens": 0
    },
    "inference_geo": "not_available",
    "iterations": [
      {
        "input_tokens": 2,
        "output_tokens": 4439,
        "cache_read_input_tokens": 73780,
        "cache_creation_input_tokens": 608,
        "cache_creation": {
          "ephemeral_5m_input_tokens": 0,
          "ephemeral_1h_input_tokens": 608
        },
        "type": "message"
      }
    ],
    "speed": "standard",
    "fallback_credit": null
  },
  "modelUsage": {
    "claude-opus-5-5": {
      "inputTokens": 24,
      "outputTokens": 14031,
      "cacheReadInputTokens": 553593,
      "cacheCreationInputTokens": 71387,
      "webSearchRequests": 0,
      "costUSD": 0.9625306,
      "contextWindow": 1000000,
      "maxOutputTokens": 128000,
      "thinkingTokens": 8369,
      "canonicalModel": "claude-opus-5-5",
      "provider": "firstParty",
      "costBasis": "list"
    }
  },
  "total_cost_usd": 0.9625306
}
```
