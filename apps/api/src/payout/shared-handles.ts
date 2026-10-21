import { type Db, epochs, members, sharedHandleClearances } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { sharedHandleMembers } from "../bot/commands/handles.js";
import { readOnly } from "../pg.js";

export interface SharedGroup {
  handle: string;
  memberIds: string[];
}

// The handles bound to more than one member of the community, and which of those members are
// cleared for the epoch. Private operator output: it pairs members with X handles.
export async function sharedHandleReport(
  db: Db,
  ref: { communityId: string; epochId: string },
): Promise<{ groups: SharedGroup[]; cleared: Map<string, string> }> {
  return readOnly(db, async (tx) => {
    const rows = await tx
      .select({ id: members.id, xHandles: members.xHandles })
      .from(members)
      .where(eq(members.communityId, ref.communityId));
    const shared = sharedHandleMembers(rows);
    const byHandle = new Map<string, Set<string>>();
    for (const r of rows.filter((r) => shared.has(r.id))) {
      for (const h of r.xHandles) {
        const key = h.toLowerCase();
        byHandle.set(key, (byHandle.get(key) ?? new Set()).add(r.id));
      }
    }
    const groups = [...byHandle]
      .filter(([, ids]) => ids.size > 1)
      .map(([handle, ids]) => ({ handle, memberIds: [...ids].sort() }))
      .sort((a, b) => (a.handle < b.handle ? -1 : 1));
    const cleared = new Map(
      (
        await tx
          .select({ memberId: sharedHandleClearances.memberId, note: sharedHandleClearances.note })
          .from(sharedHandleClearances)
          .where(eq(sharedHandleClearances.epochId, ref.epochId))
      ).map((c) => [c.memberId, c.note]),
    );
    return { groups, cleared };
  });
}

export type ClearResult =
  | { status: "cleared"; clearedAt: Date }
  | { status: "already_cleared" | "not_shared" | "published" | "not_found" };

// Records an admin's clearance of one member for one unpublished epoch. Insert-only.
export async function clearSharedHandle(
  db: Db,
  input: { communityId: string; epochId: string; memberId: string; note: string },
): Promise<ClearResult> {
  if (input.note.trim() === "") throw new Error("shared-handles: a clearance needs a note");
  return db.transaction(async (tx) => {
    const [epoch] = await tx
      .select()
      .from(epochs)
      .where(and(eq(epochs.id, input.epochId), eq(epochs.communityId, input.communityId)))
      .for("share");
    const [member] = await tx
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.id, input.memberId), eq(members.communityId, input.communityId)));
    if (!epoch || !member) return { status: "not_found" };
    if (epoch.status === "published" || epoch.root !== null) return { status: "published" };
    const rows = await tx
      .select({ id: members.id, xHandles: members.xHandles })
      .from(members)
      .where(eq(members.communityId, input.communityId));
    if (!sharedHandleMembers(rows).has(input.memberId)) return { status: "not_shared" };
    const [row] = await tx
      .insert(sharedHandleClearances)
      .values({ ...input, note: input.note.trim() })
      .onConflictDoNothing()
      .returning();
    return row ? { status: "cleared", clearedAt: row.clearedAt } : { status: "already_cleared" };
  });
}
