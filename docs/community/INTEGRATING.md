# Integrating a token community or launchpad

Hyphae already has a public read API and reviewed operator-assisted community setup. Start with those interfaces. The reusable reader below is a **local repository example**, not a published SDK or a self-service registration API. It requires no production credentials and performs only public GET requests.

## Run the example

From the repository root with its frozen-lockfile dependencies installed:

```sh
pnpm --filter @hyphae/api exec node --import tsx scripts/read-community.ts HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg
```

Replace the mint with another **already registered** community's mint. The example reads that community, then the current epoch reported by the API; it checks both response identities. A community with no current epoch returns `epoch: null`. An unknown community exits nonzero with `not_found` rather than returning Lab data.

An optional second argument selects an explicit API base, ending in `/v1`:

```sh
pnpm --filter @hyphae/api exec node --import tsx scripts/read-community.ts <registered-mint> http://127.0.0.1:8787/v1
```

HTTPS is required except for local loopback development. Credential-bearing URLs, query strings, redirects and ambient API tokens are refused or omitted. Each request has a ten-second deadline. There are no automatic retries: a `429` reports `rate_limited`, its HTTP status and numeric `retry_after_seconds` when supplied. The caller waits before deliberately retrying. Network, JSON and schema failures exit nonzero; provider exception details are not printed.

The example validates responses with the existing **consumer** schemas, `ReadApiV1Loose` in `packages/core/src/read-api.ts`. Added v1 fields are tolerated, and optional newer fields may be absent. Unknown/unavailable payment states remain unknown/unavailable. Exact point-unit and lamport strings are retained; do not coerce them to JavaScript numbers.

This repository example runs with its installed `tsx`, `@hyphae/core` and `zod` dependencies. It is not yet an independently installable npm package. Its callable `readCommunity` function accepts an explicit fetch implementation, which lets consumers exercise failures and two-mint isolation without credentials or production writes.

## Choose the interface

| Need | Existing interface | Boundary |
|---|---|---|
| Community name, intake and epochs | `GET /v1/communities/{mint}` | Registration must already exist; public data does not prove owner authority. |
| Epoch rules, counts, totals and settlement | `GET /v1/communities/{mint}/epochs/{index}` | Show allocation/payment only with the returned evidence stage. |
| Contributions and selected judgements | `GET /v1/communities/{mint}/epochs/{index}/contributions` | Paginate using `offset`/`limit`; preserve pending and excluded states. |
| Leaderboard | `GET /v1/communities/{mint}/leaderboard?epoch={index}` | Points are not payments. |
| Full contribution audit | `GET /v1/contributions/{id}` | Retain revisions, provenance and correction timing. |
| A wallet's published leaves | `GET /v1/wallets/{wallet}/claims` | Empty results are valid; payment may be unavailable. |
| One fresh claim | `GET /v1/communities/{mint}/epochs/{index}/claims/{wallet}` | Transaction preparation/signing is outside this reader. Re-read immediately before a separately authorized claim. |
| Register a real new community | Reviewed operator `plan` → `check` → authorized `apply` | See [setup integration](SETUP-INTEGRATION.md); exact private authority, manifest, target and hash, paused pinned bootstrap. |

The live contract is [OpenAPI v1](https://hyphae-api.fly.dev/v1/openapi.json), with a [rendered reference](https://hyphae-api.fly.dev/docs). Source is `apps/api/src/http/openapi.ts`, generated from the shared response schemas; existing tests compare documented and served routes. HTTP errors are not zero-valued success responses. A generated type alone cannot replace runtime validation or independent chain-proof verification.

## Connect a launchpad

A launchpad can consume the public audit API for any registered mint without a Hyphae-specific user login. Display that mint's name, rules, contribution audit and honest settlement state; link to `/c/<mint>` for the full audit. Keep each token's Telegram contribution group and settings separate.

For setup, the launchpad's owning server must establish the actor's authority over the exact mint and permitted settings/actions. Telegram administration and a public mint page do not prove that authority. Carry the verified authority reference into the existing operator procedure. An authenticated provisioning transport, scoped expiry/replay handling and owner editor still require their own contract; this example adds none.

Organic's current permitted interface from Hyphae remains its public settlement GET `/api/launchpad/coins/mint/[mint]/settlement`. Organic's owner-authority/settings work stays in its existing task **3.6 / DEP-09**. Another launchpad would own the equivalent authority adapter in its own project. No cross-project write or real registration is needed to run this reader.

## Local standalone read-only SDK

Cisco approved the bounded local SDK milestone. **@hyphae/read-client0.1.0 is built and privately packed**, with seven typed GET operations, ESM JavaScript and declarations. A clean project outside the workspace installed its tarball with scripts disabled, checked its types, and ran all seven operations and two community identities in Node and actual desktop Chromium against local fixtures. Package publication remains separate.

See [SDK documentation](../../packages/read-client/README.md) for installation, all method signatures, cancellation/deadline/error behavior and package verification. From the repository root:

```sh
pnpm --filter @hyphae/read-client pack --out dist/hyphae-read-client-0.1.0.tgz
```

Install the resulting `packages/read-client/dist/hyphae-read-client-0.1.0.tgz` in another ESM project. The runnable separate-project example is `packages/read-client/examples/consumer.mjs`. The only runtime dependency is existing Zod4.6.5; canonical response schemas are bundled, with no workspace/Solana/scoring dependency for adopters. Exact unit strings, pagination, unavailable states and requested mint/wallet/epoch identity are preserved. Claims use no-store. There is no registration, signing, automatic retry or transaction send.

Validation: **23 focused SDK tests**, full **886 passed/1 optional skip**, repository typecheck/lint and SDK/API/web builds pass. Package installation, declarations, documented example, browser bundle and actual cross-origin Chromium execution pass. The minified consumer fixture bundle is **106688 bytes**, including Zod; local fixtures are not phone or production-payment proof. Live built-SDK Lab/community and epoch reads also pass. APIv1 fields/policy are unchanged; the shared schema's equivalent namespace import enables tree shaking. The lockfile adds only the new package importer, retaining every existing resolution.

The private package guard prevents accidental npm publication. Existing BUSL1.1 license is copied unchanged into the tarball. SDK/operator/publication scope contains no new backend/provisioning interface or site redesign. New SDK code needs applicable fresh other-family review before a later source/package publication. It is distinct from **@organichub/verify**, which remains exactly0.1.0 throughOct12.

The approved phone release remains frozen at **a646abc883131ff411d5dd7bbba536176364fe38**. SDK/core-import/lockfile changes are later local work and must not be substituted into that release.

## Organic-sync adoption notes

Producer: Hyphae. Contract: existing public read API **v1**, unchanged. New artifacts: local standalone read-only SDK/tarball with isolated Node/browser install proof, executable reader and this adoption guide. Consumer: Organic's existing task3.6/DEP-09 owner, or another launchpad's equivalent integration owner.

The next sync should carry these concrete changes into existing plans: adopt the locally packed read SDK where permitted, reuse the reader and reviewed setup; record Windows operator access unavailable; retain the exact conditional P1+D2 approval; stop scheduling completed onboarding/setup or another release-preparation pass. Owner authority/provisioning stays unimplemented, and no live dependency is closed by local SDK or fixture evidence.

The Organic-sync portable loader resolves to its canonical skill on this Mac. Only that loader, canonical instructions and handoff requirements were checked here. A full multi-repository/vault sync was **not run**; those write targets remain outside this Hyphae-only session. This guide and `docs/HANDOFF.md` are the normal producer handoff to that owning sync.
