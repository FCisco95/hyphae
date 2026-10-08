import type { ClaimV1 } from "@hyphae/core";
import {
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from "@solana/kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as f from "../../../../../../components/fixtures.js";
import { claimTransaction } from "../../../../../../lib/claim.js";
import { OTHER, servedClaim, WALLET } from "../../../../../../lib/claim-fixture.js";
import { explorerTx } from "../../../../../../lib/format.js";
import { GET, OPTIONS, POST } from "./route.js";

const DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const EPOCH_URL = "https://api.test/v1/communities/MintAbc/epochs/2";
const MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const ACTION_URL = "https://site.test/api/actions/claim/MintAbc/2";

const params = (mint = "MintAbc", index = "2") =>
  ({ params: Promise.resolve({ mint, index }) }) as const;
const JSON_TYPE = { "content-type": "application/json" };
const post = (body: string, init: RequestInit = {}) =>
  POST(new Request(ACTION_URL, { method: "POST", body, headers: JSON_TYPE, ...init }), params());
const account = (a: string) => JSON.stringify({ account: a });

// The API as the web reads it: the epoch, then one wallet's leaf.
function api(epoch: unknown, claim: ClaimV1 | null) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url === EPOCH_URL) return Response.json(epoch);
    if (url.startsWith(`${EPOCH_URL}/claims/`)) {
      return claim ? Response.json(claim) : Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// The same published epoch and leaf, on mainnet.
function onMainnet(claim: ClaimV1) {
  const { settlement } = f.settledEpoch;
  if (settlement?.allocation.status !== "published") throw new Error("fixture is not published");
  const epoch = {
    ...f.settledEpoch,
    settlement: {
      ...settlement,
      allocation: { ...settlement.allocation, network: "solana:mainnet" },
    },
  };
  return { epoch, claim: { ...claim, network: "solana:mainnet" } };
}

function expectActionHeaders(r: Response) {
  expect(r.headers.get("access-control-allow-origin")).toBe("*");
  expect(r.headers.get("access-control-allow-methods")).toBe("GET,POST,PUT,OPTIONS");
  expect(r.headers.get("access-control-allow-headers")).toBe(
    "Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Accept-Action-Version, X-Accept-Blockchain-Ids",
  );
  expect(r.headers.get("access-control-expose-headers")).toBe("X-Action-Version, X-Blockchain-Ids");
  expect(r.headers.get("x-action-version")).toBe("2.4");
  expect(r.headers.get("cache-control")).toBe("no-store");
}

beforeEach(() => vi.stubEnv("HYPHAE_API_URL", "https://api.test"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OPTIONS /api/actions/claim/:mint/:index", () => {
  it("answers a blink client's preflight with the Actions CORS headers", () => {
    const r = OPTIONS();
    expect(r.status).toBe(204);
    expectActionHeaders(r);
  });
});

describe("GET /api/actions/claim/:mint/:index", () => {
  it("describes a published epoch's payout with one Claim action, on its chain", async () => {
    const fetchMock = api(f.settledEpoch, null);
    const r = await GET(new Request(ACTION_URL), params());
    expect(r.status).toBe(200);
    expectActionHeaders(r);
    expect(r.headers.get("x-blockchain-ids")).toBe(DEVNET);
    expect(await r.json()).toEqual({
      type: "action",
      icon: "https://site.test/brand/hyphae-mark.svg",
      title: "Claim · Hyphae Lab · Epoch 2",
      description:
        "0.304603658 SOL to 3 members, published on devnet. Use the wallet you verified with the bot; it signs and pays for its own claim.",
      label: "Claim",
      links: {
        actions: [{ type: "transaction", label: "Claim", href: "/api/actions/claim/MintAbc/2" }],
      },
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([EPOCH_URL]);
  });

  it("shows an epoch with nothing to claim as a disabled action that says why", async () => {
    api(f.chainDownEpoch, null);
    const r = await GET(new Request(ACTION_URL), params());
    expect(r.status).toBe(200);
    expectActionHeaders(r);
    expect(r.headers.get("x-blockchain-ids")).toBeNull();
    expect(await r.json()).toEqual({
      type: "action",
      icon: "https://site.test/brand/hyphae-mark.svg",
      title: "Claim · Hyphae Lab · Epoch 2",
      description: "The allocation can't be confirmed on-chain right now. Nothing here is a zero.",
      label: "Claim",
      disabled: true,
    });
  });

  it("refuses a malformed link without reading the API", async () => {
    const fetchMock = api(f.settledEpoch, null);
    for (const [mint, index] of [
      ["Mint-Abc", "2"],
      ["MintAbc", "0"],
      ["MintAbc", "02"],
      ["MintAbc", "2x"],
      ["M".repeat(65), "2"],
    ] as const) {
      const r = await GET(new Request(ACTION_URL), params(mint, index));
      expect(r.status, `${mint}/${index}`).toBe(400);
      expectActionHeaders(r);
      expect(await r.json()).toEqual({ message: "This is not a Hyphae claim link." });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers an unknown epoch with 404 and an unreadable API with 503, each with a message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => Response.json({ error: "not_found" }, { status: 404 }));
    const missing = await GET(new Request(ACTION_URL), params());
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ message: "This epoch does not exist." });
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 503 }));
    const down = await GET(new Request(ACTION_URL), params());
    expect(down.status).toBe(503);
    expectActionHeaders(down);
    expect(await down.json()).toEqual({
      message: "Hyphae can't be read right now. Try again in a minute.",
    });
  });
});

