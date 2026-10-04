import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHyphaeReadClient, HyphaeReadError } from "../src/index.js";
import {
  claim,
  community,
  contribution,
  contributions,
  epoch,
  ID,
  leaderboard,
  responseFor,
  WALLET,
  walletClaims,
} from "./fixtures.js";

const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, ...(headers ? { headers } : {}) });
const mock = () => vi.fn<typeof fetch>(async (url) => json(responseFor(url)));
afterEach(() => vi.useRealTimers());

describe("public read client", () => {
  it("closes an unread HTTP-error body rather than leaving its connection open", async () => {
    let closed = () => {};
    const bodyClosed = new Promise<void>((resolve) => {
      closed = resolve;
    });
    const server = createServer((_req, response) => {
      response.once("close", closed);
      response.writeHead(503, { "content-type": "application/json" });
      response.write("{");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const port = (server.address() as AddressInfo).port;
      const client = createHyphaeReadClient({ baseUrl: `http://127.0.0.1:${port}/v1` });
      await expect(client.getCommunity("CommunityA")).rejects.toMatchObject({
        code: "unavailable",
      });
      await Promise.race([
        bodyClosed,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("Unread response body was not closed")), 250);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it("performs exactly the seven documented GET operations with pagination and normalized IDs", async () => {
    const fetchImpl = mock();
    const c = createHyphaeReadClient({ fetch: fetchImpl });
    await c.getCommunity("CommunityA");
    await c.getEpoch("CommunityA", 2);
    await c.getContributions("CommunityA", 2, { offset: 3, limit: 10, member: ID.toUpperCase() });
    await c.getLeaderboard("CommunityA", 2, { offset: 3, limit: 10 });
    await c.getContribution(ID.toUpperCase());
    await c.getClaim("CommunityA", 2, WALLET);
    await c.getWalletClaims(WALLET, { offset: 3, limit: 10 });
    expect(
      fetchImpl.mock.calls.map(([url]) => String(url).replace("https://hyphae-api.fly.dev", "")),
    ).toEqual([
      "/v1/communities/CommunityA",
      "/v1/communities/CommunityA/epochs/2",
      `/v1/communities/CommunityA/epochs/2/contributions?offset=3&limit=10&member=${ID}`,
      "/v1/communities/CommunityA/leaderboard?epoch=2&offset=3&limit=10",
      `/v1/contributions/${ID}`,
      `/v1/communities/CommunityA/epochs/2/claims/${WALLET}`,
      `/v1/wallets/${WALLET}/claims?offset=3&limit=10`,
    ]);
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init).toMatchObject({
        method: "GET",
        headers: { accept: "application/json" },
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      });
    }
  });

  it("isolates concurrent mint reads without a default-community fallback", async () => {
    const c = createHyphaeReadClient({ fetch: mock() });
    const [a, b] = await Promise.all([c.getEpoch("CommunityA", 2), c.getEpoch("CommunityB", 2)]);
    expect(a.community.mint).toBe("CommunityA");
    expect(b.community.mint).toBe("CommunityB");
  });

  it("retains exact strings, unavailable states and absent newer fields, while tolerating added v1 fields", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ ...epoch(), new_field: true }));
    const e = await createHyphaeReadClient({ fetch: fetchImpl }).getEpoch("CommunityA", 2);
    expect(e.totals.point_units).toBe("9007199254740993");
    expect(e.payment).toEqual({ status: "unavailable", reason: "no_settlement" });
    expect(e.settlement).toBeUndefined();
    expect(e).not.toHaveProperty("new_field");
  });

  it("preserves valid empty wallet claims", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ ...walletClaims(), total_claims: 0, claims: [] }));
    expect(
      (await createHyphaeReadClient({ fetch: fetchImpl }).getWalletClaims(WALLET)).claims,
    ).toEqual([]);
  });

  it("validates every operation's returned identity", async () => {
    const cases = [
      {
        body: community("Other"),
        call: (c: ReturnType<typeof createHyphaeReadClient>) => c.getCommunity("CommunityA"),
      },
      {
        body: { ...epoch(), index: 3 },
        call: (c: ReturnType<typeof createHyphaeReadClient>) => c.getEpoch("CommunityA", 2),
      },
      {
        body: contributions("Other"),
        call: (c: ReturnType<typeof createHyphaeReadClient>) => c.getContributions("CommunityA", 2),
      },
      {
        body: leaderboard("Other"),
        call: (c: ReturnType<typeof createHyphaeReadClient>) => c.getLeaderboard("CommunityA", 2),
      },
      {
        body: { ...contribution(), id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" },
        call: (c: ReturnType<typeof createHyphaeReadClient>) => c.getContribution(ID),
      },
      {
        body: { ...claim(), wallet: "2".repeat(32) },
        call: (c: ReturnType<typeof createHyphaeReadClient>) => c.getClaim("CommunityA", 2, WALLET),
      },
      {
        body: { ...walletClaims(), wallet: "2".repeat(32) },
        call: (c: ReturnType<typeof createHyphaeReadClient>) => c.getWalletClaims(WALLET),
      },
    ];
    for (const { body, call } of cases) {
      const c = createHyphaeReadClient({
        fetch: vi.fn<typeof fetch>().mockResolvedValue(json(body)),
      });
      await expect(call(c)).rejects.toMatchObject({ code: "identity_mismatch" });
    }
  });

  it("refuses mismatched pagination and member-filter results", async () => {
    for (const body of [
      { ...contributions(), offset: 1 },
      { ...contributions(), contributions: [contribution()] },
    ]) {
      const c = createHyphaeReadClient({
        fetch: vi.fn<typeof fetch>().mockResolvedValue(json(body)),
      });
      await expect(
        c.getContributions("CommunityA", 2, { member: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }),
      ).rejects.toMatchObject({ code: "identity_mismatch" });
    }
  });

  it.each([
    [400, "bad_request"],
    [404, "not_found"],
    [429, "rate_limited"],
    [503, "unavailable"],
    [500, "http_error"],
  ] as const)(
    "reports HTTP %i without defaults, response-body leakage or automatic retry",
    async (status, code) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({ private: "provider details" }, status, { "retry-after": "30" }));
      const c = createHyphaeReadClient({ fetch: fetchImpl });
      await expect(c.getCommunity("CommunityA")).rejects.toMatchObject({
        code,
        status,
        message: code,
        retryAfterSeconds: status === 429 ? 30 : undefined,
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it("handles HTTP-date Retry-After and ignores malformed values", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T09:00:00Z"));
    for (const [header, seconds] of [
      ["Sun, 04 Oct 2026 09:00:20 GMT", 20],
      ["invalid", undefined],
    ] as const) {
      const c = createHyphaeReadClient({
        fetch: vi.fn<typeof fetch>().mockResolvedValue(json({}, 429, { "retry-after": header })),
      });
      await expect(c.getCommunity("CommunityA")).rejects.toMatchObject({
        code: "rate_limited",
        retryAfterSeconds: seconds,
      });
    }
  });

  it.each([
    [new Response("bad JSON"), "invalid_json"],
    [json({ mint: "CommunityA" }), "schema_mismatch"],
  ] as const)("rejects invalid JSON/schema successes", async (response, code) => {
    const c = createHyphaeReadClient({ fetch: vi.fn<typeof fetch>().mockResolvedValue(response) });
    await expect(c.getCommunity("CommunityA")).rejects.toMatchObject({ code });
  });

  it("rejects schema-invalid paid evidence rather than labeling a wallet paid", async () => {
    const c = createHyphaeReadClient({
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({ ...claim(), payment: { status: "paid", claim_tx: null } })),
    });
    await expect(c.getClaim("CommunityA", 2, WALLET)).rejects.toMatchObject({
      code: "schema_mismatch",
    });
  });

  it("reports malformed settlement arithmetic as a schema failure, including a throwing refinement", async () => {
    const body = {
      ...epoch(),
      settlement: {
        allocation: {
          status: "published",
          network: "solana:devnet",
          program_id: WALLET,
          community_address: WALLET,
          vault_address: WALLET,
          epoch_address: WALLET,
          publish_tx: "1".repeat(64),
          published_at: "2026-10-04T09:00:00.000000Z",
          root: "0".repeat(64),
          audit_hash: "0".repeat(64),
          gross_lamports: "not-an-integer",
          fee_bps: "300",
          fee_lamports: "0",
          fee_recipient: WALLET,
          net_lamports: "0",
          allocated_lamports: "0",
          cap_remainder_lamports: "0",
          dust_lamports: "0",
          payable_members: "0",
        },
        payment: { status: "unavailable", reason: "no_settlement" },
      },
    };
    const c = createHyphaeReadClient({
      fetch: vi.fn<typeof fetch>().mockResolvedValue(json(body)),
    });
    await expect(c.getEpoch("CommunityA", 2)).rejects.toMatchObject({ code: "schema_mismatch" });
  });

  it("redacts raw network errors", async () => {
    const c = createHyphaeReadClient({
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error("credential-bearing URL")),
    });
    await expect(c.getCommunity("CommunityA")).rejects.toMatchObject({
      code: "network_error",
      message: "network_error",
    });
  });

  it("times out and cleans up while a request is pending", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        }),
    );
    const c = createHyphaeReadClient({ fetch: fetchImpl, timeoutMs: 10 });
    await expect(c.getCommunity("CommunityA")).rejects.toMatchObject({ code: "timeout" });
  });

  it("keeps the deadline active through response-body reading", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async (_url, init) =>
        ({
          ok: true,
          json: () =>
            new Promise((_resolve, reject) =>
              init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
                once: true,
              }),
            ),
        }) as Response,
    );
    await expect(
      createHyphaeReadClient({ fetch: fetchImpl, timeoutMs: 10 }).getCommunity("CommunityA"),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("honors caller cancellation before and during fetch", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        }),
    );
    const c = createHyphaeReadClient({ fetch: fetchImpl });
    await expect(
      c.getCommunity("CommunityA", { signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(fetchImpl).not.toHaveBeenCalled();
    const controller = new AbortController();
    const pending = c.getCommunity("CommunityA", { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "aborted" });
  });

  it("refuses unsafe origins and invalid deadlines before requests", () => {
    for (const baseUrl of [
      "http://remote.test/v1",
      "https://user:pass@api.test/v1",
      "https://api.test/v1?token=private",
      "https://api.test/v1#secret",
      "https://api.test/other",
      "not a URL",
    ]) {
      expect(() => createHyphaeReadClient({ baseUrl })).toThrow(HyphaeReadError);
    }
    for (const timeoutMs of [0, -1, NaN, Infinity, 2_147_483_648]) {
      expect(() => createHyphaeReadClient({ timeoutMs })).toThrow(HyphaeReadError);
    }
  });

  it("validates all request inputs before contacting the API", () => {
    const fetchImpl = mock();
    const c = createHyphaeReadClient({ fetch: fetchImpl });
    for (const call of [
      () => c.getCommunity("../wrong"),
      () => c.getCommunity(123 as unknown as string),
      () => c.getEpoch("CommunityA", 0),
      () => c.getEpoch("CommunityA", 1e9),
      () => c.getContributions("CommunityA", 2, { member: "not-a-uuid" }),
      () => c.getContributions("CommunityA", 2, { limit: 101 }),
      () => c.getLeaderboard("CommunityA", 2, { offset: -1 }),
      () => c.getContribution("not-a-uuid"),
      () => c.getClaim("CommunityA", 2, "bad-wallet"),
      () => c.getWalletClaims(WALLET, { offset: NaN }),
    ])
      expect(call).toThrow(HyphaeReadError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
