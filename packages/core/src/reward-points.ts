export const BASIS_POINTS = 10_000n;
export const POINT_UNITS_PER_POINT = 100_000_000n;
export const REWARD_CREDIT_FLOOR = 60n;

declare const rawQualityBrand: unique symbol;
declare const creditedQualityBrand: unique symbol;
declare const pointUnitsBrand: unique symbol;
declare const wholePointsBrand: unique symbol;

export type RawQuality = bigint & { readonly [rawQualityBrand]: "RawQuality" };
export type CreditedQuality = bigint & { readonly [creditedQualityBrand]: "CreditedQuality" };
export type PointUnits = bigint & { readonly [pointUnitsBrand]: "PointUnits" };
export type WholePoints = bigint & { readonly [wholePointsBrand]: "WholePoints" };

export type RewardFlag =
  | "off_topic"
  | "low_effort"
  | "ai_slop"
  | "link_mismatch"
  | "spam"
  | "guideline_breach";

export interface CreditInput {
  rawQuality: RawQuality;
  flags: readonly RewardFlag[];
  aiSlop: {
    patternCount: bigint;
    templateRhythm: boolean;
  };
}

export interface TimingInput {
  taskOpensAtMs?: bigint;
  submittedAtMs: bigint;
  fullCreditUntilMs: bigint;
  zeroCreditAtMs: bigint;
}

export interface RewardPointInput {
  credit: CreditInput;
  timing: TimingInput;
  multiplierBps: bigint;
}

export interface RewardPointResult {
  rawQuality: RawQuality;
  creditedQuality: CreditedQuality;
  timingBps: bigint;
  multiplierBps: bigint;
  pointUnits: PointUnits;
}

const REWARD_FLAGS = new Set<RewardFlag>([
  "off_topic",
  "low_effort",
  "ai_slop",
  "link_mismatch",
  "spam",
  "guideline_breach",
]);
const HARD_ZERO = new Set<RewardFlag>(["guideline_breach", "spam", "off_topic"]);

function requireBigInt(value: unknown, name: string): bigint {
  if (typeof value !== "bigint") throw new TypeError(`${name} must be a bigint`);
  return value;
}

function requireNonNegative(value: unknown, name: string): bigint {
  const integer = requireBigInt(value, name);
  if (integer < 0n) throw new RangeError(`${name} must not be negative`);
  return integer;
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

export function rawQuality(value: bigint): RawQuality {
  const quality = requireNonNegative(value, "rawQuality");
  if (quality > 100n) throw new RangeError("rawQuality must be at most 100");
  return quality as RawQuality;
}

export function creditedQuality(input: CreditInput): CreditedQuality {
  const quality = rawQuality(input.rawQuality);
  for (const flag of input.flags) {
    if (!REWARD_FLAGS.has(flag)) throw new RangeError(`unsupported reward flag: ${String(flag)}`);
  }
  const patternCount = requireNonNegative(input.aiSlop.patternCount, "aiSlop.patternCount");
  if (typeof input.aiSlop.templateRhythm !== "boolean") {
    throw new TypeError("aiSlop.templateRhythm must be a boolean");
  }
  if (input.flags.some((flag) => HARD_ZERO.has(flag))) return 0n as CreditedQuality;

  const aiSlop = input.flags.includes("ai_slop");
  const cap = aiSlop ? (input.aiSlop.templateRhythm || patternCount >= 3n ? 40n : 79n) : 100n;
  const capped = quality < cap ? quality : cap;
  return (capped < REWARD_CREDIT_FLOOR ? 0n : capped) as CreditedQuality;
}

export function timingBps(input: TimingInput): bigint {
  const fullCreditUntilMs = requireNonNegative(input.fullCreditUntilMs, "fullCreditUntilMs");
  const zeroCreditAtMs = requireNonNegative(input.zeroCreditAtMs, "zeroCreditAtMs");
  const submittedAtMs = requireBigInt(input.submittedAtMs, "submittedAtMs");
  if (zeroCreditAtMs <= fullCreditUntilMs) {
    throw new RangeError("zeroCreditAtMs must be greater than fullCreditUntilMs");
  }

  if (input.taskOpensAtMs === undefined) return BASIS_POINTS;
  const taskOpensAtMs = requireBigInt(input.taskOpensAtMs, "taskOpensAtMs");
  if (submittedAtMs < taskOpensAtMs)
    throw new RangeError("submittedAtMs must not precede taskOpensAtMs");

  const elapsedMs = submittedAtMs - taskOpensAtMs;
  if (elapsedMs <= fullCreditUntilMs) return BASIS_POINTS;
  if (elapsedMs >= zeroCreditAtMs) return 0n;
  return roundHalfUp(
    BASIS_POINTS * (zeroCreditAtMs - elapsedMs),
    zeroCreditAtMs - fullCreditUntilMs,
  );
}

export function rewardPointUnits(input: RewardPointInput): RewardPointResult {
  const multiplierBps = requireBigInt(input.multiplierBps, "multiplierBps");
  if (multiplierBps < BASIS_POINTS) {
    throw new RangeError("multiplierBps must be at least 10000");
  }

  const credited = creditedQuality(input.credit);
  const timing = timingBps(input.timing);
  return {
    rawQuality: input.credit.rawQuality,
    creditedQuality: credited,
    timingBps: timing,
    multiplierBps,
    pointUnits: (credited * timing * multiplierBps) as PointUnits,
  };
}

export function aggregatePointUnits(values: readonly PointUnits[]): PointUnits {
  return values.reduce((total, value) => {
    const units = requireNonNegative(value, "pointUnits");
    return (total + units) as PointUnits;
  }, 0n as PointUnits);
}

export function wholePoints(pointUnits: PointUnits): WholePoints {
  const units = requireNonNegative(pointUnits, "pointUnits");
  return roundHalfUp(units, POINT_UNITS_PER_POINT) as WholePoints;
}
