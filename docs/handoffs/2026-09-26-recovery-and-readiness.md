---
date: 2026-09-26
summary: Recovery arc incomplete. Initial agent process startup failed; guided checks in Cisco's terminal later confirmed fetch/status/worktree, 0 devnet SOL, 500 passing baseline tests, passing typecheck and tracked-file lint (194 files). No hash migration, devnet proof, new commit or push. Remaining gates and review are pending.
---

# September 26 — recovery and deployment readiness

**Historical checkpoint:** the later implementation is recorded in [2026-09-26-hash-backfill-built.md](2026-09-26-hash-backfill-built.md). B3/B5/B6 and migration 0010 now exist locally; descriptions below of unbuilt hash work describe the earlier phase, not the current working tree. Use `docs/HANDOFF.md` for the live state.

## TL;DR

**Docs-only local checkpoint; the requested implementation arc is incomplete.** Agent command execution failed, but Cisco's terminal subsequently completed the baseline checks listed below. The throwaway devnet run and local B3/B5/B6 hashes/backfill are already authorized. Durable publication/operator/claim work still needs decision 3 and the October 3–6 window.

## Runner, Git and scope

- Actual exposed runner: **Codex, GPT-6**. Exact variant/effort unavailable in this session; do not label it Astra/xhigh just because that was requested. No Fable run or other-family reviewer ran.
- Historical September 25 reviews used **Luna (`gpt-6-luna`), xhigh**, not Astra. Their approvals cover the recorded historical ranges, not unfinished work here.
- Arc start: `1c7c2c6692e8fdfc74fe6adedc978fbbbd195d93`. Direct local reads of HEAD, main and cached origin/main agree. A fresh GitHub branch GET also returned that SHA: [commit](https://github.com/FCisco95/hyphae/commit/1c7c2c6692e8fdfc74fe6adedc978fbbbd195d93).
- Agent fetch/status/worktree attempts failed before execution. Cisco later ran `git fetch --no-prune origin` successfully (exit 0); status showed only the three docs changes; `git worktree list` showed one worktree on main at `1c7c2c6`. No fast-forward, checkout, branch creation, prune, commit or push occurred.
- Before refreshing docs, fetched their base contents at the exact SHA. The local BUILDLOG matched; HANDOFF matched except for exactly the two approval-patch lines applied by this session.
- Only `docs/HANDOFF.md`, this record and `docs/BUILDLOG.md` were edited. No code, schema, vault, sibling, credential or production changes.

## Arc outcomes

| Step | Outcome |
|---|---|
| 1 — authorization correction | **Applied locally and content-verified.** Prepared patch matched both original stop lines. Used equivalent `apply_patch` edits because Git could not start; `git apply --check` was not available. Canonical handoff now explicitly preserves devnet approval and separate production approval. |
| 2 — devnet proof | **Blocked, not run.** WSL balance/key-availability command could not start. Helius read returned `MCP tool call requires approval, but approval policy is never`. Cisco's subsequent WSL check returned **0 SOL**; devnet is parked on insufficient funds. Key availability remains unverified. No airdrop retries or Lab-wallet use. |
| 3 — hashes/backfill | **Already approved, implementation blocked.** Existing commitments/publication/schema and migration journal inspected. Hashes remain recomputed, without B3/B5/B6 stored columns/backfill or selected snapshot hashes. Agent test-first execution could not start. Cisco later ran the unchanged baseline successfully; implementation and its new regression tests are still absent. No migration or runtime code was changed. |
| 4 — durable publication/claim extension | **Parked.** No September 26 decision 3 approval or pull-forward supplied. October 3–6 remains the proposed window. No extension implementation note or code was produced. |
| 5 — attended deployment preparation | **Static prerequisites refreshed; live readiness unverified.** Candidate `86ff258` needs 0009 first. Current main is separate and needs a fresh gate. No production action taken. |

## Devnet identity and evidence

Intended network is **Solana devnet**. The program id matches in local `Anchor.toml` and `programs/hyphae/src/lib.rs`: `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`.

Throwaway admin `Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM`; claimant `3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk`; fee recipient `AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR`. Key contents were not read or displayed. Key availability is unverified.

**Signatures: none this session.** Deployment, mint creation, vault funding, publish, claim and on-chain duplicate refusal were not executed. No devnet success claim or whitepaper evidence upgrade is justified. Follow the exact procedure in `2026-09-25-r6-anchor-built.md` once keys and at least 2.6 devnet SOL are confirmed.

## Local hash work and downstream interfaces

The inspected journal ends at `0009_payout_gates`; previous records reserve 0010. Directory enumeration was also unavailable, so inspect both migration files and metadata before choosing the next number.

Resume tests for reproducible old-row backfill, config/evidence hashes, predecessor order, every decision revision, selected snapshot hashes, idempotent reruns, mismatch refusal and refusal before sending when a required stored hash is null. Keep the existing roots, internal config digest, legacy evidence-hash meaning and 89-byte leaf unchanged.

Contract-defined pending/excluded entries have no selected decision and retain a reason plus null decision hash. That differs from a selected decision whose required hash has not been stored: the latter must block publication. Do not erase pending entries from the audit or invent a decision to fill a hash.

Current interfaces remain unchanged: `epochCommitments` computes from rows; `buildPublication` consumes the ready gate snapshot; `publishEpoch` uses the chain's fee recipient, sends, then stores leaves/root. Recovery currently recomputes instead of loading immutable intent. New additive API hash fields and shared capture-time parsing must be coordinated with the public read surface; do not silently write outside the session's allowed paths.

For the parked extension, the user's required boundary remains exact manifest bytes persisted before send, retries from those bytes, a custody-compatible signer without hardware-key export, wallet claim/P14 display and crash/mismatch/wrong-wallet/epoch/payment-evidence tests. A root or DB signature string alone is not payment evidence.

## October 1 and October 6

- Last recorded production: Fly `b7bfe55`, Neon 0000–0008. Neither was queried live today.
- Keep `86ff258` as the attended October 1 candidate with 0009 first. Its old test receipt is not a fresh gate. If selecting main, verify the exact SHA, all migrations and prerequisite changes. Never apply a later checkout's pending migrations implicitly.
- Outstanding: two independent mainnet hold RPC configurations and network checks; bot token re-rotation and webhook verification; Vercel audit-site setup (`HYPHAE_API_URL`, `DEFAULT_MINT`); Fly `PUBLIC_WEB_URL`; live API/worker/quiz/link verification.
- `first_paid_epoch` remains a separate October 1 go/no-go action. Epoch 1 stays unpaid; the gates must be live before **2026-10-02T00:00Z**.
- October 6 is **not ready/evidenced**: funded devnet proof, local hash work, extension approval/build, complete local gate and other-family review remain. Q1 custody, Q3 reserves and P8 remain unresolved before mainnet. No mainnet authorization is implied.

## Validation and review receipt

Initial **agent** attempts below did not run; these are process failures, not failed assertions:

| Attempt | Observed result |
|---|---|
| Git fetch/status/worktree commands | Windows process startup denied |
| `pnpm -r test` | Windows process startup denied |
| Typecheck, `pnpm lint`, Drizzle check, `test:pg`, diff check gate attempt | Windows process startup denied; no constituent command ran |
| WSL Anchor build, Rust tests and Python vectors attempt | Windows process startup denied; no constituent command ran |
| Devnet balance and key availability via WSL | Windows process startup denied |
| Helius balance read | Approval required; session policy is never |

Common startup error: `CreateProcessAsUserW failed: 5 (Access is denied.)`. Retrying with an explicit shell did not restore execution. No permission change or bypass attempted.

**Guided continuation, evidence pasted by Cisco:** fetch without pruning exit 0; one main worktree at `1c7c2c6`; admin balance **0 SOL**; `pnpm -r test` **500 passed + 1 skipped devnet test** (89 core, 14 web, 397 API); typecheck passed all four packages. `pnpm lint` checked 196 files and failed on the known local settings formatting issue. The corrected tracked-file Biome check passed **194 files**, no fixes applied. No lint exclusions added.

The agent's first PowerShell command incorrectly passed the entire filename list as one argument (zero files checked). Corrected with `$lintFiles = @(git ls-files -- '*.ts' '*.tsx' '*.json' '*.js' '*.css')` followed by `pnpm exec biome check @lintFiles`.

These checks cover unchanged baseline code. Cisco subsequently confirmed Drizzle check, **17/17 PostgreSQL tests** via explicit Git Bash, and **Anchor build exit 0**. The separate Rust command was interrupted with an unmatched quote; no Rust result was received. The agent later ran Python vectors (**16 reproduced hashes**) and `git diff --check` successfully through `cmd.exe`. Hash/backfill implementation and its tests remain unbuilt.

Historical validation on `61876cd`: 500 TypeScript tests and one skipped devnet harness; PostgreSQL 17/17; Rust 21 + 6; Python 16 reproduced hashes. See `2026-09-25-simplify-pass.md`. **The guided baseline test results above are current; there is no complete gate or fresh review verdict.**

## Commits, blockers and decisions

**New commits: none. Pending new commit IDs: none.** The three documentation changes remain uncommitted and unpushed. Agent Git execution failed; Cisco's terminal works, but the full gate and implementation remain incomplete. Do not create commits through the GitHub API to bypass local hooks/gates. After restoring execution, inspect status and other worktrees, verify these docs, commit the milestone and continue the authorized arc.

Open questions, once, with recommendations:

1. Decision 3: approve durable publication, operator signer, wallet claim and P14 for October 3–6? **Recommend yes, same window**, so recovery and payment evidence are complete before mainnet.
2. Q1 custody: accept explicitly disclosed v1 publisher trust, hardware-held signing and just-in-time single-epoch funding? **Recommend yes under those limits**; no key export and no claim that the publisher cannot choose a malicious root.
3. Q3 reserves: approve allocated-total reservation with explicit cap/dust reuse and separate retained accounting? **Recommend yes**; unclaimed allocations stay reserved.
4. P8: provide the dedicated fee public address by October 1. **Recommend an address separate from Lab funding.**

Cisco subsequently requested autonomous execution using Orca/PowerShell and said he should not have to run manual commands. That supersedes the step-by-step guidance preference. Devnet and local hashes do not need another scope approval.

The agent investigated: the default Windows Store PowerShell launcher fails at startup; selecting `C:\\Windows\\System32\\cmd.exe` with `login: false` restored Git, Node and Python commands. Direct Vitest execution then failed in esbuild's child-process launch with `spawn EPERM`. Orca's version-matched CLI guide loaded, but `orca terminal list --json` returned `runtime_access_denied`, stating that sandbox/OS permissions block the connection. Orca was not restarted and no denied operation was rerouted. The session's enforced approval policy is still `never`; changing conversational consent does not change those host settings. Next: host-authorized permission adjustment, one direct execution check, then autonomous implementation.

Fresh Git status still shows the three docs edits and also an untracked zero-byte `wsl` file. Its origin was not established; it was preserved and must stay out of commits.

## Generated artifacts this session

| Artifact | Location | Status |
|---|---|---|
| Current handoff | `docs/HANDOFF.md` | Updated locally |
| This checkpoint | `docs/handoffs/2026-09-26-recovery-and-readiness.md` | New locally |
| Public build-log entry | `docs/BUILDLOG.md` | Updated locally |

No keys, credentials, deployments or scheduled jobs created.

## Suggested skills

`handoff-memory`, `solana-dev`, `superpowers:executing-plans`, `superpowers:test-driven-development`, `supabase:supabase-postgres-best-practices`, `context7-mcp`, fresh other-family review, `superpowers:verification-before-completion`, `handoff`.

## Next-session prompt

```text
Resume Hyphae's September 26 recovery arc with working local command execution. Read CLAUDE.md, AGENTS.md, docs/HANDOFF.md and docs/handoffs/2026-09-26-recovery-and-readiness.md. main was verified at 1c7c2c6692e8fdfc74fe6adedc978fbbbd195d93; three docs edits remain uncommitted, with no new code, migration or devnet transaction. Cisco's terminal subsequently confirmed fetch/status/worktree, 0 devnet SOL, 500 passing baseline tests, passing typecheck and tracked-file lint (194 files); Drizzle, Postgres 17/17 and Anchor build exit 0 also passed in Cisco's terminal; the agent reproduced 16 Python hashes and passed diff check via cmd.exe. Separate Rust tests, implementation and review remain pending. Cisco now wants autonomous execution; test child processes and Orca access remain blocked by host permissions.

Model: Fable 5.1 xhigh, or GPT-6 Astra xhigh in Codex, for reward/custody/recovery invariants; record actual model/effort.
Skills: handoff-memory, solana-dev, executing-plans, test-driven-development, postgres best practices, context7-mcp, verification-before-completion, handoff.

Fetch origin without pruning, inspect status/worktrees, fast-forward only. Verify and preserve the docs edits. Recover the pre-approved throwaway-key devnet proof if funded, otherwise record one blocker and implement already-approved local B3/B5/B6 hash columns/backfill test-first. No Lab wallet or faucet retry loop. Keep the durable publication/operator/claim/P14 extension parked until decision 3 and October 3–6 unless explicitly pulled forward. Run the full local gate and fresh other-family review before risky pushes. Prepare the attended October 1 deployment (86ff258 plus 0009; reverify any later candidate), leave Q1/Q3/P8 unresolved until answered, update engineering docs and stop after the original step 5. No vault/sibling writes, Neon apply, production deploy or mainnet transaction.
```
