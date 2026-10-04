import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import type { CommandContext, Context } from "grammy";
import { db } from "../../db.js";
import { env } from "../../env.js";
import { openLinkSession } from "../../link/session.js";
import { isMemberStatus } from "../membership.js";
import { reply } from "../reply.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const startPayload = (communityId: string): string => `link_${communityId}`;
export const parseStartPayload = (payload: string): string | undefined => {
  const id = payload.startsWith("link_") ? payload.slice(5) : "";
  return UUID.test(id) ? id : undefined;
};
export { isMemberStatus } from "../membership.js";

// In a group a link URL would be open to anyone, so /link only points to a private chat. A pasted
// address is no longer accepted (D1): wallets are linked by signing.
export async function linkInGroup(ctx: CommandContext<Context>) {
  const community = await db.query.communities.findFirst({
    where: eq(communities.telegramChatId, BigInt(ctx.chat.id)),
  });
  if (!community) return reply(ctx, "This chat is not a registered Hyphae community.");
  return reply(
    ctx,
    `Link your wallet privately: https://t.me/${ctx.me.username}?start=${startPayload(community.id)}`,
  );
}

// The private chat opened by that deep link. Membership in the community is checked here, when the
// session opens; the session then lives 15 minutes and is single-use.
export async function linkStart(ctx: CommandContext<Context>): Promise<boolean> {
  const from = ctx.from;
  const communityId = parseStartPayload(ctx.match);
  if (!from || !communityId) return false;
  const community = await db.query.communities.findFirst({
    where: eq(communities.id, communityId),
  });
  if (!community) {
    await ctx.reply("That community is not registered with Hyphae.");
    return true;
  }
  const member = await ctx.api
    .getChatMember(Number(community.telegramChatId), from.id)
    .catch(() => undefined);
  if (!member || !isMemberStatus(member)) {
    await ctx.reply(`Join ${community.name} first, then send /link there.`);
    return true;
  }
  const token = await openLinkSession(db, {
    communityId: community.id,
    telegramUserId: BigInt(from.id),
    telegramUsername: from.username ?? null,
  });
  await ctx.reply(
    `Open this within 15 minutes to link your wallet to ${community.name}:\n${env.LINK_ORIGIN}/link#${token}\n\nYour wallet will ask you to sign a readable message. It is free and moves no funds. Do not forward this link.`,
    { link_preview_options: { is_disabled: true } },
  );
  return true;
}
