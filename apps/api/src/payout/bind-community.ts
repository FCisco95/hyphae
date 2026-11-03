import { communities, type Db, payoutPolicies } from "@hyphae/db";
import { eq } from "drizzle-orm";
import type { SettleChain, SettleCommunity } from "./distribution-settle.js";

// The operator's one step that puts a community under the settle loop (Organic D-44): bind its
// on-chain address, set its first paid epoch and insert its payout policy, in one transaction.
// The chain address is checked with the read the settle loop itself uses, so a binding the loop
// would refuse is refused here first. A community that already has a policy is never rebound:
// changing a live policy is a separate decision, not a rerun of this step.

export interface BindRequest {
  mint: string;
  chainAddress: string;
  // The community's admin key, part of its address: the key the settle loop must publish with.
  admin: string;
  firstPaidEpoch: number;
  policy: {
    effectiveFromIndex: number;
    thresholdVolumeLamports: bigint;
    basis: "cumulative" | "per_epoch";
    rewardBpsOfVolume: number;
    autoPublish: boolean;
  };
}

export type ReadBoundCommunity = SettleChain["readCommunity"];

export type BindRefusal =
  | "no_community"
  | "policy_exists"
  | "bound_elsewhere"
  | "first_paid_epoch_differs"
  | "not_on_chain"
  | "admin_mismatch";

export type BindPlan =
  | { status: "refused"; reason: BindRefusal }
  | {
      status: "ready";
      communityId: string;
      name: string;
      before: { chainAddress: string | null; firstPaidEpoch: number | null };
      onChain: SettleCommunity;
    };

export type BindOutcome =
  | { status: "refused"; reason: BindRefusal }
  | { status: "bound"; communityId: string; policyId: string };

const refused = (reason: BindRefusal) => ({ status: "refused" as const, reason });

// The database's side of the checks; run again under the community row lock by applyBind.
async function databaseRefusal(
  db: Db,
  request: BindRequest,
  forUpdate: boolean,
): Promise<
  | { status: "refused"; reason: BindRefusal }
  | {
      status: "ok";
      community: {
        id: string;
        name: string;
        chainAddress: string | null;
        firstPaidEpoch: number | null;
      };
    }
> {
  const query = db
    .select({
      id: communities.id,
      name: communities.name,
      chainAddress: communities.chainAddress,
      firstPaidEpoch: communities.firstPaidEpoch,
    })
    .from(communities)
    .where(eq(communities.mint, request.mint));
  const [community] = forUpdate ? await query.for("update") : await query;
  if (!community) return refused("no_community");
  const [policy] = await db
    .select({ id: payoutPolicies.id })
    .from(payoutPolicies)
    .where(eq(payoutPolicies.communityId, community.id))
    .limit(1);
  if (policy) return refused("policy_exists");
  if (community.chainAddress !== null && community.chainAddress !== request.chainAddress) {
    return refused("bound_elsewhere");
  }
  if (community.firstPaidEpoch !== null && community.firstPaidEpoch !== request.firstPaidEpoch) {
    return refused("first_paid_epoch_differs");
  }
  return { status: "ok", community };
}

export async function planBind(
  db: Db,
  read: ReadBoundCommunity,
  request: BindRequest,
): Promise<BindPlan> {
  const checked = await databaseRefusal(db, request, false);
  if (checked.status === "refused") return checked;
  const onChain = await read({ mint: request.mint, address: request.chainAddress });
  if (onChain === null || onChain.address !== request.chainAddress) return refused("not_on_chain");
  if (onChain.admin !== request.admin) return refused("admin_mismatch");
  const { community } = checked;
  return {
    status: "ready",
    communityId: community.id,
    name: community.name,
    before: { chainAddress: community.chainAddress, firstPaidEpoch: community.firstPaidEpoch },
    onChain,
  };
}

export async function applyBind(
  db: Db,
  read: ReadBoundCommunity,
  request: BindRequest,
): Promise<BindOutcome> {
  const plan = await planBind(db, read, request);
  if (plan.status === "refused") return plan;
  return db.transaction(async (tx) => {
    // Under the lock, so two binds of one community cannot both pass the policy check.
    const checked = await databaseRefusal(tx, request, true);
    if (checked.status === "refused") return checked;
    if (checked.community.id !== plan.communityId) throw new Error("bind: the community changed");
    await tx
      .update(communities)
      .set({ chainAddress: request.chainAddress, firstPaidEpoch: request.firstPaidEpoch })
      .where(eq(communities.id, plan.communityId));
    const [policy] = await tx
      .insert(payoutPolicies)
      .values({ communityId: plan.communityId, ...request.policy })
      .returning({ id: payoutPolicies.id });
    if (!policy) throw new Error("bind: the policy insert returned no row");
    return { status: "bound" as const, communityId: plan.communityId, policyId: policy.id };
  });
}

// Exactly what the apply writes, for the operator to read before running it.
export function describeBind(plan: Extract<BindPlan, { status: "ready" }>, request: BindRequest) {
  const p = request.policy;
  const c = plan.onChain;
  return [
    `community ${plan.communityId} (${plan.name}), mint ${request.mint}`,
    `on chain: ${c.address}, admin ${c.admin}, fee recipient ${c.feeRecipient}`,
    `vault holds ${c.vaultLamports} lamports: rent ${c.rentExemptMinimum}, allocated and unclaimed ${c.outstandingLamports}`,
    "in one transaction:",
    `  update communities set chain_address = '${request.chainAddress}', first_paid_epoch = ${request.firstPaidEpoch} where id = '${plan.communityId}'`,
    `    (now chain_address ${plan.before.chainAddress ?? "null"}, first_paid_epoch ${plan.before.firstPaidEpoch ?? "null"})`,
    `  insert into payout_policies: community_id ${plan.communityId}, effective_from_index ${p.effectiveFromIndex}, threshold_volume_lamports ${p.thresholdVolumeLamports}, basis ${p.basis}, reward_bps_of_volume ${p.rewardBpsOfVolume}, auto_publish ${p.autoPublish}`,
  ];
}
