import { communities, members } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { type CommandContext, type Context, InlineKeyboard } from "grammy";
import { db } from "../../db.js";
import { env } from "../../env.js";
import { isMemberStatus } from "../membership.js";
import { reply } from "../reply.js";
import { mePayout, meSummary, payoutChecklist, walletLines } from "./me-summary.js";
import { mintDecimals } from "./mint-decimals.js";
import { stepButton } from "./payout-step.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function me(ctx: CommandContext<Context>) {
  if (!ctx.from) return;
  if (ctx.chat.type === "private") {
    return reply(ctx, "Open /me in your community chat, then tap Open my private checklist.");
  }
  const community = await db.query.communities.findFirst({
    where: eq(communities.telegramChatId, BigInt(ctx.chat.id)),
  });
  if (!community) return reply(ctx, "This chat is not a registered Hyphae community.");
  return reply(
    ctx,
    "Open your checklist in private chat.",
    new InlineKeyboard().url(
      "Open my private checklist",
      `https://t.me/${ctx.me.username}?start=me_${community.id}`,
    ),
  );
}

export async function meStart(ctx: CommandContext<Context>): Promise<boolean> {
  if (ctx.chat.type !== "private" || !ctx.from || !ctx.match.startsWith("me_")) return false;
  const id = ctx.match.slice(3);
  if (!UUID.test(id)) return false;
  const community = await db.query.communities.findFirst({ where: eq(communities.id, id) });
  if (!community) {
    await reply(ctx, "That community is not registered with Hyphae.");
    return true;
  }
  const membership = await ctx.api
    .getChatMember(Number(community.telegramChatId), ctx.from.id)
    .catch(() => undefined);
  if (!membership || !isMemberStatus(membership)) {
    await reply(
      ctx,
      "Your community membership could not be confirmed. Open /me from its group and try again.",
    );
    return true;
  }
  // The payload names only the community. The authenticated Telegram sender owns the checklist.
  const member = await db.query.members.findFirst({
    where: and(
      eq(members.communityId, community.id),
      eq(members.telegramUserId, BigInt(ctx.from.id)),
    ),
  });
  if (!member) {
    await reply(
      ctx,
      "Nothing yet. Reply to a raid to start earning points, and send /link to be paid.",
    );
    return true;
  }
  const ref = { communityId: community.id, memberId: member.id };
  const status = await mePayout(db, ref, { decimals: mintDecimals });
  const check = status && payoutChecklist(status);
  const button = check?.step && stepButton(check.step, ctx.me.username, community.id);
  await reply(
    ctx,
    [
      ...(check ? [] : walletLines(member)),
      ...(await meSummary(db, ref)),
      ...(check?.lines ?? []),
      `${env.PUBLIC_WEB_URL}/c/${community.mint}`,
    ].join("\n"),
    button ? new InlineKeyboard().url(button.label, button.url) : undefined,
  );
  return true;
}
