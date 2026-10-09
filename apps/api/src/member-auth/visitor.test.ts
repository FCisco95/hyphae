import { describe, expect, it } from "vitest";
import { ipBucketKey } from "./visitor.js";

describe("private visitor address budgets", () => {
  it("groups IPv6 rotation and equivalent spellings within one64-bit network", () => {
    expect(ipBucketKey("2001:db8::1")).toBe(ipBucketKey("2001:0db8:0:0::2"));
    expect(ipBucketKey("2001:db8::1")).not.toBe(ipBucketKey("2001:db8:1::1"));
  });
  it("keeps distinct IPv4 addresses separate, including mapped addresses", () => {
    expect(ipBucketKey("192.0.2.1")).not.toBe(ipBucketKey("192.0.2.2"));
    expect(ipBucketKey("192.0.2.1")).toBe(ipBucketKey("::ffff:192.0.2.1"));
  });
  it.each([undefined, "forged", "::not-ip", "...", "fe80::1%zone"])(
    "uses a shared local budget for invalid address %s",
    (ip) => {
      expect(ipBucketKey(ip)).toBe("local");
    },
  );
});
