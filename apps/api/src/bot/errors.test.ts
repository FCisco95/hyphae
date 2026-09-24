import { Api, Bot, BotError, Context, GrammyError, HttpError } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { describe, expect, it, vi } from "vitest";
import { botErrorFields, logBotError } from "./errors.js";

const TOKEN = "1234567890:AAH-test-token-that-must-never-be-logged";
const me = {
  id: 1234567890,
  is_bot: true,
  first_name: "Test",
  username: "test_bot",
} as UserFromGetMe;
const update: Update = {
  update_id: 42,
  message: {
    message_id: 1,
    date: 0,
    chat: { id: -100, type: "supergroup", title: "t" },
    from: { id: 7, is_bot: false, first_name: "u" },
    text: "/boom",
    entities: [{ type: "bot_command", offset: 0, length: 5 }],
  },
};
const botError = (error: unknown) => new BotError(error, new Context(update, new Api(TOKEN), me));

describe("botErrorFields", () => {
  it("keeps a Telegram API failure's method and description, and never the token", () => {
    const e = new GrammyError(
      "Call to 'sendMessage' failed!",
      { ok: false, error_code: 400, description: "Bad Request: chat not found" },
      "sendMessage",
      { chat_id: -100, text: "hi" },
    );
    const fields = botErrorFields(botError(e));
    expect(fields).toEqual({
      update: 42,
      kind: "telegram",
      method: "sendMessage",
      code: 400,
      description: "Bad Request: chat not found",
    });
    expect(JSON.stringify(fields)).not.toContain(TOKEN);
  });

  it("does not log a network failure's cause, which can carry the request URL and token", () => {
    const cause = new Error(`fetch failed: https://api.telegram.org/bot${TOKEN}/sendMessage`);
    const fields = botErrorFields(botError(new HttpError("Network request failed", cause)));
    expect(fields).toEqual({ update: 42, kind: "network", message: "Network request failed" });
    expect(JSON.stringify(fields)).not.toContain(TOKEN);
  });

  it("keeps an application error's name, message and stack", () => {
    const e = new TypeError("boom");
    const fields = botErrorFields(botError(e));
    expect(fields).toMatchObject({ update: 42, kind: "app", name: "TypeError", message: "boom" });
    expect(fields.stack).toContain("TypeError: boom");
  });
});

describe("logBotError", () => {
  it("contains a handler error, so the webhook answers 200 and nothing logs the token", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new Bot(TOKEN, { botInfo: me });
    bot.errorBoundary(logBotError).command("boom", () => {
      throw new Error("handler failed");
    });

    await expect(bot.handleUpdate(update)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.mock.calls)).not.toContain(TOKEN);
    log.mockRestore();
  });
});
