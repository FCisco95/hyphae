import { type Db, memberWalletLinks } from "@hyphae/db";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";

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
