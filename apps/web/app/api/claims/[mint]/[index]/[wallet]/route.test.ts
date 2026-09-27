import { afterEach, describe, expect, it, vi } from "vitest";
import * as f from "../../../../../../components/fixtures.js";
import { GET } from "./route.js";

const params = (wallet: string) =>
  ({ params: Promise.resolve({ mint: "MintAbc", index: "2", wallet }) }) as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/claims/:mint/:index/:wallet", () => {
  it("passes a claim through from the API, uncached", async () => {
    vi.stubEnv("HYPHAE_API_URL", "https://api.test");
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(f.claim)));
    vi.stubGlobal("fetch", fetchMock);
    const r = await GET(new Request("https://site.test/"), params(f.claim.wallet));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual(f.claim);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://api.test/v1/communities/MintAbc/epochs/2/claims/${f.claim.wallet}`,
    );
  });

  // The API limits requests per address, and every visitor's read comes from this server.
  it("names the visitor to the API with the web's token, and only with it", async () => {
    vi.stubEnv("HYPHAE_API_URL", "https://api.test");
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(f.claim)),
    );
    vi.stubGlobal("fetch", fetchMock);
    const from = new Request("https://site.test/", { headers: { "x-real-ip": "203.0.113.9" } });
    await GET(from, params(f.claim.wallet));
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({ accept: "application/json" });
    vi.stubEnv("HYPHAE_API_TOKEN", "k".repeat(40));
    await GET(from, params(f.claim.wallet));
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({
      accept: "application/json",
      authorization: `Bearer ${"k".repeat(40)}`,
      "x-hyphae-visitor": "203.0.113.9",
    });
  });

  it("answers 404 for no leaf and 503 when the API is unavailable, never a default", async () => {
    vi.stubEnv("HYPHAE_API_URL", "https://api.test");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => new Response('{"error":"not_found"}', { status: 404 }));
    expect((await GET(new Request("https://site.test/"), params(f.claim.wallet))).status).toBe(404);
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 503 }));
    const down = await GET(new Request("https://site.test/"), params(f.claim.wallet));
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ error: "unavailable" });
  });
});
