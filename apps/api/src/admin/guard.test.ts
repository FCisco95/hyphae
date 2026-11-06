import { describe, expect, it } from "vitest";
import { assertActive } from "./guard.js";

describe("admin deadline fence", () => {
  it("rejects elapsed wall-clock deadlines even before the timer callback runs", () => {
    expect(() => assertActive(new AbortController().signal, Date.now() - 1)).toThrow("unavailable");
  });
});
