import { CUSTODY_POLICY } from "@hyphae/core";
import { members, rulesTestPasses } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { Bot } from "grammy";
import type { InlineKeyboardMarkup, Update, UserFromGetMe } from "grammy/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rulesTestById } from "../../payout/rules-test.js";
import { buildRewardConfigPayload } from "../../rewards/config.js";
import { createTestDb, rubric, seedCommunity, seedRewardLane } from "../../rewards/test-db.js";
import {
  parseRulesData,
  parseRulesStartPayload,
  rulesData,
  rulesStart,
  rulesStartPayload,
  rulesTest,
} from "./rules.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const botInfo = { id: 1, is_bot: true, first_name: "T", username: "t_bot" } as UserFromGetMe;
const MEMBER = 42;
const STRANGER = 99;

interface Out {
  method: string;
  text: string;
  keyboard: InlineKeyboardMarkup["inline_keyboard"] | undefined;
}

function harness() {
  const out: Out[] = [];
  const bot = new Bot("1:t", { botInfo });
  bot.api.config.use(async (_prev, method, payload) => {
    const p = payload as { text?: string; reply_markup?: InlineKeyboardMarkup };
    out.push({ method, text: p.text ?? "", keyboard: p.reply_markup?.inline_keyboard });
    const message = { message_id: 10, date: 0, chat: { id: MEMBER, type: "private" }, text: "" };
    return { ok: true, result: method === "sendMessage" ? message : true } as never;
  });
  bot.command("start", async (ctx) => {
    if (ctx.chat.type === "private" && (await rulesStart(t.db, ctx))) return;
    await ctx.reply("start");
  });
  bot.use(rulesTest(t.db));
  return { bot, out };
}

let updateId = 0;
const command = (text: string, chat: { id: number; type: "private" | "group" }, from = MEMBER) =>
  ({
    update_id: ++updateId,
    message: {
      message_id: 5,
      date: 0,
      chat: chat.type === "private" ? { ...chat, first_name: "M" } : { ...chat, title: "Lab" },
      from: { id: from, is_bot: false, first_name: "M" },
      text,
      entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0]?.length ?? 0 }],
    },
  }) as Update;
const tap = (data: string, from = MEMBER, chatType: "private" | "group" = "private") =>
  ({
    update_id: ++updateId,
    callback_query: {
      id: `cb${updateId}`,
      from: { id: from, is_bot: false, first_name: "M" },
      chat_instance: "ci",
      data,
      message: {
        message_id: 10,
        date: 0,
        chat:
          chatType === "private"
            ? { id: from, type: "private", first_name: "M" }
            : { id: -5, type: "group", title: "Lab" },
        text: "question",
      },
    },
  }) as Update;

const mycel = () => {
  const test = rulesTestById("mycel-rules-1");
  if (!test) throw new Error("mycel-rules-1 is not registered");
  return test;
};
const buttons = (o: Out | undefined) =>
  (o?.keyboard ?? []).flat().map((b) => ("callback_data" in b ? b.callback_data : ""));
const last = (out: Out[]) => out.at(-1);
const passesOf = (memberId: string) =>
  t.db.select().from(rulesTestPasses).where(eq(rulesTestPasses.memberId, memberId));

// Answers every question from the keyboard the bot sent, choosing `pick(questionIndex)`.
async function answerAll(
  h: ReturnType<typeof harness>,
  communityId: string,
  pick: (i: number) => number,
) {
  await h.bot.handleUpdate(command(`/start ${rulesStartPayload(communityId)}`, privateChat));
  for (let i = 0; i < mycel().questions.length; i++) {
    const data = buttons(last(h.out))[pick(i)];
    if (!data) throw new Error(`no button ${pick(i)} for question ${i + 1}`);
    await h.bot.handleUpdate(tap(data));
  }
  return h.out.filter((o) => o.method === "editMessageText").at(-1);
}

const privateChat = { id: MEMBER, type: "private" as const };

