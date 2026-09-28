---
date: 2026-09-28
summary: The Sep 28 arc is pushed; nothing is deployed. The program's verifiable build reproduces (cb4ffdd8…8d79; on-chain 7e902d1b…43ac), and the Ledger deploy sequence was rehearsed on devnet with a stand-in key. A new init-community command covers mainnet community setup, and Runbook C covers Oct 7–9. A whole-repo security review found three mediums: two fixed test-first, one parked for Cisco. The test:pg flake has a measured cause and fix. The Oct 9 video script and the Oct 10 checklist are written. Next: Oct 1 deploys 86ff258 + 0009, attended.
---

# Hyphae handoff

## TL;DR

**Built, reviewed, gated and pushed on `main`; nothing is deployed.**
- **Verifiable build:** two clean builds in `solanafoundation/anchor:v1.0.1` give sha256 `cb4ffdd8…8d79`; `solana-verify` reads `7e902d1b…43ac`, the same as the devnet program. Record: `handoffs/2026-09-28-verifiable-build-and-deploy-rehearsal.md`.
- **Deploy sequence rehearsed on devnet:** a hot key writes the buffer, hands it to a Ledger stand-in, and only the stand-in deploys. Authority and hash read back.
- **Runbook C** (`handoffs/2026-09-28-runbook-c.md`): Oct 7–9, step by step, with who runs each step, its check, its rollback and every Ledger approval.
- **New operator command** `apps/api/scripts/init-community.ts`: plans or sends `initialize_community`, Ledger-only on mainnet, refuses a non-wallet fee address; rehearsed on devnet.
- **Security review:** HYP-01 (quota race) and HYP-02 (bot token in worker errors) fixed test-first. HYP-03 (X handle ownership) is Cisco's call. Record: `handoffs/2026-09-28-arc.md`.

**What to do next:**
1. **Oct 1**, attended: the checklist below, one step per message with Cisco.
2. **Oct 2–6:** the next-arc list below.
3. **Oct 7–9:** Runbook C, one step per message.

