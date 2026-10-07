import { communities, tasks } from "@hyphae/db";
import { and, desc, eq, gt } from "drizzle-orm";
import { type CommandContext, type Context, InlineKeyboard } from "grammy";
import { db } from "../../db.js";
import { transitionRaid } from "../../member-journey/lifecycle.js";
import { MAX_OPEN_RAIDS, openRaid } from "../../raid-alerts/alerts.js";
import { fetchPost } from "../../x/oembed.js";
import { reply } from "../reply.js";
import { announceRaid, LIMIT_REACHED, RAID_HOUR_CHOICES } from "./raid.js";

const PICK = /^rn:(\d{1,3}):([A-Za-z0-9_]{1,15}):(\d{1,20})$/;
const CLOSE = /^cr:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const utc = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;

async function adminContext(ctx: Context) {
  const chat = ctx.chat;
  if (!ctx.from || !chat || (chat.type !== "group" && chat.type !== "supergroup")) return null;
  const community = await db.query.communities.findFirst({
    where: eq(communities.telegramChatId, BigInt(chat.id)),
  });
  if (!community || community.adminTelegramUserId !== BigInt(ctx.from.id)) return null;
  return community;
}

const clearButtons = (ctx: Context) =>
  ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => undefined);

export async function raidsMenu(ctx: CommandContext<Context>) {
  const community = await adminContext(ctx);
  if (!community) return reply(ctx, "Admins only, in the registered community group.");
  const open = await db.query.tasks.findMany({
    where: and(
      eq(tasks.communityId, community.id),
      eq(tasks.status, "open"),
      gt(tasks.closesAt, new Date()),
    ),
    orderBy: [desc(tasks.opensAt)],
    limit: MAX_OPEN_RAIDS,
  });
  if (!open.length) return reply(ctx, "No open raids. Start one with /raid <post link>.");
  const keyboard = open.reduce(
    (kb, t, i) => kb.text(`Close #${i + 1}`, `cr:${t.id}`),
    new InlineKeyboard(),
  );
  return ctx.reply(
    [
      `Open raids (${open.length} of ${MAX_OPEN_RAIDS}):`,
      ...open.map(
        (t, i) =>
          `#${i + 1} @${t.targetAuthor ?? "?"} · ends ${utc(t.closesAt)}\n${t.targetUrl ?? "No target"}`,
      ),
      "Closing stops new submissions; existing work and credit stay.",
    ].join("\n\n"),
    {
      reply_markup: keyboard,
      reply_parameters: { message_id: ctx.msg.message_id },
      link_preview_options: { is_disabled: true },
    },
  );
}

// Tapped under "How long should this raid run?": opens the raid for the chosen hours.
export async function pickRaidHours(ctx: Context) {
  const m = PICK.exec(ctx.callbackQuery?.data ?? "");
  const message = ctx.callbackQuery?.message;
  const hours = Number(m?.[1]);
  if (!m || !message || !(RAID_HOUR_CHOICES as readonly number[]).includes(hours))
    return ctx.answerCallbackQuery({ text: "That button is out of date." });
  const community = await adminContext(ctx);
  if (!community) return ctx.answerCallbackQuery({ text: "Only the community admin can do this." });
  await ctx.answerCallbackQuery({ text: "Opening the raid…" });
  const post = await fetchPost(`https://x.com/${m[2]}/status/${m[3]}`);
  if (!post) return ctx.reply("Could not read that post. Is it public? Try /raid again.");
  const opened = await openRaid(db, {
    communityId: community.id,
    chatId: BigInt(community.telegramChatId),
    actorId: BigInt(ctx.from?.id ?? 0),
    messageId: message.message_id,
    post,
    hours,
    brief: "",
  });
  if (opened.status === "unauthorized") return ctx.reply("Admins only in the registered group.");
  if (opened.status === "limit_reached") return ctx.reply(LIMIT_REACHED(opened.open));
  await clearButtons(ctx);
  if (opened.status === "existing")
    return ctx.reply("That raid was already opened. No extra alerts were queued.");
  return announceRaid(ctx, community, post, opened.task, hours);
}

// Tapped under /raids: closes that raid with a fixed reason and the usual lifecycle receipt.
export async function closeRaidButton(ctx: Context) {
  const m = CLOSE.exec(ctx.callbackQuery?.data ?? "");
  const message = ctx.callbackQuery?.message;
  if (!m?.[1] || !message) return ctx.answerCallbackQuery({ text: "That button is out of date." });
  const community = await adminContext(ctx);
  if (!community) return ctx.answerCallbackQuery({ text: "Only the community admin can do this." });
  const result = await transitionRaid(db, {
    communityId: community.id,
    taskId: m[1],
    chatId: BigInt(community.telegramChatId),
    actorId: BigInt(ctx.from?.id ?? 0),
    messageId: message.message_id,
    action: "closed",
    reason: "Closed from the raids menu",
  });
  if (result.status === "changed" || result.status === "existing") {
    await ctx.answerCallbackQuery({ text: "Raid closed." });
    await clearButtons(ctx);
    return ctx.reply(
      `Raid closed: ${result.task.id}\nReceipt: ${result.event.id}\nNew submissions are stopped. Existing submissions, scores and credit remain unchanged.`,
    );
  }
  return ctx.answerCallbackQuery({
    text:
      result.status === "terminal"
        ? `Already ${result.state}.`
        : "That raid was not found or could not be closed.",
  });
}
