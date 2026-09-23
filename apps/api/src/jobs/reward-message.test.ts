import { describe, expect, it } from "vitest";
import { formatPoints, rewardMessage } from "./reward-message.js";

const decision = {
  rawQuality: 85,
  creditedQuality: 85,
  effort: "eligible" as const,
  multiplierBps: 30_000,
  pointUnits: 25_500_000_000n,
  explanation: "Specific and checked.",
  affectsAllocation: true,
};

describe("formatPoints", () => {
  it("shows exact points without trailing zeros", () => {
    expect(formatPoints(25_500_000_000n)).toBe("255");
    expect(formatPoints(12_750_000_000n)).toBe("127.5");
    expect(formatPoints(2_400_000n)).toBe("0.024");
    expect(formatPoints(0n)).toBe("0");
  });
});

describe("rewardMessage", () => {
  it("states quality, effort and exact points for a completed decision", () => {
    const text = rewardMessage({ status: "completed", decision }, "https://hyphae.fun/x/1");
    expect(text).toContain("Quality 85/100");
    expect(text).toContain("Effort: eligible, 3×");
    expect(text).toContain("255 points");
    expect(text).toContain("Specific and checked.");
  });
  it("shows raw and credited quality when they differ", () => {
    const text = rewardMessage(
      {
        status: "completed",
        decision: { ...decision, creditedQuality: 0, effort: "ineligible", pointUnits: 0n },
      },
      "u",
    );
    expect(text).toContain("Quality 0/100 (raw 85)");
    expect(text).toContain("Effort: not eligible; the slot is used");
  });
  it("says a late decision does not change the closed epoch", () => {
    const text = rewardMessage(
      { status: "completed", decision: { ...decision, affectsAllocation: false } },
      "u",
    );
    expect(text).toContain("after the epoch closed");
  });
  it("explains pending evidence and uncertain outcomes without a score", () => {
    expect(
      rewardMessage({ status: "pending_evidence", reason: "media_not_captured" }, "u"),
    ).toContain("media_not_captured");
    expect(rewardMessage({ status: "pending_reconciliation" }, "u")).toMatch(/not be sent again/);
  });
});
