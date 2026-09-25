import {
  communities,
  type Db,
  epochs,
  holdChecks,
  rewardConfigs,
  rewardDecisions,
  rewardEpochSnapshots,
  rewardSnapshotEntries,
  rewardSnapshotMembers,
} from "@hyphae/db";
import { and, eq, sql } from "drizzle-orm";
import { walletAt } from "../link/wallet-links.js";
import { isoUs, readOnly } from "../pg.js";
import { RewardConfigPayload } from "../rewards/config.js";
import { selectEffective } from "../rewards/effective.js";
import { passesBefore, type RulesTest, rulesTestFor } from "./rules-test.js";

// The payout gate (docs/handoffs/2026-09-26-rules-test-scope-proposal.md): whether a closed epoch
// may be allocated, and who is payable (P9). It fails closed: anything it cannot decide blocks.
export type Blocker =
  | "legacy_epoch"
  | "already_published"
  | "not_final"
  | "before_first_paid_epoch"
  | "no_rules_test_defined"
  | "snapshot_mismatch"
  | "duplicate_wallet"
  | "hold_checks_pending"
  | "no_payable_members";

export type MemberReason =
  | "no_points"
  | "no_verified_wallet"
  | "no_rules_test"
  | "below_hold"
  | "hold_pending";

// A hold result the gate applied: decided, for this wallet, mint and pinned threshold, and read in
// the window.
export interface AppliedHold {
  check: typeof holdChecks.$inferSelect & { status: "holder" | "below" };
  observedAt: string;
}

export interface MemberVerdict {
  memberId: string;
  pointUnits: string;
  wholePoints: string;
  // walletAt(closes_at) when it is signed, the only wallet a payout may use (D3).
  wallet: string | null;
  // held: every other condition holds and the hold result is not confirmed yet.
  status: "payable" | "not_payable" | "held";
  reasons: MemberReason[];
  // The evidence behind the verdict, which publication commits as it is: the pass that counted
  // and the hold result applied, times in A3's microsecond form.
  rulesTestPassedAt: string | null;
  holdResult: AppliedHold | null;
}

// P9 asks for the balance "when the snapshot is taken". No RPC reads a past balance, so a result
// counts only if it was read within this window after closes_at; later reads cannot count.
export const HOLD_WINDOW_MS = 24 * 3_600_000;

// thresholdRaw 0n: the pinned rubric sets no hold condition.
export interface HoldRequirement {
  mint: string;
  thresholdRaw: bigint;
}

interface GateBase {
  epochIndex: number;
  closesAt: Date;
  // In member id order.
  members: MemberVerdict[];
}

// The frozen snapshot a ready verdict was judged on, times in A3's microsecond form.
export interface JudgedSnapshot {
  opensAt: string;
  closesAt: string;
  closedAt: string;
  cutoffAssumption: string;
  entries: SnapshotEntry[];
}

export type PayoutGate =
  | (GateBase & {
      status: "ready";
      testId: string;
      hold: HoldRequirement;
      payable: number;
      snapshot: JudgedSnapshot;
    })
  | (GateBase & {
      status: "blocked";
      blockers: Blocker[];
      testId: string | null;
      hold: HoldRequirement | null;
    });

type Epoch = typeof epochs.$inferSelect;
type Snapshot = typeof rewardEpochSnapshots.$inferSelect;
type SnapshotEntry = typeof rewardSnapshotEntries.$inferSelect;
type SnapshotMember = typeof rewardSnapshotMembers.$inferSelect;

