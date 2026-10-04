import {
  contributions,
  raidSubmissionReceipts,
  raidSubmissionSessions,
  scoringRuns,
  submissionIssues,
} from "@hyphae/db";
import { eq } from "drizzle-orm";
import { Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity, seedTask, T0 } from "../../rewards/test-db.js";
import { issueCommand, receiptCommand, refreshReceipt } from "./receipts.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
let bot: Bot;
let receiptId: string;
let updates = 100;
let toastFails = false;
const output: { method: string; payload: Record<string, unknown> }[] = [];
const texts = () =>
  output.filter((p) => p.method === "sendMessage").map((p) => String(p.payload.text));

function command(text: string, from = 42, group = false, chatId = from): Update {
  return {
    update_id: ++updates,
    message: {
      message_id: updates,
      date: 1,
      chat: group
        ? { id: -100, type: "group", title: "Lab" }
        : { id: chatId, type: "private", first_name: "M" },
      from: { id: from, is_bot: false, first_name: "M" },
      text,
      entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0]?.length ?? 0 }],
    },
  };
}
beforeAll(async () => {
  t = await createTestDb();
  const { community, member } = await seedCommunity(t.db);
  const task = await seedTask(t.db, community.id, T0);
  const [contribution] = await t.db
    .insert(contributions)
    .values({
      communityId: community.id,
      memberId: member.id,
      taskId: task.id,
      kind: "reply",
      text: "My reply",
      telegramMessageId: 10,
    })
    .returning();
  const [session] = await t.db
    .insert(raidSubmissionSessions)
    .values({
      communityId: community.id,
      taskId: task.id,
      telegramUserId: 42n,
      kind: "reply",
      expiresAt: new Date(),
    })
    .returning();
  if (!contribution || !session) throw new Error("fixture");
  const [receipt] = await t.db
    .insert(raidSubmissionReceipts)
    .values({
      sessionId: session.id,
      communityId: community.id,
      memberId: member.id,
      taskId: task.id,
      contributionId: contribution.id,
      artifactKey: "x:status:10",
    })
    .returning();
  if (!receipt) throw new Error("fixture");
  receiptId = receipt.id;
  bot = new Bot("1:test");
  bot.command("receipt", (ctx) => receiptCommand(t.db, ctx, "https://hyphae.test"));
  bot.command("issue", (ctx) => issueCommand(t.db, ctx));
  bot.callbackQuery(/^receipt_/, (ctx) => refreshReceipt(t.db, ctx, "https://hyphae.test"));
  bot.api.config.use(async (_previous, method, payload) => {
    output.push({ method, payload: payload as Record<string, unknown> });
    if (method === "answerCallbackQuery" && toastFails) throw new Error("stale callback");
    return {
      ok: true,
      result:
        method === "getMe"
          ? ({ id: 1, is_bot: true, first_name: "T", username: "test_bot" } as UserFromGetMe)
          : true,
    } as never;
  });
  await bot.init();
});
afterAll(async () => {
  await t.close();
});
beforeEach(() => {
  output.length = 0;
  toastFails = false;
});

describe("receipt and scoring-issue bot commands", () => {
  it("privately reads the caller's receipt with refresh controls and no queued-success claim", async () => {
    await bot.handleUpdate(command(`/receipt ${receiptId}`));
    expect(texts()[0]).toContain("Pending dispatch: received");
    expect(
      JSON.stringify(output.find((o) => o.method === "sendMessage")?.payload.reply_markup),
    ).toContain(`receipt_${receiptId}`);
  });
  it("refuses wrong callers, groups and private chat identity mismatches", async () => {
    await bot.handleUpdate(command(`/receipt ${receiptId}`, 43));
    await bot.handleUpdate(command(`/receipt ${receiptId}`, 42, true));
    await bot.handleUpdate(command(`/receipt ${receiptId}`, 42, false, 43));
    expect(texts().join("\n")).not.toContain("Target:");
    expect(texts()[0]).toContain("Receipt not found");
  });
  it("idempotently records a private issue and never reports an automatic score correction", async () => {
    const update = command(`/issue ${receiptId} I think the target context was missed`);
    await bot.handleUpdate(update);
    await bot.handleUpdate(update);
    expect(texts()[0]).toContain("Issue recorded:");
    expect(texts()[1]).toContain("Issue already recorded:");
    expect(texts()[0]).toContain("No score, frozen decision or allocation was changed");
    expect(
      await t.db.select().from(submissionIssues).where(eq(submissionIssues.receiptId, receiptId)),
    ).toHaveLength(1);
    await bot.handleUpdate(command(`/issue ${receiptId} Private outsider report`, 43));
    expect(texts().at(-1)).toContain("No issue was recorded");
  });
  it("still refreshes a receipt if the callback toast fails", async () => {
    toastFails = true;
    await bot.handleUpdate({
      update_id: ++updates,
      callback_query: {
        id: String(updates),
        chat_instance: "test",
        from: { id: 42, is_bot: false, first_name: "M" },
        data: `receipt_${receiptId}`,
        message: {
          message_id: updates,
          date: 1,
          chat: { id: 42, type: "private", first_name: "M" },
          text: "Receipt",
        },
      },
    });
    expect(texts()[0]).toContain(receiptId);
  });

  it("labels the stored legacy score as credited quality when the raw model score differs", async () => {
    const [receipt] = await t.db
      .select()
      .from(raidSubmissionReceipts)
      .where(eq(raidSubmissionReceipts.id, receiptId));
    if (!receipt) throw new Error("fixture");
    await t.db.insert(scoringRuns).values({
      contributionId: receipt.contributionId,
      model: "test:fixture",
      rubricVersion: "1.2.0",
      promptHash: "test",
      input: {},
      output: { score: 85 },
      score: 0,
      timingMultiplier: 10_000,
      flags: ["off_topic"],
      reasoning: "The reply missed the target context.",
      latencyMs: 1,
      costMicroUsd: 1,
      evidenceHash: "test:legacy-score",
    });
    await bot.handleUpdate(command(`/receipt ${receiptId}`));
    expect(texts()[0]).toContain("Scored in the legacy lane: 0/100 credited quality");
    expect(texts()[0]).not.toContain("0/100 raw quality");
    expect(texts()[0]).not.toContain("85/100 credited quality");
  });
});
