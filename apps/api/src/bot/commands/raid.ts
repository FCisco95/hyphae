import { RubricSchema } from "@hyphae/core";
import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import type { CommandContext, Context } from "grammy";
import { db } from "../../db.js";
import { alertLink, openRaid } from "../../raid-alerts/alerts.js";
import { fetchPost } from "../../x/oembed.js";
import { reply } from "../reply.js";
import { parseRaidArgs } from "./args.js";

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
    return reply(ctx, `Usage: /raid <post url> [hours=${rubric.timing.zeroAt / 60}] [brief…]`);

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
  const fullHours = rubric.timing.fullUntil / 60;
  return reply(
    ctx,
    [
      `Raid open for ${args.hours}h — @${post.handle}:`,
      `"${post.text.slice(0, 200)}"`,
      post.url,
      args.brief ? `Brief: ${args.brief}` : "",
      `Reply or quote on X, then /submit <link to your reply> or /submit quote <link>. One of each per member. Full credit for the first ${fullHours}h, decaying to zero at ${args.hours}h.`,
      `Optional private alerts for future raids: ${alertLink(ctx.me.username, community.id)}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}
