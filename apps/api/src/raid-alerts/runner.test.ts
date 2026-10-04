import { raidDeliveries, raidSubscriptions, tasks } from "@hyphae/db";
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
    const signals: unknown[] = [];
    api.config.use(async (_prev, method, payload, signal) => {
      signals.push(signal);
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
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true);
    const message = calls.find((x) => x.method === "sendMessage")?.payload;
    expect(message?.chat_id).toBe(42);
    expect(message?.text).toContain(community.name);
    expect(message?.parse_mode).toBeUndefined();
    const task = (await t.db.select().from(tasks))[0];
    expect(message?.reply_markup).toEqual({
      inline_keyboard: [
        [{ text: "Engage on X", url: "https://x.com/owner/status/1" }],
        [
          { text: "Submit my reply", callback_data: `raid_reply_${task?.id}` },
          { text: "Submit my quote", callback_data: `raid_quote_${task?.id}` },
        ],
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
  it("a timed-out send stays uncertain and is not automatically retried", async () => {
    const { community } = await seedCommunity(t.db);
    await setRaidSubscription(t.db, community.id, 42n, true);
    const opened = await openRaid(t.db, {
      communityId: community.id,
      chatId: community.telegramChatId,
      actorId: 7n,
      messageId: 1,
      hours: 1,
      brief: "Explain",
      post: { id: "1", handle: "a", text: "Target", url: "https://x.com/a/status/1" },
    });
    if (opened.status !== "created") throw new Error("raid");
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => realTimeout(15));
    const api = new Api("1:test");
    let signalExpired = () => {};
    const expired = new Promise<void>((resolve) => {
      signalExpired = resolve;
    });
    let sends = 0;
    api.config.use(async (_prev, method, _payload, signal) => {
      if (method === "getChatMember") return { ok: true, result: { status: "member" } } as never;
      sends += 1;
      return new Promise((_resolve, reject) => {
        const fail = () => {
          signalExpired();
          reject(new Error("bounded timeout"));
        };
        if (!signal || signal.aborted) fail();
        else signal.addEventListener("abort", fail, { once: true });
      });
    });
    const runner = startRaidNotifier(t.db, api);
    try {
      await expired;
    } finally {
      await runner.stop();
      timeout.mockRestore();
    }
    const rows = await t.db.select().from(raidDeliveries);
    expect(rows.filter((row) => row.status === "uncertain")).toHaveLength(1);
    expect(sends).toBe(1);
  });
});
