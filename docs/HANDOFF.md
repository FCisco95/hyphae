---
date: 2026-09-27
summary: Sep 27 closed with everything pushed and CI green; nothing is deployed. The afternoon arc proved the payout path on devnet, passed a three-round program security review, added CI, the wallet-claims API and the Ledger transport. That evening Cisco settled every pre-mainnet key question. The MYCEL Treasury (a 2-of-3 Squads multisig) exists on mainnet and its vault is MYCEL's fee address. Hyphae's admin and upgrade key is a dedicated Ledger account, 2kz1Zq…, rehearsed on devnet. The publish script must now name its Ledger account. Next: .env.example, a verifiable-build rehearsal, then the Oct 1 checklist (86ff258 + 0009).
---

# Hyphae handoff

## TL;DR

**Built, reviewed, pushed and CI-green on `main` (`333e2ce`); nothing is deployed.**
- **Payout path proven on devnet**, seven runs. Runs 6 and 7 were signed on Cisco's Ledger Flex, run 7 from Hyphae's own admin account. Record: `handoffs/2026-09-27-devnet-proof.md`.
- **Keys settled** (`handoffs/2026-09-27-keys-and-fee-rulings.md`):
  - **Admin and upgrade key:** the Ledger account `2kz1Zq…` (`44'/501'/2'/0'`), used for nothing else.
  - **MYCEL's fee address:** the vault of the new MYCEL Treasury Squads (2-of-3), `rRce…u7MK`.
  - **Before mainnet:** a verifiable build.
  - **Program keypair:** backed up offline.
- **The publish script names its signer.** `--signer ledger` has no default account, and a malformed path is refused. Codex `gpt-6-astra` xhigh reviewed it: round 1 NEEDS-ATTENTION (2 low, fixed), round 2 APPROVE.
- **From the afternoon arc:** a three-round program security review with no fund-loss path, CI, the wallet-claims API with rate limits and OpenAPI, phone layouts and the public custody policy. Record: `handoffs/2026-09-27-afternoon-arc.md`.

**What to do next:**
1. `.env.example`: add `READ_RPC_URL`, `READ_API_WEB_TOKEN` and the two hold RPC URLs.
2. Rehearse a verifiable build from `333e2ce`, local only, and record its hash.
3. Prepare the Oct 1 checklist below with Cisco, one step per message.

**Waiting on Cisco:** nothing until the Oct 1 hard stops.

Snapshot: [evening keys and Ledger](handoffs/2026-09-27-evening-keys-and-ledger.md).

