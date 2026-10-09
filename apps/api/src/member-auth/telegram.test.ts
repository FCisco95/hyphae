import { describe, expect, it } from "vitest";
import { telegramMembership } from "./telegram.js";

describe("Telegram cancellation boundary", () => {
  it("bridges cancellation and preserves exact community/user arguments", async () => {
    const abort = new AbortController();
    let observed = false;
    const check = telegramMembership({
      getChatMember: async (chat, user, signal) => {
        expect(chat).toBe("-100123");
        expect(user).toBe(123);
        abort.abort();
        observed = signal?.aborted ?? false;
        return { status: "member", user: { id: 123, is_bot: false, first_name: "Fixture" } };
      },
    });
    await check(-100123n, 123n, abort.signal);
    expect(observed).toBe(true);
  });
  it("does not start a Telegram read after cancellation", async () => {
    const abort = new AbortController();
    abort.abort();
    let started = false;
    const check = telegramMembership({
      getChatMember: async () => {
        started = true;
        return { status: "member", user: { id: 123, is_bot: false, first_name: "Fixture" } };
      },
    });
    await expect(check(-100123n, 123n, abort.signal)).rejects.toThrow();
    expect(started).toBe(false);
  });
});
