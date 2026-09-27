---
date: 2026-09-27
summary: Implementation note for the completion scope ruled on 2026-09-27 (decision 1). Durable publication intent in migration 0011, recovery from those exact bytes, the operator publish script behind a signer interface, the P14 allocation/payment sections read against the chain, a claim route, and a /claim page. Roots, the 89-byte leaf, the program and fee/reserve semantics do not change.
---

# Completion scope — implementation note

Authority: `2026-09-27-completion-and-custody-rulings.md` (decision 1, Q1, Q3). Contract: H-CONTRACT B7–B9, P13–P16.

## 1. Durable publication intent (migration 0011)

- `epoch_publications`: one row per epoch, written **before any send** and never updated: `epoch_id` (unique), `community_id`, `community_address` (the on-chain community account), `root`, `audit_hash`, and `audit_manifest`, the exact hyphae-c14n/1 text the audit hash covers.
- `epoch_publication_members`: one row per member of the audit, with `manifest` (exact text) and `manifest_hash`.
- A CHECK ties each hash to its bytes in SQL (`sha256(tag || 0x00 || bytes)`), so stored bytes and hash cannot disagree.
- Nothing else is stored. Leaves, the tree and proofs are a pure function of the member manifests, and the root must equal the stored one.

## 2. Publish and recovery from the stored bytes

`publishEpoch` runs these steps in order:

1. Check the community's on-chain binding.
2. Evaluate the gate; a blocked epoch returns with no write.
3. Backfill (B6).
4. Run the strict build.
5. **Store the intent, or load the one an earlier run stored.** A stored intent must equal today's recomputation byte for byte, or the run refuses before any send.
6. Verify the intent from its own bytes (hashes, then leaves, tree and root).
7. If the epoch is already on-chain, it must equal the intent: record it, with no second send. Otherwise send the intent's root, audit hash, gross and allocated amounts.
8. Record the leaves and root from the intent.

The two crash cases then work out as follows:

- **Crash before the send:** the next run sends the same bytes.
- **Crash after the send:** the next run records the same bytes.

## 3. Operator script and signer

`apps/api/scripts/publish-epoch.ts` has two subcommands:

- **`plan`** stores and prints the intent (root, audit hash, gross, fee, allocated, members). It does not send.
- **`publish`** sends and records.

The signer is `@solana/kit`'s `TransactionSigner`:

- **`file:<path>`** is a keypair file, refused on mainnet.
- **`ledger:<path>`** is a Ledger running the Solana app. It signs the message on the device, so the key never leaves it. Mainnet requires it (Q1). The path is required, with no default account (changed the same evening). Hyphae's admin is `44'/501'/2'/0'`.

The run also enforces two things:

- The RPC's genesis hash must match the named network.
- The signer must be the community's admin, or the program refuses the transaction.

Run one publish at a time. The epoch PDA's `init` bounds concurrent runs to one publication.

## 4. One program client

The PDAs, instruction encoders and account decoders move from `apps/api/src/payout/program.ts` to `@hyphae/core`, with `@noble/hashes` for the discriminators. The API's publish and the web's claim then build the same bytes. The shared H-CONTRACT vectors pin those bytes.

## 5. P14 read sections (additive inside v1)

**Where they live.** A4 makes a new value in a closed enum a `/v2` change, and v1's `allocation` and `payment` are a closed `unavailable`. So both stay exactly as v1 first shipped them, and P14 is a new field, `epoch.settlement`, holding `allocation` and `payment`:

- While a section is unavailable, the first v1 field repeats it (same reason).
- Once it holds more, the first v1 field says `unavailable` with reason `see_settlement`.
- A consumer reading an api that predates `settlement` finds it absent; the loose schema allows that.

(Revised 2026-09-27 after the step-5 Codex review, finding F1; the first draft put `published` into `allocation` itself.)

**`settlement.allocation`** is `published` when three things hold:

