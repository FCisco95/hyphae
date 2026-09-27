import { timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";

// A fixed window per client, counted in this process: the api runs as one Fly machine, so the
// limit is per instance. The headers are the IETF RateLimit fields (draft-6 names). A refusal is
// 429 with the closed v1 error `unavailable` (A4: a new error value would need /v2).

export interface RateLimit {
  limit: number;
  windowMs: number;
  now?: () => number;
}

// The window a request counts against, and what it allows.
export interface Budget {
  client: string;
  limit: number;
}

// Past this many clients in memory, expired windows are dropped, then the oldest.
const MAX_CLIENTS = 10_000;

export function rateLimit(
  { windowMs, now = Date.now }: Omit<RateLimit, "limit">,
  budgetOf: (c: Context) => Budget,
): MiddlewareHandler {
  const windows = new Map<string, { used: number; resetAt: number }>();
  return async (c, next) => {
    const t = now();
    const { client, limit } = budgetOf(c);
    let w = windows.get(client);
    if (!w || w.resetAt <= t) {
      windows.delete(client);
      if (windows.size >= MAX_CLIENTS) {
        for (const [k, v] of windows) if (v.resetAt <= t) windows.delete(k);
        for (const k of windows.keys()) {
          if (windows.size < MAX_CLIENTS) break;
          windows.delete(k);
        }
      }
      w = { used: 0, resetAt: t + windowMs };
      windows.set(client, w);
    }
    w.used += 1;
    const reset = String(Math.ceil((w.resetAt - t) / 1000));
    const headers: Record<string, string> = {
      "RateLimit-Policy": `${limit};w=${Math.round(windowMs / 1000)}`,
      "RateLimit-Limit": String(limit),
      "RateLimit-Remaining": String(Math.max(0, limit - w.used)),
      "RateLimit-Reset": reset,
    };
    if (w.used > limit)
      return c.json({ error: "unavailable" }, 429, { ...headers, "Retry-After": reset });
    await next();
    for (const [name, value] of Object.entries(headers)) c.header(name, value);
  };
}

const VISITOR = /^[0-9A-Fa-f:.]{1,45}$/;

// Fly's proxy sets Fly-Client-IP itself, so a caller is counted by it; off Fly (local runs) every
// caller shares one window. The web server calls from a few shared addresses on its visitors'
// behalf: with its bearer token, and only then, the visitor address it names is trusted and
// counted on its own, and its own page reads, which it caches, share a ten times larger window.
export function budgets(limit: number, webToken?: string) {
  const expected = webToken ? Buffer.from(`Bearer ${webToken}`) : null;
  const fromWeb = (auth: string | undefined) => {
    if (!expected || !auth) return false;
    const got = Buffer.from(auth);
    return got.length === expected.length && timingSafeEqual(got, expected);
  };
  return (c: Context): Budget => {
    if (fromWeb(c.req.header("authorization"))) {
      const visitor = c.req.header("x-hyphae-visitor");
      if (visitor && VISITOR.test(visitor)) return { client: `visitor:${visitor}`, limit };
      return { client: "web", limit: limit * 10 };
    }
    return { client: `ip:${c.req.header("fly-client-ip") ?? "local"}`, limit };
  };
}
