import { RubricSchema } from "@hyphae/core";
import { communities, type tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { type CommandContext, type Context, InlineKeyboard } from "grammy";
import { db } from "../../db.js";
import { alertLink, MAX_OPEN_RAIDS, openRaid } from "../../raid-alerts/alerts.js";
import { fetchPost, parsePostUrl, type XPost } from "../../x/oembed.js";
import { raidKeyboard } from "../raid-keyboard.js";
import { reply } from "../reply.js";
import { clipMessageText } from "../text.js";
import { parseRaidArgs } from "./args.js";

export const RAID_HOUR_CHOICES = [6, 12, 24, 48] as const;

// callback_data is capped at 64 bytes, so the picker carries the post's handle and id, not its URL.
export const hoursKeyboard = (handle: string, id: string) =>
  RAID_HOUR_CHOICES.reduce(
    (kb, h) => kb.text(`${h}h`, `rn:${h}:${handle}:${id}`),
    new InlineKeyboard(),
  );

export async function announceRaid(
  ctx: Context,
  community: typeof communities.$inferSelect,
  post: XPost,
  task: typeof tasks.$inferSelect,
  hours: number,
) {
  const rubric = RubricSchema.parse(community.rubric);
  return ctx.reply(
    [
      `Raid open for ${hours}h — @${post.handle}:`,
      `"${clipMessageText(post.text, 200)}"`,
      post.url,
      task.brief ? `Brief: ${task.brief}` : "",
      `Raid ID: ${task.id}`,
      `Tap Reply on X or Quote on X, post it, then tap Submit below and paste your post's link. One of each per member. Full credit for the first ${rubric.timing.fullUntil / 60}h, decaying to zero at ${hours}h.`,
      `Optional private alerts for future raids: ${alertLink(ctx.me.username, community.id)}`,
    ]
      .filter(Boolean)
      .join("\n"),
    {
      reply_markup: raidKeyboard(ctx.me.username, task.id, post.url),
      link_preview_options: { is_disabled: true },
    },
  );
}

export const LIMIT_REACHED = (open: { id: string }[]) =>
  `${MAX_OPEN_RAIDS} raids are already open (${open.map((t) => t.id).join(", ")}). Close one before opening another. /raids lists them with a Close button.`;

export async function raid(ctx: CommandContext<Context>) {
  const from = ctx.from;
  if (!from || !ctx.msg) return;
  const community = await db.query.communities.findFirst({
    where: eq(communities.telegramChatId, BigInt(ctx.chat.id)),
  });
  if (!community) return reply(ctx, "This chat is not a registered Hyphae community.");
  if (community.adminTelegramUserId !== BigInt(from.id)) return reply(ctx, "Admins only.");
  const rubric = RubricSchema.parse(community.rubric);
  const args = parseRaidArgs(ctx.match, rubric.timing.zeroAt);
  if (!args)
    return reply(
      ctx,
      `Usage: /raid <post url> [hours=${rubric.timing.zeroAt / 60}] [brief…]. Send just the link to pick the length with buttons.`,
    );

  // A bare link asks for the length instead of silently running the default.
  const bare = ctx.match.trim().split(/\s+/).length === 1;
  const parsed = parsePostUrl(args.url);
  if (bare && parsed)
    return ctx.reply("How long should this raid run?", {
      reply_markup: hoursKeyboard(parsed.handle, parsed.id),
      reply_parameters: { message_id: ctx.msg.message_id },
    });

  const post = await fetchPost(args.url);
  if (!post) return reply(ctx, "Could not read that post. Is it public?");
  const opened = await openRaid(db, {
    communityId: community.id,
    chatId: BigInt(ctx.chat.id),
    actorId: BigInt(from.id),
    messageId: ctx.msg.message_id,
    post,
    hours: args.hours,
    brief: args.brief,
  });
  if (opened.status === "unauthorized") return reply(ctx, "Admins only in the registered group.");
  if (opened.status === "existing")
    return reply(ctx, "That raid was already opened. No extra alerts were queued.");
  if (opened.status === "limit_reached") return reply(ctx, LIMIT_REACHED(opened.open));
  return announceRaid(ctx, community, post, opened.task, args.hours);
}
