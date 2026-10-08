import { type PayoutV1, POINT_UNITS_PER_POINT } from "@hyphae/core";

export type RewardOutcome =
  | {
      status: "completed";
      decision: {
        rawQuality: number;
        creditedQuality: number;
        effort: "eligible" | "ineligible" | "not_nominated";
        multiplierBps: number;
        pointUnits: bigint;
        explanation: string;
        affectsAllocation: boolean;
      };
    }
  | { status: "pending_evidence"; reason: string }
  | { status: "pending_reconciliation" };

// Exact points: no rounding here; whole claim points are only computed after aggregation.
export function formatPoints(units: bigint): string {
  const whole = units / POINT_UNITS_PER_POINT;
  const frac = (units % POINT_UNITS_PER_POINT).toString().padStart(8, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function rewardMessage(outcome: RewardOutcome, url: string): string {
  if (outcome.status === "pending_evidence") {
    return `Waiting for evidence: ${outcome.reason}. Nothing is scored until it can be seen.\n${url}`;
  }
  if (outcome.status === "pending_reconciliation") {
    return `The evaluation outcome is uncertain. It is held for review and will not be sent again automatically.\n${url}`;
  }
  const d = outcome.decision;
  const quality =
    d.creditedQuality === d.rawQuality
      ? `Quality ${d.creditedQuality}/100`
      : `Quality ${d.creditedQuality}/100 (raw ${d.rawQuality})`;
  return [
    `${quality}. ${formatPoints(d.pointUnits)} points.`,
    d.effort === "eligible"
      ? `Effort: eligible, ${d.multiplierBps / 10_000}×.`
      : d.effort === "ineligible"
        ? "Effort: not eligible; the slot is used."
        : null,
    d.affectsAllocation
      ? null
      : "Accepted after the epoch closed, so it does not change that epoch's result.",
    d.explanation,
    url,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

// One line under a scored reply whose member cannot be paid yet, naming the steps a link fixes.
export function payoutHintLine(p: PayoutV1): string | null {
  if (!("reasons" in p) || p.status !== "not_payable") return null;
  const steps = [
    ...(p.reasons.includes("no_verified_wallet") ? ["link a wallet by signing"] : []),
    ...(p.reasons.includes("no_rules_test") ? ["pass the rules test"] : []),
  ];
  return steps.length ? `Not payable yet: ${steps.join(" and ")} before the epoch closes.` : null;
}
