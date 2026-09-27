---
date: 2026-09-27
summary: The completion scope is built test-first on main, reviewed twice by Codex gpt-6-astra, and not deployed. Migration 0011 stores the publication intent's exact bytes before any send; publish and recovery use those bytes; an operator script publishes behind a signer interface (keypair file on devnet, Ledger on mainnet). The read API serves P14 in an additive `settlement` field, with each publish and claim transaction proven on-chain under one deadline, plus a claim route. The audit site shows it, and /claim builds the claim in the browser from a fresh read. Devnet is still unfunded, so there is no end-to-end on-chain proof yet.
---

# 2026-09-27 — durable publication, operator script, P14 and /claim

## Authority, runner, reviewers

- Decision 1, Q1 and Q3 were ruled in-session on 2026-09-27 (`2026-09-27-completion-and-custody-rulings.md`). The design note is `2026-09-27-completion-note.md`, revised after the step-5 review.
- Runner: Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, xhigh.
- Step-5 review, round 1: Codex CLI 0.157.1, **`gpt-6-astra`, xhigh**, read-only sandbox, ephemeral, fresh. Scope `355067e..5d9da17`.
- Round 2, on the fixes: a new Codex session, same model, effort and sandbox. Scope `5d9da17..f24cefa`.
- Arc base for this range: `355067e` (the hash work, pushed).

## What was built

| Commit | What |
|---|---|
| `af217f7` | Rulings and the implementation note |
| `1dadda2` | **Migration 0011**:<br>• `epoch_publications` holds the audit manifest's exact hyphae-c14n/1 text, its hash, the root and the on-chain community.<br>• `epoch_publication_members` holds each member manifest's text and hash.<br>• An SQL CHECK ties each hash to its bytes: `sha256(tag ‖ 0x00 ‖ utf8)`.<br><br>**`publishEpoch`** stores the intent before any send, or loads the stored one, which must equal today's rebuild. After a send it records the stored bytes without rebuilding. An intent is verified from its own bytes, and one made for another network, program, community, fee recipient or pot is refused. `leavesOf()` is the one pure derivation of leaves and root. |
| `9932dc0` | Program client moved to `@hyphae/core`, with `@noble/hashes` discriminators so it runs in the browser. Byte-identical: the vector tests moved with it. |
| `10a5284` | `apps/api/scripts/publish-epoch.ts plan\|publish`:<br>• `planPublication` runs everything before the send, and `publishEpoch` runs it first.<br>• Signer: `@solana/kit` `TransactionSigner`. A keypair file is allowed only on devnet.<br>• A Ledger signs each message on the device, and each signature is verified; mainnet refuses anything else.<br>• Arguments are checked before the environment or a database is touched. |
| `d0ea1b2` | P14 read path, claim route `GET /v1/communities/:mint/epochs/:index/claims/:wallet`, chain reader wired from an optional `READ_RPC_URL`. |
| `4ca3abf` | Epoch page settlement panel, in exact SOL, with explorer links. |
| `44c495d` | `/c/[mint]/e/[index]/claim` and `/claim`. The page builds the claim in the browser with the shared client, re-derives every account and checks the proof first. The wallet signs and sends. |
| `585e4ef` | The devnet harness reconciles the stored intent, publication, claim and P14 read against devnet. |
| `5d9da17` | Biome-format the generated 0011 metadata. |
| **Step-5 fixes** | |
| `0c5c119` | `isPublishEpoch` / `isClaim` in core: recognise the program's instruction in a confirmed transaction. |
| `4faf625` | `creatingTransaction`, which proves the transaction that created a program account. The publish job's crash recovery uses it instead of "oldest signature". |
| `d745750` | P14 moves to the additive `epoch.settlement` field. Publish and claim transactions are proven on-chain. One chain deadline, bounded lookups and a finalized cache. The web reads `settlement`, and `/claim` searches every closed epoch. |
| `62ac927` | The claim panel reads the claim again right before each signing attempt. |
| `f24cefa` | Completion note revised for the review. |
| `2accfd3` | The devnet harness reads P14 with its own deadline. |

Unchanged: the program, the 89-byte leaf, roots and audit bytes, the fee (3% of gross to the on-chain recipient) and reserves (allocated total, per Q3).

## Deviations, and why

1. **Files outside the arc's listed writable paths.** None is a sibling repo or the vault. Each change is minimal:
   - `apps/api/src/env.ts` and `server.ts` add the optional `READ_RPC_URL` and wire the reader. Without them P14 could never be live.
   - `apps/api/package.json` adds the Ledger packages as devDependencies.
   - `packages/core/package.json` and `apps/web/package.json` add `@solana/kit`, plus `@wallet-standard/app` and `@noble/hashes` for the web.
   - `pnpm-lock.yaml` is updated to match.
