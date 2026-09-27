---
date: 2026-09-27
summary: The Sep 27 afternoon arc. The devnet proof ran, the Oct 1 candidate re-gated clean, and the program review (Codex gpt-6-astra, three rounds) found no fund-loss path. All five of its client findings are fixed or accepted as scoped. CI is green. The API gained a wallet-claims route, rate limits, OpenAPI and /docs. The pages work on a phone. The custody policy is public, and the Ledger transport works. Pushed; nothing deployed.
---

# 2026-09-27 afternoon — proof, security, CI, API, polish, Ledger

## Runner, reviewers, authority

- **Runner:** Claude Code, **Opus 5.5 (`claude-opus-5-5`)**, xhigh. Git, Docker (Postgres 17), WSL and Playwright all worked.
- **Reviewers:** Codex CLI 0.157.1, **`gpt-6-astra`, xhigh**, read-only, ephemeral. Each round was a fresh session; each log header confirms model, effort and sandbox.

  | Round | Scope | Verdict |
  |---|---|---|
  | Step 3, program security, round 1 | `3237aac`, against the solana-dev checklist | NEEDS-ATTENTION: 2 medium, 3 low |
  | Step 3, round 2 | the five fixes | NEEDS-ATTENTION: F2, F4 and F5 partial |
  | Step 3, round 3 | the round-2 fixes | NEEDS-ATTENTION: one F2 gap (untimed history), fixed in `a9d6a5a` |
  | Step 8, round 1 | steps 5–6 | NEEDS-ATTENTION: 3 medium, 2 low |
  | Step 8, round 2 | the step-8 fixes, step 7 and `a9d6a5a`, at `34c14dd` | NEEDS-ATTENTION: 1 medium (the web's page reads shared one "web" rate-limit window), 1 low (the Ledger runbook said a timeout lands nothing); fixed in `2ac312d` and `5daeb9b` |
  | Step 8, round 3 | `34c14dd..5daeb9b` | **APPROVE**: no new medium or higher. Caveat: off Vercel, the ingress must overwrite `x-real-ip` |

- **Authority:**
  - The session prompt's pre-approvals: local/devnet R6 + Anchor, including the throwaway-key deploy; plan Week 3 item 9; Week 4 items 1, 2, 4 and 5.
  - Decisions 2 and 3, answered in-session (`2026-09-27-custody-wording-and-ledger-rulings.md`).

## Per step

| Step | Result | Commits |
|---|---|---|
| 1. Devnet | Admin held **5 SOL** at 13:48:58Z.<br>• The program is deployed on devnet (`2qbf2Lvk…`).<br>• Run 2 passed end to end: publish, claim, duplicate refused on-chain, P14 read.<br>• Runs 3–5 re-ran it after the fixes.<br>• P14 was read from devnet on the final build. | `3237aac`, `d28b080`; record `2026-09-27-devnet-proof.md` |
| 2. Oct 1 rehearsal | `86ff258` in a temporary worktree:<br>• `pnpm -r test` 453;<br>• typecheck 0; Biome on 179 tracked files, clean;<br>• `drizzle-kit check` pass; `test:pg` 15/15; `git diff --check` clean.<br>Worktree removed. **No checklist change needed.** | none |
| 3. Program security review | No unauthorized withdrawal, forged-proof payout or double claim.<br>• F1 prefunded PDAs: fixed.<br>• F2 creation lookup: recovery exhaustive; cold public reads bounded, accepted.<br>• F3 publication time: fixed.<br>• F4 claim recovery: fixed.<br>• F5 simulate before signing: operator path fixed; browser deferral accepted.<br>• Upgrade authority: POLICY, answered through decision 2's wording. | `eaa8f1a`, `2245575`, `ca94737`, `d34065b`, `881e7c5`, `12933e2`, `0086b40`, `a9d6a5a` |
| 4. CI | `CI` on every push, with the gate, Postgres 17 and the Python vectors. `Program` weekly and on dispatch.<br>First run on main: **green** (`36324993213`). The first Program dispatch failed (the keypair is not in the repo); fixed with `--ignore-keys`. | `894b7b1`, `68db100` |
| 5. API finishing | `GET /v1/wallets/:wallet/claims`; RateLimit headers and 429; OpenAPI 3.1 at `/v1/openapi.json`; Scalar at `/docs` (pinned, SRI).<br>README: status, "Integrate in 10 lines", vault derivation. Every code block was run against a local API serving a devnet publication. | `d712289`, `135a80f`, `1d56e5d` |
| 6. Polish | Stacked tables under 640px. No-wallet and unavailable states say what to do.<br>Screenshots at 390 and 1180 in `docs/screenshots/`. Whitepaper overclaim narrowed.<br>Decision 2: the custody policy is on `/rules`, the epoch page and the README. | `236905e`, `ffdfac0`, `f3f3981`, `affb78d`, `37d09cc` |
| 7. Ledger | Decision 3: node-hid alone allowlisted, and the prebuilt binary loads.<br>`Transport.create()` of the no-events transport always throws, so the transport uses `open("")`. The fake-device tests pass. Real-device devnet steps are written for Cisco. | `34c14dd`; `2026-09-27-ledger-transport.md` |
| 8. Review, fixes | Step-8 findings fixed test-first:<br>• per-visitor limits behind the web token;<br>• no chain read past the deadline;<br>• 0012 `leaves_wallet` index;<br>• README paging; whitepaper status. | `a40f575`, `2c689aa`, `6e48b12`, `affb78d`, `37d09cc`, `c87fb1f` |

## Security review findings and outcomes

| # | Severity | Finding | Outcome |
|---|---|---|---|
| F1 | Medium | Lamports sent to a future epoch or receipt PDA made both readers refuse it. That blocked publishing, and turned a claimable leaf unavailable. | `programAccount()` reads an empty, System-owned, non-executable account as not created. LiteSVM shows the program's `init` handles prefunding. **Resolved.** |
| F2 | Medium | References to a PDA could crowd the creating transaction out of the lookup's bounds. | Publish recovery reads the epoch account's second and searches the whole history, every successful transaction, that second first. **Resolved for recovery.** Cold public P14 reads stay bounded and show `chain_transaction_missing`, honestly; accepted as scoped in round 3. |
| F3 | Low | `published_at` came from the DB, which a recovery could record later. | Taken from the epoch account. **Resolved.** |
| F4 | Low | A dropped send left the claim page stuck; a failed read hid its recovery. | `unresolved` state, "Check again", `afterSendRead()`. **Resolved.** |
| F5 | Low | No simulation before signing. | Operator path: `signSimulated()` simulates the exact message and accepts only partial signers. **Resolved.** Browser: accepted pilot deferral; the wallet comment no longer claims wallets simulate. |
| Posture | Info/POLICY | The upgrade authority can replace the program; no verifiable build yet; the program keypair lives only in `target/deploy`; the README overclaimed. | The upgrade key is disclosed in the approved policy. README and whitepaper corrected. Verifiable build and keypair backup are questions below. |

Step-8 round 1 and its outcomes:

| # | Severity | Finding | Outcome |
|---|---|---|---|
| 1 | Medium | Vercel visitors share the api's per-IP budget. | `READ_API_WEB_TOKEN` (api) = `HYPHAE_API_TOKEN` (web). With the token, the api trusts the visitor address the web names (Vercel's `x-real-ip`) and limits it per visitor. The web's cached page reads get 10×. |
| 2 | Medium | Past the deadline, the wallet list still started chain reads, up to 100 at once. | No read starts past the deadline. |
| 3 | Medium | The wallet filter scanned `leaves`. | Migration 0012 `leaves_wallet`, checked on Postgres 17. |
| 4 | Low | The README example showed only the first page. | It reads 100 and explains paging. |
| 5 | Low | The whitepaper contradicted the devnet proof. | Status rows and limits updated. |

