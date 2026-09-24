import { describe, expect, it } from "vitest";
import { creditRule, exactPoints } from "./read-api.js";
import { creditedQuality, type RewardFlag, rawQuality } from "./reward-points.js";

describe("exactPoints", () => {
  it("prints point units as an exact decimal with trailing zeros trimmed", () => {
    expect(exactPoints(25_500_000_000n)).toBe("255");
    expect(exactPoints(12_750_000_000n)).toBe("127.5");
    expect(exactPoints(8_364_850_000n)).toBe("83.6485");
    expect(exactPoints(2_400_000n)).toBe("0.024");
    expect(exactPoints(1n)).toBe("0.00000001");
    expect(exactPoints(0n)).toBe("0");
  });

  it("refuses negative units", () => {
    expect(() => exactPoints(-1n)).toThrow(RangeError);
  });
});

describe("creditRule", () => {
  it("names the gate behind each raw-to-credited change", () => {
    expect(creditRule(84, ["off_topic"], 0)).toBe("hard_zero");
    expect(creditRule(95, ["guideline_breach", "ai_slop"], 0)).toBe("hard_zero");
    expect(creditRule(95, ["ai_slop"], 79)).toBe("ai_cap_mild");
    expect(creditRule(95, ["ai_slop"], 0)).toBe("ai_cap_strong");
    expect(creditRule(59, [], 0)).toBe("below_floor");
    expect(creditRule(50, ["ai_slop"], 0)).toBe("below_floor");
    expect(creditRule(85, [], 85)).toBe("none");
    expect(creditRule(70, ["ai_slop"], 70)).toBe("none");
    expect(creditRule(0, [], 0)).toBe("none");
  });

  it("refuses a credited value no gate can produce", () => {
    expect(() => creditRule(85, [], 50)).toThrow();
    expect(() => creditRule(85, [], 0)).toThrow();
    expect(() => creditRule(60, ["ai_slop"], 40)).toThrow();
  });

  it("agrees with R1's creditedQuality on every input", () => {
    const all: RewardFlag[] = [
      "off_topic",
      "low_effort",
      "ai_slop",
      "link_mismatch",
      "spam",
      "guideline_breach",
    ];
    const hard = new Set<RewardFlag>(["off_topic", "spam", "guideline_breach"]);
    for (let mask = 0; mask < 1 << all.length; mask++) {
      const flags = all.filter((_, i) => mask & (1 << i));
      for (let raw = 0; raw <= 100; raw++) {
        for (const patternCount of [0n, 3n]) {
          for (const templateRhythm of [false, true]) {
            const credited = Number(
              creditedQuality({
                rawQuality: rawQuality(BigInt(raw)),
                flags,
                aiSlop: { patternCount, templateRhythm },
              }),
            );
            const rule = creditRule(raw, flags, credited);
            if (rule === "none") expect(credited).toBe(raw);
            else expect(credited).not.toBe(raw);
            if (rule === "hard_zero") expect(flags.some((f) => hard.has(f))).toBe(true);
            if (rule === "ai_cap_mild") expect(credited).toBe(79);
            if (rule === "ai_cap_strong") expect(raw).toBeGreaterThanOrEqual(60);
            if (rule === "below_floor") expect(raw).toBeLessThan(60);
          }
        }
      }
    }
  });
});
