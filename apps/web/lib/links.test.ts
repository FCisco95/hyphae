import { describe, expect, it } from "vitest";
import * as links from "./links.js";

// Both repositories are public: the program and the rubrics in hyphae-program, the application,
// its reviews and SECURITY.md in hyphae.
const PUBLIC_REPO = "https://github.com/FCisco95/hyphae-program";
const APP_REPO = "https://github.com/FCisco95/hyphae";

describe("links", () => {
  it("sends every GitHub link to one of the two public repos", () => {
    const github = Object.values(links).filter((v: string) => v.includes("github.com"));
    expect(github.length).toBeGreaterThan(3);
    for (const url of github) {
      expect(url === APP_REPO || url.startsWith(PUBLIC_REPO), url).toBe(true);
    }
  });

  it("sends the API docs to the API's own reference page", () => {
    expect(links.API_DOCS).toBe("https://hyphae-api.fly.dev/docs");
  });

  it("points at the program repo's licence, rubrics and verification", () => {
    expect(links.LICENSE).toBe(`${PUBLIC_REPO}/blob/main/LICENSE`);
    expect(links.RUBRICS).toBe(`${PUBLIC_REPO}/tree/main/rubrics`);
    expect(links.VERIFY_BUILD).toBe(`${PUBLIC_REPO}#verify-the-build`);
    expect(links.DEVNET_RECORD).toBe(`${PUBLIC_REPO}#a-full-run-on-devnet`);
  });
});
