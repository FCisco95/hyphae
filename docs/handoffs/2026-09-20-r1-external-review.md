# R1 external review — changes requested

## TL;DR

**Changes requested: one P2 defect, R1-01.** O5 arithmetic is correct in the reviewed cases, but whole-claim overflow is accepted. Core tests and typecheck pass; they do not cover this required rejection. No source or test fixes were made. Resolve R1-01 and re-review before accepting R1; R2 remains gated.

## Scope and provenance

- Reviewed `packages/core/src/reward-points.ts`, `reward-points.test.ts` and `index.ts` on `main` at `1418cbc8404804b7cea1152b97ebf5316b1acbfe` plus the existing local R1 changes.
- Authority: approved O4/O5 in `docs/handoffs/2026-09-20-h-design-operational-definitions.md`, approval in `docs/handoffs/2026-09-20-h-design-written-approval.md`, and the R1 acceptance matrix in the canonical private implementation queue. Earlier proposal wording is historical.
- Actual model/effort: **GPT-6 Astra (`gpt-6-astra`), xhigh**, verified in this session's local `turn_context` metadata. No sub-agents or model switch; session billing unavailable. Prior implementation runner claims were not substituted for this review's metadata.
- Ownership: review/handoff documentation only. This session added this snapshot, refreshed `docs/HANDOFF.md` and added a `docs/BUILDLOG.md` review entry. Existing source, tests and prior snapshots were preserved.

## R1-01 — P2: reject unsupported whole-claim results

**Location:** `packages/core/src/reward-points.ts:147–149` (`wholePoints`); contributing unchecked paths at `rewardPointUnits:124–136` and `aggregatePointUnits:140–144`.

`wholePoints()` validates only bigint/nonnegative input and returns the rounded result without checking a supported claim maximum. O4 requires rejection of configurations/results outside supported integer/claim bounds, and the canonical R1 acceptance matrix explicitly requires invalid/overflow rejection. The unchanged score field in `packages/core/src/merkle.ts:22–35` uses unsigned 64-bit encoding, whose maximum is `18446744073709551615`. This file was inspected only to establish the existing bound; no leaf/root operation was run.

An accepted integer multiplier can produce `18446744073709551616` whole points (`2^64`). Two individually representable contributions can also aggregate to that value. Bigint arithmetic stays exact, but the returned `WholePoints` value cannot be represented by the existing claim field. R1 is currently unwired, so this is an acceptance defect and a future integration hazard, not evidence of an existing payment failure.

Read-only reproduction from the repository root, using the installed Node v24.14.0 TypeScript stripping support:

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import {
  rawQuality, rewardPointUnits, aggregatePointUnits, wholePoints,
} from './packages/core/src/reward-points.ts';

const contribution = rewardPointUnits({
  credit: {
    rawQuality: rawQuality(100n), flags: [],
    aiSlop: { patternCount: 0n, templateRhythm: false },
  },
  timing: {
    submittedAtMs: 0n,
    fullCreditUntilMs: 21_600_000n, zeroCreditAtMs: 172_800_000n,
  },
  multiplierBps: (2n ** 63n) * 100n,
}).pointUnits;

