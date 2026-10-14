import { type Db, raidCards } from "@hyphae/db";
import { and, eq } from "drizzle-orm";

export type RaidCard = typeof raidCards.$inferSelect;

// A webhook retry may announce twice; the first card stays the raid's card.
export async function recordCard(db: Db, card: typeof raidCards.$inferInsert) {
  await db.insert(raidCards).values(card).onConflictDoNothing({ target: raidCards.taskId });
}

// The message id keeps a second announce, whose card was not recorded, from marking the first
// card's row.
export async function markPinned(
  db: Db,
  taskId: string,
  messageId: number,
  pin: { pinnedAt: Date | null; pinError: string | null },
) {
  await db
    .update(raidCards)
    .set(pin)
    .where(and(eq(raidCards.taskId, taskId), eq(raidCards.telegramMessageId, messageId)));
}

export async function cardOf(db: Db, taskId: string): Promise<RaidCard | undefined> {
  return (await db.select().from(raidCards).where(eq(raidCards.taskId, taskId)))[0];
}

// The results message exists: draw the card once more, now with its Results button. A claim in
// flight keeps its hold, so no second process edits the card alongside it; the card is drawn
// when that claim settles or its hold ends.
export async function markResults(db: Db, taskId: string, messageId: number, now: Date) {
  await db
    .update(raidCards)
    .set({ resultsMessageId: messageId, nextRefreshAt: now })
    .where(eq(raidCards.taskId, taskId));
}
