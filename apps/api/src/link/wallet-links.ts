import { type Db, members, memberWalletLinks } from "@hyphae/db";
import { and, eq, gt, isNull, lte, ne, or, sql } from "drizzle-orm";

// The only wallet read a payout may use: the link valid at the epoch's closesAt (D3, O2).
export async function walletAt(db: Db, memberId: string, at: Date) {
  const [row] = await db
    .select({ wallet: memberWalletLinks.wallet, method: memberWalletLinks.method })
    .from(memberWalletLinks)
    .where(
      and(
        eq(memberWalletLinks.memberId, memberId),
        lte(memberWalletLinks.validFrom, at),
        or(isNull(memberWalletLinks.validTo), gt(memberWalletLinks.validTo, at)),
      ),
    );
  return row;
}

// Runs inside the proof transaction. The member row is locked so a concurrent relink of the same
// member serializes here; the unique (community, wallet) index settles races between members.
export async function applyVerifiedWallet(
  tx: Db,
  input: {
    communityId: string;
    telegramUserId: bigint;
    telegramUsername: string | null;
    wallet: string;
    proofRequestId: string;
  },
): Promise<"linked" | "wallet_taken"> {
  const [holder] = await tx
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.communityId, input.communityId),
        eq(members.wallet, input.wallet),
        ne(members.telegramUserId, input.telegramUserId),
      ),
    );
  if (holder) return "wallet_taken"; // D2: no takeover

  const [existing] = await tx
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.communityId, input.communityId),
        eq(members.telegramUserId, input.telegramUserId),
      ),
    )
    .for("update");

  const now = sql`clock_timestamp()`;
  let memberId: string;
  if (existing) {
    memberId = existing.id;
    await tx
      .update(members)
      .set({
        wallet: input.wallet,
        linkMethod: "signature",
        telegramUsername: input.telegramUsername,
        linkedAt: now,
      })
      .where(eq(members.id, existing.id));
    await tx
      .update(memberWalletLinks)
      .set({ validTo: now })
      .where(and(eq(memberWalletLinks.memberId, existing.id), isNull(memberWalletLinks.validTo)));
  } else {
    const [created] = await tx
      .insert(members)
      .values({
        communityId: input.communityId,
        telegramUserId: input.telegramUserId,
        telegramUsername: input.telegramUsername,
        wallet: input.wallet,
        linkMethod: "signature",
      })
      .returning({ id: members.id });
    if (!created) throw new Error("link: member insert returned nothing");
    memberId = created.id;
  }
  // Read after the close above, so the new interval starts at or after the old one ends.
  await tx.insert(memberWalletLinks).values({
    communityId: input.communityId,
    memberId,
    wallet: input.wallet,
    method: "signature",
    proofRequestId: input.proofRequestId,
    validFrom: now,
  });
  return "linked";
}
