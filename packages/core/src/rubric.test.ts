import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RubricSchema } from "./rubric.js";

const load = (file: string) =>
  RubricSchema.parse(
    JSON.parse(readFileSync(new URL(`../../../docs/rubrics/${file}`, import.meta.url), "utf8")),
  );

describe("rubric", () => {
  it("every published MYCEL rubric parses", () => {
    for (const v of ["1.0.0", "1.1.0"]) {
      const rubric = load(`mycel-${v}.json`);
      expect(rubric.version).toBe(v);
      expect(rubric.timing).toEqual({ fullUntil: 360, zeroAt: 2880 });
      expect(rubric.criteria.map((c) => c.key)).toEqual([
        "context_fit",
        "own_voice",
        "value_angle",
      ]);
      expect(rubric.criteria.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1);
    }
  });

  it("1.1.0 scopes the never list to a specific coin and allows general market talk", () => {
    const g = load("mycel-1.1.0.json").guidelines;
    expect(g).toMatch(/about MYCEL or any specific coin/);
    expect(g).toMatch(/General market talk is opinion, not a breach/);
  });

  it("rejects a malformed rubric", () => {
    expect(RubricSchema.safeParse({ version: "1" }).success).toBe(false);
  });
});