## Validation (final)

Final gate on `5963852`. That commit only gives one seed-heavy test a 30 s budget: seeding twelve epochs took 2.2 s alone and passed 5 s under the full parallel run. No code changed after `5daeb9b`.

- `pnpm test`: **654 passed** (core 106, web 45, api 503) + 1 skipped devnet harness.
- `test:pg` on Docker Postgres 17: **42/42**.
- Typecheck 0 · `pnpm lint` 0 (234 files) · `drizzle-kit check` pass · `next build` pass · `git diff --check` clean.
- Python vectors: 16 hashes reproduced.
- Rust, unchanged since its run this session: WSL `anchor build` 0 with the same `.so` sha256 (`cb4ffdd8…8d79`), `cargo fmt --check` clean, `cargo test -p hyphae --tests` **24 + 6**.
- CI for this push: still running when this record was committed; its run id follows in the next commit.

## Parked, and why

- **The Ledger real-device run.** It needs Cisco's hands on the device. The steps are in `2026-09-27-ledger-transport.md`.
- **Cold P14 payment evidence past 10,000 newer references.** It needs a worker job that pins verified signatures, plus a schema change. Accepted as scoped; after the hackathon.
- **Browser pre-sign simulation.** No RPC in the page by design. Accepted as a low-severity pilot deferral.
- **`.env.example`** lacks `READ_RPC_URL`, `READ_API_WEB_TOKEN` and the hold RPC variables. The root file was outside this arc's writable paths.
- **A load-sensitive race test.** `test:pg`'s 50-round completion-vs-close test timed out once under heavy load, then passed in 24 s.
