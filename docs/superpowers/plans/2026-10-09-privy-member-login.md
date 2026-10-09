# Privy member login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sign in with email or an existing Solana wallet, explicitly link Telegram, and privately read the existing community member's current wallet.

**Architecture:** The Fly API verifies the dedicated app's token, fetches the current provider user, checks Telegram group membership and reads the existing community/member pair. A same-origin Next proxy forwards the provider access credential and separately attests a Vercel visitor using the existing server web credential for rate limits only. This does not authorize member access. No member, wallet, reward or session-authority writes occur.

**Tech Stack:** Node 22.21.0, pnpm, Hono 4, grammY, Drizzle, Zod 4, Vitest, Next 16.3.6/React 19.3.0; pin `@privy-io/node` 0.35.0 and `@privy-io/react-auth` 3.48.0; login activation remains off pending configured-domain receipts.

**Spec:** `docs/superpowers/specs/2026-10-09-privy-member-login-design.md`.

## Global Constraints

- Cisco's “Okay, let's put it to work” approves local implementation of the reviewed spec. Execute natively in the existing main checkout under the explicit project working agreement; no new branch or repeated permission request. No subagents were selected.
- Scope is a read-only `/c/[mint]/me`. No quiz/task writes, member creation, wallet mutation, embedded wallet, delegation, transaction signing, payout, domain alias or Organic SSO.
- Login wallet is not the reward wallet. Preserve original member IDs and all close-time evidence.
- Dedicated Hyphae app; verify ES256/signature/issuer `privy.io`, exact app audience, expiry and subject. Fresh server user lookup and group check on every request; no identity-token snapshot authority.
- Require one canonical positive decimal Telegram ID, at most `Number.MAX_SAFE_INTEGER`; use `(communityId, telegramUserId)` only. Never accept browser identity selectors.
- Five-second total external-read deadline, SDK retries off, abort supported reads. Proxy visitor/IP budgets require the existing server web credential; user JWT remains mandatory. IPv6 uses64-bit network budgets; active-subject maps fail closed at10k, cleanup bounded to once per second. Subject budget 20/minute with burst 5; IP budget before provider reads. All successes/errors `private, no-store`; no wildcard CORS.
- Missing configuration disables the new surface without crashing the existing API. Never use the public read token as member authority.
- HttpOnly transport is mandatory unless the spec is explicitly revised. Official production-cookie setup is documented at https://docs.privy.io/recipes/react/cookies: a stable owned domain and configured Privy appDomains/HttpOnly mode are required. The JS-readable development mirror is insufficient. Client code may be built locally with activation off; actual login/refresh/logout cookie receipts are still open.
- No provider account/key/origin configuration, deployment, push or message in this implementation. Fresh other-family review required before any later authorized push. Freeze Oct 9 22:00Z–Oct 11 00:00Z remains.
- Preserve next `1249feddc5a7d7052fda6de8ac2ed65a0d4274b0`, both histories, next's 0018+0019, and `@organichub/verify` 0.1.0 through Oct 12. No migration or scoring change.

## Review Focus

1. Telegram disappears between requests: second request must lose access (Task 2).
2. Group membership is revoked or Telegram fails: no private wallet returned (Task 2).
3. Provider/Telegram read stalls: stop within five seconds and return unavailable, never an empty wallet (Task 2).
4. Login wallet differs from the recorded reward wallet: only the latter is displayed; no mutation (Tasks 2, 4).
5. Logout or identity/link change races a response: private data clears immediately and late responses cannot repopulate it (Task 4).

## File boundaries and interfaces

`packages/core/src/member-account.ts` owns the minimal shared wire schema; this pure contract is the sole extension of the spec's API/web ownership. `apps/api/src/member-auth/identity.ts` owns server identity normalization; `privy.ts` owns the actual SDK; `routes.ts` owns private HTTP/DB composition; `limits.ts` owns bounded token buckets. Existing environment/server files only compose the surface. Web proxy and client remain separate from public cached reads. Tests must not import the process-starting server/bot.

### Task 1: Strict private contract and provider identity boundary

**Files:** Create `packages/core/src/member-account.ts`, `packages/core/src/member-account.test.ts`, `apps/api/src/member-auth/identity.ts`, `apps/api/src/member-auth/identity.test.ts`; modify `packages/core/src/index.ts`.

**Interfaces:** Produces `MemberAccountSchema`, `type MemberAccount = z.infer<typeof MemberAccountSchema>` and `telegramIdentity(user: unknown, subject: string): bigint | null`. A malformed/mismatched provider record throws; a correctly formed record with no Telegram link returns null.

