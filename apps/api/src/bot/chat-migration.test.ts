import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, seedCommunity } from "../rewards/test-db.js";
import { chatMigration, migrateCommunityChat } from "./chat-migration.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const chatOf = async (id: string) =>
  (await t.db.query.communities.findFirst({ where: eq(communities.id, id) }))?.telegramChatId;

describe("migrateCommunityChat", () => {
  it("moves the community to the supergroup's id and leaves others alone", async () => {
    const { community } = await seedCommunity(t.db);
    const { community: other } = await seedCommunity(t.db);
    const to = -1_009_000_000_001n;

    expect(await migrateCommunityChat(t.db, community.telegramChatId, to)).toBe(community.id);
    expect(await chatOf(community.id)).toBe(to);
    expect(await chatOf(other.id)).toBe(other.telegramChatId);
  });

  it("is a no-op the second time, since Telegram reports the upgrade in both chats", async () => {
    const { community } = await seedCommunity(t.db);
    const to = -1_009_000_000_002n;
    await migrateCommunityChat(t.db, community.telegramChatId, to);

    expect(await migrateCommunityChat(t.db, community.telegramChatId, to)).toBeUndefined();
    expect(await chatOf(community.id)).toBe(to);
  });

  it("leaves both rows and reports a conflict when the new id already has a community", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { community } = await seedCommunity(t.db);
    const { community: holder } = await seedCommunity(t.db);

    expect(
      await migrateCommunityChat(t.db, community.telegramChatId, holder.telegramChatId),
    ).toBeUndefined();
    expect(await chatOf(community.id)).toBe(community.telegramChatId);
    expect(await chatOf(holder.id)).toBe(holder.telegramChatId);
    expect(err).toHaveBeenCalledWith(
      "community chat migration conflict",
      expect.objectContaining({ community: community.id, holder: holder.id }),
    );
    err.mockRestore();
  });

  it("ignores a chat that is not a community", async () => {
    expect(await migrateCommunityChat(t.db, -1n, -1_009_000_000_003n)).toBeUndefined();
  });
});

const me = { id: 1, is_bot: true, first_name: "T", username: "t_bot" } as UserFromGetMe;
const service = (chatId: number, fields: object): Update =>
  ({
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: chatId, type: chatId < -1_000_000_000_000 ? "supergroup" : "group", title: "g" },
      ...fields,
    },
  }) as Update;

describe("chatMigration", () => {
  const bot = () => {
    const b = new Bot("1:t", { botInfo: me });
    b.api.config.use(async () => {
      throw new Error("the upgrade handler must not call the Bot API");
    });
    b.use(chatMigration(t.db));
    return b;
  };

  it("follows migrate_to_chat_id, sent in the old group", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { community } = await seedCommunity(t.db);
    const to = -1_009_000_000_004;
    await bot().handleUpdate(service(Number(community.telegramChatId), { migrate_to_chat_id: to }));
    expect(await chatOf(community.id)).toBe(BigInt(to));
    log.mockRestore();
  });

  it("follows migrate_from_chat_id, sent in the new supergroup", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { community } = await seedCommunity(t.db);
    const to = -1_009_000_000_005;
    await bot().handleUpdate(
      service(to, { migrate_from_chat_id: Number(community.telegramChatId) }),
    );
    expect(await chatOf(community.id)).toBe(BigInt(to));
    log.mockRestore();
  });
});
