import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { organicKey, organicSignature, verifyOrganic } from "./hmac.js";

const key = { id: "organic-dev-1", secret: "s".repeat(32) };
const PATH = "/v1/integrations/communities/Mint1/raids";
const body = new TextEncoder().encode('{"a":1}');
const NOW = 1_793_000_000_000;
const ts = String(NOW / 1000);
const header = (sig: string, at = ts, id = key.id) =>
  `Organic-HMAC keyId=${id}, ts=${at}, sig=${sig}`;
const request = (authorization: string, over: Partial<{ method: string; path: string }> = {}) => ({
  authorization,
  method: "POST",
  path: PATH,
  body,
  ...over,
});

describe("Organic's request signature", () => {
  it("is HMAC-SHA256 over method, path, ts and the body's SHA-256, all lowercase hex", () => {
    const bodyHash = createHash("sha256").update(body).digest("hex");
    const expected = createHmac("sha256", key.secret)
      .update(`POST\n${PATH}\n${ts}\n${bodyHash}`)
      .digest("hex");
    expect(organicSignature(key.secret, "post", PATH, ts, body)).toBe(expected);
  });

  it("accepts a signed request within 60 seconds either way", () => {
    for (const skew of [-60, 0, 60]) {
      const at = String(NOW / 1000 + skew);
      const sig = organicSignature(key.secret, "POST", PATH, at, body);
      expect(verifyOrganic(key, request(header(sig, at)), NOW)).toEqual({
        ok: true,
        keyId: key.id,
      });
    }
  });

  it("calls a correctly signed request older or newer than 60 seconds stale", () => {
    for (const skew of [-61, 61]) {
      const at = String(NOW / 1000 + skew);
      const sig = organicSignature(key.secret, "POST", PATH, at, body);
      expect(verifyOrganic(key, request(header(sig, at)), NOW)).toEqual({
        ok: false,
        reason: "stale",
      });
    }
  });

  it("refuses a wrong key, key id, method, path or body, and a malformed header", () => {
    const good = organicSignature(key.secret, "POST", PATH, ts, body);
    const refused = { ok: false, reason: "unauthorized" };
    const other = organicSignature("t".repeat(32), "POST", PATH, ts, body);
    expect(verifyOrganic(key, request(header(other)), NOW)).toEqual(refused);
    expect(verifyOrganic(key, request(header(good, ts, "organic-dev-2")), NOW)).toEqual(refused);
    expect(verifyOrganic(key, request(header(good), { method: "PUT" }), NOW)).toEqual(refused);
    expect(verifyOrganic(key, request(header(good), { path: `${PATH}x` }), NOW)).toEqual(refused);
    expect(
      verifyOrganic(key, { ...request(header(good)), body: new TextEncoder().encode("{}") }, NOW),
    ).toEqual(refused);
    for (const bad of [
      "",
      `Bearer ${good}`,
      header(good.toUpperCase()),
      header(good.slice(1)),
      `${header(good)} `,
      header(good).replace(", ", ","),
    ])
      expect(verifyOrganic(key, request(bad), NOW)).toEqual(refused);
    expect(verifyOrganic(key, { ...request(header(good)), authorization: undefined }, NOW)).toEqual(
      refused,
    );
  });

  it("is configured only with a well-formed key id and a secret of at least 32 bytes", () => {
    expect(organicKey(key.id, key.secret)).toEqual(key);
    expect(organicKey(undefined, key.secret)).toBeNull();
    expect(organicKey(key.id, undefined)).toBeNull();
    expect(organicKey(key.id, "s".repeat(31))).toBeNull();
    expect(organicKey("bad id", key.secret)).toBeNull();
    expect(organicKey("", "")).toBeNull();
  });
});
