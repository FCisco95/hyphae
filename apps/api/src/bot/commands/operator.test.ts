import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity } from "../../rewards/test-db.js";
import { operator } from "./operator.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
let bot: Bot;
let updateId = 0;
const output: { method: string; payload: Record<string, unknown> }[] = [];
const command = (
  text: string,
  userId = 7,
  chatId = userId,
  type: "private" | "group" = "private",
  isBot = false,
): Update => ({
  update_id: ++updateId,
  message: {
    message_id: updateId,
    date: 0,
    from: { id: userId, is_bot: isBot, first_name: "Operator" },
    chat:
      type === "private"
        ? { id: chatId, type, first_name: "Operator" }
        : { id: chatId, type, title: "Group" },
    text,
    entities: [{ type: "bot_command", offset: 0, length: 4 }],
  },
});
const texts = () =>
  output.filter((r) => r.method === "sendMessage").map((r) => String(r.payload.text));
beforeAll(async () => {
  t = await createTestDb();
  bot = new Bot("1:fixture", {
    botInfo: {
      id: 1,
      is_bot: true,
      first_name: "Fixture",
      username: "fixture_bot",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
    } as UserFromGetMe,
  });
  bot.command("ops", (ctx) => operator(t.db, ctx));
  bot.api.config.use(async (_prev, method, payload) => {
    output.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: true } as never;
  });
});
beforeEach(() => {
  output.length = 0;
});
afterAll(async () => {
  await t.close();
});

describe("private operator command", () => {
  it("returns community telemetry only to the current designated admin in their own private chat", async () => {
    const { community } = await seedCommunity(t.db);
    await bot.handleUpdate(command(`/ops ${community.id}`));
    expect(texts()[0]).toContain(`Operator view: ${community.name}`);
    expect(texts()[0]).toContain("telemetry unavailable");
    expect(output.every((r) => r.method === "sendMessage")).toBe(true);
    expect(output[0]?.payload.chat_id).toBe(7);
    await t.db
      .update(communities)
      .set({ adminTelegramUserId: 9n })
      .where(eq(communities.id, community.id));
    await bot.handleUpdate(command(`/ops ${community.id}`));
    expect(texts().at(-1)).toContain("Only the current designated admin");
  });
  it("refuses group chats, mismatched private identities, bots and unauthorized callers", async () => {
    const { community } = await seedCommunity(t.db);
    for (const update of [
      command(`/ops ${community.id}`, 7, Number(community.telegramChatId), "group"),
      command(`/ops ${community.id}`, 7, 99),
      command(`/ops ${community.id}`, 7, 7, "private", true),
      command(`/ops ${community.id}`, 42),
      command("/ops invalid"),
    ])
      await bot.handleUpdate(update);
    expect(texts()).toHaveLength(5);
    expect(texts().join("\n")).not.toContain(community.name);
    expect(texts().join("\n")).not.toContain("Recorded model cost");
    expect(output.every((r) => r.method === "sendMessage")).toBe(true);
  });
});
