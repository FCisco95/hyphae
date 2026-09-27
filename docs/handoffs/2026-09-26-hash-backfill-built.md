---
date: 2026-09-26
summary: B3/B5/B6 implemented locally with migration 0010, deterministic per-epoch backfill and strict stored-hash publication checks. Nineteen regression cases pass on PGlite and under Vitest. Supplemental suite totals are 518 passed, one existing CLI failure and one skipped devnet test. PostgreSQL verification of this change, the other-family review, Rust confirmation and Git writes remain blocked or pending. No commit, push, Neon write or devnet transaction.
---

# September 26 — stored reward hashes and backfill

## TL;DR

**Implementation exists locally; it is not release-ready or committed.** `0010_reward_commitment_hashes.sql` adds the four hash columns. `backfillEpochCommitments` fills old rows under the existing community lock, in predecessor order, without replacing stored commitments. Publication now refuses required missing or mismatched hashes before sending. The 89-byte leaf and existing roots are preserved.

This supersedes the earlier engineering state in `2026-09-26-recovery-and-readiness.md`. That record retains the initial execution failures and Cisco's baseline checks. The full original arc is still incomplete: current PostgreSQL proof, other-family review and Git writes remain unavailable; devnet has no funding.

## Authority, runner and scope

- Local B3/B5/B6 and devnet R6/Anchor were already authorized by `2026-09-25-gate-and-r6-rulings.md`, `2026-09-24-contract-and-payment-rulings.md` and the September 26 session prompt. No new approval was requested for them.
- Runner exposed identity: **Codex, GPT-6**; exact variant/effort unavailable. Do not call this a verified Astra/xhigh implementation run.
- Supplemental reviewer was dispatched with **`gpt-6-astra`, xhigh**. It reports Codex/GPT-6 and cannot independently attest variant/effort. Its verdict was **no confirmed introduced defects**; this is same-family review only.
- Required other-family review: Claude CLI 2.1.283, requested **`claude-fable-5-1`, xhigh**, fresh print call with tools disabled and no persisted session. It failed with **ECONNREFUSED**, zero API tokens and empty `modelUsage`; no model review occurred. Do not call that an approval or an actual Fable run.
- Historical September 25 reviewers were Luna/xhigh, as originally recorded.
- Arc base and current HEAD remain `1c7c2c6692e8fdfc74fe6adedc978fbbbd195d93`. Only the approved payout, local DB, tests and docs paths changed. No vault/sibling writes or production changes.

## Implementation

| Piece | Files / behavior |
|---|---|
| Local migration | `packages/db/drizzle/0010_reward_commitment_hashes.sql`, metadata and `src/schema.ts`. Nullable `reward_configs.config_hash`, `reward_intakes.evidence_hash`, `reward_decisions.decision_hash`, `reward_snapshot_entries.decision_hash`. Five constraints enforce lowercase SHA-256 form and forbid a snapshot hash without a selected decision. |
| Deterministic computation | `apps/api/src/payout/commitments.ts`. Existing payload/hash functions unchanged; validates contiguous predecessor lineage, epoch/community binding and completed dispatches. Returns all referenced config hashes for storage. |
| Backfill and verification | `apps/api/src/payout/commitment-store.ts`. Explicit per-epoch transaction under the established community `NO KEY UPDATE` lock. Checks existing commitments, fills nulls in config/evidence/revision/snapshot order, then checks persisted values. Any mismatch throws; no root, fee, allocation or transaction field is rewritten. |
| Publication | `publication.ts` calls `storedEpochCommitments` inside its existing repeatable-read transaction. It does not backfill on the read/send path. Required nulls or mismatches refuse publication before a send. |
| Fixtures | `ready-seed.ts` explicitly backfills its closed seeded epoch. `storeCommitments: false` produces old unfilled rows for regression cases. This is not a new production job. |
| Tests | `commitments.test-cases.ts`, `commitment-store.test.ts`, `commitment-store.pg.test.ts`. The same 19 assertions run with PGlite or the production PostgreSQL driver. `tests/run-payout-commitments.mjs` runs the PGlite cases in-process with Node 22.15+. |

The physical migrations and journal ended at 0009 before this change. **0010 is now used for approved hashes/backfill only.** The manifest extension must inspect the journal and use the next available number when approved; it must not overwrite 0010.

Normal reward writers remain unchanged within the allowed scope. New rows initially have null hashes. Call the explicit backfill after close and before publication; running it before close does not fill snapshot entries created later. An unfilled late revision also prevents publication until backfilled. This is deliberate refusal, not automatic repair.

