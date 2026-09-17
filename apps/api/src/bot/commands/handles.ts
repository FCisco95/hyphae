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
