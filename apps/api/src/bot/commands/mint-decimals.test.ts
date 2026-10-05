import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const configured = vi.hoisted(() => ({ rpc: "https://rpc.test" as string | undefined }));
vi.mock("../../env.js", () => ({
  env: {
    get READ_RPC_URL() {
      return configured.rpc;
    },
  },
}));

const { mintDecimals } = await import("./mint-decimals.js");
const supply = (value: unknown) => new Response(JSON.stringify({ result: { value } }));

beforeEach(() => {
  configured.rpc = "https://rpc.test";
});
afterEach(() => vi.unstubAllGlobals());

describe("mintDecimals", () => {
  it("reads the decimals once and then serves them from memory", async () => {
    const fetchMock = vi.fn(async () => supply({ decimals: 6 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await mintDecimals("MintA")).toBe(6);
    expect(await mintDecimals("MintA")).toBe(6);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failure, so the next call tries again", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(supply({ decimals: 9 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await mintDecimals("MintB")).toBeUndefined();
    expect(await mintDecimals("MintB")).toBe(9);
  });

  it("rejects an answer that is not a plausible decimals count", async () => {
    for (const bad of [
      { decimals: "6" },
      { decimals: -1 },
      { decimals: 19 },
      { decimals: 1.5 },
      {},
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => supply(bad)),
      );
      expect(await mintDecimals(`Bad${JSON.stringify(bad)}`)).toBeUndefined();
    }
  });

  it("returns undefined, without calling out, when no RPC is configured", async () => {
    configured.rpc = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await mintDecimals("MintC")).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
