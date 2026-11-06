import { afterEach, describe, expect, it, vi } from "vitest";
import { requestAdminState } from "./admin-session.js";

const overview = {
  state: "admin",
  community: { mint: "MintA", name: "Fixture" },
  intake: { paused: false, paused_at: null },
  as_of: "2026-11-06T18:00:00Z",
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("browser administration transport", () => {
  it("uses a same-origin cookie and never browser bearer credentials", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json(overview));
    vi.stubGlobal("fetch", fetch);
    expect((await requestAdminState("MintA", new AbortController().signal)).kind).toBe("admin");
    expect(fetch.mock.calls[0]).toMatchObject([
      "/api/admin/MintA",
      { method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error" },
    ]);
    expect(fetch.mock.calls[0]?.[1]).not.toHaveProperty("headers");
  });
  it("rejects another mint and preserves uncertainty after a bad mutation response", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ ...overview, community: { mint: "Other", name: "Other" } }),
    );
    expect((await requestAdminState("MintA", new AbortController().signal)).kind).toBe(
      "unavailable",
    );
    expect(
      (
        await requestAdminState("MintA", new AbortController().signal, {
          paused: true,
          expected_paused_at: null,
        })
      ).kind,
    ).toBe("write_unknown");
  });
  it("bounds a hung response body without retrying", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => new Response(new ReadableStream({ start() {} })));
    vi.stubGlobal("fetch", fetch);
    const result = requestAdminState("MintA", new AbortController().signal);
    await vi.advanceTimersByTimeAsync(10001);
    expect((await result).kind).toBe("unavailable");
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("never starts a cancelled mutation", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const abort = new AbortController();
    abort.abort();
    expect(
      (await requestAdminState("MintA", abort.signal, { paused: true, expected_paused_at: null }))
        .kind,
    ).toBe("write_unknown");
    expect(fetch).not.toHaveBeenCalled();
  });
});
