import { raidCards } from "@hyphae/db";
import { eq } from "drizzle-orm";
import type { Api } from "grammy";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { announceRaid } from "../raid-alerts/announce-raid.js";
import { createTestDb, seedCommunity, seedTask } from "../rewards/test-db.js";
import type { XPost } from "../x/oembed.js";
import { telegramRaidDeps } from "./telegram.js";

const POST: XPost = {
  id: "1",
  handle: "owner",
  text: "A public post",
  url: "https://x.com/a/status/1",
};
const WEB = "https://hyphae.example";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.close());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function fakeApi() {
  const calls: { method: string; args: unknown[] }[] = [];
  let next = 40;
  const record =
    (method: string) =>
    async (...args: unknown[]) => {
      calls.push({ method, args });
      next += 1;
      return method === "getMe" ? { id: 777, username: "hyphae_bot" } : { message_id: next };
    };
  const api = {
    getMe: record("getMe"),
    sendMessage: record("sendMessage"),
    sendPhoto: record("sendPhoto"),
    pinChatMessage: async () => true,
  } as unknown as Api;
  return { api, calls };
}

describe("a raid posted from Organic is announced as /raid announces it", () => {
  it("sends /raid's message to the community's group and returns its message id", async () => {
    vi.stubEnv("RAID_CARDS", "off");
    const { community } = await seedCommunity(t.db);
    const task = await seedTask(t.db, community.id, new Date("2026-11-02T10:00:00Z"));
    const { api, calls } = fakeApi();
    const deps = telegramRaidDeps(t.db, api, WEB);
    const messageId = await deps.announce(community, POST, task, 48);
    const sent = calls.filter((c) => c.method === "sendMessage");
    expect(sent).toHaveLength(1);
    expect(messageId).toBe(42);

    // What /raid sends through ctx.reply: the same shared announcer, its text and options.
    let replied: unknown[] = [];
    await announceRaid(
      t.db,
      {
        api,
        botUsername: "hyphae_bot",
        sendText: async (...args) => {
          replied = args;
          return { message_id: 1 };
        },
      },
      community,
      POST,
      task,
      48,
      WEB,
    );
    expect(sent[0]?.args).toEqual([Number(community.telegramChatId), ...replied]);
    expect(String(sent[0]?.args[1])).toContain(`Raid open for 48h — @owner:`);
    expect(String(sent[0]?.args[1])).toContain(`Raid ID: ${task.id}`);
  });

  it("with raid cards on, sends, records and pins the same card /raid would", async () => {
    vi.stubEnv("RAID_CARDS", "on");
    vi.stubGlobal("fetch", async () => new Response("no image", { status: 503 }));
    const { community } = await seedCommunity(t.db);
    const task = await seedTask(t.db, community.id, new Date("2026-11-02T10:00:00Z"));
    const { api, calls } = fakeApi();
    const messageId = await telegramRaidDeps(t.db, api, WEB).announce(community, POST, task, 48);
    const sent = calls.find((c) => c.method === "sendMessage");
    expect(sent?.args[0]).toBe(Number(community.telegramChatId));
    const [card] = await t.db.select().from(raidCards).where(eq(raidCards.taskId, task.id));
    expect(card?.telegramMessageId).toBe(messageId);
  });

  it("names the bot as the raid's Telegram actor, asking Telegram once", async () => {
    const { api, calls } = fakeApi();
    const deps = telegramRaidDeps(t.db, api, WEB);
    expect([await deps.botId(), await deps.botId()]).toEqual([777n, 777n]);
    expect(calls.filter((c) => c.method === "getMe")).toHaveLength(1);
  });
});
