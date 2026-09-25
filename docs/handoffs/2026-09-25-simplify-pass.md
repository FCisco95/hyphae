---
date: 2026-09-25
summary: A /simplify pass over the program and R6 arc (a414505..80895ef). Four read-only reviewers (reuse, simplification, efficiency, altitude) reported; eight cleanup commits and one review fix landed on main, test-first where behaviour moved. Two deliberate behaviour changes; everything else preserves verdicts, manifest bytes, leaves and roots. Codex (gpt-6-luna, xhigh) round 1 requested changes (one declined with evidence, one fixed); round 2 approved.
---

# Simplify pass on the program and R6 arc

## Scope

`git diff a414505..HEAD` at `10ef4d1`, without `Cargo.lock`, docs and the JSON vectors: the Anchor program, `packages/core` allocation and commitments, and `apps/api/src/payout`. The upstream diff and the working tree were empty, so the last code arc was the target.

## Applied

| Commit | Finding (reviewers) | Change |
|---|---|---|
| `edef71e` | Publication re-read the snapshot, passes and hold checks the gate had just judged, and re-derived which ones counted (all four) | The ready gate returns the judged snapshot, and each verdict carries the pass time and the hold result it applied. Publication builds from those, with no second read and no cross-check. The P9 rules live in the gate only. `isoUs` and `readOnly` move to `apps/api/src/pg.ts`. Entries are grouped in one pass, not filtered per member. |
| `d65a839` | The A14 authority rule and the effort-criteria mapping were copied between the read API and the decision commitment (reuse, simplification, altitude) | `correctionRecord` and `effortCriteriaRecord` in `rewards/decisions.ts`, called by both. |
| `1c86b24` | Publication owned the rule that a pot must pay someone a whole lamport (altitude) | `allocate()` owns it, next to PG6, test-first. Also: one subtraction for the cap remainder, `BASIS_POINTS`, and the entry type derived from its schema. |
| `b17fd10` | Hex helpers copied in five files, an unused `mint` publish input, an unused status select, restated literals (reuse, simplification) | `@noble/hashes` helpers, `getAddressDecoder` compare, `HYPHAE_PROGRAM_ID` and `READY_HOLD_THRESHOLD` in the tests. |
| `a8f89d5` | The fee recipient was an operator input, yet the chain holds it (altitude) | **Deliberate change.** The publish job reads the on-chain Community account, commits and sends its fee recipient, and refuses a community whose account is missing (new test). `publishEpoch` no longer takes `feeRecipient`. |
| `d5b4f3b` | The signed-wallet proof trail was seeded three times (reuse) | `seedSignedLink` in `http/demo-seed.ts`. Each caller keeps its own token digest, so the exposure test's secret marker still applies. |
| `1773d07` | The mocha toolchain had no user left after `tests/hyphae.ts` went (simplification) | Removed. `packages/db` declares `@types/node`, which it had only through that toolchain's hoisting. |
| `82657db` | The mint check tested the base length in two branches; the tests walked the vectors two ways (simplification, reuse) | One owner check, then one shape rule, with the same accept set (the linter found no issues). The `NotAMint` message names what it refuses; the error code is unchanged. The tree and proof lookups move to `tests/common`. |
| `61876cd` | Codex R1 low: an empty correction actor read differently in the two consumers | `appendCorrection` refuses a blank actor, test-first. |

Also deliberate: `allocate()` now throws for a zero allocation, where publication threw the same condition later (`1c86b24`).

## Skipped, with the reason

- **anchor-spl `InterfaceAccount<Mint>` instead of the hand-read mint bytes** (altitude). It changes the program's error codes (`NotAMint` becomes Anchor's owner or deserialize errors) and adds a dependency, which is more than a cleanup. **Recommended for the pre-mainnet program pass**, as the ecosystem-standard check that no reviewer has to re-audit.
- **A Codama client instead of the hand-written `payout/program.ts`** (reuse, simplification, altitude). This is the planned `clients/js` work. The `/claim` page (Q5) will need it, so it belongs in that scope. The shared vectors keep the hand client honest until then.
- **The capture time served by the read API** (`dateUs(new Date(…))`) and the one the evidence commitment hashes (`captureTimeUs`) are parsed two ways. They agree for every value intake writes (`toISOString()`). They would diverge for a stored microsecond or offset time. That is a correctness item for `/code-review`, best fixed with Q2's migration 0010 by giving both one parser.
- **Rust tests restating the token program ids, the seeds and the error codes** (reuse). Kept on purpose. They pin the ABI independently of the crate's own constants, so a typo in a constant fails a test instead of passing it.
- **`fakeChain` vs `sharedChain`, and the vector file loaded in two TS tests.** Different semantics (the first records calls, the second enforces one init). A shared loader would save six lines.
- **Out of the diff:** the gate's per-member `walletAt` queries, and `byKey` against older inline comparators.
- **Efficiency:** `epochCommitments` re-reads the epoch and config (one primary-key lookup each). Weekly batch scale.

## Checks at `61876cd`

`pnpm -r test` exit 0 (core 89, web 14, api 397 + 1 skipped devnet harness) · `pnpm -r typecheck` exit 0 · Biome on tracked files exit 0 (193 files) · `drizzle-kit check` ok · `test:pg` 17/17 (Postgres 17) · `anchor build` ok, `.so` sha256 `cb4ffdd8…8d79` · `cargo test -p hyphae --tests` 21 + 6 · `cargo fmt --check` and clippy clean · `python3 tests/h_contract_vectors.py` 16 hashes reproduced · `git diff --check` exit 0. `pnpm lint` also flags `.claude/settings.local.json`, a local file that the global git ignore excludes and Biome still reads. Tracked files are clean.

## Codex review

| Round | Range | Verdict | Outcome |
|---|---|---|---|
| 1 | `10ef4d1..82657db` | request changes | Confirmed: verdicts, manifest and audit bytes, leaves and root are unchanged for valid data; `is_mint` accepts the same set; the audit and the instruction use the same on-chain fee recipient. Medium, `FEE_BPS` no longer exported: **declined**, since nothing imports it, `@hyphae/core` is unpublished and typecheck passes. Low, empty correction actor: **fixed** (`61876cd`). |
| 2 | `82657db..61876cd` | **approve** | No findings; the decline was accepted. |
