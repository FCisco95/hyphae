import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import type { CommandContext, Context } from "grammy";
import { db } from "../../db.js";
import { transitionRaid } from "../../member-journey/lifecycle.js";
import { reply } from "../reply.js";

async function endRaid(ctx: CommandContext<Context>, action: "closed" | "cancelled") {
  if (!ctx.from || !ctx.msg) return;
  if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")
    return reply(ctx, "Use this command in the registered community group.");
  const command = action === "closed" ? "close_raid" : "cancel_raid";
  const match = ctx.match.trim().match(/^(\S+)\s+([\s\S]+)$/);
  if (!match?.[1] || !match[2])
    return reply(ctx, `Usage: /${command} <raid or brief id> <reason, 1–500 characters>`);
  const community = await db.query.communities.findFirst({
    where: eq(communities.telegramChatId, BigInt(ctx.chat.id)),
  });
  if (!community) return reply(ctx, "This chat is not a registered Hyphae community.");
  const result = await transitionRaid(db, {
    communityId: community.id,
    taskId: match[1],
    chatId: BigInt(ctx.chat.id),
    actorId: BigInt(ctx.from.id),
    messageId: ctx.msg.message_id,
    action,
    reason: match[2],
  });
  if (result.status === "invalid")
    return reply(ctx, `Usage: /${command} <raid or brief id> <reason, 1–500 characters>`);
  if (result.status === "unauthorized")
    return reply(
      ctx,
      "Only this community's current designated admin can close or cancel raids and briefs.",
    );
  if (result.status === "not_found")
    return reply(ctx, "That raid or brief was not found in this community.");
  if (result.status === "terminal")
    return reply(
      ctx,
      `This brief is already ${result.state}. Its recorded decision was not changed.`,
    );
  const label = result.task.kind === "raid" ? "Raid" : "Brief";
  return reply(
    ctx,
    [
      `${label} ${result.state}${result.status === "existing" ? " (already recorded)" : ""}.`,
      `${label}: ${result.task.id}`,
      `Reason: ${result.event.reason}`,
      `Receipt: ${result.event.id}`,
      `Recorded: ${result.event.createdAt.toISOString()}`,
      "New submissions are stopped. Existing submissions, scores and credit remain unchanged.",
      "This action does not establish eligibility, allocation, claimability or payment.",
    ].join("\n"),
  );
}

export const closeRaid = (ctx: CommandContext<Context>) => endRaid(ctx, "closed");
export const cancelRaid = (ctx: CommandContext<Context>) => endRaid(ctx, "cancelled");
