import { HYPHAE_PROGRAM_ID, type ListedInstruction } from "@hyphae/core";
import { createSolanaRpcFromTransport, type RpcTransport } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { settlementReader } from "./chain-reader.js";

const DEVNET = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const A = "3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk";
const B = "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR";
const SIG = "5".repeat(87);

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

  it("finds the transaction that created an account, and remembers it once finalized", async () => {
    const created = (finalized: boolean) =>
      rpcWith(({ method, params }) => {
        if (method === "getSignaturesForAddress") {
          return [
            {
              signature: SIG,
              slot: 1,
              err: null,
              memo: null,
              blockTime: 1,
              confirmationStatus: finalized ? "finalized" : "confirmed",
            },
          ];
        }
        const commitment = (params[1] as { commitment: string }).commitment;
        if (!finalized && commitment === "finalized") return null;
        return {
          slot: 1,
          blockTime: 1,
          meta: {
            err: null,
            innerInstructions: [],
            loadedAddresses: { writable: [], readonly: [] },
          },
          transaction: {
            signatures: [SIG],
            message: {
              accountKeys: [B, A, HYPHAE_PROGRAM_ID],
              instructions: [{ programIdIndex: 2, accounts: [0, 1], data: "2", stackHeight: null }],
            },
          },
        };
      });
    const ours = (ix: ListedInstruction) =>
      ix.program === HYPHAE_PROGRAM_ID && ix.accounts[1] === A;
    const final = created(true);
    const reader = settlementReader(final.rpc);
    expect(await reader.creation(A, ours)).toBe(SIG);
    const asked = final.calls.length;
    expect(await reader.creation(A, ours)).toBe(SIG);
    expect(final.calls).toHaveLength(asked);
    // A remembered creation still has to be the instruction asked for.
    expect(await reader.creation(A, () => false)).toBeNull();
    expect(final.calls.length).toBeGreaterThan(asked);

    const recent = created(false);
    const fresh = settlementReader(recent.rpc);
    expect(await fresh.creation(A, ours)).toBe(SIG);
    const before = recent.calls.length;
    expect(await fresh.creation(A, ours)).toBe(SIG);
    expect(recent.calls.length).toBeGreaterThan(before);
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
