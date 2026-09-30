import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RubricSchema } from "./rubric.js";
import { creditedScore, creditReason, type ScoreOutput } from "./score.js";

const load = (file: string) =>
  RubricSchema.parse(
    JSON.parse(readFileSync(new URL(`../../../docs/rubrics/${file}`, import.meta.url), "utf8")),
  );

describe("rubric", () => {
  it("every published or candidate MYCEL rubric parses", () => {
    for (const v of ["1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.3.1"]) {
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

  it("1.2.0 opens context fit to on-theme takes", () => {
    const r = load("mycel-1.2.0.json");
    expect(r.criteria.find((c) => c.key === "context_fit")?.description).toMatch(/theme/);
    expect(r.guidelines).toMatch(/A real take on the post/);
  });

  // Founder rulings 2026-09-29: strikes are not built, so the candidate stops promising them; and
  // an unedited AI draft is capped rather than zeroed, so it leaves "What earns zero".
  it("1.3.1 is 1.3.0 without strikes, its AI-draft line moved to how grading works", () => {
    const [was, is] = [load("mycel-1.3.0.json"), load("mycel-1.3.1.json")];
    const strikes =
      "Strikes: first = warning, second = you lose this epoch's points, third = 30 days out of paid raids. Every strike shows you why. ";
    const zeroLine = "Text that reads like an unedited AI draft. ";
    const breach = 'A breach of the "never" list is 0. ';
    const capped =
      "Text that reads like an unedited AI draft: capped at 79, or at 40 when obvious, and a score under 60 earns zero. ";
    for (const line of [strikes, zeroLine, breach]) expect(was.guidelines).toContain(line);
    expect(is).toEqual({
      ...was,
      version: "1.3.1",
      guidelines: was.guidelines
        .replace(strikes, "")
        .replace(zeroLine, "")
        .replace(breach, breach + capped),
    });
    expect(is.guidelines).not.toMatch(/strike/i);
  });

  it("1.3.1 promises the AI-draft caps the credit rule applies", () => {
    const g = load("mycel-1.3.1.json").guidelines;
    expect(g.split("\n\n").find((p) => p.startsWith("What earns zero."))).not.toMatch(/AI draft/);
    expect(g).toContain("capped at 79, or at 40 when obvious, and a score under 60 earns zero");
    const draft = (score: number, templateRhythm: boolean): ScoreOutput => ({
      score,
      rubricHits: [],
      flags: ["ai_slop"],
      aiSlop: { patterns: [], templateRhythm },
      reasoning: "Reads like an unedited AI draft.",
    });
    expect(creditedScore(draft(100, false))).toBe(79);
    expect(creditedScore(draft(59, false))).toBe(0);
    expect(creditReason(draft(100, true))).toBe(
      "reads AI-written, capped at 40, below the 60 floor",
    );
    expect(creditedScore(draft(100, true))).toBe(0);
  });

  it("rejects a malformed rubric", () => {
    expect(RubricSchema.safeParse({ version: "1" }).success).toBe(false);
  });
});
