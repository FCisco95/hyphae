import { exactPoints } from "@hyphae/core";
import { contributions, type Db, epochs, scoringRuns } from "@hyphae/db";
import { and, desc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { dbClock, type RewardDeps } from "../../rewards/config.js";
import { effectiveResults } from "../../rewards/effective.js";

// Only a signed wallet is payable (D1); a pasted one keeps scoring but is marked.
export function walletLines(member: {
  wallet: string;
  linkMethod: "paste" | "signature";
}): string[] {
  const short = `Wallet ${member.wallet.slice(0, 4)}…${member.wallet.slice(-4)}`;
  return member.linkMethod === "signature"
    ? [`${short} (verified)`]
    : [short, "Wallet not verified. Send /link to verify it (needed before any payout)."];
}

const utc = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;

// The /me body: the most recently opened epoch only, through the O6 effective read. A community
// without reward epochs gets its legacy scored count and no points, which legacy runs can't give.
export async function meSummary(
  db: Db,
  input: { communityId: string; memberId: string },
  deps: RewardDeps = {},
): Promise<string[]> {
  // Unpinned legacy epochs never admit reward intake, so they don't count as reward epochs.
  const pinned = and(eq(epochs.communityId, input.communityId), isNotNull(epochs.rewardConfigId));
  const [any] = await db.select({ id: epochs.id }).from(epochs).where(pinned).limit(1);
  if (!any) {
    const [row] = await db
      .select({ count: sql<number>`count(distinct ${scoringRuns.contributionId})::int` })
      .from(scoringRuns)
      .innerJoin(contributions, eq(contributions.id, scoringRuns.contributionId))
      .where(eq(contributions.memberId, input.memberId));
    return [`Scored contributions: ${row?.count ?? 0}`];
  }

  const now = await (deps.clock ?? dbClock)(db, input.communityId);
  const [epoch] = await db
    .select()
    .from(epochs)
    .where(and(pinned, lte(epochs.opensAt, now)))
    .orderBy(desc(epochs.index))
    .limit(1);
  if (!epoch) return ["No reward epoch has opened yet."];

  const r = await effectiveResults(
    db,
    { communityId: input.communityId, epochId: epoch.id, memberId: input.memberId },
    deps,
  );
  // After close, a decision still to come is late too: neither kind can add points.
  const unscored = r.entries.filter((e) => e.state !== "scored").length;
  const unscoredNote = unscored
    ? ` (${unscored} ${r.closed ? "not scored before close" : "pending"})`
    : "";
  const total = r.totals[0] ?? { pointUnits: "0", wholePoints: "0" };
  return [
    r.closed
      ? `Epoch ${epoch.index} closed at ${utc(r.closesAt)}; these points no longer change.`
      : `Epoch ${epoch.index}, open until ${utc(r.closesAt)}`,
    `Entries: ${r.totalEntries}${unscoredNote}`,
    `Points: ${exactPoints(BigInt(total.pointUnits))} (${total.wholePoints} whole)`,
  ];
}
