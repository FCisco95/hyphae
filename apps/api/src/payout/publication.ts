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
import type { Db } from "@hyphae/db";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { getAddressEncoder } from "@solana/kit";
import { readOnly } from "../pg.js";
import { storedEpochCommitments } from "./commitment-store.js";
import { type Blocker, type MemberVerdict, payoutGateIn } from "./gate.js";
import type { RulesTest } from "./rules-test.js";

// R6: from a ready payout gate to what publish commits on-chain. The gate alone decides who is
// payable; this module only turns that verdict into exact lamports (P6–P11), the member-epoch
// manifests (B7), the leaves (B8), the root and the epoch audit manifest (B9).

export interface PublicationSettings {
  network: MemberEpochManifest["network"];
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

const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export async function buildPublication(
  db: Db,
  ref: { communityId: string; epochId: string },
  input: PublicationSettings & { grossLamports: bigint },
  deps: { tests?: readonly RulesTest[] } = {},
): Promise<Publication> {
  // One repeatable-read snapshot: the verdict, the rows it judged and the commitments agree.
  return readOnly(db, async (tx): Promise<Publication> => {
    const gate = await payoutGateIn(tx, ref, deps);
    if (gate.status !== "ready") return { status: "blocked", blockers: gate.blockers };
    const { snapshot } = gate;
    const commitments = await storedEpochCommitments(tx, ref.epochId);

    const allocation = allocate(
      input.grossLamports,
      gate.members.map((m) => ({
        memberId: m.memberId,
        pointUnits: BigInt(m.pointUnits),
        payable: m.status === "payable",
      })),
    );
    const shareOf = new Map(allocation.members.map((m) => [m.memberId, m]));

    const base = {
      network: input.network,
      program_id: input.programId,
      community_id: ref.communityId,
      // The hold mint is the community's own.
      mint: gate.hold.mint,
      epoch: {
        id: ref.epochId,
        index: gate.epochIndex.toString(),
        opens_at: snapshot.opensAt,
        closes_at: snapshot.closesAt,
      },
      config_hash: commitments.configHash,
    };
    // Every snapshot entry in contribution order, listed under its member and in the audit.
    const entries = [...snapshot.entries]
      .sort((a, b) => byKey(a.contributionId, b.contributionId))
      .map((e) => {
        const decision = e.decisionId ? commitments.decisions.get(e.decisionId) : undefined;
        if (e.decisionId && !decision) {
          throw new Error(`publication: decision ${e.decisionId} has no commitment`);
        }
        return {
          member_id: e.memberId,
          contribution_id: e.contributionId,
          decision_hash: decision?.hash ?? null,
          reason: e.reason,
          point_units: e.pointUnits.toString(),
        };
      });
    const entriesOf = new Map<string, MemberEpochManifest["entries"]>();
    for (const { member_id, ...entry } of entries) {
      const list = entriesOf.get(member_id);
      if (list) list.push(entry);
      else entriesOf.set(member_id, [entry]);
    }

    // The hold result the gate applied: a payable member's, or the one that excluded it.
    const holdOf = ({ holdResult: r }: MemberVerdict) =>
      r && {
        mint: r.check.mint,
        threshold_raw: r.check.thresholdRaw,
        status: r.check.status,
        raw_amount: r.check.rawAmount as string,
        decimals: (r.check.decimals as number).toString(),
        slot: r.check.slot as string,
        provider: r.check.provider as string,
        observed_at: r.observedAt,
      };

    const members: MemberEpochManifest[] = gate.members.map((m) => {
      const share = shareOf.get(m.memberId);
      if (!share) throw new Error("publication: allocation lost a member");
      return {
        ...base,
        member_id: m.memberId,
        wallet: m.wallet,
        entries: entriesOf.get(m.memberId) ?? [],
        point_units: m.pointUnits,
        whole_points: m.wholePoints,
        settlement: {
          status: m.status === "payable" ? "payable" : "not_payable",
          reasons: [...m.reasons].sort(),
          rules_test: { test_id: gate.testId, passed_at: m.rulesTestPassedAt },
          hold: holdOf(m),
          uncapped_lamports: share.uncappedLamports.toString(),
          amount_lamports: share.amountLamports.toString(),
          cap_remainder_lamports: share.capRemainderLamports.toString(),
        },
      };
    });
    const manifestHash = new Map(members.map((m) => [m.member_id, memberEpochHash(m)]));

    // A payable member whose floored share is 0 gets no leaf: a claim would only cost rent.
    const encoder = getAddressEncoder();
    const epochIndex = BigInt(gate.epochIndex);
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
          evidenceHash: hexToBytes(leaf.evidenceHash),
        });
        return { leaf, hash: bytesToHex(hash) };
      })
      // Ordered by leaf hash, so the root depends on the leaves alone.
      .sort((a, b) => byKey(a.hash, b.hash));
    const tree = buildTree(unordered.map((u) => hexToBytes(u.hash)));
    const leaves: PublishedLeaf[] = unordered.map((u, i) => ({
      ...u.leaf,
      proof: getProof(tree, i).map(bytesToHex),
    }));
    const root = bytesToHex(tree.root);

    const audit: EpochAuditManifest = {
      ...base,
      snapshot: { closed_at: snapshot.closedAt, cutoff_assumption: snapshot.cutoffAssumption },
      entries,
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
  });
}
