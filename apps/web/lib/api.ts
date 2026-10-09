import { headers as requestHeaders } from "next/headers.js";

// The one way pages read Hyphae: server-side, parsed, and never defaulted. A failure is a state
// the page must show, not a zero (H-CONTRACT A11).

export type Result<T> = { ok: true; data: T } | { ok: false; reason: "not_found" | "unavailable" };

interface Parser<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

const TIMEOUT_MS = 3_000;

// The address of the visitor whose page is being rendered (Vercel sets x-real-ip and overwrites
// what a caller sends), or none outside a request.
async function pageVisitor(): Promise<string | null> {
  try {
    return (await requestHeaders()).get("x-real-ip");
  } catch {
    return null;
  }
}

export async function getJson<T>(
  path: string,
  schema: Parser<T>,
  fetchImpl: typeof fetch = fetch,
  // fresh: never from a cache, for answers that expire (a claim's blockhash, its paid status).
  // visitor: the address a read is made for, which the API trusts only with the web's token. By
  // default, the visitor of the page being rendered.
  {
    fresh = false,
    visitor,
    baseUrl,
    anonymous = false,
  }: { fresh?: boolean; visitor?: string | null; baseUrl?: string; anonymous?: boolean } = {},
): Promise<Result<T>> {
  const base = baseUrl ?? process.env.HYPHAE_API_URL;
  if (!base) {
    console.error(JSON.stringify({ web: "HYPHAE_API_URL is not set" }));
    return { ok: false, reason: "unavailable" };
  }
  try {
    // Server-side only: the token never reaches a browser.
    const token = anonymous ? undefined : process.env.HYPHAE_API_TOKEN;
    const headers: Record<string, string> = { accept: "application/json" };
    if (token) {
      headers.authorization = `Bearer ${token}`;
      const who = visitor === undefined ? await pageVisitor() : visitor;
      if (who) headers["x-hyphae-visitor"] = who;
    }
    const response = await fetchImpl(`${base.replace(/\/$/, "")}${path}`, {
      headers,
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
