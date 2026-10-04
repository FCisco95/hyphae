# Adopter final focused repairs — October 4

Last Updated: 2026-10-04T12:38:05Z

## TL;DR

Exact335618498ad4bb65ce9fac6ca4353ae6852816c6..010c68cfe32fd9db98fcf95e3eb273c05be4edee was **reviewed NEEDS-FIXES**, actual Claude Opus5.5 low: one Medium, two Low, one existing nit. [Review](../reviews/2026-10-04-adopter-fix-opus-review.md). Those three demonstrated issues now pass locally. New exact010..fix commit awaits coordinator final focused check; no publication.

## Changes and evidence

- Copied packed SDK into disposable consumer as sdk.tgz and use file:./sdk.tgz. Actual pnpm10.29.3 previously failed ENOENT on an encoded archive path containing spaces/#/%/non-ASCII; new automated test installs and imports from such an archive and consumer path successfully. Fetch/process bounds and scripts-disabled install retained.
- npm_execpath checks exact basename, not parent-directory substrings. Extensionless executable POSIX pnpm resolves and runs directly, shell:false. Tests cover misleading npm path, actual executable PATH resolution/probe, native exe and cmd/bat rejection. Windows-shaped cases run on Mac; native Windows remains UNK2026-10-04T12:38:05ZN/unavailable.
- Cooldown callback reschedules while still cooling. Actual Chromium regression deliberately fires its first cooldown callback early: old candidate timed out with disabled controls; new app eventually re-enables, makes no premature reads and recovers on deliberate click.
- Existing symlink main-module guard limitation documented, no unrelated helper rewrite. SDK/core/lock/API/backend/CORS unchanged; tarball hash unchanged90ea3f6a1a4e2f07549bdca6e13515492915c1c7470393013bb40ea84e153f25.

Fresh: Node7/7; browser bootstrap retry/shared cooldown/early callback recovery PASS; empty-store/cache full packed Chromium151.0.7922.34 demo PASS (DemoA/B, unavailable vs known zero,503/429/malformed/timeout/recovery/obsolete-read isolation/keyboard/1280-390-320px no overflow/page errors); run.mjs actual HTTP200/two communities/owned PID19999 exit0; lint309/0 and diff check clean. Temp consumers/store/cache/server/browser cleaned. Earlier891/1skip/types0/APIbuild/SDK26/starter14/packed cross-origin evidence retained, not rerun or claimed fresh.

## Ownership, refs and next gate

Start010c68cfe32fd9db98fcf95e3eb273c05be4edee,24ahead fetched origin312cc0ffae1c4efbf5fd69c2b58a5aaf98af28ac. New verified local commit SHA resolves from this receipt's git history. Exact next range010..fixHEAD goes to coordinator; no duplicate reviewer/editor. Sole owner term_d658b481-81fc-4bad-8e49-c770b6b53989, coordinator term_4117bb0c-3765-4e8d-9049-2ac0286fd9f6, Runrun_2714d1f53dc6. Fixed task deadline2026-10-04T13:13:09Z and supervision through at least14:10:47Z remain unchanged.

All independent scoped work passes. Wait for final check; fix only demonstrated scoped findings. Original exact-a646 P1+D2 approval stays conditional on existing configuration checks; Windows unavailable, no repeated question. All source/package/deploy/config/phone/attendance/registration/funds/date gates retained; nothing pushed/published. Original phone result Needs Cisco. Pilot hidden/recruitment blocked until actual registered-Lab phone PASS; desktop fixture is not phone or C21. verify0.1.0throughOct12, held rules/Jev refs and exact Oct8–10 dates/funds remain in [living handoff](../HANDOFF.md). Organic owns authority/provisioning task3.6/DEP-09; no dependency closed by this local tooling. Siblings/vault read-only, coordinator owns shared propagation.

## Suggested skills

handoff-memory, karpathy-guidelines, security-review if applicable, orca-cli, handoff.

## Generated artifacts this session

| What | Canonical home | Stage |
|---|---|---|
| Scoped code/regressions and public-safe review | examples/read-sdk-demo/, docs/reviews/2026-10-04-adopter-fix-opus-review.md | Local tracked |
| Rebuilt demo/report/screenshots and unchanged SDK tarball | Existing ignored demo/SDK dist directories | Local generated; disposable consumers cleaned |
| Handoff/build log | docs/HANDOFF.md, this snapshot, docs/BUILDLOG.md | Local, unpushed |

No services, credentials, bot messages, registration, signatures or funds actions.

## Next-session prompt

```text
Resume onlyFCisco95/hyphae. Candidate010 reviewed NEEDS-FIXES; tarball path/resolver/cooldown fixes pass Node7/7, actual pnpm special-path install/import, Chromium bootstrap/shared/early cooldown/full empty-store demo/run command and lint309. NativeWindowsUNK2026-10-04T12:38:05ZN; prior broad891/types retained, not rerun. SDK/core/lock/API unchanged.
Files: CLAUDE.md,AGENTS.md,docs/HANDOFF.md,docs/handoffs/2026-10-04-adopter-final-fixes.md,docs/reviews/2026-10-04-adopter-fix-opus-review.md,examples/read-sdk-demo/README.md.
Model: existing configured Codex runner — bounded repair/review continuation.
Skills: handoff-memory,karpathy-guidelines,security-review if applicable,orca-cli,handoff.
Receive coordinator focused verdict for010c68cfe32fd9db98fcf95e3eb273c05be4edee..fixHEAD; do not duplicate reviewers or add work while only review remains. Preserve sole owner/fixed13:13:09Z deadline/horizon14:10:47Z/all original conditional release, config, phone, verify freeze, held refs and exact money/date gates. No push/live/shared write.
```
