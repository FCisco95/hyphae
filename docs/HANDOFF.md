---
date: 2026-09-26
summary: B3/B5/B6 hash columns, deterministic backfill and publication refusal are implemented locally in migration 0010 and payout code. Nineteen new regression cases pass; supplemental suite totals are 518 passed, one existing CLI failure and one skipped devnet test. Real PostgreSQL verification, the other-family review, Rust confirmation and Git writes remain pending/blocked. No commit, push, Neon apply or devnet transaction.
---

# Hyphae handoff

## TL;DR

**The approved hash/backfill implementation is now built locally. Do not rebuild it or call it unbuilt.** Migration 0010 adds four hash columns; backfill fills them deterministically under the community lock; publication refuses required missing or mismatched hashes before sending. The 19 new cases pass on PGlite and under Vitest.

**The release gate is incomplete and nothing is committed or pushed.** Docker access is denied, Claude review could not connect, and `git add` failed on `.git/index.lock`. Devnet remains blocked by the last observed **0 SOL** balance. Full implementation/evidence record: [hash/backfill checkpoint](handoffs/2026-09-26-hash-backfill-built.md).

## Metadata

- Last Updated: 2026-09-26, 21:40Z checkpoint.
- HEAD remains `1c7c2c6692e8fdfc74fe6adedc978fbbbd195d93`, main tracking origin/main. No branch/worktree was created.
- Runner exposed identity: **Codex, GPT-6**; exact variant/effort unavailable. Do not claim verified Astra/xhigh.
- Supplemental reviewer dispatched with **gpt-6-astra / xhigh**; its self-report only exposes GPT-6. Verdict: **no confirmed introduced defects**. It is same-family review and does not replace the required gate.
- Other-family attempt: Claude CLI 2.1.283, requested **claude-fable-5-1 / xhigh**, returned **ECONNREFUSED**, zero API tokens, no model response or verdict.
- Historical September 25 reviewers were **Luna/xhigh**, not Astra.
- Authority: September 24 H-CONTRACT A/B and P1–P16, local/devnet R6 + Anchor approval, and the explicit September 26 hashes/backfill scope.
- Cisco now wants **autonomous work**, superseding the earlier manual step-by-step guidance. Do not make him run routine test commands.

## Current State

| Component | Stage |
|---|---|
| Rules test / hold gate / audit API and site | Built previously. Production last recorded at `b7bfe55`, Neon 0000–0008; not reverified live. |
| Anchor vault / publish / claim | Built previously; Cisco confirmed baseline Anchor build exit 0 today. Separate Rust result unconfirmed. No new program changes or devnet proof. |
| B3/B5/B6 stored hashes | **Implemented, uncommitted.** Migration `0010_reward_commitment_hashes`, deterministic per-epoch backfill and strict publication verification. |
| Durable manifest bytes / operator signer / claim / P14 | **Not built.** Decision 3 and October 3–6 window still govern; no pull-forward approved. |
| Commits/push | **None this arc.** Exact stage attempt failed with `.git/index.lock: Permission denied`. Pending new commit IDs: none. |

Implementation files: `packages/db/src/schema.ts`, migration 0010 and metadata; `apps/api/src/payout/{commitments,commitment-store,publication,ready-seed}.ts`; shared test cases, Vitest/Pg wrappers; `tests/run-payout-commitments.mjs`.

The migration journal and physical files ended at 0009 before implementation. **0010 is now the local hash migration.** The future manifest extension must use the next available number after inspecting the journal.

The prepared two-line devnet approval patch was applied and verified earlier. **Throwaway-key devnet deployment remains pre-approved.** Production deployment, Neon writes, secrets, Vercel creation and mainnet actions retain their separate authorization boundaries.

## Interfaces and Invariants

