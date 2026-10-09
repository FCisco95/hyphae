import { describe, expect, it } from "vitest";
import { telegramIdentity } from "./identity.js";

const subject = "did:privy:fixture";
const user = (linked_accounts: unknown) => ({ id: subject, linked_accounts });
describe("fresh provider identity", () => {
  it("normalizes the server Telegram ID", () => {
    expect(telegramIdentity(user([{ type: "telegram", telegram_user_id: "123" }]), subject)).toBe(
      123n,
    );
  });
  it("requires the current provider subject", () => {
    expect(() =>
      telegramIdentity({ id: "did:privy:other", linked_accounts: [] }, subject),
    ).toThrow();
  });
  it("returns no identity for an unlinked account", () => {
    expect(
      telegramIdentity(user([{ type: "email", address: "fixture@example.test" }]), subject),
    ).toBeNull();
  });
  it.each(["0", "01", "-1", "1.5", "9007199254740992", "abc", "1\n", 123, null])(
    "rejects invalid Telegram ID %s",
    (value) => {
      expect(() =>
        telegramIdentity(user([{ type: "telegram", telegram_user_id: value }]), subject),
      ).toThrow();
    },
  );
  it("rejects ambiguity even when duplicated links agree", () => {
    const link = { type: "telegram", telegram_user_id: "123" };
    expect(() => telegramIdentity(user([link, link]), subject)).toThrow();
  });
  it.each([null, {}, { id: subject }, user({}), user(null), user([null])])(
    "fails closed on malformed provider record %o",
    (value) => {
      expect(() => telegramIdentity(value, subject)).toThrow();
    },
  );
  it("accepts the maximum safe Telegram ID", () => {
    expect(
      telegramIdentity(user([{ type: "telegram", telegram_user_id: "9007199254740991" }]), subject),
    ).toBe(9007199254740991n);
  });
});
