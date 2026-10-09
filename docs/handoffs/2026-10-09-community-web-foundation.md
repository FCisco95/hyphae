# Community web foundation — October 9

## TL;DR

Cisco explicitly paused all funding and payouts, then approved building toward a complete website member experience with Telegram optional. The first slice works locally: community overview, project context and a dedicated join guide. Website login, the in-page eligibility quiz, task discovery and personal progress are not implemented yet. Reviewed `next` remains held; nothing was pushed or deployed.

Next: resolve the pending login-method question, then finish the identity design before implementing private member endpoints. Recommend email plus an existing Solana wallet through Privy, with explicit account/member linking and no automatically created wallet. This is a recommendation, not provider setup or custody authorization.

## Metadata

- Checkpoint: 2026-10-09, approximately 12:45 UTC.
- Operator: Codex (GPT-6); exact runtime model ID and configured effort are not exposed. No substituted prior-session model/effort.
- Product milestone: `a717c17d25b1f450e34a5d3c1276f976c9bdd104`.
- Follow-up: `b750dd98aa8b9b1ca629779172d05d19b3132ebe` distinguishes no open epoch from explicitly paused intake.
- Origin/main: `d3b8c6cf92f2ffcdf8fa3094b3709177b1ca4cf9`.
- Next/origin-next: `1249feddc5a7d7052fda6de8ac2ed65a0d4274b0`, unchanged and clean at the checkpoint. Both histories preserved; no reset/merge.

## What works

- `/c/[mint]`: selected community identity, current epoch and close, actual intake state and read time, context/setup/audit navigation, guarded participation action, existing history and vault state.
- `/c/[mint]/about`: contribution process, pinned rules, public evidence, privacy and the distinction between provisional points, allocation, publication and confirmed claims. This describes Hyphae's existing workflow; community-specific founder history/copy is still an owner item.
- `/c/[mint]/join`: existing registered-group, wallet, private rules-test and submission guide, with only owner-supplied invite/support links. No invented link session or personal progress.
- New pages use the existing parsed server-side public read; unknown communities return not-found, failed reads show unavailable. No backend, migration, scoring, claim or wallet-proof code changed.
- Raid setup is offered only when the selected epoch is open and intake is open. A paused community keeps its audit accessible and does not encourage new reward submissions.

Shared UI is in `apps/web/components/community.tsx`. Existing audit views remain in `apps/web/components/views.tsx`; the join guide moved out of that file. `next` also changes views/tests: preserve its accepted additions when eventually integrating both histories. Do not wholesale replace either version.

## Validation and actual stage

- Full `pnpm test` at `a717c17`: **119 core, 26 read-client, 135 web, 1037 API passed; 3 API skipped**. Exit 0.
- Full `pnpm typecheck` and `pnpm lint`: exit 0. Lint: 417 files, no fixes/diagnostics.
- `pnpm --filter @hyphae/web build`: exit 0; new about/join pages are dynamic server routes.
- After the wording follow-up: **34 view tests passed**, focused Biome and whitespace checks clean. No runtime logic changed in that follow-up. The full gate/build was not repeated after this text-only fix.
- Initial full tests/typecheck failed because the local dependency tree lacked the already locked `@typesafe-ai/sdk` 0.6.0. `pnpm install --frozen-lockfile` restored one cached package; manifest/lockfile unchanged. The repeated full gate passed. `@organichub/verify` remains 0.1.0.
- Browser walkthrough used the local web app against actual public API reads: overview → context FAQ → join. Desktop and **390×844** mobile checks, one main heading/current tab per page, no horizontal overflow/offscreen links, four join steps, working FAQ disclosure, zero browser console errors.
- Public read during walkthrough: **epoch 2 open to Oct 10 00:00 UTC, intake open, no on-chain vault available**. These reads establish website rendering only, not payout readiness.
- Stage: **local implementation and local verification only**. No DNS/provider changes, production writes, keys, signing, funding, messages or deployment. All C14–C22 remain incomplete and paused. Actual payees, amounts, publish/claim/P14 receipts: none.

## Next member-workspace design — DRAFT

The following is a concrete direction for the next implementation plan, not authorization to change existing eligibility, publish code, operate a provider account or weaken wallet proofs.

