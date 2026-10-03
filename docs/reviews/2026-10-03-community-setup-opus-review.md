# Community setup independent review

**Verdict: APPROVE** for the reviewed range `8f395b4..2ca3505`, scoped to local and disposable operator use. I found no defect in registration, locking, atomicity or reconciliation. Fix F1 and F2 before the first production `apply`: both are in how the CLI checks the production database connection.

This was a read-only review with Read, Grep and Glob. I edited nothing and ran no tests, services or providers. The green suites are your reported results, not mine. Plan mode asked me to write a plan file and exit plan mode, but those tools weren't available, and your brief forbids writing files anyway, so the review is only here.

## Findings, by severity

**F1 — Low (fix before production): the database-target check and the database driver can read the URL differently.**
`apps/api/src/community-setup/cli.ts:66-72` checks the URL with the standard `new URL` parser. The driver (`postgres@3.4.9`) parses it its own way, in `node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js:436-469,537-557`. Two concrete ways they disagree, worked out by reading the code (not run):
- **Missing port.** If the URL has no port, `cli.ts:71` assumes 5432, but the driver uses the `PGPORT` environment variable first (`index.js:439`). An operator with `PGPORT=55433` exported for local Docker, using `postgres://u:p@localhost/hyphae`, passes the check against `port: 5432` but connects to 55433. The same applies to a production host on a non-default port.
- **Comma host list.** In `postgres://u@evil.example,x@db.prod.example:5432/hyphae`:
  - the standard parser splits at the last `@`, so it sees `db.prod.example` and the check passes;
  - the driver splits at the first `@`, reads `evil.example,x@…` as a list of hosts, and connects to `evil.example` first.

This needs a crafted or badly broken URL in the operator's own private env file, so it is Low. It still breaks the comment's promise that the target stays bound to the reviewed host, port and database.
*Recommended fix:* require an explicit port, reject `,` and any `@` before the last `@` in the authority, and pass the reviewed host, port and database to `postgres()` as explicit options rather than trusting the URL string. Add tests for both cases.

**F2 — Low/Medium (production hardening): production connections can skip TLS or skip certificate checks.**
`cli.ts:78-82` accepts a URL with no `sslmode`, which means plaintext unless `PGSSL` is set (`index.js:450,476`). It also accepts `sslmode=require`, which in postgres.js turns off certificate verification (`connection.js:283-284`). So the host-name check doesn't prove which server is actually answering. Anyone in the network path could intercept production write credentials, or relay the session (SCRAM without channel binding doesn't stop that).
*Recommended fix:* for `environment: "production"` with a non-loopback host, require `sslmode=verify-full`. Test it.

**F3 — Low (operational, fails safe): reconciliation compares fields that change after setup.**
The setup receipt itself never changes: the bootstrap proposal's `proposedBy` is written once. But `inspect` (`registration.ts:32-43`) also requires the community's current `telegramChatId`, `name`, `adminTelegramUserId`, `rubricVersion` and `rubric` to still match the manifest. Normal later changes break that match:
- An ordinary group upgraded to a supergroup gets a new chat id, which `bot/chat-migration.ts:16` writes back. Plain groups are explicitly accepted (`telegram.test.ts:17`), so this is likely.
- A later rubric staging rewrites the rubric (`rewards/staging.ts:45`).

After either one, `check` or an exact replay of `apply` returns `registration_conflict` for a community that was registered correctly. Also, `check` calls Telegram before it reads the database, so a Telegram outage or a demoted bot blocks reading back a lost COMMIT. Nothing gets written wrongly. Recovery right after a lost acknowledgement works. *Recommendation:* document both limits in `SETUP-INTEGRATION.md` §Idempotency and recovery.

**F4 — Info (doc mismatch):** the plan (`docs/superpowers/plans/2026-10-03-community-setup-plan.md:13`) says an empty operator variable was added to `.env.example`. No `.env.example` exists in the repo. Correct the plan text.

## Guarantees I confirmed in the source

- **Strict manifest:** `.strict()` at the top level, plus a check that the parsed object canonicalises to exactly the input, catches fields that nested schemas would silently strip (`manifest.ts:88`). Other checks:
  - rubric community must equal the name; bot and admin must differ;
  - weights sum to 1 and criterion keys are unique;
  - the prompt pin must be registered;
  - activation must be on a whole second.
- **Plan hash:** `sha256(canonicalJson(manifest))` covers environment, database, bot, approval reference and the exact activation string.
  - The hash is checked before any Telegram call (`registration.ts:114`, tested).
  - The CLI requires the command's environment to equal the manifest's.