- [x] Write failing tests, including these real inputs:

```ts
expect(telegramIdentity({id: "did:privy:a", linked_accounts: [
  {type: "telegram", telegram_user_id: "123"},
]}, "did:privy:a")).toBe(123n);
expect(() => telegramIdentity({id: "did:privy:b", linked_accounts: []}, "did:privy:a")).toThrow();
for (const value of ["0", "01", "-1", "1.5", "9007199254740992", "abc"]) {
  expect(() => telegramIdentity({id: "did:privy:a", linked_accounts: [
    {type: "telegram", telegram_user_id: value},
  ]}, "did:privy:a")).toThrow();
}
```

Pin duplicate Telegram identities, absent linked_accounts and a non-array too. The schema rejects extra `email`, `telegram_user_id`, `subject`, `member_id`, invalid dates and inconsistent wallet/status pairs rather than silently stripping private fields.

- [x] Run `pnpm --filter @hyphae/core test -- member-account` and `pnpm --filter @hyphae/api test -- member-auth/identity`; expect missing exports/modules, then behavioral failures once the module is defined.
- [x] Implement the discriminated union: strict common community `{mint: string, name: string}` and `as_of: z.iso.datetime()`; states `telegram_required`, `join_required`, `member_not_registered`, or `member` with strict `wallet: {address: string|null, status: "none"|"paste"|"signature"}`. Only `member` carries wallet. Enforce null address iff none; positive base58 address shape for a non-null wallet. Use existing public mint validation for route agreement, no arbitrary path characters.

```ts
const record = z.object({id: z.string(), linked_accounts: z.array(z.unknown())}).parse(user);
if (record.id !== subject) throw new Error("identity_unavailable");
const links = record.linked_accounts.filter((a) =>
  typeof a === "object" && a !== null && "type" in a && a.type === "telegram");
if (links.length === 0) return null;
if (links.length !== 1) throw new Error("identity_unavailable");
const link = z.object({telegram_user_id: z.string().regex(/^[1-9][0-9]{0,15}$/)}).parse(links[0]);
const id = BigInt(link.telegram_user_id);
if (id > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("identity_unavailable");
return id;
```

- [x] Run both package suites and typechecks; all green. Included in the combined verified local implementation commit; individual task commits were consolidated because no intermediate state was independently deployed.

### Task 2: App-bound verification and private read-only API

**Files:** Create `apps/api/src/member-auth/privy.ts`, `privy.test.ts`, `limits.ts`, `limits.test.ts`, `routes.ts`, `routes.test.ts`, `config.ts`, `config.test.ts`; modify `apps/api/src/env.ts`, `apps/api/src/server.ts`, `apps/api/package.json`, `pnpm-lock.yaml`.

**Interfaces:** Consumes Task 1 and existing `Db`, `communities`, `members`, `isMemberStatus`. Produces `interface MemberIdentityProvider { verify(token: string): Promise<string>; currentUser(subject: string, signal: AbortSignal): Promise<unknown> }`, `privyIdentity(config: {appId: string; appSecret: string; verificationKey: string}): MemberIdentityProvider`, `memberRoutes(options: {db: Db; identity?: MemberIdentityProvider; webToken?: string; chatMember?: (chatId: bigint, userId: bigint, signal: AbortSignal) => Promise<{status: string; is_member?: boolean}>; now?: () => Date}): Hono`, `memberAuthConfig(values: {PRIVY_APP_ID?: string; PRIVY_APP_SECRET?: string; PRIVY_VERIFICATION_KEY?: string}): {appId: string; appSecret: string; verificationKey: string}|null`, `tokenBucket({capacity, refillPerMinute, now?}): (key: string) => boolean`.

- [x] Install exact server SDK and local signing-test dependency during this task only: `pnpm --filter @hyphae/api add --save-exact @privy-io/node@0.35.0`; `pnpm --filter @hyphae/api add -D --save-exact jose@6.2.2`. Verify the jose version exists before installing; use a currently available 6.x release if metadata differs and record the exact ruling/version.
- [x] Write verifier tests with local ES256 signing keys and the real SDK verifier. Sign a valid token with `sub`, `sid`, `iat`, `exp`, issuer and audience; alter issuer/audience/expiry/algorithm/signature and assert rejection. No live credential:

