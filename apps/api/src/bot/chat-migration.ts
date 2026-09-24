import { communities, type Db } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { Composer } from "grammy";

// Upgrading a basic group to a supergroup gives it a new chat id; without this the community's
// commands would all answer "not a registered Hyphae community". Returns the moved community id.
export async function migrateCommunityChat(db: Db, from: bigint, to: bigint) {
  const [moved] = await db
    .update(communities)
    .set({ telegramChatId: to })
    .where(eq(communities.telegramChatId, from))
    .returning({ id: communities.id });
  if (moved) console.log("community chat migrated", { community: moved.id, from, to });
  return moved?.id;
}

// Telegram reports the upgrade in both chats, so either message moves the row and the other
// finds nothing to move. Neither handler replies: the old chat no longer accepts messages.
export function chatMigration(db: Db) {
  const c = new Composer();
  c.on("message:migrate_to_chat_id", (ctx) =>
    migrateCommunityChat(db, BigInt(ctx.chat.id), BigInt(ctx.msg.migrate_to_chat_id)),
  );
  c.on("message:migrate_from_chat_id", (ctx) =>
    migrateCommunityChat(db, BigInt(ctx.msg.migrate_from_chat_id), BigInt(ctx.chat.id)),
  );
  return c;
}
