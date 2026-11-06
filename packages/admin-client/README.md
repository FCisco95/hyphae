# @hyphae/admin-client

Private, local workspace TypeScript package for the Hyphae administration API.
It is not published. Building or installing the package does not enable the API:
the server must separately enable `ADMIN_API_ENABLED=on`. An older or disabled
API returns `not_found`. Web controls have their own activation flag.

## Use

```ts
import { createHyphaeAdminClient, HyphaeAdminError } from "@hyphae/admin-client";

const admin = createHyphaeAdminClient({
  baseUrl: "https://your-api.example/admin/v1",
  getAccessToken: () => session.getAccessToken(),
  timeoutMs: 10_000,
});

const current = await admin.getCommunity(mint, { signal });
try {
  // Ask the administrator to confirm before calling this mutation.
  const updated = await admin.setIntakePaused(mint, {
    paused: true,
    expected_paused_at: current.intake.paused_at,
  }, { signal });
} catch (error) {
  if (error instanceof HyphaeAdminError && error.code === "conflict") {
    // Refresh the authenticated overview; obtain confirmation again before resubmitting.
  } else {
    throw error;
  }
}
```

`session`, `mint`, and `signal` above come from the integrating application.
`getAccessToken` is required and called once for every request. It must return
the current **app-bound Privy user credential**, or `null` when logged out. The
SDK does not persist tokens. A technical web token is not an admin credential.
A wallet alone does not grant admin access: the server verifies current Telegram
identity, the community's designated admin, and live group administrator status.
The client accepts compact JWT syntax only: exactly three nonempty base64url
segments and at most 4096 characters, matching the API and browser proxy. It
does not verify signatures or establish those permissions.

## Contract

- `getCommunity(mint, { signal? })`: `GET /admin/v1/communities/:mint`.
- `setIntakePaused(mint, update, { signal? })`:
  `PUT /admin/v1/communities/:mint/intake` with exactly
  `{ paused: boolean, expected_paused_at: string | null }`.
- Both return `AdminCommunity`: community mint/name, intake pause state and UTC
  timestamps. Canonical core schemas are bundled; responses are validated strictly
  and must match the requested mint. Mint selectors are 1–64 ASCII alphanumeric characters.
- Pause controls **new submissions only**, not payouts. Copy `expected_paused_at`
  from the latest authenticated overview. Conflicts require a refresh; writes
  have no application-level automatic retry. Repeating a pause preserves the server timestamp.

The required `baseUrl` ends in exactly `/admin/v1` (a trailing slash is accepted).
HTTPS is required except HTTP on `localhost`, `127.0.0.1`, or `[::1]`. Credentials,
query strings and fragments in the base URL are rejected. An optional `fetch`
implementation must implement the standard Fetch API and honor request settings.

Requests omit cookies, reject redirects and disable caching. Each SDK operation makes one Fetch
call with no application-level retry loop; the HTTP transport may independently replay a request.
Timestamp CAS rejects stale updates; read the authenticated current state after an uncertain result
before confirming another change. One deadline covers token retrieval, fetch, and body consumption;
the default is
10 seconds. Callers may also abort any operation with `signal`. Responses are
limited to **16 KiB of bytes**, including streamed bodies without Content-Length.
Abort/deadline stops this client waiting and cancels its transport; it cannot
undo a server write already accepted, so refresh before deciding whether to submit again.
For `setIntakePaused`, `unavailable`, `timeout`, `network_error`, `aborted`, `http_error`
for a gateway 5xx, or an unreadable response can mean **outcome unknown**: read current state before deciding
on another deliberately confirmed change.

`HyphaeAdminError` exposes `code`, optional HTTP `status`, and optional
`retryAfterSeconds` for 429. HTTP mappings: 400 `bad_request`, 401 `unauthorized`,
403 `forbidden`, 404 `not_found`, 409 `conflict`, 429 `rate_limited`, 503
`unavailable`, otherwise `http_error`. Other codes: `invalid_configuration`,
`invalid_input`, `token_error`, `aborted`, `timeout`, `network_error`,
`response_too_large`, `invalid_json`, `schema_mismatch`, `identity_mismatch`.
Server bodies and original exception messages are not included in errors.
Request-input/configuration errors throw synchronously; transport/authentication
and response errors reject the operation's promise.

## Local verification

The built package exports `@hyphae/admin-client/openapi.json`, a standalone OpenAPI 3.1
contract for tooling. Resolve it with `import.meta.resolve("@hyphae/admin-client/openapi.json")`
or read `dist/openapi.json` after building. It includes strict canonical schemas, pause
timestamp consistency, bearer authority, CAS and error/recovery semantics. No deployed
server URL is assumed; this artifact creates no runtime endpoint or API activation.

```sh
pnpm --filter @hyphae/admin-client test
pnpm --filter @hyphae/admin-client typecheck
```

The ESM build and declarations include the canonical admin schemas and require
only `zod` at runtime. Tests use isolated fake transports and an in-process Hono
contract fixture; they make no production calls and do not verify live Privy or
Telegram permissions. API authorization and lock/concurrency verification belong
to the API suite.
