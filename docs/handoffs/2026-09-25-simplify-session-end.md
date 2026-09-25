---
date: 2026-09-25
summary: Production still runs b7bfe55 (MYCEL epoch 1, 2026-09-25T00:00Z to 2026-10-02T00:00Z). The deploy candidate is 86ff258 and needs migration 0009 on Neon first. This session recorded Cisco's "all yes" on the six gate questions and the R6 + Anchor authorization. It then built the Anchor program (vault, publish, claim with a receipt PDA) and R6 (Part B hashes, manifests, exact allocation, publish job), test-first, and pushed them to main (80895ef). The evidence stage is LiteSVM, PGlite and Postgres 17. It is not devnet: the public faucet refused every airdrop to the throwaway key, so no devnet transaction exists. Codex (gpt-6-luna, xhigh) reviewed three fresh rounds: four fixes, round 3 approve. Two findings are parked for Cisco as pre-mainnet blockers: the admin key decides every root, and the manifest bytes are not stored. A later session the same day ran a /simplify pass on that arc (edef71e..61876cd, pushed). The gate now hands publication what it judged, and publish takes the fee recipient from the chain. Codex round 1 asked for two changes (one fixed, one declined with evidence); round 2 approved. 2026-10-02T00:00Z still depends only on Cisco's deploy.
---

# Hyphae handoff

## TL;DR

**The program and R6 exist, locally, and are pushed (`80895ef`).** The Anchor program pays a leaf once against a receipt and never beyond what an epoch reserved. R6 turns a `ready` payout gate into exact lamports, manifests, a root and an audit hash, and publishes nothing for a blocked or held epoch. **Not on devnet yet:** the faucet rate-limited every request. **Deploy candidate for Cisco's session is still `86ff258` (0009 first)**. Nothing from this arc has a production caller. **Then a cleanup pass (`edef71e..61876cd`, pushed):** each payout rule now lives in the gate only, and publication builds from the rows the gate judged. The publish job reads the fee recipient from the on-chain community. Codex approved round 2. Record: `docs/handoffs/2026-09-25-simplify-pass.md`. **Next, Cisco:** fund the throwaway devnet key (Q4), decide Q1 and Q2 before any mainnet payout, name the P8 fee address by Oct 1, and deploy `86ff258` before 2026-10-02T00:00Z.

## Metadata

- Last Updated: 2026-09-25, ~06:10Z (fourth session: the /simplify pass, pushed at `dd0ee2f`; `docs/handoffs/2026-09-25-simplify-pass.md`). Program and R6 record: `docs/handoffs/2026-09-25-r6-anchor-built.md`. Scope: `2026-09-25-r6-anchor-scope.md`. Rulings: `2026-09-25-gate-and-r6-rulings.md`. Previous state: `2026-09-24-payout-gates-session-end.md`.
- Branches: only `main` = `origin/main`.
- Runner: Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, Windows; effort not reported to the session. The session prompt preferred Fable 5.1 xhigh; this session ran on Opus 5.5. Reviewer: Codex CLI **`gpt-6-luna`** (configured model), `--effort xhigh`, read-only.
- Authority: Cisco's "all yes", 2026-09-24 ~22:40Z (R6 + Anchor, local and devnet); Part B and P1–P16 as ruled 2026-09-24.

## Current Objective

Make epoch 2 (2026-10-02T00:00Z → 2026-10-09T00:00Z) the first paid epoch: gates deployed before Oct 2 (Cisco), program and R6 reviewed on devnet by the Oct 6 checkpoint, mainnet deploy and funding Oct 7–8 (Cisco), publish and claims Oct 9.

## Current State

- **Deploy candidate = `86ff258`, needs 0009 first.** Its gate was re-run on 2026-09-25 and was green. Every later commit keeps `main` deployable: the program and R6 have no production caller, and `communities.chain_address` is null for MYCEL, so the publish job refuses it.
- Fly `hyphae-api`: api + worker on `b7bfe55`. Neon: 0000–0008; 0009 not applied.
- Program `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`: built (`anchor build` at `82657db`, sha256 `cb4ffdd8…8d79`), **deployed nowhere**. Its keypair is `target/deploy/hyphae-keypair.json` (gitignored, on this machine only). Back it up: the same id is the mainnet program id.
- Throwaway devnet keys (never the Lab wallet, never mainnet), in WSL `~/hyphae-devnet/`: admin `Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM`, claimant `3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk`, fee recipient `AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR`. Balance: 0 SOL.

