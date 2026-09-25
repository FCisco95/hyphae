import type { MemberEpochManifest } from "@hyphae/core";
import { communities, type Db, epochs, leaves } from "@hyphae/db";
import { and, eq, sql } from "drizzle-orm";
import type { Blocker } from "./gate.js";
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

export interface PublishChain {
  network: MemberEpochManifest["network"];
  programId: string;
  // The community PDA for this mint and the publishing admin key.
  communityAddress(mint: string): Promise<string>;
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
  input: { communityId: string; epochId: string; grossLamports: bigint; feeRecipient: string },
  deps: { tests?: readonly RulesTest[] } = {},
): Promise<PublishOutcome> {
  const [community] = await db
    .select({ mint: communities.mint, chainAddress: communities.chainAddress })
    .from(communities)
    .where(eq(communities.id, input.communityId));
  if (!community) throw new Error(`publish: no community ${input.communityId}`);
  // The operator binds a community to its on-chain address; until then nothing is published.
  if (
    community.chainAddress === null ||
    community.chainAddress !== (await chain.communityAddress(community.mint))
  ) {
    return { status: "refused", reason: "community_not_on_chain" };
  }

  const publication = await buildPublication(
    db,
    { communityId: input.communityId, epochId: input.epochId },
    {
      grossLamports: input.grossLamports,
      network: chain.network,
      programId: chain.programId,
      feeRecipient: input.feeRecipient,
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
  const existing = await chain.readEpoch(community.chainAddress, publication.epochIndex);
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
    signature = await chain.publishSignature(community.chainAddress, publication.epochIndex);
  } else {
    signature = await chain.publishEpoch({
      community: community.chainAddress,
      index: publication.epochIndex,
      ...intended,
      feeRecipient: input.feeRecipient,
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
