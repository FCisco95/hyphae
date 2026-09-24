import {
  type Allocation,
  allocate,
  buildTree,
  type EpochAuditManifest,
  epochAuditHash,
  getProof,
  leafHash,
  type MemberEpochManifest,
  memberEpochHash,
} from "@hyphae/core";
import {
  communities,
  type Db,
  epochs,
  holdChecks,
  rewardEpochSnapshots,
  rewardSnapshotEntries,
  rewardSnapshotMembers,
  rulesTestPasses,
} from "@hyphae/db";
import { getAddressEncoder } from "@solana/kit";
import { and, eq } from "drizzle-orm";
import { epochCommitments, isoUs } from "./commitments.js";
import { type Blocker, evaluatePayoutGate, type MemberVerdict } from "./gate.js";
import type { RulesTest } from "./rules-test.js";

// R6: from a ready payout gate to what publish commits on-chain. The gate alone decides who is
// payable; this module only turns that verdict into exact lamports (P6–P11), the member-epoch
// manifests (B7), the leaves (B8), the root and the epoch audit manifest (B9).

export interface PublicationSettings {
  network: "solana:devnet" | "solana:mainnet";
  programId: string;
  // P8: the fee address fixed on the on-chain community.
  feeRecipient: string;
}

export interface PublishedLeaf {
  memberId: string;
  wallet: string;
  score: bigint;
  amountLamports: bigint;
  // The member-epoch manifest hash (B8).
  evidenceHash: string;
  proof: string[];
}

export type Publication =
  | { status: "blocked"; blockers: Blocker[] }
  | {
      status: "ready";
      epochIndex: bigint;
      allocation: Allocation;
      members: MemberEpochManifest[];
      leaves: PublishedLeaf[];
      root: string;
      audit: EpochAuditManifest;
      auditHash: string;
    };

