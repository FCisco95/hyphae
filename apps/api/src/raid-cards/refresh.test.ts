import { communities, raidCards } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { type Api, GrammyError, InlineKeyboard } from "grammy";
import { afterEach, describe, expect, it, vi } from "vitest";
import { transitionRaid } from "../member-journey/lifecycle.js";
import { dbClock } from "../rewards/config.js";
import { at, createTestDb, seedCommunity, seedTask } from "../rewards/test-db.js";
import {
  type CardEditor,
  type CardOutcome,
  refreshDueCard,
  telegramCardEditor,
} from "./refresh.js";
import { cardOf, markResults, recordCard } from "./store.js";

// The database clock, unless a test makes it read a set time to stand for slow reads.
vi.mock("../rewards/config.js", async (original) => {
  const real = await original<typeof import("../rewards/config.js")>();
  return { ...real, dbClock: vi.fn(real.dbClock) };
});

const MIN = 60_000;
const HOUR = 60 * MIN;
const CHAT = -1001234567890n;
// Each test gets its own database, so no other test's card is ever due.
let t: Awaited<ReturnType<typeof createTestDb>> | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

async function liveCard(opens = new Date("2032-01-01T00:00:00.000Z")) {
  await t?.close();
  t = await createTestDb();
  const db = t.db;
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

// The database clock reads clockAt while a test moves it to stand for slow reads or requests.
let clockAt = new Date();
async function withSlowClock(run: () => Promise<void>) {
  const { dbClock: real } =
    await vi.importActual<typeof import("../rewards/config.js")>("../rewards/config.js");
  vi.mocked(dbClock).mockImplementation(async () => clockAt);
  try {
    await run();
  } finally {
    vi.mocked(dbClock).mockImplementation(real);
  }
}

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

  it("unpins a card whose pin was sent but never recorded (a crash before markPinned)", async () => {
    const { db, task } = await liveCard();
    await db.update(raidCards).set({ pinnedAt: null }).where(eq(raidCards.taskId, task.id));
    const e = editor();
    const after = new Date(task.closesAt.getTime() + 1000);
    expect(await refreshDueCard(db, e.api, after)).toBe("final");
    expect(e.calls.map((c) => c.method)).toEqual(["editCaption", "unpin"]);
    expect(await cardOf(db, task.id)).toMatchObject({ unpinnedAt: after, pinError: null });
  });

  it("never tries to unpin a card whose pin Telegram refused", async () => {
    const { db, task } = await liveCard();
    await db
      .update(raidCards)
      .set({ pinnedAt: null, pinError: "pin_403" })
      .where(eq(raidCards.taskId, task.id));
    const e = editor();
    const after = new Date(task.closesAt.getTime() + 1000);
    expect(await refreshDueCard(db, e.api, after)).toBe("final");
    expect(e.calls.map((c) => c.method)).toEqual(["editCaption"]);
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

  it("lets no other claim draw the card while the results request lands, then adds the button", async () => {
    const { db, task } = await liveCard();
    const after = new Date(task.closesAt.getTime() + 1000);
    const second = editor();
    let during: CardOutcome | undefined | null = null;
    const first: CardEditor = {
      ...editor().api,
      editCaption: async () => {
        await markResults(db, task.id, 99, after);
        during = await refreshDueCard(db, second.api, new Date(after.getTime() + 1000));
      },
    };
    expect(await refreshDueCard(db, first, after)).toBe("final");
    expect(during).toBeUndefined();
    expect(second.calls).toEqual([]);
    expect(await refreshDueCard(db, second.api, new Date(after.getTime() + 2000))).toBe("final");
    expect(second.calls.map((c) => c.keyboard)).toEqual([
      [[{ text: "📊 Results", url: "https://t.me/c/1234567890/99" }]],
    ]);
  });

  it("writes nothing and sends no unpin once another claim has replaced its lease", async () => {
    for (const [fail, outcome] of [
      [undefined, "lost"],
      [() => failure(429, "Too Many Requests", { retry_after: 30 }), "rate_limited"],
      [() => failure(403, "Forbidden: bot was kicked"), "gone"],
      [() => new Error("socket hang up"), "lost"],
    ] as const) {
      const { db, task } = await liveCard();
      const after = new Date(task.closesAt.getTime() + 1000);
      const replaced = new Date(after.getTime() + 5000);
      const before = await cardOf(db, task.id);
      const e = editor();
      const stale: CardEditor = {
        ...e.api,
        editCaption: async () => {
          // Another process claimed the card while this edit was in flight.
          await db
            .update(raidCards)
            .set({ holdUntil: replaced })
            .where(eq(raidCards.taskId, task.id));
          if (fail) throw fail();
        },
      };
      expect(await refreshDueCard(db, stale, after)).toBe(outcome);
      expect(await cardOf(db, task.id)).toEqual({ ...before, holdUntil: replaced });
      expect(e.calls).toEqual([]);
    }
  });

  it("sends nothing once its lease ran out and another claim drew the card with Results", async () => {
    const { db, task } = await liveCard();
    const after = new Date(task.closesAt.getTime() + 1000);
    const stale = editor();
    const other = editor();
    let drawn: Awaited<ReturnType<typeof cardOf>>;
    const slow: CardEditor = {
      ...stale.api,
      // This claim's reads outlast its 30-second lease. Meanwhile the results message lands and
      // another process claims the card, draws its Results button and settles it final.
      botUsername: async () => {
        await markResults(db, task.id, 99, after);
        expect(await refreshDueCard(db, other.api, new Date(after.getTime() + 31_000))).toBe(
          "final",
        );
        drawn = await cardOf(db, task.id);
        return "hyphae_bot";
      },
    };
    expect(await refreshDueCard(db, slow, after)).toBe("lost");
    expect(stale.calls).toEqual([]);
    expect(other.calls.map((c) => c.method)).toEqual(["editCaption", "unpin"]);
    expect(other.calls[0]?.keyboard).toEqual([
      [{ text: "📊 Results", url: "https://t.me/c/1234567890/99" }],
    ]);
    expect(await cardOf(db, task.id)).toEqual(drawn);
    expect(drawn).toMatchObject({ state: "ended", nextRefreshAt: null, resultsMessageId: 99 });
  });

  it("renews its lease from the database clock right before the edit", async () => {
    const { db, task } = await liveCard(new Date(Date.now() - HOUR));
    let claimed: Date | null | undefined;
    let renewed: Date | null | undefined;
    const e = editor();
    const api: CardEditor = {
      ...e.api,
      botUsername: async () => {
        claimed = (await cardOf(db, task.id))?.holdUntil;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return "hyphae_bot";
      },
      editCaption: async () => {
        renewed = (await cardOf(db, task.id))?.holdUntil;
      },
    };
    expect(await refreshDueCard(db, api)).toBe("edited");
    expect(claimed).toBeInstanceOf(Date);
    expect(renewed?.getTime()).toBeGreaterThan(claimed?.getTime() ?? Number.POSITIVE_INFINITY);
  });

  it("starts an unpin back-off when Telegram answers, however slow the reads and the request", async () => {
    await withSlowClock(async () => {
      // A final card: its reads take 25 s, then its unpin answers 15 s late.
      for (const fail of [
        () => failure(429, "Too Many Requests", { retry_after: 60 }),
        () => new Error("socket hang up"),
      ]) {
        const { db, task } = await liveCard(new Date(Date.now() - 49 * HOUR));
        const claimed = new Date();
        clockAt = claimed;
        const e = editor();
        const slow: CardEditor = {
          ...e.api,
          botUsername: async () => {
            clockAt = new Date(claimed.getTime() + 25_000);
            return "hyphae_bot";
          },
          unpin: async () => {
            e.calls.push({ method: "unpin" });
            if (e.calls.length > 2) return;
            clockAt = new Date(clockAt.getTime() + 15_000);
            throw fail();
          },
        };
        expect(await refreshDueCard(db, slow)).toBe("final");
        const until = new Date(claimed.getTime() + 40_000 + MIN);
        expect(await cardOf(db, task.id)).toMatchObject({ unpinnedAt: null, holdUntil: until });
        expect(await refreshDueCard(db, slow, new Date(until.getTime() - 1000))).toBeUndefined();
        expect(await refreshDueCard(db, slow, until)).toBe("final");
        expect(e.calls.map((c) => c.method)).toEqual(["editCaption", "unpin", "unpin"]);
      }
    });
  });

  it("starts an edit back-off when Telegram answers, however slow the request", async () => {
    await withSlowClock(async () => {
      // An open card: its edit answers 15 s late.
      for (const [fail, outcome] of [
        [() => failure(429, "Too Many Requests", { retry_after: 60 }), "rate_limited"],
        [() => new Error("socket hang up"), "failed"],
      ] as const) {
        const { db, task } = await liveCard(new Date(Date.now() - HOUR));
        const claimed = new Date();
        clockAt = claimed;
        const slow = editor(() => {
          clockAt = new Date(claimed.getTime() + 15_000);
          return fail();
        });
        expect(await refreshDueCard(db, slow.api)).toBe(outcome);
        const until = new Date(claimed.getTime() + 15_000 + MIN);
        expect((await cardOf(db, task.id))?.holdUntil).toEqual(until);
        expect(
          await refreshDueCard(db, editor().api, new Date(until.getTime() - 1000)),
        ).toBeUndefined();
      }
    });
  });

  it("keeps the unpin back-off when a results request lands during the final edit", async () => {
    const { db, task } = await liveCard();
    const after = new Date(task.closesAt.getTime() + 1000);
    const calls: { method: string; keyboard?: unknown }[] = [];
    const api: CardEditor = {
      ...editor().api,
      editCaption: async (_c, _m, _caption, keyboard) => {
        calls.push({ method: "editCaption", keyboard: keyboard.inline_keyboard });
        if (calls.length === 1) await markResults(db, task.id, 99, after);
      },
      unpin: async () => {
        calls.push({ method: "unpin" });
        if (calls.length === 2) throw failure(429, "Too Many Requests", { retry_after: 60 });
      },
    };
    expect(await refreshDueCard(db, api, after)).toBe("final");
    expect(await cardOf(db, task.id)).toMatchObject({
      unpinnedAt: null,
      holdUntil: new Date(after.getTime() + MIN),
    });
    expect(await refreshDueCard(db, api, new Date(after.getTime() + 1000))).toBeUndefined();
    const retry = new Date(after.getTime() + MIN);
    expect(await refreshDueCard(db, api, retry)).toBe("final");
    expect(calls).toEqual([
      { method: "editCaption", keyboard: [] },
      { method: "unpin" },
      {
        method: "editCaption",
        keyboard: [[{ text: "📊 Results", url: "https://t.me/c/1234567890/99" }]],
      },
      { method: "unpin" },
    ]);
    expect(await cardOf(db, task.id)).toMatchObject({
      unpinnedAt: retry,
      nextRefreshAt: null,
      holdUntil: null,
    });
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

  it("shows a cancellation that lands after the card went final, then stops", async () => {
    const { db, community, task } = await liveCard();
    const after = new Date(task.closesAt.getTime() + 1000);
    const e = editor();
    expect(await refreshDueCard(db, e.api, after)).toBe("final");
    expect(await cardOf(db, task.id)).toMatchObject({ state: "ended", nextRefreshAt: null });
    // /cancel_raid accepts a raid whose window is over but that nobody closed.
    const when = new Date(after.getTime() + 5 * MIN);
    const cancelled = await transitionRaid(
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
    expect(cancelled.status).toBe("changed");
    expect(await refreshDueCard(db, e.api, new Date(when.getTime() + 1000))).toBe("final");
    expect(e.calls.map((c) => c.method)).toEqual(["editCaption", "unpin", "editCaption"]);
    expect(e.calls.at(-1)?.caption).toBe("Raid cancelled: this post\nWrong post");
    expect(await cardOf(db, task.id)).toMatchObject({
      state: "cancelled",
      nextRefreshAt: null,
      holdUntil: null,
    });
    expect(await refreshDueCard(db, e.api, new Date(when.getTime() + HOUR))).toBeUndefined();
  });

  it("shows a cancellation that lands while the final edit is in flight", async () => {
    const { db, community, task } = await liveCard();
    const after = new Date(task.closesAt.getTime() + 1000);
    const captions: string[] = [];
    const racing: CardEditor = {
      ...editor().api,
      editCaption: async (_c, _m, caption) => {
        captions.push(caption);
        if (captions.length === 1)
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
            at(after),
          );
      },
    };
    expect(await refreshDueCard(db, racing, after)).toBe("final");
    expect((await cardOf(db, task.id))?.state).toBe("ended");
    expect(await refreshDueCard(db, racing, new Date(after.getTime() + 1000))).toBe("final");
    expect(captions.at(-1)).toBe("Raid cancelled: this post\nWrong post");
    expect((await cardOf(db, task.id))?.state).toBe("cancelled");
    expect(await refreshDueCard(db, racing, new Date(after.getTime() + HOUR))).toBeUndefined();
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

  it("unpins a finished card even when its last edit keeps failing, and retries the edit later", async () => {
    const { db, task } = await liveCard();
    const after = new Date(task.closesAt.getTime() + 1000);
    const stuck = editor(() => failure(400, "Bad Request: message can't be edited"));
    expect(await refreshDueCard(db, stuck.api, after)).toBe("failed");
    expect(stuck.calls.map((c) => c.method)).toEqual(["editCaption", "unpin"]);
    expect(await cardOf(db, task.id)).toMatchObject({
      state: "open",
      unpinnedAt: after,
      holdUntil: new Date(after.getTime() + MIN),
    });
    expect(await refreshDueCard(db, stuck.api, new Date(after.getTime() + 30_000))).toBeUndefined();
    const fixed = editor();
    expect(await refreshDueCard(db, fixed.api, new Date(after.getTime() + 61_000))).toBe("final");
    expect(fixed.calls.map((c) => c.method)).toEqual(["editCaption"]);
    expect(await cardOf(db, task.id)).toMatchObject({ state: "ended", nextRefreshAt: null });
  });

  it("records an unpin only once Telegram confirms it, and retries it without another edit", async () => {
    for (const [error, wait] of [
      [failure(429, "Too Many Requests", { retry_after: 30 }), 30_000],
      [failure(429, "Too Many Requests"), MIN],
      [new Error("The operation was aborted due to timeout"), MIN],
    ] as const) {
      const { db, task } = await liveCard();
      const after = new Date(task.closesAt.getTime() + 1000);
      const e = editor();
      const unconfirmed: CardEditor = {
        ...e.api,
        unpin: async () => {
          e.calls.push({ method: "unpin" });
          throw error;
        },
      };
      expect(await refreshDueCard(db, unconfirmed, after)).toBe("final");
      const drawn = await cardOf(db, task.id);
      expect(drawn).toMatchObject({
        state: "ended",
        unpinnedAt: null,
        pinError: null,
        holdUntil: new Date(after.getTime() + wait),
        nextRefreshAt: after,
      });
      expect(drawn?.renderedHash).not.toBe("first");
      expect(
        await refreshDueCard(db, e.api, new Date(after.getTime() + wait - 1000)),
      ).toBeUndefined();
      const retry = new Date(after.getTime() + wait);
      expect(await refreshDueCard(db, e.api, retry)).toBe("final");
      expect(e.calls.map((c) => c.method)).toEqual(["editCaption", "unpin", "unpin"]);
      expect(await cardOf(db, task.id)).toMatchObject({ unpinnedAt: retry, nextRefreshAt: null });
    }
  });

  it("records an unpin Telegram refuses and never tries it again", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const { db, task } = await liveCard();
      const after = new Date(task.closesAt.getTime() + 1000);
      const e = editor();
      const refused: CardEditor = {
        ...e.api,
        unpin: async () => {
          e.calls.push({ method: "unpin" });
          throw failure(400, "Bad Request: message to unpin not found");
        },
      };
      expect(await refreshDueCard(db, refused, after)).toBe("final");
      expect(await cardOf(db, task.id)).toMatchObject({
        state: "ended",
        unpinnedAt: null,
        pinError: "unpin_400",
        nextRefreshAt: null,
      });
      expect(warn).toHaveBeenCalledWith(
        JSON.stringify({
          card: "unpin_failed",
          description: "Bad Request: message to unpin not found",
        }),
      );
      await markResults(db, task.id, 99, new Date(after.getTime() + MIN));
      expect(await refreshDueCard(db, refused, new Date(after.getTime() + MIN))).toBe("final");
      expect(e.calls.map((c) => c.method)).toEqual(["editCaption", "unpin", "editCaption"]);
    } finally {
      warn.mockRestore();
    }
  });

  it("handles the unpin the same way when the final edit fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      for (const [error, recorded, hold] of [
        [failure(429, "Too Many Requests", { retry_after: 90 }), null, 90_000],
        [failure(403, "Forbidden: not enough rights to unpin a message"), "unpin_403", MIN],
      ] as const) {
        const { db, task } = await liveCard();
        const after = new Date(task.closesAt.getTime() + 1000);
        const stuck = editor(() => failure(400, "Bad Request: message can't be edited"));
        const failing: CardEditor = {
          ...stuck.api,
          unpin: async () => {
            stuck.calls.push({ method: "unpin" });
            throw error;
          },
        };
        expect(await refreshDueCard(db, failing, after)).toBe("failed");
        expect(await cardOf(db, task.id)).toMatchObject({
          state: "open",
          unpinnedAt: null,
          pinError: recorded,
          holdUntil: new Date(after.getTime() + hold),
        });
        expect(
          await refreshDueCard(db, editor().api, new Date(after.getTime() + hold - 1000)),
        ).toBeUndefined();
        const fixed = editor();
        expect(await refreshDueCard(db, fixed.api, new Date(after.getTime() + hold))).toBe("final");
        expect(fixed.calls.map((c) => c.method)).toEqual(
          recorded ? ["editCaption"] : ["editCaption", "unpin"],
        );
      }
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps an open card pinned when an edit fails", async () => {
    const { db, task, opens } = await liveCard();
    const e = editor(() => new Error("socket hang up"));
    expect(await refreshDueCard(db, e.api, new Date(opens.getTime() + MIN + 1000))).toBe("failed");
    expect(e.calls.map((c) => c.method)).toEqual(["editCaption"]);
    expect((await cardOf(db, task.id))?.unpinnedAt).toBeNull();
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

  it("holds a card whose community rubric cannot be read, and still draws the others", async () => {
    const { db, community, opens } = await liveCard();
    await db
      .update(communities)
      .set({ rubric: { broken: true } })
      .where(eq(communities.id, community.id));
    const { community: other } = await seedCommunity(db);
    const otherTask = await seedTask(db, other.id, opens);
    await recordCard(db, {
      taskId: otherTask.id,
      communityId: other.id,
      telegramChatId: -1009876543210n,
      telegramMessageId: 60,
      format: "photo",
      state: "open",
      renderedHash: "first",
      nextRefreshAt: new Date(opens.getTime() + 2 * MIN),
      pinnedAt: opens,
    });
    const now = new Date(opens.getTime() + 3 * MIN);
    await expect(refreshDueCard(db, editor().api, now)).rejects.toThrow();
    const e = editor();
    expect(await refreshDueCard(db, e.api, new Date(now.getTime() + 1000))).toBe("edited");
    expect(e.calls).toHaveLength(1);
    expect(await refreshDueCard(db, e.api, new Date(now.getTime() + 2000))).toBeUndefined();
    await expect(refreshDueCard(db, e.api, new Date(now.getTime() + 31_000))).rejects.toThrow();
  });
});

describe("raid card Telegram calls", () => {
  it("gives up on each call after 20 seconds, inside the claim's 30-second hold", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const calls: unknown[][] = [];
    const record = async (...args: unknown[]) => {
      calls.push(args);
      return true;
    };
    const cards = telegramCardEditor({
      editMessageCaption: record,
      editMessageText: record,
      unpinChatMessage: record,
    } as unknown as Api);
    try {
      await cards.editCaption(CHAT, 50, "caption", new InlineKeyboard());
      await cards.editText(CHAT, 50, "text", new InlineKeyboard());
      await cards.unpin(CHAT, 50);
      // The signal is each grammY method's last parameter.
      expect(calls.map((c) => c.length)).toEqual([4, 5, 4]);
      for (const c of calls) expect(c.at(-1)).toBeInstanceOf(AbortSignal);
      expect(timeout.mock.calls).toEqual([[20_000], [20_000], [20_000]]);
    } finally {
      timeout.mockRestore();
    }
  });
});