Unscored snapshot entries keep their contract-defined reason and null decision hash. A selected decision with a missing hash is an error. A late correction is hashed without replacing the decision selected at close.

The internal config `digest`, legacy evidence hashes, claim leaf layout, program, fee/custody/reserve semantics and public API response schemas are unchanged. Public additive hash fields and shared read-API capture-time parsing remain downstream work outside this arc's allowed HTTP paths. Durable manifest bytes, operator publication and claim/P14 UI remain the unapproved extension.

## Validation

The first regression ran against the original code and failed with `Missing expected rejection`: a ready epoch with unfilled hashes could build a publication. The same refusal case passes after implementation.

| Check | Current result |
|---|---|
| New shared regression cases, Node + PGlite | **19/19 pass**, no skips. Includes migration over populated pre-hash rows, deterministic retries, predecessor order, frozen selection/late correction, each missing/mismatched hash class, no chain send, pending dispatch, malformed hash constraints, wrong community and preservation of a recorded root/transaction. |
| New cases inside Vitest | **19/19 pass** as part of the API run. |
| Existing publication vectors/tests | **11/11 pass**; exact seeded allocation and leaf/proof reconstruction retained. Included in the API count below. |
| Core Vitest | **89/89 pass**. |
| Web Vitest | **14/14 pass**. |
| API Vitest | **415 pass, 1 fail, 1 skip**. Failure: `scripts/eval-scoring.test.ts` → `dry-runs the documented fixture without credentials or model calls`, where `result.stderr` was undefined. It uses `spawnSync`; the sandbox blocks subprocess execution. The test and production script were left unchanged, not skipped. Devnet is the explicit skip. |
| Typecheck | Core, DB, API, web and API link-page projects all pass through the installed `tsc` entry point. |
| Biome | **200 tracked/new eligible files clean**, including the new `.mjs` runner. No exclusions added. Ordinary `pnpm lint` still has the pre-existing globally ignored `.claude/settings.local.json` formatting error. |
| Drizzle check | **Pass**, through the installed CLI with an equivalent local CJS config pointing to the same schema/migration directory. |
| Python vectors | **16 hashes reproduced**; no core hash or vector file was changed. |
| Diff whitespace | `git diff --check` **pass**. |
| Handoff validator | **Valid / resume-usable**. Non-strict template warnings only; no success claim for the incomplete implementation gate. |
| Real PostgreSQL after 0010 | **Not run.** Docker's named pipe returns access denied. Cisco's earlier 17/17 was before this change and is not evidence for 0010. |
| Anchor/Rust | Cisco's baseline `anchor build` exited **0** (latest-tools advisory only). Separate Rust test result remains unconfirmed. No Rust/program/leaf code changed here. |

Vitest evidence above used an **alternate local execution profile**, not a successful `pnpm -r test` invocation: native config loading, in-process TypeScript transpilation, a single thread worker, preserved symlinks and disabled dependency optimization. It ran the actual repository tests without omitting the CLI failure. The profile is local in ignored `docs/plans/`; the portable supplemental runner is `node tests/run-payout-commitments.mjs`. **The prescribed full release gate is not green.**

The migration was generated with installed Drizzle Kit's `generateDrizzleJson`/`generateMigration` API, asserting exactly four column additions and five constraints. PGlite applied it locally. Nothing was applied to Neon.

## Review and commits

The supplemental fresh review checked migration/schema agreement, null-only writes, mismatch refusal, community locking, predecessor order, frozen selection, pending entries and hash/leaf compatibility. **No confirmed introduced defects.** It noted that real PostgreSQL and concurrent backfill/correction execution remain unverified; the new PostgreSQL cases are sequential.

The other-family review failed before model inference. Review packet SHA-256: `535d33157410ef6ffec5047ceef622851e7f1c01b16c528f1407da44ca183a49` (a later test-title-only clarification changes no behavior). It includes the tracked implementation diff and all new implementation/migration/test files. A successful fresh other-family review of the final range is still required before push.

**New commits: none. Pending new commit IDs: none.** `git add` of the explicit implementation/test/migration paths failed: `Unable to create .../.git/index.lock: Permission denied`. No hook was bypassed, no commit was manufactured and no GitHub API write was used. Working changes remain unstaged and unpushed. An unrelated zero-byte `wsl` file is untracked; it was preserved and excluded from the attempted stage list.

## Devnet and deployment readiness

