import { describe, expect, it, vi } from "vitest";
import { parseSetupManifest } from "./manifest.js";
import { verifySetupTelegram } from "./telegram.js";
import { manifest, telegramFor } from "./test-fixture.js";

describe("setup Telegram preflight", () => {
  it.each([
    { id: 12, is_bot: false },
    { id: 11, is_bot: true },
  ])(
    "refuses an administrator response with the wrong identity or a bot account: %j",
    async (user) => {
      const reader = telegramFor();
      const actual = reader.getChatMember;
      reader.getChatMember = async (chat, id) =>
        id === 11 ? { user, status: "administrator" } : actual(chat, id);
      await expect(verifySetupTelegram(parseSetupManifest(manifest()), reader)).rejects.toThrow(
        "telegram_admin_unverified",
      );
    },
  );
  it("only reads the exact configured bot, group and designated admin", async () => {
    const reader = telegramFor();
    const getMember = vi.spyOn(reader, "getChatMember");
    await verifySetupTelegram(parseSetupManifest(manifest()), reader);
    expect(getMember.mock.calls).toEqual([
      [-100100, 99],
      [-100100, 11],
    ]);
  });

  it.each(["group", "supergroup"])("accepts an existing %s without migration", async (type) => {
    const reader = telegramFor();
    reader.getChat = async () => ({ id: -100100, type });
    await expect(
      verifySetupTelegram(parseSetupManifest(manifest()), reader),
    ).resolves.toBeUndefined();
  });

  it.each(["member", "left", "kicked", "restricted"])("refuses admin status %s", async (status) => {
    const reader = telegramFor();
    const actual = reader.getChatMember;
    reader.getChatMember = async (chat, user) => ({
      ...(await actual(chat, user)),
      status: user === 11 ? status : "administrator",
    });
    await expect(verifySetupTelegram(parseSetupManifest(manifest()), reader)).rejects.toThrow(
      "telegram_admin_unverified",
    );
  });

  it("refuses a wrong bot, wrong chat, private chat or bot without admin lookup authority", async () => {
    const m = parseSetupManifest(manifest());
    const wrongBot = telegramFor();
    wrongBot.getMe = async () => ({ id: 98, is_bot: true });
    await expect(verifySetupTelegram(m, wrongBot)).rejects.toThrow("telegram_bot_mismatch");
    const wrongChat = telegramFor();
    wrongChat.getChat = async () => ({ id: -100101, type: "supergroup" });
    await expect(verifySetupTelegram(m, wrongChat)).rejects.toThrow("telegram_chat_mismatch");
    wrongChat.getChat = async () => ({ id: -100100, type: "private" });
    await expect(verifySetupTelegram(m, wrongChat)).rejects.toThrow("telegram_chat_mismatch");
    const notAdmin = telegramFor();
    notAdmin.getChatMember = async (_chat, user) => ({
      user: { id: user, is_bot: true },
      status: "member",
    });
    await expect(verifySetupTelegram(m, notAdmin)).rejects.toThrow("telegram_bot_not_admin");
  });

  it("never exposes provider errors that may carry a bot token", async () => {
    const reader = telegramFor();
    reader.getMe = async () => {
      throw new Error("private-bot-token provider failure");
    };
    await expect(verifySetupTelegram(parseSetupManifest(manifest()), reader)).rejects.toThrow(
      /^telegram_unavailable$/,
    );
  });
});