```ts
const {privateKey, publicKey} = await generateKeyPair("ES256");
const token = await new SignJWT({sid: "fixture"})
  .setProtectedHeader({alg: "ES256", typ: "JWT"})
  .setSubject("did:privy:fixture").setAudience("hyphae-fixture")
  .setIssuer("privy.io").setIssuedAt().setExpirationTime("1h").sign(privateKey);
const provider = privyIdentity({appId: "hyphae-fixture", appSecret: "fixture-only",
  verificationKey: await exportSPKI(publicKey)});
expect(await provider.verify(token)).toBe("did:privy:fixture");
```

- [x] Write Hono request tests using `createTestDb()` fixtures, not production: missing config 503; no token 401; extra `?telegram_user_id=...`/member/subject/wallet/chat selectors rejected 400; unknown mint 404 after authentication; valid Telegram link absent 200/telegram_required; removed group 200/join_required; missing existing member 200/member_not_registered; member returns DB wallet. Seed the same Telegram ID into two communities with different wallets and assert scoping. Compare member/wallet-ledger DB rows before and after reads. Assert fresh unlink/group revocation on second request, timeout/error 503 and token errors 401 without leaking their exception text.
- [x] Write limiter tests with injected clock: first five requests allowed, sixth denied; 3 seconds refills one token; sustained accepted count bounded by burst plus twenty per minute; bounded map memory, expired/evicted identity treated safely. Pre-auth IP capacity 30/refill60 per minute; authenticated subject capacity5/refill20. Never trust an unauthenticated forwarded visitor selector.
- [x] Run `pnpm --filter @hyphae/api test -- member-auth`; expect new behavior missing.
- [x] Implement verifier/current-user using actual 0.35.0 APIs, no identity-token shortcut:

```ts
const client = new PrivyClient({appId, appSecret, maxRetries: 0, timeout: 5000});
return {
  async verify(token) {
    const claims = await verifyAccessToken({access_token: token, app_id: appId,
      verification_key: verificationKey});
    if (!claims.user_id.startsWith("did:privy:")) throw new Error("invalid_auth");
    return claims.user_id;
  },
  currentUser: (subject, signal) => client.users()._get(subject, {signal, maxRetries: 0}),
};
```

- [x] Implement the HTTP pipeline in this exact order: private headers/error/not-found handlers; validate method/mint/no query; IP budget; missing config; bounded strict bearer parse; verify; subject budget; one abort controller/deadline; community by mint; fresh `currentUser`/`telegramIdentity`; fresh chat check; member query `and(eq(members.communityId, community.id), eq(members.telegramUserId, telegramId))`; strict response parse. Keep one five-second race around the full read, and abort in finally. Differentiate verifier failure from upstream failures; no exception bodies/logs. Every unmatched/error path remains private. Refuse unavailable/inconsistent DB wallet evidence rather than inventing status.
- [x] Add optional string env fields, parse non-empty all-or-none configuration in focused `config.ts`, return null for missing/partial/malformed values. Compose at `/member/v1`; use existing `notifyApi.getChatMember(String(chatId), Number(userId), signal)` only if the installed grammY declaration supports the signal, otherwise use its documented abort-capable call. Never import process-starting bot/server from tests. Existing public `/v1` stays separate.
- [x] Run API tests/typecheck and verify dependency pins/lock and untouched DB migration directory. Included in the combined verified local implementation commit.

### Task 3: Verified HttpOnly transport and same-origin proxy

**Files:** Create `apps/web/lib/member-api.ts`, `member-api.test.ts`, `apps/web/app/api/member/[mint]/route.ts`, `route.test.ts`; document proof in `docs/handoffs/2026-10-09-privy-transport.md` only once it exists.

**Interfaces:** Consumes `MemberAccountSchema`. Produces `readPrivateMember(options: {mint: string; token: string; apiUrl: string; signal?: AbortSignal; webToken?: string; visitor?: string}): Promise<{status: number; body: unknown}>`; proxy `GET(request: Request, context: {params: Promise<{mint: string}>}): Promise<Response>`.

- [ ] Verify the pinned React SDK's supported HttpOnly setup from official provider docs/source and an operator-owned configured test app. Record exact setting, same-origin requirement, login/refresh/logout cookie attributes and absence of browser token storage. SDK `cookieWriteBehavior` mirror is insufficient. If proof/configuration is absent, mark this task **blocked**, retain the approved transport and leave live login disabled; proceed only with independent fixture proxy tests. Never set a Hyphae cookie by copying a JS-readable bearer and claim equivalent protection.
- [x] Write proxy tests: no cookie401, duplicate/malformed/over4096-byte cookie401, hostile mint/query400, wrong upstream shape503, unknownmint404, auth401/limit429/unavailable503; no provider internals returned. A fixture token A followed by B must produce independent fetches, no shared cache. Use cookie getter, not arbitrary cookie forwarding.

