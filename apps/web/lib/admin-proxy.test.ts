import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminProxy } from "./admin-proxy.js";

const token = "fixture.payload.signature";
const overview = {
  state: "admin",
  community: { mint: "MintA", name: "Fixture" },
  intake: { paused: false, paused_at: null },
  as_of: "2026-11-06T18:00:00Z",
};
const context = { params: Promise.resolve({ mint: "MintA" }) };
const update = { paused: true, expected_paused_at: null };
function request(method = "GET", headers: Record<string, string> = {}, body?: string) {
  return new Request(`https://web.test/api/admin/MintA${method === "PUT" ? "/intake" : ""}`, {
    method,
    headers: {
      cookie: `privy-token=${token}`,
      origin: "https://web.test",
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined ? {} : { body }),
  });
}
beforeEach(() => {
  vi.stubEnv("HYPHAE_ADMIN_ENABLED", "on");
  vi.stubEnv("PRIVY_LOGIN_ENABLED", "on");
  vi.stubEnv("PRIVY_LOGIN_HOST", "web.test");
  vi.stubEnv("PRIVY_APP_ID", "fixture");
  vi.stubEnv("HYPHAE_API_URL", "https://api.test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(overview)),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function expectPrivate(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
  expect(JSON.stringify(await response.json())).not.toContain(token);
}
describe("admin cookie proxy", () => {
  it.each(["HYPHAE_ADMIN_ENABLED", "PRIVY_LOGIN_ENABLED"])(
    "fails closed without %s",
    async (flag) => {
      vi.stubEnv(flag, "off");
      await expectPrivate(await adminProxy(request(), context, "GET"), 404);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("accepts only the configured host", async () => {
    vi.stubEnv("PRIVY_LOGIN_HOST", "other.test");
    await expectPrivate(await adminProxy(request(), context, "GET"), 404);
  });
  it.each([
    "privy-token=bad",
    `privy-token=${token}; privy-token=${token}`,
    "",
    `privy-token=${"x".repeat(4097)}`,
  ])("rejects ambiguous or invalid credentials", async (cookie) => {
    await expectPrivate(
      await adminProxy(
        request("GET", { cookie, authorization: `Bearer ${token}` }),
        context,
        "GET",
      ),
      401,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["https://other.test", "null", "", "https://web.test.evil", "https://web.test:444"])(
    "rejects PUT origin %s",
    async (origin) => {
      await expectPrivate(
        await adminProxy(request("PUT", { origin }, JSON.stringify(update)), context, "PUT"),
        403,
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it.each(["text/plain", "application/jsonp", "application/json; charset=iso-8859-1"])(
    "rejects non-JSON content %s",
    async (contentType) => {
      await expectPrivate(
        await adminProxy(
          request("PUT", { "content-type": contentType }, JSON.stringify(update)),
          context,
          "PUT",
        ),
        400,
      );
    },
  );
  it.each([JSON.stringify({ ...update, mint: "Other" }), "not json", " ".repeat(1025)])(
    "rejects invalid, unknown or oversized updates",
    async (body) => {
      await expectPrivate(await adminProxy(request("PUT", {}, body), context, "PUT"), 400);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("forwards the cookie only and never browser-supplied technical credentials", async () => {
    await expectPrivate(
      await adminProxy(
        request(
          "PUT",
          {
            authorization: "Bearer forged",
            "x-hyphae-web-token": "forged",
            "x-hyphae-visitor": "1.2.3.4",
          },
          JSON.stringify(update),
        ),
        context,
        "PUT",
      ),
      200,
    );
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).toEqual({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    });
  });
  it("rejects selectors and hostile mints", async () => {
    await expectPrivate(
      await adminProxy(new Request("https://web.test/api/admin/MintA?actor=other"), context, "GET"),
      400,
    );
    await expectPrivate(
      await adminProxy(request(), { params: Promise.resolve({ mint: "../other" }) }, "GET"),
      400,
    );
  });
});
