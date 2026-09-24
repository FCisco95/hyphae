---
date: 2026-09-25
summary: Scope of the Anchor program and R6, authorized for local and devnet work on 2026-09-24 (~22:40Z). The program holds a program-owned SOL vault per community, publishes an epoch (merkle root, audit hash, 3% fee to the P8 recipient, allocated total) and pays each leaf once against a claim receipt PDA. R6 adds the Part B hashes, the member-epoch and epoch audit manifests, exact bigint allocation in place of settle.ts, and a publish job that only acts on a ready payout gate. The job is written, not scheduled, and nothing in production calls the program. No migration: R6 records into the existing epochs and leaves columns.
---

# Anchor program and R6 — scope

## Authority

- Cisco, 2026-09-24 ~22:40Z, "all yes" (`2026-09-25-gate-and-r6-rulings.md`): R6 and the Anchor program, local and devnet only.
- Design inputs, as ruled 2026-09-24: H-CONTRACT Part B (B1–B10, `2026-09-25-h-contract-proposal.md`) and payment definitions P1–P16 (`2026-09-25-payment-definitions-proposal.md`).
- Writable in this arc: `programs/**`, `packages/core/src/**`, `apps/api/src/**`, `tests/**`, `docs/**`, `Anchor.toml`. Not `packages/db`, so **no migration**.

## Program (`programs/hyphae`)

| Account | Seeds | Holds |
|---|---|---|
| `Community` | `["community", mint, admin]` | mint, admin (P5), fee recipient (P7/P8), outstanding lamports |
| `Vault` | `["vault", community]` | SOL (P3). Owned by the program; anyone can transfer SOL in (P4) |
| `Epoch` | `["epoch", community, index u64le]` | root, audit hash (B9), gross, fee, allocated, claimed, publish time |
| `ClaimReceipt` | `["claim", epoch, wallet]` (P13) | wallet, score, amount, evidence hash, claim time. Existence = paid |

| Instruction | Rules |
|---|---|
| `initialize_community(fee_recipient)` | Signer becomes admin. `mint` must be owned by SPL Token or Token-2022. Creates the community and its vault. The fee recipient is fixed; no update instruction (P7). |
| `publish_epoch(index, root, audit_hash, gross, allocated)` | Admin only. Fee = `floor(gross × 300 / 10,000)` computed on-chain and moved to the recorded fee recipient (P7). `0 < allocated ≤ gross − fee`, so nobody-payable can never publish or take a fee (PG6). `gross ≤ vault − rent − outstanding` (P6). One publish per index (the epoch PDA). `outstanding += allocated`. |
| `claim(score, amount, evidence_hash, proof)` | The signer is the leaf's wallet. The leaf is recomputed on-chain (B8 bytes, SHA-256 syscall, `0x00`/`0x01` prefixes) and checked against the epoch root. The receipt PDA makes a second claim fail. `claimed + amount ≤ allocated`, so a bad root can never drain other epochs' money. `amount > 0`. |

No withdrawal, sweep, admin rotation or claim deadline (P4, P15). Points minting (Token-2022) is not in this arc.

## R6

| Piece | Where |
|---|---|
| `hyphae-c14n/1` (B1) and tagged hashes (B2) | `packages/core/src/commitments.ts` |
| Config, evidence and decision payloads and hashes (B3–B5), member-epoch and epoch audit manifests (B7, B9) | same |
| Exact allocation (P6, P7, P10, P11): fee, net, cap (25 %, 15 % from 20 payable), floor dust, cap remainder | `packages/core/src/allocation.ts`, replacing `settle.ts` |
| Shared vectors (B10) | `packages/core/src/test-vectors/h-contract-v1.json`, asserted by core tests, by Rust tests in `programs/hyphae/tests`, and by `tests/h_contract_vectors.py` (stdlib only) |
| Hashes from database rows (the B6 backfill, computed) | `apps/api/src/payout/commitments.ts` |
| Publication: gate → allocation → manifests → leaves → root and audit hash | `apps/api/src/payout/publication.ts` |
| Program client (PDAs, instruction and account bytes) and the publish job | `apps/api/src/payout/program.ts`, `apps/api/src/payout/publish.ts` |

