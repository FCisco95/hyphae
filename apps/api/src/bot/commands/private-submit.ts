import { type Db, raidSubmissionSessions } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { type CommandContext, type Context, InlineKeyboard, type NextFunction } from "grammy";
import { boss, QUEUES } from "../../jobs/queue.js";
import { sendEvaluation } from "../../jobs/reward-jobs.js";
import {
  acceptSubmission,
  beginSubmission,
  cancelSubmission,
  queueSubmission,
  REFUSALS,
  type SubmissionDeps,
} from "../../member-journey/submissions.js";
import { fetchPost } from "../../x/oembed.js";
import { isMemberStatus } from "../membership.js";
import { sendReceipt } from "./receipts.js";

const caller = (ctx: Context) =>
  ctx.chat?.type === "private" &&
  ctx.from &&
  !ctx.from.is_bot &&
  Number.isSafeInteger(ctx.from.id) &&
  ctx.from.id > 0 &&
  ctx.chat.id === ctx.from.id
    ? BigInt(ctx.from.id)
    : undefined;
const deps = (ctx: Context): SubmissionDeps => ({
  fetchPost,
  membership: async (chatId, userId) =>
    isMemberStatus(
      await ctx.api.getChatMember(
        Number(chatId),
        Number(userId),
        AbortSignal.timeout(4_000) as unknown as Parameters<Context["api"]["getChatMember"]>[2],
      ),
    ),
});

async function prompt(db: Db, ctx: Context, taskId: string, kind: "reply" | "quote") {
  const userId = caller(ctx);
  if (userId === undefined) return ctx.reply("Open this raid in your own private bot chat.");
  const result = await beginSubmission(db, taskId, userId, kind, deps(ctx));
  if ("error" in result) return ctx.reply(REFUSALS[result.error]);
  const { session } = result;
  const message = await ctx.reply(
    [
      `${result.communityName} · submit your ${kind}`,
      `Raid: ${session.taskId}`,
      result.target,
      "Reply to THIS message with one URL of your own work. This declares authorship and engagement; neither is independently verified by X oEmbed.",
      "Your post and score have a public audit receipt. The existing scorer may announce the result in the group. Points are provisional; they do not establish payout eligibility or payment.",
      `Prompt expires ${session.expiresAt.toISOString()}.`,
      `If reply mode is lost: /submit ${session.id} <URL>`,
      `To abandon this prompt: /cancel_submission ${session.id}`,
    ].join("\n\n"),
    {
      reply_markup: {
        force_reply: true,
        input_field_placeholder: "URL of your own reply or quote",
      },
      link_preview_options: { is_disabled: true },
    },
  );
  await db
    .update(raidSubmissionSessions)
    .set({ promptMessageId: message.message_id })
    .where(
      and(
        eq(raidSubmissionSessions.id, session.id),
        eq(raidSubmissionSessions.telegramUserId, userId),
      ),
    );
}
export async function submissionStart(db: Db, ctx: CommandContext<Context>) {
  const match = /^(reply|quote)_([0-9a-f-]+)$/.exec(ctx.match);
  if (!match) return false;
  await prompt(db, ctx, match[2] as string, match[1] as "reply" | "quote");
  return true;
}
export async function submissionButton(db: Db, ctx: Context) {
  const match = /^raid_(reply|quote)_([0-9a-f-]+)$/.exec(ctx.callbackQuery?.data ?? "");
  // A stale callback toast cannot block a fresh authorization check or receipt.
  await ctx.answerCallbackQuery().catch(() => {});
  if (match) await prompt(db, ctx, match[2] as string, match[1] as "reply" | "quote");
}
async function receive(db: Db, ctx: Context, sessionId: string, url: string, webUrl: string) {
  const userId = caller(ctx);
  if (userId === undefined) return;
  const result = await acceptSubmission(db, { sessionId, url, userId }, deps(ctx));
  if ("error" in result) return ctx.reply(REFUSALS[result.error]);
  const queued = await queueSubmission(db, result.receipt, () =>
    result.lane === "reward"
      ? sendEvaluation({
          communityId: result.receipt.communityId,
          target: { contributionId: result.receipt.contributionId },
        })
      : boss.send(
          QUEUES.score,
          { contributionId: result.receipt.contributionId },
          { singletonKey: result.receipt.contributionId },
        ),
  );
  await sendReceipt(db, ctx, result.receipt.id, webUrl);
  if (!queued)
    await ctx.reply(
      `Your work is saved; scoring has not been confirmed as queued. Retry /submit ${sessionId} ${url} to retry dispatch without creating another contribution.`,
    );
}
export async function privateSubmit(db: Db, ctx: CommandContext<Context>, webUrl: string) {
  const match = /^([0-9a-f-]+)\s+(\S+)$/.exec(ctx.match.trim());
  if (!match)
    return ctx.reply(
      "Open the exact raid’s Submit my reply or Submit my quote button, then reply to its prompt with your URL.",
    );
  return receive(db, ctx, match[1] as string, match[2] as string, webUrl);
}
export async function submissionReply(db: Db, ctx: Context, next: NextFunction, webUrl: string) {
  const userId = caller(ctx);
  const replyId = ctx.message?.reply_to_message?.message_id;
  if (userId === undefined || !replyId || !ctx.message?.text) return next();
  const session = await db.query.raidSubmissionSessions.findFirst({
    where: and(
      eq(raidSubmissionSessions.telegramUserId, userId),
      eq(raidSubmissionSessions.promptMessageId, replyId),
    ),
  });
  if (!session) return next();
  return receive(db, ctx, session.id, ctx.message.text.trim(), webUrl);
}
export async function cancelPrivateSubmission(db: Db, ctx: CommandContext<Context>) {
  const userId = caller(ctx);
  if (userId === undefined) return;
  const cancelled = await cancelSubmission(db, ctx.match.trim(), userId);
  return ctx.reply(
    cancelled
      ? "Submission prompt cancelled. Already received work and its receipt remain. Tap the raid’s Submit button to start again if it is active."
      : "That submission prompt is unavailable.",
    { reply_markup: new InlineKeyboard() },
  );
}