```ts
const upstream = await fetch(`${apiUrl}/member/v1/communities/${encodeURIComponent(mint)}/me`, {
  headers: {Authorization: `Bearer ${token}`}, cache: "no-store", redirect: "error", signal,
});
```

- [x] Run `pnpm --filter @hyphae/web test -- member-api`; expect missing implementation. Implement strict status/body parsing, max 16KiB upstream body streamed limit and 5.5s proxy abort; accept only closed success states or fixed `{error}` for allowed errors. Reject extra selector/query before fetch. Return `Cache-Control: private, no-store`, `Vary: Cookie` on every route/error; no wildcard CORS/Set-Cookie/token/debug output. Read only `privy-token` server-side; do not call the cached public `api.ts` helper.
- [x] Run web tests/typecheck; include in the combined verified local implementation commit. This commit does not enable provider login.

### Task 4: Scoped member UI, local gates and honest operator stop

**Files:** Create `apps/web/app/c/[mint]/me/page.tsx`, `apps/web/components/member-account.tsx`, `member-account.test.tsx`, `member-provider.tsx`, `member-session.ts`, `member-session.test.ts`; modify `apps/web/components/community.tsx`, `apps/web/app/globals.css`, `apps/web/package.json`, `pnpm-lock.yaml`, `docs/BUILDLOG.md`, `docs/HANDOFF.md`; dated handoff snapshot.

**Interfaces:** Consumes Task 3 private route and Task 1 schema. Produces `MemberAccountView({community: {mint: string; name: string}})` in a scoped Privy subtree and `requestGeneration(): {invalidate(): void; run<T>(operation: (signal: AbortSignal) => Promise<T>, apply: (value: T) => void): Promise<void>}`. Invalidate aborts and increments generation; only current operation applies.

- [x] After official supported-transport documentation, install exact React SDK3.48.0 and verify installed Next use-client/server-client/route-handler guides before code. Keep live activation off until the operator-owned domain/HttpOnly receipts exist; localhost and previews cannot activate login.
- [x] Write tests for missing configuration, logged out, provider loading, each private state and canceled link/login; no Telegram completion/eligibility/payment badge. Race test:

```ts
let finish!: (value: string) => void;
const pending = new Promise<string>((resolve) => { finish = resolve; });
const received: string[] = [];
const generation = requestGeneration();
const read = generation.run(() => pending, (value) => received.push(value));
generation.invalidate();
finish("previous-user-private-wallet");
await read;
expect(received).toEqual([]);
```

- [x] Implement generation guards and aborts; clear state before logout/link/unlink/subject changes and on401. Provider only wraps `/me`; readiness/authenticated are presentation hints, never membership proof. Enable only with app ID plus verified HttpOnly transport. Config uses `loginMethods: ["email", "wallet"]`, `appearance.walletChainType: "solana-only"`, `externalWallets.solana.connectors: toSolanaWalletConnectors()`, embedded Ethereum and Solana `createOnLogin: "off"`. Telegram control calls `useLinkAccount().linkTelegram()` explicitly; completion triggers a new server read. Display DB wallet as “Current reward wallet”, signature/paste/none, and “This is the current record, not a payment verdict.” Show email fallback for unsupported hardware message login. No wallet creation/delegation/transaction-signing methods.
- [ ] Complete configured-provider smoke and browser walkthrough of enabled login states. Local web tests/typecheck, mounted fixture states and disabled desktop/mobile390×844 walkthrough passed. Live email/Solana/link/logout smoke needs Cisco's configured test app and attendance; save actual evidence or mark open. Fixtures are never live login receipts.
- [ ] Finish operator proof. Other-family final auth review ACCEPT at3ffd0f5. Full `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm --filter @hyphae/web build` already passed locally; retain fresh results below. No schema/reward change: no new migration/PG gate required. Request fresh other-family review of `git diff 36e2e531ffce151e71e6364c08f40aa877a63007..HEAD` before any permitted push; no publication while review/configuration/freeze/release remain held. Record exact SHAs, task stage, checks, unfinished proof/smoke and next single human action. Commit each verified implementation milestone; no vault/Organic edits.

## Self-review and execution ledger

