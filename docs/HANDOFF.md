---
date: 2026-09-27
summary: The Sep 27 afternoon arc is on main and pushed; nothing is deployed. Devnet proven: publish, claim, a duplicate refused on-chain, and P14 read back from devnet. The Oct 1 candidate 86ff258 re-gated clean. A three-round program security review found no fund-loss path, and its findings are fixed or accepted as scoped. CI is green. Also added: a wallet-claims route with rate limits, OpenAPI and /docs; phone layouts; the custody policy on /rules, the epoch page and the README; and a working Ledger transport. Oct 1 deploys 86ff258 + 0009. Main is the Oct 7–8 payout candidate and needs 0010–0012. Cisco then answered the key questions: the upgrade key is his Ledger alone, a verifiable build comes before mainnet, he backs up the program keypair, and MYCEL's fee goes to a MYCEL treasury: a new 2-of-3 Squads multisig with the same three members as Organic's platform multisig. Its vault address is pending.
---

# Hyphae handoff

## TL;DR

**Everything the arc planned is built, reviewed and on `main`; nothing is deployed.**
- **Proof on devnet.** The program runs there with throwaway keys. A publish from the stored intent, a claim, a duplicate refused on-chain and the P14 read are all recorded with signatures.
- **Oct 1.** `86ff258` passes its exact gate again.
- **Program security review.** Codex `gpt-6-astra`, xhigh, three rounds: no withdrawal, forged-proof or double-claim path. Five client findings are fixed, or accepted as scoped by the reviewer.
- **CI** runs the full gate on every push, green.
- **API and site.** The API serves a wallet's claims, rate limits, OpenAPI and `/docs`. The site works on a phone. The approved custody policy is public.
- **Ledger.** The transport works; a library bug that would have blocked every real-device publish is fixed.

Record: [afternoon snapshot](handoffs/2026-09-27-afternoon-arc.md).

**Waiting on Cisco:**
- the Ledger real-device devnet run (steps in [the Ledger record](handoffs/2026-09-27-ledger-transport.md));
- nothing else from the key rulings: the MYCEL Treasury Squads is created and confirmed, and the program keypair is on the external SSD.

