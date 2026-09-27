---
date: 2026-09-27
summary: Session-end snapshot of Sep 27's evening. Cisco settled every pre-mainnet key question. MYCEL Treasury, a 2-of-3 Squads multisig, was created on mainnet, and its vault is MYCEL's fee address. Hyphae's admin and upgrade key is a dedicated Ledger account, 2kz1Zq…, and his Ledger signed two full devnet runs. The publish script now requires a named Ledger account, approved by Codex on the second round. Main 333e2ce is pushed with CI green; nothing is deployed.
---

# 2026-09-27 evening — keys, MYCEL Treasury, Ledger on devnet

**Runner:** Claude Code, Opus 5.5 (`claude-opus-5-5`), xhigh. **Reviewer:** Codex CLI, `gpt-6-astra`, xhigh, read-only, a fresh session each round.

## What happened, in order

| # | Step | Result | Record / commits |
|---|---|---|---|
| 1 | Finished the afternoon arc | Gate, docs, push. CI `36332044728`, `36333058725` and Program `36332048980` green. A seed-heavy test got a 30 s budget (`5963852`). | `c2a72d4`, `87ceae2`; `2026-09-27-afternoon-arc.md` |
| 2 | Key rulings | Upgrade key = Cisco's Ledger only. Verifiable build before mainnet. Program keypair backed up offline. Organic reads `settlement.*`. | `1a6752d`; `2026-09-27-keys-and-fee-rulings.md` |
| 3 | MYCEL Treasury | Squads v4 multisig `34wSn…`: 2-of-3, the same three members as Organic's platform multisig, created 18:17Z by Cisco's Ledger. Fee address = its vault `rRce…u7MK`, checked against the chain, Squads' `isSquad` and the Squads app. | `ae475bf`, `54a5b26`, `e2ff6d2`, `6fd2a8b` |
| 4 | Real Ledger on devnet | Run 6 used `44'/501'/0'`; run 7 used `44'/501'/2'/0'`, Hyphae's admin. Each: 4 device approvals, claim paid, duplicate refused on-chain, P14 `paid`. | `82e25ca`, `333e2ce`; `2026-09-27-devnet-proof.md` |
| 5 | Dedicated admin account | Ruled: `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`, with no mainnet history. The code's old fallback `44'/501'/0'` is an account already in use on Cisco's device. | `ae90dad` |
| 6 | Signer change | `--signer ledger:<path>` is required. The path must be hardened `44'/501'/a'[/c']` with each index ≤ 2^31 − 1. Every hint names the path. | `f3589b2`, `4f28ad4`, `e37bc32` |

## Review verdicts (signer change)

| Round | Scope | Verdict |
|---|---|---|
| 1 | `82e25ca..b34c08b` | NEEDS-ATTENTION: 2 low findings (nine-digit index limit; bare `--signer ledger` in four places). Fixed test-first in `4f28ad4`, `e37bc32`. |
| 2 | `ae90dad..e37bc32` | **APPROVE**: no findings; 352 parser cases; no bare `--signer ledger` left. |

## Validation

- `pnpm test` 663 + 1 skipped; typecheck 0; lint 0; `git diff --check` clean. One commit (`4f28ad4`) landed before lint passed; `e37bc32` fixed it before any push.
- CI on `333e2ce`: green (`36343073180`).
- `test:pg`, `drizzle-kit check`, `next build` and Rust were not rerun, because nothing they cover changed. Their last results are in `docs/HANDOFF.md`.

## Parked

- `.env.example` is missing `READ_RPC_URL`, `READ_API_WEB_TOKEN` and the two hold RPC URLs. It is next action 1.
- Cold P14 evidence past 10k references, and browser pre-sign simulation. Both are accepted as scoped (afternoon arc).
- Organic's per-community 2-of-3 treasuries: Organic-side design, recorded in the key rulings.

## Next

See `docs/HANDOFF.md`, Next Actions and the Next-session prompt.