describe("rules test payloads", () => {
  const id = "3f1c2a9e-0b4d-4c8e-9f11-2a3b4c5d6e7f";

  it("round-trip within Telegram's 64-byte limits", () => {
    expect(parseRulesStartPayload(rulesStartPayload(id))).toBe(id);
    expect(rulesStartPayload(id).length).toBeLessThanOrEqual(64);
    const data = rulesData("mycel-rules-1", id, [1, 2, 0, 1, 2, 0]);
    expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
    expect(parseRulesData(data)).toEqual({
      testId: "mycel-rules-1",
      communityId: id,
      answers: [1, 2, 0, 1, 2, 0],
    });
    expect(parseRulesData(rulesData("mycel-rules-1", id, []))?.answers).toEqual([]);
  });

  it("reject anything else", () => {
    for (const bad of ["", "rules_", "rules_nope", `link_${id}`, `rules_${id}x`]) {
      expect(parseRulesStartPayload(bad)).toBeUndefined();
    }
    for (const bad of [
      "",
      `rt:mycel-rules-1:${id}`,
      `rt:mycel-rules-1:not-a-uuid:1`,
      `rt:mycel-rules-1:${id}:1a`,
      `rt:MYCEL:${id}:1`,
      `xx:mycel-rules-1:${id}:1`,
    ]) {
      expect(parseRulesData(bad)).toBeUndefined();
    }
  });
});

describe("/rules", () => {
  it("in the group links a private chat, and points a private /rules to the group", async () => {
    const { community } = await seedRewardLane(t.db);
    const h = harness();
    await h.bot.handleUpdate(
      command("/rules", { id: Number(community.telegramChatId), type: "group" }),
    );
    expect(last(h.out)?.text).toBe(
      `Take the rules test privately: https://t.me/t_bot?start=rules_${community.id}

${CUSTODY_POLICY}`,
    );
    await h.bot.handleUpdate(command("/rules", privateChat));
    expect(last(h.out)?.text).toBe("Send /rules in your community chat.");
    await h.bot.handleUpdate(command("/rules", { id: -123456789, type: "group" }));
    expect(last(h.out)?.text).toBe("This chat is not a registered Hyphae community.");
  });
});

describe("the private test", () => {
  it("needs a linked member and a test for the current rules", async () => {
    const lane = await seedRewardLane(t.db);
    const h = harness();
    await h.bot.handleUpdate(
      command(`/start ${rulesStartPayload(lane.community.id)}`, privateChat, STRANGER),
    );
    expect(last(h.out)?.text).toBe(`Link a wallet first: send /link in ${lane.community.name}.`);

    const bare = await seedCommunity(t.db); // no reward epoch, so no pinned rules
    await h.bot.handleUpdate(
      command(`/start ${rulesStartPayload(bare.community.id)}`, privateChat),
    );
    expect(last(h.out)?.text).toBe(
      `There is no rules test for ${bare.community.name}'s current rules yet.`,
    );
  });

  it("asks one question per message, with one button per option", async () => {
    const lane = await seedRewardLane(t.db);
    const h = harness();
    await h.bot.handleUpdate(
      command(`/start ${rulesStartPayload(lane.community.id)}`, privateChat),
    );
    const first = last(h.out);
    expect(first?.method).toBe("sendMessage");
    expect(first?.text).toContain("Question 1 of 6");
    expect(first?.text).toContain(mycel().questions[0]?.text);
    expect(buttons(first).map((d) => parseRulesData(d))).toEqual([
      { testId: "mycel-rules-1", communityId: lane.community.id, answers: [0] },
      { testId: "mycel-rules-1", communityId: lane.community.id, answers: [1] },
      { testId: "mycel-rules-1", communityId: lane.community.id, answers: [2] },
    ]);
    expect(h.out.filter((o) => o.method === "answerCallbackQuery")).toEqual([]);
  });

  it("records one pass on six right answers, and shows every answer with its why", async () => {
    const lane = await seedRewardLane(t.db);
    const h = harness();
    const result = await answerAll(h, lane.community.id, (i) => mycel().questions[i]?.answer ?? 0);
    expect(result?.text).toMatch(
      /^Passed: 6\/6\. Your pass counts for epochs under the MYCEL 1\.2\.0 rules\./,
    );
    for (const q of mycel().questions) expect(result?.text).toContain(q.why);
    expect(await passesOf(lane.member.id)).toHaveLength(1);
    expect(h.out.filter((o) => o.method === "answerCallbackQuery")).toHaveLength(6);
    expect(buttons(result).map((d) => parseRulesData(d)?.answers)).toEqual([[]]);
  });

  it("records nothing on five of six, and shows the right answers", async () => {
    const lane = await seedRewardLane(t.db);
    const h = harness();
    const result = await answerAll(h, lane.community.id, (i) => {
      const q = mycel().questions[i];
      return i === 4 ? ((q?.answer ?? 0) + 1) % 3 : (q?.answer ?? 0);
    });
    expect(result?.text).toMatch(/^5\/6\. You need 6\/6 to pass\./);
    for (const q of mycel().questions) {
      expect(result?.text).toContain(q.options[q.answer]);
    }
    expect(await passesOf(lane.member.id)).toEqual([]);
  });
});

