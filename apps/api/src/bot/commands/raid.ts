import { RubricSchema } from "@hyphae/core";
import { communities, tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";
import type { CommandContext, Context } from "grammy";
import { db } from "../../db.js";
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
  const opensAt = new Date();
  const closesAt = new Date(opensAt.getTime() + args.hours * 3_600_000);
  await db.insert(tasks).values({
    communityId: community.id,
    kind: "raid",
    status: "open",
    targetUrl: post.url,
    targetText: post.text,
    targetAuthor: post.handle,
    brief: args.brief,
    opensAt,
    closesAt,
    telegramMessageId: ctx.msg.message_id,
  });
  const fullHours = rubric.timing.fullUntil / 60;
  return reply(
    ctx,
    [
      `Raid open for ${args.hours}h — @${post.handle}:`,
      `"${post.text.slice(0, 200)}"`,
      post.url,
      `Reply or quote on X, then /submit <link to your reply> or /submit quote <link>. One of each per member. Full credit for the first ${fullHours}h, decaying to zero at ${args.hours}h.`,
    ].join("\n"),
  );
}
