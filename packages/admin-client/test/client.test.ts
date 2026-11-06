import { afterEach, describe, expect, it, vi } from "vitest";
import { createHyphaeAdminClient, HyphaeAdminError } from "../src/index.js";

const baseUrl = "https://admin.example/admin/v1";
const overview = (mint = "CommunityA") => ({
  state: "admin",
  community: { mint, name: "Community" },
  intake: { paused: false, paused_at: null },
  as_of: "2026-11-06T19:00:00.000Z",
});
const update = { paused: true, expected_paused_at: null };
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, ...(headers ? { headers } : {}) });
const options = () => ({
  baseUrl,
  getAccessToken: vi.fn(async () => "app.bound.token"),
  fetch: vi.fn<typeof fetch>(async () => json(overview())),
});

afterEach(() => vi.useRealTimers());

describe("private admin client", () => {
  it("uses exact authenticated endpoints, a fresh token and no ambient credentials", async () => {
    const opts = options();
    opts.getAccessToken
      .mockResolvedValueOnce("first.app.token")
      .mockResolvedValueOnce("second.app.token");
    const client = createHyphaeAdminClient(opts);
    expect(await client.getCommunity("CommunityA")).toEqual(overview());
    expect(await client.setIntakePaused("CommunityA", update)).toEqual(overview());
    expect(opts.getAccessToken).toHaveBeenCalledTimes(2);
    expect(opts.fetch.mock.calls.map(([url]) => url)).toEqual([
      `${baseUrl}/communities/CommunityA`,
      `${baseUrl}/communities/CommunityA/intake`,
    ]);
    expect(opts.fetch.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      headers: { accept: "application/json", authorization: "Bearer first.app.token" },
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
    expect(opts.fetch.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      headers: { "content-type": "application/json", authorization: "Bearer second.app.token" },
      body: '{"paused":true,"expected_paused_at":null}',
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
    });
  });

  it.each([
    "http://remote.test/admin/v1",
    "https://user:secret@api.test/admin/v1",
    "https://api.test/admin/v1?secret=x",
    "https://api.test/admin/v1#x",
    "https://api.test/v1",
    "https://api.test/",
    "not a URL",
    "https://api.test/admin/v1?",
    "https://api.test/admin/v1#",
  ])("rejects unsafe or wrong base URL %s", (url) => {
    expect(() => createHyphaeAdminClient({ ...options(), baseUrl: url })).toThrow(HyphaeAdminError);
  });

  it("requires an explicit base and token getter and a valid deadline", () => {
    for (const opts of [undefined, {}, { baseUrl }, { ...options(), getAccessToken: undefined }]) {
      expect(() => createHyphaeAdminClient(opts as never)).toThrow(HyphaeAdminError);
    }
    for (const timeoutMs of [0, -1, NaN, Infinity, 2_147_483_648]) {
      expect(() => createHyphaeAdminClient({ ...options(), timeoutMs })).toThrow(HyphaeAdminError);
    }
  });

  it.each([
    "http://localhost:8000/admin/v1",
    "http://127.0.0.1/admin/v1/",
    "http://[::1]/admin/v1",
  ])("allows loopback HTTP %s", async (url) => {
    expect(
      await createHyphaeAdminClient({ ...options(), baseUrl: url }).getCommunity("CommunityA"),
    ).toEqual(overview());
  });

  it("rejects unsafe mint selectors and strict invalid updates before token retrieval", () => {
    const opts = options();
    const client = createHyphaeAdminClient(opts);
    for (const mint of ["", "../other", "A?other=B", "a".repeat(65), 123]) {
      expect(() => client.getCommunity(mint as string)).toThrow(HyphaeAdminError);
      expect(() => client.setIntakePaused(mint as string, update)).toThrow(HyphaeAdminError);
    }
    for (const value of [
      null,
      {},
      { paused: true },
      { ...update, owner: "other" },
      { ...update, paused: "yes" },
      { ...update, expected_paused_at: "yesterday" },
    ]) {
      expect(() => client.setIntakePaused("CommunityA", value as never)).toThrow(HyphaeAdminError);
    }
    expect(opts.getAccessToken).not.toHaveBeenCalled();
    expect(opts.fetch).not.toHaveBeenCalled();
  });

  it.each([
    [400, "bad_request"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [429, "rate_limited"],
    [503, "unavailable"],
    [500, "http_error"],
  ])("returns typed %s error without retrying or exposing a body", async (status, code) => {
    const opts = options();
    opts.fetch.mockImplementation(async () =>
      json({ error: "private-secret" }, status as number, { "retry-after": "12" }),
    );
    const error = await createHyphaeAdminClient(opts)
      .setIntakePaused("CommunityA", update)
      .catch((e) => e);
    expect(error).toBeInstanceOf(HyphaeAdminError);
    expect(error).toMatchObject({ code, status });
    expect(String(error)).not.toContain("private-secret");
    expect(error.retryAfterSeconds).toBe(status === 429 ? 12 : undefined);
    expect(opts.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["", null, "bad\r\nAuthorization: bad", "Bearer token", "x".repeat(16385)])(
    "rejects missing/malformed credentials without fetch (%s)",
    async (token) => {
      const opts = options();
      const client = createHyphaeAdminClient({ ...opts, getAccessToken: async () => token });
      await expect(client.getCommunity("CommunityA")).rejects.toMatchObject({
        code: "unauthorized",
      });
      expect(opts.fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["opaque bearer", "opaque-token"],
    ["two segments", "a.b"],
    ["four segments", "a.b.c.d"],
    ["empty segment", "a..c"],
    ["base64 padding", "a.b.c="],
    ["base64 slash", "a.b.c/"],
    ["base64 plus", "a.b.c+"],
    ["4097 characters", `a.b.${"c".repeat(4093)}`],
  ])("rejects non-compact JWT credentials before fetch: %s", async (_label, token) => {
    const opts = options();
    await expect(
      createHyphaeAdminClient({ ...opts, getAccessToken: async () => token }).getCommunity(
        "CommunityA",
      ),
    ).rejects.toMatchObject({ code: "unauthorized" });
    expect(opts.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["minimal fixture", "a.b.c"],
    ["4096 characters", `a.b.${"c".repeat(4092)}`],
    ["base64url characters", "A-z._09.c"],
  ])(
    "accepts compact JWT syntax without claiming signature verification: %s",
    async (_label, token) => {
      const opts = options();
      expect(
        await createHyphaeAdminClient({ ...opts, getAccessToken: async () => token }).getCommunity(
          "CommunityA",
        ),
      ).toEqual(overview());
      expect(opts.fetch.mock.calls[0]?.[1]?.headers).toMatchObject({
        authorization: `Bearer ${token}`,
      });
    },
  );

  it.each(["token", "fetch"])("redacts errors from %s", async (phase) => {
    const opts = options();
    const fail = async () => {
      throw new Error("secret.app.token");
    };
    if (phase === "token") opts.getAccessToken = vi.fn(fail);
    else opts.fetch = vi.fn(fail);
    const error = await createHyphaeAdminClient(opts)
      .getCommunity("CommunityA")
      .catch((e) => e);
    expect(error).toMatchObject({ code: phase === "token" ? "token_error" : "network_error" });
    expect(JSON.stringify(error)).not.toContain("secret.app.token");
    expect(String(error)).not.toContain("secret.app.token");
  });

  it("rejects wrong identity for both methods", async () => {
    const opts = options();
    opts.fetch.mockImplementation(async () => json(overview("OtherCommunity")));
    const client = createHyphaeAdminClient(opts);
    await expect(client.getCommunity("CommunityA")).rejects.toMatchObject({
      code: "identity_mismatch",
    });
    await expect(client.setIntakePaused("CommunityA", update)).rejects.toMatchObject({
      code: "identity_mismatch",
    });
  });

  it.each([
    { ...overview(), actor: "private-id" },
    { ...overview(), intake: { paused: true, paused_at: null } },
    { ...overview(), as_of: "bad" },
    { ...overview(), community: { ...overview().community, token: "secret" } },
  ])("rejects malformed/extra response data", async (body) => {
    const opts = options();
    opts.fetch.mockImplementation(async () => json(body));
    await expect(createHyphaeAdminClient(opts).getCommunity("CommunityA")).rejects.toMatchObject({
      code: "schema_mismatch",
    });
  });

  it("rejects invalid JSON", async () => {
    await expect(
      createHyphaeAdminClient({ ...options(), fetch: async () => new Response("{") }).getCommunity(
        "CommunityA",
      ),
    ).rejects.toMatchObject({ code: "invalid_json" });
  });

  it.each(["token", "fetch", "body"])(
    "bounds a stuck %s even when it ignores abort",
    async (phase) => {
      vi.useFakeTimers();
      const opts = options();
      let lateToken: ((token: string) => void) | undefined;
      if (phase === "token")
        opts.getAccessToken = vi.fn(
          () =>
            new Promise((resolve) => {
              lateToken = resolve;
            }),
        );
      if (phase === "fetch") opts.fetch.mockImplementation(() => new Promise(() => {}));
      if (phase === "body")
        opts.fetch.mockImplementation(async () => new Response(new ReadableStream({ start() {} })));
      const pending = createHyphaeAdminClient({ ...opts, timeoutMs: 10 })
        .setIntakePaused("CommunityA", update)
        .catch((e) => e);
      await vi.advanceTimersByTimeAsync(11);
      expect(await pending).toMatchObject({ code: "timeout" });
      if (phase === "token") {
        lateToken?.("late.app.token");
        await vi.advanceTimersByTimeAsync(1);
        expect(opts.fetch).not.toHaveBeenCalled();
      }
    },
  );

  it("uses one total deadline across token retrieval and response consumption", async () => {
    vi.useFakeTimers();
    const opts = options();
    opts.getAccessToken.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve("a.b.c"), 6)),
    );
    opts.fetch.mockImplementation(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              setTimeout(() => {
                controller.enqueue(new TextEncoder().encode(JSON.stringify(overview())));
                controller.close();
              }, 6);
            },
          }),
        ),
    );
    const pending = createHyphaeAdminClient({ ...opts, timeoutMs: 10 })
      .getCommunity("CommunityA")
      .catch((e) => e);
    await vi.advanceTimersByTimeAsync(11);
    expect(await pending).toMatchObject({ code: "timeout" });
  });

  it.each(["token", "fetch", "body"])("honors caller abort during %s", async (phase) => {
    const opts = options();
    const controller = new AbortController();
    let entered: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let bodyCancelled = false;
    if (phase === "token")
      opts.getAccessToken = vi.fn(() => {
        entered?.();
        return new Promise(() => {});
      });
    else
      opts.fetch.mockImplementation(async () => {
        if (phase === "fetch") {
          entered?.();
          return new Promise(() => {});
        }
        return new Response(
          new ReadableStream(
            {
              pull() {
                entered?.();
              },
              cancel() {
                bodyCancelled = true;
              },
            },
            { highWaterMark: 0 },
          ),
        );
      });
    const pending = createHyphaeAdminClient(opts).getCommunity("CommunityA", {
      signal: controller.signal,
    });
    await started;
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "aborted" });
    if (phase === "body") expect(bodyCancelled).toBe(true);
  });

  it("does not retrieve a token for an already aborted request", async () => {
    const opts = options();
    await expect(
      createHyphaeAdminClient(opts).getCommunity("CommunityA", { signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(opts.getAccessToken).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "caps response bytes, including UTF-8 and misleading content-length (header=%s)",
    async (withHeader) => {
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("é".repeat(8193)));
        },
        cancel() {
          cancelled = true;
        },
      });
      await expect(
        createHyphaeAdminClient({
          ...options(),
          fetch: async () =>
            new Response(body, { headers: withHeader ? { "content-length": "10" } : {} }),
        }).getCommunity("CommunityA"),
      ).rejects.toMatchObject({ code: "response_too_large" });
      expect(cancelled).toBe(true);
    },
  );

  it("accepts exactly 16KiB and cancels unread HTTP error streams", async () => {
    const body = JSON.stringify(overview()).padEnd(16384, " ");
    expect(
      await createHyphaeAdminClient({
        ...options(),
        fetch: async () => new Response(body),
      }).getCommunity("CommunityA"),
    ).toEqual(overview());
    let cancelled = false;
    await expect(
      createHyphaeAdminClient({
        ...options(),
        fetch: async () =>
          new Response(
            new ReadableStream({
              cancel() {
                cancelled = true;
              },
            }),
            { status: 403 },
          ),
      }).getCommunity("CommunityA"),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(cancelled).toBe(true);
  });

  it("copies an update before waiting for a credential", async () => {
    const opts = options();
    const mutable = { paused: true, expected_paused_at: null as string | null };
    const pending = createHyphaeAdminClient(opts).setIntakePaused("CommunityA", mutable);
    mutable.paused = false;
    mutable.expected_paused_at = "2026-11-06T20:00:00.000Z";
    await pending;
    expect(opts.fetch.mock.calls[0]?.[1]?.body).toBe('{"paused":true,"expected_paused_at":null}');
  });

  it("isolates concurrent community requests even when responses arrive out of order", async () => {
    const resolvers: Record<string, (value: Response) => void> = {};
    const opts = options();
    opts.fetch.mockImplementation(
      (url) =>
        new Promise((resolve) => {
          resolvers[String(url)] = resolve;
        }),
    );
    const client = createHyphaeAdminClient(opts);
    const a = client.getCommunity("CommunityA");
    const b = client.getCommunity("CommunityB");
    await vi.waitFor(() => expect(Object.keys(resolvers)).toHaveLength(2));
    resolvers[`${baseUrl}/communities/CommunityB`]?.(json(overview("CommunityB")));
    resolvers[`${baseUrl}/communities/CommunityA`]?.(json(overview("CommunityA")));
    expect((await a).community.mint).toBe("CommunityA");
    expect((await b).community.mint).toBe("CommunityB");
  });

  it("rejects an oversized Content-Length without consuming a body", async () => {
    let cancelled = false;
    const stream = new ReadableStream({
      cancel() {
        cancelled = true;
      },
    });
    await expect(
      createHyphaeAdminClient({
        ...options(),
        fetch: async () => new Response(stream, { headers: { "content-length": "16385" } }),
      }).getCommunity("CommunityA"),
    ).rejects.toMatchObject({ code: "response_too_large" });
    expect(cancelled).toBe(true);
  });
});