describe("POST /api/actions/claim/:mint/:index", () => {
  it("returns the claim page's own transaction, unsigned, with the member as fee payer", async () => {
    const claim = await servedClaim();
    const fetchMock = api(f.settledEpoch, claim);
    const r = await post(account(WALLET));
    expect(r.status).toBe(200);
    expectActionHeaders(r);
    expect(r.headers.get("x-blockchain-ids")).toBe(DEVNET);
    const body = await r.json();
    expect(body).toEqual({
      type: "transaction",
      transaction: expect.any(String),
      message:
        "Claim 0.12125 SOL from Hyphae Lab, epoch 2. Your wallet pays the network fee and the claim receipt's rent.",
    });
    const bytes = new Uint8Array(getBase64Encoder().encode(body.transaction));
    // Byte for byte what the claim page asks the wallet to sign for the same leaf and wallet.
    expect(bytes).toEqual(await claimTransaction(claim, WALLET));
    const tx = getTransactionDecoder().decode(bytes);
    expect(Object.entries(tx.signatures)).toEqual([[WALLET, null]]);
    const message = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
    expect(message.staticAccounts[0]).toBe(WALLET);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      EPOCH_URL,
      `${EPOCH_URL}/claims/${WALLET}`,
    ]);
  });

  it("reads the leaf for the visitor the request came from, with the web's token", async () => {
    vi.stubEnv("HYPHAE_API_TOKEN", "k".repeat(40));
    const fetchMock = api(f.settledEpoch, await servedClaim());
    await post(account(WALLET), { headers: { ...JSON_TYPE, "x-real-ip": "203.0.113.9" } });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({
      accept: "application/json",
      authorization: `Bearer ${"k".repeat(40)}`,
      "x-hyphae-visitor": "203.0.113.9",
    });
  });

  it("refuses a body without one valid wallet address, without reading the API", async () => {
    const fetchMock = api(f.settledEpoch, await servedClaim());
    for (const body of [
      "",
      "not json",
      "null",
      "[]",
      JSON.stringify({}),
      JSON.stringify({ account: 7 }),
      account("not-a-wallet"),
      account("1".repeat(44)),
    ]) {
      const r = await post(body);
      expect(r.status, body.slice(0, 40)).toBe(400);
      expectActionHeaders(r);
      expect(await r.json()).toEqual({ message: "Connect a Solana wallet to claim." });
    }
    const bad = await POST(
      new Request("https://site.test/api/actions/claim/Mint-Abc/2", {
        method: "POST",
        body: account(WALLET),
        headers: JSON_TYPE,
      }),
      params("Mint-Abc"),
    );
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ message: "This is not a Hyphae claim link." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says when the wallet has no payout in the epoch", async () => {
    api(f.settledEpoch, null);
    const r = await post(account(OTHER));
    expect(r.status).toBe(404);
    expectActionHeaders(r);
    expect(await r.json()).toEqual({
      message: "This wallet has no payout in epoch 2. Use the wallet you verified with the bot.",
    });
  });

  it("says when the payout was already claimed, with the claim transaction on its network", async () => {
    const claim = await servedClaim();
    const paid = { ...claim, payment: { status: "paid", claim_tx: f.CLAIM_TX } } as const;
    api(f.settledEpoch, paid);
    const devnet = await post(account(WALLET));
    expect(devnet.status).toBe(409);
    expect(await devnet.json()).toEqual({
      message: `This wallet already claimed epoch 2. Transaction: ${explorerTx(f.CLAIM_TX, "solana:devnet")}`,
    });
    const main = onMainnet(paid);
    api(main.epoch, main.claim as ClaimV1);
    const mainnet = await post(account(WALLET));
    expect(mainnet.status).toBe(409);
    const { message } = await mainnet.json();
    expect(message).toBe(
      `This wallet already claimed epoch 2. Transaction: https://explorer.solana.com/tx/${f.CLAIM_TX}`,
    );
  });

  it("refuses a paid leaf that carries no claim transaction", async () => {
    api(f.settledEpoch, {
      ...(await servedClaim()),
      payment: { status: "paid", claim_tx: null },
    } as unknown as ClaimV1);
    const r = await post(account(WALLET));
    expect(r.status).toBe(503);
  });

  it("says when the epoch is not published, without reading a leaf", async () => {
    const fetchMock = api({ ...f.retainedEpoch, index: 2 }, await servedClaim());
    const r = await post(account(WALLET));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({
      message: "Retained: this epoch is before the first paid epoch.",
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([EPOCH_URL]);
  });

  it("says when the chain cannot confirm the leaf, and builds nothing", async () => {
    const claim = await servedClaim();
    api(f.settledEpoch, {
      ...claim,
      payment: { status: "unavailable", reason: "chain_unavailable" },
    });
    const r = await post(account(WALLET));
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({
      message: "The allocation can't be confirmed on-chain right now. Nothing here is a zero.",
    });
  });

  it("builds nothing from a leaf the claim builder would refuse", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    api(f.settledEpoch, { ...(await servedClaim()), amount_lamports: "121250001" });
    const r = await post(account(WALLET));
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({
      message:
        "This claim can't be checked right now, so nothing was built. Try again in a minute.",
    });
    expect(error).toHaveBeenCalled();
  });

  it("answers an unknown epoch with 404 and an unreadable API with 503", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => Response.json({ error: "not_found" }, { status: 404 }));
    expect((await post(account(WALLET))).status).toBe(404);
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 503 }));
    const down = await post(account(WALLET));
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({
      message: "Hyphae can't be read right now. Try again in a minute.",
    });
  });
});

