import type { MemberEpochManifest } from "@hyphae/core";
import {
  communities,
  type Db,
  epochPayoutDecisions,
  epochs,
  leaves,
  payoutPolicies,
} from "@hyphae/db";
import { and, eq, lte, sql } from "drizzle-orm";
import { readOnly } from "../pg.js";
import { backfillEpochCommitments } from "./commitment-store.js";
import { type Blocker, evaluatePayoutGate } from "./gate.js";
import { loadIntent, type PublicationIntent, storeIntent } from "./intent.js";
import { buildPublication } from "./publication.js";
import type { RulesTest } from "./rules-test.js";

// The R6 publish job: a ready epoch's root, audit hash, gross pot and allocated total go on-chain
// through publish_epoch, then its leaves and root are recorded. The exact bytes are stored as the
// epoch's intent before the send, and every later run sends or records those bytes. Nothing in
// the api or worker calls it, and it refuses a community not bound to its on-chain address.

export interface OnChainEpoch {
  root: string;
  auditHash: string;
  grossLamports: bigint;
  allocatedLamports: bigint;
}

export interface OnChainCommunity {
  address: string;
  // P7/P8: fixed at initialization; publish_epoch pays the fee to no other address.
  feeRecipient: string;
}

export interface PublishChain {
  network: MemberEpochManifest["network"];
  programId: string;
  // The community account for this mint and the publishing admin key, once initialized.
  readCommunity(mint: string): Promise<OnChainCommunity | null>;
  readEpoch(community: string, index: bigint): Promise<OnChainEpoch | null>;
  publishEpoch(input: PublishArgs): Promise<string>;
  // For an epoch found already on-chain: the transaction whose publish_epoch created its account
  // with exactly these commitments.
  publishSignature(input: PublishArgs): Promise<string>;
}

export interface PublishArgs {
  community: string;
  index: bigint;
  root: string;
  auditHash: string;
  grossLamports: bigint;
  allocatedLamports: bigint;
  feeRecipient: string;
}

export type PublishOutcome =
  | { status: "refused"; reason: RefusalReason }
  | { status: "blocked"; blockers: Blocker[] }
  | {
      status: "published";
      signature: string;
      root: string;
      auditHash: string;
      leaves: number;
      // The epoch was already on-chain (a run that stopped after sending); nothing was sent.
      recovered: boolean;
    };

// policy_managed: the settle loop owns the epoch (a payout policy is in force for its index, or
// it has a payout decision); a manual publish would pay it again under another index, or strand
// the stored distribution (review 2026-11-03, P1). The worker publishes such an epoch.
export type RefusalReason = "community_not_on_chain" | "policy_managed";

export type PlanOutcome =
  | { status: "refused"; reason: RefusalReason }
  | { status: "blocked"; blockers: Blocker[] }
  | {
      status: "planned";
      intent: PublicationIntent;
      // The on-chain community account and epoch index the intent is published under.
      community: string;
      index: bigint;
      // The epoch account, when a run already sent it.
      onChain: OnChainEpoch | null;
    };

type PublishInput = { communityId: string; epochId: string; grossLamports: bigint };

// Whether the settle loop owns the epoch: a payout policy in force at its index, or a decision
// already recorded for it. A community without a policy is untouched by this check. Before
// migration 0023 is applied neither table exists, which means no community is managed yet, and
// the operator's publish proceeds as it did before this check. The two tables are probed by name
// in the same transaction as the checks: both absent is pre-0023, one absent is a partly applied
// migration and stops the publish, and with both present every error of the checks propagates
// (review of 2443d22: a blanket missing-relation fallback also covered a wrong table or schema).
async function policyManaged(db: Db, ref: { communityId: string; epochId: string }) {
  return readOnly(db, async (tx) => {
    const [epoch] = await tx
      .select({
        index: epochs.index,
        policies: sql<string | null>`to_regclass('public.payout_policies')::text`,
        decisions: sql<string | null>`to_regclass('public.epoch_payout_decisions')::text`,
      })
      .from(epochs)
      .where(and(eq(epochs.id, ref.epochId), eq(epochs.communityId, ref.communityId)));
    // A missing epoch is reported by the gate, as before.
    if (!epoch) return false;
    const hasPolicies = epoch.policies !== null;
    const hasDecisions = epoch.decisions !== null;
    if (!hasPolicies && !hasDecisions) return false;
    if (hasPolicies !== hasDecisions) {
      throw new Error(
        "publish: migration 0023 is partly applied (one of payout_policies and epoch_payout_decisions is missing); apply it fully before publishing",
      );
    }
    const [policy] = await tx
      .select({ id: payoutPolicies.id })
      .from(payoutPolicies)
      .where(
        and(
          eq(payoutPolicies.communityId, ref.communityId),
          lte(payoutPolicies.effectiveFromIndex, epoch.index),
        ),
      )
      .limit(1);
    if (policy) return true;
    const [decision] = await tx
      .select({ id: epochPayoutDecisions.id })
      .from(epochPayoutDecisions)
      .where(eq(epochPayoutDecisions.epochId, ref.epochId))
      .limit(1);
    return decision !== undefined;
  });
}

