import { HyphaeAdminError } from "@hyphae/admin-client/source";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as payable from "../app/api/operator/[mint]/epochs/[index]/payable/route.js";
import * as challenge from "../app/api/operator/challenge/route.js";
import * as session from "../app/api/operator/session/route.js";
import {
  clearedCookie,
  fromClientError,
  OPERATOR_COOKIE,
  operatorToken,
  sessionCookie,
} from "./operator-server.js";

const TOKEN = `hop_${"A".repeat(43)}`;
const WALLET = "CCgEo8Yzb5vpfuaCixZ8NVJqv8ssAzXmKm5vsfhfmhe2";
const SITE = "https://hyphae.test";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const upstream = (reply: () => Response) => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => reply());
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("HYPHAE_API_URL", "https://api.test/");
  return fetch;
};
const request = (
  path: string,
  init: RequestInit & { origin?: string | null; cookie?: string } = {},
) => {
  const headers = new Headers(init.headers);
  if (init.origin !== null) headers.set("origin", init.origin ?? SITE);
  if (init.cookie) headers.set("cookie", init.cookie);
  return new Request(`${SITE}${path}`, { ...init, headers });
};
const jsonPost = (path: string, body: unknown, extra: { origin?: string | null } = {}) =>
  request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    ...extra,
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("operator cookie", () => {
  it("reads exactly one well-formed operator cookie", () => {
    expect(operatorToken(`a=1; ${OPERATOR_COOKIE}=${TOKEN}`)).toBe(TOKEN);
    expect(operatorToken(`${OPERATOR_COOKIE}=${TOKEN}; ${OPERATOR_COOKIE}=${TOKEN}`)).toBeNull();
    expect(operatorToken(`${OPERATOR_COOKIE}=hop_short`)).toBeNull();
    expect(operatorToken(`${OPERATOR_COOKIE}=privy.jwt.token`)).toBeNull();
    expect(operatorToken(null)).toBeNull();
  });

  it("is httpOnly, Secure, SameSite=Strict, host-only, and never outlives the session or 4 h", () => {
    const now = Date.parse("2026-11-17T12:00:00.000Z");
    const cookie = sessionCookie(TOKEN, "2026-11-17T13:00:00.000Z", now);
    expect(cookie).toBe(
      `${OPERATOR_COOKIE}=${TOKEN}; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Strict`,
    );
    expect(cookie).not.toMatch(/Domain=/i);
    expect(sessionCookie(TOKEN, "2026-11-18T12:00:00.000Z", now)).toContain("Max-Age=14400;");
    expect(sessionCookie(TOKEN, "2026-11-17T11:00:00.000Z", now)).toContain("Max-Age=0;");
    expect(clearedCookie).toContain("Max-Age=0");
  });

  it("maps client errors to fixed codes", async () => {
    const body = async (r: Response) => [r.status, await r.json()];
    expect(await body(fromClientError(new HyphaeAdminError("disabled", 404)))).toEqual([
      404,
      { error: "disabled" },
    ]);
    expect(await body(fromClientError(new HyphaeAdminError("forbidden", 403)))).toEqual([
      403,
      { error: "forbidden" },
    ]);
    expect(await body(fromClientError(new Error("rpc https://secret/key")))).toEqual([
      503,
      { error: "unavailable" },
    ]);
    expect(await body(fromClientError(new HyphaeAdminError("schema_mismatch")))).toEqual([
      503,
      { error: "unavailable" },
    ]);
  });
});

describe("operator proxy routes", () => {
  it("signs in: the token goes into the cookie and never into the body", async () => {
    const fetch = upstream(() =>
      json({ wallet: WALLET, mint: "MintA", expires_at: "2099-01-01T00:00:00.000Z", token: TOKEN }),
    );
    const response = await session.POST(
      jsonPost("/api/operator/session", {
        challenge_id: "11111111-2222-4333-8444-555555555555",
        signature: "1".repeat(88),
      }),
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain(TOKEN);
    expect(JSON.parse(text)).toEqual({
      wallet: WALLET,
      mint: "MintA",
      expires_at: "2099-01-01T00:00:00.000Z",
    });
    expect(response.headers.get("set-cookie")).toMatch(
      new RegExp(
        `^${OPERATOR_COOKIE}=${TOKEN}; Path=/; Max-Age=14400; HttpOnly; Secure; SameSite=Strict$`,
      ),
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(fetch.mock.calls[0]?.[0]).toBe("https://api.test/admin/v1/operator/session");
  });

  it("refuses a cross-site or non-JSON sign-in before calling the API", async () => {
    const fetch = upstream(() => json({}));
    const body = {
      challenge_id: "11111111-2222-4333-8444-555555555555",
      signature: "1".repeat(88),
    };
    for (const origin of ["https://evil.test", null])
      expect((await session.POST(jsonPost("/api/operator/session", body, { origin }))).status).toBe(
        403,
      );
    expect(
      (
        await challenge.POST(
          jsonPost(
            "/api/operator/challenge",
            { mint: "MintA", wallet: WALLET },
            { origin: "https://evil.test" },
          ),
        )
      ).status,
    ).toBe(403);
    const plain = request("/api/operator/challenge", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    expect((await challenge.POST(plain)).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("passes a disabled API through as disabled", async () => {
    upstream(() => json({ error: "disabled" }, 404));
    const response = await challenge.POST(
      jsonPost("/api/operator/challenge", { mint: "MintA", wallet: WALLET }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "disabled" });
  });

  it("signs out: ends the API session and always clears the cookie", async () => {
    const fetch = upstream(() => json({ ended: true }));
    const response = await session.DELETE(
      request("/api/operator/session", { method: "DELETE", cookie: `${OPERATOR_COOKIE}=${TOKEN}` }),
    );
    expect(response.headers.get("set-cookie")).toBe(clearedCookie);
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: "DELETE" });
    const cross = await session.DELETE(
      request("/api/operator/session", { method: "DELETE", origin: "https://evil.test" }),
    );
    expect(cross.status).toBe(403);
  });

  it("reads the payable list with the cookie only", async () => {
    const fetch = upstream(() => json({ epoch_index: 3, gate_status: "ready", wallets: [WALLET] }));
    const params = { params: Promise.resolve({ mint: "MintA", index: "3" }) };
    expect(
      (await payable.GET(request("/api/operator/MintA/epochs/3/payable"), params)).status,
    ).toBe(401);
    const ok = await payable.GET(
      request("/api/operator/MintA/epochs/3/payable", { cookie: `${OPERATOR_COOKIE}=${TOKEN}` }),
      params,
    );
    expect(await ok.json()).toEqual({ epoch_index: 3, gate_status: "ready", wallets: [WALLET] });
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ authorization: `Bearer ${TOKEN}` }),
      credentials: "omit",
    });
    const bad = { params: Promise.resolve({ mint: "MintA", index: "x" }) };
    expect((await payable.GET(request("/api/operator/MintA/epochs/x/payable"), bad)).status).toBe(
      400,
    );
  });

  it("allows only the documented methods", async () => {
    for (const handler of [challenge.GET, challenge.PUT, session.GET, session.PUT, payable.POST])
      expect((await handler()).status).toBe(405);
  });
});
