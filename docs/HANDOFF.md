---
date: 2026-09-27
summary: The completion scope (0011 durable publication bytes, recovery from them, the operator publish script behind a signer interface, P14 in an additive settlement field, the claim route and /claim) is built test-first on main, reviewed twice by Codex gpt-6-astra, and pushed. Pushing deploys nothing; Neon stays at 0000–0008. Devnet is blocked at 0 SOL, so there is no on-chain proof yet. Oct 1 deploys 86ff258 + 0009; current main is the Oct 7–8 payout candidate and needs 0010 and 0011.
---

# Hyphae handoff

## TL;DR

**The completion scope is built, reviewed and on `main`.** Migration 0011 stores each publication's exact audit and member manifest bytes before any send, and publish and recovery use only those bytes. `apps/api/scripts/publish-epoch.ts` plans or publishes behind a signer interface: a keypair file on devnet, a Ledger on mainnet. The read API serves P14 in `epoch.settlement`, where every publish and claim transaction shown is the one the chain proves, and adds a per-wallet claim route. The audit site shows the settlement, and `/claim` builds the claim in the browser. Record: [completion snapshot](handoffs/2026-09-27-completion-built.md).

**Blocked:** devnet (admin `Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM` holds 0 SOL; keys present). **Parked:** the Ledger USB transport's native build (`node-hid`), which needs Cisco's approval.

## Metadata

- Last updated: 2026-09-27.
- Runner: Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, xhigh. Git, Docker (Postgres 17) and WSL all worked.
- Reviewers:
  - Hash work: Claude `/code-review high` and a fresh Claude checklist subagent on the Codex-built range; Codex `gpt-6-astra` xhigh on the fix: **APPROVE**.
  - Completion scope: Codex CLI **`gpt-6-astra`, xhigh**, read-only, fresh.
    - Round 1 (`355067e..5d9da17`): **NEEDS-ATTENTION**, 6 mediums, all fixed test-first.
    - Round 2 (`5d9da17..f24cefa`): **APPROVE**, no verified findings. Note: the 2 s deadline covers chain reads only, not the database read.
- Authority:
  - H-CONTRACT A/B and P1–P16 (`2026-09-24-contract-and-payment-rulings.md`).
  - Local/devnet R6 + Anchor (`2026-09-25-gate-and-r6-rulings.md`).
  - Decision 1, Q1 and Q3 (`2026-09-27-completion-and-custody-rulings.md`).
  - Nothing approves Neon writes, production deploys or mainnet transactions.

## Current State

| Component | Commit | Stage |
|---|---|---|
| Migration 0010 (hash columns + CHECKs) | `dabfb56` | Pushed. **Not applied to Neon.** |
| Backfill + strict publication | `82c1c2e`, `acd83fc` | Pushed. Not deployed. |
| Migration 0011 (publication intent bytes + SQL hash CHECKs) | `1dadda2` | Pushed. **Not applied to Neon.** |
| Durable intent, publish/recovery from stored bytes | `1dadda2`, `4faf625` | Pushed. `publishEpoch` has no production caller; only the operator script calls it. |
| Program client in `@hyphae/core` + instruction matchers | `9932dc0`, `0c5c119` | Pushed. Bytes pinned by the shared vectors. |
| Operator script `publish-epoch.ts` + signers | `10a5284` | Pushed. Keypair file: devnet only. Ledger: built and fake-tested; USB transport blocked on `node-hid` approval. |
| P14 read path + claim route | `d0ea1b2`, `d745750` | Pushed. Not deployed; needs `READ_RPC_URL`. |
| Web settlement panel, `/claim` | `4ca3abf`, `44c495d`, `d745750`, `62ac927` | Pushed. Not deployed (no Vercel project yet). |
| Anchor program | `b782495` | Unchanged since Sep 25. `anchor build` 0; Rust 21 + 6. **Not on devnet.** |
| Devnet proof | — | **Not run.** 0 SOL at 10:38:46Z and 12:23:36Z. No signatures. |
| Production | Fly `b7bfe55`, Neon 0000–0008 | Last recorded, not queried. |

## Interfaces and Invariants

- `publishEpoch(db, chain, { communityId, epochId, grossLamports })`:
  1. Refuses an unbound community.
  2. Returns `blocked` from the gate with no write.
  3. For a ready epoch: backfills hashes, then loads the stored intent or builds and stores it. A rebuild must equal the stored intent.
  4. Sends only the stored bytes. A recovered on-chain epoch is matched to the `publish_epoch` with exactly those commitments.
  5. Records leaves and root from the intent.
- `planPublication(...)` is everything before the send; the script's `plan` prints it.
- `creatingTransaction(rpc, at, matches, { hint, blockTime })` proves the successful transaction whose instruction created a program account.
  - Order: the hint first, then up to 10 pages back, then up to 10 transactions, oldest first, preferring the creation second.
  - It reads inner instructions and lookup tables.
- Read API v1 `epoch.settlement = { allocation, payment }`:
  - `allocation` is `published` only with an on-chain epoch account matching the intent and its proven `publish_epoch`.
  - `payment` is `available` only with receipts matching leaves, each with its proven `claim`, summing to the account's claimed total.
  - Otherwise `unavailable` with a reason: `no_settlement`, `before_first_paid_epoch`, `no_stored_intent`, `chain_unconfigured`, `chain_unavailable`, `chain_mismatch` or `chain_transaction_missing`.
  - v1's `allocation`/`payment` stay a closed `unavailable` (`see_settlement` once there is more).
  - Chain reads run under a 2 s deadline.