- `backfillEpochCommitments(db, { communityId, epochId })` returns counts for configs, evidence, decisions and snapshots. It checks existing values, fills nulls, refuses mismatches and serializes with the established reward writers.
- `epochCommitments` reconstructs deterministic payloads. `storedEpochCommitments` verifies the stored hashes and is what publication now consumes inside its repeatable-read snapshot.
- New reward rows remain null until explicit backfill. Run it **after close and before publish**; a pre-close backfill cannot fill later snapshot entries. No production backfill caller/job was added.
- Late revisions are hashed but do not replace frozen selections. Legitimate unscored entries retain their reason plus null decision hash; a selected decision with a null hash refuses publication.
- Internal config digest, legacy hashes, the 89-byte leaf, program, fee/reserve/custody semantics and existing roots remain unchanged.
- Public additive hash fields and shared capture-time parsing remain downstream HTTP work outside this arc's allowed paths. Allocation/payment still require honest unavailable states; a root or DB signature does not prove payment.
- The existing publish recovery still recomputes manifests. Exact stored manifest bytes and pre-send durable intent are the separate extension.

## Validation

**Current implementation:**

- New cases: **19/19** in Node/PGlite and **19/19** inside Vitest (same cases, do not double-count).
- Core **89 passed**, web **14 passed**, API **415 passed / 1 failed / 1 skipped**: total **518 passed / 1 failed / 1 skipped**.
- API failure: `scripts/eval-scoring.test.ts`, `dry-runs the documented fixture without credentials or model calls`; its subprocess returned undefined stderr in this sandbox. It was not disabled or changed. Devnet is the explicit skipped test.
- All five typecheck projects pass: core, DB, API, web and API link page.
- Biome: **200 tracked/new eligible files clean**, including the new runner. Existing `pnpm lint` caveat remains the globally ignored `.claude/settings.local.json` formatting error; no exclusion added.
- Drizzle check passes with equivalent local CJS config; migration generated with the installed Drizzle Kit API, four column additions and five constraints.
- Python vectors: **16 hashes reproduced**. `git diff --check` passes.

The actual Vitest suites ran through a local alternate profile: native config loading, in-process TypeScript transpilation, thread pool, preserved symlinks and no dependency optimization. **This is not a successful prescribed `pnpm -r test` gate.** The portable supplemental command is `node tests/run-payout-commitments.mjs`.

**Outstanding:** real PostgreSQL after 0010 (Docker pipe access denied), separate Rust test confirmation, the CLI test in its normal environment, and successful other-family review. Cisco's earlier **500/500 baseline tests and 17/17 PostgreSQL tests predate this change**.

## Execution and Git

Use `exec_command` with `shell: C:\\Windows\\System32\\cmd.exe`, `login: false` for permitted native commands. Git, Node, Python and native Biome work there. The default Windows Store PowerShell launcher fails. Compiler subprocesses, Docker and Orca access remain denied; Orca returned `runtime_access_denied`. Do not reroute denied operations or change host security settings from within this session.

`git add` failed before staging because the index lock could not be created. No hook was bypassed and no remote API write replaced a local commit/push. All changes are local/unstaged. An unrelated untracked zero-byte file `wsl` is preserved; exclude it from commits.

## Devnet and Deployment Readiness

Program: `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`. Throwaway admin: `Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM`. Cisco's latest read: **0 devnet SOL**. Key availability remains unverified. No faucet retry, Lab-wallet use, deploy, mint, publish, claim or duplicate-claim signature this session.

When funded, follow `2026-09-25-r6-anchor-built.md` § Devnet exactly (at least 2.6 devnet SOL; throwaway admin is upgrade authority), and record network/program identity and every transaction outcome.

**October 1:** `86ff258` still requires migration 0009 first. Committed main is still `1c7c2c6`; this **dirty working candidate additionally requires 0010**, including for ordinary ORM full-row reads. Do not deploy it against only 0009. Select and gate the exact candidate in the attended session.