## Recent Changes (the Sep 25 sessions)

| Commit | What |
|---|---|
| `d12e951` | Rulings recorded: Q1–Q6 yes as recommended; R6 + Anchor authorized (local, devnet) |
| `6497b9e` | Deploy candidate named: `86ff258` (needs 0009) |
| `a414505` | Scope note: program accounts and rules, R6 files, eight decisions |
| `b782495` | Program: `initialize_community`, `publish_epoch`, `claim`; LiteSVM and vector tests; shared vector file |
| `62e18b3` | R6: c14n and tagged hashes, payloads and manifests, exact allocation (replaces `settle.ts`), publication, publish job, program client, kit chain, ready seed, devnet harness, Python check |
| `cd9a2ae` | Own review: a rules-test pass after the close is not shown; publish on Postgres 17 |
| `9e420b0` | Own review: the mint check tells mints from token accounts |
| `57d51b3` | Codex R1: gate and manifests in one snapshot; manifest invariants; capture time kept as text |
| `80895ef` | Codex R2: impossible capture times and uninitialized mints refused |
| `edef71e` | Simplify: the ready gate carries the snapshot, pass times and hold results it judged; publication builds from them |
| `d65a839` | Simplify: one A14 correction and effort-criteria mapping for the read API and the commitment |
| `1c86b24` | Simplify: `allocate()` refuses a pot that pays nobody a lamport |
| `b17fd10` | Simplify: shared hex helpers; unused publish inputs dropped |
| `a8f89d5` | Simplify: publish reads the fee recipient from the on-chain community (deliberate change) |
| `d5b4f3b` | Simplify: one `seedSignedLink` |
| `1773d07` | Simplify: mocha toolchain removed; `packages/db` declares `@types/node` |
| `82657db` | Simplify: one mint-shape check; shared Rust vector helpers |
| `61876cd` | Codex R4: a correction needs an actor |

## Validation (on `61876cd`)

`pnpm -r test` exit 0 (core 89, web 14, api 397 + 1 skipped devnet harness) · `pnpm -r typecheck` exit 0 · Biome on tracked files exit 0 (193 files) · `drizzle-kit check` exit 0 · `test:pg` 17/17 (Postgres 17, Docker) · `anchor build` exit 0 · `cargo test -p hyphae --tests` 21 + 6 passed · `cargo fmt --check` and clippy clean · `python3 tests/h_contract_vectors.py` 16 hashes reproduced · `git diff --check` exit 0. Mutation probes (on `80895ef`): 20, 18 caught at first, tests added for the 2 survivors. `pnpm lint` also flags the globally git-ignored `.claude/settings.local.json`, which Biome still reads; tracked files are clean. **Evidence stage: LiteSVM + PGlite + Postgres 17. Not devnet, not mainnet.**

## Codex review

| Round | Verdict | Outcome |
|---|---|---|
| 1 (`a414505..62e18b3`) | needs-attention | H1 admin decides every root → **parked, Q1**. M2 gate and build in separate transactions → fixed (`57d51b3`). M3 stored hashes (B6) → **parked, Q2**. L4 capture time through Date → fixed (`57d51b3`). |
| 2 (`62e18b3..57d51b3`) | needs-attention | M2 and L4 confirmed. H1 and M3 restated: settle before any payout (**pre-mainnet blockers**). Two lows fixed (`80895ef`); the hold-window millisecond low left as is (every `closes_at` and `observed_at` comes from a JS Date). |
| 3 (`57d51b3..80895ef`) | **approve** | No findings. |
| 4 (`10ef4d1..82657db`, simplify) | request changes | Verdicts, manifest and audit bytes, leaves and root confirmed unchanged for valid data. `FEE_BPS` export: declined (no importer, unpublished package). Blank correction actor: fixed (`61876cd`). |
| 5 (`82657db..61876cd`) | **approve** | No findings. |

