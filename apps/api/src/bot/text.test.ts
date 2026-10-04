import { describe, expect, it } from "vitest";
import { clipMessageText } from "./text.js";

describe("bounded Telegram text", () => {
  it("keeps emoji complete at every clipping boundary used by raid messages", () => {
    for (const limit of [200, 400, 1000]) {
      const value = clipMessageText(`a${"🌱".repeat(limit)}`, limit);
      expect(value.length).toBeLessThanOrEqual(limit);
      expect(value).toMatch(/…$/);
      expect(value).not.toMatch(
        /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u,
      );
    }
  });
  it("preserves untruncated text", () => {
    expect(clipMessageText("one 🌱", 200)).toBe("one 🌱");
  });
});
