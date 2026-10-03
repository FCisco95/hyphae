Fresh independent final fix check and complete setup-arc acceptance.
Immutable range: 072e99ba7918ed30c36bacd5c6cbb66255ec55b5..cd4c4ef8a3ed4b47669ecd2dd0c4cd73ed9b437f. Read-only: Read/Glob/Grep only. Do not edit, spawn helpers, run tests/services/providers, read credentials, create tasks, send messages or push. No need to write a plan file or exit plan mode; return the review directly.

The earlier fresh Opus review is docs/reviews/2026-10-03-community-setup-opus-review.md. Read its F1/F2 and the disposition. This is private, trusted operator-assisted setup, NOT public self-service or Organic mint-owner authentication. Production apply/real groups were never executed. The authority reference requires external operator verification; no browser provisioning endpoint exists. Full admin UI remains deferred. This code serves multiple token communities in their own registered groups, not everyone in Lab.

Verify F1 is fully repaired: explicit URL port; reject comma authority, multiple raw @ delimiters and connection overrides; reviewed host/port/database passed explicitly through optional createDb target, protecting postgres-js parsing and ambient PG* variables. Verify F2: remote production requires sslmode=verify-full and explicit verified-TLS driver option. Existing createDb callers must keep identical defaults.
F3 is accepted fail-closed operational behavior and documented: after sanctioned name/chat/admin/rubric drift, original-manifest check may conflict; Telegram outage can block automated read-back. Never overwrite another registration to recover. F4's absent-.env.example premise was false: git ls-files .env.example returned that tracked path and parent read the file. The new empty entry is '# COMMUNITY_SETUP_DATABASE_URL='; env-example test passed. You need not read a private .env file.

Review the full final setup source integration and meaningful tests, not just the fixes: operator vs community authority, strict/discarded fields, original full-plan receipt, sorted advisory locks plus row locks, atomic pinned bootstrap, paused/no-payment state, legacy-scoring exclusion, time-after-wait and unknown COMMIT reconciliation. Source files outside changed range may be read only as context; don't reopen unrelated accepted participant/wallet work.
Changed files:
.env.example
README.md
apps/api/scripts/community-setup.ts
apps/api/src/community-setup/cli.test.ts
apps/api/src/community-setup/cli.ts
apps/api/src/community-setup/manifest.test.ts
apps/api/src/community-setup/manifest.ts
apps/api/src/community-setup/registration.pg.test.ts
apps/api/src/community-setup/registration.test.ts
apps/api/src/community-setup/registration.ts
apps/api/src/community-setup/telegram.test.ts
apps/api/src/community-setup/telegram.ts
apps/api/src/community-setup/test-fixture.ts
docs/community/SETUP-INTEGRATION.md
docs/reviews/2026-10-03-community-setup-opus-prompt.md
docs/reviews/2026-10-03-community-setup-opus-review.md
docs/reviews/2026-10-03-community-setup-review-disposition.md
docs/superpowers/plans/2026-10-03-community-setup-plan.md
docs/superpowers/specs/2026-10-03-organic-community-onboarding-requirements.md
packages/db/src/index.ts

Validation parent-observed: focused final setup unit/PGlite 48/48; F1/F2 red 2 failed/12 passed before fixes, final CLI 16/16; typecheck/lint/DB consistency passed; post-fix full gate 849 passed/1 skipped before two added Telegram cases and current-base final run; real Postgres full suite 49/49 before added after-activation replay. Final full gate and 50-test Postgres suite are now running. You run no tests and should distinguish reported evidence from your review.

Return APPROVE or NEEDS-ATTENTION for final code, with any actionable findings sorted by severity and exact file/line/failure scenario. Report observable model; requested Opus alias/high effort is not independent proof of effort. Separate code acceptance from production authorization. Do not give connector-setup instructions; those are outside the task.
