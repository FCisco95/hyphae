import { type Db, epochPublications, epochs, members, sharedHandleClearances } from "@hyphae/db";
import { and, asc, eq } from "drizzle-orm";
import { sharedHandleMembers } from "../bot/commands/handles.js";
import { readOnly } from "../pg.js";
import { type GateDeps, HOLD_WINDOW_MS, payoutGateIn } from "./gate.js";

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

// The members cleared for the epoch, in id order.
export async function clearedMembers(tx: Db, epochId: string): Promise<string[]> {
  const rows = await tx
    .select({ memberId: sharedHandleClearances.memberId })
    .from(sharedHandleClearances)
    .where(eq(sharedHandleClearances.epochId, epochId))
    .orderBy(asc(sharedHandleClearances.memberId));
  return rows.map((r) => r.memberId);
}

export type ClearResult =
  | { status: "cleared"; clearedAt: Date }
  | {
      status:
        | "already_cleared"
        | "not_shared"
        | "planned"
        | "published"
        | "hold_unresolved"
        | "not_found";
    };

// Records an admin's clearance of one member for one epoch with no stored publication intent:
// a planned epoch publishes exactly its stored bytes. The epoch row lock orders this against
// storeIntent, which takes the same lock. A member whose balance was never read in the hold
// window cannot be cleared: it would hold the epoch for ever. Insert-only.
export async function clearSharedHandle(
  db: Db,
  input: { communityId: string; epochId: string; memberId: string; note: string },
  deps: GateDeps = {},
): Promise<ClearResult> {
  if (input.note.trim() === "") throw new Error("shared-handles: a clearance needs a note");
  return db
    .transaction(async (tx): Promise<ClearResult> => {
      const [epoch] = await tx
        .select()
        .from(epochs)
        .where(and(eq(epochs.id, input.epochId), eq(epochs.communityId, input.communityId)))
        .for("update");
      const [member] = await tx
        .select({ id: members.id })
        .from(members)
        .where(and(eq(members.id, input.memberId), eq(members.communityId, input.communityId)));
      if (!epoch || !member) return { status: "not_found" };
      if (epoch.status === "published" || epoch.root !== null) return { status: "published" };
      const [planned] = await tx
        .select({ id: epochPublications.id })
        .from(epochPublications)
        .where(eq(epochPublications.epochId, input.epochId));
      if (planned) return { status: "planned" };
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
      if (!row) return { status: "already_cleared" };
      // After the window no balance can be read any more: a clearance that leaves the member waiting
      // for one would hold the epoch for ever, so it is undone.
      const now = (deps.clock ?? (() => new Date()))();
      if (now.getTime() > epoch.closesAt.getTime() + HOLD_WINDOW_MS) {
        const gate = await payoutGateIn(
          tx,
          { communityId: input.communityId, epochId: epoch.id },
          deps,
        );
        if (gate.members.find((m) => m.memberId === input.memberId)?.status === "held") {
          throw new HoldUnresolved();
        }
      }
      return { status: "cleared", clearedAt: row.clearedAt };
    })
    .catch((e: unknown) => {
      if (e instanceof HoldUnresolved) return { status: "hold_unresolved" } as ClearResult;
      throw e;
    });
}

class HoldUnresolved extends Error {}
