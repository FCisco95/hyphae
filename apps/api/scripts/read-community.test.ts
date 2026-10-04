import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadError, readCommunity } from "./read-community.js";

const time = "2026-10-04T09:00:00.000000Z";
const community = (mint = "CommunityA", current_epoch: number | null = 2) => ({
  mint,
  name: mint,
  reward_intake: "paused",
  current_epoch,
  epochs: [],
  as_of: time,
});
const epoch = (mint = "CommunityA") => ({
  community: { mint, name: mint },
  index: 2,
  opens_at: time,
  closes_at: time,
  status: "open",
  closed: false,
  final: false,
  as_of: time,
  config: {
    id: "00000000-0000-0000-0000-000000000001",
    rubric_version: "example",
    prompt_version: "example",
    effort_multiplier_bps: 10000,
    slot_limit: 1,
    payload: {},
  },
  counts: {
    contributions: 0,
    members: 0,
    counted: 0,
    pending: 0,
    pending_at_close: 0,
    pending_reconciliation: 0,
    excluded: 0,
  },
  totals: { point_units: "9007199254740993", points: "90071992.54740993" },
  snapshot: { status: "not_frozen" },
  allocation: { status: "unavailable", reason: "not_closed" },
  payment: { status: "unavailable", reason: "no_settlement" },
});
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, ...(headers ? { headers } : {}) });
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("the public integration example", () => {
  it("reports a body-read deadline as timeout rather than invalid JSON", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const c = new AbortController();
      setTimeout(() => c.abort(new DOMException("timeout", "TimeoutError")), 10);
      return c.signal;
    });
    const fetchImpl = vi.fn<typeof fetch>(
      async (_url, init) =>
        ({
          ok: true,
          json: () =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
                once: true,
              });
            }),
        }) as Response,
    );
    const opts = { fetchImpl, timeoutMs: 10 };
    const pending = readCommunity("CommunityA", opts).catch((error) => error);
    await vi.advanceTimersByTimeAsync(11);
    expect(await pending).toMatchObject({ code: "timeout" });
  });

  it("contains throwing settlement refinements as schema_mismatch", async () => {
    const address = "1".repeat(32);
    const body = {
      ...epoch(),
      settlement: {
        allocation: {
          status: "published",
          network: "solana:devnet",
          program_id: address,
          community_address: address,
          vault_address: address,
          epoch_address: address,
          publish_tx: "1".repeat(64),
          published_at: time,
          root: "0".repeat(64),
          audit_hash: "0".repeat(64),
          gross_lamports: "not-an-integer",
          fee_bps: "300",
          fee_lamports: "0",
          fee_recipient: address,
          net_lamports: "0",
          allocated_lamports: "0",
          cap_remainder_lamports: "0",
          dust_lamports: "0",
          payable_members: "0",
        },
        payment: { status: "unavailable", reason: "no_settlement" },
      },
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(community()))
      .mockResolvedValueOnce(json(body));
    await expect(readCommunity("CommunityA", { fetchImpl })).rejects.toMatchObject({
      code: "schema_mismatch",
    });
  });
  it("uses consumer schemas, preserves exact strings and unavailable states, and makes only bounded public reads", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ ...community(), added_in_v1: true }))
      .mockResolvedValueOnce(json({ ...epoch(), added_in_v1: true }));
    const result = await readCommunity("CommunityA", { fetchImpl });
    expect(result.epoch?.totals.point_units).toBe("9007199254740993");
    expect(result.epoch?.payment).toEqual({ status: "unavailable", reason: "no_settlement" });
    expect(result.epoch?.settlement).toBeUndefined();
    expect(result.epoch).not.toHaveProperty("added_in_v1");
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "https://hyphae-api.fly.dev/v1/communities/CommunityA",
      "https://hyphae-api.fly.dev/v1/communities/CommunityA/epochs/2",
    ]);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      headers: { accept: "application/json" },
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
  });

  it("reads two community identities independently", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (url) => {
      const mint = String(url).split("/communities/")[1]?.split("/")[0];
      return json(String(url).includes("/epochs/") ? epoch(mint) : community(mint));
    });
    const [a, b] = await Promise.all([
      readCommunity("CommunityA", { fetchImpl }),
      readCommunity("CommunityB", { fetchImpl }),
    ]);
    expect(a.epoch?.community.mint).toBe("CommunityA");
    expect(b.epoch?.community.mint).toBe("CommunityB");
  });

  it("does not invent an epoch when the API reports none", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json(community("CommunityA", null)));
    expect((await readCommunity("CommunityA", { fetchImpl })).epoch).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses a community response for another mint before reading its epoch", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json(community("CommunityB")));
    await expect(readCommunity("CommunityA", { fetchImpl })).rejects.toMatchObject({
      code: "identity_mismatch",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([{ ...epoch("CommunityB") }, { ...epoch(), index: 3 }])(
    "refuses a mismatched epoch identity",
    async (body) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json(community()))
        .mockResolvedValueOnce(json(body));
      await expect(readCommunity("CommunityA", { fetchImpl })).rejects.toMatchObject({
        code: "identity_mismatch",
      });
    },
  );

  it.each([
    [404, "not_found"],
    [429, "rate_limited"],
    [503, "unavailable"],
  ] as const)(
    "reports HTTP %i without retrying or returning invented zero data",
    async (status, code) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({}, status, { "retry-after": "30" }));
      await expect(readCommunity("CommunityA", { fetchImpl })).rejects.toMatchObject({
        code,
        status,
        retryAfterSeconds: status === 429 ? 30 : undefined,
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it("refuses invalid JSON and a schema-invalid success", async () => {
    for (const response of [new Response("not JSON"), json({ mint: "CommunityA" })]) {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(readCommunity("CommunityA", { fetchImpl })).rejects.toBeInstanceOf(ReadError);
    }
  });

  it("redacts network error details and reports a timeout", async () => {
    for (const [error, code] of [
      [new Error("private provider details"), "network_error"],
      [new DOMException("timeout", "TimeoutError"), "timeout"],
    ] as const) {
      await expect(
        readCommunity("CommunityA", { fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(error) }),
      ).rejects.toMatchObject({ code, message: code });
    }
  });

  it("refuses path injection and credential-bearing or insecure origins before any request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(readCommunity("../wrong", { fetchImpl })).rejects.toMatchObject({
      code: "invalid_input",
    });
    for (const api of [
      "http://remote.test/v1",
      "https://user:password@remote.test/v1",
      "https://remote.test/v1?token=private",
      "https://remote.test/other",
      "not a URL",
    ]) {
      await expect(readCommunity("CommunityA", { api, fetchImpl })).rejects.toMatchObject({
        code: "invalid_configuration",
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