**Waiting on Cisco:** Questions 1–3 in `handoffs/2026-09-28-arc.md` (handle attestation, the pot's source, a Ledger devnet deploy). Answers are needed by Oct 6 for Question 3, and by Oct 8 for Questions 1 and 2.

Snapshot: [the Sep 28 arc](handoffs/2026-09-28-arc.md).

## Metadata

- Last updated: 2026-09-28 (session end).
- Runner: Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, xhigh. Git, Docker, WSL and the Windows Solana CLI worked.
- Reviewers: Codex CLI 0.157.1, **`gpt-6-astra`, xhigh**, read-only, a fresh session each.
  - Step 5, whole repo: NEEDS-ATTENTION (3 medium: 2 fixed, 1 parked).
  - Step 8, the arc range: seven rounds, every finding in Runbook C or the video script, **round 7 APPROVE**. Sessions and findings: the snapshot.
- Authority:
  - the session prompt's pre-approvals: local and devnet work including throwaway-key devnet deploys; the key, fee and verifiable-build rulings; plan Week 4 #1, #2, #4 and #5;
  - Cisco dropped Week 4 #3 (web `/admin`) on 2026-09-27 19:43Z;
  - nothing approves Neon writes, production deploys, mainnet transactions or use of Cisco's Ledger.

## Current State

| Component | Commit | Stage |
|---|---|---|
| Program (source unchanged since `82657db`) | `.so` sha256 `cb4ffdd8…8d79`, on-chain hash `7e902d1b…43ac` | **On devnet** (`EAz8WkyU…`, upgrade authority = throwaway admin). Verifiable build reproduced. Not on mainnet. |
| Deploy rehearsal | `a6da160` | Devnet program `6opWfFKk…e1ox`, upgrade authority = stand-in `GQxUJ…KaTA`. |
| `init-community` | `553d64c` | Pushed; rehearsed on devnet (init `2d9NXz…3oyw`). |
| Security fixes HYP-01, HYP-02 | `747faa7`, `4d3d48b` | Pushed. Reach production with `main` on Oct 7 (C7). |
| `test:pg` budgets | `59ebcab` | Pushed. |
| `.env.example` + its test | `328e3dd` | Pushed. |
| Runbook C, video script, checklist | `5abf89c`, `14e42f7`, `30e5762`, `4d64abb` | Pushed. |
| Migrations 0010–0012 | `dabfb56`, `2c689aa`, … | Pushed. **Not applied to Neon.** |
| Hyphae admin and upgrade key `2kz1Zq…` | Ledger `44'/501'/2'/0'` | Ruled; devnet run 7 passed. Not funded or used on mainnet. |
| MYCEL Treasury Squads | multisig `34wSn…`, vault `rRce…u7MK` | On mainnet since 2026-09-27. Nothing sent there yet. |
| Production | Fly `b7bfe55`, Neon 0000–0008 | Last recorded, not queried. No `/v1`. |

## Interfaces and Invariants

- **`init-community plan|send`:**
  - `--fee-recipient` must exist and be System-owned with no data;
  - mainnet takes only `--signer ledger:<path>`;
  - `send` simulates first, reads the community back, and prints the `chain_address` statement; it writes no database.
  - `--gross` prints the exact vault top-up (the rent and unclaimed allocations stay reserved).
- **`publish-epoch`:** unchanged in behaviour; it now shares the network, RPC and signer parsing (`parseChainArgs`).
- **Admission:** one reply and one quote per member per raid is decided under the community lock (`kind_taken`). X handles bind with the member row locked.
- **Worker Telegram calls** go through `telegramCall`: a failure is a plain, redacted Error with nothing nested.
- Unchanged from Sep 27: `/v1` routes, rate limits and the web token; P14 in `epoch.settlement`; `signSimulated`; the custody policy; the 89-byte leaf; the 3% fee; the allocated-only reserve.

## Validation

Gate at `14e42f7` (the code is unchanged since `747faa7`):
- `pnpm test` **690 passed** (core 106, web 45, api 539) + 1 skipped devnet harness;
- typecheck 0; `pnpm lint` 0 (239 files); `drizzle-kit check` pass; `git diff --check` clean;
- `test:pg` **44/44** on Postgres 17;
- Python vectors: 16;
- no program change, so no Rust rerun; the verifiable build ran twice.

CI on the push is recorded in the snapshot.

## Devnet and Deployment Readiness

**Devnet:** the throwaway admin `Fcv1xtZ6…` holds 1.99 devnet SOL (2026-09-28). The devnet program `EAz8…` and the rehearsal program `6opWf…` stay deployed as evidence.

### October 1 — attended checklist (deploy candidate `86ff258`)

**Unchanged by this arc.** Rehearsed read-only on 2026-09-27; its gate passed. Run Runbook B (`handoffs/2026-09-24-cutover-decisions.md`), one step per message, with Cisco at every hard stop:

1. **Gate `86ff258`** exactly: `pnpm -r test`, typecheck, tracked-file Biome, `drizzle-kit check`, `test:pg`, `git diff --check`.
2. **Read-only Neon check** (agent): journal at 0000–0008 with matching hashes; 0009's tables absent.
3. **Two hold RPCs** (Cisco): `fly secrets set HOLD_RPC_HELIUS_URL=… HOLD_RPC_FALLBACK_URL=… --stage`. They must be two independent mainnet providers.
4. **Apply 0009** (Cisco), then post-checks (agent). **Only 0009.**
5. **Deploy `86ff258`** (Cisco) and verify:
   - `/health` and `/link`;
   - the worker's `hold-check` and `reward-recovery` queues;
   - `/rules` in Hyphae Lab.
6. **Bot token re-rotation** (Runbook B step 9).
7. **Vercel** project for `apps/web` (Cisco): `HYPHAE_API_URL=https://hyphae-api.fly.dev`, `DEFAULT_MINT=<MYCEL mint>`.
8. **Fly `PUBLIC_WEB_URL`** = the Vercel site's URL.
9. **`first_paid_epoch` go/no-go before 2026-10-02T00:00Z** (Cisco). On a yes: `update communities set first_paid_epoch = 2 where mint = '<MYCEL mint>' and first_paid_epoch is null;`.

`86ff258` does not have the HYP-01 and HYP-02 fixes. Epoch 2 is covered by Runbook C's C18b before it closes. The token exposure needs a Telegram network failure in a worker notice, and ends with C7.

### October 7–9 — Runbook C

`handoffs/2026-09-28-runbook-c.md`:
- **Part 1:** migrations 0010–0012 with the worker stopped; the read secrets (`READ_RPC_URL`, the shared `READ_API_WEB_TOKEN` = `HYPHAE_API_TOKEN`); the deploy of `main`.
- **Part 2:** the verifiable program deploy with `usb://ledger?key=2/0` as its only upgrade key, then the readback.
- **Part 3:** `init-community` with fee recipient `rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK` (never `34wSn…`); `chain_address`; one epoch's funding; C18b before 2026-10-09T00:00Z.
- **Part 4**, after the close: plan, publish, one claim, the P14 read.

**Ledger approvals:** 1 each for the deploy, the init, the funding and the publish; readiness reads need none.

**Not rehearsed:** the Ledger through the Solana CLI (Question 3), and a browser claim.

## Next Actions

1. **Oct 1:** the checklist above, attended.
2. **Oct 2–6 arc** (after the Oct 1 deploy):
   1. **Jev offline eval (Cisco's ruling 2026-09-28, pre-approved):** branch `feat/jev-eval`, merged into `main` only after the Oct 7–8 payout is confirmed; no change to the scorer, `jobs/score.ts` or the payout candidate.
   2. **Ledger-signed devnet deploy** (Question 3, on Cisco's yes): the step-3 sequence with `usb://ledger?key=2/0` from the Windows CLI, then close the program to recover the devnet SOL.
   3. **Install the Windows Solana CLI 3.1.10** at `%USERPROFILE%\solana-3.1.10` and check its sha256 (Runbook C, C8).
   4. **Read-only check of epoch 1's close** (Oct 2, 00:00Z) and of the hold checks.
3. **Oct 7–9:** Runbook C.
4. **Oct 10:** `docs/demo/2026-10-10-submission-checklist.md`. The Oct 9 video script is `docs/demo/2026-10-09-final-video.md`.

## For Organic and other integrators

Unchanged: Organic reads Hyphae only through the public read API. Contract: [the key rulings](handoffs/2026-09-27-keys-and-fee-rulings.md#for-organic-and-other-integrators).

1. **Contract:** `GET /v1/openapi.json` (OpenAPI 3.1). v1 changes are additive only.
2. **Payouts:** `epoch.settlement.allocation` and `epoch.settlement.payment`.
3. **A member's claims:** `GET /v1/wallets/{wallet}/claims`, at most 100 per page.
4. **Limits:** 300 requests a minute per IP; only Hyphae's web has a token.
5. **Not live yet:** production `b7bfe55` has no `/v1`; it arrives with Runbook C's C7.

## Open Decisions

| Item | Status | Recommendation |
|---|---|---|
| Q1 HYP-03: X handle ownership | **Open (Cisco).** The 2026-09-17 ruling auto-binds handles on first submit; it predates money payouts. | For epoch 2, an operator attestation before its close (Runbook C, C18b), with posts from a borrowed account corrected to zero. After the hackathon, verified X linking. |
| Q2 The pot's source | **Open (Cisco).** | On Oct 8 send 0.52 SOL to `2kz1Zq…`, which funds the exact top-up: one account, a plain transfer on the device. |
| Q3 Ledger-signed devnet deploy | **Open (Cisco's device).** | Yes, Oct 2–6: it is the only untested link in the mainnet deploy. |
| Verifiable build | **Done 2026-09-28.** | Rebuild at the deploy commit on Oct 7 (C9); any hash change stops the deploy. |
| Upgrade authority, admin, fee address, keypair backup | Ruled 2026-09-27. | As in Runbook C. |

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Rehearsal keys: `ledger-standin-2026-09-28.json`, `rehearsal-program-2026-09-28.json`, `rehearsal-buffer-2026-09-28.json` | WSL `~/hyphae-devnet/` | Throwaway, devnet only. |
| Rehearsal program `6opWfFKk…e1ox`; community `FEZVaW6h…`, vault `G6E2XtUa…`, mint `8qrC4kBs…` | Solana devnet | Evidence; closing the program returns about 1.167 devnet SOL. |
| Verifiable build clones | WSL `~/vb/run1`, `~/vb/run2` | Disposable. |
| `solana-verify` 0.5.2 | WSL `~/.cargo/bin` | Installed with `cargo install solana-verify --locked`. |
| Windows Solana CLI 3.1.10 | Session scratchpad (temporary) | Reinstall at `%USERPROFILE%\solana-3.1.10` for Oct 7 (next action 2.3). |

Commits: `328e3dd` … this record. Nothing deployed, no Neon write, no secret changed, no mainnet transaction, and Cisco's Ledger was not used.

**Suggested skills, in order:**
1. `handoff-memory`: loads this file at session start.
2. `superpowers:verification-before-completion`: for the Oct 1 gate and every Runbook step.
3. `solana-dev` and `context7-mcp`: the Ledger devnet deploy and Solana CLI flags.
4. `superpowers:test-driven-development`: for the Jev eval branch.
5. `handoff` at the end.

## Next-session prompt

```
Hyphae main is pushed and CI green; nothing deployed. Oct 1 deploys 86ff258 + 0009 (checklist in docs/HANDOFF.md), attended, one step per message. Today's arc record: docs/handoffs/2026-09-28-arc.md; Runbook C for Oct 7–9: docs/handoffs/2026-09-28-runbook-c.md. Keys: admin/upgrade = Ledger 2kz1Zq… (44'/501'/2'/0', CLI usb://ledger?key=2/0); fee = MYCEL Treasury vault rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK.

Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-09-28-arc.md, docs/handoffs/2026-09-24-cutover-decisions.md
Model: claude-opus-5-5 (xhigh): production deploy with hard stops rewards care over speed
Skills: handoff-memory, superpowers:verification-before-completion, handoff

Run the Oct 1 checklist with Cisco: gate 86ff258 in a temporary worktree, then each hard stop on his yes. No Neon, Fly, Vercel or mainnet action without Cisco's yes.
```
