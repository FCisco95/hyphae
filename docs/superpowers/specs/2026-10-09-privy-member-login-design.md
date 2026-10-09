# Privy member login — design for review

Status: **DRAFT awaiting written-spec review**. Provider choice approved by Cisco on October 9: email plus an existing Solana wallet through Privy, explicit linking to existing Telegram membership, no automatically created wallet. This approval does not create a provider account, approve publication, resume payouts or approve the design below.

## Intended result and scope

A member opens their community on the website, signs in with email or an existing Solana wallet, explicitly connects their Telegram identity and sees the same member record the bot uses. Existing contributions, wallet proofs and quiz passes remain attached to the original member UUID. An account with no linked membership can still read public context and setup guidance.

This subproject delivers login and an authenticated, read-only member screen at `/c/[mint]/me`. It establishes the identity boundary needed by the subsequent in-page quiz and personal-progress work. It does not implement quiz submissions, task submissions, Telegram-independent membership, domain aliases, Organic SSO, reward-wallet mutation, embedded wallets, claims or payouts.

Acceptance: a correctly authenticated and linked current group member sees their existing current wallet record; users lacking proof or membership see an explicit next action. No browser value can select someone else's member. Missing configuration shows unavailable without presenting a working login. Public community/context/join/audit pages continue working independently.

## Approach and alternatives

**Recommended: Privy-native Telegram linking with fresh server lookup.** After email/Solana login, an explicit “Connect your Telegram membership” action uses Privy's account-linking flow. The API verifies the login token, obtains that subject's current provider user record, extracts its verified Telegram ID and checks current group membership with Telegram. It resolves the existing member by `(community_id, telegram_user_id)`. No Hyphae account table, duplicate member or migration is needed for this first version. The cost is a provider read and Telegram membership read on each private request.

Alternative: a custom one-time bot-to-account linking ceremony with durable Hyphae account/member associations. This would give Hyphae its own linking/recovery ledger but requires new tables, expiry/replay/conflict handling, unlink/recovery policy and a migration after the held 0018+0019 sequence. Keep it for a separately reviewed Telegram-independent identity design, not this first release.

Do not match identities by email, username or a pasted wallet. Do not resolve legacy membership from the wallet used to log in: a login credential is separate from the recorded reward wallet.

