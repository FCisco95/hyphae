import { describe, expect, it } from "vitest";
import { clipRaidText, fullCreditUntil, PublicRaidSchema, publicXPost } from "./public-raids.js";
import { timingBps } from "./reward-points.js";

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
it("does not invent an author for an ID-only link", () => {
  expect(publicXPost("https://x.com/i/status/123")).toEqual({
    url: "https://x.com/i/status/123",
    handle: null,
  });
});
it("marks clipped text without splitting an emoji or exceeding the schema's UTF-16 bound", () => {
  const clipped = clipRaidText("🙂".repeat(10), 10);
  expect(clipped).toBe("🙂🙂🙂🙂…");
  expect(clipped.length).toBeLessThanOrEqual(10);
  expect(clipRaidText("Short", 10)).toBe("Short");
});
describe("full credit until", () => {
  const opens = new Date("2026-11-02T10:00:00.123Z");
  const full = 360 * 60_000;
  it("is where the reward timing stops giving full credit by rule and starts to decay", () => {
    const until = fullCreditUntil(opens, full);
    expect(until.toISOString()).toBe("2026-11-02T16:00:00.123Z");
    const timing = (submitted: number) =>
      timingBps({
        taskOpensAtMs: BigInt(opens.getTime()),
        submittedAtMs: BigInt(submitted),
        fullCreditUntilMs: BigInt(full),
        zeroCreditAtMs: BigInt(2880 * 60_000),
      });
    expect(timing(until.getTime())).toBe(10_000n);
    // Basis points round half up, so the first few seconds of decay still round to 10000.
    expect(timing(until.getTime() + 60_000)).toBeLessThan(10_000n);
  });
  it("refuses a negative or fractional window", () => {
    expect(() => fullCreditUntil(opens, -1)).toThrow(RangeError);
    expect(() => fullCreditUntil(opens, 1.5)).toThrow(RangeError);
  });
});
describe("the raid's added fields", () => {
  const raid = {
    id: "00000000-0000-4000-8000-000000000001",
    status: "open",
    opens_at: "2026-11-02T10:00:00.123000Z",
    closes_at: "2026-11-04T10:00:00.123000Z",
    brief: "",
    post: null,
  };
  it("accepts an older answer without them, and null or a time for full credit", () => {
    expect(PublicRaidSchema.safeParse(raid).success).toBe(true);
    for (const full_credit_until of [null, "2026-11-02T16:00:00.123000Z"])
      expect(PublicRaidSchema.safeParse({ ...raid, kind: "raid", full_credit_until }).success).toBe(
        true,
      );
  });
  it("rejects an unknown kind and a malformed time", () => {
    expect(PublicRaidSchema.safeParse({ ...raid, kind: "quest" }).success).toBe(false);
    expect(PublicRaidSchema.safeParse({ ...raid, full_credit_until: "soon" }).success).toBe(false);
  });
});
