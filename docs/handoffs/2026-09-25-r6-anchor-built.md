---
date: 2026-09-25
summary: The Anchor program (vault, publish, claim with a receipt PDA) and R6 (Part B hashes, member-epoch and epoch audit manifests, exact allocation, publish job) are built test-first, pushed, and not deployed anywhere. LiteSVM tests cover double claim, wrong proof, wrong epoch, claim before publish, fee math and over-allocation. One vector file pins the bytes for TypeScript, Rust and Python. A seeded ready epoch allocates exactly the seeded_ready_epoch vector; blocked and held epochs publish nothing. Codex reviewed three fresh rounds (gpt-6-luna, xhigh): four fixes test-first, round 3 approve, and two findings parked for Cisco as pre-mainnet blockers (the admin decides every root; manifest bytes are not stored). The devnet run did not happen: the public devnet faucet refused every airdrop to the throwaway key.
---

# 2026-09-25 — Anchor program and R6 (local; devnet blocked on faucet)

## Authority

- Cisco, 2026-09-24 ~22:40Z, "all yes" (`2026-09-25-gate-and-r6-rulings.md`): R6 and the Anchor program, local and devnet only.
- Scope and decisions: `2026-09-25-r6-anchor-scope.md`. Design: H-CONTRACT Part B and payment rulings P1–P16, as ruled 2026-09-24.
- Runner: Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, Windows. The session prompt preferred Fable 5.1 xhigh; this session ran on Opus 5.5. Reviewer: Codex CLI, **`gpt-6-luna`** (from `~/.codex/config.toml`), `--effort xhigh`, read-only, fresh thread per round. The prompt named GPT-6 Astra; the configured model was used.

## What was built

| Piece | Where |
|---|---|
| Program: `initialize_community(fee_recipient)`, `publish_epoch(index, root, audit_hash, gross, allocated)`, `claim(score, amount, evidence_hash, proof)` | `programs/hyphae/src/**` |
| LiteSVM tests (21) and shared-vector tests (6), Rust | `programs/hyphae/tests/{program,vectors}.rs` |
| Shared vectors: leaves, trees, proofs, tampered proof, instruction bytes, account order and roles, account layouts, config/evidence/decision/manifest hashes, allocations | `packages/core/src/test-vectors/h-contract-v1.json`, written by `h-contract-vectors.test.ts` |
| hyphae-c14n/1, tagged hashes, validated payloads and manifests | `packages/core/src/commitments.ts` |
| Exact allocation (replaces `settle.ts`) | `packages/core/src/allocation.ts` |
| Hashes from stored rows | `apps/api/src/payout/commitments.ts` |
| Publication (gate → allocation → manifests → leaves → root → audit hash), in one snapshot | `apps/api/src/payout/publication.ts` |
| Publish job (not scheduled), kit chain adapter, program client | `apps/api/src/payout/{publish,chain,program}.ts` |
| Seeded ready epoch; devnet harness (runs only with `HYPHAE_DEVNET_RUN=1`) | `apps/api/src/payout/{ready-seed.ts,publish.devnet.test.ts}` |
| Python stdlib cross-check | `tests/h_contract_vectors.py` |

## Deviations, and why

1. **No migration.** `packages/db` was outside this arc's writable paths. The publish job records into the existing `leaves` table and `epochs.root`, `pot_lamports`, `publish_tx`, `published_at`, `status`. Hashes are computed from insert-only rows (scope decision 6). Codex rounds 1 and 2 say the stored hash columns and the manifest bytes must exist before any mainnet payout; that is parked below.
2. **Community seeds include the admin** (`["community", mint, admin]`), not the design sketch's `["community", mint]`, so nobody can register a vault for another's coin (scope decision 1).
3. **`outstanding` reserves the allocated total**, not the net pot (scope decision 2, open question 3).
4. **The vector file sits in `packages/core/src/test-vectors/`**, inside the writable paths, not B10's `packages/core/test-vectors/`.
5. **The mocha template is gone** (`tests/hyphae.ts`, `tests/tsconfig.json`); `Anchor.toml`'s test script runs `cargo test -p hyphae --tests`. The root `package.json` still lists mocha, chai and ts-mocha; it was outside the writable paths.
6. **`fakeModel` is exported from `apps/api/src/http/demo-seed.ts`** so the ready seed reuses it.
7. **Soulbound Token-2022 points are not built.** The arc named vault, publish and claim only.

## Evidence

