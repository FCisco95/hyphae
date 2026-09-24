import { Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { describe, expect, it, vi } from "vitest";

// No chat is a registered community here, so a lookup-driven answer would say so.
vi.mock("../../db.js", () => ({
  db: {
    query: {
      communities: { findFirst: async () => undefined },
      members: { findFirst: async () => undefined },
    },
  },
}));
vi.mock("../../env.js", () => ({ env: { PUBLIC_WEB_URL: "https://hyphae.test" } }));

const { me } = await import("./me.js");

const botInfo = { id: 1, is_bot: true, first_name: "T", username: "t_bot" } as UserFromGetMe;
const privateMe: Update = {
  update_id: 1,
  message: {
    message_id: 5,
    date: 0,
    chat: { id: 42, type: "private", first_name: "M" },
    from: { id: 42, is_bot: false, first_name: "M" },
    text: "/me",
    entities: [{ type: "bot_command", offset: 0, length: 3 }],
  },
} as Update;

describe("/me", () => {
  it("in a private chat points to the community chat, like /link", async () => {
    const sent: string[] = [];
    const bot = new Bot("1:t", { botInfo });
    bot.api.config.use(async (_prev, method, payload) => {
      if (method === "sendMessage") sent.push((payload as { text: string }).text);
      return { ok: true, result: true } as never;
    });
    bot.command("me", me);

    await bot.handleUpdate(privateMe);

    expect(sent).toEqual(["Send /me in your community chat."]);
  });
});
