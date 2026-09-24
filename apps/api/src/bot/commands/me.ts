import { communities, members } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import type { CommandContext, Context } from "grammy";
import { db } from "../../db.js";
import { env } from "../../env.js";
import { reply } from "../reply.js";
import { meSummary } from "./me-summary.js";

export async function me(ctx: CommandContext<Context>) {
  const from = ctx.from;
  if (!from) return;
  const community = await db.query.communities.findFirst({
    where: eq(communities.telegramChatId, BigInt(ctx.chat.id)),
  });
  if (!community) return reply(ctx, "This chat is not a registered Hyphae community.");
  const member = await db.query.members.findFirst({
    where: and(eq(members.communityId, community.id), eq(members.telegramUserId, BigInt(from.id))),
  });
  if (!member) return reply(ctx, "Not linked yet. /link <wallet> first.");

  return reply(
    ctx,
    [
      `Wallet ${member.wallet.slice(0, 4)}…${member.wallet.slice(-4)}`,
      ...(await meSummary(db, { communityId: community.id, memberId: member.id })),
      `${env.PUBLIC_WEB_URL}/w/${member.wallet}`,
    ].join("\n"),
  );
}
