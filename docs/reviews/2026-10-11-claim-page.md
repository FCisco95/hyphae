# Claim-page review — October 11, 2026

- Builder: Codex (GPT-6 session; runtime effort is not exposed).
- Fresh other-family reviewer: Claude Opus 5.5 (Anthropic `claude-opus-5-5`), high effort, restricted read-only CLI sessions.
- Final accepted source: `472f5ecb6fc7f5b129d674ecb75b66ad721c2322..cc4f773` (claim component, wallet integration, CSS and tests).
- Verdict: **ACCEPT**, no blocking correctness, privacy, funds-safety or security finding.
- One picker; full connected address; 60-second wallet deadline; 10-second read deadline; cancellation acknowledgment and fresh payment read before retry.
- Stale results fenced on disconnect, account/epoch changes and unmount. Double activation opens one request. Polling stops after disconnect.
- A late signature can resume receipt polling for the same wallet when no newer claim is active. A confirmed paid read cannot regress if a late signature arrives or later reads fail.
- Transaction builder/proof/account derivation unchanged. A signature alone never produces Paid.
- Earlier accepted passes identified small issues; fixes in 9b9d0ba and cc4f773. The paid regression was reproduced by a failing mounted test before the fix.
- Verification: 12 mounted UI, 8 transaction, 7 claim-view tests passed; web typecheck and changed-file Biome passed. Fresh browser at 390 px confirmed native picker Close returns focus to Connect wallet.
- Real mainnet paid-state preview used a read-only simulated wallet; signing was disabled. No transaction was submitted.
- Known nonblocking bound: a user who says they cancelled but then approves the old request while a newer request is active can cause a second failed transaction fee. The warning explicitly requires cancellation; the program refuses duplicate payment.
- Reviewer inspected source/tests and did not run these checks. This record does not authorize production.
