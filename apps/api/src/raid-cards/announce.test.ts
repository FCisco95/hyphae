import { randomUUID } from "node:crypto";
import { GrammyError, type InputFile } from "grammy";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, seedCommunity, seedTask } from "../rewards/test-db.js";
import { announceCard, type CardSender } from "./announce.js";
import { cardOf } from "./store.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const rejected = (code: number, description: string) =>
  new GrammyError(description, { ok: false, error_code: code, description }, "sendPhoto", {});

function sender(over: Partial<CardSender> = {}) {
  const calls: { method: string; caption?: string; keyboard?: unknown; photo?: InputFile }[] = [];
  const deps: CardSender = {
    image: async () => new Uint8Array([137, 80, 78, 71]),
    sendPhoto: async (_chat, photo, caption, keyboard) => {
      calls.push({ method: "sendPhoto", caption, keyboard: keyboard.inline_keyboard, photo });
      return { message_id: 31 };
    },
    sendText: async (_chat, text, keyboard) => {
      calls.push({ method: "sendText", caption: text, keyboard: keyboard.inline_keyboard });
      return { message_id: 32 };
    },
    pin: async () => {
      calls.push({ method: "pin" });
      return true;
    },
    ...over,
  };
  return { deps, calls };
}

async function raid() {
  const { community } = await seedCommunity(t.db);
  const task = await seedTask(t.db, community.id, new Date("2031-02-01T00:00:00.000Z"));
  return {
    community,
    task,
    input: { community, task, botUsername: "hyphae_bot", now: task.opensAt },
  };
}

describe("announceCard", () => {
  it("sends the picture with the live caption, pins it quietly and records it due in a minute", async () => {
    const { task, input } = await raid();
    const { deps, calls } = sender();
    expect(await announceCard(t.db, input, deps)).toEqual({ messageId: 31, format: "photo" });
    expect(calls.map((c) => c.method)).toEqual(["sendPhoto", "pin"]);
    expect(calls[0]?.caption).toContain("🔴 <b>Raid live</b>");
    expect(calls[0]?.caption).toContain("Full credit for the first 6h, then it decays.");
    expect(await cardOf(t.db, task.id)).toMatchObject({
      telegramMessageId: 31,
      format: "photo",
      state: "open",
      nextRefreshAt: new Date(task.opensAt.getTime() + 60_000),
      pinnedAt: task.opensAt,
      pinError: null,
    });
  });

  it("sends the same card as text without a picture, or when the picture cannot be fetched", async () => {
    for (const image of [async () => null, async () => Promise.reject(new Error("timeout"))]) {
      const { task, input } = await raid();
      const { deps, calls } = sender({ image });
      expect(await announceCard(t.db, input, deps)).toEqual({ messageId: 32, format: "text" });
      expect(calls.map((c) => c.method)).toEqual(["sendText", "pin"]);
      expect((await cardOf(t.db, task.id))?.format).toBe("text");
    }
  });

  it("falls back to text when Telegram rejects the picture", async () => {
    const { input } = await raid();
    const { deps, calls } = sender({
      sendPhoto: async () => Promise.reject(rejected(400, "Bad Request: IMAGE_PROCESS_FAILED")),
    });
    expect((await announceCard(t.db, input, deps)).format).toBe("text");
    expect(calls.map((c) => c.method)).toEqual(["sendText", "pin"]);
  });

  it("never sends a second card after a network error, and records nothing", async () => {
    const { task, input } = await raid();
    const { deps, calls } = sender({
      sendPhoto: async () => Promise.reject(new Error("socket hang up")),
    });
    await expect(announceCard(t.db, input, deps)).rejects.toThrow("socket hang up");
    expect(calls).toEqual([]);
    expect(await cardOf(t.db, task.id)).toBeUndefined();
  });

  it("keeps the card when it cannot be pinned, and says why", async () => {
    const { task, input } = await raid();
    const { deps } = sender({
      pin: async () =>
        Promise.reject(rejected(400, "Bad Request: not enough rights to pin a message")),
    });
    await announceCard(t.db, input, deps);
    expect(await cardOf(t.db, task.id)).toMatchObject({ pinnedAt: null, pinError: "pin_400" });
  });

  it("records the card before pinning it, so a pinned card always has a row", async () => {
    const { task, input } = await raid();
    let atPin: Awaited<ReturnType<typeof cardOf>>;
    const { deps } = sender({
      pin: async () => {
        atPin = await cardOf(t.db, task.id);
        return true;
      },
    });
    await announceCard(t.db, input, deps);
    expect(atPin).toMatchObject({ telegramMessageId: 31, pinnedAt: null, pinError: null });
    expect(await cardOf(t.db, task.id)).toMatchObject({ pinnedAt: task.opensAt, pinError: null });
  });

  it("does not pin a card it could not record", async () => {
    const { task, input } = await raid();
    const { deps, calls } = sender();
    await expect(
      announceCard(t.db, { ...input, task: { ...task, id: randomUUID() } }, deps),
    ).rejects.toThrow();
    expect(calls.map((c) => c.method)).toEqual(["sendPhoto"]);
  });

  it("logs why Telegram rejected the picture before sending the text card", async () => {
    const { input } = await raid();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { deps } = sender({
      sendPhoto: async () => Promise.reject(rejected(400, "Bad Request: IMAGE_PROCESS_FAILED")),
    });
    await announceCard(t.db, input, deps);
    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({
        announce: "photo_rejected",
        description: "Bad Request: IMAGE_PROCESS_FAILED",
      }),
    );
    warn.mockRestore();
  });
});
