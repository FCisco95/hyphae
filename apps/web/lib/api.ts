// The one way pages read Hyphae: server-side, parsed, and never defaulted. A failure is a state
// the page must show, not a zero (H-CONTRACT A11).

export type Result<T> = { ok: true; data: T } | { ok: false; reason: "not_found" | "unavailable" };

interface Parser<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

const TIMEOUT_MS = 3_000;

export async function getJson<T>(
  path: string,
  schema: Parser<T>,
  fetchImpl: typeof fetch = fetch,
  // fresh: never from a cache, for answers that expire (a claim's blockhash, its paid status).
  { fresh = false }: { fresh?: boolean } = {},
): Promise<Result<T>> {
  const base = process.env.HYPHAE_API_URL;
  if (!base) {
    console.error(JSON.stringify({ web: "HYPHAE_API_URL is not set" }));
    return { ok: false, reason: "unavailable" };
  }
  try {
    const response = await fetchImpl(`${base.replace(/\/$/, "")}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(fresh ? { cache: "no-store" } : { next: { revalidate: 15 } }),
    } as RequestInit);
    // 400 means the path was malformed: for a visitor, a URL that leads nowhere.
    if (response.status === 404 || response.status === 400)
      return { ok: false, reason: "not_found" };
    if (!response.ok) return { ok: false, reason: "unavailable" };
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      console.error(JSON.stringify({ web: "schema mismatch", path }));
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
