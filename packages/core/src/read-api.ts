import { POINT_UNITS_PER_POINT } from "./reward-points.js";

const DECIMALS = POINT_UNITS_PER_POINT.toString().length - 1;

// Exact points as a decimal string: units / 10^8, never rounded (A3).
export function exactPoints(units: bigint): string {
  if (units < 0n) throw new RangeError("point units must not be negative");
  const whole = units / POINT_UNITS_PER_POINT;
  const fraction = (units % POINT_UNITS_PER_POINT).toString().padStart(DECIMALS, "0");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

export type CreditRule = "none" | "hard_zero" | "ai_cap_mild" | "ai_cap_strong" | "below_floor";

const HARD_ZERO = new Set(["guideline_breach", "spam", "off_topic"]);
const FLOOR = 60;
const AI_CAP_MILD = 79;

// The gate that turned raw quality into credited quality, read back from a stored decision. The
// decision keeps raw, credited and flags; R1's order (hard zero, AI cap, floor) makes these three
// enough. A pair no gate can produce is a bug, so it throws rather than guessing.
export function creditRule(raw: number, flags: readonly string[], credited: number): CreditRule {
  if (credited === raw) return "none";
  if (credited === 0 && flags.some((f) => HARD_ZERO.has(f))) return "hard_zero";
  if (flags.includes("ai_slop")) {
    if (credited === AI_CAP_MILD && raw > AI_CAP_MILD) return "ai_cap_mild";
    if (credited === 0 && raw >= FLOOR) return "ai_cap_strong";
  }
  if (credited === 0 && raw < FLOOR) return "below_floor";
  throw new Error(`read-api: no credit gate turns raw ${raw} into credited ${credited}`);
}
