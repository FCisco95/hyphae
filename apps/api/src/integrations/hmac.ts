import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Organic's server-to-server signature (contract 2026-10-30 §7):
//   Authorization: Organic-HMAC keyId=<id>, ts=<unix seconds>, sig=<hex>
// sig = lowercase hex HMAC-SHA256, keyed with the shared secret's UTF-8 bytes, of
//   <METHOD>\n<path>\n<ts>\n<lowercase hex SHA-256 of the raw body bytes>
// where path is the request path without a query string.

export interface OrganicKey {
  id: string;
  secret: string;
}

export const MAX_SKEW_SECONDS = 60;
const KEY_ID = /^[A-Za-z0-9._-]{1,64}$/;
const HEADER = /^Organic-HMAC keyId=([A-Za-z0-9._-]{1,64}), ts=(\d{1,12}), sig=([0-9a-f]{64})$/;

// Both values, well formed, or no key: a partial or weak configuration disables the route.
export function organicKey(id: string | undefined, secret: string | undefined): OrganicKey | null {
  if (!id || !secret || !KEY_ID.test(id) || Buffer.byteLength(secret) < 32) return null;
  return { id, secret };
}

export const sha256Hex = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

export function organicSignature(
  secret: string,
  method: string,
  path: string,
  ts: string,
  body: Uint8Array | string,
): string {
  return createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(`${method.toUpperCase()}\n${path}\n${ts}\n${sha256Hex(body)}`)
    .digest("hex");
}

export type Verdict = { ok: true; keyId: string } | { ok: false; reason: "unauthorized" | "stale" };

export function verifyOrganic(
  key: OrganicKey,
  request: { authorization: string | undefined; method: string; path: string; body: Uint8Array },
  nowMs: number,
): Verdict {
  const header = request.authorization;
  const match = header && header.length <= 256 ? HEADER.exec(header) : null;
  if (!match) return { ok: false, reason: "unauthorized" };
  const [, keyId, ts, sig] = match as unknown as [string, string, string, string];
  if (keyId !== key.id) return { ok: false, reason: "unauthorized" };
  const expected = Buffer.from(
    organicSignature(key.secret, request.method, request.path, ts, request.body),
    "hex",
  );
  if (!timingSafeEqual(expected, Buffer.from(sig, "hex")))
    return { ok: false, reason: "unauthorized" };
  // Checked after the signature, so an unsigned caller learns nothing about the clock.
  if (Math.abs(Math.floor(nowMs / 1000) - Number(ts)) > MAX_SKEW_SECONDS)
    return { ok: false, reason: "stale" };
  return { ok: true, keyId };
}
