# Community setup review disposition

Original fresh other-family verdict: [Opus review](2026-10-03-community-setup-opus-review.md), range `8f395b4..2ca3505`. Actual `claude-opus-5-5`, requested high (named effort unconfirmed), read-only, no reviewer test execution. APPROVE for local/disposable use, with F1/F2 required before production apply.

| Finding | Disposition |
|---|---|
| F1: standard/driver URL parsing and ambient port differ | Reproduced by a failing regression for missing port; added independent comma/multiple-user-info refusal coverage. Require explicit port, reject ambiguous authority and pin reviewed fields as explicit postgres-js options through an optional `createDb` target. Existing callers retain their options. |
| F2: absent TLS or unverified certificates on remote production | Reproduced by a failing regression. Require `sslmode=verify-full` for non-loopback production and pin verified TLS in driver options. Test absent/require refusal and verify-full acceptance. |
| F3: later mutable identity/configuration or Telegram outage blocks automatic read-back | Accepted fail-closed operational limit, now explicit in the integration guide. No replay may replace or rebind a community. Authorized read-only diagnosis remains necessary after legitimate drift or unavailable Telegram preflight. |
| F4: `.env.example` supposedly absent | File-discovery limitation, not actual absence: `.env.example` is tracked in the reviewed base and exists in the checkout. Parent gate identified its missing new variable, added an empty commented entry and proved the environment test 2/2. The reviewer had Read/Glob/Grep only; no claim that they read the hidden file. |

Other gate repair: give the Solana address refinement an explicit boolean return and the private-file reader an explicit manifest return type; avoid inferred declaration references into `.pnpm` internals. Runtime validation behavior is unchanged.

RED receipt: focused CLI suite had **2 failed/12 passed** before F1/F2 repairs. GREEN after repairs: CLI **16/16**, environment **2/2**. Final repository/DB gate and a fresh final-range fix check follow; original review is not claimed as clearance for changed code.
