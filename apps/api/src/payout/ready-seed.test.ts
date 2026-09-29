import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createTestDb } from "../rewards/test-db.js";
import { seedReadyEpoch } from "./ready-seed.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

// CI run 36591983768: two seeds in one file drew the same telegram_chat_id, which is unique.
it("seeds two communities in the same millisecond without a clash", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1_790_696_800_000);
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  try {
    const now = new Date("2026-11-20T12:00:00.000Z");
    const a = await seedReadyEpoch(t.db, { now });
    const b = await seedReadyEpoch(t.db, { now });
    expect(a.communityId).not.toBe(b.communityId);
  } finally {
    vi.restoreAllMocks();
  }
});