## Known Issues / Watch List

- **Devnet run not done** (step 6): all 13 airdrop requests to the throwaway admin (2026-09-24 ~23:25Z to 2026-09-25 00:40Z) failed with the faucet's rate limit. No devnet transaction exists. The run is scripted (below).
- **Before the mainnet publish (Oct 9) and not built:** Q1 and Q2; an operator entry point that runs `publishEpoch` with the admin key; a claim path for testers (Q5); MYCEL's `communities.chain_address` (a Neon write); the P8 address; the read API's allocation section (P14).
- The P8 fee account must already exist with at least the rent-exempt minimum, or the first fee must be at least 0.00089 SOL. The 0.5 SOL pot's fee is 0.015 SOL, which is fine.
- From the simplify pass, parked with recommendations (details in its record): switch the mint check to anchor-spl's `InterfaceAccount<Mint>` in the pre-mainnet program pass; generate the Codama client in the `/claim` scope; give the read API and the evidence commitment one capture-time parser along with 0010 (they agree for every value intake writes today).
- Carried over: bot token re-rotation; `PUBLIC_WEB_URL` after the Vercel site; the public api is not rate-limited; no CI.

## Next Actions

1. **Cisco (1 minute):** fund `Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM` with 3 devnet SOL at faucet.solana.com (Q4).
2. **Agent, then (~20 minutes):** the devnet run, exactly as written in `docs/handoffs/2026-09-25-r6-anchor-built.md` § Devnet. Deploy the program with the throwaway admin as upgrade authority, create a devnet mint, then run `apps/api/src/payout/publish.devnet.test.ts` with `HYPHAE_DEVNET_RUN=1`. It initializes the community, funds the vault with 0.05 SOL, publishes the seeded epoch through `publishEpoch`, claims once, and lands a second claim that fails on-chain. Record the signatures in the session record, the whitepaper row and here.
3. **Cisco, before 2026-10-02T00:00Z (unchanged):** apply 0009, set `HOLD_RPC_HELIUS_URL` and `HOLD_RPC_FALLBACK_URL`, deploy `86ff258` (or `main`; both are deployable) with `--depot=false`, then the read-only checks. The earlier steps still stand: token re-rotation, and the Vercel project.
4. **Cisco:** answer Q1–Q3 and Q5, and name the P8 address by Oct 1.
5. **Agent, Oct 3–6 (needs Q2 and Q5 answered):** migration 0010 with the stored manifests and hashes, the operator publish entry point, and the claim path. Then the Oct 6 devnet checkpoint.

## Open questions (each with a recommendation)

1. **Q1, custody (Codex H1):** the admin key decides every root, so it can send an epoch's pot, and any unassigned vault SOL, to any wallet. P4's "even the admin key can't take contributor money" holds only for money already allocated. **Recommended: accept it for v1 as a stated limit.** Fund the vault just in time with one epoch's pot, keep the admin key on a hardware wallet, and add one line to the whitepaper's Limits. After Oct 12, move to a publisher/guardian split with a timelock, or a multisig admin.
2. **Q2, stored manifests (B6, Codex M3):** allow a session with `packages/db` in scope for migration 0010: a publications table holding the audit and member manifest bytes and hashes, written before the send, plus the decision, config and evidence hash columns with a backfill. Apply it in the Oct 7–8 window. **Recommended: yes.** Otherwise a later code change could alter the recomputed bytes of a manifest whose hash is already on-chain.
3. **Q3, what publish reserves (scope decision 2):** `outstanding` grows by the allocated total, so cap remainder and dust fund later epochs. **Recommended: yes.** Reserving the net pot would lock them with no rule that ever releases them.
4. **Q4, devnet SOL:** fund the throwaway admin from faucet.solana.com, or allow a one-time 3 devnet SOL transfer from the Lab devnet wallet. **Recommended: the faucet.** It keeps the Lab wallet out of it, as the session prompt required.
5. **Q5, the Oct 9 claim path:** testers need a way to claim, and you need a way to publish. **Recommended:** an operator script (`apps/api/scripts/publish-epoch.ts`, admin key from a local file, never on Fly) and a `/claim` page in `apps/web` that reads the member's leaf and signs with their wallet. Scope and build them Oct 3–6.