// Everything before the send: the gate, then the stored intent, or a rebuild stored as the intent.
// The operator's plan step runs this alone and shows the result before anything is signed.
export async function planPublication(
  db: Db,
  chain: PublishChain,
  input: PublishInput,
  deps: { tests?: readonly RulesTest[] } = {},
): Promise<PlanOutcome> {
  const [community] = await db
    .select({ mint: communities.mint, chainAddress: communities.chainAddress })
    .from(communities)
    .where(eq(communities.id, input.communityId));
  if (!community) throw new Error(`publish: no community ${input.communityId}`);
  if (await policyManaged(db, input)) return { status: "refused", reason: "policy_managed" };
  // The operator binds a community to its initialized on-chain account; until then nothing is
  // published. The fee recipient comes from that account, so the audit commits the one it pays.
  const onChain = await chain.readCommunity(community.mint);
  if (onChain === null || community.chainAddress !== onChain.address) {
    return { status: "refused", reason: "community_not_on_chain" };
  }

  const ref = { communityId: input.communityId, epochId: input.epochId };
  const gate = await evaluatePayoutGate(db, ref, deps);
  if (gate.status !== "ready") return { status: "blocked", blockers: gate.blockers };

  // A stored intent is only ever sent or recorded as stored, and only where it was made for.
  const stored = await loadIntent(db, input.epochId);
  if (stored) {
    const s = stored.audit.settlement;
    if (
      stored.audit.network !== chain.network ||
      stored.audit.program_id !== chain.programId ||
      stored.communityAddress !== onChain.address ||
      s.fee_recipient !== onChain.feeRecipient ||
      BigInt(s.gross_lamports) !== input.grossLamports
    ) {
      throw new Error(
        `publish: the stored intent for epoch ${input.epochId} was made for another network, community or pot`,
      );
    }
  }
  const index = BigInt(gate.epochIndex);
  const existing = await chain.readEpoch(onChain.address, index);

  let intent: PublicationIntent;
  if (stored && existing) {
    // After the send, the chain and the stored bytes decide; nothing is rebuilt.
    intent = stored;
  } else {
    // Before any send, today's rebuild must equal the stored intent, or becomes it. B6: the
    // backfill stores a ready epoch's hashes under the reward-writer lock first, so a
    // never-backfilled epoch or a late correction cannot strand the strict build.
    await backfillEpochCommitments(db, ref);
    const built = await buildPublication(
      db,
      ref,
      {
        grossLamports: input.grossLamports,
        network: chain.network,
        programId: chain.programId,
        feeRecipient: onChain.feeRecipient,
      },
      deps,
    );
    if (built.status !== "ready") return built;
    intent = await storeIntent(db, ref, onChain.address, built);
  }
  return { status: "planned", intent, community: onChain.address, index, onChain: existing };
}

export async function publishEpoch(
  db: Db,
  chain: PublishChain,
  input: PublishInput,
  deps: { tests?: readonly RulesTest[] } = {},
): Promise<PublishOutcome> {
  const plan = await planPublication(db, chain, input, deps);
  if (plan.status !== "planned") return plan;
  const { intent, index, onChain: existing } = plan;

  const intended: OnChainEpoch = {
    root: intent.root,
    auditHash: intent.auditHash,
    grossLamports: BigInt(intent.audit.settlement.gross_lamports),
    allocatedLamports: BigInt(intent.audit.settlement.allocated_lamports),
  };
  const args: PublishArgs = {
    community: plan.community,
    index,
    ...intended,
    feeRecipient: intent.audit.settlement.fee_recipient,
  };
  let signature: string;
  if (existing) {
    const same =
      existing.root === intended.root &&
      existing.auditHash === intended.auditHash &&
      existing.grossLamports === intended.grossLamports &&
      existing.allocatedLamports === intended.allocatedLamports;
    if (!same) {
      throw new Error(`publish: epoch ${index} is on-chain and differs from this publication`);
    }
    signature = await chain.publishSignature(args);
  } else {
    signature = await chain.publishEpoch(args);
  }

  await db.transaction(async (tx) => {
    const [epoch] = await tx
      .select({ root: epochs.root })
      .from(epochs)
      .where(and(eq(epochs.id, input.epochId), eq(epochs.communityId, input.communityId)))
      .for("update");
    if (!epoch) throw new Error(`publish: epoch ${input.epochId} vanished`);
    if (epoch.root !== null) {
      if (epoch.root === intent.root) return;
      throw new Error(`publish: epoch ${input.epochId} was recorded with another root`);
    }
    await tx.insert(leaves).values(
      intent.leaves.map((l) => ({
        epochId: input.epochId,
        memberId: l.memberId,
        wallet: l.wallet,
        score: l.score,
        amountLamports: l.amountLamports,
        evidenceHash: l.evidenceHash,
        proof: l.proof,
      })),
    );
    await tx
      .update(epochs)
      .set({
        status: "published",
        root: intent.root,
        potLamports: intended.grossLamports,
        publishTx: signature,
        publishedAt: sql`clock_timestamp()`,
      })
      .where(eq(epochs.id, input.epochId));
  });

  return {
    status: "published",
    signature,
    root: intent.root,
    auditHash: intent.auditHash,
    leaves: intent.leaves.length,
    recovered: existing !== null,
  };
}
