---
date: 2026-09-27
summary: B3/B5/B6 stored hashes are committed on main (0010, backfill, strict publication, the publish job now fills a ready epoch's hashes first), gated on real Postgres 17 and reviewed across both model families. Pushing deploys nothing; Neon stays at 0000–0008. Devnet is blocked at 0 SOL. The durable publication/claim extension waits on decision 1. Oct 1 deploys 86ff258 + 0009; current main is the Oct 7–8 payout candidate and needs 0010.
---

# Hyphae handoff

## TL;DR

**The hash work is done, reviewed and on `main`.** Migration 0010 stores config, evidence, decision and selected-snapshot hashes. `backfillEpochCommitments` fills them under the community lock, never overwrites, and refuses a mismatch. Publication refuses a missing or mismatched hash. The review found that nothing in production filled the hashes, so `publishEpoch` now asks the gate, and for a ready epoch runs the backfill before the strict build. Record: [2026-09-27 snapshot](handoffs/2026-09-27-hash-work-committed.md).

**Blocked:** devnet (admin `Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM` holds 0 SOL; keys present). **Parked:** durable manifest bytes, operator script, P14 and `/claim`, until Cisco answers decision 1.

## Metadata

- Last updated: 2026-09-27.
- Runner: Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, xhigh. Git, Docker (Postgres 17) and WSL all worked.
- Reviewers: Claude `/code-review high` (8 findings: 4 fixed, 3 declined, 1 parked) and a fresh Claude checklist subagent (**APPROVE**, lows) on the Codex-built range; Codex CLI **`gpt-6-astra`, xhigh**, read-only and fresh, on the Claude-written fix `acd83fc`: **APPROVE**, no verified defects. Its two notes (hash writes can outlive a later blocked result; simultaneous publishers can both attempt a send, which the PDA `init` limits to one success) are design inputs for the operator script.
- Authority: H-CONTRACT A/B and P1–P16 (`2026-09-24-contract-and-payment-rulings.md`); local/devnet R6 + Anchor, hashes/backfill and the throwaway-key devnet deploy (`2026-09-25-gate-and-r6-rulings.md` and the Sep 26 clarification). Nothing approves Neon writes, production deploys or mainnet transactions.

## Current State

| Component | Stage |
|---|---|
| Migration 0010 (hash columns + 5 CHECKs) | Committed `dabfb56`. **Not applied to Neon.** |
| Backfill + strict publication | Committed `82c1c2e` (Codex), fix `acd83fc` (Claude). Not deployed; `publishEpoch` has no production caller yet. |
| Tests | `2a9afc4`, `acd83fc`: 23 shared cases on PGlite and Postgres, a 12-round backfill/correction race. |
| Anchor program (vault, publish, claim) | Unchanged since Sep 25. `anchor build` 0; Rust 21 + 6. **Not on devnet.** |
| Devnet proof | **Not run.** 0 SOL (two reads, last 2026-09-27T10:38:46Z). No signatures. |
| Durable bytes / operator script / P14 / `/claim` | **Not built.** Decision 1 open. |
| Production | Fly `b7bfe55`, Neon 0000–0008 (last recorded, not queried). |

## Interfaces and Invariants

- `publishEpoch(db, chain, { communityId, epochId, grossLamports })`: refuses an unbound community; evaluates the gate and returns `blocked` with no write; for a ready epoch runs `backfillEpochCommitments`, then `buildPublication` (strict, repeatable read), then compares with any on-chain epoch (recovery, no second send) or sends, then records leaves and root.
- `backfillEpochCommitments(db, { communityId, epochId })` → `{ configs, evidence, decisions, snapshots }` rows actually written. Null-only; a mismatch throws and writes nothing.
- `storedEpochCommitments(tx, epochId)`: the strict check; never writes. Every decision row of the epoch must be stored, including late revisions.
- A late correction (after close) is hashed with its predecessor's hash and never replaces the snapshot's frozen selection; the publication is deep-equal before and after it.
- Unchanged: the 89-byte leaf, merkle root, audit manifest bytes, fee (3%, to the on-chain fee recipient) and reserve (allocated total) semantics.

## Validation

Gate on the pushed tree (`acd83fc` code):

- `pnpm test`: **523 passed** (core 89, web 14, api 420) + 1 skipped devnet harness. Includes the `eval-scoring` CLI test.
- `pnpm --filter @hyphae/api test:pg` on Docker Postgres 17: **41/41**.
- `pnpm typecheck`: exit 0. `drizzle-kit check`: pass. `git diff --check`: clean.
- Biome on tracked + new files: **199 clean**. `pnpm lint` still exits 1 on the globally ignored `.claude/settings.local.json` only (see Open Decisions).
- WSL: `anchor build` exit 0; `cargo test -p hyphae --tests` 21 + 6. Python vectors: 16 reproduced. (`programs/**`, `packages/core/**` unchanged since.)
- Mutation probes: no community lock in the backfill → the race fails in round 1; no gate-first check in `publishEpoch` → the blocked-epoch case fails.

## Devnet and Deployment Readiness

**Devnet:** when the admin holds ≥ 2.6 devnet SOL, follow `handoffs/2026-09-25-r6-anchor-built.md` § Devnet exactly and record every signature. No faucet loops, never the Lab wallet.

### October 1 — attended checklist (deploy candidate `86ff258`)

Run Runbook B (`handoffs/2026-09-24-cutover-decisions.md`), one step per message, Cisco at every hard stop:

1. **Gate `86ff258`** exactly: `pnpm -r test`, typecheck, tracked-file Biome, `drizzle-kit check`, `test:pg`, `git diff --check`.
2. **Read-only Neon check** (agent): journal at 0000–0008 with matching hashes; 0009's tables absent.
3. **Two hold RPCs** (Cisco): `fly secrets set HOLD_RPC_HELIUS_URL=… HOLD_RPC_FALLBACK_URL=… --stage`. Two independent mainnet providers; the code refuses either unless it returns mainnet's genesis hash.
4. **Apply 0009** (Cisco), then post-checks (agent).
5. **Deploy `86ff258`** (Cisco) and verify `/health`, `/link`, the worker's `hold-check` and `reward-recovery` queues, and `/rules` in Hyphae Lab.
6. **Bot token re-rotation** (Runbook B step 9, still open since Sep 24): BotFather `/revoke`, token into `.env` in an editor, `fly secrets set` from `.env`, `setWebhook` with `drop_pending_updates`, `getWebhookInfo` clean.
7. **Vercel** project for `apps/web` (Cisco): `HYPHAE_API_URL=https://hyphae-api.fly.dev`, `DEFAULT_MINT=<MYCEL mint>`.
8. **Fly `PUBLIC_WEB_URL`** = the Vercel site's URL (the default `https://hyphae.fun` does not resolve).
9. **`first_paid_epoch` go/no-go before 2026-10-02T00:00Z** (Cisco): on a yes, `update communities set first_paid_epoch = 2 where mint = '<MYCEL mint>' and first_paid_epoch is null;`. Epoch 1 stays unpaid.

**Not on Oct 1:** current `main` needs **0010** (and 0011 if the extension is built) and is the **Oct 7–8 payout candidate**. Never deploy it against 0009 alone; the ORM's full-row reads need 0010's columns. Apply 0010 with the worker stopped (or a `lock_timeout`): it takes ACCESS EXCLUSIVE on four reward tables in one transaction.

### October 6 checkpoint — not ready

Needs: funded devnet proof (publish, claim, duplicate refused on-chain); decision 1 and the extension built and reviewed; Q1 and Q3 ruled; P8 named. Hash work is no longer on this list.

## Next Actions

1. On decision 1 = yes: write the extension note in `docs/`, then build test-first: migration 0011 (publication and member manifest bytes + hashes stored before any send), recovery from those exact bytes, `apps/api/scripts/publish-epoch.ts` behind a signer interface (file keypair on devnet, hardware wallet on mainnet, no key export), the P14 allocation/claim section with honest unavailable states, and `apps/web` `/claim`. Then a fresh Codex Astra xhigh review.
2. When the admin is funded: the devnet run, signatures recorded.
3. Oct 1: the checklist above.

## Open Decisions

From the vault Integration Board (27 Sep), all **open** (recommendation, no recorded answer):

1. **Decision 1, completion scope** (durable bytes, operator script, `/claim`, P14 now). Recommend **yes**, built now that the hash work is pushed: it leaves slack before Oct 6.
2. **Q1 custody.** Recommend a trusted-publisher pilot: one epoch funded just in time, hardware key, the limit disclosed. Needed by Oct 6.
3. **Q3 reserves.** Recommend reserving allocated claims only, with cap remainder and dust tracked separately. Needed by Oct 6.
4. **P8 fee address.** Recommend a dedicated address, separate from Lab funds. Needed by Oct 1.

Minor, outside this arc's paths: add `.claude/settings.local.json` to the repo `.gitignore` so `pnpm lint` exits 0 on every clone.

## Generated Artifacts and Suggested Skills

Artifacts: commits `dabfb56`, `82c1c2e`, `2a9afc4`, `acd83fc`, `a69f59f` and this session's docs commit; `docs/handoffs/2026-09-27-hash-work-committed.md`. No keys, credentials, deployments or jobs.

Suggested skills: `superpowers:test-driven-development`, `solana-dev`, `context7-mcp` (Anchor, @solana/kit, wallet-standard, Next.js), `supabase:supabase-postgres-best-practices`, `frontend-design` for `/claim`, `superpowers:verification-before-completion`, `handoff`.

## Next-session Prompt

```text
Resume Hyphae. Read CLAUDE.md, AGENTS.md, docs/HANDOFF.md and docs/handoffs/2026-09-27-hash-work-committed.md. The B3/B5/B6 hash work is committed and pushed (dabfb56..acd83fc); publishEpoch now runs the B6 backfill for a ready epoch before the strict build. Gate green on Postgres 17. Devnet admin was 0 SOL on 2026-09-27; keys present. If decision 1 is answered yes (Integration Board or Cisco), build the extension test-first (0011 durable bytes, recovery from them, publish-epoch.ts behind a signer interface, P14, /claim), then a fresh Codex Astra xhigh review. Oct 1: deploy 86ff258 + 0009 per the checklist; current main is the Oct 7–8 candidate and needs 0010. No Neon writes, production deploys or mainnet transactions without Cisco's yes.
```