- **Only a `ready` gate is published.** `publishEpoch` calls `evaluatePayoutGate` and returns without writing or sending anything on any blocker, including a held member.
- **Chain first, then database.** The job sends `publish_epoch`, then records `leaves` (wallet, whole points, lamports, manifest hash, proof) and `epochs.root`, `pot_lamports` (gross), `publish_tx`, `published_at`, `status = 'published'` in one transaction. A re-run after a crash finds the on-chain epoch and records it if the root, audit hash and amounts match; any mismatch stops it.
- **Written, not scheduled.** No queue, no cron, no route, no bot command. The devnet run calls it from a test that only runs when devnet settings are given.

## Decisions taken here (not covered word for word by Part B or P1–P16)

1. **Community seeds include the admin.** The design sketch had `["community", mint]`. Then the first caller for a mint would own that vault's address, and could publish a root paying itself from anything deposited there. With the admin in the seeds, a vault address names whose publish key it trusts.
2. **`outstanding` grows by the allocated total, not the net pot.** Cap remainder and dust stay in the vault (P11) and count as unassigned, so a later pot can use them. Reserving the net pot would lock them with no rule that ever releases them, the outcome P10's reasoning rejects. Recorded as an open question for Cisco to confirm.
3. **A payable member whose floored share is 0 lamports gets no leaf.** The manifest still records the member and amount 0. A zero claim would only cost the member rent (P13: paid means a receipt with a transfer).
4. **The cap population is the payable members** (P9), counted before any floor.
5. **Leaves are ordered by leaf hash before building the tree**, so anyone can rebuild the root from the leaves alone.
6. **Stored hash columns (B3, B5) wait for a migration.** Hashes are computed from insert-only rows each time. That makes B6's rule ("refuse a null hash") hold trivially, and pre-R6 decisions get the same hash they would have had. Storing them, and the audit manifest bytes, needs `packages/db` (migration 0010). Recommended before the mainnet publish, so a future code change can never alter a published manifest's bytes.
7. **`reentry_of` in the evidence payload is the original contribution id**, as the read API serves it.
8. **The vector file sits in `packages/core/src/test-vectors/`**, not B10's `packages/core/test-vectors/`, to stay inside this arc's writable paths.

## Tests

- **Program, LiteSVM (Rust):** initialize; publish (fee math on 0.5 SOL and on an odd gross, fee to the recorded recipient, wrong fee recipient, non-admin, pot above the unassigned balance, allocated above net, zero allocated, second publish of an index); claim (happy path moves exact lamports and writes the receipt; double claim; wrong proof; tampered amount; wrong epoch; claim before publish; claims above the allocated total).
- **Vectors:** the Rust test reads the same JSON as TypeScript: leaf bytes and hashes, node hashes, roots and proofs for 1, 2, 3 and 5 leaves, a tampered proof, instruction and account discriminators, and the on-chain epoch layout.
- **Core:** the c14n profile (numbers, keys, lone surrogates refused), tag separation, each hash vector, allocation (the P-proposal's worked example to the lamport, the 20-member cap switch, fee floor, dust and cap remainder reconciling to the net pot).
- **Api:** hashes over seeded rows (predecessor binding, a correction, a late revision); a seeded ready epoch's publication equals the `seeded_ready_epoch` vector to the lamport; blocked and held epochs publish nothing and call no chain method; crash recovery records a matching on-chain epoch and refuses a mismatched one.

## Devnet (step 6)

A throwaway admin, fee recipient and claimant generated this session (airdropped devnet SOL; never the Lab wallet, never a mainnet key). Deploy program `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E` to devnet, create a devnet mint and the community, fund the vault, publish a seeded epoch through `publishEpoch`, claim once, and watch a second claim fail. Signatures go in the handoff.

## Off in production

Nothing new runs in production. The api and worker have no caller of `publishEpoch`, `communities.chain_address` is null for MYCEL (the job refuses without it), and no publisher key exists on Fly. Mainnet deploy, vault funding and the first publish stay Cisco's (Oct 7–9).