2. **The Ledger USB transport is built but cannot run yet.** pnpm 10 blocks `node-hid`'s native build ("Ignored build scripts"), and allowing it is a supply-chain policy change. **Parked for Cisco.** Until then mainnet cannot publish, by design, since file keys are refused there. The adapter is tested against a fake device holding a real key; there has been no real-device test.
3. **The chain reads for P14 live in the API**, not the web page. Organic's adapter and the audit site then share one verified source.
4. **P14 is `epoch.settlement`, not `epoch.allocation`** (review F1, A4).
   - v1's `allocation` and `payment` stay a closed `unavailable`, with reason `see_settlement` once `settlement` holds more.
   - H-CONTRACT's note that Organic "moves to `allocation.status`" (proposal line 253) now reads `settlement.allocation.status`. **Open question for Cisco** (below).
5. **`/claim` uses `solana:signAndSendTransaction`**, so the browser needs no RPC. The API supplies a recent blockhash, read fresh before each signing.
6. `leaves.claim_tx` stays unused: payment evidence is the receipt and the claim transaction the chain shows creating it, never a DB string.

## Validation (on `f24cefa`)

**Tests**
- `pnpm test`: **614 passed** (core 104, web 34, api 476) + 1 skipped devnet harness.
- `test:pg` on Postgres 17: **41/41**.

**Static checks and builds**
- Typecheck: exit 0 in all four packages.
- `drizzle-kit check`: pass.
- Biome, tracked and new files: clean. `pnpm lint` exits 1 only on the globally ignored `.claude/settings.local.json`.
- `git diff --check`: clean.
- `next build`: pass. API tsup build: pass.

**Rust and vectors**
- `anchor build`: exit 0.
- `cargo test -p hyphae --tests`: **21 + 6**.
- Python vectors: **16**.

**Mutation probes, each caught by a named test**
- Build: no stored-vs-rebuilt comparison; no gate-first check; no claimed-total reconciliation; no root comparison; no owner check; no failed-transaction filter; no proof check in the browser; no address re-derivation in the browser; no epoch-level payment/allocation refine.
- Step 5: the finder trusting a failed transaction; no blockTime preference; no hint; newest-first order. The read trusting the DB `publish_tx`; accepting any transaction as the claim; serial lookups; no payment deadline; no claim-route deadline (it survived at first, and a test was added).

**Tests the arc named**

| Named test | Coverage |
|---|---|
| Crash before the send | Sends the stored bytes |
| Crash after the send | Records the stored bytes without rebuilding; recovery now finds the `publish_epoch` with those commitments |
| Recomputation mismatch | Refused before the send |
| Duplicate claim | Route and page show paid; LiteSVM covers the program's refusal; the devnet harness sends one on-chain |
| Wrong wallet or epoch | 404; the browser refuses another wallet |
| Missing payment evidence | A DB string without a receipt stays claimable; a receipt without its claim transaction is `chain_transaction_missing`; an unreadable chain is unavailable, never zero |

## Devnet

**Not run.** The throwaway admin `Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM` held **0 SOL** at 10:38:46Z and again at **12:23:36Z** (one read each; no faucet request). The keys are present. When it holds ≥ 2.6 devnet SOL, `2026-09-25-r6-anchor-built.md` § Devnet plus `publish.devnet.test.ts` prove the whole chain and record every signature: intent, publication, claim, refused duplicate and the P14 read.

## Review

**Round 1 (`355067e..5d9da17`): NEEDS-ATTENTION**, six mediums. Checks 1–4 and 7 were OK: durable intent, plan/publish split, program client move, operator and signer, dependencies. All six were fixed test-first:

| Finding | Fix |
|---|---|
| F1: new status values broke v1 loose consumers (A4) | P14 moves to the additive `settlement` field; first-v1 fields stay closed. A test parses a settled epoch with the first v1 consumer rule. |
| F2: `claim_tx` was the oldest of the newest 1,000 signatures | The claim shown is the successful `claim` instruction that created the receipt, for this wallet and leaf. Otherwise `chain_transaction_missing`. |
| F3: `publish_tx` copied from the DB | The publish shown is the `publish_epoch` that created the epoch account with exactly the stored commitments; the DB value is a hint. The same finder replaces the publish job's oldest-signature recovery. |
| F4: stale blockhash on delayed clicks and retries | `attemptClaim` reads the claim before every signing and signs only a still-claimable one. |
| F5: `/claim` said "none" on failed reads and past 5 epochs | `claimTarget` searches every closed epoch; a failed read is unavailable, never none. |
| F6: serial lookups past the web's 3 s | 2 s chain deadline, 1.5 s per call, 8 lookups at a time, finalized creations cached. The allocation is settled first, and the claim route reads only its own receipt. |

**Round 2 (`5d9da17..f24cefa`): APPROVE**, no verified findings. Checks 1–6 each came back RESOLVED/OK. Codex read kit's numeric-keypath transforms (numeric instruction indexes, bigint `blockTime`) and the program's CPI error handling, and confirmed that skipping the proof in `isClaim` is sound. Its one note is not a finding: the 2 s deadline covers chain reads, not the database read before them, so it is not an end-to-end 3 s guarantee.

After the review scope, `2accfd3` (test-only) gives the devnet harness its own P14 deadline, so a slow public RPC cannot fail a correct run.
