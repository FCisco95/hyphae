import { type Db, members } from "@hyphae/db";
import { eq } from "drizzle-orm";

export const MAX_HANDLES = 3;

export type BindResult =
  | { ok: true; handles: string[]; bound: boolean }
  | { ok: false; handles: string[] };

// A member may submit from up to three X accounts. Ownership is not verified (no X OAuth in
// Hyphae v1; Organic owns identity), so the cap is what keeps one member from claiming posts by many.
export function bindHandle(handles: string[], handle: string): BindResult {
  const known = handles.some((h) => h.toLowerCase() === handle.toLowerCase());
  if (known) return { ok: true, handles, bound: false };
  if (handles.length >= MAX_HANDLES) return { ok: false, handles };
  return { ok: true, handles: [...handles, handle], bound: true };
}

// Binds against the stored handles with the member row locked, so two submissions binding new
// handles at once cannot overwrite each other or pass the cap. NO KEY UPDATE leaves foreign-key
// inserts that reference the member (contributions) unblocked.
export async function bindMemberHandle(db: Db, memberId: string, handle: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ xHandles: members.xHandles })
      .from(members)
      .where(eq(members.id, memberId))
      .for("no key update");
    if (!row) throw new Error(`handles: member ${memberId} missing`);
    const bind = bindHandle(row.xHandles, handle);
    if (bind.ok && bind.bound) {
      await tx.update(members).set({ xHandles: bind.handles }).where(eq(members.id, memberId));
    }
    return bind;
  });
}