**For the Organic sync:** read [For Organic and other integrators](#for-organic-and-other-integrators) below and [the key rulings](handoffs/2026-09-27-keys-and-fee-rulings.md).

## Metadata

- Last updated: 2026-09-27, evening (session end).
- Runner: Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, xhigh. Git, Docker (Postgres 17), WSL and Playwright all worked.
- Reviewers: Codex CLI 0.157.1, **`gpt-6-astra`, xhigh**, read-only, a fresh session each round. Six rounds; the verdicts are in the snapshot. Two more that evening on the Ledger-path change: round 1 NEEDS-ATTENTION (2 low, fixed), round 2 APPROVE (`handoffs/2026-09-27-keys-and-fee-rulings.md`).
- Authority:
  - The session prompt's pre-approvals (local/devnet R6 + Anchor, Week 3 #9, Week 4 #1, #2, #4, #5).
  - Decisions 2 and 3, answered in-session (`handoffs/2026-09-27-custody-wording-and-ledger-rulings.md`).
  - The key and fee rulings, answered in-session that evening (`handoffs/2026-09-27-keys-and-fee-rulings.md`).
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
| Ledger transport, node-hid allowlisted | `34c14dd` | Pushed. Real-device devnet runs 6 and 7 passed. |
| Signer: `--signer ledger:<path>` required | `f3589b2`, `4f28ad4`, `e37bc32` | Pushed; CI green (`36343073180`); Codex round 2 APPROVE. |
| Hyphae admin and upgrade key `2kz1Zq…` | Ledger `44'/501'/2'/0'` | Ruled. Devnet run 7 passed. Not yet funded or used on mainnet. |
| MYCEL Treasury Squads | multisig `34wSn…`, vault `rRce…u7MK` | **On mainnet**, created by Cisco's Ledger 18:17Z. Nothing is sent there until the community exists. |
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

**Latest gate, at `e37bc32`, on the signer change**
- `pnpm test`: **663 passed** (core 106, web 45, api 512) + 1 skipped devnet harness.
- Typecheck 0; `pnpm lint` 0 (234 files); `git diff --check` clean.
- CI on `333e2ce`: **green** (`36343073180`).
- Not rerun, because nothing they cover changed after `5963852`: `test:pg` 42/42, `drizzle-kit check` pass, `next build` pass.
- Rust is unchanged since `b782495`: WSL `anchor build` 0 with `.so` `cb4ffdd8…8d79`, `cargo fmt --check` clean, `cargo test` 24 + 6. The CI `Program` dispatch (`36332048980`) built the same hash.
- Python vectors: 16.

**Devnet with the real Ledger:** runs 6 (`44'/501'/0'`) and 7 (`44'/501'/2'/0'`) each had 4 device approvals, a paid claim, a duplicate refused on-chain and P14 `paid`.

**Afternoon arc gate** (`5963852`): 654 tests, test:pg 42/42 and the local end-to-end API and web checks. Details are in `handoffs/2026-09-27-afternoon-arc.md`.

## Devnet and Deployment Readiness

**Devnet:**
- Admin `Fcv1xtZ6…` holds **3.51 devnet SOL** (15:27Z).
- The program is deployed there.
- The Ledger real-device runs passed (runs 6 and 7 in `handoffs/2026-09-27-devnet-proof.md`). Hyphae's admin `2kz1Zq…` keeps about 0.09 devnet SOL.

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
- Every mainnet command passes `--signer ledger:44'/501'/2'/0'` (Hyphae's admin `2kz1Zq…`).

### October 6 checkpoint

- **Done:**
  - devnet proof, including two real-Ledger runs (6, 7);
  - program security review, fixes, CI;
  - decisions 1–3; Q1 wording public; Q3;
  - P8: MYCEL Treasury vault `rRceAUBN…u7MK`;
  - Hyphae's admin and upgrade key `2kz1Zq…`, ruled and rehearsed;
  - program keypair backed up offline.
- **Still needed before the mainnet program deploy:**
  - a verifiable build from the reviewed commit;
  - `2kz1Zq…` funded for fees and rent only, set as upgrade authority, and read back from the chain.

## Next Actions

1. `.env.example`: add `READ_RPC_URL`, `READ_API_WEB_TOKEN` and `HOLD_RPC_HELIUS_URL`/`HOLD_RPC_FALLBACK_URL`, with names and comments only, no values.
2. Rehearse a verifiable build from `333e2ce` in WSL (`solana-verify` or `anchor build --verifiable`); record the hash. Local only.
3. Oct 1: the checklist above, one step per message with Cisco.
4. Before the mainnet deploy: the verifiable build, then deploy with `2kz1Zq…` as upgrade authority and read it back.
5. Oct 7–8: MYCEL's community, with `--signer ledger:44'/501'/2'/0'` and the fee address set to the vault `rRce…u7MK`, each step with Cisco's yes.

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
| Hyphae's mainnet admin Ledger account | **Ruled 2026-09-27: `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`**, Cisco's Ledger at `44'/501'/2'/0'`, used only for Hyphae (the admin of every community and the program's upgrade key). No mainnet history and 0 SOL at 19:55Z. The script used to fall back to `44'/501'/0'`, which on Cisco's device is an account already in use. `--signer ledger` now has no default path; every run passes `--signer ledger:44'/501'/2'/0'`. The admin is part of each community's address, so MYCEL's community is permanently tied to it. | Rehearsed on devnet: run 7 passed, 18:58Z. Before the mainnet deploy, fund it for fees and rent only; the pot is funded per epoch. |
| Organic's adapter field | **Ruled:** Cisco controls Organic; the Organic sync carries it. | Read `settlement.allocation` / `settlement.payment`. See the section below. |

Minor: `.env.example` should list `READ_RPC_URL`, `READ_API_WEB_TOKEN` and the two hold RPC URLs (next action 1).

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| MYCEL Treasury Squads v4 multisig `34wSn95ZFMsvsq7w6g8Rej7GSagGmpc6Vq5aHiCebu51`, vault `rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK` | Solana mainnet | Created by Cisco's Ledger. 2-of-3 with three existing keys, so no new secret. Send only to the vault. |
| Hyphae admin account `2kz1Zq…` | Cisco's Ledger, `44'/501'/2'/0'` | Derived, not generated; the secret never leaves the device. |
| Program keypair offline copy | Cisco's external SSD | The original stays in `target/deploy/` (gitignored) on the Windows machine. |
| Devnet runs 6–7: mints `8qPH…`, `362Q…`, their communities and vaults | Solana devnet | Throwaway. Funding came from the throwaway devnet admin. |
| Wallet registry note | Private vault, `40 - RESOURCES/Wallets — Registry.md` | Public addresses and secret locations only. Never write a recovery phrase there. |
| Staged claimant keypair copies | Session scratchpad | Deleted after each run. |

Commits: `3237aac` … `333e2ce` (Hyphae); vault `b1ab58f` … `f8b5628`. Nothing deployed, no Neon write, no secret changed.

**Suggested skills, in order:**
1. `handoff-memory`: loads this file at session start.
2. `solana-dev`: verifiable build and the mainnet deploy checklist.
3. `context7-mcp`: `solana-verify` / Anchor verifiable-build docs.
4. `superpowers:test-driven-development`: for any code change.
5. `superpowers:verification-before-completion`, then `deploy-to-vercel` for Oct 1, and `handoff` at the end.

## Next-session prompt

```
Hyphae main is at 333e2ce, pushed, CI green; nothing deployed. Keys are settled: admin and upgrade key = Cisco's Ledger 2kz1Zq… (44'/501'/2'/0'), rehearsed on devnet (run 7); MYCEL's fee address = the MYCEL Treasury Squads vault rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK; verifiable build before mainnet. Oct 1 deploys 86ff258 + 0009.

Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-09-27-keys-and-fee-rulings.md, docs/handoffs/2026-09-27-devnet-proof.md, docs/handoffs/2026-09-24-cutover-decisions.md, .env.example, Anchor.toml, .github/workflows/program.yml
Model: claude-opus-5-5 (xhigh): deploy prep with production hard stops rewards care over speed
Skills: handoff-memory, solana-dev, context7-mcp, superpowers:test-driven-development, superpowers:verification-before-completion, handoff

Add READ_RPC_URL, READ_API_WEB_TOKEN, HOLD_RPC_HELIUS_URL and HOLD_RPC_FALLBACK_URL to .env.example (names and comments only). Then rehearse a verifiable build of programs/hyphae from 333e2ce in WSL, locally, and record its hash in docs. Then walk Cisco through preparing the Oct 1 checklist in docs/HANDOFF.md, one step per message. No Neon, Fly, Vercel or mainnet actions without Cisco's yes.
```