- **No devnet transaction or signature this session.** Cisco's throwaway-admin balance check returned **0 SOL**. No faucet retry loop or Lab-wallet use. Keys remain unverified. The documented throwaway deploy is still pre-approved.
- Program identity remains `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`; the existing built-record devnet procedure remains the runbook after funding.
- **October 1:** candidate `86ff258` still requires 0009 first. Committed main remains `1c7c2c6`; this dirty working candidate adds **0010** and must not be deployed against only 0009. The ORM's ordinary full-row reads also need the new columns, even with publication unscheduled.
- Outstanding attended actions: independent hold RPC setup/network proof, token re-rotation, Vercel plus `HYPHAE_API_URL`/`DEFAULT_MINT`, Fly `PUBLIC_WEB_URL`, live API/worker/quiz/link checks, and Cisco's `first_paid_epoch` go/no-go before **2026-10-02T00:00Z**.
- **October 6:** not ready yet. Requires the current PostgreSQL gate and other-family review, funded devnet proof, and approved/scheduled durable publication/operator/claim/P14 work. Q1 custody, Q3 reserve reuse and P8 remain unresolved. No production or mainnet approval is inferred.

## Next action

Continue autonomously; Cisco explicitly rejected further manual command-by-command testing. Run the outstanding release checks once the environment permits Docker, subprocesses, WSL and Git writes. Obtain the other-family review, fix findings test-first, commit verified milestones on main, refresh these records and push only after the gate. Independently retain the devnet funding blocker and extension approval/window limits. Stop at the original step 5; no vault or sibling writes.

## Generated artifacts this session

| Artifact | Location | State |
|---|---|---|
| Migration and Drizzle metadata | `packages/db/drizzle/0010_reward_commitment_hashes.sql`, `meta/0010_snapshot.json`, journal | Local only, uncommitted; no Neon apply |
| Hash implementation and tests | `apps/api/src/payout/commitment-store.ts` and companion test files; schema changes | Local only, uncommitted |
| Portable supplemental runner | `tests/run-payout-commitments.mjs` | Local only, uncommitted |
| Handoff/build log/checkpoints | `docs/HANDOFF.md`, `docs/BUILDLOG.md`, `docs/handoffs/` | Updated locally |
| Temporary generation/review/execution helpers | `docs/plans/` (ignored) | Not canonical, no secrets; ordinary Vitest and the portable runner do not require these for normal execution |

No keys, credentials, deployed resources or scheduled jobs were generated.

## Suggested skills

`handoff-memory`, `orca-cli` for available authorized terminal access, `superpowers:test-driven-development`, `supabase:supabase-postgres-best-practices`, `context7-mcp`, `solana-dev`, fresh other-family review, `superpowers:verification-before-completion`, `handoff`.

## Next-session prompt

```text
Resume Hyphae autonomously. Read CLAUDE.md, AGENTS.md, docs/HANDOFF.md and docs/handoffs/2026-09-26-hash-backfill-built.md. HEAD is still 1c7c2c6. The uncommitted working tree now IMPLEMENTS B3/B5/B6 with migration 0010, deterministic backfill and strict publication checks. Do not rebuild it or say it is unbuilt.

Model: prefer Fable 5.1 xhigh, or GPT-6 Astra xhigh in Codex, for reward/recovery invariants; record actual identity/effort. Skills: handoff-memory, test-driven-development, postgres best practices, context7-mcp, solana-dev, verification-before-completion, handoff.

Nineteen new cases pass on PGlite and inside Vitest; total supplemental suite evidence is 518 pass, one existing subprocess-dependent CLI failure, one devnet skip. All typechecks, Biome 200 files, Drizzle and Python vectors pass. New real-PG/Rust confirmation and the other-family review remain pending. Claude review failed ECONNREFUSED; supplemental Astra-configured review found no confirmed defects but does not satisfy the other-family gate. git add failed on .git/index.lock permissions, so nothing was committed or pushed. Preserve the unrelated empty untracked wsl file.

Use the functioning cmd.exe launcher for permitted commands. Normal PowerShell/compiler subprocesses, Docker and Orca access were denied; do not route around those denials. Finish the release checks and review when authorized execution works, commit verified milestones to main and push only after gates pass. Do not make Cisco a manual command runner. Devnet admin remains at the last observed 0 SOL; do not retry faucets or use the Lab wallet. The stored-manifest/operator/claim/P14 extension still needs decision 3 and October 3–6 unless explicitly pulled forward. Keep Q1/Q3/P8 unresolved. Candidate 86ff258 needs 0009; this working candidate additionally needs 0010 and its own validation. No Neon writes, production deploy, mainnet transaction, vault/sibling writes or scope after original step 5.
```
