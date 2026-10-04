# @hyphae/read-client

Read-only ESM client for Hyphae's public API v1. Node 22+ and modern browsers with Fetch/AbortController are supported. The package is **private and locally packed**; it has not been published to npm. It bundles the existing consumer response schemas and has one runtime dependency, Zod 4.6.5. No workspace, database, Solana or scoring package is needed by an adopter.

## Build and install locally

From the Hyphae repository root:

```sh
pnpm --filter @hyphae/read-client pack --out dist/hyphae-read-client-0.1.0.tgz
```

In a separate ESM project, install the resulting file:

```sh
pnpm add /absolute/path/to/hyphae-read-client-0.1.0.tgz
```

```js
import { createHyphaeReadClient, HyphaeReadError } from "@hyphae/read-client";

const client = createHyphaeReadClient();
try {
  const mint = "HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg";
  const community = await client.getCommunity(mint);
  const epoch = community.current_epoch === null
    ? null
    : await client.getEpoch(mint, community.current_epoch);
  console.log(community.name, epoch?.settlement);
} catch (error) {
  if (!(error instanceof HyphaeReadError)) throw error;
  console.error(error.code, error.status, error.retryAfterSeconds);
}
```

Use `examples/consumer.mjs` from this repository as a runnable separate-project example. Supply any already registered mint; an unknown mint is `not_found`, with no Lab fallback.

## Operations

| Method | Arguments |
|---|---|
| `getCommunity` | `mint`, optional `{ signal }` |
| `getEpoch` | `mint, index`, optional `{ signal }` |
| `getContributions` | `mint, index`, optional `{ offset, limit, member, signal }` |
| `getLeaderboard` | `mint, index`, optional `{ offset, limit, signal }` |
| `getContribution` | contribution UUID, optional `{ signal }` |
| `getClaim` | `mint, index, wallet`, optional `{ signal }` |
| `getWalletClaims` | wallet, optional `{ offset, limit, signal }` |

Epoch indexes 1–999999999, pagination offset 0–999999999, limit 1–100 (default 50). UUIDs normalize to lowercase. Method arguments follow the existing API validators; response identity and pagination must match the request. Mint-scoped reads never substitute a default community. Wallet claims may span communities and legitimately be empty.

## Request and response behavior

`createHyphaeReadClient({ baseUrl, fetch, timeoutMs })` defaults to `https://hyphae-api.fly.dev/v1` and a 10-second deadline. The base must end in `/v1`; HTTPS is required except for loopback HTTP development. URL credentials, query strings and fragments are rejected. Requests are GET, omit credentials, refuse redirects and use `cache: "no-store"`, including claims. No ambient tokens or configurable authorization headers are used. The SDK races fetch/body promises against cancellation, so a custom implementation cannot keep the caller waiting beyond the deadline. It must still honor AbortSignal to stop its own underlying work.

The deadline remains active through body reading. Caller abort signals are supported per operation; timers/listeners are cleaned up, including when a custom transport ignores cancellation. `HyphaeReadError.code` distinguishes invalid configuration/input, cancellation, timeout, network failure, HTTP bad request/not found/rate limit/unavailable/other error, invalid JSON, schema mismatch and identity mismatch. HTTP errors carry status. A 429 carries `retryAfterSeconds` when a readable numeric/HTTP-date Retry-After is present. There are **no automatic retries**. Browser CORS rules may hide that header; the rate-limit error remains available.

Responses use `ReadApiV1Loose` from the canonical contract. Added v1 fields are tolerated; optional newer fields may be absent. Exact units/lamports stay decimal strings. Unavailable/pending states remain explicit, never coerced to zero, paid or eligible. Schema validation is not independent chain or Merkle-proof verification. Returned text is untrusted content; render it as text, not HTML.

This client neither registers communities nor authenticates owners, changes rewards, signs wallets or constructs/sends transactions. A fresh claim read provides the existing API's data; transaction approval/verification remains the adopter's separately scoped responsibility.

## Verification

```sh
pnpm --filter @hyphae/read-client test
pnpm --filter @hyphae/read-client typecheck
pnpm --filter @hyphae/read-client verify:package
```

`verify:package` builds/packs, installs the tarball in a temporary project outside the workspace with scripts disabled and offline dependencies, checks declarations, exercises all seven reads and two communities against local fixtures, and bundles an installed consumer for browsers. It retains the tarball and report under ignored `dist/`, and removes the temporary consumer/server. Local fixtures are not device, production or payment proof.

For actual Chromium execution across separate page/API origins, use an existing Playwright installation's `index.mjs` path; no browser/package is installed by this check:

```sh
pnpm --filter @hyphae/read-client verify:package --browser /absolute/path/to/playwright/index.mjs
```

Without `--browser`, the report labels Chromium `NOT_RUN`; bundling alone is not browser execution. Build inputs reuse existing locked dependency versions. The license is the repository's unchanged BUSL 1.1, copied into the packed artifact. Publishing remains separately authorized.

Contract/build references: [public OpenAPI](https://hyphae-api.fly.dev/v1/openapi.json), [pnpm pack](https://pnpm.io/cli/pack), [tsup](https://tsup.egoist.dev/), [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).
