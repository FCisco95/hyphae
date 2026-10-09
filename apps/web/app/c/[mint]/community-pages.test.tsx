import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { community } from "../../../components/fixtures.js";
import { readCommunity } from "../../../lib/reads.js";
import AboutPage from "./about/page.js";
import JoinPage from "./join/page.js";
import MemberPage from "./me/page.js";

vi.mock("../../../lib/reads.js", () => ({ readCommunity: vi.fn() }));
vi.mock("next/navigation.js", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/headers.js", () => ({
  headers: async () => new Headers({ host: "localhost:3010" }),
}));

describe.each([
  ["context", AboutPage],
  ["join", JoinPage],
  ["account", MemberPage],
] as const)("%s page reads", (_, page) => {
  beforeEach(() => vi.clearAllMocks());

  it("returns not-found for an unknown community", async () => {
    vi.mocked(readCommunity).mockResolvedValue({ ok: false, reason: "not_found" });
    await expect(page({ params: Promise.resolve({ mint: "UnknownMint" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("shows unavailable rather than a guessed community when the read fails", async () => {
    vi.mocked(readCommunity).mockResolvedValue({ ok: false, reason: "unavailable" });
    const html = renderToStaticMarkup(
      await page({ params: Promise.resolve({ mint: "UnknownMint" }) }),
    );
    expect(html).toContain("Unavailable right now");
    expect(html).not.toContain("/join");
  });

  it("uses the server response's identity for all member navigation", async () => {
    vi.mocked(readCommunity).mockResolvedValue({ ok: true, data: community });
    const html = renderToStaticMarkup(
      await page({ params: Promise.resolve({ mint: community.mint }) }),
    );
    expect(readCommunity).toHaveBeenCalledWith(community.mint);
    expect(html).toContain(`href="/c/${community.mint}/join"`);
    expect(html).not.toMatch(/start=link_|\/link#/);
  });
});

it("keeps the member page disabled before verified provider activation", async () => {
  vi.mocked(readCommunity).mockResolvedValue({ ok: true, data: community });
  const html = renderToStaticMarkup(
    await MemberPage({ params: Promise.resolve({ mint: community.mint }) }),
  );
  expect(html).toContain("Sign-in is not available yet");
  expect(html).toContain("Sign in with email");
  expect(html.match(/disabled=""/g)).toHaveLength(2);
});
