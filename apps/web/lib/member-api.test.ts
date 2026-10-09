import { afterEach, describe, expect, it, vi } from "vitest";
import { readPrivateMember } from "./member-api.js";

const valid = {
  community: { mint: "MintA", name: "Fixture" },
  as_of: "2026-10-09T12:00:00.000Z",
  state: "telegram_required",
};
const options = {
  mint: "MintA",
  token: "fixture.payload.signature",
  apiUrl: "https://fixture.test",
};
afterEach(() => vi.unstubAllGlobals());

describe("private member transport", () => {
  it("forwards only access credentials without caching", async () => {
    let observed: RequestInit | undefined;
    let path: unknown;
    vi.stubGlobal("fetch", async (input: unknown, init: RequestInit) => {
      path = input;
      observed = init;
      return Response.json(valid);
    });
    expect(await readPrivateMember(options)).toEqual({ status: 200, body: valid });
    expect(path).toBe("https://fixture.test/member/v1/communities/MintA/me");
    expect(observed?.headers).toEqual({ Authorization: `Bearer ${options.token}` });
    expect(observed?.cache).toBe("no-store");
    expect(observed?.redirect).toBe("error");
  });
  it("does not share responses across users", async () => {
    vi.stubGlobal("fetch", async (_input: unknown, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).Authorization;
      return Response.json({
        ...valid,
        state: auth?.includes("userA") ? "join_required" : "telegram_required",
      });
    });
    expect(
      (await readPrivateMember({ ...options, token: "userA.payload.signature" })).body,
    ).toEqual({ ...valid, state: "join_required" });
    expect(
      (await readPrivateMember({ ...options, token: "userB.payload.signature" })).body,
    ).toEqual(valid);
  });
  it.each([401, 404, 429, 503])(
    "reduces upstream %s diagnostics to fixed errors",
    async (status) => {
      vi.stubGlobal("fetch", async () =>
        Response.json({ error: "secret user info", token: options.token }, { status }),
      );
      const result = await readPrivateMember(options);
      expect(result.status).toBe(status);
      expect(JSON.stringify(result.body)).not.toContain("secret");
      expect(JSON.stringify(result.body)).not.toContain(options.token);
    },
  );
  it.each([
    { ...valid, email: "private@example.test" },
    { ...valid, community: { mint: "OtherMint", name: "Other" } },
    { ...valid, state: "paid" },
  ])("rejects untrusted success payload", async (body) => {
    vi.stubGlobal("fetch", async () => Response.json(body));
    expect(await readPrivateMember(options)).toEqual({
      status: 503,
      body: { error: "unavailable" },
    });
  });
  it("bounds payloads while streaming", async () => {
    let canceled = false;
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(17000));
            },
            cancel() {
              canceled = true;
            },
          }),
        ),
    );
    expect((await readPrivateMember(options)).status).toBe(503);
    expect(canceled).toBe(true);
  });
  it("returns unavailable for failed reads", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error(options.token);
    });
    expect(await readPrivateMember(options)).toEqual({
      status: 503,
      body: { error: "unavailable" },
    });
  });
  it("aborts a hung read after 5.5 seconds", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      vi.stubGlobal("fetch", async (_input: unknown, init: RequestInit) => {
        signal = init.signal ?? undefined;
        return new Promise<Response>((_, reject) =>
          signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }),
        );
      });
      const result = readPrivateMember(options);
      await vi.advanceTimersByTimeAsync(5500);
      expect((await result).status).toBe(503);
      expect(signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
