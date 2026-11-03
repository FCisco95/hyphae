import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { getAddressEncoder } from "@solana/kit";
import {
  type DistributionAuditManifest,
  distributionAuditHash,
  type EpochAuditManifest,
  type MemberDistributionManifest,
  type MemberEpochManifest,
  memberDistributionHash,
  memberEpochHash,
} from "./commitments.js";
import type { Distribution, PayoutPolicy } from "./distribution.js";
import { buildTree, getProof, leafHash } from "./merkle.js";

// From a distribution (distribution.ts) and each pending epoch's evidence to what publish_epoch
// commits: the B10 member manifests, one leaf per wallet under the distribution's index, the root
// and the B11 audit. The evidence is each epoch's B7 manifests carrying that epoch's slice shares;
// this module checks them against the distribution instead of trusting them.

export interface DistributionEpochEvidence {
  epoch: MemberEpochManifest["epoch"];
  configHash: string;
  snapshot: EpochAuditManifest["snapshot"];
  entries: EpochAuditManifest["entries"];
  // Every member of the epoch's gate, in any order, each with that epoch's slice share.
  members: MemberEpochManifest[];
  volumeLamports: bigint | null;
  rulesTestId: string;
  hold: EpochAuditManifest["settlement"]["hold"];
}

export interface DistributionLeaf {
  memberId: string;
  wallet: string;
  score: bigint;
  amountLamports: bigint;
  // The B10 manifest hash.
  evidenceHash: string;
  proof: string[];
}

export interface AssembledDistribution {
  members: MemberDistributionManifest[];
  leaves: DistributionLeaf[];
  root: string;
  audit: DistributionAuditManifest;
  auditHash: string;
}

