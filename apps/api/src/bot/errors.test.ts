import { inspect } from "node:util";
import { Api, Bot, BotError, Context, GrammyError, HttpError } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { describe, expect, it, vi } from "vitest";
import { botErrorFields, containBotError, telegramCall } from "./errors.js";

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

  it("redacts the token from an application error that embeds a Bot API URL", () => {
    const url = `https://api.telegram.org/file/bot${TOKEN}/photos/1.jpg`;
    const fields = botErrorFields(botError(new Error(`download failed: ${url}`)));
    expect(JSON.stringify(fields)).not.toContain(TOKEN);
    expect(fields.message).toBe(
      "download failed: https://api.telegram.org/file/bot<redacted>/photos/1.jpg",
    );
  });

  it("redacts the token from an application error's name", () => {
    const e = new Error("boom");
    e.name = `Failed(${TOKEN})`;
    const fields = botErrorFields(botError(e));
    expect(JSON.stringify(fields)).not.toContain(TOKEN);
    expect(fields).toMatchObject({ name: "Failed(<redacted>)" });
  });

  it("redacts the token from a thrown non-Error", () => {
    const fields = botErrorFields(botError(`bad ${TOKEN}`));
    expect(fields).toEqual({ update: 42, kind: "app", message: "bad <redacted>" });
  });
});

// node-fetch's network error, as grammY keeps it inside an HttpError: its message is the request
// URL, which holds the token, and its fields are enumerable, so serializers walk into it.
function networkFailure(method: string) {
  const fetchError = Object.assign(
    new Error(
      `request to https://api.telegram.org/bot${TOKEN}/${method} failed, reason: ECONNRESET`,
    ),
    { type: "system", code: "ECONNRESET" },
  );
  return new HttpError(`Network request for '${method}' failed!`, fetchError);
}

describe("telegramCall", () => {
  it("passes a successful call's result through", async () => {
    await expect(telegramCall(TOKEN, async () => 7)).resolves.toBe(7);
  });

  it("rethrows a network failure with nothing nested, so no log or queue record holds the token", async () => {
    const err = await telegramCall(TOKEN, () => Promise.reject(networkFailure("sendMessage"))).then(
      () => null,
      (e: unknown) => e as Error,
    );
    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toContain("Network request for 'sendMessage' failed!");
    expect(err?.cause).toBeUndefined();
    expect(Object.keys(err as object)).toEqual([]);
    expect(inspect(err, { depth: null })).not.toContain(TOKEN);
  });

  it("keeps a Telegram API failure's method, code and description", async () => {
    const e = new GrammyError(
      "Call to 'sendMessage' failed!",
      { ok: false, error_code: 403, description: "Forbidden: bot was kicked" },
      "sendMessage",
      { chat_id: -100, text: "hi" },
    );
    const err = await telegramCall(TOKEN, () => Promise.reject(e)).catch((x: Error) => x);
    expect(err.message).toContain('"method":"sendMessage"');
    expect(err.message).toContain('"code":403');
    expect(err.message).toContain("Forbidden: bot was kicked");
  });
});

type Call = { method: string; payload: unknown };

// A bot whose Bot API calls are recorded instead of sent; `fail` makes every call reject.
function recordingBot(fail = false) {
  const calls: Call[] = [];
  const bot = new Bot(TOKEN, { botInfo: me });
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload });
    if (fail) throw new Error(`fetch failed: https://api.telegram.org/bot${TOKEN}/${method}`);
    return { ok: true, result: true } as never;
  });
  return { bot, calls };
}

describe("containBotError", () => {
  it("contains a handler error, so the webhook answers 200 and nothing logs the token", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { bot } = recordingBot();
    bot.errorBoundary(containBotError).command("boom", () => {
      throw new Error("handler failed");
    });

    await expect(bot.handleUpdate(update)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.mock.calls)).not.toContain(TOKEN);
    log.mockRestore();
  });

  it("tells the member it may not have finished, since Telegram will not redeliver the update", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { bot, calls } = recordingBot();
    bot.errorBoundary(containBotError).command("boom", () => {
      throw new Error("handler failed");
    });

    await bot.handleUpdate(update);
    expect(calls).toEqual([
      {
        method: "sendMessage",
        payload: expect.objectContaining({
          chat_id: -100,
          text: "Something went wrong and it may not have finished. Check before trying again.",
        }),
      },
    ]);
    log.mockRestore();
  });

  it("still contains the error when the notice cannot be sent", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { bot } = recordingBot(true);
    bot.errorBoundary(containBotError).command("boom", () => {
      throw new Error("handler failed");
    });

    await expect(bot.handleUpdate(update)).resolves.toBeUndefined();
    expect(JSON.stringify(log.mock.calls)).not.toContain(TOKEN);
    log.mockRestore();
  });
});
