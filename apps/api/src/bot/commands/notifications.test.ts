import { communities, type Db, raidSubscriptions } from "@hyphae/db";
import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { claimRaidAlert, deliverRaidAlert } from "../../raid-alerts/alerts.js";
import { createTestDb, seedCommunity } from "../../rewards/test-db.js";

const state = vi.hoisted(() => ({ db: undefined as Db | undefined }));
vi.mock("../../db.js", () => ({
  get db() {
    return state.db;
  },
}));
vi.mock("../../env.js", () => ({
  env: {
    TELEGRAM_BOT_TOKEN: "1:test",
    DATABASE_URL: "postgres://local:test@localhost/test",
    PUBLIC_WEB_URL: "https://hyphae.test",
    LINK_ORIGIN: "https://api.hyphae.test",
  },
}));
vi.mock("../../jobs/queue.js", () => ({
  boss: {
    send: vi.fn(() => {
      throw new Error("No scoring job allowed");
    }),
  },
  QUEUES: {},
}));
vi.mock("../../jobs/reward-jobs.js", () => ({
  sendEvaluation: vi.fn(() => {
    throw new Error("No paid evaluation allowed");
  }),
}));
vi.mock("../../x/oembed.js", async (original) => ({
  ...(await original<object>()),
  fetchPost: vi.fn(async () => ({
    id: "123",
    handle: "owner",
    text: "Target",
    url: "https://x.com/owner/status/123",
  })),
}));
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Expected fixture/claimed delivery");
  return value;
}

let t: Awaited<ReturnType<typeof createTestDb>>;
let bot: Bot;
const out: { method: string; payload: Record<string, unknown> }[] = [];
let memberStatus = "member";
let membershipFails = false;
let updateId = 0;
const command = (
  text: string,
  chatId: number,
  type: "group" | "private" = "private",
  from = 42,
): Update => ({
  update_id: ++updateId,
  message: {
    message_id: updateId,
    date: 0,
    chat:
      type === "private"
        ? { id: chatId, type, first_name: "M" }
        : { id: chatId, type, title: "Lab" },
    from: { id: from, is_bot: false, first_name: "M" },
    text,
    entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0]?.length ?? 0 }],
  },
});
const stop = (
  id: string,
  from = 42,
  chatId = from,
  type: "group" | "private" = "private",
): Update => ({
  update_id: ++updateId,
  callback_query: {
    id: `q${updateId}`,
    chat_instance: "test",
    data: `raids_off_${id}`,
    from: { id: from, is_bot: false, first_name: "M" },
    message: {
      message_id: updateId,
      date: 1,
      chat:
        type === "private"
          ? { id: chatId, type, first_name: "M" }
          : { id: chatId, type, title: "Lab" },
      text: "Raid",
    },
  },
});
const texts = () =>
  out.filter((x) => x.method === "sendMessage").map((x) => String(x.payload.text));
beforeAll(async () => {
  t = await createTestDb();
  state.db = t.db;
  bot = (await import("../index.js")).bot;
  bot.api.config.use(async (_prev, method, payload) => {
    out.push({ method, payload: payload as Record<string, unknown> });
    if (method === "getChatMember" && membershipFails) throw new Error("lookup unavailable");
    return {
      ok: true,
      result:
        method === "getMe"
          ? ({ id: 1, is_bot: true, first_name: "T", username: "t_bot" } as UserFromGetMe)
          : method === "getChatMember"
            ? { status: memberStatus }
            : true,
    } as never;
  });
  await bot.init();
});
afterAll(async () => {
  await t.close();
});
beforeEach(() => {
  out.length = 0;
  memberStatus = "member";
  membershipFails = false;
});

