# Privy member-login implementation checkpoint — October 9

Funding/payouts remain explicitly paused. All C14–C22 incomplete; no payees, amounts, publish/claim/P14 receipts. Reviewed next is held.

## Result and evidence stage

Local implementation: **fe6800f2f7ee9c66b217d59388d434994e7407a7**, auth arc baseline **36e2e531ffce151e71e6364c08f40aa877a63007**. Approved local spec and plan under `docs/superpowers/`. Public context/join and read-only account routes work locally. Real-provider login is disabled: no owned app/domain configuration or actual cookie/login/link/logout receipt. Fresh other-family review returned CHANGES_REQUESTED; findings fixed and final gate/build pass at **1577b8075ab317634337d4407f5b0555e838a720**; final fresh review **ACCEPT** at3ffd0f5. Activation/live smoke remains open.

API verifies app-bound ES256 token, fetches current provider user, normalizes exactly one Telegram identity, checks the selected community group and reads the original member. It never uses the login wallet as the reward wallet. Private/no-store, no wildcard CORS, caller identity selectors refused, bounded rate/deadlines, SDK retries/logging off. Next cookie-only proxy forwards only the intended credential; strict schema/size bounds. Client callbacks trigger fresh reads and logout/subject-change invalidate responses before private data can flash. Provider subtree is limited to the account page; auto-created wallets and auto-connect off.

## Checks

- Full tests:135 core/26 read-client/205 web/1119 API passed;3 existing API skipped.1485 passed total. Full typecheck/lint exit0;446 files.
- API production bundle/link-page build exit0. Web production build exit0 after final dependency pins. Existing metadataBase warning remains. Subsequent final changes were API-only; full gate repeated.
- Real SDK verifier with local ES256 signing fixtures; real SDK HTTP fixture confirms repeated server lookup and no logging even with envdebug (regression failed then passed). Existing migrations used in PGLite fixtures; no new schema/migration/reward change.
- Mounted React fixtures cover login/cancellation/linking/logout/subject change and pre-passive-effect privacy. Browser disabled account desktop/mobile390×844 has no overflow/offscreen links or console warnings/errors. Fixtures are not real authentication receipts.

## Technical rulings and dependency risks

Native execution on existing main is authorized by Cisco's build instruction plus project working agreement. No new branch/subagent/redundant authorization question. Combined local implementation commit rather than four artificial task commits; all completed local steps tracked in plan.

Official production HttpOnly recipe https://docs.privy.io/recipes/react/cookies requires stable owned base domain/provider appDomains and DNS verification. JS-readable dev mirror is insufficient. Local client can compile with `PRIVY_LOGIN_ENABLED=off` and exact-host gating; no localhost/preview activation. No new Hyphae session authority.

Pinned Privy Node0.35.0/React3.48.0; Solana Kit stays8.3.0. Connector bundling required Kit8-compatible memo0.15.0/system0.15.0/token0.17.0. jsdom26.1.0 mounted-test runtime supports installed Node22.21.0. grammY1.46 abort-controller shim bridged from native signals with tested cancellation, not a cast.

Unresolved compatibility inputs: @privy/node peersKit5.1 vs8.3 (only auth/current-user APIs used); transitive valtio/use-sync-external-store peerReact<=18 vs19.3; wagmi/abitype peerZod3 vs4.6; x402/token2022 peer sysvars5 vs8.3.17 deprecated transitive packages. Ignored @reown/appkit/keccak/utf8-validate build scripts were not approved/bypassed. No peer override or warning suppression. Local gate/build pass; actual activated provider path must be smoked before a compatibility claim.

## Review and human steps — OPEN

Fresh Claude review (one turn, tools/hooks/MCP disabled, public diff/fixtures only) reviewed36e2e531..fe6800f: **CHANGES_REQUESTED**. Actual returned model **claude-opus-5-5**, requested effort **high**,265804ms. Intermediate accepted review range36e2e531..1577b80 preceded browser hardening; unchanged lock retains original full-lock review and SHA256 receipt. Receipt in ignored docs/plans/2026-10-09-privy-review.json; actual modelUsage metadata retained. Review fixes committed **1577b8075ab317634337d4407f5b0555e838a720**, final full gate/build pass; final fresh review ACCEPT at3ffd0f5; configured-provider evidence remains open. Root: Codex(GPT-6), exact runtime ID/effort not exposed.