Coverage: Task1 wire privacy/identity normalization; Task2 verification/group/DB/limits/startup; Task3 cookie/proxy/cache/exposure; Task4 scoped presentation/races/live smoke/gates/review. Five Review Focus cases have owning tests. No competing migrations, wallet mutation or reused next authority. Server `_get`/raw `telegram_user_id`, abort/maxRetries and verifier signatures were checked in published Node0.35.0 declarations/source; React cookie mirror cannot establish HttpOnly support.

Native execution is authorized by Cisco's build instruction and project working agreement (approved specs authorize their tasks); that explicit user direction takes precedence over a skill's redundant review/choice gate. No new founder choice is inferred. Track completed steps and actual evidence here and in the canonical handoff; leave unresolved transport, configured-provider smoke explicitly open; final auth review is ACCEPT at3ffd0f5. No login is called working until it has those receipts.


## October 9 implementation checkpoint

Tasks 1–2 and local code/tests for Tasks 3–4 are built. Configured transport and real email/Solana/Telegram/logout smoke remain open; final other-family review ACCEPT. Checks: 135 core / 26 read-client / 205 web / 1119 API passed, 3 existing API skipped; typecheck/lint exit 0 (446 files), web production build exit 0. Disabled account page passed desktop/mobile390×844 browser checks with no overflow or console warnings/errors. Mounted React tests exercise callbacks, cancellation and logout/subject-change races; these are fixtures, not provider receipts.

Technical rulings:

- Cisco's explicit build instruction and working agreement authorize native execution on existing main. No redundant review-choice request, new branch or subagent. No provider/publication/payout approval inferred.
- Production HttpOnly support is documented, but no owned app/domain has been configured here. `PRIVY_LOGIN_ENABLED=off` and exact-host gating prevent presenting enabled login locally. Do not invent a cookie mode or call the development mirror secure.
- grammY's installed signal type uses abort-controller; a tested native-to-shim bridge avoids a type cast and propagates cancellation.
- Solana connector bundling required pinned Kit8-compatible memo0.15.0/system0.15.0/token0.17.0 peers. Kit remains8.3.0. jsdom26.1.0 supports the installed Node runtime. Remaining peer warnings and ignored native build scripts require review/configured smoke, not overrides or suppressed warnings.
- Added `telegram.ts/test`, `member-login-config.ts/test`, `member-provider.test.tsx`, `.env.example` and exact manifest/lock entries within existing ownership. No DB/migration, wallet, reward or Organic/vault writes.
- Provider transport logging is explicitly off, including when PRIVY_API_LOG=debug; real SDK HTTP fixture regression observed failing then passing. A canceled deadline is checked before starting a subsequent provider read.

Final review-fix milestone: **1577b8075ab317634337d4407f5b0555e838a720**. Initial other-family Claude Opus5.5/high CHANGES_REQUESTED addressed: proxy visitor attestation with existing server credential (not member authority), explicit cookie401 renewal/reconnect and pending/failed sign-out states, community render key, page/proxy activation gate and PRIVY_LOGIN_HOST, IPv6/64 normalization and bounded full-map sweeps, import cleanup. Behavioral regressions observed failing thenpassing. Final full gate 135/26/205/1119 passed,3existing skips; lint446files/typecheck and both web/API builds exit0. Final fresh review ACCEPT at3ffd0f5; configured-provider proof remains OPEN.

Browser follow-up: **3ffd0f57750d570a3594617bac7ee5fd3f9ae2e6** stores the current SDK token callback in a ref to avoid effect loops, and replaces AbortSignal.any with native-controller listener/timer cleanup. Regression evidence: callback identity change produced extra token reads; older-browser combination threw; both now pass. Caller-abort and6500ms deadline tests pass. Final full tests135/26/205/1119 (1485passed,3existing skips), webtypecheck/full446-file lint/webbuild exit0; APIbuild unchanged/pass. Page and proxy activation use exact PRIVY_LOGIN_HOST. Final fresh review of36e2e531..3ffd0f5 ACCEPT (claude-opus-5-5, requested high). Actual configured-provider transport/smoke remains OPEN.

Final recorded stage: **local code/test/build and other-family review complete; provider activation/live receipts open**. Review ACCEPT36e2e531..3ffd0f5,claude-opus-5-5/high,172266ms,one turn. Static review did not execute tests; actual gate logs are separate. Unchanged lock verified by gitdiff fe6800f..1577b80 and reviewed in initial full-lock assessment. Info items remain in handoff pre-activation queue; no further code changed after accepted3ffd0f5. Operator app/domain/HttpOnly/email/wallet/link/logout/image-boot evidence remains incomplete. No push/deploy/payout.