Parked, not asked: the P8 fee address (yours, by Oct 1).

## Dates

- **2026-10-02T00:00Z:** still holds, and still depends only on Cisco's deploy (item 3). Nothing agent-side blocks it.
- **Oct 6 checkpoint (devnet end to end):** holds if devnet SOL arrives by Oct 4 and Q2 and Q5 are answered by Oct 2. The program and R6 landed on Sep 25, ahead of their Oct 1–7 windows.

## Quick Reference

- Program: `programs/hyphae/src/{lib,state,merkle,constants,error}.rs`, `instructions/{initialize_community,publish_epoch,claim}.rs`. Tests: `programs/hyphae/tests/{program,vectors}.rs` (run after `anchor build`).
- R6: `packages/core/src/{commitments,allocation}.ts`; `apps/api/src/payout/{commitments,publication,publish,program,chain,ready-seed}.ts`.
- `publishEpoch(db, chain, { communityId, epochId, grossLamports })` → `refused | blocked | published`. The fee recipient comes from the on-chain Community account (`chain.readCommunity`); a missing or unbound account is `refused`. Only a `ready` gate publishes; the chain is sent to first, then leaves and the root are recorded.
- Vectors: `packages/core/src/test-vectors/h-contract-v1.json` (regenerate with `UPDATE_VECTORS=1`, a reviewed change); `python tests/h_contract_vectors.py`.
- Local gate: `pnpm -r test; pnpm -r typecheck; git ls-files -z '*.ts' '*.tsx' '*.json' '*.js' '*.css' | xargs -0 pnpm exec biome check; pnpm --filter @hyphae/db exec drizzle-kit check; pnpm --filter @hyphae/api test:pg` (Docker); in WSL `anchor build && cargo test -p hyphae --tests`; `git diff --check`.

## Suggested skills

- `handoff-memory` (resume).
- `solana-dev` (devnet deploy, claim page).
- `superpowers:test-driven-development` (0010, operator script, claim page).
- `code-review` (before 0010: the capture-time parser that the read API and the evidence commitment should share).
- `superpowers:writing-plans` (the Oct 3–6 window).
- `handoff` (session end).

## Resume Checklist

- `git fetch --prune && git status -sb` (expect `main` = `origin/main` at or after the simplify pass's docs commit).
- Docker Desktop running before `test:pg`; WSL toolchain per the memory note (anchor 1.0.1, solana 3.1.10).
- `solana balance Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM --url devnet` before the devnet run.
- No deploy, Neon change, Fly secret, token change, Vercel project, package publish, public post or mainnet transaction without Cisco's separate yes.

## Next-session prompt

```text
Resume Hyphae. Read CLAUDE.md, AGENTS.md, docs/HANDOFF.md and docs/handoffs/2026-09-25-r6-anchor-built.md. main has the Anchor program and R6 (80895ef) plus a reviewed simplify pass (61876cd), pushed, not deployed; publishEpoch now reads the fee recipient from the on-chain community; the deploy candidate for Cisco's session is 86ff258 (0009 first). If the throwaway devnet admin Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM holds at least 2.6 devnet SOL: deploy program EAz8…d6E to devnet with it as upgrade authority, create a devnet mint, and run apps/api/src/payout/publish.devnet.test.ts with HYPHAE_DEVNET_RUN=1 (keys in WSL ~/hyphae-devnet/); record every signature in the session record, the whitepaper row and HANDOFF. Then, per Cisco's answers to Q1–Q5: migration 0010 (stored manifests and hashes), the operator publish script and the /claim page, test-first, Codex-reviewed before push. Devnet only; never the Lab wallet, never a mainnet key.
Hard stops (each needs Cisco's explicit yes): deploys, Fly secrets, token changes, Vercel project creation, Neon writes, mainnet transactions, package publishes, public posts, writes outside this repo.
```
