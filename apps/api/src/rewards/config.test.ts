import { RubricSchema } from "@hyphae/core";
import { describe, expect, it } from "vitest";
import {
  buildRewardConfigPayload,
  configDigest,
  DEFAULT_REWARD_POLICY,
  earliestActivationEpoch,
  nextWindow,
  RewardConfigPayload,
} from "./config.js";

const rubric = RubricSchema.parse({
  version: "1.2.0",
  community: "MYCEL",
  guidelines: "Add something real to the conversation. No price promises.",
  criteria: [{ key: "context_fit", label: "Specific", weight: 1, description: "Reacts." }],
  timing: { fullUntil: 360, zeroAt: 2880 },
  stakeWeight: "none",
  minHoldUnits: "100000000000",
  proposalAcceptThreshold: 70,
});

describe("earliestActivationEpoch", () => {
  it("accepted in E11 with last activation E11 → E13", () => {
    expect(earliestActivationEpoch(11, 11)).toBe(13);
  });
  it("accepted in E12 with last activation E11 → E13", () => {
    expect(earliestActivationEpoch(12, 11)).toBe(13);
  });
  it("accepted in E13 after activation at E13 → E15", () => {
    expect(earliestActivationEpoch(13, 13)).toBe(15);
  });
  it("accepted long after the last activation → next epoch", () => {
    expect(earliestActivationEpoch(20, 11)).toBe(21);
  });
  it("accepted before epoch 1 opens (k = 0) after bootstrap → E3", () => {
    expect(earliestActivationEpoch(0, 1)).toBe(3);
  });
});

describe("nextWindow", () => {
  it("opens at the previous close and closes after the new duration", () => {
    const closesAt = new Date("2026-10-05T00:00:00.000Z");
    expect(nextWindow({ closesAt }, 14 * 86_400)).toEqual({
      opensAt: closesAt,
      closesAt: new Date("2026-10-19T00:00:00.000Z"),
    });
  });
});

describe("buildRewardConfigPayload", () => {
  it("pins the rubric, default policy and millisecond timing", () => {
    const payload = buildRewardConfigPayload(rubric);
    expect(payload).toEqual({
      version: 1,
      rubric,
      epoch: { durationSeconds: 604_800 },
      timing: { fullCreditUntilMs: 21_600_000, zeroCreditAtMs: 172_800_000 },
      credit: {
        floor: 60,
        aiCapMild: 79,
        aiCapStrong: 40,
        hardZeroFlags: ["guideline_breach", "spam", "off_topic"],
      },
      effort: { multiplierBps: 30_000, slotLimit: 1, candidatesPerSlot: 3, retrievalRounds: 3 },
      points: {
        unitsPerPoint: "100000000",
        rounding: "half_up_after_aggregation",
        maxWholePoints: "18446744073709551615",
      },
    });
    expect(DEFAULT_REWARD_POLICY.epoch.durationSeconds).toBe(604_800);
  });

  it("applies policy overrides", () => {
    const payload = buildRewardConfigPayload(rubric, { epoch: { durationSeconds: 14 * 86_400 } });
    expect(payload.epoch.durationSeconds).toBe(14 * 86_400);
    expect(payload.effort.multiplierBps).toBe(30_000);
  });
});

describe("RewardConfigPayload validation", () => {
  const valid = buildRewardConfigPayload(rubric);
  const reject = (patch: (p: RewardConfigPayload) => void, message: RegExp) => {
    const p = structuredClone(valid);
    patch(p);
    const result = RewardConfigPayload.safeParse(p);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((i) => i.message).join("\n")).toMatch(message);
  };

  it("accepts the built payload", () => {
    expect(RewardConfigPayload.parse(valid)).toEqual(valid);
  });
  it("rejects a credit floor other than 60", () => {
    reject((p) => {
      (p.credit as { floor: number }).floor = 50;
    }, /60/);
  });
  it("rejects a multiplier under 10000 bps", () => {
    reject((p) => {
      p.effort.multiplierBps = 9_999;
    }, /10000/);
  });
  it("rejects a zero duration", () => {
    reject((p) => {
      p.epoch.durationSeconds = 0;
    }, />0|positive/);
  });
  it("rejects a fractional duration", () => {
    reject((p) => {
      p.epoch.durationSeconds = 0.5;
    }, /int/);
  });
  it("rejects timing milliseconds that disagree with the rubric minutes", () => {
    reject((p) => {
      p.timing.fullCreditUntilMs = 21_600_001;
    }, /rubric\.timing/);
  });
  it("rejects zero credit at or before full credit", () => {
    reject((p) => {
      p.rubric.timing.zeroAt = 360;
      p.timing.zeroCreditAtMs = 21_600_000;
    }, /zeroCreditAtMs/);
  });
});

describe("configDigest", () => {
  it("is stable across key order and differs when the payload differs", () => {
    const a = buildRewardConfigPayload(rubric);
    const reordered = JSON.parse(JSON.stringify({ ...a, rubric: { ...a.rubric } }));
    expect(configDigest(reordered)).toBe(configDigest(a));
    expect(configDigest(a)).toMatch(/^[0-9a-f]{64}$/);
    const b = buildRewardConfigPayload(rubric, { effort: { multiplierBps: 20_000 } });
    expect(configDigest(b)).not.toBe(configDigest(a));
  });
});
