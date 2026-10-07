import { communities, raidLifecycleEvents, tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_OPEN_RAIDS } from "../../raid-alerts/alerts.js";
import { createTestDb, seedCommunity } from "../../rewards/test-db.js";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../../db.js", () => ({
  get db() {
    return state.db;
  },
}));
vi.mock("../../x/oembed.js", async (importActual) => ({
  ...(await importActual<typeof import("../../x/oembed.js")>()),
  fetchPost: async (url: string) => {
    const m = /\/([A-Za-z0-9_]+)\/status\/(\d+)/.exec(url);
    return m ? { id: m[2], handle: m[1], text: "Hello raiders", url } : null;
  },
}));

let t: Awaited<ReturnType<typeof createTestDb>>;
let bot: Bot;
let sequence = 0;
let calls: { method: string; payload: Record<string, unknown> }[] = [];
const sent = () =>
  calls.filter((c) => c.method === "sendMessage").map((c) => String(c.payload.text));
const toasts = () =>
  calls.filter((c) => c.method === "answerCallbackQuery").map((c) => String(c.payload.text));

const command = (text: string, chatId: number, from = 7): Update => ({
  update_id: ++sequence,
  message: {
    message_id: ++sequence,
    date: 0,
    chat: { id: chatId, type: "group", title: "Lab" },
    from: { id: from, is_bot: false, first_name: "M" },
    text,
    entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0]?.length ?? 0 }],
  },
});
const tap = (data: string, chatId: number, messageId: number, from = 7): Update => ({
  update_id: ++sequence,
  callback_query: {
    id: `cb${sequence}`,
    from: { id: from, is_bot: false, first_name: "M" },
    chat_instance: "ci",
    data,
    message: {
      message_id: messageId,
      date: 0,
      chat: { id: chatId, type: "group", title: "Lab" },
    },
  },
});
const tasksOf = (communityId: string) =>
  t.db.select().from(tasks).where(eq(tasks.communityId, communityId));
const post = (n: number) => `https://x.com/owner/status/${100 + n}`;

beforeAll(async () => {
  t = await createTestDb();
  state.db = t.db;
  const { raid } = await import("./raid.js");
  const { raidsMenu, pickRaidHours, closeRaidButton } = await import("./raid-menu.js");
  bot = new Bot("123:fixture", {
    botInfo: { id: 1, is_bot: true, first_name: "T", username: "t_bot" } as UserFromGetMe,
  });
  bot.command("raid", raid);
  bot.command("raids", raidsMenu);
  bot.callbackQuery(/^rn:/, pickRaidHours);
  bot.callbackQuery(/^cr:/, closeRaidButton);
  bot.api.config.use(async (_previous, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: true } as never;
  });
});
afterAll(async () => {
  await t.close();
});
beforeEach(() => {
  calls = [];
});