- **Query overrides:** only one `sslmode` value is allowed. Note that a query key the driver doesn't recognise would become a connection parameter (`index.js:487`), and the check correctly blocks that.
- **Telegram:** read-only calls (`getMe`, `getChat`, `getChatMember`). The chat must be a group or supergroup, the bot must be an administrator, and the admin must be a non-bot creator or administrator. Provider errors are replaced by a fixed code (`telegram.ts:49-53`). Group admin status is explicitly not treated as proof of mint authority.
- **Locking:** three advisory locks (UUID, mint, chat) taken in sorted order, so concurrent setups can't deadlock; then a row lock; then the database clock is read. Overlapping requests are serialised. Unrelated writers fall back to the unique constraints, which surface as `setup_outcome_unknown` and roll back.
- **Atomicity:** the community insert and the nested `bootstrapRewardEpochs` (a savepoint) are one transaction, so a community can't commit without its pinned epoch. That matters because `hasRewardLane` is just "an epoch exists", and without one `/submit` would take the legacy scoring path. Intake starts paused, `admitContribution` returns `paused`, and `/effort` and nominations are paused too.
- **No payments:** `firstPaidEpoch` and `chainAddress` stay null, so the payout gate blocks (`payout/gate.ts:231`) and publishing refuses (`publish.ts:94`).
- **Activation after a lock wait:** checked against the database clock after the locks are held, and tested.
- **Lost COMMIT:** any error that isn't a setup error becomes `setup_outcome_unknown`, never "rolled back". A retry is safe because a replay takes the same locks and returns `existing`.
- **Tests:** they cover these properties. One weakness: the lost-COMMIT test only simulates the error after a real commit.
- **Test gaps, no defect found:**
  - none of the F1/F2 URL cases;
  - Telegram admin with `is_bot: true` or a mismatched id;
  - exact replay after activation has passed.

## Accepted private-operator limits (not defects)

- `approvalReference` is an unverified text attestation; authority rests on the operator's credentials.
- Telegram is checked before the database transaction, so state can change in between.
- Errors before `BEGIN`, and the bootstrap's own internal time check (`config.ts:373`), report `setup_outcome_unknown` rather than a more specific code. That's conservative and always rolls back.
- No unpause, Organic integration, self-service or production registration is claimed, and none is implemented.

## Reviewer metadata

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`), from the session's environment. Claude is a different model family from Codex, assuming Codex built this arc.
- **Effort/thinking settings:** not visible to me, so I can't state them.
- **Unavailable connectors:** Genie Agent, Gmail, Google Drive, test and Vercel need authorising before they can be used. Do that in claude.ai connector settings, or with `/mcp` in an interactive session.

## Observable execution metadata

Requested: installed Opus alias, high effort, fresh read-only session. Named effort is requested, not independently confirmed.

```json
{
  "exit_code": 0,
  "is_error": false,
  "session_id": "7e515db6-4b70-4811-9549-f0c13272210b",
  "num_turns": 38,
  "duration_ms": 268715,
  "duration_api_ms": 263083,
  "usage": {
    "input_tokens": 46,
    "cache_creation_input_tokens": 99047,
    "cache_read_input_tokens": 1596187,
    "output_tokens": 26153,
    "output_tokens_details": {
      "thinking_tokens": 18570
    },
    "server_tool_use": {
      "web_search_requests": 0,
      "web_fetch_requests": 0
    },
    "service_tier": "standard",
    "cache_creation": {
      "ephemeral_1h_input_tokens": 99047,
      "ephemeral_5m_input_tokens": 0
    },
    "inference_geo": "not_available",
    "iterations": [
      {
        "input_tokens": 2,
        "output_tokens": 8248,
        "cache_read_input_tokens": 98482,
        "cache_creation_input_tokens": 565,
        "cache_creation": {
          "ephemeral_5m_input_tokens": 0,
          "ephemeral_1h_input_tokens": 565
        },
        "type": "message"
      }
    ],
    "speed": "standard",
    "fallback_credit": null
  },
  "modelUsage": {
    "claude-opus-5-5": {
      "inputTokens": 46,
      "outputTokens": 26153,
      "cacheReadInputTokens": 1596187,
      "cacheCreationInputTokens": 99047,
      "webSearchRequests": 0,
      "costUSD": 1.6348574000000002,
      "contextWindow": 1000000,
      "maxOutputTokens": 128000,
      "thinkingTokens": 18570,
      "canonicalModel": "claude-opus-5-5",
      "provider": "firstParty",
      "costBasis": "list"
    }
  },
  "total_cost_usd": 1.6348574000000002
}
```
