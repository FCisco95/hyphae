import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity, seedTask } from "../rewards/test-db.js";
import { cardOf, markPinned, markResults, recordCard } from "./store.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

describe("raid card store", () => {
  it("records a card once, reads it, and marks its results message due", async () => {
    const { community } = await seedCommunity(t.db);
    const task = await seedTask(t.db, community.id, new Date("2031-01-01T00:00:00.000Z"));
    const card = {
      taskId: task.id,
      communityId: community.id,
      telegramChatId: community.telegramChatId,
      telegramMessageId: 50,
      format: "photo" as const,
      state: "open" as const,
      renderedHash: "first",
      nextRefreshAt: new Date("2031-01-01T00:01:00.000Z"),
    };
    await recordCard(t.db, card);
    await recordCard(t.db, { ...card, telegramMessageId: 51, renderedHash: "second" });
    expect(await cardOf(t.db, task.id)).toMatchObject({
      telegramMessageId: 50,
      renderedHash: "first",
      resultsMessageId: null,
    });
    const now = new Date("2031-01-03T00:20:00.000Z");
    await markResults(t.db, task.id, 77, now);
    expect(await cardOf(t.db, task.id)).toMatchObject({
      resultsMessageId: 77,
      nextRefreshAt: now,
      holdUntil: null,
    });
    expect(await cardOf(t.db, "00000000-0000-4000-8000-000000000000")).toBeUndefined();
  });

  it("marks a pin only on the message that was recorded", async () => {
    const { community } = await seedCommunity(t.db);
    const task = await seedTask(t.db, community.id, new Date("2031-01-01T00:00:00.000Z"));
    await recordCard(t.db, {
      taskId: task.id,
      communityId: community.id,
      telegramChatId: community.telegramChatId,
      telegramMessageId: 50,
      format: "photo",
      state: "open",
      renderedHash: "first",
      nextRefreshAt: new Date("2031-01-01T00:01:00.000Z"),
    });
    const pinnedAt = new Date("2031-01-01T00:00:01.000Z");
    await markPinned(t.db, task.id, 51, { pinnedAt, pinError: null });
    expect(await cardOf(t.db, task.id)).toMatchObject({ pinnedAt: null, pinError: null });
    await markPinned(t.db, task.id, 50, { pinnedAt: null, pinError: "pin_403" });
    expect(await cardOf(t.db, task.id)).toMatchObject({ pinnedAt: null, pinError: "pin_403" });
    await markPinned(t.db, task.id, 50, { pinnedAt, pinError: null });
    expect(await cardOf(t.db, task.id)).toMatchObject({ pinnedAt, pinError: null });
  });
});
