import { describe, expect, it } from "vitest";
import { rowState } from "./format.js";

describe("public row state", () => {
  it("shows the scoring state without an eligibility checklist", () => {
    expect(rowState({ state: "counted" })).toBe("Scored.");
    expect(rowState({ state: "pending" })).toBe("Not scored yet.");
  });
});
