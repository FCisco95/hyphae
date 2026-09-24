import { POINT_UNITS_PER_POINT } from "@hyphae/core";
import { contributions, type Db, epochs, scoringRuns } from "@hyphae/db";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { dbClock, type RewardDeps } from "../../rewards/config.js";
import { effectiveResults } from "../../rewards/effective.js";

const DECIMALS = POINT_UNITS_PER_POINT.toString().length - 1;

export function formatPointUnits(units: bigint): string {
  const whole = units / POINT_UNITS_PER_POINT;
  const fraction = (units % POINT_UNITS_PER_POINT).toString().padStart(DECIMALS, "0");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

const utc = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;

// The /me body: the most recently opened epoch only, through the O6 effective read. A community
// without reward epochs gets its legacy scored count and no points, which legacy runs can't give.
export async function meSummary(
  db: Db,
  input: { communityId: string; memberId: string },
  deps: RewardDeps = {},
): Promise<string[]> {
  const [any] = await db
    .select({ id: epochs.id })
    .from(epochs)
    .where(eq(epochs.communityId, input.communityId))
    .limit(1);
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
    .where(and(eq(epochs.communityId, input.communityId), lte(epochs.opensAt, now)))
    .orderBy(desc(epochs.index))
    .limit(1);
  if (!epoch) return ["No reward epoch has opened yet."];

  const r = await effectiveResults(
    db,
    { communityId: input.communityId, epochId: epoch.id, memberId: input.memberId },
    deps,
  );
  const count = (state: string) => r.entries.filter((e) => e.state === state).length;
  const open = [
    [count("pending"), "pending"],
    [count("late"), "late"],
  ]
    .filter(([n]) => n)
    .map(([n, label]) => `${n} ${label}`);
  const total = r.totals[0] ?? { pointUnits: "0", wholePoints: "0" };
  return [
    r.closed
      ? `Epoch ${epoch.index} closed at ${utc(r.closesAt)}; these points no longer change.`
      : `Epoch ${epoch.index}, open until ${utc(r.closesAt)}`,
    `Entries: ${r.totalEntries}${open.length ? ` (${open.join(", ")})` : ""}`,
    `Points: ${formatPointUnits(BigInt(total.pointUnits))} (${total.wholePoints} whole)`,
  ];
}
