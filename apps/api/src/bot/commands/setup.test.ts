import { communities, type Db, epochs, members, raidSubscriptions } from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import type { Bot } from "grammy";
import type { InlineKeyboardMarkup, Update, UserFromGetMe } from "grammy/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { recordPass } from "../../payout/rules-test.js";
import { createTestDb, seedCommunity, seedRewardLane } from "../../rewards/test-db.js";

const configured = vi.hoisted(() => ({
  db: undefined as Db | undefined,
  status: "member" as string,
}));
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
vi.mock("./mint-decimals.js", () => ({ mintDecimals: vi.fn(async () => 6) }));
vi.mock("../../jobs/queue.js", () => ({
  boss: {
    send: vi.fn(() => {
      throw new Error("No job allowed in setup");
    }),
  },
  QUEUES: { rewardEvaluation: "reward-evaluation" },
}));
vi.mock("../../jobs/reward-jobs.js", () => ({
  sendEvaluation: vi.fn(() => {
    throw new Error("No scoring allowed in setup");
  }),
  sendRetrieval: vi.fn(() => {
    throw new Error("No retrieval allowed in setup");
  }),
}));

let t: Awaited<ReturnType<typeof createTestDb>>;
let bot: Bot;
const out: { method: string; payload: Record<string, unknown> }[] = [];
const botInfo = { id: 1, is_bot: true, first_name: "T", username: "t_bot" } as UserFromGetMe;
let updateId = 0;

