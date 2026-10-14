import type { PublicRaid } from "@hyphae/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { card } from "../../../../../../components/og.js";
import { readRaids } from "../../../../../../lib/reads.js";
import { GET } from "./route.js";

vi.mock("../../../../../../components/og.js", () => ({
  card: vi.fn(async () => new Response("png", { headers: { "content-type": "image/png" } })),
}));
vi.mock("../../../../../../lib/reads.js", () => ({ readRaids: vi.fn() }));

const ID = "6f1c1d2e-0000-4000-8000-000000000001";
const raid = (over: Partial<PublicRaid> = {}): PublicRaid => ({
  id: ID,
  status: "open",
  opens_at: "2026-10-14T08:47:00Z",
  closes_at: "2026-10-15T08:47:00Z",
  brief: "",
  post: { url: "https://x.com/organic_mycel/status/1", handle: "organic_mycel", text: "GM" },
  ...over,
});
const raids = (list: PublicRaid[]) =>
  vi.mocked(readRaids).mockResolvedValue({
    ok: true,
    data: {
      community: { mint: "MintAbc" },
      reward_intake: "open",
      raids: list,
      as_of: "2026-10-14T09:00:00Z",
    },
  });
const get = (taskId = ID) =>
  GET(new Request("https://site.test/"), {
    params: Promise.resolve({ mint: "MintAbc", taskId }),
  });

afterEach(() => vi.clearAllMocks());

describe("GET /c/:mint/r/:taskId/card", () => {
  it("draws an open raid's card from the public read", async () => {
    raids([raid()]);
    const r = await get();
    expect(r.status).toBe(200);
    expect(card).toHaveBeenCalledWith({
      context: "Raid · 24h · @organic_mycel",
      title: "GM",
      footer: "Reply or quote it on X, then submit it to the bot.",
      size: "post",
    });
  });

  // A raid that opened a moment ago is missing from a cached list, and its card would 404.
  it("reads the raids fresh, never from the cache", async () => {
    raids([raid()]);
    await get();
    expect(readRaids).toHaveBeenCalledWith("MintAbc", { fresh: true });
  });

  it("answers 404 for an unknown task id and for a raid with no card", async () => {
    raids([raid()]);
    expect((await get("6f1c1d2e-0000-4000-8000-000000000099")).status).toBe(404);
    raids([raid({ status: "cancelled" })]);
    expect((await get()).status).toBe(404);
    expect(card).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown community and 503 when the read fails", async () => {
    vi.mocked(readRaids).mockResolvedValue({ ok: false, reason: "not_found" });
    expect((await get()).status).toBe(404);
    vi.mocked(readRaids).mockResolvedValue({ ok: false, reason: "unavailable" });
    const down = await get();
    expect(down.status).toBe(503);
    expect(await down.text()).toBe("Raids unavailable");
    expect(card).not.toHaveBeenCalled();
  });
});
