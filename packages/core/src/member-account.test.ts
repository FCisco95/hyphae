import { describe, expect, it } from "vitest";
import { MemberAccountSchema } from "./member-account.js";

const base = {
  community: { mint: "So11111111111111111111111111111111111111112", name: "Fixture" },
  as_of: "2026-10-09T12:00:00.000Z",
};
describe("private member contract", () => {
  it.each(["telegram_required", "join_required", "member_not_registered"])(
    "accepts %s without private selectors",
    (state) => {
      expect(MemberAccountSchema.parse({ ...base, state })).toEqual({ ...base, state });
    },
  );
  it.each(["email", "telegram_user_id", "subject", "member_id"])(
    "rejects leaked %s instead of stripping it",
    (field) => {
      expect(
        MemberAccountSchema.safeParse({ ...base, state: "telegram_required", [field]: "private" })
          .success,
      ).toBe(false);
    },
  );
  it.each(["paste", "signature"])("accepts current %s wallet evidence", (status) => {
    expect(
      MemberAccountSchema.safeParse({
        ...base,
        state: "member",
        wallet: { address: base.community.mint, status },
      }).success,
    ).toBe(true);
  });
  it("accepts an explicitly absent wallet", () => {
    expect(
      MemberAccountSchema.safeParse({
        ...base,
        state: "member",
        wallet: { address: null, status: "none" },
      }).success,
    ).toBe(true);
  });
  it.each([
    { address: null, status: "signature" },
    { address: base.community.mint, status: "none" },
    { address: "bad/wallet", status: "paste" },
    { address: base.community.mint, status: "paid" },
  ])("rejects inconsistent wallet evidence %o", (wallet) => {
    expect(MemberAccountSchema.safeParse({ ...base, state: "member", wallet }).success).toBe(false);
  });
  it("rejects wallet exposure for unresolved membership", () => {
    expect(
      MemberAccountSchema.safeParse({
        ...base,
        state: "join_required",
        wallet: { address: base.community.mint, status: "signature" },
      }).success,
    ).toBe(false);
  });
  it("rejects invalid dates and unknown nested fields", () => {
    expect(
      MemberAccountSchema.safeParse({ ...base, state: "member_not_registered", as_of: "yesterday" })
        .success,
    ).toBe(false);
    expect(
      MemberAccountSchema.safeParse({
        ...base,
        state: "telegram_required",
        community: { ...base.community, chat_id: "private" },
      }).success,
    ).toBe(false);
  });
});