Outstanding attended prerequisites: two independent mainnet hold RPCs/network proof, token re-rotation/webhook check, Vercel `HYPHAE_API_URL` and `DEFAULT_MINT`, Fly `PUBLIC_WEB_URL`, live API/worker/quiz/link checks, and Cisco's `first_paid_epoch` go/no-go before **2026-10-02T00:00Z**. Epoch 1 stays unpaid.

**October 6 is not ready/evidenced.** It still needs the current release gate/review, funded devnet proof and the approved/scheduled durable publication/claim extension.

## Next Actions

1. Finish the outstanding release checks and other-family review once authorized execution permits them. The implementation and 19 passing cases already exist; inspect the diff before changing it. Fix findings test-first.
2. Commit verified implementation and docs milestones to main when Git writes are available; push only after the local gate and required review. Refresh exact SHAs and branch status here.
3. Keep the devnet funding blocker separate and continue independent local work. No airdrop retry loop or Lab wallet.
4. Keep the extension parked pending decision 3 and October 3–6 unless explicitly pulled forward.
5. Maintain October 1 readiness for the exact selected candidate; no production/Neon/mainnet action inferred. Stop after the original step 5.

## Open Decisions

Still unresolved: **Q1 custody**, **Q3 reserve reuse**, **P8 fee public address**, and **decision 3 extension approval/window**. Recommendations remain in the earlier record: disclosed v1 publisher trust with hardware signing and just-in-time funding; allocated-total reservation with explicit retained accounting; a dedicated fee address; and the extension in October 3–6. These do not undo the existing local/devnet approval.

## Generated Artifacts and Suggested Skills

Canonical artifacts: local migration 0010/metadata, payout hash implementation/tests, `tests/run-payout-commitments.mjs`, this handoff, BUILDLOG and `docs/handoffs/2026-09-26-hash-backfill-built.md`. Temporary generation/review/execution files are in ignored `docs/plans/` and are not required for normal future test runs. No keys, credentials, deployments or jobs were generated.

Suggested skills: `handoff-memory`, `superpowers:test-driven-development`, `supabase:supabase-postgres-best-practices`, `context7-mcp`, `solana-dev`, `orca-cli` when its runtime is accessible, fresh other-family review, `superpowers:verification-before-completion`, `handoff`.

## Next-session Prompt

```text
Resume Hyphae autonomously. Read CLAUDE.md, AGENTS.md, docs/HANDOFF.md and docs/handoffs/2026-09-26-hash-backfill-built.md. HEAD is 1c7c2c6; the uncommitted working tree implements B3/B5/B6 and migration 0010. Do not rebuild it. Nineteen new cases pass; supplemental suites total 518 pass, one existing CLI subprocess failure and one devnet skip. Typechecks, Biome, Drizzle and Python vectors pass. Real-PG/Rust confirmation, other-family review and Git writes remain pending. Claude review failed ECONNREFUSED; supplemental Astra-configured review found no confirmed defects. git add was denied on .git/index.lock. Preserve the empty untracked wsl file.

Model: Fable 5.1 xhigh, or GPT-6 Astra xhigh in Codex, for reward/custody/recovery work; record actual model/effort.
Skills: handoff-memory, test-driven-development, postgres best practices, context7-mcp, solana-dev, verification-before-completion, handoff.

Continue the authorized arc from its existing implementation. Use cmd.exe for permitted native commands; do not reroute denied Docker/Orca/subprocess/Git operations. Finish the release gate and other-family review, fix findings test-first, commit milestones on main and push only when permitted and verified. Do not turn Cisco into a manual command runner. Devnet admin was 0 SOL; no faucet loops or Lab wallet. The durable manifest/operator/claim/P14 extension awaits decision 3 and October 3–6 unless explicitly pulled forward. Q1/Q3/P8 stay unresolved. Candidate 86ff258 requires 0009; this dirty candidate also requires 0010 and its own validation. No Neon apply, production deploy, mainnet transaction or vault/sibling writes. Stop after the original step 5.
```