assert.equal(wholePoints(contribution), 2n ** 63n); // Fits u64.
const total = aggregatePointUnits([contribution, contribution]);
assert.equal(wholePoints(total), 2n ** 64n); // Reproduces defect: no rejection.
console.log(wholePoints(total)); // 18446744073709551616n
JS
```

Also reproduced: for `U = (2^64 - 1) * 100000000 + 50000000`, `wholePoints(U - 1)` returns the maximum representable claim, while `wholePoints(U)` returns `2^64` instead of rejecting. This specifically exercises overflow introduced by half-up rounding.

**Requested bounded follow-up:** enforce the supported whole-claim range at conversion, after aggregation and rounding, without clamping. Preserve arbitrary-precision scaled exact units; applying a u64 bound directly to point units would reject otherwise representable claims. Add regressions for maximum valid output, one unit below/at the overflowing half-up threshold, and aggregate overflow from individually valid contributions. Configuration validation alone does not cover aggregate overflow. Do not change the claim encoding or integrate a caller as part of this fix.

## O5 review matrix

| Area | Verdict and evidence |
|---|---|
| Distinct values / export | Four branded bigint types remain separate. Results retain raw/credited quality alongside exact units. `index.ts` adds only the export; typecheck passes. |
| Hard gates and AI caps | Matches existing credit policy: off-topic/spam/guideline breach hard-zero; AI flag enables mild 79 or strong 40 cap (template rhythm or at least three patterns); floor 60 follows. Unknown flags and invalid AI metadata reject. |
| Effort and ordinary work | Supplied 10000 bps retains ordinary/ineligible quality; 30000 yields default eligible points. Custom 10001/12500 bps work exactly; below 10000 and number inputs reject. Eligibility/nomination selection remains a future caller responsibility. |
| Millisecond timing | Full through F, zero from Z, pre-open rejection and missing-task 10000 match O5. Independent quotient/remainder oracle agrees at all 10000 MYCEL half-up thresholds and adjacent milliseconds, plus endpoint and odd/even denominator cases. Large timestamp offsets preserve subtraction exactly. |
| Fractions | 85 at 27h with 3× = 12750000000 units / 127.5 points / 128 whole alone. Quality 60 at 47h59m = 2400000 units / 0.024 points / zero whole; no second credit floor. |
| Aggregation / rounding | Exact bigint sum; empty sum is zero; two half-point inputs yield one whole point. Half-up neighbors and values beyond number-safe precision pass. No contribution rounding occurs inside `rewardPointUnits` or `aggregatePointUnits`. |
| Invalid inputs / bounds | Tested invalid quality/types, flags, AI metadata, timing ranges/pre-open input, multipliers and negative/non-bigint units reject. **Whole-claim upper bound fails: R1-01.** |
| Integration obligations | Helpers do not select effective contributions, freeze configuration, prove original submission time or enforce eligible nomination; those remain R2–R5. Future allocation must use exact units separately from whole claims. Settlement remains outside this review. |

All nine O5 numeric examples passed the additional probes, including ordinary 100, rejected-effort 85, quality 59 → zero, hard breach → zero, mild AI → 237 and strong AI → zero. Slot-consumption semantics in that table were not exercised by the pure module.

## Checks and evidence limits

| Check | Result |
|---|---|
| `pnpm --filter @hyphae/core test` | PASS: 5 files, 39 tests (7 R1) |
| `pnpm --filter @hyphae/core typecheck` | PASS |
| Focused `pnpm exec biome check` on the three reviewed files | PASS; no fixes applied |
| Read-only Node oracle probes | PASS: 38784 credit combinations, 30565 timing cases, 24 whole-rounding cases, 26 invalid-input rejections and all 9 O5 numeric examples |
| Additional exactness probes | PASS: empty sum, custom multipliers, large integer offsets and exact sums beyond safe-number precision |
| Unsupported whole-claim probes | DEFECT REPRODUCED: direct construction, aggregate overflow and rounding across u64 maximum |
| `git diff --check` / handoff validation | PASS |

The credit sweep covers quality 0–100, all 64 subsets of the six flags, pattern counts 0/2/3 and both template-rhythm values. The timing sweep uses an independently expressed quotient/remainder oracle, including 1–31 ms custom decay ranges. These were ephemeral stdin probes; they changed no source/test files and are not durable regression tests. The reproduction above is retained in this review.

Persistent coverage should retain millisecond half-up tie neighbors, template-rhythm strength and all three hard flags during the follow-up. Their current behavior passed review; missing tests are coverage observations, not additional reproduced arithmetic defects. No evidence was gathered for DB/API flows, model accuracy, fixtures, deployment, effective-decision selection or settlement.

Reviewed fingerprints (SHA-256; confirmed unchanged after documentation edits):

| File | SHA-256 |
|---|---|
| `packages/core/src/reward-points.ts` | `feea2218ae6477a9f52fa66a90862ba5d002af871ca59854e190ba72ac654a4e` |
| `packages/core/src/reward-points.test.ts` | `154495303620c6ba1d5a2197e4ea79aae7b7ef4cf0d3142fb2308794cc6afa20` |
| `packages/core/src/index.ts` | `136a37ac67186d5ded50304da539c77bfab7883dd65a69c4fc51963b141784f8` |

Approved operating-design SHA-256 remains `ddeb69325d6b9621fe05de504f30356c4c0d7ec16d8b59fa4c9faf69184c1e99`; synthetic review JSON remains `1b851fa03059c00838438a7bc8d677299da4e87f01e6010e483ce62e75afd936` (16 labels preserved; no fixture run).

## Downstream receipt for organic-sync post-ship

- Queue status to record: external R1 review complete, **changes requested / R1 not accepted**. Record R1-01 and re-review as next bounded work, retaining task IDs and approved design/planning status.
- No commit, push, release or deployment occurred; “post-ship” is the receiving workflow, not a claim that software shipped.
- R2–R6 remain unstarted and separately gated. No caller, DB/API, scoring, settlement, root/claim/payment, model configuration or fixture change occurred.
- Preserve H-FIXTURES, H-CONTRACT, fee/funding/payment, campaign, Sentinel adoption, wallet migration and optional sqrt gates. Organic must consume provider results and must not recompute the multiplier or treat weighted points as quality.
- This receipt is recorded in the normal handoff. No message was sent and no sibling/private-plan file changed; canonical application remains unverified.

## Suggested skills

`handoff-memory`, `andrej-karpathy-skills:karpathy-guidelines`, `handoff`.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Review verdict and reproduction | `docs/handoffs/2026-09-20-r1-external-review.md` | Dated public-safe snapshot; local/uncommitted |
| Current review handoff | `docs/HANDOFF.md` | Pending R1 fix and organic-sync receipt |
| Review build-log entry | `docs/BUILDLOG.md` | Documentation only |

No credentials, deployed resources or scheduled jobs created.

## Next-session prompt

```text
Resume Hyphae main 1418cbc plus local R1 changes. External review requests changes for R1-01: wholePoints accepts values outside the existing u64 claim range. All 39 core tests/typecheck pass, but overflow rejection is unimplemented and untested.

Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-20-r1-external-review.md, docs/handoffs/2026-09-20-h-design-operational-definitions.md, packages/core/src/reward-points.ts, packages/core/src/reward-points.test.ts, packages/core/src/index.ts
Model: GPT-6 Astra (xhigh) — retain the verified review runner for precision-sensitive arithmetic re-review; record actual session metadata.
Skills: handoff-memory, andrej-karpathy-skills:karpathy-guidelines, handoff.

Resolve R1-01 only under separately scoped fix authorization, then re-review the boundary regressions. Preserve exact units and once-only rounding. Stop before R2, callers/DB/API integration, fixtures/paid runs, settlement and claim/root work. Refresh the normal handoff for organic-sync.
```