const toHex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const fromHex = (s: string) => Uint8Array.from(Buffer.from(s, "hex"));
const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export async function buildPublication(
  db: Db,
  ref: { communityId: string; epochId: string },
  input: PublicationSettings & { grossLamports: bigint },
  deps: { tests?: readonly RulesTest[] } = {},
): Promise<Publication> {
  const gate = await evaluatePayoutGate(db, ref, deps);
  if (gate.status !== "ready") return { status: "blocked", blockers: gate.blockers };

  return db.transaction(
    async (tx) => {
      const [row] = await tx
        .select({
          epoch: epochs,
          mint: communities.mint,
          opensAt: isoUs(epochs.opensAt),
          closesAt: isoUs(epochs.closesAt),
        })
        .from(epochs)
        .innerJoin(communities, eq(communities.id, epochs.communityId))
        .where(and(eq(epochs.id, ref.epochId), eq(epochs.communityId, ref.communityId)));
      const [snapshot] = await tx
        .select({
          id: rewardEpochSnapshots.id,
          closedAt: isoUs(rewardEpochSnapshots.closedAt),
          cutoffAssumption: rewardEpochSnapshots.cutoffAssumption,
        })
        .from(rewardEpochSnapshots)
        .where(eq(rewardEpochSnapshots.epochId, ref.epochId));
      if (!row || !snapshot) throw new Error("publication: the ready epoch has no snapshot");
      const entries = await tx
        .select()
        .from(rewardSnapshotEntries)
        .where(eq(rewardSnapshotEntries.snapshotId, snapshot.id));
      const totals = await tx
        .select()
        .from(rewardSnapshotMembers)
        .where(eq(rewardSnapshotMembers.snapshotId, snapshot.id));
      const passes = new Map(
        (
          await tx
            .select({
              memberId: rulesTestPasses.memberId,
              passedAt: isoUs(rulesTestPasses.passedAt),
            })
            .from(rulesTestPasses)
            .where(
              and(
                eq(rulesTestPasses.communityId, ref.communityId),
                eq(rulesTestPasses.testId, gate.testId),
              ),
            )
        ).map((p) => [p.memberId, p.passedAt]),
      );
      const holds = new Map(
        (
          await tx
            .select({ h: holdChecks, observedAt: isoUs(holdChecks.observedAt) })
            .from(holdChecks)
            .where(eq(holdChecks.epochId, ref.epochId))
        ).map((r) => [r.h.memberId, r]),
      );
      const commitments = await epochCommitments(tx, ref.epochId);

      // The gate read the same frozen snapshot; anything else is a bug, never something to pay on.
      const verdicts = new Map(gate.members.map((m) => [m.memberId, m]));
      if (totals.length !== gate.members.length) {
        throw new Error("publication: the snapshot and the gate disagree on members");
      }
      for (const t of totals) {
        const v = verdicts.get(t.memberId);
        if (!v || v.pointUnits !== t.pointUnits.toString()) {
          throw new Error(`publication: member ${t.memberId} disagrees with the gate`);
        }
      }

      const allocation = allocate(
        input.grossLamports,
        gate.members.map((m) => ({
          memberId: m.memberId,
          pointUnits: BigInt(m.pointUnits),
          payable: m.status === "payable",
        })),
      );
      const shareOf = new Map(allocation.members.map((m) => [m.memberId, m]));

      const epochRef = {
        id: row.epoch.id,
        index: row.epoch.index.toString(),
        opens_at: row.opensAt,
        closes_at: row.closesAt,
      };
      const base = {
        network: input.network,
        program_id: input.programId,
        community_id: ref.communityId,
        mint: row.mint,
        epoch: epochRef,
        config_hash: commitments.configHash,
      };
      const entryOf = (e: (typeof entries)[number]) => {
        const decision = e.decisionId ? commitments.decisions.get(e.decisionId) : undefined;
        if (e.decisionId && !decision) {
          throw new Error(`publication: decision ${e.decisionId} has no commitment`);
        }
        return {
          contribution_id: e.contributionId,
          decision_hash: decision?.hash ?? null,
          reason: e.reason,
          point_units: e.pointUnits.toString(),
        };
      };
      const sortedEntries = [...entries].sort((a, b) => byKey(a.contributionId, b.contributionId));

      const holdFor = (m: MemberVerdict) => {
        // The hold result the gate applied: a payable member's, or the one that excluded it.
        if (gate.hold.thresholdRaw === 0n) return null;
        if (m.status !== "payable" && !m.reasons.includes("below_hold")) return null;
        const r = holds.get(m.memberId);
        if (!r || (r.h.status !== "holder" && r.h.status !== "below")) {
          throw new Error(`publication: member ${m.memberId} has no decided hold result`);
        }
        return {
          mint: r.h.mint,
          threshold_raw: r.h.thresholdRaw,
          status: r.h.status,
          raw_amount: r.h.rawAmount as string,
          decimals: (r.h.decimals as number).toString(),
          slot: r.h.slot as string,
          provider: r.h.provider as string,
          observed_at: r.observedAt,
        };
      };

      const members: MemberEpochManifest[] = [...gate.members]
        .sort((a, b) => byKey(a.memberId, b.memberId))
        .map((m) => {
          const share = shareOf.get(m.memberId);
          if (!share) throw new Error("publication: allocation lost a member");
          return {
            ...base,
            member_id: m.memberId,
            wallet: m.wallet,
            entries: sortedEntries.filter((e) => e.memberId === m.memberId).map(entryOf),
            point_units: m.pointUnits,
            whole_points: m.wholePoints,
            settlement: {
              status: m.status === "payable" ? "payable" : "not_payable",
              reasons: [...m.reasons].sort(),
              rules_test: { test_id: gate.testId, passed_at: passes.get(m.memberId) ?? null },
              hold: holdFor(m),
              uncapped_lamports: share.uncappedLamports.toString(),
              amount_lamports: share.amountLamports.toString(),
              cap_remainder_lamports: share.capRemainderLamports.toString(),
            },
          };
        });
      const manifestHash = new Map(members.map((m) => [m.member_id, memberEpochHash(m)]));

      // A payable member whose floored share is 0 gets no leaf: a claim would only cost rent.
      const encoder = getAddressEncoder();
      const epochIndex = BigInt(row.epoch.index);
      const unordered = members
        .filter((m) => m.settlement.status === "payable" && m.settlement.amount_lamports !== "0")
        .map((m) => {
          const leaf = {
            memberId: m.member_id,
            wallet: m.wallet as string,
            score: BigInt(m.whole_points),
            amountLamports: BigInt(m.settlement.amount_lamports),
            evidenceHash: manifestHash.get(m.member_id) as string,
          };
          const hash = leafHash({
            wallet: new Uint8Array(encoder.encode(leaf.wallet as never)),
            epochIndex,
            score: leaf.score,
            amount: leaf.amountLamports,
            evidenceHash: fromHex(leaf.evidenceHash),
          });
          return { leaf, hash: toHex(hash) };
        })
        // Ordered by leaf hash, so the root depends on the leaves alone.
        .sort((a, b) => byKey(a.hash, b.hash));
      if (unordered.length === 0) {
        throw new Error("publication: the gross pot pays no payable member a whole lamport");
      }
      const tree = buildTree(unordered.map((u) => fromHex(u.hash)));
      const leaves: PublishedLeaf[] = unordered.map((u, i) => ({
        ...u.leaf,
        proof: getProof(tree, i).map(toHex),
      }));
      const root = toHex(tree.root);

      const audit: EpochAuditManifest = {
        ...base,
        snapshot: { closed_at: snapshot.closedAt, cutoff_assumption: snapshot.cutoffAssumption },
        entries: sortedEntries.map((e) => ({ ...entryOf(e), member_id: e.memberId })),
        members: members.map((m) => ({
          member_id: m.member_id,
          manifest_hash: manifestHash.get(m.member_id) as string,
          wallet: m.wallet,
          point_units: m.point_units,
          whole_points: m.whole_points,
          amount_lamports: m.settlement.amount_lamports,
        })),
        settlement: {
          gross_lamports: allocation.grossLamports.toString(),
          fee_bps: allocation.feeBps.toString(),
          fee_lamports: allocation.feeLamports.toString(),
          fee_recipient: input.feeRecipient,
          net_lamports: allocation.netLamports.toString(),
          cap_bps: allocation.capBps.toString(),
          cap_lamports: allocation.capLamports.toString(),
          payable_members: allocation.payableMembers.toString(),
          allocated_lamports: allocation.allocatedLamports.toString(),
          cap_remainder_lamports: allocation.capRemainderLamports.toString(),
          dust_lamports: allocation.dustLamports.toString(),
          rules_test_id: gate.testId,
          hold: { mint: gate.hold.mint, threshold_raw: gate.hold.thresholdRaw.toString() },
        },
        root,
      };

      return {
        status: "ready" as const,
        epochIndex,
        allocation,
        members,
        leaves,
        root,
        audit,
        auditHash: epochAuditHash(audit),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
