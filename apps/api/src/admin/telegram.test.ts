import { describe, expect, it } from "vitest";
import { type AdminTelegramApi, telegramAdministrator } from "./telegram.js";

function fixture(change?: (api: AdminTelegramApi) => void) {
  const calls: unknown[] = [];
  const api: AdminTelegramApi = {
    getMe: async () => ({ id: 99, is_bot: true }),
    getChatMember: async (chat, user, signal) => {
      calls.push({ chat, user, signal });
      return {
        status: user === 99 ? "administrator" : "creator",
        user: { id: user, is_bot: user === 99 },
      };
    },
  };
  change?.(api);
  return { check: telegramAdministrator(api), calls };
}

describe("fresh Telegram admin authority", () => {
  it("checks bot lookup authority and the exact designated actor in the exact group", async () => {
    const { check, calls } = fixture();
    expect(await check(-100123n, 7n, new AbortController().signal)).toBe(true);
    expect(calls).toMatchObject([
      { chat: "-100123", user: 99 },
      { chat: "-100123", user: 7 },
    ]);
  });

  it.each(["member", "restricted", "left", "kicked"])(
    "refuses a designated actor whose current status is %s",
    async (status) => {
      const { check } = fixture((api) => {
        const original = api.getChatMember;
        api.getChatMember = async (chat, user, signal) => ({
          ...(await original(chat, user, signal)),
          status: user === 7 ? status : "administrator",
        });
      });
      expect(await check(-100123n, 7n, new AbortController().signal)).toBe(false);
    },
  );

  it("refuses bot impersonation, mismatched identities, unsafe actor IDs and missing lookup authority", async () => {
    for (const wrong of [
      { id: 8, is_bot: false },
      { id: 7, is_bot: true },
    ]) {
      const { check } = fixture((api) => {
        const original = api.getChatMember;
        api.getChatMember = async (chat, user, signal) =>
          user === 7 ? { status: "administrator", user: wrong } : original(chat, user, signal);
      });
      expect(await check(-100123n, 7n, new AbortController().signal)).toBe(false);
    }
    const { check } = fixture((api) => {
      api.getChatMember = async (_chat, user) => ({
        status: "member",
        user: { id: user, is_bot: user === 99 },
      });
    });
    expect(await check(-100123n, 7n, new AbortController().signal)).toBe(false);
    expect(await fixture().check(-100123n, 9007199254740992n, new AbortController().signal)).toBe(
      false,
    );
  });

  it("bridges abort to grammY and does not start calls after cancellation", async () => {
    const abort = new AbortController();
    let started = 0;
    const { check } = fixture((api) => {
      api.getMe = async (signal) => {
        started++;
        abort.abort();
        expect(signal?.aborted).toBe(true);
        return { id: 99, is_bot: true };
      };
    });
    await expect(check(-100123n, 7n, abort.signal)).rejects.toThrow("unavailable");
    await expect(check(-100123n, 7n, abort.signal)).rejects.toThrow("unavailable");
    expect(started).toBe(1);
  });
});