- a recorded publication exists;
- the on-chain epoch account matches its root, audit hash, gross, fee and allocated amount;
- the chain shows the successful `publish_epoch` that created that account with exactly those commitments, amounts and fee recipient. The recorded signature is only a hint; the transaction shown is the one the chain proves (F3).

It then serves the stored audit numbers with that publish transaction: gross, fee, net, allocated, cap remainder, dust and payable members.

**`settlement.payment`** is `available` from chain reads only:

- `claimed` is the epoch account's `claimed_lamports`, and `unclaimed` is allocated minus claimed.
- A member is `paid` only if their receipt PDA exists, matches their leaf, and the chain shows the successful `claim` that created it for their wallet. The transaction shown is that claim (F2). Otherwise they are `claimable`.
- A `leaves.claim_tx` string is never evidence.

**Finding a creating transaction.** `init` succeeds once per address, so exactly one successful transaction carries the creating instruction. The lookup:

1. tries the hint first;
2. pages back through the account's signatures, up to 10 pages of 1,000;
3. tries the oldest successful ones first, preferring any from the second the account records as its creation, up to 10 transactions;
4. reads top-level and inner instructions, with lookup-table addresses resolved.

A finalized result is cached per account; a cached one must still match the instruction asked for. The publish job's crash recovery uses the same lookup.

**Deadline.** Chain reads run after the database read, under one 2 s deadline, below the web client's 3 s. Each RPC call has a 1.5 s timeout. Receipt lookups run 8 at a time. The allocation is settled first, so slow payment lookups never hide a verified publication. The claim route reads only its own wallet's receipt (F6).

Otherwise each section is `unavailable`, with one of these reasons:

- `no_settlement`
- `before_first_paid_epoch` (P14's "retained" state)
- `no_stored_intent`
- `chain_unconfigured`
- `chain_unavailable` (including the deadline)
- `chain_mismatch`
- `chain_transaction_missing` (the account is there, but its creating transaction is not found within the bounds)

These are never shown as zero.

**New route:** `GET /v1/communities/:mint/epochs/:index/claims/:wallet`. It returns the leaf (score, amount, evidence hash, proof), the addresses (community, vault, epoch, receipt), the payment status and a recent blockhash. A wallet without a leaf gets 404.

**Chain reader:** built from an RPC URL whose genesis hash matches the publication's network. Without one, the P14 sections stay `chain_unconfigured`. Two small edits outside the arc's listed paths wire it: `env.ts` and `server.ts`.

## 6. `/claim`

- **Pages:** `apps/web` gets `/c/[mint]/e/[index]/claim`, and `/claim` redirects to the default mint's latest epoch with a recorded publication. It searches every closed epoch, newest first. It says none exists only when every read establishes that, and shows unavailable when a read fails (F5).
- **Freshness:** each signing attempt, including a retry, reads the claim again first. The blockhash is then fresh, and a claim paid in the meantime is not signed (F4).
- **Data:** the browser gets claim data through a same-origin Next route handler that calls the read API server-side.
- **Wallet:** it connects through wallet-standard. The page builds the claim instruction with the shared client, for the connected wallet only, and sends it through the wallet's `solana:signAndSendTransaction`.
- **States:**
  - not published;
  - no allocation for this wallet;
  - claimable (amount);
  - paid (with transaction);
  - chain unavailable;
  - wallet unsupported.

## Tests (named by the arc)

- Crash before the send and after the send.
- A recomputation mismatch against the stored intent.
- A stored intent whose bytes and hash disagree (refused by the database).
- Duplicate claim: the route and page show paid; LiteSVM and the devnet harness cover the program's refusal.
- Wrong wallet or wrong epoch: 404 or unavailable; LiteSVM covers wrong proof and wrong epoch on-chain.
- Missing payment evidence: a DB claim string without a receipt is `claimable`, not paid, and an unreadable chain is `unavailable`, never zero.

## Out of scope

Deploying, applying 0010/0011 to Neon, the mainnet community, funding and publish, P8's address, and any change to the program or the leaf.
