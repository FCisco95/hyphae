import { Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const found = vi.hoisted(() => ({ community: undefined as unknown, member: undefined as unknown }));
vi.mock("../../db.js", () => ({
  db: {
    query: {
      communities: { findFirst: async () => found.community },
      members: { findFirst: async () => found.member },
    },
  },
}));
vi.mock("../../env.js", () => ({ env: { PUBLIC_WEB_URL: "https://hyphae.test" } }));
vi.mock("./me-summary.js", () => ({
  walletLines: () => ["Wallet Past…1111", "Wallet not verified."],
  meSummary: async () => ["Entries: 0"],
}));

const { me } = await import("./me.js");

const botInfo = { id: 1, is_bot: true, first_name: "T", username: "t_bot" } as UserFromGetMe;
const meIn = (chat: { id: number; type: "private" | "group" }): Update =>
  ({
    update_id: 1,
    message: {
      message_id: 5,
      date: 0,
      chat: chat.type === "private" ? { ...chat, first_name: "M" } : { ...chat, title: "Lab" },
      from: { id: 42, is_bot: false, first_name: "M" },
      text: "/me",
      entities: [{ type: "bot_command", offset: 0, length: 3 }],
    },
  }) as Update;

async function send(update: Update): Promise<string[]> {
  const sent: string[] = [];
  const bot = new Bot("1:t", { botInfo });
  bot.api.config.use(async (_prev, method, payload) => {
    if (method === "sendMessage") sent.push((payload as { text: string }).text);
    return { ok: true, result: true } as never;
  });
  bot.command("me", me);
  await bot.handleUpdate(update);
  return sent;
}

beforeEach(() => {
  found.community = undefined;
  found.member = undefined;
});

describe("/me", () => {
  it("in a private chat points to the community chat, like /link", async () => {
    expect(await send(meIn({ id: 42, type: "private" }))).toEqual([
      "Send /me in your community chat.",
    ]);
  });

  it("links the community's audit page, never a URL carrying the wallet", async () => {
    found.community = { id: "c1", mint: "MintAbc" };
    found.member = { id: "m1", wallet: "PastedWallet1111", linkMethod: "paste" };
    const [text] = await send(meIn({ id: -100, type: "group" }));
    expect(text).toContain("https://hyphae.test/c/MintAbc");
    expect(text).not.toContain("PastedWallet1111");
    expect(text).not.toContain("/w/");
  });
});