// The frozen snapshot must still be the O6 selection at closes_at: every decision accepted before
// the close is the one it selected, and nothing accepted later claims to change the allocation.
async function consistentSnapshot(
  tx: Db,
  epoch: Epoch,
  snapshot: Snapshot,
): Promise<{ entries: SnapshotEntry[]; totals: SnapshotMember[] } | null> {
  if (snapshot.closesAt.getTime() !== epoch.closesAt.getTime()) return null;
  const entries = await tx
    .select()
    .from(rewardSnapshotEntries)
    .where(eq(rewardSnapshotEntries.snapshotId, snapshot.id));
  const totals = await tx
    .select()
    .from(rewardSnapshotMembers)
    .where(eq(rewardSnapshotMembers.snapshotId, snapshot.id));
  const selection = await selectEffective(tx, epoch.id, epoch.closesAt);

  if (entries.length !== selection.entries.length) return null;
  const entryOf = new Map(entries.map((e) => [e.contributionId, e]));
  for (const s of selection.entries) {
    const e = entryOf.get(s.contributionId);
    if (!e || e.memberId !== s.memberId) return null;
    if (s.state === "scored") {
      if (
        e.decisionId !== s.decisionId ||
        e.revision !== s.revision ||
        e.pointUnits !== BigInt(s.pointUnits)
      ) {
        return null;
      }
    } else if (e.decisionId !== null || e.pointUnits !== 0n || e.reason === null) {
      return null;
    } else if (e.reason === "excluded" && s.state !== "late") {
      return null;
    }
  }

  if (totals.length !== selection.totals.length) return null;
  const totalOf = new Map(selection.totals.map((m) => [m.memberId, m]));
  for (const m of totals) {
    const s = totalOf.get(m.memberId);
    if (!s || m.pointUnits !== BigInt(s.pointUnits) || m.wholePoints !== BigInt(s.wholePoints)) {
      return null;
    }
  }

  const [misflagged] = await tx
    .select({ id: rewardDecisions.id })
    .from(rewardDecisions)
    .innerJoin(epochs, eq(epochs.id, rewardDecisions.epochId))
    .where(
      and(
        eq(rewardDecisions.epochId, epoch.id),
        sql`${rewardDecisions.affectsAllocation} <> (${rewardDecisions.acceptedAt} < ${epochs.closesAt})`,
      ),
    )
    .limit(1);
  if (misflagged) return null;

  totals.sort((a, b) => (a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0));
  return { entries, totals };
}

// Read-only and lock-free: the snapshot is frozen, and passes and hold results only move forward.
export async function evaluatePayoutGate(
  db: Db,
  ref: { communityId: string; epochId: string },
  deps: { tests?: readonly RulesTest[] } = {},
): Promise<PayoutGate> {
  return readOnly(db, (tx) => payoutGateIn(tx, ref, deps));
}

