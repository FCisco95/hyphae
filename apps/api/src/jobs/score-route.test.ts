import { contributions, tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity, seedTask } from "../rewards/test-db.js";
import { loadScoreTarget, scoreTarget, scoreText } from "./score-route.js";

const row = { chatId: -1001n, messageId: 5, memberUserId: 42n, raidHandle: "owner" };

describe("score route", () => {
  it("keeps every score in the group, threaded, while raid cards are off", () => {
    for (const kind of ["reply", "quote", "text", "post"] as const)
      expect(scoreTarget({ ...row, kind }, false)).toEqual({
        chatId: -1001,
        replyTo: 5,
        private: false,
        prefix: null,
      });
  });

  it("sends a reply or quote back to the member privately, naming the raid", () => {
    const target = scoreTarget({ ...row, kind: "quote" }, true);
    expect(target).toEqual({
      chatId: 42,
      replyTo: null,
      private: true,
      prefix: "Your quote on the @owner raid:",
    });
    expect(scoreText(target, "Quality 76/100")).toBe(
      "Your quote on the @owner raid:\nQuality 76/100",
    );
  });

  it("keeps group text work in the group, and names no raid it lacks", () => {
    expect(scoreTarget({ ...row, kind: "text" }, true).private).toBe(false);
    expect(scoreTarget({ ...row, kind: "reply", raidHandle: null }, true).prefix).toBe(
      "Your reply:",
    );
    expect(scoreText(scoreTarget({ ...row, kind: "text" }, true), "Score 5/100")).toBe(
      "Score 5/100",
    );
  });
});

describe("loadScoreTarget", () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  beforeAll(async () => {
    t = await createTestDb();
  });
  afterAll(async () => {
    await t.close();
  });

  it("reads the chat, the source message, the member and the raid's author", async () => {
    const { community, member } = await seedCommunity(t.db);
    const task = await seedTask(t.db, community.id, new Date());
    await t.db.update(tasks).set({ targetAuthor: "owner" }).where(eq(tasks.id, task.id));
    const [c] = await t.db
      .insert(contributions)
      .values({
        communityId: community.id,
        memberId: member.id,
        taskId: task.id,
        kind: "reply",
        url: "https://x.com/m/status/9",
        text: "a reply",
        telegramMessageId: 9,
      })
      .returning();
    if (!c) throw new Error("fixture");
    expect(await loadScoreTarget(t.db, c.id)).toEqual({
      chatId: community.telegramChatId,
      messageId: 9,
      kind: "reply",
      memberUserId: 42n,
      raidHandle: "owner",
    });
    await expect(loadScoreTarget(t.db, "00000000-0000-4000-8000-000000000000")).rejects.toThrow(
      "missing",
    );
  });
});
