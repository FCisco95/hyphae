import { Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { mePayout } from "./me-summary.js";

const found = vi.hoisted(() => ({
  community: undefined as unknown,
  member: undefined as unknown,
  payout: null as unknown,
  membership: "member" as "member" | "left" | "error",
  payoutCalls: 0,
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
  mePayout: async () => {
    found.payoutCalls += 1;
    return found.payout;
  },
}));

const { me, meStart } = await import("./me.js");

const COMMUNITY = "00000000-0000-4000-8000-000000000001";
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
    if (method === "getChatMember") {
      if (found.membership === "error") throw new Error("Telegram unavailable");
      return {
        ok: true,
        result: { status: found.membership, user: { id: 42, is_bot: false, first_name: "M" } },
      } as never;
    }
    if (method === "sendMessage") sent.push(payload as Sent);
    return { ok: true, result: true } as never;
  });
  bot.command("me", me);
  bot.command("start", meStart);
  await bot.handleUpdate(update);
  return sent;
}

function privateChecklist(): Update {
  const update = meIn({ id: 42, type: "private" });
  if (!("message" in update)) throw new Error("message required");
  update.message.text = `/start me_${COMMUNITY}`;
  update.message.entities = [{ type: "bot_command", offset: 0, length: 6 }];
  return update;
}

type Status = NonNullable<Awaited<ReturnType<typeof mePayout>>>;
const open = (payout: Status["payout"], member = found.member as Status["member"]): Status => ({
  epochIndex: 3,
  closed: false,
  payout,
  wallet: member.linkMethod === "signature" ? member.wallet : null,
  member,
  holdMin: "100,000 MYCEL",
});

beforeEach(() => {
  found.community = undefined;
  found.member = undefined;
  found.payout = null;
  found.membership = "member";
  found.payoutCalls = 0;
});

describe("/me", () => {
  it("in a private chat points to the community chat, like /link", async () => {
    expect((await send(meIn({ id: 42, type: "private" }))).map((s) => s.text)).toEqual([
      "Open /me in your community chat, then tap Open my private checklist.",
    ]);
  });

  it("links the community's audit page, never a URL carrying the wallet", async () => {
    found.community = { id: COMMUNITY, mint: "MintAbc", telegramChatId: -100n };
    found.member = { id: "m1", wallet: "PastedWallet1111", linkMethod: "paste" };
    const [sent] = await send(privateChecklist());
    expect(sent?.text).toContain("https://hyphae.test/c/MintAbc");
    expect(sent?.text).not.toContain("PastedWallet1111");
    expect(sent?.text).not.toContain("/w/");
  });

  it("in a paid epoch: the checklist, the one next step and a button straight to it", async () => {
    found.community = { id: COMMUNITY, mint: "MintAbc", telegramChatId: -100n };
    found.member = { id: "m1", wallet: null, linkMethod: null };
    found.payout = open({
      status: "not_payable",
      reasons: ["no_verified_wallet", "no_rules_test"],
      hold: "at_close",
    });
    const [sent] = await send(privateChecklist());
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
      [{ text: "Link my wallet", url: `https://t.me/t_bot?start=link_${COMMUNITY}` }],
    ]);
  });

  it("sends the rules test next once the wallet is signed, and no button when nothing is left", async () => {
    found.community = { id: COMMUNITY, mint: "MintAbc", telegramChatId: -100n };
    found.member = {
      id: "m1",
      wallet: "Signed11111111111111111111111111Wxyz",
      linkMethod: "signature",
    };
    found.payout = open({ status: "not_payable", reasons: ["no_rules_test"], hold: "at_close" });
    const [rules] = await send(privateChecklist());
    expect(rules?.reply_markup?.inline_keyboard).toEqual([
      [{ text: "Take the rules test", url: `https://t.me/t_bot?start=rules_${COMMUNITY}` }],
    ]);
    found.payout = open({ status: "held", reasons: ["hold_pending"], hold: "at_close" });
    const [done] = await send(privateChecklist());
    expect(done?.text).toContain("Nothing else to do now.");
    expect(done?.reply_markup).toBeUndefined();
  });

  it("names the wallets read with the status, never a member row read apart from it", async () => {
    const A = "AAAA1111111111111111111111111111AAAA";
    const B = "BBBB2222222222222222222222222222BBBB";
    found.community = { id: COMMUNITY, mint: "MintAbc", telegramChatId: -100n };
    // The row /me looked up first; the member relinked to B before the status was read.
    found.member = {
      id: "m1",
      wallet: "Stale333333333333333333333333333Stal",
      linkMethod: "paste",
    };
    found.payout = {
      ...open(
        { status: "payable", reasons: [], hold: "holder" },
        { wallet: B, linkMethod: "signature" },
      ),
      closed: true,
      wallet: A,
    };
    const [sent] = await send(privateChecklist());
    expect(sent?.text.split("\n").slice(1, 4)).toEqual([
      "To be paid for epoch 3 (closed):",
      "✅ Wallet: AAAA…AAAA, signed",
      "Current link: BBBB…BBBB, signed",
    ]);
    expect(sent?.text).not.toContain("Stal");
  });

  it("without a reward epoch, keeps the wallet lines", async () => {
    found.community = { id: COMMUNITY, mint: "MintAbc", telegramChatId: -100n };
    found.member = { id: "m1", wallet: null, linkMethod: null };
    const [sent] = await send(privateChecklist());
    expect(sent?.text.split("\n")[0]).toMatch(/^No wallet yet\./);
    expect(sent?.reply_markup).toBeUndefined();
  });
  it("in a group sends only a neutral private link, without reading a member checklist", async () => {
    found.community = { id: COMMUNITY, mint: "MintAbc", telegramChatId: -100n };
    found.member = { id: "m1", wallet: "PrivateWallet", linkMethod: "signature" };
    found.payout = open({ status: "not_payable", reasons: ["no_rules_test"], hold: "not_checked" });
    const [sent] = await send(meIn({ id: -100, type: "group" }));
    expect(sent?.text).toBe("Open your checklist in private chat.");
    expect(sent?.reply_markup?.inline_keyboard).toEqual([
      [{ text: "Open my private checklist", url: `https://t.me/t_bot?start=me_${COMMUNITY}` }],
    ]);
    expect(found.payoutCalls).toBe(0);
  });

  it("refuses departed members and fails closed when membership cannot be read", async () => {
    found.community = { id: COMMUNITY, mint: "MintAbc", telegramChatId: -100n };
    found.member = { id: "m1", wallet: null, linkMethod: null };
    for (const status of ["left", "error"] as const) {
      found.membership = status;
      const [sent] = await send(privateChecklist());
      expect(sent?.text).toContain("membership could not be confirmed");
      expect(found.payoutCalls).toBe(0);
    }
  });

  it("ignores checklist deep links in a group", async () => {
    const update = privateChecklist();
    if (!("message" in update)) throw new Error("message required");
    update.message.chat = { id: -100, type: "group", title: "Lab" };
    expect(await send(update)).toEqual([]);
    expect(found.payoutCalls).toBe(0);
  });
});
