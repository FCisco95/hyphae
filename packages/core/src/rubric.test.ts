import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RubricSchema } from "./rubric.js";

describe("rubric", () => {
  it("the published MYCEL v1.0.0 rubric parses", () => {
    const raw = JSON.parse(
      readFileSync(new URL("../../../docs/rubrics/mycel-1.0.0.json", import.meta.url), "utf8"),
    );
    const rubric = RubricSchema.parse(raw);
    expect(rubric.version).toBe("1.0.0");
    expect(rubric.timing).toEqual({ fullUntil: 360, zeroAt: 2880 });
    expect(rubric.criteria.map((c) => c.key)).toEqual(["context_fit", "own_voice", "value_angle"]);
    expect(rubric.criteria.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1);
    expect(rubric.guidelines).toMatch(/Never/);
  });

  it("rejects a malformed rubric", () => {
    expect(RubricSchema.safeParse({ version: "1" }).success).toBe(false);
  });
});
