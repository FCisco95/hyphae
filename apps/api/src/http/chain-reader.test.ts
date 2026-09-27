import { HYPHAE_PROGRAM_ID } from "@hyphae/core";
import { createSolanaRpcFromTransport, type RpcTransport } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { settlementReader } from "./chain-reader.js";

const DEVNET = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const A = "3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk";
const B = "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR";

type Call = { method: string; params: unknown[] };

// A JSON-RPC server in memory: `answer` returns each method's result.
function rpcWith(answer: (call: Call) => unknown) {
  const calls: Call[] = [];
  const transport: RpcTransport = async <T>({ payload }: { payload: unknown }) => {
    const { id, method, params } = payload as Call & { id: number };
    calls.push({ method, params });
    return { jsonrpc: "2.0", id, result: answer({ method, params }) } as T;
  };
  return { rpc: createSolanaRpcFromTransport(transport), calls };
}

const account = (owner: string, bytes: number[]) => ({
  data: [Buffer.from(bytes).toString("base64"), "base64"],
  executable: false,
  lamports: 1_000_000,
  owner,
  rentEpoch: 0,
  space: bytes.length,
});

describe("the chain reader", () => {
  it("names its network from the genesis hash, once", async () => {
    const { rpc, calls } = rpcWith(() => DEVNET);
    const reader = settlementReader(rpc);
    expect(await reader.network()).toBe("solana:devnet");
    expect(await reader.network()).toBe("solana:devnet");
    expect(calls.filter((c) => c.method === "getGenesisHash")).toHaveLength(1);
  });

  it("refuses a cluster it does not know", async () => {
    const { rpc } = rpcWith(() => "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY");
    await expect(settlementReader(rpc).network()).rejects.toThrow(/unknown cluster/);
  });

  it("returns program accounts in order, null where none exists, in pages of 100", async () => {
    const { rpc, calls } = rpcWith(({ params }) => ({
      context: { slot: 1 },
      value: (params[0] as string[]).map((a) =>
        a === A ? account(HYPHAE_PROGRAM_ID, [1, 2, 3]) : null,
      ),
    }));
    const at = [A, B, ...Array.from({ length: 101 }, () => B)];
    const got = await settlementReader(rpc).accounts(HYPHAE_PROGRAM_ID, at);
    expect(got).toHaveLength(103);
    expect(got[0]).toEqual(Uint8Array.of(1, 2, 3));
    expect(got.slice(1).every((a) => a === null)).toBe(true);
    expect(calls.filter((c) => c.method === "getMultipleAccounts")).toHaveLength(2);
  });

  it("refuses an account another program owns", async () => {
    const { rpc } = rpcWith(() => ({ context: { slot: 1 }, value: [account(B, [1])] }));
    await expect(settlementReader(rpc).accounts(HYPHAE_PROGRAM_ID, [A])).rejects.toThrow(
      /not owned/,
    );
  });

  it("finds the transaction that created an account: the oldest successful one", async () => {
    const sig = (c: string) => `${c.repeat(87)}`;
    const entry = (signature: string, err: unknown) => ({
      signature,
      slot: 1,
      err,
      memo: null,
      blockTime: null,
      confirmationStatus: "confirmed",
    });
    const { rpc } = rpcWith(() => [
      entry(sig("3"), { InstructionError: [0, { Custom: 0 }] }),
      entry(sig("2"), null),
      entry(sig("1"), { InstructionError: [0, { Custom: 1 }] }),
    ]);
    expect(await settlementReader(rpc).firstSignature(A)).toBe(sig("2"));
    const none = rpcWith(() => []);
    expect(await settlementReader(none.rpc).firstSignature(A)).toBeNull();
  });

  it("gives a recent blockhash with its last valid height", async () => {
    const { rpc } = rpcWith(() => ({
      context: { slot: 1 },
      value: { blockhash: DEVNET, lastValidBlockHeight: 1000 },
    }));
    expect(await settlementReader(rpc).latestBlockhash()).toEqual({
      blockhash: DEVNET,
      lastValidBlockHeight: 1000n,
    });
  });

  it("gives up on a node that does not answer", async () => {
    const transport: RpcTransport = ({ signal }) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const reader = settlementReader(createSolanaRpcFromTransport(transport), 50);
    await expect(reader.network()).rejects.toThrow();
  });
});
