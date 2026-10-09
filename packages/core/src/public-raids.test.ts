import { describe, expect, it } from "vitest";
import { publicXPost } from "./public-raids.js";

describe("public post links", () => {
  it("normalizes X and Twitter links and strips tracking parameters", () => {
    expect(publicXPost("https://twitter.com/owner/status/123?s=20#tracking")).toEqual({
      url: "https://x.com/owner/status/123",
      handle: "owner",
    });
  });
  it("rejects credentials, lookalike hosts, executable links and unrelated paths", () => {
    for (const url of [
      "javascript:alert(1)",
      "https://x.com.evil.test/a/status/1",
      "https://user:pass@x.com/a/status/1",
      "https://x.com:444/a/status/1",
      "http://x.com/a/status/1",
      "https://x.com/settings",
      "https://x.com/a/status/not-a-number",
      null,
    ])
      expect(publicXPost(url)).toBeNull();
  });
});
