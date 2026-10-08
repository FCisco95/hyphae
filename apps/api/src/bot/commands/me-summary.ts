import { exactPoints, type PayoutV1 } from "@hyphae/core";
import {
  communities,
  contributions,
  type Db,
  epochs,
  members,
  rewardEpochSnapshots,
  scoringRuns,
} from "@hyphae/db";
import { and, desc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { epochPayouts, nextStep, type PayoutStep } from "../../payout/readiness.js";
import { readOnly } from "../../pg.js";
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

type Reason = Extract<PayoutV1, { reasons: unknown }>["reasons"][number];
const MISSED: [Reason, string][] = [
  ["no_verified_wallet", "no wallet was signed by the close"],
  ["no_rules_test", "the rules test was not passed by the close"],
  ["no_points", "no points"],
];

// The /me payout checklist: the payout gate's status for this member, three checks and the one
// next step, or after the close why it does not pay. Before the close the hold is never shown as
// met: it is read once after the close.
export function payoutChecklist(c: {
  epochIndex: number;
  closed: boolean;
  payout: PayoutV1;
  // The signed wallet the verdict used: the link valid at the close, the current one while open.
  wallet: string | null;
  // The member's link now, read with the verdict.
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
  const has = (r: Reason) => p.reasons.includes(r);
  const link = c.member.wallet;
  const pasted = !c.closed && c.member.linkMethod === "paste" ? link : null;
  const wallet = !has("no_verified_wallet")
    ? `✅ Wallet: ${c.wallet ? `${short(c.wallet)}, ` : ""}signed`
    : pasted
      ? `❌ Wallet: ${short(pasted)} is pasted, not signed`
      : `❌ Wallet: none signed ${c.closed ? "by the close" : "yet"}`;
  // A wallet linked after the close is not the one this epoch pays.
  const current =
    link && link !== c.wallet && !pasted
      ? [
          `Current link: ${short(link)}, ${c.member.linkMethod === "signature" ? "signed" : "pasted"}`,
        ]
      : [];
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
    not_checked:
      has("no_verified_wallet") || has("no_rules_test")
        ? "➖ Hold: not checked, since the wallet or rules test was missing"
        : "➖ Hold: not checked, since there were no points",
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
  const verdict =
    !c.closed || p.status !== "not_payable"
      ? []
      : has("below_hold")
        ? ["Not payable: the wallet held less than the minimum after the close."]
        : [
            `Not payable: ${MISSED.filter(([r]) => has(r))
              .map(([, why]) => why)
              .join("; ")}.`,
          ];
  return {
    lines: [
      `To be paid for epoch ${c.epochIndex}${c.closed ? " (closed)" : ""}:`,
      wallet,
      ...current,
      rules,
      hold,
      ...next,
      ...verdict,
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
): Promise<Parameters<typeof payoutChecklist>[0] | null> {
  // One snapshot, its clock read first: a relink committing meanwhile cannot pair the verdict on
  // one link with another link.
  const read = await readOnly(db, async (tx) => {
    const now = await (deps.clock ?? dbClock)(tx, input.communityId);
    const epoch = await openedEpoch(tx, input.communityId, now);
    const [community] = await tx
      .select({ mint: communities.mint, firstPaidEpoch: communities.firstPaidEpoch })
      .from(communities)
      .where(eq(communities.id, input.communityId));
    if (!epoch || !community) return null;
    const [member] = await tx
      .select({ wallet: members.wallet, linkMethod: members.linkMethod })
      .from(members)
      .where(eq(members.id, input.memberId));
    if (!member) throw new Error(`me: member ${input.memberId} missing`);
    const [snapshot] = await tx
      .select({ id: rewardEpochSnapshots.id })
      .from(rewardEpochSnapshots)
      .where(eq(rewardEpochSnapshots.epochId, epoch.id));
    const closed = now.getTime() >= epoch.closesAt.getTime();
    const r = await epochPayouts(tx, {
      community,
      epoch,
      snapshotId: snapshot?.id ?? null,
      closed,
      memberIds: [input.memberId],
    });
    const payout = r.members.get(input.memberId);
    if (!payout) throw new Error(`me: member ${input.memberId} has no payout status`);
    const wallet = r.wallets.get(input.memberId) ?? null;
    return { epochIndex: epoch.index, mint: community.mint, closed, payout, wallet, member, r };
  });
  if (!read) return null;
  const { mint, r, ...status } = read;
  const decimals = r.hold.thresholdRaw > 0n ? await deps.decimals(mint) : undefined;
  return {
    ...status,
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
