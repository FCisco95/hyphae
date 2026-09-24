import { describe, expect, it, vi } from "vitest";

vi.mock("../../db.js", () => ({ db: {} }));
vi.mock("../../env.js", () => ({ env: { LINK_ORIGIN: "https://api.hyphae.test" } }));

const { isMemberStatus, parseStartPayload, startPayload } = await import("./link.js");
const id = "3f1c2a9e-0b4d-4c8e-9f11-2a3b4c5d6e7f";

describe("link deep link", () => {
  it("round-trips a community id within Telegram's 64-character payload limit", () => {
    const p = startPayload(id);
    expect(p).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(parseStartPayload(p)).toBe(id);
  });

  it("rejects anything else", () => {
    for (const bad of ["", "link_", "link_not-a-uuid", `x${startPayload(id)}`, "link_../../"]) {
      expect(parseStartPayload(bad)).toBeUndefined();
    }
  });
});

describe("isMemberStatus", () => {
  it("accepts members, admins, creators and restricted members only", () => {
    expect(isMemberStatus({ status: "member" })).toBe(true);
    expect(isMemberStatus({ status: "administrator" })).toBe(true);
    expect(isMemberStatus({ status: "creator" })).toBe(true);
    expect(isMemberStatus({ status: "restricted", is_member: true })).toBe(true);
    expect(isMemberStatus({ status: "restricted", is_member: false })).toBe(false);
    expect(isMemberStatus({ status: "left" })).toBe(false);
    expect(isMemberStatus({ status: "kicked" })).toBe(false);
  });
});
