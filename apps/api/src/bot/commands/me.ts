import { communities, members } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { type CommandContext, type Context, InlineKeyboard } from "grammy";
import { db } from "../../db.js";
import { env } from "../../env.js";
import { reply } from "../reply.js";
import { mePayout, meSummary, payoutChecklist, walletLines } from "./me-summary.js";
import { mintDecimals } from "./mint-decimals.js";
import { stepButton } from "./payout-step.js";

export async function me(ctx: CommandContext<Context>) {
  const from = ctx.from;
  if (!from) return;
  // /me is per community, so a private chat has nothing to look up.
  if (ctx.chat.type === "private") return reply(ctx, "Send /me in your community chat.");
  const community = await db.query.communities.findFirst({
    where: eq(communities.telegramChatId, BigInt(ctx.chat.id)),
  });
  if (!community) return reply(ctx, "This chat is not a registered Hyphae community.");
  const member = await db.query.members.findFirst({
    where: and(eq(members.communityId, community.id), eq(members.telegramUserId, BigInt(from.id))),
  });
  if (!member)
    return reply(
      ctx,
      "Nothing yet. Reply to a raid to start earning points, and send /link to be paid.",
    );

  const ref = { communityId: community.id, memberId: member.id };
  const status = await mePayout(db, ref, { decimals: mintDecimals });
  const check = status && payoutChecklist({ ...status, member });
  const button = check?.step && stepButton(check.step, ctx.me.username, community.id);
  return reply(
    ctx,
    [
      ...(check ? [] : walletLines(member)),
      ...(await meSummary(db, ref)),
      ...(check?.lines ?? []),
      `${env.PUBLIC_WEB_URL}/c/${community.mint}`,
    ].join("\n"),
    button ? new InlineKeyboard().url(button.label, button.url) : undefined,
  );
}
