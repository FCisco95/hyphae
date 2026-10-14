import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { communities, createDb, raidCards, tasks } from "@hyphae/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rubric } from "../rewards/test-db.js";
import { type CardEditor, refreshDueCard } from "./refresh.js";
import { cardOf, markResults, recordCard } from "./store.js";

const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("Use the disposable test:pg runner");
const a = createDb(url);
const b = createDb(url);
const MIN = 60_000;
beforeAll(async () => {
  await migrate(a, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await Promise.all([a.$client.end(), b.$client.end()]);
});

async function dueCard() {
  await a.delete(raidCards);
  const opens = new Date("2041-01-01T00:00:00.000Z");
  const [community] = await a
    .insert(communities)
    .values({
      mint: `Card${randomUUID()}`,
      name: "Card test",
      telegramChatId: -BigInt(Date.now()),
      adminTelegramUserId: 7n,
      rubricVersion: rubric.version,
      rubric,
    })
    .returning();
  if (!community) throw new Error("community");
  const [task] = await a
    .insert(tasks)
    .values({
      communityId: community.id,
      kind: "raid",
      status: "open",
      targetUrl: "https://x.com/owner/status/1",
      targetAuthor: "owner",
      opensAt: opens,
      closesAt: new Date(opens.getTime() + 2 * 3_600_000),
    })
    .returning();
  if (!task) throw new Error("task");
  await recordCard(a, {
    taskId: task.id,
    communityId: community.id,
    telegramChatId: -1001234567890n,
    telegramMessageId: 50,
    format: "photo",
    state: "open",
    renderedHash: "first",
    nextRefreshAt: new Date(opens.getTime() + MIN),
    pinnedAt: opens,
  });
  return { task, opens };
}

function editor(onCaption?: (drawn: number) => Promise<void>) {
  const keyboards: unknown[] = [];
  const api: CardEditor = {
    editCaption: async (_c, _m, _caption, keyboard) => {
      keyboards.push(keyboard.inline_keyboard);
      await onCaption?.(keyboards.length);
    },
    editText: async () => undefined,
    unpin: async () => undefined,
    botUsername: async () => "hyphae_bot",
  };
  return { api, keyboards };
}

describe("raid card refresh on real Postgres", () => {
  it("lets one of two processes draw a due card", async () => {
    const { opens } = await dueCard();
    const now = new Date(opens.getTime() + MIN + 1000);
    const one = editor();
    const two = editor();
    const outcomes = await Promise.all([
      refreshDueCard(a, one.api, now),
      refreshDueCard(b, two.api, now),
    ]);
    expect(outcomes.filter((o) => o === "edited")).toHaveLength(1);
    expect(outcomes.filter((o) => o === undefined)).toHaveLength(1);
    expect(one.keyboards.length + two.keyboards.length).toBe(1);
  });

  it("keeps a results request that lands while the final edit is in flight", async () => {
    const { task } = await dueCard();
    const after = new Date(task.closesAt.getTime() + 1000);
    const racing = editor(async (drawn) => {
      if (drawn === 1) await markResults(b, task.id, 99, after);
    });
    expect(await refreshDueCard(a, racing.api, after)).toBe("final");
    expect((await cardOf(a, task.id))?.nextRefreshAt).not.toBeNull();
    expect(await refreshDueCard(a, racing.api, new Date(after.getTime() + 1000))).toBe("final");
    expect(racing.keyboards.at(-1)).toEqual([
      [{ text: "📊 Results", url: "https://t.me/c/1234567890/99" }],
    ]);
    expect(await cardOf(a, task.id)).toMatchObject({ nextRefreshAt: null, holdUntil: null });
  });
});
