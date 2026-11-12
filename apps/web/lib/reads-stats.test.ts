import { afterEach, describe, expect, it, vi } from "vitest";
import { communityStats, leaderboard } from "../components/fixtures.js";
import { readStats, readTopAllTime, readTopOfEpoch } from "./reads.js";

vi.mock("next/headers.js", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.5" }),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const api = (status: number, body: unknown) => {
  vi.stubEnv("HYPHAE_API_URL", "https://api.test");
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
};

describe("the optional panel reads", () => {
  it("reads the stats and parses them", async () => {
    const f = api(200, { ...communityStats, added_later: 1 });
    const r = await readStats("MintAbc");
    expect(r).toEqual({ ok: true, data: communityStats });
    expect(f).toHaveBeenCalledWith(
      "https://api.test/v1/communities/MintAbc/stats",
      expect.anything(),
    );
  });

  it("is not found on an api without the route, unavailable on an error or an unknown shape", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    api(404, { error: "not_found" });
    expect(await readStats("MintAbc")).toEqual({ ok: false, reason: "not_found" });
    api(503, { error: "unavailable" });
    expect(await readStats("MintAbc")).toEqual({ ok: false, reason: "unavailable" });
    api(200, { members: "many" });
    expect(await readStats("MintAbc")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("gives up on a slow api after two seconds, not three", async () => {
    vi.stubEnv("HYPHAE_API_URL", "https://api.test");
    const timeout = vi.spyOn(AbortSignal, "timeout");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 404 }));
    await readStats("MintAbc");
    expect(timeout).toHaveBeenCalledWith(2_000);
  });

  it("reads the top ten of an epoch and of all time", async () => {
    const f = api(200, leaderboard);
    await readTopOfEpoch("MintAbc", 2);
    expect(f).toHaveBeenLastCalledWith(
      "https://api.test/v1/communities/MintAbc/leaderboard?epoch=2&limit=10",
      expect.anything(),
    );
    const all = api(200, { ...leaderboard, epoch: null });
    expect(await readTopAllTime("MintAbc")).toMatchObject({ ok: true });
    expect(all).toHaveBeenLastCalledWith(
      "https://api.test/v1/communities/MintAbc/leaderboard?epoch=all&limit=10",
      expect.anything(),
    );
    // An epoch board is not an all-time board.
    api(200, leaderboard);
    expect(await readTopAllTime("MintAbc")).toEqual({ ok: false, reason: "unavailable" });
  });
});
