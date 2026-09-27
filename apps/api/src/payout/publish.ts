import type { MemberEpochManifest } from "@hyphae/core";
import { communities, type Db, epochs, leaves } from "@hyphae/db";
import { and, eq, sql } from "drizzle-orm";
import { backfillEpochCommitments } from "./commitment-store.js";
import { type Blocker, evaluatePayoutGate } from "./gate.js";
import { buildPublication } from "./publication.js";
import type { RulesTest } from "./rules-test.js";

// The R6 publish job: a ready epoch's root, audit hash, gross pot and allocated total go on-chain
// through publish_epoch, then its leaves and root are recorded. Written, not scheduled: nothing
// in the api or worker calls it, and it refuses a community not bound to its on-chain address.

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
  publishEpoch(input: {
    community: string;
    index: bigint;
    root: string;
    auditHash: string;
    grossLamports: bigint;
    allocatedLamports: bigint;
    feeRecipient: string;
  }): Promise<string>;
  // The signature that created the epoch account, for an epoch found already on-chain.
  publishSignature(community: string, index: bigint): Promise<string>;
}

export type PublishOutcome =
  | { status: "refused"; reason: "community_not_on_chain" }
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

export async function publishEpoch(
  db: Db,
  chain: PublishChain,
  input: { communityId: string; epochId: string; grossLamports: bigint },
  deps: { tests?: readonly RulesTest[] } = {},
): Promise<PublishOutcome> {
  const [community] = await db
    .select({ mint: communities.mint, chainAddress: communities.chainAddress })
    .from(communities)
    .where(eq(communities.id, input.communityId));
  if (!community) throw new Error(`publish: no community ${input.communityId}`);
  // The operator binds a community to its initialized on-chain account; until then nothing is
  // published. The fee recipient comes from that account, so the audit commits the one it pays.
  const onChain = await chain.readCommunity(community.mint);
  if (onChain === null || community.chainAddress !== onChain.address) {
    return { status: "refused", reason: "community_not_on_chain" };
  }

  // B6: a ready epoch's hashes are stored here, under the reward-writer lock, so a never-backfilled
  // epoch or a late correction cannot strand publication or its recovery. The backfill never
  // overwrites and refuses a mismatch; the build below stays strict. A blocked epoch gets no write.
  const ref = { communityId: input.communityId, epochId: input.epochId };
  const gate = await evaluatePayoutGate(db, ref, deps);
  if (gate.status !== "ready") return { status: "blocked", blockers: gate.blockers };
  await backfillEpochCommitments(db, ref);

  const publication = await buildPublication(
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
  if (publication.status !== "ready") return publication;

  const intended: OnChainEpoch = {
    root: publication.root,
    auditHash: publication.auditHash,
    grossLamports: publication.allocation.grossLamports,
    allocatedLamports: publication.allocation.allocatedLamports,
  };
  const existing = await chain.readEpoch(onChain.address, publication.epochIndex);
  let signature: string;
  if (existing) {
    const same =
      existing.root === intended.root &&
      existing.auditHash === intended.auditHash &&
      existing.grossLamports === intended.grossLamports &&
      existing.allocatedLamports === intended.allocatedLamports;
    if (!same) {
      throw new Error(
        `publish: epoch ${publication.epochIndex} is on-chain and differs from this publication`,
      );
    }
    signature = await chain.publishSignature(onChain.address, publication.epochIndex);
  } else {
    signature = await chain.publishEpoch({
      community: onChain.address,
      index: publication.epochIndex,
      ...intended,
      feeRecipient: onChain.feeRecipient,
    });
  }

  await db.transaction(async (tx) => {
    const [epoch] = await tx
      .select({ root: epochs.root })
      .from(epochs)
      .where(and(eq(epochs.id, input.epochId), eq(epochs.communityId, input.communityId)))
      .for("update");
    if (!epoch) throw new Error(`publish: epoch ${input.epochId} vanished`);
    if (epoch.root !== null) {
      if (epoch.root === publication.root) return;
      throw new Error(`publish: epoch ${input.epochId} was recorded with another root`);
    }
    await tx.insert(leaves).values(
      publication.leaves.map((l) => ({
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
        root: publication.root,
        potLamports: publication.allocation.grossLamports,
        publishTx: signature,
        publishedAt: sql`clock_timestamp()`,
      })
      .where(eq(epochs.id, input.epochId));
  });

  return {
    status: "published",
    signature,
    root: publication.root,
    auditHash: publication.auditHash,
    leaves: publication.leaves.length,
    recovered: existing !== null,
  };
}
