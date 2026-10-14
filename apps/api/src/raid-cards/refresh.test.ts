import { GrammyError, type InlineKeyboard } from "grammy";
import { afterEach, describe, expect, it } from "vitest";
import { transitionRaid } from "../member-journey/lifecycle.js";
import { at, createTestDb, seedCommunity, seedTask } from "../rewards/test-db.js";
import { type CardEditor, refreshDueCard } from "./refresh.js";
import { cardOf, markResults, recordCard } from "./store.js";

const MIN = 60_000;
const HOUR = 60 * MIN;
const CHAT = -1001234567890n;
// Each test gets its own database, so no other test's card is ever due.
let t: Awaited<ReturnType<typeof createTestDb>> | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

async function liveCard() {
  await t?.close();
  t = await createTestDb();
  const db = t.db;
  const opens = new Date("2032-01-01T00:00:00.000Z");
  const { community } = await seedCommunity(db);
  const task = await seedTask(db, community.id, opens);
  await recordCard(db, {
    taskId: task.id,
    communityId: community.id,
    telegramChatId: CHAT,
    telegramMessageId: 50,
    format: "photo",
    state: "open",
    renderedHash: "first",
    nextRefreshAt: new Date(opens.getTime() + MIN),
    pinnedAt: opens,
  });
  return { db, community, task, opens };
}

const failure = (code: number, description: string, parameters = {}) =>
  new GrammyError(
    description,
    { ok: false, error_code: code, description, parameters },
    "editMessageCaption",
    {},
  );

function editor(fail?: () => unknown) {
  const calls: { method: string; caption?: string; keyboard?: unknown }[] = [];
  const edit =
    (method: string) =>
    async (_c: bigint, _m: number, caption: string, keyboard: InlineKeyboard) => {
      calls.push({ method, caption, keyboard: keyboard.inline_keyboard });
      if (fail) throw fail();
    };
  const api: CardEditor = {
    editCaption: edit("editCaption"),
    editText: edit("editText"),
    unpin: async () => {
      calls.push({ method: "unpin" });
    },
    botUsername: async () => "hyphae_bot",
  };
  return { api, calls };
}