- Rust: `anchor build` exit 0, no warnings; `cargo test -p hyphae --tests` 21 + 6 passed. `program_autofixer` on the program: no critical or high; two medium advisories on `u128` arithmetic that cannot overflow (a `u64` times 300; the fee is below the gross).
- TypeScript: core 89, api 396 + 1 skipped (the devnet harness), web 14. `test:pg` 17/17 on Postgres 17, including publish on postgres-js and two runs racing to publish one epoch (one send, one record).
- `python tests/h_contract_vectors.py`: 16 hashes reproduced with the standard library (configs with decimal weights and a non-ASCII payload; evidence with emoji, a combining accent, a control character, quotes and a backslash; the decision chain; both manifests; five leaves).
- The seeded ready epoch's allocation equals the `seeded_ready_epoch` vector to the lamport: gross 500,000,000; fee 15,000,000; allocated 304,603,658; cap remainder 180,396,341; dust 1. The P-proposal's worked example is a vector too, and matches the ruled numbers (280,789,473 allocated, 204,210,526 cap remainder, 1 dust).
- A blocked epoch (`before_first_paid_epoch`) and a held one (`hold_checks_pending`) build nothing and call no chain method.
- Mutation probes: 6 on the program, all caught. 14 on the TypeScript, 12 caught at first; the two survivors (a signed member who is not payable; a re-entry's `reentry_of`) got tests and are caught.
- Test-first: every module's tests were written first and failed (compile errors for the program, missing modules for TypeScript, assertion failures for each review fix). A missing module is a weak red, so the mutation probes are the evidence that the tests test the behaviour.

## Review (cross-model, before push)

Three fresh Codex threads, read-only, diff and specs passed as a prompt file.

| Round | Scope | Verdict | Findings and what happened |
|---|---|---|---|
| 1 | `a414505..62e18b3` with the scope note, P1–P16, Part B and the gate | needs-attention | **H1:** the admin can publish any root and claim unassigned funds. Matches ruled P4/P5; **parked as a custody question** (Q1). **M2:** gate and manifests read in separate transactions. Fixed: `payoutGateIn(tx)` inside one repeatable-read transaction, plus manifest invariants (`57d51b3`). **M3:** B6 stored hashes not built. **Parked** (Q2): needs `packages/db`. **L4:** the capture time went through a JS Date. Fixed (`57d51b3`). |
| 2 | `62e18b3..57d51b3` | needs-attention | M2 and L4 confirmed fixed. H1 and M3 restated as highs that must be settled before any payout: **still parked, as pre-mainnet blockers.** Low: impossible capture times accepted; fixed. Low: uninitialized mints accepted; fixed (`80895ef`). Low: the gate compares the hold window in milliseconds; **unchanged**, because every `closes_at` and `observed_at` is written from a JS Date. |
| 3 | `57d51b3..80895ef` | **approve** | None. |

Two fixes came from this session's own review, before Codex: a rules-test pass after the close was shown in the manifest (`cd9a2ae`), and the mint check accepted token accounts (`9e420b0`).

## Devnet (step 6)

**Not run.** Three throwaway keys were generated in WSL `~/hyphae-devnet/` (admin `Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM`, claimant `3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk`, fee recipient `AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR`). Every `solana airdrop` to the admin (1–2 SOL, about 17 attempts between 23:3xZ and 00:5xZ) failed with the faucet's rate limit. Other public devnet endpoints need API keys, and using a key is out of bounds for this arc. The Lab wallet was not used. No devnet transaction exists, so there are no signatures to record.

What it needs: about 2.6 devnet SOL on the admin (the program's rent is 1.165 SOL, held twice during deploy while the buffer exists, plus a 0.05 SOL pot and fees). Then, in WSL, with the toolchain on PATH and a `config.yml` in `~/hyphae-devnet/` that points `keypair_path` at `admin-2026-09-25.json` and `json_rpc_url` at devnet:

```bash
cd ~/hyphae-devnet && R=/mnt/c/Users/joao_/Desktop/DEVELOPMENTS/hyphae
(cd $R && anchor build)
solana program deploy $R/target/deploy/hyphae.so --program-id $R/target/deploy/hyphae-keypair.json --upgrade-authority admin-2026-09-25.json --config config.yml
spl-token create-token --config config.yml --fee-payer admin-2026-09-25.json --mint-authority $(solana address --config config.yml)
```

Then from the repo root on Windows, with the keypair files copied out of WSL:

```bash
HYPHAE_DEVNET_RUN=1 HYPHAE_DEVNET_ADMIN_KEYPAIR=<admin.json> HYPHAE_DEVNET_CLAIMANT_KEYPAIR=<claimant.json> HYPHAE_DEVNET_FEE_RECIPIENT=AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR HYPHAE_DEVNET_MINT=<mint> HYPHAE_DEVNET_REPORT=<report.json> pnpm --filter @hyphae/api exec vitest run src/payout/publish.devnet.test.ts
```

The harness initializes the community (the claimant is the seeded "effort" member), funds the vault to 0.05 SOL of unassigned balance, publishes the seeded epoch through `publishEpoch`, and claims that member's leaf. It then sends the same claim again past the preflight, so the refusal is a failed transaction with its own signature. It writes every signature to the report.

## Parked, not done

- **Pre-mainnet blockers (Codex rounds 1–2):** Q1 (custody of unassigned funds) and Q2 (stored hashes and manifest bytes). Neither blocks devnet.
- **Before Oct 9 and not in this arc:** an operator entry point that runs `publishEpoch` with the admin key; a claim path for testers (a `/claim` page in `apps/web`, or a CLI); `communities.chain_address` for MYCEL (a Neon write, Cisco's); the P8 fee address; the read API's allocation section (P14).
- Root `package.json` still carries the mocha toolchain; `docs/TESTING.md` still lists the claim as planned (true).
