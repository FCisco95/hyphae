import { communities, type Db, payoutPolicies } from "@hyphae/db";
import { eq } from "drizzle-orm";
import {
  type DistributionSummary,
  type SettleChain,
  type SettleOutcome,
  settleCommunity,
} from "./distribution-settle.js";
import { communityHold } from "./holds.js";
import type { RulesTest } from "./rules-test.js";

// The operator's one publish command for a community under a payout policy: it plans the next
// epoch's distribution as the settle loop does and, when the volume threshold is met, publishes
// it with the signer the operator holds (a Ledger: one approval on the device, for the one
// transaction). Every refusal below is decided before anything is planned or sent.
export type OperatorRefusal =
  | "community_unknown"
  | "community_held"
  | "no_payout_policy"
  | "community_not_on_chain"
  | "no_signer"
  | "publisher_not_admin";

export type OperatorOutcome =
  | { status: "refused"; reason: OperatorRefusal; detail?: string }
  | SettleOutcome;

export async function operatorPublish(
  db: Db,
  chain: SettleChain,
  input: { mint: string },
  deps: {
    tests?: readonly RulesTest[];
    clock?: () => Date;
    // Shown the distribution's numbers before the send; the Ledger approval follows it.
    beforeSend?: (summary: DistributionSummary) => Promise<void>;
  } = {},
): Promise<OperatorOutcome> {
  const [community] = await db
    .select({ id: communities.id, chainAddress: communities.chainAddress })
    .from(communities)
    .where(eq(communities.mint, input.mint));
  if (!community) return { status: "refused", reason: "community_unknown" };
  const hold = communityHold(input.mint);
  if (hold) return { status: "refused", reason: "community_held", detail: hold.reason };
  const [policy] = await db
    .select({ id: payoutPolicies.id })
    .from(payoutPolicies)
    .where(eq(payoutPolicies.communityId, community.id))
    .limit(1);
  if (!policy) return { status: "refused", reason: "no_payout_policy" };
  if (community.chainAddress === null) {
    return { status: "refused", reason: "community_not_on_chain" };
  }
  if (chain.publisher === null) return { status: "refused", reason: "no_signer" };
  const onChain = await chain.readCommunity({
    mint: input.mint,
    address: community.chainAddress,
  });
  if (onChain === null || onChain.address !== community.chainAddress) {
    return { status: "refused", reason: "community_not_on_chain" };
  }
  if (chain.publisher.address !== onChain.admin) {
    return { status: "refused", reason: "publisher_not_admin" };
  }
  return settleCommunity(
    db,
    chain,
    { communityId: community.id },
    { ...deps, operatorPublish: true },
  );
}
