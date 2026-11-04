import {
  type AssembledDistribution,
  buildTree,
  c14n,
  DistributionAuditManifest,
  type DistributionLeaf,
  distributionAuditHash,
  getProof,
  leafHash,
  MemberDistributionManifest,
  MemberEpochManifest,
  memberDistributionHash,
  memberEpochHash,
} from "@hyphae/core";
import {
  type Db,
  distributionPublicationEpochMembers,
  distributionPublicationMembers,
  distributionPublications,
} from "@hyphae/db";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { getAddressEncoder } from "@solana/kit";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { rebuildingStored, StoredIntentInconsistent } from "./stored-intent-error.js";

// The distribution intent (migration 0023): the exact B11 audit and B10 member bytes a
// distribution publish sends, stored before the send, like the single-epoch intent (intent.ts),
// with the B7 member-epoch bytes of every epoch it pays, which the B10 parts and the audit commit
// to by hash. Every later run sends or records these bytes; nothing is taken from a rebuild after
// a send.

// One pending epoch's B7 manifests, as the audit lists that epoch.
export interface DistributionEpochMembers {
  epochId: string;
  index: string;
  members: MemberEpochManifest[];
}

export interface DistributionIntent {
  id: string;
  communityAddress: string;
  audit: DistributionAuditManifest;
  auditHash: string;
  root: string;
  members: MemberDistributionManifest[];
  leaves: DistributionLeaf[];
  // In the audit's epoch order.
  epochMembers: DistributionEpochMembers[];
}

const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function parsed<T>(schema: z.ZodType<T>, text: string): T | undefined {
  try {
    const result = schema.safeParse(JSON.parse(text));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

// The leaves and root a set of member-distribution manifests commit to, exactly as
// assembleDistribution derives them: one leaf per member, under the distribution's index.
export function distributionLeavesOf(
  members: readonly MemberDistributionManifest[],
  index: bigint,
): { leaves: DistributionLeaf[]; root: string } {
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
        epochIndex: index,
        score: leaf.score,
        amount: leaf.amountLamports,
        evidenceHash: hexToBytes(leaf.evidenceHash),
      });
      return { leaf, hash: bytesToHex(hash) };
    })
    .sort((a, b) => byKey(a.hash, b.hash));
  const tree = buildTree(unordered.map((u) => hexToBytes(u.hash)));
  return {
    leaves: unordered.map((u, i) => ({ ...u.leaf, proof: getProof(tree, i).map(bytesToHex) })),
    root: bytesToHex(tree.root),
  };
}

// Rebuilt from the stored text alone: each text is canonical, hashes to its stored hash, the audit
// names every member manifest by that hash, and the manifests give the stored root.
export async function loadDistributionIntent(
  db: Db,
  epochId: string,
): Promise<DistributionIntent | null> {
  const [row] = await db
    .select()
    .from(distributionPublications)
    .where(eq(distributionPublications.epochId, epochId));
  if (!row) return null;
  const rows = await db
    .select()
    .from(distributionPublicationMembers)
    .where(eq(distributionPublicationMembers.publicationId, row.id));
  const epochRows = await db
    .select()
    .from(distributionPublicationEpochMembers)
    .where(eq(distributionPublicationEpochMembers.publicationId, row.id));
  const inconsistent = (what: string) =>
    new StoredIntentInconsistent(
      `settle: the stored distribution intent for epoch ${epochId} is inconsistent (${what})`,
    );
  return rebuildingStored(inconsistent, () =>
    rebuiltDistribution(row, rows, epochRows, inconsistent),
  );
}

function rebuiltDistribution(
  row: typeof distributionPublications.$inferSelect,
  rows: (typeof distributionPublicationMembers.$inferSelect)[],
  epochRows: readonly EpochMemberRow[],
  inconsistent: (what: string) => Error,
): DistributionIntent {
  const audit = parsed(DistributionAuditManifest, row.auditManifest);
  if (
    !audit ||
    c14n(audit) !== row.auditManifest ||
    distributionAuditHash(audit) !== row.auditHash
  ) {
    throw inconsistent("audit manifest");
  }
  const members = rows
    .map((r) => {
      const m = parsed(MemberDistributionManifest, r.manifest);
      if (
        !m ||
        c14n(m) !== r.manifest ||
        memberDistributionHash(m) !== r.manifestHash ||
        m.member_id !== r.memberId
      ) {
        throw inconsistent(`member ${r.memberId}`);
      }
      return m;
    })
    .sort((a, b) => byKey(a.member_id, b.member_id));
  const named = new Map(audit.members.map((m) => [m.member_id, m.manifest_hash]));
  if (named.size !== rows.length || rows.some((r) => named.get(r.memberId) !== r.manifestHash)) {
    throw inconsistent("member hashes");
  }
  const { leaves, root } = distributionLeavesOf(members, BigInt(audit.distribution.index));
  if (root !== row.root || root !== audit.root) throw inconsistent("root");
  const epochMembers = epochMembersOf(audit, epochRows, inconsistent);
  // Every B10 part names a stored B7 manifest of its epoch.
  const stored = new Map(
    epochMembers.map((e) => [e.index, new Set(e.members.map(memberEpochHash))]),
  );
  for (const m of members) {
    for (const p of m.parts) {
      if (!stored.get(p.epoch_index)?.has(p.member_epoch_hash)) {
        throw inconsistent(`member ${m.member_id}'s part in epoch ${p.epoch_index}`);
      }
    }
  }
  return {
    id: row.id,
    communityAddress: row.communityAddress,
    audit,
    auditHash: row.auditHash,
    root,
    members,
    leaves,
    epochMembers,
  };
}

