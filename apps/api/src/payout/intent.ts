import {
  c14n,
  EpochAuditManifest,
  epochAuditHash,
  MemberEpochManifest,
  memberEpochHash,
} from "@hyphae/core";
import { type Db, epochPublicationMembers, epochPublications } from "@hyphae/db";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { leavesOf, type Publication, type PublishedLeaf } from "./publication.js";

// The publication intent (migration 0011): the exact bytes a publish sends, stored before the
// send. Every later run sends or records these bytes; nothing is taken from a rebuild after a send.

export interface PublicationIntent {
  id: string;
  communityAddress: string;
  audit: EpochAuditManifest;
  auditHash: string;
  root: string;
  members: MemberEpochManifest[];
  leaves: PublishedLeaf[];
}

type Ready = Extract<Publication, { status: "ready" }>;

const byMember = (a: { member_id: string }, b: { member_id: string }) =>
  a.member_id < b.member_id ? -1 : a.member_id > b.member_id ? 1 : 0;

function parsed<T>(schema: z.ZodType<T>, text: string): T | undefined {
  try {
    const result = schema.safeParse(JSON.parse(text));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

// Rebuilt from the stored text alone: each text is canonical, hashes to its stored hash, the audit
// names every member manifest by that hash, and the manifests give the stored root.
export async function loadIntent(db: Db, epochId: string): Promise<PublicationIntent | null> {
  const [row] = await db
    .select()
    .from(epochPublications)
    .where(eq(epochPublications.epochId, epochId));
  if (!row) return null;
  const rows = await db
    .select()
    .from(epochPublicationMembers)
    .where(eq(epochPublicationMembers.publicationId, row.id));
  const inconsistent = (what: string) =>
    new Error(`publish: the stored intent for epoch ${epochId} is inconsistent (${what})`);

  const audit = parsed(EpochAuditManifest, row.auditManifest);
  if (!audit || c14n(audit) !== row.auditManifest || epochAuditHash(audit) !== row.auditHash) {
    throw inconsistent("audit manifest");
  }
  const members = rows
    .map((r) => {
      const m = parsed(MemberEpochManifest, r.manifest);
      if (
        !m ||
        c14n(m) !== r.manifest ||
        memberEpochHash(m) !== r.manifestHash ||
        m.member_id !== r.memberId
      ) {
        throw inconsistent(`member ${r.memberId}`);
      }
      return m;
    })
    .sort(byMember);
  const named = new Map(audit.members.map((m) => [m.member_id, m.manifest_hash]));
  if (named.size !== rows.length || rows.some((r) => named.get(r.memberId) !== r.manifestHash)) {
    throw inconsistent("member hashes");
  }
  const { leaves, root } = leavesOf(members, BigInt(audit.epoch.index));
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

// Stores a built publication as the epoch's intent, or finds the one an earlier run stored, which
// must be the same publication: the audit hash commits to every member manifest and the root.
export async function storeIntent(
  db: Db,
  ref: { communityId: string; epochId: string },
  communityAddress: string,
  built: Ready,
): Promise<PublicationIntent> {
  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(epochPublications)
      .values({
        epochId: ref.epochId,
        communityId: ref.communityId,
        communityAddress,
        root: built.root,
        auditHash: built.auditHash,
        auditManifest: c14n(built.audit),
      })
      .onConflictDoNothing({ target: epochPublications.epochId })
      .returning({ id: epochPublications.id });
    if (!inserted) return;
    await tx.insert(epochPublicationMembers).values(
      built.members.map((m) => ({
        publicationId: inserted.id,
        memberId: m.member_id,
        manifestHash: memberEpochHash(m),
        manifest: c14n(m),
      })),
    );
  });
  const intent = await loadIntent(db, ref.epochId);
  if (!intent) throw new Error(`publish: the intent for epoch ${ref.epochId} vanished`);
  if (intent.auditHash !== built.auditHash || intent.communityAddress !== communityAddress) {
    throw new Error(
      `publish: epoch ${ref.epochId}'s rebuilt publication differs from its stored intent`,
    );
  }
  return intent;
}
