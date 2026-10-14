import { Bot, webhookCallback } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { webhookOptions } from "./webhook-options.js";

const me = { id: 1, is_bot: true, first_name: "Test", username: "test_bot" } as UserFromGetMe;
const update = {
  update_id: 1,
  message: {
    message_id: 1,
    date: 0,
    chat: { id: -100, type: "supergroup", title: "t" },
    from: { id: 7, is_bot: false, first_name: "u" },
    text: "hello",
  },
};

describe("webhookOptions", () => {
  it("carries the secret token and returns instead of throwing on a timeout", () => {
    expect(webhookOptions("secret")).toEqual({ secretToken: "secret", onTimeout: "return" });
  });

  it("answers 200 while a slow update is still being handled, so Telegram does not redeliver", async () => {
    let finished = false;
    const bot = new Bot("1:test", { botInfo: me });
    bot.use(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      finished = true;
    });
    const app = new Hono();
    app.post(
      "/telegram",
      webhookCallback(bot, "hono", { ...webhookOptions("secret"), timeoutMilliseconds: 20 }),
    );
    const response = await app.request("/telegram", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "secret",
      },
      body: JSON.stringify(update),
    });
    expect(response.status).toBe(200);
    expect(finished).toBe(false);
  });
});