describe("raid buttons", () => {
  it("asks for the length when only a link is sent, and opens nothing yet", async () => {
    const { community } = await seedCommunity(t.db);
    const chatId = Number(community.telegramChatId);
    await bot.handleUpdate(command(`/raid ${post(1)}`, chatId));
    const picker = calls.find((c) => c.method === "sendMessage");
    expect(picker?.payload.text).toBe("How long should this raid run?");
    const data = JSON.stringify(picker?.payload.reply_markup);
    for (const h of [6, 12, 24, 48]) expect(data).toContain(`rn:${h}:owner:101`);
    expect(await tasksOf(community.id)).toHaveLength(0);
  });

  it("refuses a post id too long to fit a button instead of sending dead buttons", async () => {
    const { community } = await seedCommunity(t.db);
    const link = `https://x.com/abcdefghijklmno/status/${"9".repeat(43)}`;
    await bot.handleUpdate(command(`/raid ${link}`, Number(community.telegramChatId)));
    expect(sent().at(-1)).toContain("valid post link");
    expect(calls.some((c) => c.payload.reply_markup)).toBe(false);
    expect(await tasksOf(community.id)).toHaveLength(0);
  });

  it("opens the raid for the tapped hours and removes the picker", async () => {
    const { community } = await seedCommunity(t.db);
    const chatId = Number(community.telegramChatId);
    await bot.handleUpdate(tap("rn:24:owner:102", chatId, 900));
    const [task] = await tasksOf(community.id);
    expect(task?.targetUrl).toBe("https://x.com/owner/status/102");
    expect((task?.closesAt.getTime() ?? 0) - (task?.opensAt.getTime() ?? 0)).toBe(24 * 3_600_000);
    expect(sent().at(-1)).toContain("Raid open for 24h");
    expect(sent().at(-1)).toContain(`Raid ID: ${task?.id}`);
    expect(calls.some((c) => c.method === "editMessageReplyMarkup")).toBe(true);
    await bot.handleUpdate(tap("rn:48:owner:102", chatId, 900));
    expect(sent().at(-1)).toContain("already opened");
    expect(await tasksOf(community.id)).toHaveLength(1);
  });

  it("keeps explicit hours working without the picker", async () => {
    const { community } = await seedCommunity(t.db);
    await bot.handleUpdate(command(`/raid ${post(3)} 12 Say hi`, Number(community.telegramChatId)));
    expect(sent().at(-1)).toContain("Raid open for 12h");
    expect(sent().at(-1)).toContain("Brief: Say hi");
  });

  it("ignores a tap from a member or a forged button", async () => {
    const { community } = await seedCommunity(t.db);
    const chatId = Number(community.telegramChatId);
    await bot.handleUpdate(tap("rn:6:owner:104", chatId, 901, 42));
    await bot.handleUpdate(tap("rn:7:owner:104", chatId, 902));
    await bot.handleUpdate(tap("rn:6:owner:104:x", chatId, 903));
    expect(await tasksOf(community.id)).toHaveLength(0);
    expect(toasts()).toEqual([
      "Only the community admin can do this.",
      "That button is out of date.",
      "That button is out of date.",
    ]);
  });

  it("refuses a fourth raid with the open ones named", async () => {
    const { community } = await seedCommunity(t.db);
    const chatId = Number(community.telegramChatId);
    for (let i = 0; i < MAX_OPEN_RAIDS; i++)
      await bot.handleUpdate(tap(`rn:6:owner:${200 + i}`, chatId, 910 + i));
    expect(await tasksOf(community.id)).toHaveLength(MAX_OPEN_RAIDS);
    await bot.handleUpdate(tap("rn:6:owner:299", chatId, 950));
    expect(sent().at(-1)).toContain(`${MAX_OPEN_RAIDS} raids are already open`);
    expect(await tasksOf(community.id)).toHaveLength(MAX_OPEN_RAIDS);
  });
});

describe("/raids menu", () => {
  it("lists open raids with a Close button each, and closes one on tap", async () => {
    const { community } = await seedCommunity(t.db);
    const chatId = Number(community.telegramChatId);
    await bot.handleUpdate(tap("rn:12:owner:301", chatId, 960));
    await bot.handleUpdate(tap("rn:12:owner:302", chatId, 961));
    calls = [];
    await bot.handleUpdate(command("/raids", chatId));
    const menu = calls.find((c) => c.method === "sendMessage");
    expect(String(menu?.payload.text)).toContain("Open raids (2 of 3)");
    const rows = await tasksOf(community.id);
    const target = rows[0];
    expect(JSON.stringify(menu?.payload.reply_markup)).toContain(`cr:${target?.id}`);

    calls = [];
    await bot.handleUpdate(tap(`cr:${target?.id}`, chatId, 970));
    expect(toasts()).toEqual(["Raid closed."]);
    expect(sent().at(-1)).toContain(`Raid closed: ${target?.id}`);
    const [after] = await t.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, target?.id ?? ""));
    expect(after?.status).toBe("closed");
    const events = await t.db
      .select()
      .from(raidLifecycleEvents)
      .where(eq(raidLifecycleEvents.taskId, target?.id ?? ""));
    expect(events.map((e) => e.action).sort()).toEqual(["closed", "opened"]);

    calls = [];
    await bot.handleUpdate(tap(`cr:${target?.id}`, chatId, 970));
    expect(toasts()).toEqual(["Raid closed."]);
    await bot.handleUpdate(command("/raids", chatId));
    expect(sent().at(-1)).toContain("Open raids (1 of 3)");
  });

  it("is admin-only and says so when nothing is open", async () => {
    const { community } = await seedCommunity(t.db);
    const chatId = Number(community.telegramChatId);
    await bot.handleUpdate(command("/raids", chatId, 42));
    expect(sent().at(-1)).toContain("Admins only");
    await bot.handleUpdate(command("/raids", chatId));
    expect(sent().at(-1)).toContain("No open raids");
    await t.db
      .update(communities)
      .set({ adminTelegramUserId: 8n })
      .where(eq(communities.id, community.id));
    await bot.handleUpdate(tap("rn:6:owner:401", chatId, 980));
    expect(await tasksOf(community.id)).toHaveLength(0);
  });
});
