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
import { GET, OPTIONS, POST } from "./route.js";

const DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const EPOCH_URL = "https://api.test/v1/communities/MintAbc/epochs/2";
const ACTION_URL = "https://site.test/api/actions/claim/MintAbc/2";

const params = (mint = "MintAbc", index = "2") =>
  ({ params: Promise.resolve({ mint, index }) }) as const;
const post = (body: string, init: RequestInit = {}) =>
  POST(new Request(ACTION_URL, { method: "POST", body, ...init }), params());
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
    await post(account(WALLET), { headers: { "x-real-ip": "203.0.113.9" } });
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
      JSON.stringify({ account: WALLET, pad: "x".repeat(2048) }),
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

  it("says when the payout was already claimed, and builds nothing", async () => {
    const claim = await servedClaim();
    api(f.settledEpoch, { ...claim, payment: { status: "paid", claim_tx: f.CLAIM_TX } });
    const r = await post(account(WALLET));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ message: "This wallet already claimed epoch 2." });
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
