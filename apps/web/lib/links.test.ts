import { describe, expect, it } from "vitest";
import * as links from "./links.js";

// The application repo is private; the program and the rubrics are public in hyphae-program.
const PUBLIC_REPO = "https://github.com/FCisco95/hyphae-program";

describe("links", () => {
  it("sends every GitHub link to the public program repo", () => {
    const github = Object.values(links).filter((v: string) => v.includes("github.com"));
    expect(github.length).toBeGreaterThan(3);
    for (const url of github) expect(url.startsWith(PUBLIC_REPO)).toBe(true);
  });

  it("points at the program repo's licence, rubrics and verification", () => {
    expect(links.LICENSE).toBe(`${PUBLIC_REPO}/blob/main/LICENSE`);
    expect(links.RUBRICS).toBe(`${PUBLIC_REPO}/tree/main/rubrics`);
    expect(links.VERIFY_BUILD).toBe(`${PUBLIC_REPO}#verify-the-build`);
    expect(links.DEVNET_RECORD).toBe(`${PUBLIC_REPO}#a-full-run-on-devnet`);
  });
});
