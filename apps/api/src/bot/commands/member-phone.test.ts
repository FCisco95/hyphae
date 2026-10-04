import { type Prompt, ReadApiV1, ReadApiV1Loose, type RewardPurpose } from "@hyphae/core";
import {
  contributions,
  raidSubmissionReceipts,
  raidSubmissionSessions,
  raidSubscriptions,
  rewardIntakes,
  rewardNominations,
  submissionIssues,
  tasks,
} from "@hyphae/db";
import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import type { InlineKeyboardMarkup, Message, Update, UserFromGetMe } from "grammy/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readContribution } from "../../http/read-service.js";
import { startRaidNotifier } from "../../raid-alerts/runner.js";
import { bootstrapRewardEpochs, buildRewardConfigPayload } from "../../rewards/config.js";
import { runEvaluation } from "../../rewards/evaluation.js";
import { at, createTestDb, rubric, seedCommunity, seedTask } from "../../rewards/test-db.js";

const state = vi.hoisted(() => ({
  db: null as unknown,
  queueFails: false,
  postUnavailable: false,
  queue: vi.fn(),
  fetchPost: vi.fn(),
}));
vi.mock("../../db.js", () => ({
  get db() {
    return state.db;
  },
}));
vi.mock("../../env.js", () => ({
  env: {
    TELEGRAM_BOT_TOKEN: "1:fixture",
    DATABASE_URL: "postgres://local:test@localhost/test",
    PUBLIC_WEB_URL: "https://hyphae.test",
    LINK_ORIGIN: "https://api.hyphae.test",
  },
}));
vi.mock("../../jobs/queue.js", () => ({
  boss: { send: state.queue },
  QUEUES: { score: "score", rewardEvaluation: "reward-evaluation" },
}));
vi.mock("../../jobs/reward-jobs.js", () => ({
  sendEvaluation: state.queue,
  sendRetrieval: vi.fn(() => {
    throw new Error("No evidence retrieval job in this journey");
  }),
}));
vi.mock("../../x/oembed.js", async (original) => ({
  ...(await original<object>()),
  fetchPost: state.fetchPost,
}));

