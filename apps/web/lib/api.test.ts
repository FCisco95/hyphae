import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { getJson } from "./api.js";

const Schema = z.object({ mint: z.string() });

const respond = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getJson", () => {
  it("returns the parsed body of a valid 200", async () => {
    vi.stubEnv("HYPHAE_API_URL", "https://api.test/");
    const fetchImpl = respond(200, { mint: "M", added_later: 1 });
    expect(await getJson("/v1/communities/M", Schema, fetchImpl)).toEqual({
      ok: true,
      data: { mint: "M" },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.test/v1/communities/M",
      expect.objectContaining({ headers: { accept: "application/json" } }),
    );
  });

  it("maps 404 and 400 (a malformed site URL) to not_found and everything else to unavailable, never to a default", async () => {
    vi.stubEnv("HYPHAE_API_URL", "https://api.test");
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const f of [
      respond(404, { error: "not_found" }),
      respond(400, { error: "bad_request" }),
    ]) {
      expect(await getJson("/x", Schema, f)).toEqual({ ok: false, reason: "not_found" });
    }
    for (const f of [
      respond(503, { error: "unavailable" }),
      respond(500, {}),
      respond(200, { wrong: true }),
      vi.fn(async () => {
        throw new Error("network down");
      }),
    ]) {
      expect(await getJson("/x", Schema, f)).toEqual({ ok: false, reason: "unavailable" });
    }
  });

  it("is unavailable when the API origin is not configured", async () => {
    vi.stubEnv("HYPHAE_API_URL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const f = respond(200, { mint: "M" });
    expect(await getJson("/x", Schema, f)).toEqual({ ok: false, reason: "unavailable" });
    expect(f).not.toHaveBeenCalled();
  });

  it("reads fresh, never from a cache, when asked: a claim's blockhash expires in a minute", async () => {
    vi.stubEnv("HYPHAE_API_URL", "https://api.test");
    const fetchImpl = respond(200, { mint: "M" });
    await getJson("/x", Schema, fetchImpl, { fresh: true });
    const init = (fetchImpl.mock.calls[0] as unknown[])[1] as RequestInit & { next?: unknown };
    expect(init.cache).toBe("no-store");
    expect(init.next).toBeUndefined();
  });
});