// The gate inside the caller's transaction: publication builds from the same snapshot it judged.
export async function payoutGateIn(
  tx: Db,
  ref: { communityId: string; epochId: string },
  deps: { tests?: readonly RulesTest[] } = {},
): Promise<PayoutGate> {
  const [row] = await tx
    .select({
      epoch: epochs,
      community: communities,
      opensAt: isoUs(epochs.opensAt),
      closesAt: isoUs(epochs.closesAt),
    })
    .from(epochs)
    .innerJoin(communities, eq(communities.id, epochs.communityId))
    .where(and(eq(epochs.id, ref.epochId), eq(epochs.communityId, ref.communityId)));
  if (!row) {
    throw new Error(`payout: epoch ${ref.epochId} is not in community ${ref.communityId}`);
  }
  const { epoch, community } = row;
  const blocked = (
    blockers: Blocker[],
    found: { testId?: string; hold?: HoldRequirement } = {},
    members: MemberVerdict[] = [],
  ): PayoutGate => ({
    status: "blocked",
    epochIndex: epoch.index,
    closesAt: epoch.closesAt,
    blockers,
    testId: found.testId ?? null,
    hold: found.hold ?? null,
    members,
  });

  if (!epoch.rewardConfigId) return blocked(["legacy_epoch"]);
  const [config] = await tx
    .select({ payload: rewardConfigs.payload })
    .from(rewardConfigs)
    .where(eq(rewardConfigs.id, epoch.rewardConfigId));
  const payload = RewardConfigPayload.safeParse(config?.payload);
  if (!payload.success) return blocked(["legacy_epoch"]);
  const hold = { mint: community.mint, thresholdRaw: BigInt(payload.data.rubric.minHoldUnits) };

  if (epoch.status === "published" || epoch.root !== null) {
    return blocked(["already_published"], { hold });
  }
  const [frozen] = await tx
    .select({ snapshot: rewardEpochSnapshots, closedAt: isoUs(rewardEpochSnapshots.closedAt) })
    .from(rewardEpochSnapshots)
    .where(eq(rewardEpochSnapshots.epochId, epoch.id));
  if (!frozen || epoch.status !== "closed") return blocked(["not_final"], { hold });
  if (community.firstPaidEpoch === null || epoch.index < community.firstPaidEpoch) {
    return blocked(["before_first_paid_epoch"], { hold });
  }
  const test = rulesTestFor(payload.data.rubric, deps.tests);
  if (!test) return blocked(["no_rules_test_defined"], { hold });
  const found = { testId: test.id, hold };
  const judged = await consistentSnapshot(tx, epoch, frozen.snapshot);
  if (!judged) return blocked(["snapshot_mismatch"], found);

  const passed = await passesBefore(tx, {
    memberIds: judged.totals.map((m) => m.memberId),
    testId: test.id,
    before: epoch.closesAt,
  });
  const holdOf = new Map(
    (
      await tx
        .select({ check: holdChecks, observedAt: isoUs(holdChecks.observedAt) })
        .from(holdChecks)
        .where(eq(holdChecks.epochId, epoch.id))
    ).map((h) => [h.check.memberId, h]),
  );

  const members: MemberVerdict[] = [];
  for (const m of judged.totals) {
    const reasons: MemberReason[] = [];
    if (m.pointUnits <= 0n) reasons.push("no_points");
    const link = await walletAt(tx, m.memberId, epoch.closesAt);
    const wallet = link?.method === "signature" ? link.wallet : null;
    if (!wallet) reasons.push("no_verified_wallet");
    const rulesTestPassedAt = passed.get(m.memberId) ?? null;
    if (rulesTestPassedAt === null) reasons.push("no_rules_test");
    // The balance matters only for a member who is otherwise payable (P16's candidates), and
    // only a decided result for exactly this wallet, mint and pinned threshold, read in the
    // window, counts.
    let applied: AppliedHold | null = null;
    if (reasons.length === 0 && hold.thresholdRaw > 0n) {
      const h = holdOf.get(m.memberId);
      const read = h?.check.observedAt?.getTime();
      if (
        h !== undefined &&
        (h.check.status === "holder" || h.check.status === "below") &&
        h.check.wallet === wallet &&
        h.check.mint === hold.mint &&
        BigInt(h.check.thresholdRaw) === hold.thresholdRaw &&
        read !== undefined &&
        read >= epoch.closesAt.getTime() &&
        read <= epoch.closesAt.getTime() + HOLD_WINDOW_MS
      ) {
        applied = h as AppliedHold;
      }
      if (applied?.check.status === "below") reasons.push("below_hold");
      else if (!applied) reasons.push("hold_pending");
    }
    members.push({
      memberId: m.memberId,
      pointUnits: m.pointUnits.toString(),
      wholePoints: m.wholePoints.toString(),
      wallet,
      status:
        reasons.length === 0
          ? "payable"
          : reasons.length === 1 && reasons[0] === "hold_pending"
            ? "held"
            : "not_payable",
      reasons,
      rulesTestPassedAt,
      holdResult: applied,
    });
  }

  const payable = members.filter((m) => m.status === "payable");
  const held = members.some((m) => m.status === "held");
  const blockers: Blocker[] = [];
  if (new Set(payable.map((m) => m.wallet)).size !== payable.length) {
    blockers.push("duplicate_wallet");
  }
  if (held) blockers.push("hold_checks_pending");
  else if (payable.length === 0) blockers.push("no_payable_members");
  if (blockers.length > 0) return blocked(blockers, found, members);
  return {
    status: "ready",
    epochIndex: epoch.index,
    closesAt: epoch.closesAt,
    ...found,
    members,
    payable: payable.length,
    snapshot: {
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      closedAt: frozen.closedAt,
      cutoffAssumption: frozen.snapshot.cutoffAssumption,
      entries: judged.entries,
    },
  };
}
