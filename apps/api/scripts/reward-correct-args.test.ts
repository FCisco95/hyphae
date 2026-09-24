import { describe, expect, it } from "vitest";
import { parseCorrectionArgs } from "./reward-correct-args.js";

const ID = "7d4f7c1e-2b1a-4c55-9a0e-3f4b5c6d7e8f";
const base = [
  ID,
  "--expected-revision",
  "1",
  "--reason",
  "Restates the post.",
  "--evidence",
  "https://x.com/a/status/1",
];

describe("parseCorrectionArgs", () => {
  it("builds a correction whose actor is the script and whose key is derived from its content", () => {
    const parsed = parseCorrectionArgs([
      ...base,
      "--raw-quality",
      "70",
      "--flags",
      "spam,off_topic",
    ]);
    expect(parsed).toMatchObject({
      contributionId: ID,
      expectedRevision: 1,
      changes: { rawQuality: 70, flags: ["spam", "off_topic"] },
      reason: "Restates the post.",
      evidenceRefs: ["https://x.com/a/status/1"],
      actor: "script:reward-correct",
    });
    expect(parsed.idempotencyKey).toMatch(/^script:reward-correct:[0-9a-f]{64}$/);
    // Re-running the same command replays; any different correction is a different key.
    expect(
      parseCorrectionArgs([...base, "--raw-quality", "70", "--flags", "spam,off_topic"])
        .idempotencyKey,
    ).toBe(parsed.idempotencyKey);
    expect(parseCorrectionArgs([...base, "--raw-quality", "71"]).idempotencyKey).not.toBe(
      parsed.idempotencyKey,
    );
  });

  it("accepts repeated evidence, clearing all flags, and an effort verdict", () => {
    expect(
      parseCorrectionArgs([
        ...base,
        "--evidence",
        "https://github.com/x/y",
        "--flags",
        "none",
        "--effort",
        "eligible",
      ]),
    ).toMatchObject({
      evidenceRefs: ["https://x.com/a/status/1", "https://github.com/x/y"],
      changes: { flags: [], effort: "eligible" },
    });
  });

  it("refuses points, unknown flags, bad numbers and missing audit fields", () => {
    expect(() => parseCorrectionArgs([...base])).toThrow(/usage/);
    expect(() => parseCorrectionArgs([...base, "--points", "255"])).toThrow();
    expect(() => parseCorrectionArgs([...base, "--flags", "great"])).toThrow();
    expect(() => parseCorrectionArgs([...base, "--raw-quality", "101"])).toThrow();
    expect(() => parseCorrectionArgs([...base, "--raw-quality", "7.5"])).toThrow();
    expect(() => parseCorrectionArgs([...base, "--effort", "maybe"])).toThrow();
    expect(() =>
      parseCorrectionArgs([
        ID,
        "--expected-revision",
        "1",
        "--evidence",
        "e",
        "--raw-quality",
        "70",
      ]),
    ).toThrow(/usage/);
    expect(() =>
      parseCorrectionArgs([ID, "--expected-revision", "1", "--reason", "r", "--raw-quality", "70"]),
    ).toThrow(/usage/);
  });
});
