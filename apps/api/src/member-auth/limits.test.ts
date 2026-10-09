import { describe, expect, it } from "vitest";
import { tokenBucket } from "./limits.js";

describe("private read budgets", () => {
  it("caps a subject burst at five and replenishes twenty per minute", () => {
    let time = 0;
    const allow = tokenBucket({ capacity: 5, refillPerMinute: 20, now: () => time });
    for (let i = 0; i < 5; i++) expect(allow("subject-a")).toBe(true);
    expect(allow("subject-a")).toBe(false);
    time = 2999;
    expect(allow("subject-a")).toBe(false);
    time = 3000;
    expect(allow("subject-a")).toBe(true);
    expect(allow("subject-a")).toBe(false);
    expect(allow("subject-b")).toBe(true);
  });
  it("bounds sustained accepted requests", () => {
    let time = 0;
    const allow = tokenBucket({ capacity: 5, refillPerMinute: 20, now: () => time });
    let accepted = 0;
    for (time = 0; time < 60000; time += 100) if (allow("subject")) accepted++;
    expect(accepted).toBe(24);
  });
  it("fails closed at capacity instead of evicting active subjects", () => {
    let time = 0;
    const allow = tokenBucket({ capacity: 1, refillPerMinute: 60, now: () => time });
    for (let i = 0; i < 10000; i++) expect(allow(`subject-${i}`)).toBe(true);
    expect(allow("overflow")).toBe(false);
    expect(allow("subject-0")).toBe(false);
    time = 1000;
    expect(allow("overflow")).toBe(true);
  });
});
