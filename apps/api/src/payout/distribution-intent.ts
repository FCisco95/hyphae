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
  memberDistributionHash,
} from "@hyphae/core";
import { type Db, distributionPublicationMembers, distributionPublications } from "@hyphae/db";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { getAddressEncoder } from "@solana/kit";
import { eq } from "drizzle-orm";
import type { z } from "zod";

// The distribution intent (migration 0023): the exact B11 audit and B10 member bytes a
// distribution publish sends, stored before the send, like the single-epoch intent (intent.ts).
// Every later run sends or records these bytes; nothing is taken from a rebuild after a send.

export interface DistributionIntent {
  id: string;
  communityAddress: string;
  audit: DistributionAuditManifest;
  auditHash: string;
  root: string;
  members: MemberDistributionManifest[];
  leaves: DistributionLeaf[];
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
  const inconsistent = (what: string) =>
    new Error(
      `settle: the stored distribution intent for epoch ${epochId} is inconsistent (${what})`,
    );

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
  return {
    id: row.id,
    communityAddress: row.communityAddress,
    audit,
    auditHash: row.auditHash,
    root,
    members,
    leaves,
  };
}

// Inserts an assembled distribution as the index epoch's intent, inside the caller's transaction.
// A row already there is left as it is: the caller loads the intent back and compares hashes.
export async function insertDistributionIntent(
  tx: Db,
  ref: { communityId: string; epochId: string },
  communityAddress: string,
  built: AssembledDistribution,
): Promise<void> {
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
}