**For the Organic sync:** read [For Organic and other integrators](#for-organic-and-other-integrators) below and [the key rulings](handoffs/2026-09-27-keys-and-fee-rulings.md).

## Metadata

- Last updated: 2026-09-27 (afternoon arc).
- Runner: Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, xhigh. Git, Docker (Postgres 17), WSL and Playwright all worked.
- Reviewers: Codex CLI 0.157.1, **`gpt-6-astra`, xhigh**, read-only, a fresh session each round. Six rounds; the verdicts are in the snapshot.
- Authority:
  - The session prompt's pre-approvals (local/devnet R6 + Anchor, Week 3 #9, Week 4 #1, #2, #4, #5).
  - Decisions 2 and 3, answered in-session (`handoffs/2026-09-27-custody-wording-and-ledger-rulings.md`).
  - The key and fee rulings (`handoffs/2026-09-27-keys-and-fee-rulings.md`).
  - Earlier rulings unchanged.
  - Nothing approves Neon writes, production deploys or mainnet transactions.

## Current State

| Component | Commit | Stage |
|---|---|---|
| Program (unchanged since `b782495`) | `.so` sha256 `cb4ffdd8…8d79` | **On devnet** (`EAz8WkyU…`, upgrade authority = throwaway admin). Not on mainnet. |
| Devnet proof | `3237aac`, `d28b080` | Runs 2, 3 passed; 4, 5 landed every transaction (public-RPC 429 on reads). P14 read from devnet on the final build. |
| Security fixes (F1–F5) | `eaa8f1a` … `a9d6a5a` | Pushed. |
| CI | `894b7b1`, `68db100` | `CI` green on main (`36332044728`); `Program` green on dispatch (`36332048980`), weekly after. |
| Wallet claims, rate limits, OpenAPI, `/docs` | `d712289`, `135a80f`, `a40f575`, `6e48b12`, `2ac312d` | Pushed, not deployed. |
| Migration 0012 (`leaves_wallet` index) | `2c689aa` | Pushed. **Not applied to Neon.** |
| Web polish, screenshots, custody policy | `236905e`, `ffdfac0`, `37d09cc` | Pushed, not deployed (no Vercel project yet). |
| Ledger transport, node-hid allowlisted | `34c14dd` | Pushed. Fake-device tested; no real-device run yet. |
| Production | Fly `b7bfe55`, Neon 0000–0008 | Last recorded, not queried. `b7bfe55` does not serve `/v1`. |

## Interfaces and Invariants

- `GET /v1/wallets/:wallet/claims?offset&limit`:
  - every leaf of the wallet in a recorded publication of a served epoch, newest first;
  - each entry carries its addresses, proof and payment: `paid` with the chain-proven `claim_tx`, `claimable` (no blockhash), or `unavailable` with a reason;
  - one chain deadline for the whole list, and no read starts after it;
  - `/v1/wallets/:wallet` stays unserved (A15).
- Rate limits on `/v1`:
  - `RateLimit-Policy/Limit/Remaining/Reset` on every response.
  - 300 a minute per `Fly-Client-IP`. Past it: `429`, `Retry-After`, body `{ "error": "unavailable" }` (A4: the error enum is closed).
  - With the bearer `READ_API_WEB_TOKEN`, the api trusts `x-hyphae-visitor` and gives each visitor their own window; the web's own reads get 10×.
  - The web sends the token (`HYPHAE_API_TOKEN`) server-side only, naming the visitor from `x-real-ip`. Vercel overwrites that header. If the web ever runs elsewhere, its ingress must overwrite it too, or visitors can pick their own window.
- `/v1/openapi.json` is generated from `ReadApiV1`; a test fails on an undocumented route. `/docs` runs Scalar 1.72.1, pinned with SRI.
- `programAccount()`: an empty, System-owned, non-executable account at a program address reads as not created. Every other owner is refused.
- `creatingTransaction(…, { exhaustive })`: publish recovery searches the whole history, the epoch account's second first. Public reads stay bounded.
- `signSimulated()`: every operator send is simulated as the exact unsigned message, only partial signers are accepted, and no signer is asked for a failing transaction.
- The custody policy lives once, in `@hyphae/core` `CUSTODY_POLICY`, and is shown on `/rules`, the epoch page and the README (a test holds the README to it).
- Unchanged: the 89-byte leaf, roots, audit bytes, 3% fee, allocated-only reserve, P14 in `epoch.settlement`.

## Validation

Final gate on `5963852`, which gives one seed-heavy test a 30 s budget; no code changed after `5daeb9b`.

**Tests**
- `pnpm test`: **654 passed** (core 106, web 45, api 503) + 1 skipped devnet harness.
- `test:pg` on Docker Postgres 17: **42/42**.

**Static checks and builds**
- Typecheck: 0.
- `pnpm lint`: 0 (234 files).
- `drizzle-kit check`: pass.
- `git diff --check`: clean.
- `next build`: pass.

**Rust and vectors**
- WSL `anchor build`: 0, same `.so` hash.
- `cargo fmt --check`: clean.
- `cargo test -p hyphae --tests`: **24 + 6** (3 new prefunded-PDA tests).
- Python vectors: 16.

**Local end to end**
- The built api on a local Postgres, holding the demo seed and a devnet publication, read against devnet: README examples, `/docs`, P14 and the claim route.
- The built web was screenshotted at 390 and 1180.

**CI:** the push of `c2a72d4` ran **green** (`36332044728`): the full gate, test:pg on Postgres 17, the vectors, and node-hid's Linux prebuild on install. `Program` dispatch **green** (`36332048980`): `anchor build` gave the same `.so` sha256 as local WSL (`cb4ffdd8…8d79`), and `cargo test` passed 24 + 6.

## Devnet and Deployment Readiness

**Devnet:**
- Admin `Fcv1xtZ6…` holds **3.51 devnet SOL** (15:27Z).
- The program is deployed there.
- The Ledger real-device run follows `handoffs/2026-09-27-ledger-transport.md`, one step at a time with Cisco.

### October 1 — attended checklist (deploy candidate `86ff258`)

**Rehearsed 2026-09-27, read-only, in a temporary worktree:** its exact gate passed. `pnpm -r test` 453, typecheck 0, Biome 179 tracked files, `drizzle-kit check`, `test:pg` 15/15, `git diff --check`. Nothing to add to the checklist. The procedure is unchanged.

Run Runbook B (`handoffs/2026-09-24-cutover-decisions.md`), one step per message, with Cisco at every hard stop:

1. **Gate `86ff258`** exactly: `pnpm -r test`, typecheck, tracked-file Biome, `drizzle-kit check`, `test:pg`, `git diff --check`.
2. **Read-only Neon check** (agent): journal at 0000–0008 with matching hashes; 0009's tables absent.
3. **Two hold RPCs** (Cisco): `fly secrets set HOLD_RPC_HELIUS_URL=… HOLD_RPC_FALLBACK_URL=… --stage`. They must be two independent mainnet providers; the code refuses either unless it returns mainnet's genesis hash.
4. **Apply 0009** (Cisco), then post-checks (agent). **Only 0009.**
5. **Deploy `86ff258`** (Cisco) and verify:
   - `/health` and `/link`;
   - the worker's `hold-check` and `reward-recovery` queues;
   - `/rules` in Hyphae Lab.
6. **Bot token re-rotation** (Runbook B step 9, open since Sep 24):
   1. BotFather `/revoke`.
   2. Put the token into `.env` in an editor.
   3. `fly secrets set` from `.env`.
   4. `setWebhook` with `drop_pending_updates`.
   5. Confirm `getWebhookInfo` is clean.
7. **Vercel** project for `apps/web` (Cisco): `HYPHAE_API_URL=https://hyphae-api.fly.dev`, `DEFAULT_MINT=<MYCEL mint>`. Vercel builds `main`. That web runs against the `86ff258` API, because `settlement` is optional to a consumer: pages show "Not allocated" and `/claim` says nothing is published yet. Pinning the web to `86ff258` also works.
8. **Fly `PUBLIC_WEB_URL`** = the Vercel site's URL (the default `https://hyphae.fun` does not resolve).
9. **`first_paid_epoch` go/no-go before 2026-10-02T00:00Z** (Cisco). On a yes: `update communities set first_paid_epoch = 2 where mint = '<MYCEL mint>' and first_paid_epoch is null;`. Epoch 1 stays unpaid.

**Not on Oct 1:** current `main` is the **Oct 7–8 payout candidate**. It needs:
- **0010, 0011 and 0012**. Never deploy it against 0009 alone. Apply 0010 with the worker stopped or a `lock_timeout`, since it takes ACCESS EXCLUSIVE on four reward tables. 0011 creates two tables; 0012 creates one index on the empty `leaves` table.
- `READ_RPC_URL` (Fly secret) on the publication's network.
- **One shared random token**, set as two secrets: `READ_API_WEB_TOKEN` on Fly and `HYPHAE_API_TOKEN` on Vercel, at least 32 characters. Without it, all web visitors share the per-address limit. Setting secrets is Cisco's step.
- The Ledger real-device devnet run.

### October 6 checkpoint

- **Done:**
  - devnet proof (publish, claim, duplicate refused on-chain, P14 read);
  - program security review, fixes, CI;
  - decisions 1–3; Q1 wording public; Q3.
- **Still needed:**
  - Cisco's Ledger real-device devnet run;
  - P8: done. The MYCEL Treasury Squads vault is `rRceAUBN…u7MK`;
  - before mainnet: a verifiable build and the Ledger set as upgrade authority (both ruled yes).

## Next Actions

1. Cisco: the Ledger real-device devnet run, one step at a time (`handoffs/2026-09-27-ledger-transport.md`).
2. Oct 1: the checklist above.
3. Done 2026-09-27: the program keypair is on the external SSD, and the MYCEL Treasury Squads is created.
4. Before the mainnet deploy: a verifiable build, and deploy with the Ledger as upgrade authority, read back from the chain.

## For Organic and other integrators

Organic reads Hyphae only through the public read API; Hyphae never touches `organic-app`. Full contract: [the key rulings](handoffs/2026-09-27-keys-and-fee-rulings.md#for-organic-and-other-integrators).

1. **Contract:** `GET /v1/openapi.json` (OpenAPI 3.1, generated from `ReadApiV1`). v1 changes are additive only, so ignore unknown fields.
2. **Payouts:** read `epoch.settlement.allocation` and `epoch.settlement.payment`. The top-level `allocation`/`payment` always say `unavailable` with reason `see_settlement`.
3. **A member's claims:** `GET /v1/wallets/{wallet}/claims`, with proofs, at most 100 per page.
4. **Limits:** 300 requests a minute per IP. Only Hyphae's web has a token; if Organic needs more, add one token per integrator.
5. **Not live yet:** production `b7bfe55` has no `/v1`. The Oct 7–8 candidate serves it after migrations 0010–0012.

**Organic-side proposal (not Hyphae work):** when a community bonds, Organic creates a 2-of-3 treasury (Organic, the community's admin or developer, and the community), with Organic as the tiebreaker if one side goes silent. That treasury must exist before the community is initialized in Hyphae, because its address becomes the permanent `fee_recipient`. It needs its own Organic design, with custody calls for Cisco.

## Open Decisions

| Item | Status | Recommendation |
|---|---|---|
| P8 fee address | **Created 2026-09-27 18:17Z:** MYCEL Treasury, a Squads v4 multisig `34wSn95ZFMsvsq7w6g8Rej7GSagGmpc6Vq5aHiCebu51`, 2-of-3, with the same three members as Organic's platform multisig. **Fee address = its vault `rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK`.** | Pass the vault, never the multisig account, to `initialize_community` (Oct 7–8, its own hard stop). Squads' `isSquad` check: the vault passes (v4); the multisig account does not. |
| Upgrade authority on mainnet | **Ruled:** Cisco's Ledger, and only Cisco. | Deploy with it, then read the ProgramData authority back before funding the vault. |
| Verifiable build | **Ruled yes**, before the mainnet deploy. The Cargo.lock resolves `anchor-syn`/`anchor-derive-accounts` 1.2.0 under `anchor-lang` 1.0.1. | `anchor build --verifiable` (or `solana-verify`) from the reviewed commit; publish the hash. Keep the current lockfile. |
| Program keypair backup | **Done 2026-09-27:** Cisco copied it to an external SSD. Public key checked: `EAz8WkyU…d6E`. | Keep the SSD offline. Until the mainnet deploy, the file can deploy any program at that address. |
| Organic's adapter field | **Ruled:** Cisco controls Organic; the Organic sync carries it. | Read `settlement.allocation` / `settlement.payment`. See the section below. |

Minor, outside this arc's writable paths: `.env.example` should list `READ_RPC_URL`, `READ_API_WEB_TOKEN` and the two hold RPC URLs.

## Generated Artifacts and Suggested Skills

**Artifacts**
- Commits `3237aac` … `5daeb9b`.
- `.github/workflows/ci.yml`, `program.yml`.
- `docs/screenshots/*.png` (8).
- Handoff records:
  - `docs/handoffs/2026-09-27-devnet-proof.md`
  - `-custody-wording-draft.md`
  - `-custody-wording-and-ledger-rulings.md`
  - `-ledger-transport.md`
  - `-afternoon-arc.md`
  - `-keys-and-fee-rulings.md`
- Devnet: the program, five throwaway communities and their accounts.
- No production change, no mainnet transaction, no secret.

**Suggested skills:**
- `solana-dev`: verifiable build and mainnet deploy checklist.
- `superpowers:test-driven-development`.
- `superpowers:verification-before-completion`.
- `context7-mcp` (Ledger, Vercel env).
- `deploy-to-vercel` for Oct 1.
- `handoff`.

## Next-session Prompt

```text
Resume Hyphae. Read CLAUDE.md, AGENTS.md, docs/HANDOFF.md and docs/handoffs/2026-09-27-afternoon-arc.md. The Sep 27 afternoon arc is pushed: devnet proof recorded (2026-09-27-devnet-proof.md), program security review fixed or accepted over three Codex astra rounds, CI green, wallet-claims route + rate limits + OpenAPI /docs, phone layouts, the approved custody policy public, and the Ledger transport working (fake-device tested). Next with Cisco: the Ledger real-device devnet run (2026-09-27-ledger-transport.md, one step per message), then the Oct 1 checklist (86ff258 + 0009, unchanged, rehearsed clean). Main is the Oct 7-8 candidate: needs 0010-0012, READ_RPC_URL, READ_API_WEB_TOKEN/HYPHAE_API_TOKEN. Ruled (2026-09-27-keys-and-fee-rulings.md): upgrade key = Cisco's Ledger only; verifiable build before mainnet; Cisco backs up the program keypair; MYCEL's fee goes to a MYCEL treasury on his Ledger. MYCEL's treasury is a new Squads v4 multisig 34wSn95ZFMsvsq7w6g8Rej7GSagGmpc6Vq5aHiCebu51, 2-of-3, with the same three members as Organic's platform multisig; the fee address is its vault rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK. No Neon writes, production deploys or mainnet transactions without Cisco's yes.
```
