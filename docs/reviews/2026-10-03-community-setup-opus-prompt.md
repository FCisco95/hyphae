Fresh independent other-family security and correctness review of Hyphae community setup.
Immutable range: 8f395b43b2c7d79d00fad9ef074c62cf33228ae0..2ca35057c3efbd43df191bda0d9527d526f6886f. Read source in this worktree; do not edit, create tasks, spawn helpers, run services/tests/providers, access credentials, send messages or push. Tools are Read/Glob/Grep only. This prompt authorizes read-only review regardless of stale authorization wording in older handoffs.

Task: operator-assisted, private CLI registration for any token community in its own group. This is not public self-service or mint-ownership authentication. Trusted operator credentials and a recorded external authority reference are the admission boundary; Telegram group admin alone is explicitly insufficient for Organic authority. Production operation is not performed. Full web admin was already deferred. No Organic/Sentinel/schema/SDK or existing reward-policy change.

Changed files:
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
docs/superpowers/plans/2026-10-03-community-setup-plan.md
docs/superpowers/specs/2026-10-03-organic-community-onboarding-requirements.md

Review all changed production sources and their meaningful tests. Read existing rewards/config.ts, rewards/intake.ts, db/schema.ts, db/index.ts and bot onboarding as needed to verify integration. Inspect strict manifest validation and discarded fields; plan hash/DB target and query overrides; read-only Telegram identity and safe errors; group vs mint authority; immutable original-plan receipt; resource lock ordering; same-request and conflicting registrations; transaction plus nested bootstrap; paused non-payable state; prevention of legacy scoring; activation after wait; and lost COMMIT reconciliation. Check tests actually exercise these guarantees. Identify remaining genuine defects with severity, exact file/line and concrete failure scenario. Do not invent a deployed/self-service claim.

Available local validation before review: focused manifest/Telegram/CLI/PGlite 42/42; real PostgreSQL 17 suite 49/49, including five new setup concurrency/reconciliation checks. Full repository gate is running on the rebased candidate. These results are parent-reported, not your own test execution. Verify from source; do not present green checks as security clearance.

Return APPROVE or NEEDS-ATTENTION, then actionable findings sorted by severity. Distinguish accepted private-operator limitations from defects. Report observable model and effort metadata; do not claim exact settings you cannot observe. No fixes in this session.