describe("POST failures keep the chain once it is known", () => {
  const unavailable = { status: "unavailable", reason: "chain_unavailable" } as const;
  const cases: { name: string; status: number; leaf: (c: ClaimV1) => ClaimV1 | null }[] = [
    { name: "no leaf", status: 404, leaf: () => null },
    {
      name: "paid",
      status: 409,
      leaf: (c) => ({ ...c, payment: { status: "paid", claim_tx: f.CLAIM_TX } }),
    },
    { name: "unavailable payment", status: 503, leaf: (c) => ({ ...c, payment: unavailable }) },
    { name: "builder refusal", status: 503, leaf: (c) => ({ ...c, amount_lamports: "121250001" }) },
  ];

  for (const c of cases) {
    it(`${c.name}: devnet and mainnet`, async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const claim = await servedClaim();
      api(f.settledEpoch, c.leaf(claim));
      const devnet = await post(account(WALLET));
      expect(devnet.status).toBe(c.status);
      expectActionHeaders(devnet);
      expect(devnet.headers.get("x-blockchain-ids")).toBe(DEVNET);

      const main = onMainnet(claim);
      api(main.epoch, c.leaf(main.claim as ClaimV1));
      const mainnet = await post(account(WALLET));
      expect(mainnet.status).toBe(c.status);
      expect(mainnet.headers.get("x-blockchain-ids")).toBe(MAINNET);
    });
  }

  it("names no chain when none is known", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    api({ ...f.retainedEpoch, index: 2 }, await servedClaim());
    const retained = await post(account(WALLET));
    expect(retained.status).toBe(409);
    expect(retained.headers.get("x-blockchain-ids")).toBeNull();
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 503 }));
    const down = await post(account(WALLET));
    expect(down.status).toBe(503);
    expect(down.headers.get("x-blockchain-ids")).toBeNull();
    const bad = await post("not json");
    expect(bad.status).toBe(400);
    expect(bad.headers.get("x-blockchain-ids")).toBeNull();
  });
});