Privy documents [Telegram linking](https://docs.privy.io/user-management/users/linking-accounts) and its [linked Telegram user ID](https://docs.privy.io/user-management/users/the-user-object). The architecture above is Hyphae's proposed use of those capabilities, not a tested integration.

## Member experience

1. Open “Your account” inside the selected community. Public browsing does not require login.
2. Choose email OTP or an existing Solana wallet. Both are login credentials. Disable automatic embedded-wallet creation for both Solana and Ethereum. Do not request wallet delegation or transaction signing. In the initial version, unsupported hardware-wallet message login falls back to email; no Ledger transaction-signing login plugin is added.
3. After login, connect Telegram explicitly through Privy. Explain that this finds the existing community membership and does not set or replace the reward wallet. Refresh the member read after successful linking; never treat a client callback as proof.
4. If not currently in the registered group, show the existing verified invite when supplied, otherwise direct the member to its owner. If in the group but no Hyphae member row exists, show the current bot setup route. This read-only subproject does not create member rows or sign up someone for rewards.
5. A resolved member sees their current Hyphae-linked wallet and its existing signature/paste/no-wallet state, clearly separate from the wallet used for login. Wallet changes still use the existing private bot flow. This is not the close-time payment wallet or an eligibility verdict.
6. Logout immediately clears member data and ends the client session. Discard in-flight responses across logout, account changes and linking/unlinking. Do not persist private member responses in local storage.

Use the existing black/white design and scoped community navigation. No completion tick for the quiz or any claim of payment appears in this subproject. Load the Privy client bundle only in the member screen/provider subtree; public audit and claim paths retain their existing behavior.

## Authentication and data boundary

- The browser uses the Privy SDK for login/linking. Prefer its documented HttpOnly-cookie session mode with same-origin Next member endpoints; verify the pinned SDK's cookie integration before using it. Do not create a separate Hyphae session authority. Fail closed if that integration cannot supply the authenticated request; revising transport needs a spec update.
- A Next server proxy reads the intended access-token cookie and forwards only that credential to a separate private Fly route. It does not forward arbitrary browser identity fields or the entire cookie/header set. Token and provider secrets must never enter page props, URLs, logs, screenshots or public API responses.
- The Fly API verifies signature, issuer, exact Hyphae Privy app audience, expiry and subject using the provider's server verifier. The existing public web-read token is insufficient for member access. Client SDK `authenticated`, wallet-connect state and decoded JWT payloads are not authority.
- For **each private request**, fetch the current provider user by the already verified subject through the server SDK, assert its returned ID equals that subject and normalize the provider's server-format Telegram account. Do not use a client user object, an identity-token snapshot or cached linked accounts for membership authority. A provider timeout/error yields unavailable. This intentionally trades an extra provider call for detecting unlinking on subsequent requests.
- Require exactly one Telegram identity with a canonical positive decimal ID that can be represented safely by the Telegram client and DB. Reject malformed, ambiguous or out-of-range identities. A username is display metadata only.
- Resolve the community by its canonical mint, check `getChatMember` for that community's registered chat using the existing `isMemberStatus` semantics, then read the existing member for that community and derived Telegram ID. Never accept a caller's member ID, Telegram ID, wallet address, chat ID or arbitrary provider subject for this lookup. Removed/banned users lose private member access; unknown Telegram membership fails closed.
- Return only community name/mint, a state, and for a resolved member their current linked wallet/status and read timestamp. No provider subject, Telegram ID, email, internal member UUID, other members' data or provider profile is returned. Read time is not a close snapshot.
- Responses and the proxy use `Cache-Control: private, no-store`; private routes do not inherit the public read API's wildcard CORS or caching. No CDN, ISR or shared React cache for member data. Cookie responses vary by cookie; API responses vary by authorization. Future cookie-authenticated mutations will require origin/CSRF checks; none is introduced here.
- Bound provider and Telegram reads by a total request deadline of five seconds, no SDK automatic retries, and abort underlying operations where supported. Rate-limit before external reads: visitor/IP before authentication, then verified subject (20 requests/minute, burst 5). Rate-limit responses also carry no-store. A deadline does not convert an error into an empty member/wallet.
- Client logout clears the local session; do not claim it instantly revokes all previously issued bearer tokens. Backend expiry remains enforced. Privy unlinking is detected by the fresh user read. User deletion/provider lookup refusal denies access. No account recovery, administrative override or credential-transfer tool is added.

The provider documents [access-token verification](https://docs.privy.io/authentication/user-authentication/access-tokens), [server user lookup](https://docs.privy.io/user-management/users/managing-users/querying-users), and [disabling automatic wallet creation](https://docs.privy.io/basics/react/advanced/automatic-wallet-creation). The selected transport/server adapter must be tested against pinned SDK behavior, rather than copying older `server-auth` examples.

## Proposed interfaces and ownership

| Boundary | Responsibility | Result |
|---|---|---|
| Web `/c/[mint]/me` | Scoped account screen and Privy login/link controls | Logged out, loading, configuration unavailable, or parsed member state |
| Web `GET /api/member/[mint]` | Same-origin private credential proxy; no identity selection | Private/no-store response from the API |
| API `GET /member/v1/communities/:mint/me` | Token verification, fresh linked identity, group check and scoped member read | `telegram_required`, `join_required`, `member_not_registered`, or `member` |
| API auth adapter | Verify app-bound token and obtain current normalized provider identity | Internal subject/Telegram principal only |
| Existing DB | Read existing community/member; no inserts/updates | Original member UUID and current wallet record |

Unknown mint: 404. Invalid/missing login: 401. Rate limit: 429. Missing configuration or provider/Telegram/DB/read-schema failure: 503 unavailable. Authenticated users missing Telegram/group/member receive the appropriate explicit member state, not a fabricated membership. Reject unexpected selectors and malformed inputs. Private identity diagnostics use fixed codes, with no raw tokens/provider responses.

Implementation ownership is one session over `apps/web`, a focused `apps/api/src/member-auth` module, API environment/composition/tests and the reviewed package/lock additions. Do not write Organic/vault, merge held next, touch scoring/settlement code, alter the existing wallet-proof protocol or append a migration. Existing membership and wallet-display helpers should be reused where their semantics fit; avoid importing process-starting bot/server modules into tests or shared code.

## Configuration and release

Use a dedicated Hyphae Privy application, with email/external Solana wallet login and Telegram account linking enabled. It must not trust another application's tokens or silently reuse Organic's identity realm. Required configuration is an app ID (public client/server value), server app secret/verification configuration kept server-side, explicit allowed web origins and the provider's Telegram OAuth setup. SDK metadata checked October 9: React SDK 3.48.0 accepts React 18/19 and Solana Kit >=3.0.3; Node SDK 0.35.0 is current. Installed runtime is Node 22.21.0. These are compatibility inputs, not an installed/tested integration; pin and verify the selected releases in the implementation plan.

No provider account, OAuth configuration, secrets or allowed domains are created/changed during design. The operator supplies configuration through the existing secret stores only when the reviewed local implementation is ready. Missing member-auth configuration must disable this new surface without preventing the existing API/bot from starting. The existing server-side read token never becomes user authentication.

All work stays local under current publication conditions. Payouts remain explicitly paused; all C14–C22 remain incomplete. Preserve `next` at 1249fed, both divergent histories, its accepted work/migrations 0018+0019, and `@organichub/verify` 0.1.0 through Oct 12. No migration is planned here. Before any permitted publication, run the final full gate and a fresh other-family sensitive-code review; existing next ACCEPTs do not review this new authentication code. The Oct 9 22:00Z–Oct 11 00:00Z freeze still applies. Provider selection is not a release ruling.

## Validation required by the later implementation plan

- Server token tests: valid own-app token, forged/wrong algorithm/wrong issuer/wrong audience/expired token, missing token, wrong provider user subject, and provider timeout/unavailable. Include real verifier behavior with locally generated signing fixtures; no live user credentials.
- Member tests: absent/ambiguous/malformed Telegram link, linked account removed between requests, group membership revoked/unavailable, missing member, same Telegram user in two communities, hostile browser selectors and different login wallet versus recorded reward wallet. Assert no DB writes or close-time evidence changes.
- Private transport/exposure tests: no-store on every success/error, no wildcard CORS, no forwarding/logging/return of identity secrets, no cross-user cache reuse, rate limits/deadlines and client rejection of late responses after logout/account changes.
- Client tests and mobile walkthrough: email path, supported Solana message-login path, canceled wallet/Telegram flow, configuration missing, explicit linking and each member state. Automatic creation/delegation/transaction-signing methods must not be called. Real provider smoke needs operator-owned test account/configuration and attendance, after local checks/review; fixtures must be labeled fixtures.
- Full `pnpm test`, `pnpm typecheck`, `pnpm lint`, web production build. No schema change means no new migration/Drizzle gate; verify existing DB read behavior without inserting fake production members. Any scope change to mutations/schema upgrades the validation/review plan.

## Self-review and next stage

Reviewed for placeholders, contradictory scope, identity selection, private-data caching, token versus wallet authority, backend startup behavior, held migrations and release authority. No product code or dependency installed for this design. The key remaining validation is the pinned provider's actual cookie/server-user adapter and an attended operator-owned provider smoke.

Next: Cisco reviews this written spec. After approval, create the implementation plan using writing-plans, with concrete tests and file boundaries, and select execution. Web-quiz and Telegram-independent membership designs follow this auth boundary rather than weakening current eligibility.
