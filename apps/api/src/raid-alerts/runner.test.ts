import { raidDeliveries, raidSubscriptions } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { Api } from "grammy";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, seedCommunity } from "../rewards/test-db.js";
import { openRaid, setRaidSubscription } from "./alerts.js";
import { startRaidNotifier } from "./runner.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});
describe("API notifier runner with intercepted Telegram transport", () => {
  it("delivers a real outbox row privately with target and community Stop buttons", async () => {
    const { community } = await seedCommunity(t.db);
    await setRaidSubscription(t.db, community.id, 42n, true);
    await openRaid(t.db, {
      communityId: community.id,
      chatId: community.telegramChatId,
      actorId: 7n,
      messageId: 1,
      hours: 1,
      brief: "Add your view",
      post: { id: "1", handle: "owner", text: "Target", url: "https://x.com/owner/status/1" },
    });
    const api = new Api("1:test");
    const calls: { method: string; payload: Record<string, unknown> }[] = [];
    let sent!: () => void;
    const delivered = new Promise<void>((resolve) => {
      sent = resolve;
    });
    api.config.use(async (_prev, method, payload) => {
      calls.push({ method, payload: payload as Record<string, unknown> });
      if (method === "sendMessage") sent();
      return {
        ok: true,
        result: method === "getChatMember" ? { status: "member" } : true,
      } as never;
    });
    const runner = startRaidNotifier(t.db, api);
    await delivered;
    await runner.stop();
    const message = calls.find((x) => x.method === "sendMessage")?.payload;
    expect(message?.chat_id).toBe(42);
    expect(message?.text).toContain(community.name);
    expect(message?.parse_mode).toBeUndefined();
    expect(message?.reply_markup).toEqual({
      inline_keyboard: [
        [{ text: "Engage on X", url: "https://x.com/owner/status/1" }],
        [{ text: "Stop these alerts", callback_data: `raids_off_${community.id}` }],
      ],
    });
    expect((await t.db.select().from(raidDeliveries))[0]?.status).toBe("sent");
    expect(
      (
        await t.db
          .select()
          .from(raidSubscriptions)
          .where(eq(raidSubscriptions.communityId, community.id))
      )[0]?.enabled,
    ).toBe(true);
  });
  it("never logs credential-bearing driver errors", async () => {
    const token = "test-credential-must-not-appear";
    const failingDb = {
      transaction: async () => {
        throw new Error(token);
      },
    } as unknown as typeof t.db;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const runner = startRaidNotifier(failingDb, new Api("1:test"));
    await runner.stop();
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(token);
    log.mockRestore();
  });
});