Pending owner reply: dedicated Hyphae Privy app already exists? No secrets in chat. Owner must configure dedicated app/owned domain/allowed origins/production HttpOnly cookie mode and Telegram linking, supply server secrets through existing stores, then attended email/Solana/link/unlink/logout/refresh smoke with actual cookie attributes/read-backs. Do not enable login or call it live from fixture tests. Public release remains separately held.

## Publication and downstream

Origin/main **d3b8c6cf92f2ffcdf8fa3094b3709177b1ca4cf9**, next/origin-next **1249feddc5a7d7052fda6de8ac2ed65a0d4274b0**, both histories preserved; no merge/reset/push/deploy. Freeze Oct9 22:00Z–Oct11 00:00Z. No provider/key/domain/resource/message or production change. No vault/Organic edits. Organic-sync should carry new community/account routes, private API/cache/identity boundary, activation-off stage and owner setup requirements; no Organic SSO implemented. Preserve held migrations0018+0019 and @organichub/verify0.1.0 throughOct12. Full pending local SHA ledger in canonical HANDOFF.

## Generated artifacts this session

| Artifact | Location | Stage |
|---|---|---|
| Auth code/spec/plan | apps/api/src/member-auth/, apps/web/, packages/core/; docs/superpowers/ | Local committed fe6800f |
| Gate/fixture/build logs | docs/plans/2026-10-09-member-*.log | Ignored, no live receipt |
| Disabled mobile screenshot | docs/plans/2026-10-09-member-disabled-mobile.png | Ignored |
| Review input/result | docs/plans/2026-10-09-privy-review* | Ignored; CHANGES_REQUESTED, fixes under verification |
| Local preview | Port3010 | Existing public reads, login disabled |
| Keys/accounts/resources/jobs | None created | None |

## Suggested skills

handoff-memory, the-analyst, executing-plans, test-driven-development, frontend-design, verification-before-completion, handoff.

## Next-session prompt

```
Hyphae local account implementation fe6800f +1577b80 +3ffd0f5 passes full gate/build; real Privy/HttpOnly/login smoke absent and activation off. Payouts paused; next1249fed and publication held. Fresh final other-family code review ACCEPT at3ffd0f5; live proof open.
Files: CLAUDE.md, docs/HANDOFF.md, docs/superpowers/plans/2026-10-09-privy-member-login.md, docs/handoffs/2026-10-09-privy-login-implementation.md, apps/api/src/member-auth/privy.ts, apps/web/components/member-provider.tsx
Model: available coding model, high effort for auth review fixes; record actual identity.
Skills: handoff-memory, the-analyst, executing-plans, test-driven-development, verification-before-completion, handoff.
Read actual review result and pending Privy-app reply. Fix concrete findings test-first, then guide one owner configuration action at a time. No secrets in chat or live-login claims from fixtures. Preserve holds, both histories, verify0.1.0 and next migrations0018+0019. No funding/payouts/push/deploy or owner configuration changes inferred.
```

## Review findings and resolution

- F1 high: Vercel egress shared visitor budget. Reuse existing server web credential only to attest Vercel-overwritten visitor IP; app-bound user JWT remains mandatory. Forged proxy credentials/visitor headers cannot select another budget. Tested independent visitors behind one Fly address and forged credentials. No new key or member authority.
- F2 medium:401 cookie/SDK disagreement and failed logout could falsely display signed out or strand login. Retry cookie read once after provider renewal; persistent failure shows explicit reconnect state with Sign out. Failed logout stays explicit/retryable, clears private wallet, never ordinary refresh/login. Pending logout is displayed as pending until promise completes. This uses an explicit retryable sign-out action instead of silently ending the provider session for a transport failure. Mounted regressions reproduced then passed.
- F3 low: include community mint in render-time identity key. Mounted layout-effect regression prevents old community wallet first paint.
- F4 low: same flag/exact-host gate on private proxy and page; renamed activation host to PRIVY_LOGIN_HOST. Disabled/preview proxy returns private404 with no upstream read.
- F5 low: canonicalize IPs, share IPv6/64 budget and limit full-map cleanup to one sweep per second. Active subjects never evicted to bypass quota; hard cap stays fail-closed. Address-rotation/mappedIPv4 fixtures pass.
- F6 info: imports moved to top. Deleted provider user remains503 per approved fail-closed spec (not a token-revocation claim). Keep documented exact NodeSDK0.35 pin and real HTTP shape test.

