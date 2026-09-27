import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CUSTODY_POLICY, CUSTODY_POLICY_URL, CUSTODY_SUMMARY } from "./custody.js";

describe("the custody policy", () => {
  it("is in the README word for word, where its link points", () => {
    const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");
    expect(readme.replace(/\*\*/g, "").replace(/\s+/g, " ")).toContain(CUSTODY_POLICY);
    expect(CUSTODY_POLICY_URL).toBe("https://github.com/FCisco95/hyphae#custody-during-the-pilot");
    expect(readme).toContain("## Custody during the pilot");
  });

  it("opens with its summary, and names the upgrade key", () => {
    expect(CUSTODY_POLICY.startsWith(CUSTODY_SUMMARY)).toBe(true);
    expect(CUSTODY_POLICY).toContain("The program can still be upgraded.");
  });
});