let t: Awaited<ReturnType<typeof createTestDb>>;
let bot: Bot;
let nextUpdate = 1;
let nextReply = 10_000;
let memberStatus = "member";
let membershipFails = false;
let toastFails = false;
const output: { method: string; payload: Record<string, unknown>; messageId: number }[] = [];
const messages = () => output.filter((entry) => entry.method === "sendMessage");
const texts = () => messages().map((entry) => String(entry.payload.text));
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing fixture message or record");
  return value;
}
function message(text: string, from = 42, chatId = from, replyId?: number): Update {
  const privateChat = chatId > 0;
  return {
    update_id: ++nextUpdate,
    message: {
      message_id: nextUpdate,
      date: 1,
      chat: privateChat
        ? { id: chatId, type: "private", first_name: "Member" }
        : { id: chatId, type: "supergroup", title: "Fixture Lab" },
      from: { id: from, is_bot: false, first_name: "Member" },
      text,
      ...(text.startsWith("/")
        ? {
            entities: [
              { type: "bot_command" as const, offset: 0, length: text.split(" ")[0]?.length ?? 0 },
            ],
          }
        : {}),
      ...(replyId
        ? {
            reply_to_message: {
              message_id: replyId,
              date: 1,
              chat: { id: chatId, type: "private" as const, first_name: "Member" },
              from: { id: 1, is_bot: true, first_name: "Bot" },
              text: "Submission prompt",
            } as NonNullable<Message["reply_to_message"]>,
          }
        : {}),
    },
  };
}
function callback(data: string, from = 42, chatId = from): Update {
  return {
    update_id: ++nextUpdate,
    callback_query: {
      id: `cb${nextUpdate}`,
      chat_instance: "fixture",
      data,
      from: { id: from, is_bot: false, first_name: "Member" },
      message: {
        message_id: nextUpdate,
        date: 1,
        chat:
          chatId > 0
            ? { id: chatId, type: "private", first_name: "Member" }
            : { id: chatId, type: "supergroup", title: "Fixture Lab" },
        text: "Fixture alert",
      },
    },
  };
}
async function prompt(taskId: string, kind: "reply" | "quote" = "reply") {
  await bot.handleUpdate(callback(`raid_${kind}_${taskId}`));
  const sent = required(messages().at(-1));
  expect(sent.payload.reply_markup).toMatchObject({ force_reply: true });
  const sessionId = required(
    /If reply mode is lost: \/submit ([0-9a-f-]+)/.exec(String(sent.payload.text))?.[1],
  );
  const session = required(
    await t.db.query.raidSubmissionSessions.findFirst({
      where: eq(raidSubmissionSessions.id, sessionId),
    }),
  );
  expect(session).toMatchObject({
    taskId,
    kind,
    telegramUserId: 42n,
    promptMessageId: sent.messageId,
  });
  return { session, promptId: sent.messageId };
}
async function fixture() {
  const { community } = await seedCommunity(t.db);
  const task = await seedTask(t.db, community.id, new Date(Date.now() - 1000));
  await t.db.update(tasks).set({ telegramMessageId: ++nextUpdate }).where(eq(tasks.id, task.id));
  return { community, task };
}
beforeAll(async () => {
  t = await createTestDb();
  state.db = t.db;
  bot = (await import("../index.js")).bot;
  bot.api.config.use(async (_previous, method, payload) => {
    const record = { method, payload: payload as Record<string, unknown>, messageId: ++nextReply };
    output.push(record);
    if (method === "getChatMember" && membershipFails) throw new Error("Fixture membership outage");
    if (method === "answerCallbackQuery" && toastFails) throw new Error("Fixture stale callback");
    return {
      ok: true,
      result:
        method === "getMe"
          ? ({ id: 1, is_bot: true, first_name: "T", username: "fixture_bot" } as UserFromGetMe)
          : method === "getChatMember"
            ? { status: memberStatus }
            : method === "sendMessage"
              ? {
                  message_id: record.messageId,
                  date: 1,
                  chat: { id: record.payload.chat_id, type: "private", first_name: "M" },
                  text: record.payload.text,
                }
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
  memberStatus = "member";
  membershipFails = false;
  toastFails = false;
  state.queueFails = false;
  state.postUnavailable = false;
  state.queue.mockReset().mockImplementation(async () => {
    if (state.queueFails) throw new Error("Fixture queue unavailable");
    return "fixture-job";
  });
  state.fetchPost.mockReset().mockImplementation(async (url: string) => {
    if (state.postUnavailable) return null;
    const parsed = /\/([A-Za-z0-9_]+)\/status\/(\d+)/.exec(url);
    if (!parsed) return null;
    return { id: parsed[2], handle: parsed[1], text: "Fixture public post text", url };
  });
});

describe("first-time member journey through actual bot handlers (fixture only)", () => {
  it("preserves frozen reward capture through private intake, evaluation, effort nomination and public parsing", async () => {
    const { community } = await seedCommunity(t.db);
    await bootstrapRewardEpochs(
      t.db,
      {
        communityId: community.id,
        payload: buildRewardConfigPayload(rubric),
        opensAt: new Date(Math.floor(Date.now() / 1000) * 1000 - 60_000),
        proposedBy: "fixture",
      },
      { clock: at(new Date(Date.now() - 3_600_000)) },
    );
    const chat = Number(community.telegramChatId);
    await bot.handleUpdate(
      message("/raid https://x.com/owner/status/601 1 Reproduce the target's claim", 7, chat),
    );
    const task = required(
      await t.db.query.tasks.findFirst({ where: eq(tasks.communityId, community.id) }),
    );
    const opened = await prompt(task.id);
    const url = "https://x.com/member/status/602";
    await bot.handleUpdate(message(url, 42, 42, opened.promptId));
    const receipt = required(
      await t.db.query.raidSubmissionReceipts.findFirst({
        where: eq(raidSubmissionReceipts.sessionId, opened.session.id),
      }),
    );
    const intake = required(
      await t.db.query.rewardIntakes.findFirst({
        where: eq(rewardIntakes.contributionId, receipt.contributionId),
      }),
    );
    expect(receipt).toMatchObject({
      queueStatus: "queued",
      relationStatus: "unverified",
      ownershipStatus: "unverified",
    });
    expect(intake.capture).toMatchObject({ source: "x_oembed", limitations: ["text_only"] });
    expect(state.queue).toHaveBeenCalledWith(
      "reward-evaluation",
      {
        communityId: community.id,
        target: { contributionId: receipt.contributionId },
      },
      expect.objectContaining({ id: receipt.id, db: expect.anything() }),
    );
    const provider = vi.fn(async (capturedPrompt: Prompt, purpose: RewardPurpose) => {
      expect(capturedPrompt.user).toContain("Capture limitations: text_only");
      expect(capturedPrompt.user).not.toContain("target_relation_unverified");
      expect(capturedPrompt.user).not.toContain("account_ownership_unverified");
      const effort = {
        originalSubstance: { met: true, note: "own reproducible fixture work" },
        inspectableWork: { met: true, note: "captured steps and observations" },
        communityContribution: { met: true, note: "useful evidence for the target" },
        missingEssentialEvidence: null,
        explanation:
          "You documented the observed result and enough steps for another member to check it.",
      };
      return {
        output:
          purpose === "effort"
            ? { effort }
            : {
                score: 85,
                rubricHits: [{ key: "context_fit", met: true, note: "specific" }],
                flags: [],
                aiSlop: { patterns: [], templateRhythm: false },
                reasoning:
                  "You addressed the selected target with a specific and inspectable result.",
              },
        latencyMs: 1,
        costMicroUsd: 0,
      };
    });
    const evaluation = { model: "test:fake", call: provider, horizonMs: 300_000 }; // Fixture routing only; no provider request.
    expect(
      await runEvaluation(
        t.db,
        { communityId: community.id, target: { contributionId: receipt.contributionId } },
        evaluation,
      ),
    ).toMatchObject({ status: "completed" });
    await bot.handleUpdate(callback(`receipt_${receipt.id}`));
    expect(texts().at(-1)).toContain("85 provisional");
    expect(texts().at(-1)).toContain("X account ownership: unverified");
    const captures = state.fetchPost.mock.calls.length;
    await bot.handleUpdate(message(`/effort ${url}`, 42, chat));
    expect(texts().at(-1)).toContain("Nominated for an effort upgrade");
    const nomination = required(
      await t.db.query.rewardNominations.findFirst({
        where: eq(rewardNominations.contributionId, receipt.contributionId),
      }),
    );
    expect(nomination).toMatchObject({ kind: "upgrade", state: "ready", pendingReason: null });
    expect(state.fetchPost).toHaveBeenCalledTimes(captures);
    expect(
      await runEvaluation(
        t.db,
        { communityId: community.id, target: { nominationId: nomination.id } },
        evaluation,
      ),
    ).toMatchObject({ status: "completed" });
    expect(provider.mock.calls.map((call) => call[1])).toEqual(["quality", "effort"]);
    const audit = ReadApiV1.contribution.parse(
      await readContribution(t.db, receipt.contributionId, new Date()),
    );
    // The web app and read-client both consume this tolerant schema.
    expect(ReadApiV1Loose.contribution.parse(audit)).toMatchObject({
      id: receipt.contributionId,
      raid_id: task.id,
      state: "counted",
      capture: { limitations: ["text_only"] },
      selected: { effort: "eligible", multiplier_bps: 30_000, points: "255" },
      nomination: { kind: "upgrade", state: "completed_eligible" },
    });
    await bot.handleUpdate(callback(`receipt_${receipt.id}`));
    expect(texts().at(-1)).toContain("255 provisional");
    expect(texts().at(-1)).toContain("Target relation: unverified");
    expect(texts().at(-1)).toContain("Payment: not verified here");
  });
  it("delivers a private raid, submits the exact reply and quote, refreshes receipts and records a tied issue", async () => {
    const { community } = await seedCommunity(t.db);
    const chat = Number(community.telegramChatId);
    await bot.handleUpdate(message("/start", 42, chat));
    expect(texts().at(-1)).toContain(community.name);
    await bot.handleUpdate(message("/link", 42, chat));
    expect(texts().at(-1)).toContain(`start=link_${community.id}`);
    await bot.handleUpdate(message("/rules", 42, chat));
    expect(texts().at(-1)).toContain(`start=rules_${community.id}`);
    // The fixture member is prelinked. A real wallet signature and quiz attendance are separate.
    await bot.handleUpdate(message(`/start raids_${community.id}`));
    expect(
      await t.db
        .select()
        .from(raidSubscriptions)
        .where(eq(raidSubscriptions.communityId, community.id)),
    ).toHaveLength(0);
    await bot.handleUpdate(callback(`raids_on_${community.id}`));
    expect(texts().at(-1)).toContain("Future raids");
    await bot.handleUpdate(
      message("/raid https://x.com/owner/status/101 1 Explain the target", 42, chat),
    );
    expect(texts().at(-1)).toContain("Admins only");
    await bot.handleUpdate(
      message("/raid https://x.com/owner/status/101 1 Explain the target", 7, chat),
    );
    const task = required(
      await t.db.query.tasks.findFirst({ where: eq(tasks.communityId, community.id) }),
    );
    const notifier = startRaidNotifier(t.db, bot.api);
    try {
      await vi.waitFor(() =>
        expect(texts().some((text) => text.startsWith("New raid"))).toBe(true),
      );
    } finally {
      await notifier.stop();
    }
    const alert = required(
      messages().find((entry) => String(entry.payload.text).startsWith("New raid")),
    );
    expect(alert.payload.chat_id).toBe(42);
    expect(String(alert.payload.text)).toContain(community.name);
    expect(String(alert.payload.text)).toContain(task.targetUrl);
    const keyboard = alert.payload.reply_markup as InlineKeyboardMarkup;
    for (const kind of ["reply", "quote"] as const) {
      const button = required(
        keyboard.inline_keyboard.flat().find((entry) => entry.text === `Submit my ${kind}`),
      );
      expect("callback_data" in button && button.callback_data).toBe(`raid_${kind}_${task.id}`);
    }
    const other = await fixture();
    expect(other.task.id).not.toBe(task.id);
    const replyPrompt = await prompt(task.id);
    expect(texts().at(-1)).toContain("neither is independently verified");
    const submitted = message("https://x.com/member/status/201", 42, 42, replyPrompt.promptId);
    await bot.handleUpdate(submitted);
    const receipt = required(
      await t.db.query.raidSubmissionReceipts.findFirst({
        where: eq(raidSubmissionReceipts.sessionId, replyPrompt.session.id),
      }),
    );
    expect(receipt).toMatchObject({
      communityId: community.id,
      taskId: task.id,
      queueStatus: "queued",
      relationStatus: "unverified",
      ownershipStatus: "unverified",
    });
    expect(texts().at(-1)).toContain(`Receipt: ${receipt.id}`);
    expect(texts().at(-1)).toContain("Pending scoring");
    expect(texts().at(-1)).toContain(`Audit: https://hyphae.test/x/${receipt.contributionId}`);
    const fetched = state.fetchPost.mock.calls.length;
    await bot.handleUpdate(submitted);
    expect(texts().at(-1)).toContain(`Receipt: ${receipt.id}`);
    expect(state.fetchPost).toHaveBeenCalledTimes(fetched);
    expect(state.queue).toHaveBeenCalledTimes(1);
    toastFails = true;
    await bot.handleUpdate(callback(`receipt_${receipt.id}`));
    expect(texts().at(-1)).toContain("X account ownership: unverified");
    expect(texts().at(-1)).toContain("Payment: not verified here");
    toastFails = false;
    const issue = message(`/issue ${receipt.id} Please check the target context`);
    await bot.handleUpdate(issue);
    await bot.handleUpdate(issue);
    expect(texts().at(-1)).toContain("Issue already recorded");
    expect(texts().at(-1)).toContain(`Original receipt: ${receipt.id}`);
    expect(
      await t.db.select().from(submissionIssues).where(eq(submissionIssues.receiptId, receipt.id)),
    ).toHaveLength(1);
    const quotePrompt = await prompt(task.id, "quote");
    await bot.handleUpdate(
      message("https://x.com/member/status/202", 42, 42, quotePrompt.promptId),
    );
    expect(texts().at(-1)).toContain("Received your quote");
    const work = await t.db.select().from(contributions).where(eq(contributions.taskId, task.id));
    expect(work.map((row) => row.kind).sort()).toEqual(["quote", "reply"]);
    expect(work.every((row) => row.telegramMessageId === task.telegramMessageId)).toBe(true);
    await bot.handleUpdate(message(`/close_raid ${task.id} Brief completed`, 7, chat));
    await bot.handleUpdate(callback(`receipt_${receipt.id}`));
    expect(texts().at(-1)).toContain(`Raid: ${task.id} (closed)`);
    await bot.handleUpdate(callback(`raid_reply_${task.id}`));
    expect(texts().at(-1)).toMatch(/closed|not active/);
    expect(
      await t.db.select().from(contributions).where(eq(contributions.taskId, task.id)),
    ).toHaveLength(2);
  });

  it("cancels a prompt, accepts a fresh prompt, and retries failed dispatch without another submission", async () => {
    const { task } = await fixture();
    const abandoned = await prompt(task.id);
    await bot.handleUpdate(message(`/cancel_submission ${abandoned.session.id}`));
    expect(texts().at(-1)).toContain("Submission prompt cancelled");
    await bot.handleUpdate(message("https://x.com/member/status/301", 42, 42, abandoned.promptId));
    expect(texts().at(-1)).toContain("prompt expired or was cancelled");
    const fresh = await prompt(task.id);
    state.queueFails = true;
    const fallback = message(`/submit ${fresh.session.id} https://x.com/member/status/301`);
    await bot.handleUpdate(fallback);
    expect(texts().at(-1)).toContain("saved; scoring has not been confirmed as queued");
    const receipt = required(
      await t.db.query.raidSubmissionReceipts.findFirst({
        where: eq(raidSubmissionReceipts.sessionId, fresh.session.id),
      }),
    );
    expect(receipt.queueStatus).toBe("pending");
    state.queueFails = false;
    await bot.handleUpdate(fallback);
    expect(texts().at(-1)).toContain(`Receipt: ${receipt.id}`);
    expect(texts().at(-1)).toContain("Pending scoring");
    expect(state.queue).toHaveBeenCalledTimes(2);
    expect(
      await t.db.select().from(contributions).where(eq(contributions.taskId, task.id)),
    ).toHaveLength(1);
    await bot.handleUpdate(message(`/cancel_submission ${fresh.session.id}`));
    await bot.handleUpdate(message(`/receipt ${receipt.id}`));
    expect(texts().at(-1)).toContain(`Receipt: ${receipt.id}`);
  });

  it("refuses copied sessions, mismatched private identities, revoked membership and expired prompts", async () => {
    const { community, task } = await fixture();
    const opened = await prompt(task.id);
    await bot.handleUpdate(
      message(`/submit ${opened.session.id} https://x.com/member/status/401`, 99),
    );
    expect(texts().at(-1)).toContain("unavailable");
    for (const [from, chat] of [
      [42, 99],
      [42, Number(community.telegramChatId)],
    ]) {
      await bot.handleUpdate(callback(`raid_reply_${task.id}`, from, chat));
      expect(texts().at(-1)).toContain("own private bot chat");
    }
    memberStatus = "left";
    await bot.handleUpdate(message("https://x.com/member/status/401", 42, 42, opened.promptId));
    expect(texts().at(-1)).toContain("currently belong");
    memberStatus = "member";
    await t.db
      .update(raidSubmissionSessions)
      .set({ expiresAt: new Date(Date.now() - 1) })
      .where(eq(raidSubmissionSessions.id, opened.session.id));
    await bot.handleUpdate(message("https://x.com/member/status/401", 42, 42, opened.promptId));
    expect(texts().at(-1)).toContain("prompt expired");
    expect(
      await t.db.select().from(contributions).where(eq(contributions.taskId, task.id)),
    ).toHaveLength(0);
    expect(state.queue).not.toHaveBeenCalled();
  });

  it("shows refusal instead of success when membership or evidence is unavailable, and explains cancellation", async () => {
    const { community, task } = await fixture();
    const opened = await prompt(task.id);
    membershipFails = true;
    await bot.handleUpdate(message("https://x.com/member/status/501", 42, 42, opened.promptId));
    expect(texts().at(-1)).toContain("Membership could not be checked");
    membershipFails = false;
    state.postUnavailable = true;
    await bot.handleUpdate(message("https://x.com/member/status/501", 42, 42, opened.promptId));
    expect(texts().at(-1)).toContain("Could not read");
    expect(texts().at(-1)).toContain("Nothing new was accepted");
    state.postUnavailable = false;
    await bot.handleUpdate(
      message(`/cancel_raid ${task.id} Target removed`, 7, Number(community.telegramChatId)),
    );
    expect(texts().at(-1)).toContain("Raid cancelled");
    await bot.handleUpdate(message("https://x.com/member/status/501", 42, 42, opened.promptId));
    expect(texts().at(-1)).toMatch(/cancelled|not active/);
    expect(
      await t.db.select().from(contributions).where(eq(contributions.taskId, task.id)),
    ).toHaveLength(0);
    expect(state.queue).not.toHaveBeenCalled();
  });
});
