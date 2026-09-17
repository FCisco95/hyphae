import { communities, contributions, members, scoringRuns } from "@hyphae/db";
import { and, eq, sql } from "drizzle-orm";
import type { CommandContext, Context } from "grammy";
import { db } from "../../db.js";
import { env } from "../../env.js";
import { reply } from "../reply.js";

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

  const [row] = await db
    .select({
      count: sql<number>`count(${scoringRuns.id})::int`,
      total: sql<number>`coalesce(sum(${scoringRuns.score} * ${scoringRuns.timingMultiplier} / 10000.0), 0)::float`,
    })
    .from(contributions)
    .leftJoin(scoringRuns, eq(scoringRuns.contributionId, contributions.id))
    .where(eq(contributions.memberId, member.id));

  return reply(
    ctx,
    [
      `Wallet ${member.wallet.slice(0, 4)}…${member.wallet.slice(-4)}`,
      `Scored contributions: ${row?.count ?? 0}`,
      `Points this epoch: ${Math.round(row?.total ?? 0)}`,
      `${env.PUBLIC_WEB_URL}/w/${member.wallet}`,
    ].join("\n"),
  );
}
