import { type Db, members } from "@hyphae/db";
import { and, eq } from "drizzle-orm";

export type Member = typeof members.$inferSelect;

// The member row for a Telegram user, created without a wallet on first use, so a member can earn
// before linking (ruled 2026-10-07); payment still needs a wallet signed before the close. The
// caller has already checked that the user is in the community's group. Concurrent first calls
// settle on the (community, Telegram user) unique index.
export async function ensureMember(
  db: Db,
  input: { communityId: string; telegramUserId: bigint; telegramUsername: string | null },
): Promise<Member> {
  await db
    .insert(members)
    .values({
      communityId: input.communityId,
      telegramUserId: input.telegramUserId,
      telegramUsername: input.telegramUsername,
      wallet: null,
      linkMethod: null,
      linkedAt: null,
    })
    .onConflictDoNothing({ target: [members.communityId, members.telegramUserId] });
  const member = await db.query.members.findFirst({
    where: and(
      eq(members.communityId, input.communityId),
      eq(members.telegramUserId, input.telegramUserId),
    ),
  });
  if (!member) throw new Error("ensureMember: no member row after insert");
  return member;
}
