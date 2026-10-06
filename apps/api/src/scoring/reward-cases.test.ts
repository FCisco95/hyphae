import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Cases, exitCode, judge, parseRuns } from "./reward-cases.js";

describe("judge", () => {
  it("passes a pay case only from the 60 floor up", () => {
    expect(judge("pass", 60)).toBe(true);
    expect(judge("pass", 59)).toBe(false);
    expect(judge("pass", 0)).toBe(false);
  });
  it("passes a zero case only at exactly 0", () => {
    expect(judge("zero", 0)).toBe(true);
    expect(judge("zero", 1)).toBe(false);
    expect(judge("zero", 72)).toBe(false);
  });
  it("never judges an any case", () => {
    expect(judge("any", 0)).toBe(true);
    expect(judge("any", 90)).toBe(true);
  });
});

describe("parseRuns", () => {
  it("accepts a positive whole number", () => {
    expect(parseRuns("1")).toBe(1);
    expect(parseRuns("4")).toBe(4);
  });
  it.each(["0", "-1", "oops", "", "1.5", "NaN", "Infinity"])("refuses %j", (value) => {
    expect(() => parseRuns(value)).toThrow(/runs/);
  });
});

describe("exitCode", () => {
  it("is 0 only when nothing missed and nothing failed", () => {
    expect(exitCode({ misses: 0, errors: 0 })).toBe(0);
    expect(exitCode({ misses: 2, errors: 0 })).toBe(1);
    expect(exitCode({ misses: 0, errors: 3 })).toBe(1);
  });
});

describe("the committed case set", () => {
  it("parses, and every case names a known task", () => {
    const file = new URL("../../../../docs/rubrics/eval/reward-eval-cases.json", import.meta.url);
    const { tasks, cases } = Cases.parse(JSON.parse(readFileSync(file, "utf8")));
    expect(cases.length).toBeGreaterThanOrEqual(20);
    for (const c of cases) expect(tasks[c.task], c.id).toBeDefined();
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });
});
