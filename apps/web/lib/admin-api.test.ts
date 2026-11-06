import { afterEach, describe, expect, it, vi } from "vitest";
import { requestPrivateAdmin } from "./admin-api.js";

const overview = {
  state: "admin",
  community: { mint: "MintA", name: "Fixture" },
  intake: { paused: false, paused_at: null },
  as_of: "2026-11-06T18:00:00Z",
};
const input = { mint: "MintA", token: "fixture.payload.signature", apiUrl: "https://api.test" };
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("private admin transport", () => {
  it("forwards only validated updates and returns a parsed matching overview", async () => {
    const fetch = vi.fn(async () => Response.json(overview));
    vi.stubGlobal("fetch", fetch);
    expect(
      await requestPrivateAdmin({ ...input, update: { paused: true, expected_paused_at: null } }),
    ).toEqual({ status: 200, body: overview });
    expect(fetch.mock.calls[0]).toMatchObject([
      "https://api.test/admin/v1/communities/MintA/intake",
      {
        method: "PUT",
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        body: JSON.stringify({ paused: true, expected_paused_at: null }),
      },
    ]);
  });
  it.each([403, 409, 429, 404, 401, 503])(
    "redacts upstream errors with status %s",
    async (status) => {
      vi.stubGlobal("fetch", async () =>
        Response.json({ error: "private details", token: input.token }, { status }),
      );
      const result = await requestPrivateAdmin(input);
      expect(result.status).toBe(status);
      expect(JSON.stringify(result.body)).not.toMatch(/private details|fixture/);
    },
  );
  it.each([
    { ...overview, community: { mint: "Other", name: "Other" } },
    { ...overview, actor: "private" },
    { ...overview, intake: { paused: true, paused_at: null } },
  ])("rejects mismatched or private responses", async (body) => {
    vi.stubGlobal("fetch", async () => Response.json(body));
    expect((await requestPrivateAdmin(input)).status).toBe(503);
  });
  it("bounds streamed responses", async () => {
    vi.stubGlobal("fetch", async () => new Response(" ".repeat(16385)));
    expect((await requestPrivateAdmin(input)).status).toBe(503);
  });
  it("bounds a hung response body and removes its pending reader", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    vi.stubGlobal("fetch", async () => new Response(new ReadableStream({ start() {}, cancel })));
    const result = requestPrivateAdmin(input);
    await vi.advanceTimersByTimeAsync(5501);
    expect((await result).status).toBe(503);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it.each([
    "http://api.test",
    "https://name:secret@api.test",
    "https://api.test/path",
    "https://api.test/?secret=x",
  ])("rejects unsafe upstream %s", async (apiUrl) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await requestPrivateAdmin({ ...input, apiUrl })).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("times out even if a custom transport ignores cancellation", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    const read = requestPrivateAdmin(input);
    await vi.advanceTimersByTimeAsync(5501);
    expect((await read).status).toBe(503);
  });
  it("never starts a mutation after cancellation", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const abort = new AbortController();
    abort.abort();
    expect(
      (
        await requestPrivateAdmin({
          ...input,
          signal: abort.signal,
          update: { paused: true, expected_paused_at: null },
        })
      ).status,
    ).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
});
