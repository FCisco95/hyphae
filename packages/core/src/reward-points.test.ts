import { describe, expect, it } from "vitest";
import {
  aggregatePointUnits,
  BASIS_POINTS,
  type CreditInput,
  creditedQuality,
  MAX_WHOLE_POINTS,
  POINT_UNITS_PER_POINT,
  type PointUnits,
  rawQuality,
  rewardPointUnits,
  timingBps,
  wholePoints,
} from "./reward-points.js";

const HOUR_MS = 3_600_000n;
const MYCEL_TIMING = {
  fullCreditUntilMs: 6n * HOUR_MS,
  zeroCreditAtMs: 48n * HOUR_MS,
};

const credit = (quality: bigint, overrides: Partial<CreditInput> = {}): CreditInput => ({
  rawQuality: rawQuality(quality),
  flags: [],
  aiSlop: { patternCount: 0n, templateRhythm: false },
  ...overrides,
});

const points = (quality: bigint, submittedAtMs: bigint, multiplierBps = BASIS_POINTS) =>
  rewardPointUnits({
    credit: credit(quality),
    timing: { taskOpensAtMs: 0n, submittedAtMs, ...MYCEL_TIMING },
    multiplierBps,
  });

describe("reward points", () => {
  it("applies credit gates before timing and the effort multiplier", () => {
    const eligible = points(85n, 0n, 30_000n);
    expect(eligible.creditedQuality).toBe(85n);
    expect(eligible.pointUnits).toBe(255n * POINT_UNITS_PER_POINT);
    expect(wholePoints(eligible.pointUnits)).toBe(255n);

    const hardZero = rewardPointUnits({
      credit: credit(95n, { flags: ["guideline_breach"] }),
      timing: { taskOpensAtMs: 0n, submittedAtMs: 0n, ...MYCEL_TIMING },
      multiplierBps: 30_000n,
    });
    expect(hardZero.creditedQuality).toBe(0n);
    expect(hardZero.pointUnits).toBe(0n);
  });

  it("retains the existing AI cap and floor rules", () => {
    expect(
      creditedQuality(
        credit(95n, { flags: ["ai_slop"], aiSlop: { patternCount: 1n, templateRhythm: false } }),
      ),
    ).toBe(79n);
    expect(
      creditedQuality(
        credit(95n, { flags: ["ai_slop"], aiSlop: { patternCount: 3n, templateRhythm: false } }),
      ),
    ).toBe(0n);
  });

  it("calculates MYCEL timing in integer milliseconds", () => {
    expect(timingBps({ taskOpensAtMs: 0n, submittedAtMs: 6n * HOUR_MS, ...MYCEL_TIMING })).toBe(
      10_000n,
    );
    expect(timingBps({ taskOpensAtMs: 0n, submittedAtMs: 27n * HOUR_MS, ...MYCEL_TIMING })).toBe(
      5_000n,
    );
    expect(timingBps({ taskOpensAtMs: 0n, submittedAtMs: 48n * HOUR_MS, ...MYCEL_TIMING })).toBe(
      0n,
    );
    expect(timingBps({ submittedAtMs: 999n, ...MYCEL_TIMING })).toBe(10_000n);
  });

  it("preserves the 85-at-27-hours fractional result", () => {
    const halfway = points(85n, 27n * HOUR_MS, 30_000n);
    expect(halfway.pointUnits).toBe(12_750_000_000n);
    expect(wholePoints(halfway.pointUnits)).toBe(128n);
  });

  it("keeps fractional near-close points instead of applying the credit floor twice", () => {
    const nearClose = points(60n, 47n * HOUR_MS + 59n * 60_000n);
    expect(nearClose.timingBps).toBe(4n);
    expect(nearClose.pointUnits).toBe(2_400_000n);
    expect(wholePoints(nearClose.pointUnits)).toBe(0n);
  });

  it("aggregates exact units and rounds half up only once", () => {
    const halfPoint = points(100n, 48n * HOUR_MS - 12n * 60_000n - 36n * 1_000n).pointUnits;
    expect(halfPoint).toBe(50_000_000n);
    expect(wholePoints(halfPoint)).toBe(1n);
    expect(wholePoints(aggregatePointUnits([halfPoint, halfPoint]))).toBe(1n);
  });

  it("accepts the largest unsigned 64-bit whole claim and rejects overflow", () => {
    const maximumClaimUnits = (MAX_WHOLE_POINTS * POINT_UNITS_PER_POINT) as PointUnits;
    expect(wholePoints(maximumClaimUnits)).toBe(MAX_WHOLE_POINTS);

    const roundingThreshold = (maximumClaimUnits + POINT_UNITS_PER_POINT / 2n) as PointUnits;
    expect(wholePoints((roundingThreshold - 1n) as PointUnits)).toBe(MAX_WHOLE_POINTS);
    expect(() => wholePoints(roundingThreshold)).toThrow(RangeError);
  });

  it("rejects aggregate overflow from individually valid contributions", () => {
    const individual = rewardPointUnits({
      credit: credit(100n),
      timing: { taskOpensAtMs: 0n, submittedAtMs: 0n, ...MYCEL_TIMING },
      multiplierBps: (1n << 63n) * 100n,
    }).pointUnits;
    expect(wholePoints(individual)).toBe(1n << 63n);
    expect(() => wholePoints(aggregatePointUnits([individual, individual]))).toThrow(RangeError);
  });

  it("rejects unsupported quality, timing, and multiplier bounds", () => {
    expect(() => rawQuality(-1n)).toThrow(RangeError);
    expect(() => rawQuality(101n)).toThrow(RangeError);
    expect(() => timingBps({ taskOpensAtMs: 1n, submittedAtMs: 0n, ...MYCEL_TIMING })).toThrow(
      RangeError,
    );
    expect(() =>
      timingBps({ submittedAtMs: 0n, fullCreditUntilMs: 1n, zeroCreditAtMs: 1n }),
    ).toThrow(RangeError);
    expect(() => points(85n, 0n, 9_999n)).toThrow(RangeError);
    expect(() => rawQuality(85 as unknown as bigint)).toThrow(TypeError);
    expect(() => timingBps({ submittedAtMs: 0 as unknown as bigint, ...MYCEL_TIMING })).toThrow(
      TypeError,
    );
    expect(() =>
      creditedQuality(credit(85n, { flags: ["unsupported"] as unknown as CreditInput["flags"] })),
    ).toThrow(RangeError);
    expect(() =>
      creditedQuality(
        credit(85n, {
          aiSlop: { patternCount: 0n, templateRhythm: "yes" as unknown as boolean },
        }),
      ),
    ).toThrow(TypeError);
  });
});
