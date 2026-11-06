import { describe, expect, it } from "vitest";
import * as core from "./index.js";

describe("private administration contract", () => {
  const overview = {
    state: "admin",
    community: { mint: "MYCEL", name: "My community" },
    intake: { paused: false, paused_at: null },
    as_of: "2026-11-06T18:30:00.000Z",
  };

  it("exports an authenticated overview schema with a consistent pause state", () => {
    expect(core).toHaveProperty("AdminCommunitySchema");
    const schema = core.AdminCommunitySchema;
    expect(schema.safeParse(overview).success).toBe(true);
    expect(
      schema.safeParse({ ...overview, intake: { paused: true, paused_at: null } }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...overview, intake: { paused: false, paused_at: overview.as_of } })
        .success,
    ).toBe(false);
    expect(schema.safeParse({ ...overview, state: "member" }).success).toBe(false);
    expect(schema.safeParse({ ...overview, payout_enabled: true }).success).toBe(false);
  });

  it("requires an explicit observed pause value and rejects authority or payout fields", () => {
    expect(core).toHaveProperty("AdminIntakeUpdateSchema");
    const schema = core.AdminIntakeUpdateSchema;
    expect(schema.safeParse({ paused: true, expected_paused_at: null }).success).toBe(true);
    expect(schema.safeParse({ paused: false, expected_paused_at: overview.as_of }).success).toBe(
      true,
    );
    for (const value of [
      { paused: true },
      { paused: "false", expected_paused_at: null },
      { paused: false, expected_paused_at: "yesterday" },
      { paused: false, expected_paused_at: null, admin: "123" },
      { paused: false, expected_paused_at: null, payout_enabled: true },
    ])
      expect(schema.safeParse(value).success).toBe(false);
  });
});
