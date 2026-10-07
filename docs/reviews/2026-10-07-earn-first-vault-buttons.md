---
date: 2026-10-07
summary: Independent Codex review of 1268d34..a25eec3 (one-tap X buttons, vault section, earn before linking with migration 0015): NEEDS-FIXES with two medium authorization findings, fixed test-first in 94ce60e and accepted on a fix check. Payout, concurrency, vault and URL handling found clean.
---

# Earn first, vault section and X buttons: Codex review

Reviewer: Codex `gpt-6-astra`, reasoning effort xhigh, read-only sandbox, ephemeral session; another model family than the builder (Claude Opus 5.5). Scope: exactly `git diff 1268d34..a25eec3`: `4457da6` one-tap Reply/Quote on X, `9b75532` vault section in the community read API and the web "Fund this community" panel, `a25eec3` earn before linking a wallet with migration `0015`.

## First pass: NEEDS-FIXES (two medium)

| # | Finding | Fix |
|---|---|---|
| 1 | Group `/submit` and `/effort` treated sending a message in the group as membership. A Telegram discussion group can let people comment without joining, so an outsider could get a wallet-less member row and points. Codex reproduced it with membership status `left`. | `94ce60e`: `communityAndMember` asks Telegram (`getChatMember` + `isMemberStatus`) every time and fails closed when Telegram cannot answer. Tests: a non-member and a failed lookup get no member row; a group member gets one with no wallet. Mutation probe: removing the check fails 2 tests. |
| 2 | The rules test returned an existing member row without checking membership, so a wallet-less user who started the test and then left could still record a pass. | `94ce60e`: the rules test checks membership on start and again right before recording the pass. Test: someone who leaves after starting records nothing. |

**Clean in the first pass:**
- **Payout:** eligibility still comes from the signature link valid at the close. Codex probed a wallet-less member with positive points: payable allocations were unchanged, with no extra leaf or hold check and null-safe reads.
- **Concurrency:** READ COMMITTED re-reads are correct, wallet uniqueness still holds, and no new wrong `wallet_taken` mapping exists.
- **Vault:** the owner, discriminator, mint and admin-derived address checks fail closed. The deadline, the 15 s cache and loose SDK compatibility are consistent.
- **X intent URLs:** encoded correctly.

**Migration advice recorded for the release:**
- Safe order: migration `0015`, then the API, then the worker. Existing paste and signature rows satisfy the new check, and the old image keeps working (its inserts keep `linked_at`'s default).
- `ALTER TABLE ... ADD CONSTRAINT` takes an ACCESS EXCLUSIVE lock and scans `members`, so run it with a bounded lock timeout.
- Once wallet-less rows exist, rolling the API back to the old image is unsafe: its `/me` calls `.slice()` on a null wallet.

## Fix check on `94ce60e`: ACCEPT

Codex's verdict: "ACCEPT".

## Verification by the builder

- Native gate on `94ce60e`: `pnpm test` 0 (core 110, read-client 26, web 119, API 845 passed / 3 skipped), `pnpm typecheck` 0, `pnpm lint` 0.
- `drizzle-kit check`: fine. `test:pg` (Docker Postgres 17): 71 passed.
- One real-Postgres race test: a wallet link racing a first submission links the same member. Removing the `on conflict` handling makes it fail.
