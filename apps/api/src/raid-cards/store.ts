import { type Db, raidCards } from "@hyphae/db";
import { eq } from "drizzle-orm";

export type RaidCard = typeof raidCards.$inferSelect;

// A webhook retry may announce twice; the first card stays the raid's card.
export async function recordCard(db: Db, card: typeof raidCards.$inferInsert) {
  await db.insert(raidCards).values(card).onConflictDoNothing({ target: raidCards.taskId });
}

export async function cardOf(db: Db, taskId: string): Promise<RaidCard | undefined> {
  return (await db.select().from(raidCards).where(eq(raidCards.taskId, taskId)))[0];
}

// The results message exists: draw the card once more, now with its Results button.
export async function markResults(db: Db, taskId: string, messageId: number, now: Date) {
  await db
    .update(raidCards)
    .set({ resultsMessageId: messageId, nextRefreshAt: now, holdUntil: null })
    .where(eq(raidCards.taskId, taskId));
}
