# H-DESIGN — bounded implementation planning checkpoint

## TL;DR

The bounded implementation plan for approved D1–D3/O1–O7 is complete in the ignored local mirror `docs/plans/h-design-implementation-plan-2026-09-20.md`. It sequences exact pure points, pinned configuration/intake, durable slot/dispatch state, effective-decision reads, then strict close snapshots. H-CONTRACT, fee/funding/payment, campaign, Sentinel, H-FIXTURES, and optional square-root arithmetic remain gated.

## Evidence and scope

Approval authority is `docs/handoffs/2026-09-20-h-design-written-approval.md`; the approved design remains byte-identical at `c08871f`. Planning inspected the current worktree head `5b65a0a`; `07072fb` remains the approval-record checkpoint in history. All 16 synthetic review labels remain unchanged.

Inspection verified that scoring reads mutable rubrics, permits provider/job retries, `/me` sums every run, the historical close task is unimplemented, and settlement uses floating arithmetic. The plan makes those gaps explicit rather than treating historic behavior as compliant.

## Planned order

1. R1: pure integer reward-point arithmetic/tests.
2. R2: immutable config activation/pinning and epoch intake.
3. R3: persistent slot/candidate/retrieval/dispatch reconciliation and ordinary-to-effort nomination.
4. R4: linear effective decisions/corrections and shared read model.
5. R5: scheduled close snapshot, late results and bounded re-entry.
6. R6: only after H-CONTRACT, public audit/commitments/correction auth and claim/root integration.

The first safe future slice is R1 only: no database, provider, fixture, public wire, root, claim, or payment state.

## Retained blockers

H-CONTRACT owns wire/auth/hash-vector and consumer compatibility choices. Fee/funding/payment definitions, campaign eligibility, Sentinel release/adoption, H-FIXTURES range conversion/paid evaluation, and exact non-MYCEL square-root arithmetic are not implementation work here. Wallet migration remains behind identity/auth design.

## Validation

Notes-only validation: approval/source references, planned paths against current tree, ignored-mirror status, fixture SHA-256 and working-tree preservation. No product tests, database commands, paid evaluations, fixture/source edits, deployments, pushes, or sibling writes.

Runner: GPT-5.6 Terra, high, user-selected. Session billing unavailable. Evidence stage: local design/source inspection only.

The private amendment was returned to the existing organic-sync terminal with Orca request `35fc0dfe-a7db-4c9f-a526-1d4df21d99c4`; its receipt reported `input_accepted` and `turn_started`. That proves delivery/start, not canonical application or implementation.

## Suggested skills

`handoff-memory`, `orca-cli`, `handoff`. Before R1 use relevant TypeScript/testing guidance; before R2+ use database/security guidance.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Complete private implementation plan | `docs/plans/h-design-implementation-plan-2026-09-20.md` | Ignored local mirror; return to organic-sync |
| Public-safe planning checkpoint | `docs/handoffs/2026-09-20-h-design-implementation-planning.md` | This snapshot |
| Refreshed engineering handoff | `docs/HANDOFF.md` | Current continuation state |

## Next-session prompt

```text
Resume Hyphae in h-design-2026-09-19. D1–D3/O1–O7 are approved and the bounded implementation plan is complete; implementation has not started. Preserve the 16 synthetic labels and the dirty main checkout.

Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-20-h-design-written-approval.md, docs/handoffs/2026-09-20-h-design-implementation-planning.md, docs/plans/h-design-implementation-plan-2026-09-20.md
Model: GPT-5.6 Terra (high) — user-selected efficient implementation runner.
Skills: handoff-memory, orca-cli, handoff.

If separately authorized, implement R1 only: pure exact reward-point arithmetic and tests. Do not start database/API/fixture/payment/contract work; H-CONTRACT, H-FIXTURES, fee/funding/payment, campaign, Sentinel, and optional sqrt arithmetic remain gates.
```
