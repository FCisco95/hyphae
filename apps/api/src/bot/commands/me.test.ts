import { Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { mePayout } from "./me-summary.js";

const found = vi.hoisted(() => ({
  community: undefined as unknown,
  member: undefined as unknown,
  payout: null as unknown,
}));
vi.mock("../../db.js", () => ({
  db: {
    query: {
      communities: { findFirst: async () => found.community },
      members: { findFirst: async () => found.member },
    },
  },
}));
vi.mock("../../env.js", () => ({ env: { PUBLIC_WEB_URL: "https://hyphae.test" } }));
vi.mock("./me-summary.js", async (actual) => ({
  ...(await actual<typeof import("./me-summary.js")>()),
  meSummary: async () => ["Entries: 0"],
  mePayout: async () => found.payout,
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

type Sent = { text: string; reply_markup?: { inline_keyboard: { text: string; url: string }[][] } };

async function send(update: Update): Promise<Sent[]> {
  const sent: Sent[] = [];
  const bot = new Bot("1:t", { botInfo });
  bot.api.config.use(async (_prev, method, payload) => {
    if (method === "sendMessage") sent.push(payload as Sent);
    return { ok: true, result: true } as never;
  });
  bot.command("me", me);
  await bot.handleUpdate(update);
  return sent;
}

type Status = NonNullable<Awaited<ReturnType<typeof mePayout>>>;
const open = (payout: Status["payout"]): Status => ({
  epochIndex: 3,
  closed: false,
  payout,
  holdMin: "100,000 MYCEL",
});

beforeEach(() => {
  found.community = undefined;
  found.member = undefined;
  found.payout = null;
});

describe("/me", () => {
  it("in a private chat points to the community chat, like /link", async () => {
    expect((await send(meIn({ id: 42, type: "private" }))).map((s) => s.text)).toEqual([
      "Send /me in your community chat.",
    ]);
  });

  it("links the community's audit page, never a URL carrying the wallet", async () => {
    found.community = { id: "c1", mint: "MintAbc" };
    found.member = { id: "m1", wallet: "PastedWallet1111", linkMethod: "paste" };
    const [sent] = await send(meIn({ id: -100, type: "group" }));
    expect(sent?.text).toContain("https://hyphae.test/c/MintAbc");
    expect(sent?.text).not.toContain("PastedWallet1111");
    expect(sent?.text).not.toContain("/w/");
  });

  it("in a paid epoch: the checklist, the one next step and a button straight to it", async () => {
    found.community = { id: "c1", mint: "MintAbc" };
    found.member = { id: "m1", wallet: null, linkMethod: null };
    found.payout = open({
      status: "not_payable",
      reasons: ["no_verified_wallet", "no_rules_test"],
      hold: "at_close",
    });
    const [sent] = await send(meIn({ id: -100, type: "group" }));
    expect(sent?.text).toBe(
      [
        "Entries: 0",
        "To be paid for epoch 3:",
        "❌ Wallet: none signed yet",
        "❌ Rules test: not passed yet",
        "⏳ Hold: read once after the close; needs at least 100,000 MYCEL in that wallet",
        "Next: link a wallet by signing. It is free and moves no funds.",
        "https://hyphae.test/c/MintAbc",
      ].join("\n"),
    );
    expect(sent?.reply_markup?.inline_keyboard).toEqual([
      [{ text: "Link my wallet", url: "https://t.me/t_bot?start=link_c1" }],
    ]);
  });

  it("sends the rules test next once the wallet is signed, and no button when nothing is left", async () => {
    found.community = { id: "c1", mint: "MintAbc" };
    found.member = {
      id: "m1",
      wallet: "Signed11111111111111111111111111Wxyz",
      linkMethod: "signature",
    };
    found.payout = open({ status: "not_payable", reasons: ["no_rules_test"], hold: "at_close" });
    const [rules] = await send(meIn({ id: -100, type: "group" }));
    expect(rules?.reply_markup?.inline_keyboard).toEqual([
      [{ text: "Take the rules test", url: "https://t.me/t_bot?start=rules_c1" }],
    ]);
    found.payout = open({ status: "held", reasons: ["hold_pending"], hold: "at_close" });
    const [done] = await send(meIn({ id: -100, type: "group" }));
    expect(done?.text).toContain("Nothing else to do now.");
    expect(done?.reply_markup).toBeUndefined();
  });

  it("without a reward epoch, keeps the wallet lines", async () => {
    found.community = { id: "c1", mint: "MintAbc" };
    found.member = { id: "m1", wallet: null, linkMethod: null };
    const [sent] = await send(meIn({ id: -100, type: "group" }));
    expect(sent?.text.split("\n")[0]).toMatch(/^No wallet yet\./);
    expect(sent?.reply_markup).toBeUndefined();
  });
});
