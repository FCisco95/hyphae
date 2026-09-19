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

  it.each(
    [
      [],
      [fixture, fixture],
      [{ ...fixture, contribution: { kind: "reply", text: " " } }],
      [{ ...fixture, expected: { ...fixture.expected, raw: [90, 80] } }],
      [{ ...fixture, expected: { ...fixture.expected, credited: [-1, 101] } }],
      [{ ...fixture, expected: { ...fixture.expected, founderGrade: 6 } }],
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

  it("applies the AI cap and floor before comparison", () => {
    const result = compareScore(
      { ...output, flags: ["ai_slop"], aiSlop: { patterns: [], templateRhythm: true } },
      { ...expected, credited: [0, 0], requiredFlags: ["ai_slop"] },
    );
    expect(result).toEqual({ raw: 84, credited: 0, passed: true, failures: [] });
  });

  it("catches a missing required flag even when the numeric grade matches", () => {
    expect(compareScore(output, { ...expected, requiredFlags: ["low_effort"] }).failures).toEqual([
      "missing flag low_effort",
    ]);
  });
});