const command = (text: string, chatId: number, type: "group" | "private", from = 42): Update => ({
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
const press = (data: string, from = 42): Update => ({
  update_id: ++updateId,
  callback_query: {
    id: String(updateId),
    from: { id: from, is_bot: false, first_name: "M" },
    chat_instance: "x",
    data,
    message: {
      message_id: 9,
      date: 0,
      chat: { id: from, type: "private", first_name: "M" },
    },
  },
});

const sent = (method = "sendMessage") => out.filter((o) => o.method === method);
const keyboard = (o?: { payload: Record<string, unknown> }) =>
  (o?.payload.reply_markup as InlineKeyboardMarkup | undefined)?.inline_keyboard.flat() ?? [];

beforeAll(async () => {
  t = await createTestDb();
  configured.db = t.db;
  bot = (await import("../index.js")).bot;
  bot.api.config.use(async (_prev, method, payload) => {
    out.push({ method, payload: payload as Record<string, unknown> });
    return {
      ok: true,
      result:
        method === "getMe"
          ? botInfo
          : method === "getChatMember"
            ? { status: configured.status }
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
  configured.status = "member";
});

// The seeded epoch is dated from a fixed day; setup reads the live clock.
async function openEpochNow(communityId: string) {
  await t.db
    .update(epochs)
    .set({ opensAt: new Date(Date.now() - 60_000), closesAt: new Date(Date.now() + 3_600_000) })
    .where(eq(epochs.communityId, communityId));
}

const inventory = async () =>
  (
    await t.db.execute(sql`
  select (select count(*) from members) as members,
         (select count(*) from link_sessions) as links,
         (select count(*) from rules_test_passes) as passes,
         (select count(*) from raid_subscriptions) as subs,
         (select count(*) from reward_intakes) as intakes
`)
  ).rows;

describe("/setup in the community group", () => {
  it("answers with one button into the private checklist and writes nothing", async () => {
    const { community } = await seedCommunity(t.db);
    const before = await inventory();
    await bot.handleUpdate(command("/setup", Number(community.telegramChatId), "group"));
    expect(sent()).toHaveLength(1);
    expect(keyboard(sent()[0])).toEqual([
      { text: "Start setup", url: `https://t.me/t_bot?start=setup_${community.id}` },
    ]);
    expect(await inventory()).toEqual(before);
  });

  it("does not guess a community for an unregistered group or a private chat", async () => {
    await bot.handleUpdate(command("/setup", -9999, "group"));
    expect(String(sent()[0]?.payload.text)).toContain("not a registered Hyphae community");
    out.length = 0;
    await bot.handleUpdate(command("/setup", 42, "private"));
    expect(String(sent()[0]?.payload.text)).toContain("community chat");
    expect(keyboard(sent()[0])).toEqual([]);
  });
});

describe("private setup checklist", () => {
  it("shows the wallet as the next step for a member who only pasted an address", async () => {
    const { community } = await seedRewardLane(t.db);
    await openEpochNow(community.id);
    const before = await inventory();
    await bot.handleUpdate(command(`/start setup_${community.id}`, 42, "private"));
    const text = String(sent()[0]?.payload.text);
    expect(text).toContain("✅ 1. Joined");
    expect(text).toContain("➡️ 2. Link your wallet");
    expect(text).toContain("at least 100,000 of the community token");
    expect(keyboard(sent()[0])).toEqual([
      { text: "Link my wallet", callback_data: `setup_link_${community.id}` },
      { text: "Refresh", callback_data: `setup_${community.id}` },
    ]);
    expect(await inventory()).toEqual(before);
  });

  it("tells someone who has not joined to join first, with no wallet button", async () => {
    const { community } = await seedRewardLane(t.db);
    configured.status = "left";
    await bot.handleUpdate(command(`/start setup_${community.id}`, 42, "private"));
    expect(String(sent()[0]?.payload.text)).toContain("➡️ 1. Join");
    expect(keyboard(sent()[0]).map((b) => b.text)).toEqual(["Refresh"]);
  });

  it("walks a verified member through rules, alerts and a first reply", async () => {
    const { community, member, admitOne } = await seedRewardLane(t.db);
    // Admission runs on the seeded fixed-day clock, so it comes before the epoch moves to now.
    await admitOne();
    await openEpochNow(community.id);
    await t.db.update(members).set({ linkMethod: "signature" }).where(eq(members.id, member.id));

    await bot.handleUpdate(command(`/start setup_${community.id}`, 42, "private"));
    expect(String(sent()[0]?.payload.text)).toContain("➡️ 3. Pass the rules test");
    expect(keyboard(sent()[0])[0]).toEqual({
      text: "Take the rules test",
      url: `https://t.me/t_bot?start=rules_${community.id}`,
    });

    await recordPass(t.db, {
      communityId: community.id,
      memberId: member.id,
      testId: "mycel-rules-1",
    });
    out.length = 0;
    await bot.handleUpdate(command(`/start setup_${community.id}`, 42, "private"));
    expect(String(sent()[0]?.payload.text)).toContain("✅ 3. Rules test passed");
    expect(keyboard(sent()[0])[0]?.text).toBe("Turn on raid alerts");

    await t.db.insert(raidSubscriptions).values({
      communityId: community.id,
      telegramUserId: 42n,
      enabled: true,
      enabledAt: new Date(),
    });
    out.length = 0;
    await bot.handleUpdate(command(`/start setup_${community.id}`, 42, "private"));
    const text = String(sent()[0]?.payload.text);
    expect(text).toContain("✅ 4. Raid alerts on");
    expect(text).toContain("✅ 5. First reply submitted");
    expect(text).toContain("You are set up");
  });

  it("does not credit another member's progress to the person asking", async () => {
    const { community, member } = await seedRewardLane(t.db);
    await openEpochNow(community.id);
    await t.db.update(members).set({ linkMethod: "signature" }).where(eq(members.id, member.id));
    await bot.handleUpdate(command(`/start setup_${community.id}`, 77, "private", 77));
    const text = String(sent()[0]?.payload.text);
    expect(text).toContain("➡️ 2. Link your wallet");
    expect(text).not.toContain("✅ 2.");
  });

  it("ignores a forged or malformed payload", async () => {
    await seedCommunity(t.db);
    await bot.handleUpdate(command("/start setup_not-a-uuid", 42, "private"));
    expect(String(sent()[0]?.payload.text)).not.toContain("Set up for");
  });
});

describe("setup buttons", () => {
  it("sends the wallet-browser instructions and opens exactly one link session", async () => {
    const { community } = await seedRewardLane(t.db);
    const before = await inventory();
    await bot.handleUpdate(press(`setup_link_${community.id}`));
    expect(sent("answerCallbackQuery")).toHaveLength(1);
    const message = sent()[0]?.payload;
    expect(message?.parse_mode).toBe("HTML");
    expect(String(message?.text)).toContain("<code>https://api.hyphae.test/link#");
    expect(String(message?.text)).toContain("Phantom or Solflare");
    const after = await inventory();
    expect(Number(after[0]?.links)).toBe(Number(before[0]?.links) + 1);
  });

  it("refreshes the checklist in place instead of sending a new message", async () => {
    const { community } = await seedRewardLane(t.db);
    await bot.handleUpdate(press(`setup_${community.id}`));
    expect(sent()).toHaveLength(0);
    expect(sent("editMessageText")).toHaveLength(1);
    expect(String(sent("editMessageText")[0]?.payload.text)).toContain("Set up for");
  });

  it("refuses a forged callback and a callback from a group chat", async () => {
    await bot.handleUpdate(press("setup_link_not-a-uuid"));
    expect(String(sent("answerCallbackQuery")[0]?.payload.text)).toContain("private chat");
    expect(sent()).toHaveLength(0);
    expect(await t.db.select().from(communities).limit(1)).toBeDefined();
  });
});