type EpochMemberRow = typeof distributionPublicationEpochMembers.$inferSelect;

// The stored B7 rows, checked against the audit: each text is canonical and hashes to its stored
// hash, names its own epoch and member, and each audit epoch's member list is exactly the rows
// stored for it, hash for hash.
function epochMembersOf(
  audit: DistributionAuditManifest,
  rows: readonly EpochMemberRow[],
  inconsistent: (what: string) => Error,
): DistributionEpochMembers[] {
  const byEpoch = new Map<string, EpochMemberRow[]>();
  for (const r of rows) byEpoch.set(r.epochId, [...(byEpoch.get(r.epochId) ?? []), r]);
  // An epoch nobody was payable in has no manifests, so rows are matched per audit epoch.
  const listed = new Set(audit.epochs.map((e) => e.epoch.id));
  for (const epochId of byEpoch.keys()) {
    if (!listed.has(epochId)) throw inconsistent(`member-epoch rows of epoch ${epochId}`);
  }
  return audit.epochs.map((e) => {
    const own = byEpoch.get(e.epoch.id) ?? [];
    const members = own
      .map((r) => {
        const m = parsed(MemberEpochManifest, r.manifest);
        if (
          !m ||
          c14n(m) !== r.manifest ||
          memberEpochHash(m) !== r.manifestHash ||
          m.member_id !== r.memberId ||
          m.epoch.id !== r.epochId ||
          m.epoch.index !== e.epoch.index
        ) {
          throw inconsistent(`member ${r.memberId} in epoch ${e.epoch.index}`);
        }
        return m;
      })
      .sort((a, b) => byKey(a.member_id, b.member_id));
    const named = new Map(e.members.map((m) => [m.member_id, m.manifest_hash]));
    if (named.size !== own.length || own.some((r) => named.get(r.memberId) !== r.manifestHash)) {
      throw inconsistent(`member-epoch hashes of epoch ${e.epoch.index}`);
    }
    return { epochId: e.epoch.id, index: e.epoch.index, members };
  });
}

// Inserts an assembled distribution as the index epoch's intent, inside the caller's transaction,
// with the B7 manifests of every epoch it pays (`epochMembers`, one entry per audit epoch). A row
// already there is left as it is: the caller loads the intent back and compares hashes.
export async function insertDistributionIntent(
  tx: Db,
  ref: { communityId: string; epochId: string },
  communityAddress: string,
  built: AssembledDistribution,
  epochMembers: readonly { epochId: string; members: readonly MemberEpochManifest[] }[],
): Promise<void> {
  // Refused before anything is written: the audit must name exactly these manifests.
  const given = new Map(epochMembers.map((e) => [e.epochId, e.members]));
  if (given.size !== built.audit.epochs.length) {
    throw new Error("settle: the distribution's member-epoch manifests list other epochs");
  }
  for (const e of built.audit.epochs) {
    const hashes = (given.get(e.epoch.id) ?? []).map((m) => [m.member_id, memberEpochHash(m)]);
    const named = e.members.map((m) => [m.member_id, m.manifest_hash]);
    if (JSON.stringify(hashes.sort()) !== JSON.stringify(named.sort())) {
      throw new Error(
        `settle: epoch ${e.epoch.index}'s member-epoch manifests differ from the audit`,
      );
    }
  }
  const [inserted] = await tx
    .insert(distributionPublications)
    .values({
      epochId: ref.epochId,
      communityId: ref.communityId,
      communityAddress,
      root: built.root,
      auditHash: built.auditHash,
      auditManifest: c14n(built.audit),
    })
    .onConflictDoNothing({ target: distributionPublications.epochId })
    .returning({ id: distributionPublications.id });
  if (!inserted) return;
  await tx.insert(distributionPublicationMembers).values(
    built.members.map((m) => ({
      publicationId: inserted.id,
      memberId: m.member_id,
      manifestHash: memberDistributionHash(m),
      manifest: c14n(m),
    })),
  );
  const rows = epochMembers.flatMap((e) =>
    e.members.map((m) => ({
      publicationId: inserted.id,
      epochId: e.epochId,
      memberId: m.member_id,
      manifestHash: memberEpochHash(m),
      manifest: c14n(m),
    })),
  );
  if (rows.length) await tx.insert(distributionPublicationEpochMembers).values(rows);
}