const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function assembleDistribution(input: {
  network: MemberEpochManifest["network"];
  programId: string;
  communityId: string;
  mint: string;
  feeRecipient: string;
  policy: PayoutPolicy;
  // The volume the decision compared with the threshold.
  volumeLamports: bigint;
  distribution: Distribution;
  // One per pending epoch, in the distribution's epoch order.
  epochs: readonly DistributionEpochEvidence[];
}): AssembledDistribution {
  const { distribution: d } = input;
  const base = {
    network: input.network,
    program_id: input.programId,
    community_id: input.communityId,
    mint: input.mint,
  };
  const sliceOf = new Map(d.slices.map((s) => [s.epochIndex, s]));
  if (
    input.epochs.length !== d.epochs.length ||
    input.epochs.some((e, i) => BigInt(e.epoch.index) !== (d.epochs[i] as { index: bigint }).index)
  ) {
    throw new Error("distribution: the evidence lists other epochs than the distribution");
  }

  // Per epoch: every B7 manifest, its hash, and the share it must carry.
  const epochHashes = new Map<string, Map<string, { hash: string; m: MemberEpochManifest }>>();
  const auditEpochs = input.epochs.map((e, i) => {
    const index = BigInt(e.epoch.index);
    const { accrualLamports, mergedInto: merged } = d.epochs[i] as Distribution["epochs"][number];
    const slice = sliceOf.get(index);
    if (!slice === (merged === null)) {
      throw new Error(`distribution: epoch ${index} must be a slice or merged into one`);
    }
    const ordered = [...e.members].sort((a, b) => byKey(a.member_id, b.member_id));
    const hashes = new Map<string, { hash: string; m: MemberEpochManifest }>();
    for (const m of ordered) {
      if (m.epoch.index !== e.epoch.index || m.community_id !== input.communityId) {
        throw new Error("distribution: a member manifest belongs to another epoch");
      }
      hashes.set(m.member_id, { hash: memberEpochHash(m), m });
    }
    epochHashes.set(e.epoch.index, hashes);
    const share = (id: string) =>
      slice?.members.find((x) => x.memberId === id)?.amountLamports ?? 0n;
    for (const m of ordered) {
      if (BigInt(m.settlement.amount_lamports) !== share(m.member_id)) {
        throw new Error(`distribution: member ${m.member_id} carries another share in ${index}`);
      }
    }
    if (slice && slice.members.length !== ordered.length) {
      throw new Error(`distribution: epoch ${index} lists another member set than its slice`);
    }
    return {
      epoch: e.epoch,
      config_hash: e.configHash,
      snapshot: e.snapshot,
      entries: e.entries,
      members: ordered.map((m) => ({
        member_id: m.member_id,
        manifest_hash: (hashes.get(m.member_id) as { hash: string }).hash,
        wallet: m.wallet,
        point_units: m.point_units,
        whole_points: m.whole_points,
        amount_lamports: m.settlement.amount_lamports,
      })),
      accrual_lamports: accrualLamports.toString(),
      volume_lamports: e.volumeLamports === null ? null : e.volumeLamports.toString(),
      merged_into: merged === null ? null : merged.toString(),
      gross_lamports: (slice?.grossLamports ?? 0n).toString(),
      net_lamports: (slice?.netLamports ?? 0n).toString(),
      cap_bps: (slice?.capBps ?? 0n).toString(),
      cap_lamports: (slice?.capLamports ?? 0n).toString(),
      payable_members: (slice?.payableMembers ?? 0).toString(),
      allocated_lamports: (slice?.allocatedLamports ?? 0n).toString(),
      cap_remainder_lamports: (slice?.capRemainderLamports ?? 0n).toString(),
      dust_lamports: (slice?.dustLamports ?? 0n).toString(),
      rules_test_id: e.rulesTestId,
      hold: e.hold,
    };
  });

  const members: MemberDistributionManifest[] = d.members.map((dm) => {
    const parts = dm.parts.map((p) => {
      const found = epochHashes.get(p.epochIndex.toString())?.get(dm.memberId);
      if (!found)
        throw new Error(`distribution: ${dm.memberId} has no manifest in ${p.epochIndex}`);
      return {
        epoch_index: p.epochIndex.toString(),
        member_epoch_hash: found.hash,
        whole_points: found.m.whole_points,
        amount_lamports: p.amountLamports.toString(),
      };
    });
    return {
      ...base,
      distribution_index: d.index.toString(),
      member_id: dm.memberId,
      wallet: dm.wallet,
      parts,
      whole_points: parts.reduce((s, p) => s + BigInt(p.whole_points), 0n).toString(),
      amount_lamports: dm.amountLamports.toString(),
    };
  });

  const encoder = getAddressEncoder();
  const unordered = members
    .map((m) => {
      const leaf = {
        memberId: m.member_id,
        wallet: m.wallet,
        score: BigInt(m.whole_points),
        amountLamports: BigInt(m.amount_lamports),
        evidenceHash: memberDistributionHash(m),
      };
      const hash = leafHash({
        wallet: new Uint8Array(encoder.encode(leaf.wallet as never)),
        epochIndex: d.index,
        score: leaf.score,
        amount: leaf.amountLamports,
        evidenceHash: hexToBytes(leaf.evidenceHash),
      });
      return { leaf, hash: bytesToHex(hash) };
    })
    // Ordered by leaf hash, so the root depends on the leaves alone (as leavesOf does).
    .sort((a, b) => byKey(a.hash, b.hash));
  const tree = buildTree(unordered.map((u) => hexToBytes(u.hash)));
  const leaves = unordered.map((u, i) => ({ ...u.leaf, proof: getProof(tree, i).map(bytesToHex) }));
  const root = bytesToHex(tree.root);

  const audit: DistributionAuditManifest = {
    ...base,
    distribution: {
      index: d.index.toString(),
      policy: {
        threshold_volume_lamports: input.policy.thresholdVolumeLamports.toString(),
        basis: input.policy.basis,
        split: "per_epoch",
        volume_source: "fee_derived",
        reward_bps_of_volume:
          input.policy.rewardBpsOfVolume === null
            ? null
            : input.policy.rewardBpsOfVolume.toString(),
      },
      volume_lamports: input.volumeLamports.toString(),
    },
    epochs: auditEpochs,
    members: members
      .map((m) => ({
        member_id: m.member_id,
        manifest_hash: memberDistributionHash(m),
        wallet: m.wallet,
        whole_points: m.whole_points,
        amount_lamports: m.amount_lamports,
      }))
      .sort((a, b) => byKey(a.member_id, b.member_id)),
    settlement: {
      gross_lamports: d.grossLamports.toString(),
      fee_bps: "300",
      fee_lamports: d.feeLamports.toString(),
      fee_recipient: input.feeRecipient,
      net_lamports: d.netLamports.toString(),
      allocated_lamports: d.allocatedLamports.toString(),
      cap_remainder_lamports: d.capRemainderLamports.toString(),
      dust_lamports: d.dustLamports.toString(),
    },
    root,
  };
  return { members, leaves, root, audit, auditHash: distributionAuditHash(audit) };
}
