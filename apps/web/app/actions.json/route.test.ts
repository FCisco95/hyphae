import { describe, expect, it } from "vitest";
import { GET, OPTIONS } from "./route.js";

// A blink client's mapping of a page path to its Action (the Actions spec's actions.json rules):
// `*` is one path segment, a trailing `**` the rest, each filling the apiPath's wildcards in order.
function mapped(rules: { pathPattern: string; apiPath: string }[], path: string) {
  for (const { pathPattern, apiPath } of rules) {
    const pattern = pathPattern.replace(/\*\*/g, "(.*)").replace(/\/\*/g, "/([^/]+)");
    const match = new RegExp(`^${pattern}$`).exec(path);
    if (match) return match.slice(1).reduce((p, segment) => p.replace(/\*+/, segment), apiPath);
  }
  return null;
}

describe("/actions.json", () => {
  it("maps a shared claim page to its Action, and the Action to itself", async () => {
    const r = GET();
    expect(r.status).toBe(200);
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect(r.headers.get("x-action-version")).toBe("2.4");
    const { rules } = await r.json();
    expect(mapped(rules, "/c/MintAbc/e/2/claim")).toBe("/api/actions/claim/MintAbc/2");
    expect(mapped(rules, "/api/actions/claim/MintAbc/2")).toBe("/api/actions/claim/MintAbc/2");
    for (const page of ["/", "/c/MintAbc", "/c/MintAbc/e/2", "/c/MintAbc/e/2/leaderboard"]) {
      expect(mapped(rules, page), page).toBeNull();
    }
  });

  it("answers a preflight with the same CORS headers", () => {
    const r = OPTIONS();
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect(r.headers.get("access-control-allow-methods")).toBe("GET,POST,PUT,OPTIONS");
  });
});