Final gate initially caught missing documentation for the automatically set VERCEL variable; example updated, full repeat passed (135/26/205/1119,3existing skips). No runtime credentials changed. API/server composition inspected: no global wildcard CORS or authorization logger; production bundles compile. Real image boot and attended provider smoke still open. Dedicated login-only Telegram bot is the security recommendation; owner configuration is not authorized or executed here.

## Accepted review and browser follow-up

Fresh full-code review36e2e531..1577b80 returned **ACCEPT**, actual **claude-opus-5-5**, requested effort **high**,201151ms; unchanged lock retained prior full-lock review. No blocking code defects. Receipt: ignored docs/plans/2026-10-09-privy-final-review.json. Acceptance is for local activation-off code, not a live login/release verdict.

N1/N2 follow-ups fixed/tested at **3ffd0f57750d570a3594617bac7ee5fd3f9ae2e6**: SDK callback ref prevents extra token reads when callback identity changes; manual native abort bridge supports browsers without AbortSignal.any, propagates caller/deadline cancellation and cleans listeners/timers. Meaningful regression failures observed; web205tests/typecheck/lint446/build pass and final full suite135/26/205/1119 passes (1485,3existing skips). Final fresh review of36e2e531..3ffd0f5 **ACCEPT**. N3 documentation counts/interfaces reconciled; final docs-only commit follows actual receipt. Optional Sec-Fetch-Site gate remains a cookie-SameSite smoke consideration, not silently approved policy.

Native production preview disabled-proxy read: HTTP404,Cache-Control private/no-store,Vary includesCookie plus standard Next router headers; no token/cookie passed. Preview restored onloopback127.0.0.1:3010 with existing server-only read configuration and login forcedoff. No production/API writes or provider setup.

## Final review receipt and exact stop —16:16Z

**ACCEPT**:36e2e531ffce151e71e6364c08f40aa877a63007..3ffd0f57750d570a3594617bac7ee5fd3f9ae2e6. Actual returned model **claude-opus-5-5**, requested effort **high**,172266ms,one fresh turn,tools/hooks/MCP disabled. Reviewer read entire final code diff; unchanged lock relies on initial full-lock review and verified no-lock-change. Receipt in ignored docs/plans/2026-10-09-privy-completion-review.json; modelUsage retained. Static analysis did not run checks; actual local gate logs provide the separate1485-test/type/lint/build evidence.

Non-blocking Info queue: anonymous SDK-initialization can briefly show Sign out (mask by authenticated/ready before activation); unsupported methods still private405 while disabled (optional404 consistency). No data/upstream access. Optional Sec-Fetch-Site policy waits for actual SameSite cookie proof. These do not invalidate activation-off code ACCEPT; do not silently mark the queue complete.

**Needs Cisco:** answer whether a dedicated Hyphae Privy app exists. Open Privy Dashboard and inspect/select that app; do not paste secrets. No account/bot/key/DNS action authorized or executed. After owner configuration, attended actual cookie/email/Solana/Telegram/logout/refresh/SDK-init/image-boot proof is required. Existing server web/read token equality must be verified without exposing values. No claimed real login, no production write, no payout. Web quiz/tasks/progress remain separate future work.

Final full tests135core/26readclient/205web/1119API pass (1485passed,3existing skips); fulltypecheck passed at1577b80, finalwebtypecheck passed after3ffd0f5; fulllint446files/webbuild pass after3ffd0f5, APIbuild unchanged/pass at1577b80. Native preview nowloopback127.0.0.1:3010, rootHTTP200; disabledprivateGET404/private,no-store/VaryCookie verified. Existing public-read config is server-side only, login forcedoff.

Completed code SHAs:fe6800f2f7ee9c66b217d59388d434994e7407a7,1577b8075ab317634337d4407f5b0555e838a720,3ffd0f57750d570a3594617bac7ee5fd3f9ae2e6. Docs-only checkpoint SHA resolves with gitlog -1 --format=%H -- docs/handoffs/2026-10-09-privy-login-implementation.md. Main-only docs/history and next1249fed preserved; no push. All C14–C22 still paused/incomplete, receipts/payees/amounts none. Organic-sync owns downstream propagation of local routes/private read contract/provider setup/open human steps; no vault/Organic changes.
