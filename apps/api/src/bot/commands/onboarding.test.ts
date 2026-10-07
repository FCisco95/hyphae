import { communities, type Db, epochs, tasks } from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import type { Bot } from "grammy";
import type { ReplyKeyboardMarkup, Update, UserFromGetMe } from "grammy/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedCommunity, seedRewardLane } from "../../rewards/test-db.js";

const configured = vi.hoisted(() => ({ db: undefined as Db | undefined }));
vi.mock("../../db.js", () => ({
  get db() {
    return configured.db;
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
      throw new Error("No job allowed in presentation");
    }),
  },
  QUEUES: { rewardEvaluation: "reward-evaluation" },
}));

vi.mock("../../jobs/reward-jobs.js", () => ({
  sendEvaluation: vi.fn(() => {
    throw new Error("No scoring allowed in presentation");
  }),
  sendRetrieval: vi.fn(() => {
    throw new Error("No retrieval allowed in presentation");
  }),
}));

let t: Awaited<ReturnType<typeof createTestDb>>;
let bot: Bot;
const out: { method: string; payload: Record<string, unknown> }[] = [];
const botInfo = { id: 1, is_bot: true, first_name: "T", username: "t_bot" } as UserFromGetMe;
let updateId = 0;
const command = (
  text: string,
  chatId: number,
  type: "group" | "private" = "group",
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
const texts = () =>
  out.filter((o) => o.method === "sendMessage").map((o) => String(o.payload.text));

beforeAll(async () => {
  t = await createTestDb();
  configured.db = t.db;
  bot = (await import("../index.js")).bot;
  bot.api.config.use(async (_prev, method, payload) => {
    out.push({ method, payload: payload as Record<string, unknown> });
    return {
      ok: true,
      result:
        method === "getMe" ? botInfo : method === "getChatMember" ? { status: "member" } : true,
    } as never;
  });
  await bot.init();
});
afterAll(async () => {
  await t.close();
});
beforeEach(() => {
  out.length = 0;
});

const inventory = async () =>
  (
    await t.db.execute(sql`
  select (select count(*) from members) as members,
         (select count(*) from link_sessions) as links,
         (select count(*) from rules_test_passes) as passes,
         (select count(*) from tasks) as tasks,
         (select count(*) from reward_intakes) as intakes
`)
  ).rows;

describe("actual bot onboarding wiring", () => {
  it("uses the registered stored name and a working command keyboard without writes", async () => {
    const { community } = await seedCommunity(t.db);
    const before = await inventory();
    await bot.handleUpdate(command("/start", Number(community.telegramChatId)));
    expect(texts()).toHaveLength(1);
    expect(texts()[0]).toContain(community.name);
    expect(texts()[0]).toContain("Powered by Hyphae");
    const p = out.find((o) => o.method === "sendMessage")?.payload;
    expect(
      (p?.reply_markup as ReplyKeyboardMarkup)?.keyboard
        .flat()
        .map((b) => (typeof b === "string" ? b : b.text)),
    ).toEqual(["/setup", "/me", "/link", "/rules", "/help brief", "/help", "/notifications"]);
    expect((p?.reply_markup as ReplyKeyboardMarkup)?.selective).toBe(true);
    expect(p?.parse_mode).toBeUndefined();
    expect(await inventory()).toEqual(before);
  });

  it("dispatches private link start before the generic welcome, preserving membership checks", async () => {
    const { community } = await seedCommunity(t.db);
    await bot.handleUpdate(command(`/start link_${community.id}`, 42, "private"));
    expect(texts()).toHaveLength(1);
    expect(texts()[0]).toContain("https://api.hyphae.test/link#");
    expect(texts()[0]).not.toContain("Start here");
    expect(out.filter((o) => o.method === "getChatMember")).toHaveLength(1);
  });

  it("dispatches private rules start before the generic welcome", async () => {
    const { community } = await seedRewardLane(t.db);
    await bot.handleUpdate(command(`/start rules_${community.id}`, 42, "private"));
    expect(texts()).toHaveLength(1);
    expect(texts()[0]).toContain("Question 1 of 6");
    expect(texts()[0]).not.toContain("Start here");
  });

  it("does not guess a community for private or unregistered help/start", async () => {
    const { community } = await seedCommunity(t.db);
    const before = await inventory();
    for (const text of ["/start", "/help", "/help brief"]) {
      for (const [chat, type] of [
        [42, "private"],
        [-9999, "group"],
      ] as const) {
        out.length = 0;
        await bot.handleUpdate(command(text, chat, type));
        expect(texts()).toHaveLength(1);
        expect(texts()[0]).not.toContain(community.name);
        expect(texts()[0]).not.toMatch(/Mint\d+|start=|\/link#/);
        expect(out.find((o) => o.method === "sendMessage")?.payload.reply_markup).toBeUndefined();
      }
    }
    expect(await inventory()).toEqual(before);
  });

  it("keeps other-community help scoped and leaves personal progress in existing /me", async () => {
    const first = await seedCommunity(t.db);
    const second = await seedCommunity(t.db);
    await bot.handleUpdate(command("/help", Number(second.community.telegramChatId)));
    expect(texts()[0]).toContain(second.community.name);
    expect(texts()[0]).not.toContain(first.community.name);
    expect(texts()[0]).not.toContain(second.member.wallet);
    out.length = 0;
    await bot.handleUpdate(command("/me", Number(second.community.telegramChatId)));
    expect(texts()[0]).toContain("Wallet");
    expect(texts()[0]).toContain(`/c/${second.community.mint}`);
  });

  it("routes link/rules keyboard commands to the existing private deep links", async () => {
    const { community } = await seedCommunity(t.db);
    for (const route of ["link", "rules"]) {
      out.length = 0;
      await bot.handleUpdate(command(`/${route}`, Number(community.telegramChatId)));
      expect(texts()).toHaveLength(1);
      expect(texts()[0]).toContain(`https://t.me/t_bot?start=${route}_${community.id}`);
    }
  });

  it("accepts addressed help commands in a multi-bot chat", async () => {
    const { community } = await seedCommunity(t.db);
    await bot.handleUpdate(command("/help@t_bot brief", Number(community.telegramChatId)));
    expect(texts()[0]).toContain("No active brief");
    expect(texts()[0]).toContain(community.name);
  });

  it("shows the pinned epoch and quiz, not a mutable community rubric or completed pass", async () => {
    const { community } = await seedRewardLane(t.db);
    // The seeded epoch is dated from a fixed day; the guidance reads the live clock.
    await t.db
      .update(epochs)
      .set({ opensAt: new Date(Date.now() - 60_000), closesAt: new Date(Date.now() + 3_600_000) })
      .where(eq(epochs.communityId, community.id));
    await t.db
      .update(communities)
      .set({ rubricVersion: "future-version" })
      .where(eq(communities.id, community.id));
    await bot.handleUpdate(command("/help", Number(community.telegramChatId)));
    expect(texts()[0]).toContain("Rubric 1.2.0");
    expect(texts()[0]).toContain("6/6");
    expect(texts()[0]).not.toContain("future-version");
    expect(texts()[0]).not.toMatch(/you passed|your score is/i);
  });

  it("lists every open unexpired task in that chat, newest first, and shows an empty state", async () => {
    const { community } = await seedCommunity(t.db);
    const { community: other } = await seedCommunity(t.db);
    const now = Date.now();
    for (const [id, brief, opened, closes, status] of [
      [community.id, "Older brief", now - 4000, now + 60000, "open"],
      [community.id, "Current brief", now - 3000, now + 60000, "open"],
      [community.id, "Expired brief", now - 2000, now - 1000, "open"],
      [community.id, "Closed brief", now - 1000, now + 60000, "closed"],
      [other.id, "Other brief", now, now + 60000, "open"],
    ] as const) {
      await t.db.insert(tasks).values({
        communityId: id,
        kind: "raid",
        brief,
        opensAt: new Date(opened),
        closesAt: new Date(closes),
        status,
      });
    }
    const before = await inventory();
    await bot.handleUpdate(command("/help brief", Number(community.telegramChatId)));
    const shown = texts()[0] ?? "";
    expect(shown.indexOf("Current brief")).toBeGreaterThan(-1);
    expect(shown.indexOf("Older brief")).toBeGreaterThan(shown.indexOf("Current brief"));
    expect(shown).not.toMatch(/Expired brief|Closed brief|Other brief/);
    expect(await inventory()).toEqual(before);
    out.length = 0;
    const { community: empty } = await seedCommunity(t.db);
    await bot.handleUpdate(command("/help brief", Number(empty.telegramChatId)));
    expect(texts()[0]).toContain("No active brief");
  });

  it("handles closed/scheduled epochs and a paused intake without a guessed current epoch", async () => {
    const { community } = await seedRewardLane(t.db);
    await t.db
      .update(communities)
      .set({ rewardIntakePausedAt: new Date() })
      .where(eq(communities.id, community.id));
    await t.db.update(epochs).set({ status: "closed" }).where(eq(epochs.communityId, community.id));
    await bot.handleUpdate(command("/start", Number(community.telegramChatId)));
    expect(texts()[0]).toContain("paused");
    expect(texts()[0]).toContain("No reward epoch is open");
    expect(texts()[0]).not.toContain("/e/1");
  });

  it("keeps future epochs and senderless/channel updates out of a personal journey", async () => {
    const { community } = await seedRewardLane(t.db);
    await t.db
      .update(epochs)
      .set({ opensAt: new Date(Date.now() + 60000), closesAt: new Date(Date.now() + 120000) })
      .where(eq(epochs.communityId, community.id));
    await bot.handleUpdate(command("/start", Number(community.telegramChatId)));
    expect(texts()[0]).toContain("No reward epoch is open");
    out.length = 0;
    const update = command("/help", Number(community.telegramChatId));
    if ("message" in update && update.message)
      delete (update.message as unknown as { from?: unknown }).from;
    await bot.handleUpdate(update);
    expect(texts()[0]).not.toContain(community.name);
    expect(out.find((o) => o.method === "sendMessage")?.payload.reply_markup).toBeUndefined();
  });

  it("refuses unknown help args instead of treating them as community IDs or URLs", async () => {
    const { community } = await seedCommunity(t.db);
    const before = await inventory();
    await bot.handleUpdate(
      command(`/help https://evil.test/#secret`, Number(community.telegramChatId)),
    );
    expect(texts()).toEqual(["Use /help for score guidance or /help brief for the current brief."]);
    expect(await inventory()).toEqual(before);
  });

  it("does not intercept quiz callbacks or turn forged callback data into help/member output", async () => {
    const { community } = await seedCommunity(t.db);
    await bot.handleUpdate({
      update_id: ++updateId,
      callback_query: {
        id: "bad",
        from: { id: 99, is_bot: false, first_name: "S" },
        chat_instance: "ci",
        data: `rt:wrong:${community.id}:9`,
        message: { message_id: 1, date: 0, chat: { id: 99, type: "private", first_name: "S" } },
      },
    });
    expect(texts()).toHaveLength(0);
    expect(out.some((o) => o.method === "answerCallbackQuery")).toBe(true);
    expect(out.find((o) => o.method === "editMessageText")?.payload.text).toContain("out of date");
  });

  it("shows unavailable rather than empty/zero if a presentation read fails", async () => {
    const real = configured.db;
    configured.db = {
      query: {
        communities: {
          findFirst: async () => {
            throw new Error("read failed");
          },
        },
      },
    } as unknown as Db;
    try {
      await bot.handleUpdate(command("/help", -100));
      expect(texts()).toEqual([
        "Guidance is unavailable right now. Try /help again later or ask the community owner.",
      ]);
    } finally {
      configured.db = real;
    }
  });
});