- Claim route `GET /v1/communities/:mint/epochs/:index/claims/:wallet`: the leaf, addresses, payment status and a recent blockhash. `no-store`. 404 without a leaf.
- Unchanged: the 89-byte leaf, merkle root, audit manifest bytes, fee (3%, to the on-chain fee recipient) and reserve (allocated total) semantics.

## Validation

Gate on `f24cefa`:

**Tests**
- `pnpm test`: **614 passed** (core 104, web 34, api 476) + 1 skipped devnet harness.
- `test:pg` on Docker Postgres 17: **41/41**.

**Static checks and builds**
- `pnpm typecheck`: exit 0.
- `drizzle-kit check`: pass.
- `git diff --check`: clean.
- `next build`: pass. API build: pass.
- Biome on tracked + new files: clean. `pnpm lint` exits 1 only on the globally ignored `.claude/settings.local.json`.

**Rust and vectors**
- WSL `anchor build`: exit 0.
- `cargo test -p hyphae --tests`: 21 + 6.
- Python vectors: 16 reproduced.

**Mutation probes:** 19 across the build and the fixes, each caught by a named test. The list is in the snapshot.

## Devnet and Deployment Readiness

**Devnet:** when the admin holds ≥ 2.6 devnet SOL, follow `handoffs/2026-09-25-r6-anchor-built.md` § Devnet exactly, then run `HYPHAE_DEVNET_RUN=1` `publish.devnet.test.ts`, and record every signature. No faucet loops, never the Lab wallet.

### October 1 — attended checklist (deploy candidate `86ff258`)

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
- **0010 and 0011**. Never deploy it against 0009 alone; the ORM's full-row reads need 0010's columns. Apply 0010 with the worker stopped (or a `lock_timeout`): it takes ACCESS EXCLUSIVE on four reward tables in one transaction. 0011 only creates two tables.
- A `READ_RPC_URL` Fly secret for P14, on the publication's network.
- `node-hid`'s native build approved, for a Ledger publish.

### October 6 checkpoint — not ready

- **Done:** decision 1 is built and reviewed; Q1 and Q3 are ruled.
- **Still needed:**
  - a funded devnet proof (publish, claim, duplicate refused on-chain, P14 read);
  - P8 named;
  - the Ledger transport approved and tried once on a real device;
  - Cisco's public Q1 wording.

## Next Actions

1. When the admin is funded: the devnet run, signatures recorded, P14 read against devnet.
2. Oct 1: the checklist above.
3. After Cisco's answers below: the Ledger transport (approve `node-hid`, one real-device `plan`/`publish` on devnet), and the Q1 disclosure on the site.

## Open Decisions

| Item | Status | Recommendation |
|---|---|---|
| Decision 1, completion scope | **Answered** 2026-09-27: yes. Built. | — |
| Q1 custody | **Answered** 2026-09-27: trusted-publisher pilot, hardware key, limit disclosed. | The public wording is still Cisco's to approve. |
| Q3 reserves | **Answered** 2026-09-27: allocated claims only. | No code change needed. |
| P8 fee address | **Open**, needed by Oct 1. | A dedicated address, separate from Lab funds. |
| `node-hid` native build (Ledger USB) | **Open**. | Approve it with `pnpm approve-builds` (only `node-hid`). It is a dev-only dependency of the operator script. |
| Organic's adapter field | **Open**. It should read `settlement.allocation` / `settlement.payment` (A4), not `allocation.status` as H-CONTRACT line 253 anticipated. | Keep `settlement`; tell Stage C1 before it touches the adapter. |

Minor, outside this arc's paths: add `.claude/settings.local.json` to the repo `.gitignore` so `pnpm lint` exits 0 on every clone.

## Generated Artifacts and Suggested Skills

**Artifacts**
- Commits `af217f7` … `2accfd3` and this session's docs commit.
- `docs/handoffs/2026-09-27-completion-note.md`, `-completion-and-custody-rulings.md` and `-completion-built.md`.
- No keys, credentials, deployments or jobs.

**Suggested skills:** `superpowers:test-driven-development`, `solana-dev`, `context7-mcp` (@solana/kit, wallet-standard, Ledger), `superpowers:verification-before-completion`, `deploy-to-vercel` for the Oct 1 web project, `handoff`.

## Next-session Prompt

```text
Resume Hyphae. Read CLAUDE.md, AGENTS.md, docs/HANDOFF.md and docs/handoffs/2026-09-27-completion-built.md. The completion scope is built and pushed (af217f7..2accfd3): 0011 durable publication bytes, recovery from them, publish-epoch.ts behind a signer interface, P14 in the additive epoch.settlement field with on-chain-proven transactions, the claim route and /claim. Codex astra xhigh reviewed it twice. If the devnet admin Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM holds >= 2.6 SOL, run the devnet proof and record every signature; otherwise record the balance once and continue. Oct 1: deploy 86ff258 + 0009 per the checklist; main is the Oct 7-8 candidate and needs 0010 + 0011 + READ_RPC_URL. Open: P8 fee address, node-hid approval, Q1 public wording, Organic adapter field. No Neon writes, production deploys or mainnet transactions without Cisco's yes.
```