describe("actual opt-in bot wiring", () => {
  it("shows a community deep link in the group without enrolling anyone", async () => {
    const { community } = await seedCommunity(t.db);
    await bot.handleUpdate(command("/notifications", Number(community.telegramChatId), "group"));
    const keyboard = required(out.find((x) => x.method === "sendMessage")).payload.reply_markup;
    expect(JSON.stringify(keyboard)).toContain(`https://t.me/t_bot?start=raids_${community.id}`);
    expect(await t.db.select().from(raidSubscriptions)).toHaveLength(0);
  });
  it("enables only the caller and requested community after checking membership", async () => {
    const { community } = await seedCommunity(t.db);
    await bot.handleUpdate(command(`/start raids_${community.id}`, 42));
    expect(out.find((x) => x.method === "getChatMember")?.payload).toEqual({
      chat_id: Number(community.telegramChatId),
      user_id: 42,
    });
    expect(
      (
        await t.db
          .select()
          .from(raidSubscriptions)
          .where(eq(raidSubscriptions.communityId, community.id))
      )[0],
    ).toMatchObject({ telegramUserId: 42n, enabled: true, revision: 1 });
    expect(texts()[0]).toContain("Future raids");
  });
  it("refuses invalid/non-private identities, outsiders and failed membership checks", async () => {
    const { community } = await seedCommunity(t.db);
    for (const update of [
      command("/start raids_bad", 42),
      command(`/start raids_${community.id}`, 99, "private", 42),
      command(`/start raids_${community.id}`, Number(community.telegramChatId), "group"),
    ])
      await bot.handleUpdate(update);
    memberStatus = "left";
    await bot.handleUpdate(command(`/start raids_${community.id}`, 42));
    membershipFails = true;
    await bot.handleUpdate(command(`/start raids_${community.id}`, 42));
    expect(
      await t.db
        .select()
        .from(raidSubscriptions)
        .where(eq(raidSubscriptions.communityId, community.id)),
    ).toHaveLength(0);
  });
  it("stops only the caller's community subscription and refuses a group callback", async () => {
    const { community } = await seedCommunity(t.db);
    await bot.handleUpdate(command(`/start raids_${community.id}`, 42));
    await bot.handleUpdate(command(`/start raids_${community.id}`, 99, "private", 99));
    await bot.handleUpdate(stop(community.id, 42, Number(community.telegramChatId), "group"));
    expect(
      (
        await t.db
          .select()
          .from(raidSubscriptions)
          .where(eq(raidSubscriptions.communityId, community.id))
      ).every((s) => s.enabled),
    ).toBe(true);
    await bot.handleUpdate(stop(community.id));
    const subs = await t.db
      .select()
      .from(raidSubscriptions)
      .where(eq(raidSubscriptions.communityId, community.id));
    expect(subs.find((s) => s.telegramUserId === 42n)?.enabled).toBe(false);
    expect(subs.find((s) => s.telegramUserId === 99n)?.enabled).toBe(true);
    expect(texts().at(-1)).toContain("alerts stopped");
  });
  it("an admin /raid queues the opted-in member; retries cannot create extra alerts", async () => {
    const { community } = await seedCommunity(t.db);
    await bot.handleUpdate(command(`/start raids_${community.id}`, 42));
    const update = command(
      "/raid https://x.com/owner/status/123 1 Explain your view",
      Number(community.telegramChatId),
      "group",
      7,
    );
    await bot.handleUpdate(update);
    await bot.handleUpdate(update);
    expect(texts().join("\n")).toContain("already opened");
    const job = await claimRaidAlert(t.db, new Date(Date.now() + 1000));
    expect(job).toBeDefined();
    const send = vi.fn(async () => undefined);
    expect(
      await deliverRaidAlert(t.db, required(job).id, { membership: async () => true, send }),
    ).toBe("sent");
    expect(send).toHaveBeenCalledTimes(1);
    expect(await claimRaidAlert(t.db, new Date(Date.now() + 1000))).toBeUndefined();
  });
  it("a member cannot create a target or notifications using /raid", async () => {
    const { community } = await seedCommunity(t.db);
    await bot.handleUpdate(
      command(
        "/raid https://x.com/owner/status/123",
        Number(community.telegramChatId),
        "group",
        42,
      ),
    );
    expect(texts()[0]).toBe("Admins only.");
    expect(await claimRaidAlert(t.db)).toBeUndefined();
  });
  it("refuses an unsafe stored Telegram chat ID rather than rounding it to another group", async () => {
    const { community } = await seedCommunity(t.db);
    await t.db
      .update(communities)
      .set({ telegramChatId: -9007199254740993n })
      .where(eq(communities.id, community.id));
    await bot.handleUpdate(command(`/start raids_${community.id}`, 42));
    expect(out.some((x) => x.method === "getChatMember")).toBe(false);
    expect(
      await t.db
        .select()
        .from(raidSubscriptions)
        .where(eq(raidSubscriptions.communityId, community.id)),
    ).toHaveLength(0);
    expect(texts()[0]).toContain("configuration is unavailable");
  });
});
