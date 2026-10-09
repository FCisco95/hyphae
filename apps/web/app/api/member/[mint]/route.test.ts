import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route.js";

const valid = {
  community: { mint: "MintA", name: "Fixture" },
  as_of: "2026-10-09T12:00:00.000Z",
  state: "telegram_required",
};
const token = "fixture.payload.signature";
const context = { params: Promise.resolve({ mint: "MintA" }) };
const request = (cookie?: string, query = "") =>
  new Request(`https://web.test/api/member/MintA${query}`, {
    headers: cookie === undefined ? {} : { cookie },
  });
beforeEach(() => {
  vi.stubEnv("PRIVY_LOGIN_ENABLED", "on");
  vi.stubEnv("PRIVY_LOGIN_HOST", "web.test");
  vi.stubEnv("PRIVY_APP_ID", "fixture-only");
  vi.stubEnv("HYPHAE_API_URL", "https://fixture.test");
  vi.stubGlobal("fetch", async () => Response.json(valid));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function privateResponse(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
  expect(response.headers.get("set-cookie")).toBeNull();
  const body = await response.json();
  expect(JSON.stringify(body)).not.toContain(token);
  return body;
}
describe("same-origin private member route", () => {
  it.each(["off", ""])("keeps the proxy off when activation is %s", async (enabled) => {
    vi.stubEnv("PRIVY_LOGIN_ENABLED", enabled);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await privateResponse(await GET(request(`privy-token=${token}`), context), 404);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps the proxy off on a preview host", async () => {
    await privateResponse(
      await GET(
        new Request("https://preview.test/api/member/MintA", {
          headers: { cookie: `privy-token=${token}` },
        }),
        context,
      ),
      404,
    );
  });
  it("forwards a trusted visitor only with the server web credential", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("HYPHAE_API_TOKEN", "fixture-web-only");
    let headers: unknown;
    vi.stubGlobal("fetch", async (_input: unknown, init: RequestInit) => {
      headers = init.headers;
      return Response.json(valid);
    });
    await privateResponse(
      await GET(
        new Request("https://web.test/api/member/MintA", {
          headers: {
            cookie: `privy-token=${token}`,
            "x-real-ip": "198.51.100.1",
            "x-hyphae-web-token": "forged",
            "x-hyphae-visitor": "198.51.100.2",
          },
        }),
        context,
      ),
      200,
    );
    expect(headers).toEqual({
      Authorization: `Bearer ${token}`,
      "x-hyphae-web-token": "fixture-web-only",
      "x-hyphae-visitor": "198.51.100.1",
    });
  });
  it("reads only the intended access cookie", async () => {
    let headers: unknown;
    vi.stubGlobal("fetch", async (_input: unknown, init: RequestInit) => {
      headers = init.headers;
      return Response.json(valid);
    });
    expect(
      await privateResponse(
        await GET(request(`other=secret; privy-token=${token}; privy-id-token=private`), context),
        200,
      ),
    ).toEqual(valid);
    expect(headers).toEqual({ Authorization: `Bearer ${token}` });
  });
  it.each([
    undefined,
    "",
    "other=secret",
    "privy-token=invalid",
    `privy-token=${token}; privy-token=${token}`,
    `privy-token=${"x".repeat(4097)}`,
  ])("refuses missing, malformed or ambiguous credentials", async (cookie) => {
    await privateResponse(await GET(request(cookie), context), 401);
  });
  it("does not trust a browser bearer in place of the cookie", async () => {
    await privateResponse(
      await GET(
        new Request("https://web.test/api/member/MintA", {
          headers: { authorization: `Bearer ${token}` },
        }),
        context,
      ),
      401,
    );
  });
  it("refuses identity selectors before forwarding", async () => {
    await privateResponse(
      await GET(request(`privy-token=${token}`, "?member=other"), context),
      400,
    );
  });
  it("refuses hostile mints", async () => {
    await privateResponse(
      await GET(request(`privy-token=${token}`), {
        params: Promise.resolve({ mint: "../private" }),
      }),
      400,
    );
  });
  it("stays unavailable with missing server configuration", async () => {
    vi.stubEnv("HYPHAE_API_URL", "");
    await privateResponse(await GET(request(`privy-token=${token}`), context), 503);
  });
  it.each([401, 404, 429, 503])("preserves a private upstream %s", async (status) => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ error: "raw private profile", subject: "private" }, { status }),
    );
    await privateResponse(await GET(request(`privy-token=${token}`), context), status);
  });
  it("fails closed on upstream shape mismatch", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ ...valid, member_id: "private" }));
    await privateResponse(await GET(request(`privy-token=${token}`), context), 503);
  });
});