describe("button data is not trusted", () => {
  const allRight = () => mycel().questions.map((q) => q.answer);

  it("a non-member's all-correct data records nothing", async () => {
    const lane = await seedRewardLane(t.db);
    const h = harness();
    await h.bot.handleUpdate(
      tap(rulesData("mycel-rules-1", lane.community.id, allRight()), STRANGER),
    );
    expect(last(h.out)?.text).toBe(`Link a wallet first: send /link in ${lane.community.name}.`);
    const [row] = await t.db
      .select()
      .from(members)
      .where(eq(members.telegramUserId, BigInt(STRANGER)));
    expect(row).toBeUndefined();
  });

  it("a member of one community cannot pass for another", async () => {
    const other = await seedRewardLane(t.db);
    await t.db.update(members).set({ telegramUserId: 777n }).where(eq(members.id, other.member.id));
    const h = harness();
    await h.bot.handleUpdate(tap(rulesData("mycel-rules-1", other.community.id, allRight())));
    expect(await passesOf(other.member.id)).toEqual([]);
    expect(last(h.out)?.text).toBe(`Link a wallet first: send /link in ${other.community.name}.`);
  });

  it("stale or malformed data records nothing", async () => {
    const lane = await seedRewardLane(t.db);
    const h = harness();
    const stale = "That test message is out of date. Send /rules in your community chat.";
    for (const data of [
      rulesData("mycel-rules-1", lane.community.id, [7]),
      rulesData("mycel-rules-1", lane.community.id, [...allRight(), 0]),
      rulesData("gone-rules-1", lane.community.id, allRight()),
      rulesData("mycel-rules-1", "00000000-0000-4000-8000-000000000000", allRight()),
      "rt:junk",
    ]) {
      await h.bot.handleUpdate(tap(data));
      expect(last(h.out)?.text).toBe(stale);
    }
    expect(await passesOf(lane.member.id)).toEqual([]);
    expect(h.out.filter((o) => o.method === "answerCallbackQuery")).toHaveLength(5);
  });

  it("a test that is not the community's current one records nothing", async () => {
    const lane = await seedRewardLane(
      t.db,
      buildRewardConfigPayload({ ...rubric, community: "DEMO" }),
    );
    const h = harness();
    const stale = "That test message is out of date. Send /rules in your community chat.";
    await h.bot.handleUpdate(tap(rulesData("mycel-rules-1", lane.community.id, allRight())));
    expect(last(h.out)?.text).toBe(stale);
    await h.bot.handleUpdate(tap(rulesData("mycel-rules-1", lane.community.id, [0])));
    expect(last(h.out)?.text).toBe(stale);
    expect(await passesOf(lane.member.id)).toEqual([]);
  });

  it("taps outside a private chat do nothing", async () => {
    const lane = await seedRewardLane(t.db);
    const h = harness();
    await h.bot.handleUpdate(
      tap(rulesData("mycel-rules-1", lane.community.id, allRight()), MEMBER, "group"),
    );
    expect(await passesOf(lane.member.id)).toEqual([]);
    expect(h.out.map((o) => o.method)).toEqual(["answerCallbackQuery"]);
  });
});
