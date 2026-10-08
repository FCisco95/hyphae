import type { PayoutV1, PayoutVerdictV1 } from "@hyphae/core";
import {
  type communities,
  type Db,
  type epochs,
  rewardConfigs,
  rewardSnapshotMembers,
} from "@hyphae/db";
import { and, eq, inArray } from "drizzle-orm";
import { RewardConfigPayload } from "../rewards/config.js";
import { selectEffective } from "../rewards/effective.js";
import { type HoldRequirement, judgeMembers, type MemberVerdict, payTerms } from "./gate.js";
import type { RulesTest } from "./rules-test.js";

// What the gate did with the balance: nothing before the close, and after it only for a member
// who meets every other condition.
export function payoutOf(
  v: Pick<MemberVerdict, "status" | "reasons" | "holdResult">,
  o: { closed: boolean; holdRequired: boolean },
): PayoutVerdictV1 {
  if (!o.holdRequired) return { status: v.status, reasons: [...v.reasons], hold: "not_required" };
  if (!o.closed) {
    // A read judged as of before the close may still see a hold result recorded since: no result
    // counts until the close, so a member who meets every other condition waits for it.
    const reasons = v.reasons.filter((r) => r !== "below_hold" && r !== "hold_pending");
    return reasons.length === 0
      ? { status: "held", reasons: ["hold_pending"], hold: "at_close" }
      : { status: "not_payable", reasons, hold: "at_close" };
  }
  const hold = v.holdResult
    ? v.holdResult.check.status
    : v.reasons.includes("hold_pending")
      ? "pending"
      : "not_checked";
  return { status: v.status, reasons: [...v.reasons], hold };
}

export interface EpochPayouts {
  hold: HoldRequirement;
  // The pinned rubric's community, which names its token ("MYCEL").
  token: string;
  members: Map<string, PayoutV1>;
}

// The payout status of each named member in one epoch, judged by the gate's own terms and member
// stage: on the frozen totals once the snapshot exists, before that on the totals close would
// freeze. `closed`: the epoch's closes_at has passed.
export async function epochPayouts(
  tx: Db,
  input: {
    community: Pick<typeof communities.$inferSelect, "mint" | "firstPaidEpoch">;
    epoch: typeof epochs.$inferSelect;
    snapshotId: string | null;
    closed: boolean;
    memberIds: string[];
  },
  deps: { tests?: readonly RulesTest[] } = {},
): Promise<EpochPayouts> {
  const { epoch } = input;
  const [config] = await tx
    .select({ payload: rewardConfigs.payload })
    .from(rewardConfigs)
    .where(eq(rewardConfigs.id, epoch.rewardConfigId ?? ""));
  if (!config) throw new Error(`payout: config of epoch ${epoch.id} missing`);
  const { rubric } = RewardConfigPayload.parse(config.payload);
  const terms = payTerms(epoch, input.community, rubric, deps.tests);
  const memberIds = [...new Set(input.memberIds)];
  const all = (payout: PayoutV1) => new Map(memberIds.map((m) => [m, payout]));
  const base = { hold: terms.hold, token: rubric.community };
  if (terms.published) return { ...base, members: all({ status: "published" }) };
  if (!terms.paidEpoch || !terms.test) {
    return { ...base, members: all({ status: "unpaid_epoch" }) };
  }
  if (memberIds.length === 0) return { ...base, members: new Map() };

  const units = new Map<string, { pointUnits: bigint; wholePoints: bigint }>();
  if (input.snapshotId) {
    const rows = await tx
      .select({
        memberId: rewardSnapshotMembers.memberId,
        pointUnits: rewardSnapshotMembers.pointUnits,
        wholePoints: rewardSnapshotMembers.wholePoints,
      })
      .from(rewardSnapshotMembers)
      .where(
        and(
          eq(rewardSnapshotMembers.snapshotId, input.snapshotId),
          inArray(rewardSnapshotMembers.memberId, memberIds),
        ),
      );
    for (const r of rows) units.set(r.memberId, r);
  } else {
    const { totals } = await selectEffective(tx, epoch.id, epoch.closesAt);
    for (const t of totals) {
      units.set(t.memberId, {
        pointUnits: BigInt(t.pointUnits),
        wholePoints: BigInt(t.wholePoints),
      });
    }
  }
  const verdicts = await judgeMembers(tx, {
    epoch,
    totals: memberIds.map((memberId) => ({
      memberId,
      ...(units.get(memberId) ?? { pointUnits: 0n, wholePoints: 0n }),
    })),
    testId: terms.test.id,
    hold: terms.hold,
  });
  const holdRequired = terms.hold.thresholdRaw > 0n;
  return {
    ...base,
    members: new Map(
      verdicts.map((v) => [v.memberId, payoutOf(v, { closed: input.closed, holdRequired })]),
    ),
  };
}

export type PayoutStep = "wallet" | "rules";

// The one thing a member can do now towards being paid, in the order setup asks for them.
export function nextStep(p: PayoutV1 | undefined): PayoutStep | null {
  if (!p || !("reasons" in p)) return null;
  if (p.reasons.includes("no_verified_wallet")) return "wallet";
  if (p.reasons.includes("no_rules_test")) return "rules";
  return null;
}
