import { communities, members } from "@hyphae/db";
import { isAddress } from "@solana/kit";
import { and, eq } from "drizzle-orm";
import type { CommandContext, Context } from "grammy";
import { db } from "../../db.js";
import { reply } from "../reply.js";

export async function link(ctx: CommandContext<Context>) {
  const wallet = ctx.match.trim();
  if (!isAddress(wallet)) return reply(ctx, "Usage: /link <your Solana wallet address>");
  const chatId = BigInt(ctx.chat.id);
  const community = await db.query.communities.findFirst({
    where: eq(communities.telegramChatId, chatId),
  });
  if (!community) return reply(ctx, "This chat is not a registered Hyphae community.");
  const from = ctx.from;
  if (!from) return;

  const taken = await db.query.members.findFirst({
    where: and(eq(members.communityId, community.id), eq(members.wallet, wallet)),
  });
  if (taken && taken.telegramUserId !== BigInt(from.id))
    return reply(ctx, "That wallet is already linked to another member.");

  await db
    .insert(members)
    .values({
      communityId: community.id,
      telegramUserId: BigInt(from.id),
      telegramUsername: from.username ?? null,
      wallet,
      linkMethod: "paste",
    })
    .onConflictDoUpdate({
      target: [members.communityId, members.telegramUserId],
      set: { wallet, telegramUsername: from.username ?? null, linkedAt: new Date() },
    });
  return reply(
    ctx,
    `Linked ${wallet.slice(0, 4)}…${wallet.slice(-4)}. Submit work with /submit <link or text>.`,
  );
}
