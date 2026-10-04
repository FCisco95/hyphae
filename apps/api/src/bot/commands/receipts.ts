import type { Db } from "@hyphae/db";
import { type CommandContext, type Context, InlineKeyboard } from "grammy";
import {
  ISSUE_MAX_LENGTH,
  ISSUE_MAX_REPORTS,
  loadReceipt,
  RECEIPT_ID,
  receiptText,
  reportSubmissionIssue,
} from "../../member-journey/receipts.js";

export const RECEIPT_PREFIX = "receipt_";

function privateCaller(ctx: Context): bigint | null {
  const user = ctx.from;
  return user &&
    !user.is_bot &&
    Number.isSafeInteger(user.id) &&
    user.id > 0 &&
    ctx.chat?.type === "private" &&
    ctx.chat.id === user.id
    ? BigInt(user.id)
    : null;
}

export async function sendReceipt(db: Db, ctx: Context, receiptId: string, webUrl: string) {
  const caller = privateCaller(ctx);
  if (caller === null)
    return ctx.reply("Open your receipt in your own private chat with this bot.");
  const receipt = await loadReceipt(db, receiptId, caller);
  if (!receipt)
    return ctx.reply(
      "Receipt not found for your account. Use the receipt ID from your submission confirmation.",
    );
  return ctx.reply(receiptText(receipt, webUrl), {
    reply_markup: new InlineKeyboard().text("Refresh receipt", `${RECEIPT_PREFIX}${receiptId}`),
    link_preview_options: { is_disabled: true },
  });
}

export async function receiptCommand(db: Db, ctx: CommandContext<Context>, webUrl: string) {
  const id = ctx.match.trim();
  if (!RECEIPT_ID.test(id)) return ctx.reply("Use /receipt <receipt ID> in your private bot chat.");
  return sendReceipt(db, ctx, id, webUrl);
}

export async function refreshReceipt(db: Db, ctx: Context, webUrl: string) {
  const data = ctx.callbackQuery?.data ?? "";
  const id = data.slice(RECEIPT_PREFIX.length);
  // A stale Telegram callback toast must not prevent reading the durable receipt.
  await ctx.answerCallbackQuery().catch(() => undefined);
  if (!data.startsWith(RECEIPT_PREFIX) || !RECEIPT_ID.test(id)) return;
  return sendReceipt(db, ctx, id, webUrl);
}

export async function issueCommand(db: Db, ctx: CommandContext<Context>) {
  const caller = privateCaller(ctx);
  if (caller === null)
    return ctx.reply("Report a scoring issue in your own private chat with this bot.");
  const match = /^(\S+)\s+([\s\S]+)$/.exec(ctx.match.trim());
  if (!match?.[1] || !match[2] || !RECEIPT_ID.test(match[1]))
    return ctx.reply(
      `Use /issue <receipt ID> <what seems wrong, up to ${ISSUE_MAX_LENGTH} characters>.`,
    );
  const result = await reportSubmissionIssue(db, {
    receiptId: match[1],
    telegramUserId: caller,
    telegramMessageId: ctx.msg.message_id,
    text: match[2],
  });
  if (result.status === "invalid")
    return ctx.reply(`Explain the issue in 1–${ISSUE_MAX_LENGTH} characters.`);
  if (result.status === "not_found")
    return ctx.reply("Receipt not found for your account. No issue was recorded.");
  if (result.status === "limit" || result.status === "cooldown")
    return ctx.reply(
      [
        result.status === "limit"
          ? `This receipt has reached the ${ISSUE_MAX_REPORTS}-report storage limit. No additional report was stored.`
          : `Wait ${result.retryAfterSeconds} seconds before another report for this receipt. No additional report was stored.`,
        "Existing reports remain recorded. Further context can be taken to the community's designated admin; a response or action is not guaranteed.",
        "These technical limits do not change scores, frozen decisions or allocations.",
      ].join("\n"),
    );
  return ctx.reply(
    `${result.status === "duplicate" ? "Issue already recorded" : "Issue recorded"}: ${result.issueId}\nOriginal receipt: ${match[1]}\nThis is a request for review. No score, frozen decision or allocation was changed. Review timing is not guaranteed.`,
  );
}