// Each test boots its own PGlite inside the test body, which can pass 5 s under full parallel load.
describe("raid card refresh", { timeout: 30_000 }, () => {
  it("edits a minute after opening, then only when what it shows changes", async () => {
    const { db, opens } = await liveCard();
    const e = editor();
    expect(await refreshDueCard(db, e.api, new Date(opens.getTime() + 30_000))).toBeUndefined();
    const now = new Date(opens.getTime() + MIN + 1000);
    expect(await refreshDueCard(db, e.api, now)).toBe("edited");
    expect(e.calls[0]?.caption).toContain("🔴 <b>Raid live</b>");
    expect(await refreshDueCard(db, e.api, new Date(now.getTime() + 1000))).toBeUndefined();
    expect(await refreshDueCard(db, e.api, new Date(now.getTime() + MIN + 1000))).toBe("unchanged");
    expect(e.calls).toHaveLength(1);
  });

  it("closes the card within a second of the raid ending: final caption, no buttons, unpinned", async () => {
    const { db, task } = await liveCard();
    const e = editor();
    const after = new Date(task.closesAt.getTime() + 1000);
    expect(await refreshDueCard(db, e.api, after)).toBe("final");
    expect(e.calls.map((c) => c.method)).toEqual(["editCaption", "unpin"]);
    expect(e.calls[0]?.caption).toContain("⚫ <b>Raid closed</b>");
    expect(e.calls[0]?.keyboard).toEqual([]);
    expect(await cardOf(db, task.id)).toMatchObject({
      state: "ended",
      nextRefreshAt: null,
      holdUntil: null,
      unpinnedAt: after,
    });
    expect(await refreshDueCard(db, e.api, new Date(after.getTime() + HOUR))).toBeUndefined();
  });

  it("adds the Results button once the results message exists", async () => {
    const { db, task } = await liveCard();
    const e = editor();
    const after = new Date(task.closesAt.getTime() + 1000);
    await refreshDueCard(db, e.api, after);
    await markResults(db, task.id, 99, new Date(after.getTime() + MIN));
    expect(await refreshDueCard(db, e.api, new Date(after.getTime() + MIN))).toBe("final");
    expect(e.calls.at(-1)?.keyboard).toEqual([
      [{ text: "📊 Results", url: "https://t.me/c/1234567890/99" }],
    ]);
    expect(e.calls.filter((c) => c.method === "unpin")).toHaveLength(1);
  });

  it("keeps a results request that lands while the final edit is in flight", async () => {
    const { db, task } = await liveCard();
    const after = new Date(task.closesAt.getTime() + 1000);
    const keyboards: unknown[] = [];
    const racing: CardEditor = {
      ...editor().api,
      editCaption: async (_c, _m, _caption, keyboard) => {
        keyboards.push(keyboard.inline_keyboard);
        // The recap posts its results message between this refresh's claim and its settle.
        if (keyboards.length === 1) await markResults(db, task.id, 99, after);
      },
    };
    expect(await refreshDueCard(db, racing, after)).toBe("final");
    expect((await cardOf(db, task.id))?.nextRefreshAt).not.toBeNull();
    expect(await refreshDueCard(db, racing, new Date(after.getTime() + 1000))).toBe("final");
    expect(keyboards.at(-1)).toEqual([
      [{ text: "📊 Results", url: "https://t.me/c/1234567890/99" }],
    ]);
    expect(await cardOf(db, task.id)).toMatchObject({ nextRefreshAt: null, holdUntil: null });
  });

  it("shows a cancelled raid with its reason", async () => {
    const { db, community, task, opens } = await liveCard();
    const when = new Date(opens.getTime() + 10 * MIN);
    await transitionRaid(
      db,
      {
        communityId: community.id,
        taskId: task.id,
        chatId: community.telegramChatId,
        actorId: 7n,
        messageId: 1,
        action: "cancelled",
        reason: "Wrong post",
      },
      at(when),
    );
    const e = editor();
    expect(await refreshDueCard(db, e.api, new Date(when.getTime() + 1000))).toBe("final");
    expect(e.calls[0]?.caption).toBe("Raid cancelled: this post\nWrong post");
    expect((await cardOf(db, task.id))?.state).toBe("cancelled");
  });

  it("stops for good when the card was deleted or the bot removed", async () => {
    for (const error of [
      failure(400, "Bad Request: message to edit not found"),
      failure(403, "Forbidden: bot was kicked"),
    ]) {
      const { db, task, opens } = await liveCard();
      const e = editor(() => error);
      const now = new Date(opens.getTime() + MIN + 1000);
      expect(await refreshDueCard(db, e.api, now)).toBe("gone");
      expect(await cardOf(db, task.id)).toMatchObject({ state: "gone", nextRefreshAt: null });
      expect(
        await refreshDueCard(db, e.api, new Date(task.closesAt.getTime() + 1000)),
      ).toBeUndefined();
    }
  });

  it("treats 'message is not modified' as drawn", async () => {
    const { db, opens } = await liveCard();
    const e = editor(() => failure(400, "Bad Request: message is not modified"));
    expect(await refreshDueCard(db, e.api, new Date(opens.getTime() + MIN + 1000))).toBe(
      "unchanged",
    );
  });

  it("waits out a rate limit, and backs off a minute after an unknown failure", async () => {
    const { db, opens } = await liveCard();
    const now = new Date(opens.getTime() + MIN + 1000);
    expect(
      await refreshDueCard(
        db,
        editor(() => failure(429, "Too Many Requests", { retry_after: 30 })).api,
        now,
      ),
    ).toBe("rate_limited");
    expect(
      await refreshDueCard(db, editor().api, new Date(now.getTime() + 10_000)),
    ).toBeUndefined();
    expect(
      await refreshDueCard(
        db,
        editor(() => new Error("socket hang up")).api,
        new Date(now.getTime() + 31_000),
      ),
    ).toBe("failed");
    expect(
      await refreshDueCard(db, editor().api, new Date(now.getTime() + 61_000)),
    ).toBeUndefined();
    expect(await refreshDueCard(db, editor().api, new Date(now.getTime() + 92_000))).toBe("edited");
  });

  it("retries a crashed refresh after its 30-second hold, not every second", async () => {
    const { db, opens } = await liveCard();
    const now = new Date(opens.getTime() + MIN + 1000);
    const crashing: CardEditor = {
      ...editor().api,
      botUsername: async () => {
        throw new Error("getMe failed");
      },
    };
    await expect(refreshDueCard(db, crashing, now)).rejects.toThrow("getMe failed");
    expect(await refreshDueCard(db, editor().api, new Date(now.getTime() + 1000))).toBeUndefined();
    expect(await refreshDueCard(db, editor().api, new Date(now.getTime() + 31_000))).toBe("edited");
  });
});
