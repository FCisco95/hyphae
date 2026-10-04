import { communities, raidLifecycleEvents, tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedCommunity, seedTask } from "../../rewards/test-db.js";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../../db.js", () => ({
  get db() {
    return state.db;
  },
}));

let t: Awaited<ReturnType<typeof createTestDb>>;
let bot: Bot;
let sequence = 0;
const sent: string[] = [];
const update = (
  text: string,
  chatId: number,
  from = 7,
  type: "group" | "private" = "group",
): Update => ({
  update_id: ++sequence,
  message: {
    message_id: sequence,
    date: 0,
    chat:
      type === "group" ? { id: chatId, type, title: "Lab" } : { id: chatId, type, first_name: "M" },
    from: { id: from, is_bot: false, first_name: "M" },
    text,
    entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0]?.length ?? 0 }],
  },
});
async function fixture() {
  const { community } = await seedCommunity(t.db);
  const task = await seedTask(t.db, community.id, new Date());
  return { community, task, chatId: Number(community.telegramChatId) };
}
beforeAll(async () => {
  t = await createTestDb();
  state.db = t.db;
  const { closeRaid, cancelRaid } = await import("./raid-lifecycle.js");
  bot = new Bot("123:fixture", {
    botInfo: { id: 1, is_bot: true, first_name: "T", username: "t_bot" } as UserFromGetMe,
  });
  bot.command("close_raid", closeRaid);
  bot.command("cancel_raid", cancelRaid);
  bot.api.config.use(async (_previous, method, payload) => {
    if (method !== "sendMessage") throw new Error(`Unexpected Telegram request: ${method}`);
    sent.push(String((payload as { text: string }).text));
    return { ok: true, result: true } as never;
  });
});
afterAll(async () => {
  await t.close();
});
beforeEach(() => {
  sent.length = 0;
});

describe("raid close/cancel commands", () => {
  it("lets the designated admin terminally close or cancel a historical open brief", async () => {
    for (const command of ["close_raid", "cancel_raid"]) {
      const { task, chatId } = await fixture();
      await t.db.update(tasks).set({ kind: "open" }).where(eq(tasks.id, task.id));
      await bot.handleUpdate(update(`/${command} ${task.id} Historical brief ended`, chatId));
      expect(sent.at(-1)).toContain(
        command === "close_raid" ? "Brief closed." : "Brief cancelled.",
      );
      expect(sent.at(-1)).toContain(`Brief: ${task.id}`);
      expect(sent.at(-1)).toContain("Existing submissions, scores and credit remain unchanged");
    }
  });
  it("requires the registered group and a raid identifier with a bounded reason", async () => {
    const { task, chatId } = await fixture();
    await bot.handleUpdate(update(`/close_raid ${task.id} Done`, 7, 7, "private"));
    expect(sent.at(-1)).toContain("registered community group");
    await bot.handleUpdate(update(`/close_raid ${task.id} Done`, -99999));
    expect(sent.at(-1)).toContain("not a registered Hyphae community");
    for (const args of [task.id, "invalid Done", `${task.id} ${"a".repeat(501)}`]) {
      await bot.handleUpdate(update(`/close_raid ${args}`, chatId));
      expect(sent.at(-1)).toContain("Usage: /close_raid");
    }
    expect((await t.db.select().from(tasks).where(eq(tasks.id, task.id)))[0]?.status).toBe("open");
  });
  it("denies a member and a revoked admin without reporting a successful closure", async () => {
    const { community, task, chatId } = await fixture();
    await bot.handleUpdate(update(`/close_raid ${task.id} Done`, chatId, 42));
    expect(sent.at(-1)).toContain("current designated admin");
    await t.db
      .update(communities)
      .set({ adminTelegramUserId: 8n })
      .where(eq(communities.id, community.id));
    await bot.handleUpdate(update(`/cancel_raid ${task.id} Removed`, chatId, 7));
    expect(sent.at(-1)).toContain("current designated admin");
    expect(
      sent.some((text) => text.startsWith("Raid closed") || text.startsWith("Raid cancelled")),
    ).toBe(false);
    expect((await t.db.select().from(tasks).where(eq(tasks.id, task.id)))[0]?.status).toBe("open");
  });
  it("does not act on another community's raid even for an admin of both groups", async () => {
    const a = await fixture();
    const b = await fixture();
    await bot.handleUpdate(update(`/cancel_raid ${b.task.id} Wrong community`, a.chatId));
    expect(sent.at(-1)).toContain("not found in this community");
    expect((await t.db.select().from(tasks).where(eq(tasks.id, b.task.id)))[0]?.status).toBe(
      "open",
    );
  });
  it("returns a lifecycle receipt and states that closure is not a reward or payment result", async () => {
    const { task, chatId } = await fixture();
    await bot.handleUpdate(update(`/close_raid ${task.id} Brief finished`, chatId));
    const [event] = await t.db
      .select()
      .from(raidLifecycleEvents)
      .where(eq(raidLifecycleEvents.taskId, task.id));
    expect(sent.at(-1)).toContain("Raid closed.");
    expect(sent.at(-1)).toContain(`Raid: ${task.id}`);
    expect(sent.at(-1)).toContain(`Receipt: ${event?.id}`);
    expect(sent.at(-1)).toContain("Reason: Brief finished");
    expect(sent.at(-1)).toContain("Existing submissions, scores and credit remain unchanged");
    expect(sent.at(-1)).toContain(
      "does not establish eligibility, allocation, claimability or payment",
    );
  });
  it("cancellation retries return the original receipt and refuse a later closure rewrite", async () => {
    const { task, chatId } = await fixture();
    const first = update(`/cancel_raid ${task.id} Target removed`, chatId);
    await bot.handleUpdate(first);
    const original = sent.at(-1);
    await bot.handleUpdate(first);
    expect(sent.at(-1)).toContain("Raid cancelled (already recorded)");
    const [event] = await t.db
      .select()
      .from(raidLifecycleEvents)
      .where(eq(raidLifecycleEvents.taskId, task.id));
    expect(original).toContain(`Receipt: ${event?.id}`);
    expect(sent.at(-1)).toContain(`Receipt: ${event?.id}`);
    await bot.handleUpdate(update(`/close_raid ${task.id} Replacement decision`, chatId));
    expect(sent.at(-1)).toContain("already cancelled");
    expect(sent.at(-1)).toContain("recorded decision was not changed");
    expect(
      await t.db.select().from(raidLifecycleEvents).where(eq(raidLifecycleEvents.taskId, task.id)),
    ).toHaveLength(1);
  });
});
