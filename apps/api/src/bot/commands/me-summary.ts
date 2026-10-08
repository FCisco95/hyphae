import { exactPoints, type PayoutV1 } from "@hyphae/core";
import {
  communities,
  contributions,
  type Db,
  epochs,
  rewardEpochSnapshots,
  scoringRuns,
} from "@hyphae/db";
import { and, desc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { epochPayouts, nextStep, type PayoutStep } from "../../payout/readiness.js";
import { dbClock, type RewardDeps } from "../../rewards/config.js";
import { effectiveResults } from "../../rewards/effective.js";
import { formatTokens } from "./setup-content.js";

// Only a signed wallet is payable (D1); a pasted one keeps scoring but is marked, and a member
// without a wallet earns points that pay only once a wallet is signed before the close.
export function walletLines(member: {
  wallet: string | null;
  linkMethod: "paste" | "signature" | null;
}): string[] {
  if (member.wallet === null)
    return [
      "No wallet yet. Your replies still earn points; to be paid, link a wallet by signing before the epoch closes: send /link.",
    ];
  const short = `Wallet ${member.wallet.slice(0, 4)}…${member.wallet.slice(-4)}`;
  return member.linkMethod === "signature"
    ? [`${short} (verified)`]
    : [short, "Wallet not verified. Send /link to verify it (needed before any payout)."];
}

const short = (wallet: string) => `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;

// The /me payout checklist: the payout gate's status for this member, three checks and the one
// next step. Before the close the hold is never shown as met: it is read once after the close.
export function payoutChecklist(c: {
  epochIndex: number;
  closed: boolean;
  payout: PayoutV1;
  member: { wallet: string | null; linkMethod: "paste" | "signature" | null };
  // The pinned minimum with its unit ("100,000 MYCEL"), or null when it cannot be read.
  holdMin: string | null;
}): { lines: string[]; step: PayoutStep | null } {
  const p = c.payout;
  if (!("reasons" in p)) {
    return {
      lines: [
        ...walletLines(c.member),
        p.status === "unpaid_epoch"
          ? `Epoch ${c.epochIndex} has no payout.`
          : `Epoch ${c.epochIndex} is published. Its settlement on the site shows each payout.`,
      ],
      step: null,
    };
  }
  const has = (r: (typeof p.reasons)[number]) => p.reasons.includes(r);
  const wallet = !has("no_verified_wallet")
    ? `✅ Wallet: ${c.member.wallet ? `${short(c.member.wallet)}, ` : ""}signed`
    : c.member.wallet && c.member.linkMethod === "paste" && !c.closed
      ? `❌ Wallet: ${short(c.member.wallet)} is pasted, not signed`
      : `❌ Wallet: none signed ${c.closed ? "by the close" : "yet"}`;
  const rules = has("no_rules_test")
    ? `❌ Rules test: not passed ${c.closed ? "by the close" : "yet"}`
    : "✅ Rules test: passed";
  const min = c.holdMin ? `at least ${c.holdMin}` : "the minimum balance set in the rules";
  const hold = {
    not_required: "✅ Hold: none required",
    at_close: `⏳ Hold: read once after the close; needs ${min} in that wallet`,
    pending: "⏳ Hold: being checked",
    holder: "✅ Hold: confirmed",
    below: `❌ Hold: under ${c.holdMin ?? "the minimum"} after the close`,
    not_checked: "➖ Hold: not checked, since the wallet or rules test was missing",
  }[p.hold];
  const step = c.closed ? null : nextStep(p);
  const next = c.closed
    ? []
    : step === "wallet"
      ? ["Next: link a wallet by signing. It is free and moves no funds."]
      : step === "rules"
        ? ["Next: take the rules test. Every answer must be right."]
        : has("no_points")
          ? ["Next: earn points by replying to a raid."]
          : ["Nothing else to do now."];
  return {
    lines: [
      `To be paid for epoch ${c.epochIndex}${c.closed ? " (closed)" : ""}:`,
      wallet,
      rules,
      hold,
      ...next,
    ],
    step,
  };
}

const utc = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;

// The most recently opened reward epoch, the one /me reports on. Unpinned legacy epochs never
// admit reward intake, so they don't count.
async function openedEpoch(db: Db, communityId: string, now: Date) {
  const [epoch] = await db
    .select()
    .from(epochs)
    .where(
      and(
        eq(epochs.communityId, communityId),
        isNotNull(epochs.rewardConfigId),
        lte(epochs.opensAt, now),
      ),
    )
    .orderBy(desc(epochs.index))
    .limit(1);
  return epoch;
}

// What payoutChecklist needs for the epoch /me reports on; null when no reward epoch has opened.
export async function mePayout(
  db: Db,
  input: { communityId: string; memberId: string },
  deps: RewardDeps & { decimals: (mint: string) => Promise<number | undefined> },
): Promise<Omit<Parameters<typeof payoutChecklist>[0], "member"> | null> {
  const now = await (deps.clock ?? dbClock)(db, input.communityId);
  const epoch = await openedEpoch(db, input.communityId, now);
  const [community] = await db
    .select({ mint: communities.mint, firstPaidEpoch: communities.firstPaidEpoch })
    .from(communities)
    .where(eq(communities.id, input.communityId));
  if (!epoch || !community) return null;
  const [snapshot] = await db
    .select({ id: rewardEpochSnapshots.id })
    .from(rewardEpochSnapshots)
    .where(eq(rewardEpochSnapshots.epochId, epoch.id));
  const closed = now.getTime() >= epoch.closesAt.getTime();
  const r = await epochPayouts(db, {
    community,
    epoch,
    snapshotId: snapshot?.id ?? null,
    closed,
    memberIds: [input.memberId],
  });
  const payout = r.members.get(input.memberId);
  if (!payout) throw new Error(`me: member ${input.memberId} has no payout status`);
  const decimals = r.hold.thresholdRaw > 0n ? await deps.decimals(community.mint) : undefined;
  return {
    epochIndex: epoch.index,
    closed,
    payout,
    holdMin:
      decimals === undefined ? null : `${formatTokens(r.hold.thresholdRaw, decimals)} ${r.token}`,
  };
}

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
  const epoch = await openedEpoch(db, input.communityId, now);
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
