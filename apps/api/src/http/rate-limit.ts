import type { Context, MiddlewareHandler } from "hono";

// A fixed window per client, counted in this process: the api runs as one Fly machine, so the
// limit is per instance. The headers are the IETF RateLimit fields (draft-6 names). A refusal is
// 429 with the closed v1 error `unavailable` (A4: a new error value would need /v2).

export interface RateLimit {
  limit: number;
  windowMs: number;
  now?: () => number;
}

// Past this many clients in memory, expired windows are dropped, then the oldest.
const MAX_CLIENTS = 10_000;

export function rateLimit(
  { limit, windowMs, now = Date.now }: RateLimit,
  clientOf: (c: Context) => string,
): MiddlewareHandler {
  const windows = new Map<string, { used: number; resetAt: number }>();
  const policy = `${limit};w=${Math.round(windowMs / 1000)}`;
  return async (c, next) => {
    const t = now();
    const client = clientOf(c);
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
      "RateLimit-Policy": policy,
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

// Fly's proxy sets Fly-Client-IP itself; off Fly (local runs) every caller shares one window.
export const flyClient = (c: Context) => c.req.header("fly-client-ip") ?? "local";
