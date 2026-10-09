import { afterEach, expect, it, vi } from "vitest";
import { readRaids } from "./reads.js";

vi.mock("next/headers.js", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.5" }),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const response = () => {
  vi.stubEnv("HYPHAE_API_URL", "https://api.test");
  vi.stubEnv("HYPHAE_API_TOKEN", "k".repeat(40));
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        community: { mint: "MintA" },
        reward_intake: "open",
        raids: [],
        as_of: "2026-10-09T18:00:00Z",
      }),
    ),
  );
};
it("shares the short-lived public read without sending web tokens or visitor addresses", async () => {
  const fetchMock = response();
  await readRaids("MintA");
  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.test/v1/communities/MintA/raids",
    expect.objectContaining({ headers: { accept: "application/json" }, next: { revalidate: 15 } }),
  );
});
it("never uses an arbitrary preview origin or enables the override on Vercel", async () => {
  for (const [url, vercel, preview] of [
    ["https://evil.test", "", "on"],
    ["http://127.0.0.1:3011", "1", "on"],
    ["http://127.0.0.1:3011", "", ""],
  ]) {
    const fetchMock = response();
    vi.stubEnv("HYPHAE_RAID_API_URL", url as string);
    vi.stubEnv("VERCEL", vercel as string);
    vi.stubEnv("HYPHAE_LOCAL_PREVIEW", preview as string);
    await readRaids("MintA");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.test/v1/communities/MintA/raids");
    fetchMock.mockRestore();
  }
});
it("allows only the explicit loopback preview and still sends no token", async () => {
  const fetchMock = response();
  vi.stubEnv("HYPHAE_RAID_API_URL", "http://127.0.0.1:3011");
  vi.stubEnv("HYPHAE_LOCAL_PREVIEW", "on");
  vi.stubEnv("VERCEL", "");
  await readRaids("MintA");
  expect(fetchMock).toHaveBeenCalledWith(
    "http://127.0.0.1:3011/v1/communities/MintA/raids",
    expect.objectContaining({ headers: { accept: "application/json" } }),
  );
});
