import { communities, members } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import type { CommandContext, Context } from "grammy";
import { db } from "../../db.js";
import { env } from "../../env.js";
import { reply } from "../reply.js";
import { meSummary, walletLines } from "./me-summary.js";

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

  return reply(
    ctx,
    [
      ...walletLines(member),
      ...(await meSummary(db, { communityId: community.id, memberId: member.id })),
      `${env.PUBLIC_WEB_URL}/c/${community.mint}`,
    ].join("\n"),
  );
}