1. **One app, community-scoped screens.** Retain `/c/<mint>` as the canonical route and immutable DB community/member IDs internally. Organic can redirect to these screens after authorized publication. Verified domain aliases map to the same workspace later; aliases never confer membership or admin authority. No Organic repository changes or new cross-service auth contract here.
2. **An account is not a payout wallet.** Verify the provider access token on the server (signature, issuer, this application's audience and expiry). Map its stable subject to a Hyphae account; resolve that account's member inside the selected community. Never trust browser-supplied member/Telegram IDs, pasted wallets, usernames or matching email addresses as proof. Provider identity and email remain private.
3. **Preserve existing members.** Link a new login to the existing member UUID only through proof of the existing identity; use an explicit one-time account-linking ceremony and reject conflicting associations. Do not replace members, merge by name, backdate wallet evidence or change close snapshots. Account linking and reward-wallet verification remain separate actions.
4. **Stage Telegram independence.** Current member rows require Telegram IDs; current membership checks require the registered group, and `@organichub/verify` 0.1.0 is Telegram-bound. A provider button cannot remove those constraints. First support linked existing members on the website. Web-only membership needs a separately reviewed schema/identity-proof design and explicit eligibility scope; never manufacture Telegram IDs. Preserve the package pin through Oct 12.
5. **A real website quiz.** Resolve the test from the server's pinned epoch configuration, deliver it privately to the authenticated member, validate answers and grade on the server with existing `grade`. Recheck member/community and current test before recording. Reuse `recordPass` and its first-pass DB-clock timestamp; strict pre-close timing stays unchanged. Stale tests, malformed answers, unauthenticated users and unknown membership cannot create a pass. A post-close pass cannot make the closed epoch eligible. Browser completion/local storage never proves a pass or payment. Preserve the saved quiz-privacy decision queue.
6. **Useful work and personal progress.** Serve approved tasks for the selected community with their brief, target, deadline and actual state; no proposed/private tasks in public feeds. For private progress, derive the requesting member on the server and report real wallet, test and contribution states. Reuse the held `next` wallet/status work when its release is permitted; don't duplicate or expose private records through anonymous public reads.

The existing DB journal is through 0017. Reviewed `next` owns migrations **0018 + 0019** and its rollout script pins them. Any new identity migration must be planned after that reviewed sequence; don't generate a competing 0018 on main or merge next early. New auth/member/proof/quiz mutations require real Postgres tests, schema check and fresh other-family review before publication.

Privy documents [email and Solana authentication](https://docs.privy.io/authentication/overview) and [backend access-token verification](https://docs.privy.io/authentication/user-authentication/access-tokens). Those capabilities support the proposed login layer; they do not establish Hyphae membership or reward-wallet evidence. No SDK/API compatibility or provider configuration has been tested in this implementation.

## Publication and downstream changes

Pending local commits before this checkpoint document: `c64624519e9091c0a00d8963db0761b5aefd9ff2`, `6abf23a4e23ef2e2ba41cba2d9acb92fb66f2984`, `b1385404823f620ef0ba3bd9bb773e0b99f12053`, `a717c17d25b1f450e34a5d3c1276f976c9bdd104`, `b750dd98aa8b9b1ca629779172d05d19b3132ebe`.

No push: existing publication/release conditions remain held; **Oct 9 22:00Z–Oct 11 00:00Z freeze** remains. A passing local gate is not release authorization. Reviewed next still needs its recorded release conditions and Cisco's exact yes. Payout dates and this website request do not resume money actions. Root/payout consumers receive no changed API shape; future Organic links may use the new routes only after publication. Organic-sync owns vault/Organic propagation; neither was edited here.

## Generated artifacts this session

| Artifact | Canonical home | Stage |
|---|---|---|
| Community views/routes/tests | `apps/web/`, commits above | Local, committed |
| Browser captures | `docs/plans/2026-10-09-community-home-desktop.png`, `2026-10-09-community-home-mobile.png`, `2026-10-09-community-join-mobile.png` | Local, ignored; public API rendering, not payment proof |
| Gate logs | `docs/plans/2026-10-09-website-tests.log`, `2026-10-09-website-typecheck.log`, `2026-10-09-website-build.log` | Local, ignored |
| Developer preview | Local port 3010; `pnpm --filter @hyphae/web dev --port 3010` | Running locally at checkpoint; existing read token server-side only |
| Keys, provider accounts, deployed resources, jobs | None | None created |

## Suggested skills

handoff-memory, the-analyst, superpowers:brainstorming for the identity design, frontend-design, superpowers:test-driven-development for new behavior, verification-before-completion, handoff. Use an other-family reviewer for any new sensitive implementation; this checkpoint is not that review.

## Next-session prompt

```text
Funding/payouts explicitly PAUSED. Cisco approved a complete website member experience with Telegram optional. Community home/context/join work locally at b750dd9; no login/web quiz/task feed/private progress yet. Next 1249fed remains held. Preserve BOTH histories and the 0018+0019 sequence, verify 0.1.0 through Oct 12, publication conditions and freeze.

Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-10-09-community-web-foundation.md, apps/web/components/community.tsx, apps/web/components/views.tsx, packages/db/src/schema.ts, apps/api/src/payout/rules-test.ts
Model: available architecture/reasoning model at high effort — account/member and payout-proof separation need careful design; record the actual runtime identity rather than guessing it.
Skills: handoff-memory, the-analyst, superpowers:brainstorming, frontend-design, verification-before-completion, handoff.

Read the pending login-method reply if one arrived, otherwise keep the recommended email/existing-wallet design as a draft. Present the account-linking and web-quiz implementation plan. Do not equate a provider login with member or wallet eligibility. Preserve all existing records and held next features. Keep independent local website improvements moving; do not deploy, change provider/DNS/keys or resume C14–C22.
```
