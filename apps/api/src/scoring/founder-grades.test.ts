import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EvalCasesSchema } from "./eval.js";
import { founderGrades } from "./founder-grades.js";

const readJson = (path: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../../../../docs/rubrics/eval/${path}`, import.meta.url), "utf8"),
  );
const review = readJson("mycel-synthetic-review.json");

describe("founder grades for the synthetic review", () => {
  const cases = founderGrades(review);
  const byId = new Map(cases.map((c) => [c.id, c.expected]));

  it("turns all 16 founder-scored cases into harness cases", () => {
    expect(cases).toHaveLength(16);
    expect(EvalCasesSchema.safeParse(cases).success).toBe(true);
  });

  // Founder target ±5, clamped to 0–100; a credited score is 0 or at least 60, so a credited
  // target of 0 is exact. Case 12 keeps the founder's own 75–80.
  it.each([
    ["synthetic-receipt-specific-praise", [70, 70], [65, 75], [70, 70], [65, 75]],
    ["synthetic-receipt-specific-criticism", [90, 90], [85, 95], [90, 90], [85, 95]],
    ["synthetic-popularity-no-quality-bonus", [35, 35], [30, 40], [0, 0], [0, 0]],
    ["synthetic-holder-with-product-reason", [75, 75], [70, 80], [75, 75], [70, 80]],
    ["synthetic-holder-only", [0, 0], [0, 5], [0, 0], [0, 0]],
    ["synthetic-grounded-uncertain-price", [85, 85], [80, 90], [85, 85], [80, 90]],
    ["synthetic-unsupported-price-with-hedge", [50, 50], [45, 55], [0, 0], [0, 0]],
    ["synthetic-buy-guaranteed-gains", [0, 0], [0, 5], [0, 0], [0, 0]],
    ["synthetic-honest-reward-disclosure", [90, 90], [85, 95], [90, 90], [85, 95]],
    ["synthetic-question-already-answered", [10, 10], [5, 15], [0, 0], [0, 0]],
    ["synthetic-project-name-wrong-topic", [50, 50], [45, 55], [0, 0], [0, 0]],
    ["synthetic-polished-strong-original-control", [75, 80], [75, 80], [75, 80], [75, 80]],
    ["synthetic-multiple-ai-writing-signals", [70, 70], [65, 75], [0, 0], [0, 0]],
    ["synthetic-single-ai-word-false-positive-control", [75, 75], [70, 80], [75, 75], [70, 80]],
    ["synthetic-image-context-limitation", [75, 75], [70, 80], [75, 75], [70, 80]],
    ["synthetic-code-only-spam", [0, 0], [0, 5], [0, 0], [0, 0]],
  ])(
    "%s: target raw %j, accepts raw %j; target credited %j, accepts credited %j",
    (id, targetRaw, raw, targetCredited, credited) => {
      expect(byId.get(id)).toMatchObject({
        target: { raw: targetRaw, credited: targetCredited },
        raw,
        credited,
      });
    },
  );

  it("keeps the founder's reason and flag expectations", () => {
    expect(byId.get("synthetic-code-only-spam")).toMatchObject({
      reason: expect.stringContaining("spam"),
      requiredFlags: ["spam"],
      forbiddenFlags: ["guideline_breach"],
    });
  });

  it("matches the checked-in harness fixture", () => {
    expect(readJson("mycel-synthetic.json")).toEqual(cases);
  });
});

describe("founder target rules", () => {
  const reviewCase = (founderLabels: Record<string, unknown>, requiredFlags: string[] = []) => ({
    cases: [
      {
        id: "case",
        contribution: { kind: "reply", text: "A reply." },
        expectedPolicy: { requiredFlags, forbiddenFlags: [] },
        founderLabels: { reason: "Founder reason.", ...founderLabels },
      },
    ],
  });

  it("clamps the tolerance at 100", () => {
    expect(founderGrades(reviewCase({ targetScore: 98 }))[0]?.expected).toMatchObject({
      raw: [93, 100],
      credited: [93, 100],
    });
  });

  it("credits exactly 0 when a required flag zeroes the credit", () => {
    expect(
      founderGrades(reviewCase({ targetScore: 90 }, ["guideline_breach"]))[0]?.expected,
    ).toMatchObject({ raw: [85, 95], credited: [0, 0] });
  });

  it.each([
    [{}],
    [{ targetScore: 70, targetScoreRange: [70, 75] }],
    [{ targetScore: 101 }],
    [{ targetScoreRange: [80, 75] }],
  ])("rejects a case without exactly one valid founder target (%#)", (labels) => {
    expect(() => founderGrades(reviewCase(labels))).toThrow();
  });
});
