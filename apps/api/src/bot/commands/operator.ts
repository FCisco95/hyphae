import type { Db } from "@hyphae/db";
import type { CommandContext, Context } from "grammy";
import { operatorMessage, readOperatorSummary } from "../../member-journey/operator.js";
import { COMMUNITY_ID } from "../../raid-alerts/alerts.js";

export async function operator(db: Db, ctx: CommandContext<Context>) {
  const from = ctx.from;
  if (
    !from ||
    from.is_bot ||
    !Number.isSafeInteger(from.id) ||
    from.id <= 0 ||
    ctx.chat.type !== "private" ||
    ctx.chat.id !== from.id
  )
    return ctx.reply("Open your own private chat with the bot to use /ops <community ID>.");
  const communityId = ctx.match.trim();
  if (!COMMUNITY_ID.test(communityId))
    return ctx.reply(
      "Usage: /ops <community ID>. Available only to that community's designated admin.",
    );
  const result = await readOperatorSummary(db, { communityId, actorId: BigInt(from.id) });
  if (result.status === "unauthorized")
    return ctx.reply(
      "Operator view unavailable. Only the current designated admin of this community can read it.",
    );
  return ctx.reply(operatorMessage(result.summary), {
    link_preview_options: { is_disabled: true },
  });
}