describe("POST body limits, counted in bytes as they arrive", () => {
  const MAX = 1024;
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  // A valid body of exactly `size` bytes: the wallet, then ASCII padding.
  const sized = (size: number) => {
    const head = JSON.stringify({ account: WALLET, pad: "" });
    return JSON.stringify({ account: WALLET, pad: "x".repeat(size - bytes(head)) });
  };
  const chunked = (chunks: Uint8Array[], init: { failAfter?: number } = {}) => {
    const state = { pulled: 0, cancelled: false };
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (init.failAfter !== undefined && state.pulled >= init.failAfter) {
          controller.error(new Error("connection reset"));
          return;
        }
        const chunk = chunks[state.pulled++];
        if (chunk) controller.enqueue(chunk);
        else controller.close();
      },
      cancel() {
        state.cancelled = true;
      },
    });
    return { stream, state };
  };
  const postStream = (stream: ReadableStream<Uint8Array>, headers: HeadersInit = JSON_TYPE) =>
    POST(
      new Request(ACTION_URL, { method: "POST", body: stream, headers, duplex: "half" } as never),
      params(),
    );
  const TOO_LARGE = { message: "That request is too large." };

  it("accepts a body just below and at the limit, refuses one byte above", async () => {
    const fetchMock = api(f.settledEpoch, await servedClaim());
    expect(bytes(sized(MAX))).toBe(MAX);
    expect((await post(sized(MAX - 1))).status).toBe(200);
    expect((await post(sized(MAX))).status).toBe(200);
    fetchMock.mockClear();
    const r = await post(sized(MAX + 1));
    expect(r.status).toBe(413);
    expectActionHeaders(r);
    expect(await r.json()).toEqual(TOO_LARGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("counts UTF-8 bytes, not string units", async () => {
    const fetchMock = api(f.settledEpoch, await servedClaim());
    const body = JSON.stringify({ account: WALLET, pad: "€".repeat(400) });
    expect(body.length).toBeLessThan(MAX);
    expect(bytes(body)).toBeGreaterThan(MAX);
    const r = await post(body);
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual(TOO_LARGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads a chunked body that has no Content-Length", async () => {
    api(f.settledEpoch, await servedClaim());
    const whole = new TextEncoder().encode(sized(600));
    const { stream } = chunked([whole.slice(0, 100), whole.slice(100, 400), whole.slice(400)]);
    const r = await postStream(stream);
    expect(r.status).toBe(200);
  });

  it("stops reading and cancels the stream once the limit is passed", async () => {
    const fetchMock = api(f.settledEpoch, await servedClaim());
    const chunk = new Uint8Array(512).fill(120);
    const { stream, state } = chunked(Array.from({ length: 100 }, () => chunk));
    const r = await postStream(stream);
    expect(r.status).toBe(413);
    expectActionHeaders(r);
    expect(await r.json()).toEqual(TOO_LARGE);
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThan(10);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers a body that fails mid-read with an Action error, not a rejection", async () => {
    const fetchMock = api(f.settledEpoch, await servedClaim());
    const { stream } = chunked([new TextEncoder().encode('{"account":')], { failAfter: 1 });
    const r = await postStream(stream);
    expect(r.status).toBe(400);
    expectActionHeaders(r);
    expect(await r.json()).toEqual({ message: "That request could not be read. Try again." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts application/json with a UTF-8 charset and refuses anything else with 415", async () => {
    const fetchMock = api(f.settledEpoch, await servedClaim());
    const body = account(WALLET);
    for (const type of ["application/json; charset=utf-8", "Application/JSON"]) {
      const ok = await post(body, { headers: { "content-type": type } });
      expect(ok.status, type).toBe(200);
    }
    fetchMock.mockClear();
    for (const type of [
      "text/plain",
      "application/x-www-form-urlencoded",
      "application/jsonx",
      "application/json; charset=iso-8859-1",
    ]) {
      const r = await post(body, { headers: { "content-type": type } });
      expect(r.status, type).toBe(415);
      expectActionHeaders(r);
      expect(await r.json()).toEqual({ message: "Send the request as JSON." });
    }
    const none = await postStream(chunked([new TextEncoder().encode(body)]).stream, {});
    expect(none.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
