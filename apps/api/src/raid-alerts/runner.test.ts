import { setTimeout } from "node:timers/promises";
import { raidDeliveries, raidRecaps, raidSubscriptions, tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { Api } from "grammy";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, seedCommunity, seedTask } from "../rewards/test-db.js";
import { openRaid, setRaidSubscription } from "./alerts.js";
import { startRaidNotifier } from "./runner.js";

const WEB = "https://hyphae.test";
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
    const runner = startRaidNotifier(t.db, api, WEB);
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
        [
          { text: "Reply on X", url: "https://x.com/intent/tweet?in_reply_to=1" },
          {
            text: "Quote on X",
            url: "https://x.com/intent/tweet?url=https%3A%2F%2Fx.com%2Fowner%2Fstatus%2F1",
          },
        ],
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
    const runner = startRaidNotifier(failingDb, new Api("1:test"), WEB);
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
    const runner = startRaidNotifier(t.db, api, WEB);
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
  it("posts one recap in the group when a raid's window has ended", async () => {
    const { community } = await seedCommunity(t.db);
    const task = await seedTask(
      t.db,
      community.id,
      new Date(Date.now() - 48 * 3_600_000 - 300_000),
    );
    const api = new Api("1:test");
    const calls: { method: string; payload: Record<string, unknown> }[] = [];
    let posted!: () => void;
    const done = new Promise<void>((resolve) => {
      posted = resolve;
    });
    api.config.use(async (_prev, method, payload) => {
      calls.push({ method, payload: payload as Record<string, unknown> });
      if (method === "sendMessage") posted();
      return { ok: true, result: { message_id: 5 } } as never;
    });
    const runner = startRaidNotifier(t.db, api, WEB);
    await done;
    await runner.stop();
    const sent = calls.filter((x) => x.method === "sendMessage").map((x) => x.payload);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.chat_id).toBe(Number(community.telegramChatId));
    expect(String(sent[0]?.text).split("\n")[0]).toBe("Raid ended — @?:");
    expect(sent[0]?.link_preview_options).toEqual({ is_disabled: true });
    expect(
      (await t.db.select().from(raidRecaps).where(eq(raidRecaps.taskId, task.id)))[0],
    ).toMatchObject({ status: "sent", telegramMessageId: 5 });
  });
  it("retries a rate-limited recap once and never a third time, even after a restart", async () => {
    const { community } = await seedCommunity(t.db);
    const task = await seedTask(
      t.db,
      community.id,
      new Date(Date.now() - 48 * 3_600_000 - 120_000),
    );
    const api = new Api("1:test");
    let requests = 0;
    let secondRequest!: () => void;
    const limitedTwice = new Promise<void>((resolve) => {
      secondRequest = resolve;
    });
    api.config.use(async (_prev, method) => {
      if (method !== "sendMessage") return { ok: true, result: true } as never;
      requests += 1;
      if (requests === 2) secondRequest();
      return {
        ok: false,
        error_code: 429,
        description: "Too Many Requests: retry after 1",
        parameters: { retry_after: 1 },
      } as never;
    });
    const first = startRaidNotifier(t.db, api, WEB);
    await limitedTwice;
    await first.stop();
    const restarted = startRaidNotifier(t.db, api, WEB);
    await setTimeout(2_500);
    await restarted.stop();
    expect(requests).toBe(2);
    expect(
      (await t.db.select().from(raidRecaps).where(eq(raidRecaps.taskId, task.id)))[0],
    ).toMatchObject({ status: "failed", reason: "rate_limit_retry_exhausted", retryUsed: true });
  }, 15_000);
});
