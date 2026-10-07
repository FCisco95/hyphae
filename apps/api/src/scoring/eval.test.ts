import type { ScoreOutput } from "@hyphae/core";
import { describe, expect, it } from "vitest";
import { compareScore, EvalCasesSchema } from "./eval.js";

const fixture = {
  id: "on-theme",
  contribution: { kind: "reply", text: "A longer holding period gives the team time to build." },
  expected: {
    founderGrade: 4,
    reason: "A relevant opinion on the post's theme.",
    raw: [80, 90],
    credited: [80, 90],
    forbiddenFlags: ["off_topic", "guideline_breach"],
  },
};
const output: ScoreOutput = {
  score: 84,
  rubricHits: [],
  flags: [],
  aiSlop: { patterns: [], templateRhythm: false },
  reasoning: "You add a relevant opinion about the time needed to build.",
};

describe("evaluation fixtures", () => {
  it("accepts labelled cases without converting a founder grade into a score range", () => {
    const [parsed] = EvalCasesSchema.parse([fixture]);
    expect(parsed?.expected.raw).toEqual([80, 90]);
    expect(parsed?.expected.founderGrade).toBe(4);
  });

  it("accepts a founder target in place of a 0–5 grade", () => {
    const { founderGrade: _, ...labels } = fixture.expected;
    const [parsed] = EvalCasesSchema.parse([
      { ...fixture, expected: { ...labels, target: { raw: [85, 85], credited: [85, 85] } } },
    ]);
    expect(parsed?.expected.target).toEqual({ raw: [85, 85], credited: [85, 85] });
  });

  it.each(
    [
      [],
      [fixture, fixture],
      [{ ...fixture, contribution: { kind: "reply", text: " " } }],
      [{ ...fixture, expected: { ...fixture.expected, raw: [90, 80] } }],
      [{ ...fixture, expected: { ...fixture.expected, credited: [-1, 101] } }],
      [{ ...fixture, expected: { ...fixture.expected, founderGrade: 6 } }],
      [
        {
          ...fixture,
          expected: { ...fixture.expected, target: { raw: [90, 80], credited: [0, 0] } },
        },
      ],
      [{ ...fixture, expected: { ...fixture.expected, forbiddenFlags: ["typo"] } }],
      [{ ...fixture, expected: { ...fixture.expected, requiredFlags: ["off_topic"] } }],
    ].map((cases) => ({ cases })),
  )("rejects invalid or ambiguous labels before model calls (%#)", ({ cases }) => {
    expect(EvalCasesSchema.safeParse(cases).success).toBe(false);
  });
});

describe("score comparison", () => {
  const parsed = EvalCasesSchema.parse([fixture])[0];
  if (!parsed) throw new Error("fixture is missing");
  const expected = parsed.expected;

  it.each([80, 90])("includes range boundary %i", (score) => {
    expect(compareScore({ ...output, score }, expected)).toEqual({
      raw: score,
      credited: score,
      passed: true,
      failures: [],
    });
  });

  it("reports the observed undergrade against both expected ranges", () => {
    expect(compareScore({ ...output, score: 38 }, expected)).toEqual({
      raw: 38,
      credited: 0,
      passed: false,
      failures: ["raw 38 outside 80-90", "credited 0 outside 80-90"],
    });
  });

  it("compares credited scores after hard-zero rules, even with good raw quality", () => {
    const result = compareScore({ ...output, flags: ["guideline_breach"] }, expected);
    expect(result.credited).toBe(0);
    expect(result.failures).toEqual([
      "credited 0 outside 80-90",
      "forbidden flag guideline_breach",
    ]);
  });

  it("credits zero for low_effort, whatever the raw score (Cisco's ruling 1, eval only)", () => {
    const result = compareScore({ ...output, flags: ["low_effort"] }, expected);
    expect(result.raw).toBe(84);
    expect(result.credited).toBe(0);
    expect(result.failures).toEqual(["credited 0 outside 80-90"]);
  });

  it("applies the AI cap and floor before comparison", () => {
    const result = compareScore(
      { ...output, flags: ["ai_slop"], aiSlop: { patterns: [], templateRhythm: true } },
      { ...expected, credited: [0, 0], requiredFlags: ["ai_slop"] },
    );
    expect(result).toEqual({ raw: 84, credited: 0, passed: true, failures: [] });
  });

  it("reports the absolute error against the founder target, zero inside a target range", () => {
    const targeted = {
      ...expected,
      target: { raw: [70, 70] as [number, number], credited: [75, 80] as [number, number] },
    };
    expect(compareScore({ ...output, score: 84 }, targeted).error).toEqual({
      raw: 14,
      credited: 4,
    });
    expect(compareScore({ ...output, score: 77 }, targeted).error).toEqual({
      raw: 7,
      credited: 0,
    });
  });

  it("catches a missing required flag even when the numeric grade matches", () => {
    expect(compareScore(output, { ...expected, requiredFlags: ["low_effort"] }).failures).toEqual([
      "missing flag low_effort",
    ]);
  });
});
