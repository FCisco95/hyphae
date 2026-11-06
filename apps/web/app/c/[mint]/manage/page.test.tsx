import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { community } from "../../../../components/fixtures.js";
import { readMemberLoginConfig } from "../../../../lib/member-login-server.js";
import { readCommunity } from "../../../../lib/reads.js";
import ManagePage from "./page.js";

vi.mock("../../../../lib/reads.js", () => ({ readCommunity: vi.fn() }));
vi.mock("../../../../lib/member-login-server.js", () => ({ readMemberLoginConfig: vi.fn() }));
vi.mock("../../../../components/community-admin.js", () => ({
  AdminProvider: () => <p>Fixture administrator controls</p>,
}));
vi.mock("next/navigation.js", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
const params = { params: Promise.resolve({ mint: community.mint }) };
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
describe("community manage page", () => {
  it("keeps the page useful when admin controls are off", async () => {
    vi.stubEnv("HYPHAE_ADMIN_ENABLED", "off");
    vi.mocked(readCommunity).mockResolvedValue({ ok: true, data: community });
    const html = renderToStaticMarkup(await ManagePage(params));
    expect(html).toContain("Manage community");
    expect(html).not.toContain("Fixture administrator controls");
    expect(readMemberLoginConfig).not.toHaveBeenCalled();
  });
  it.each([null, { appId: "fixture" }])(
    "requires both admin flag and existing verified login config",
    async (config) => {
      vi.stubEnv("HYPHAE_ADMIN_ENABLED", "on");
      vi.mocked(readCommunity).mockResolvedValue({ ok: true, data: community });
      vi.mocked(readMemberLoginConfig).mockResolvedValue(config);
      const html = renderToStaticMarkup(await ManagePage(params));
      expect(html.includes("Fixture administrator controls")).toBe(config !== null);
    },
  );
  it("distinguishes unknown communities from an unavailable read", async () => {
    vi.mocked(readCommunity).mockResolvedValue({ ok: false, reason: "not_found" });
    await expect(ManagePage(params)).rejects.toThrow("NEXT_NOT_FOUND");
    vi.mocked(readCommunity).mockResolvedValue({ ok: false, reason: "unavailable" });
    expect(renderToStaticMarkup(await ManagePage(params))).toContain("Unavailable right now");
  });
  it("never manages another community returned for the requested mint", async () => {
    vi.mocked(readCommunity).mockResolvedValue({
      ok: true,
      data: { ...community, mint: "OtherMint" },
    });
    const html = renderToStaticMarkup(await ManagePage(params));
    expect(html).toContain("Unavailable right now");
    expect(html).not.toContain("OtherMint");
  });
});
