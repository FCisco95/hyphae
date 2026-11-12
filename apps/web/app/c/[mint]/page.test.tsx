import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { community, communityStats, leaderboard } from "../../../components/fixtures.js";
import {
  readCommunity,
  readRaids,
  readStats,
  readTopAllTime,
  readTopOfEpoch,
} from "../../../lib/reads.js";
import CommunityPage from "./page.js";

vi.mock("../../../lib/reads.js", () => ({
  readCommunity: vi.fn(),
  readRaids: vi.fn(),
  readStats: vi.fn(),
  readTopAllTime: vi.fn(),
  readTopOfEpoch: vi.fn(),
}));
vi.mock("../../../lib/member-login-server.js", () => ({ readMemberLoginConfig: async () => null }));
vi.mock("../../../components/raid-refresh.js", () => ({ RaidRefresh: () => null }));
vi.mock("next/navigation.js", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const params = Promise.resolve({ mint: community.mint });
const render = async (searchParams?: { board?: string }) =>
  renderToStaticMarkup(
    await CommunityPage({
      params,
      ...(searchParams ? { searchParams: Promise.resolve(searchParams) } : {}),
    }),
  );

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readCommunity).mockResolvedValue({ ok: true, data: community });
  vi.mocked(readRaids).mockResolvedValue({ ok: false, reason: "unavailable" });
  vi.mocked(readTopOfEpoch).mockResolvedValue({ ok: true, data: leaderboard });
  vi.mocked(readTopAllTime).mockResolvedValue({
    ok: true,
    data: { ...leaderboard, epoch: null },
  } as never);
});

describe("the community page and the stats read", () => {
  it("shows the new panels when the api answers, with the current epoch's board first", async () => {
    vi.mocked(readStats).mockResolvedValue({ ok: true, data: communityStats });
    const html = await render();
    expect(html).toContain("At a glance");
    expect(readTopOfEpoch).toHaveBeenCalledWith(community.mint, 2);
    expect(readTopAllTime).not.toHaveBeenCalled();
  });

  it("reads the all-time board when asked, and the epoch board is not read", async () => {
    vi.mocked(readStats).mockResolvedValue({ ok: true, data: communityStats });
    const html = await render({ board: "all" });
    expect(readTopAllTime).toHaveBeenCalledWith(community.mint);
    expect(readTopOfEpoch).not.toHaveBeenCalled();
    expect(html).toContain("Every epoch added together");
  });

  it.each([
    ["404, an api without the route", { ok: false, reason: "not_found" }],
    ["a timeout or a server error", { ok: false, reason: "unavailable" }],
  ] as const)(
    "renders the page as it was on %s: no panel, no error, no board read",
    async (_, result) => {
      vi.mocked(readStats).mockResolvedValue(result);
      const html = await render({ board: "all" });
      expect(html).not.toContain("At a glance");
      expect(html).not.toContain("Unavailable right now");
      expect(html).toContain("Epoch history");
      expect(readTopAllTime).not.toHaveBeenCalled();
      expect(readTopOfEpoch).not.toHaveBeenCalled();
    },
  );

  it("still answers not found for an unknown community, whatever the stats say", async () => {
    vi.mocked(readCommunity).mockResolvedValue({ ok: false, reason: "not_found" });
    vi.mocked(readStats).mockResolvedValue({ ok: false, reason: "not_found" });
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
