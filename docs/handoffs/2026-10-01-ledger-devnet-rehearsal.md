---
date: 2026-10-01
summary: The Ledger devnet rehearsal passed, a day ahead of the Oct 2 gate (Cisco chose to start early; it touches no production). The verifiable build at b3c82c7 reproduced the recorded hashes, a hot key wrote the buffer and handed it to the Ledger address, and the Ledger signed one deploy of a throwaway devnet program through the Windows Solana CLI 3.1.10 (`usb://ledger?key=2/0`). Then one /claim from a real browser wallet (Phantom, devnet) paid 12,125,000 lamports against the real program id on devnet. The epoch 1 close proof and Runbook C C1 to C7 still wait for 2026-10-02T00:00Z. No production, Neon, Fly, Vercel or mainnet action.
---

# 2026-10-01 — Ledger devnet rehearsal and browser claim

Authority: Cisco's rulings of 2026-09-28 (a Ledger-signed devnet deploy and one browser `/claim` before mainnet) and 2026-09-29 (C1–C13 on Oct 2–3 after the rehearsal). Cisco was present and started early; nothing here depends on epoch 1 closing. Order change recorded: the runbook lists the epoch 1 close proof before the rehearsal, but the rehearsal is devnet-only, so it was run first. The close proof still runs before C3.

## Ledger deploy (devnet, throwaway program)

| Check | Result |
|---|---|
| Ledger address read (no signing) | `solana-keygen pubkey usb://ledger?key=2/0` → `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR` |
| Windows CLI | `solana-cli 3.1.10 (src:7bc9c805)`, archive sha256 `84abbbf2…c06b`, program keypair → `EAz8WkyU…d6E` |
| Verifiable build (WSL, fresh clone at `b3c82c7`, `anchor build --verifiable --ignore-keys`) | `hyphae.so` sha256 `cb4ffdd8…8d79`, 229,432 bytes, `solana-verify` hash `7e902d1b…43ac` (both as recorded) |
| Buffer `CGczVmUERhi8yAKSQMZKsyvfyyAm9z62wqRCo5kbik5k` | Written by the hot key `Fcv1xt…`, authority set to `2kz1Zq…`; devnet reads authority `2kz1Zq…`, length 229,432, hash `7e902d1b…43ac` **before** the Ledger signed |
| Buffer key | Deleted after those reads (C11) |
| Deploy, 1 Ledger approval (blind) | Program `GWBJHTQMvxjoUeh1WcfPWpyX7HxoKk3rMvJpBF6dpcTY` (throwaway), signature `2wBkWB9a2w4MbapCAiM6xugPZsaQa4ZGwWSy4wLQ6WGv8xMX5NvWwaqTSJqjBsi1yQ4VBPTEzC5i8AMJ762bETV3` |
| Chain readback | Authority `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`, ProgramData `6NR7Kwhj9wcdmDrP9poGZFcDZcgePiCnVoiRr4dQJFWA`, length 229,432, hash `7e902d1b…43ac`, buffer `AccountNotFound` |

Hot key `Fcv1xt…` is the shared devnet admin used by the earlier runs, so it was **not** swept or deleted; it holds about 0.8 devnet SOL. On mainnet C13 closes the hot key. The throwaway program `GWBJ…` stays open on devnet (closing it with the Ledger would return 1.1663934 devnet SOL and rehearse C11's rollback; not done).

## Browser claim (devnet, real program id)

The `/claim` page refuses any program but `EAz8…`, so the throwaway program cannot serve it; the claim ran against the existing devnet `EAz8…` deployment.

- Stack: the repo's devnet harness (`publish.devnet.test.ts`, scratch variant that stops after the publish; **not committed**, it lives in a worktree that was removed), a local Postgres 17 in Docker, the API (`LINK_CHAIN=solana:devnet`, `READ_RPC_URL` devnet) and the site on localhost, at `main` `153f9d3` (API tree = `b3c82c7`).
- Community `FEZVaW6hQ9q7ZYLe6UA8hi3Wd4AJDdw98zPLEf3HkPHZ` (mint `8qrC4kBs…`, admin `Fcv1xt…`, fee recipient `AZo8Krx…`), vault `G6E2XtUaba18JA1e7Fj6MMZA6AQj3y8zS731bWsUpaoM`.
- Publish `4Z1EhogyymZSwXmeYNPSE3Gd7cZyWx9xGJHTfB3BTeHeNnqaS7NFftqhfAUEGV2jpCWWgLngmUorm5dWtuYN6oxc`, root `5667feee…cd69`, audit hash `900a0fdf…c7b7`. Claimant funded 0.01 SOL: `4sYJvjcW…Vfhxq`.
- Claim from Phantom (testnet mode, Solana Devnet): `4eqG2A4XuZpRZRePiMDTEotaTyJKDjhUDguwbwgCGz75mQin6PssycnqsF5gyidec9KCeBD4BVxTERQ7e5zY7Mn6`, finalized, no error, 12,125,000 lamports.
- Read back: the receipt account `GLALvW…j7r9` exists, owned by the program; the vault went from 50,695,960 to 37,070,960 lamports (the 1,500,000 fee at 300 bps plus the claim); the API reads the wallet `paid` with that signature and the other two members `claimable`; claimed 12,125,000, unclaimed 18,335,365.

## Not done yet

- The epoch 1 close proof (epoch 1 closes at 2026-10-02T00:00Z; at 18:05Z the API read it `open`, current epoch 1).
- Runbook C C1–C13 on `b3c82c7`. Runbook C's Windows CLI check (C8) is already satisfied for the CLI version and key reads; it reruns on the day.
- Closing the throwaway `GWBJ…` with the Ledger (optional).
