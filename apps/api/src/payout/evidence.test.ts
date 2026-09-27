import { HYPHAE_PROGRAM_ID, type ListedInstruction } from "@hyphae/core";
import { createSolanaRpcFromTransport, getBase58Decoder, type RpcTransport } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { creatingTransaction } from "./evidence.js";

const AT = "3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk";
const PAYER = "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR";
const SYSTEM = "11111111111111111111111111111111";
const BLOCKHASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const sig = (c: string) => c.repeat(87);
const b58 = (bytes: number[]) => getBase58Decoder().decode(Uint8Array.from(bytes));

// The instruction under test: the program's, with a first data byte of 7.
const creates = (ix: ListedInstruction) => ix.program === HYPHAE_PROGRAM_ID && ix.data[0] === 7;

type Tx = { kind: "creation" | "transfer"; err?: unknown; inner?: boolean; lookup?: boolean };

// A confirmed transaction as getTransaction returns it with json encoding.
function transaction(t: Tx) {
  const ours = t.kind === "creation";
  // With `lookup`, the program's address comes from an address lookup table, after the static keys.
  const keys = t.lookup ? [PAYER, AT, SYSTEM] : [PAYER, AT, SYSTEM, HYPHAE_PROGRAM_ID];
  const program = ours ? 3 : 2;
  const data = ours ? b58([7, 1, 2]) : b58([2, 0, 0, 0]);
  const top = { programIdIndex: t.inner ? 2 : program, accounts: [0, 1], data, stackHeight: null };
  return {
    slot: 5,
    blockTime: 100,
    version: 0,
    meta: {
      err: t.err ?? null,
      innerInstructions: t.inner
        ? [{ index: 0, instructions: [{ programIdIndex: program, accounts: [0, 1], data }] }]
        : [],
      loadedAddresses: { writable: [], readonly: t.lookup ? [HYPHAE_PROGRAM_ID] : [] },
    },
    transaction: {
      signatures: [sig("1")],
      message: { accountKeys: keys, recentBlockhash: BLOCKHASH, instructions: [top] },
    },
  };
}

type Entry = { signature: string; err?: unknown; blockTime?: number; finalized?: boolean };

// An RPC holding `history` for AT (newest first, as the node returns it) and each transaction.
function chainWith(history: Entry[], txs: Record<string, Tx>) {
  const calls: { method: string; params: unknown[] }[] = [];
  const transport: RpcTransport = async <T>({ payload }: { payload: unknown }) => {
    const { id, method, params } = payload as { id: number; method: string; params: unknown[] };
    calls.push({ method, params });
    let result: unknown = null;
    if (method === "getSignaturesForAddress") {
      const { limit, before } = (params[1] ?? {}) as { limit: number; before?: string };
      const from = before ? history.findIndex((e) => e.signature === before) + 1 : 0;
      result = history.slice(from, from + limit).map((e) => ({
        signature: e.signature,
        slot: 5,
        err: e.err ?? null,
        memo: null,
        blockTime: e.blockTime ?? 100,
        confirmationStatus: e.finalized === false ? "confirmed" : "finalized",
      }));
    }
    if (method === "getTransaction") {
      const [signature, config] = params as [string, { commitment: string }];
      const entry = history.find((e) => e.signature === signature);
      const visible = config.commitment === "confirmed" || entry?.finalized !== false;
      const t = txs[signature];
      result = t && visible ? transaction(t) : null;
    }
    return { jsonrpc: "2.0", id, result } as T;
  };
  const fetched = () =>
    calls.filter((c) => c.method === "getTransaction").map((c) => c.params[0] as string);
  return { rpc: createSolanaRpcFromTransport(transport), calls, fetched };
}

describe("finding the transaction that created a program account", () => {
  it("skips transfers made before and after the creation, and failed attempts", async () => {
    const c = chainWith(
      [
        { signature: sig("4") },
        { signature: sig("3") },
        { signature: sig("2"), err: { InstructionError: [0, { Custom: 0 }] } },
        { signature: sig("A") },
      ],
      {
        [sig("4")]: { kind: "transfer" },
        [sig("3")]: { kind: "creation" },
        [sig("2")]: { kind: "creation", err: { InstructionError: [0, { Custom: 0 }] } },
        [sig("A")]: { kind: "transfer" },
      },
    );
    const found = await creatingTransaction(c.rpc, AT, creates);
    expect(found?.signature).toBe(sig("3"));
    // Oldest successful first; the failed attempt and the later transfer are never fetched.
    expect(c.fetched()).toEqual([sig("A"), sig("3")]);
  });

  it("pages back through a long history", async () => {
    const later = Array.from({ length: 1_000 }, (_, i) => ({
      signature: `${sig("5").slice(0, 80)}${String(i).padStart(7, "1")}`,
    }));
    const c = chainWith([...later, { signature: sig("3") }], { [sig("3")]: { kind: "creation" } });
    const found = await creatingTransaction(c.rpc, AT, creates);
    expect(found?.signature).toBe(sig("3"));
    expect(c.calls.filter((x) => x.method === "getSignaturesForAddress")).toHaveLength(2);
  });

  it("tries a recorded signature first, and does not trust one that is not the creation", async () => {
    const history = [{ signature: sig("4") }, { signature: sig("3") }];
    const txs: Record<string, Tx> = {
      [sig("4")]: { kind: "transfer" },
      [sig("3")]: { kind: "creation" },
    };
    const right = chainWith(history, txs);
    expect((await creatingTransaction(right.rpc, AT, creates, { hint: sig("3") }))?.signature).toBe(
      sig("3"),
    );
    expect(right.calls.map((x) => x.method)).toEqual(["getTransaction"]);
    const wrong = chainWith(history, txs);
    expect((await creatingTransaction(wrong.rpc, AT, creates, { hint: sig("4") }))?.signature).toBe(
      sig("3"),
    );
    const failed = chainWith(history, {
      ...txs,
      [sig("2")]: { kind: "creation", err: { InstructionError: [0, { Custom: 0 }] } },
    });
    expect(
      (await creatingTransaction(failed.rpc, AT, creates, { hint: sig("2") }))?.signature,
    ).toBe(sig("3"));
  });

  it("tries first a transaction from the second the account records as its creation", async () => {
    const c = chainWith(
      [
        { signature: sig("4"), blockTime: 900 },
        { signature: sig("3"), blockTime: 777 },
        { signature: sig("2"), blockTime: 500 },
      ],
      {
        [sig("4")]: { kind: "transfer" },
        [sig("3")]: { kind: "creation" },
        [sig("2")]: { kind: "transfer" },
      },
    );
    const found = await creatingTransaction(c.rpc, AT, creates, { blockTime: 777n });
    expect(found?.signature).toBe(sig("3"));
    expect(c.fetched()).toEqual([sig("3")]);
  });

  it("reads the program from a lookup table and from an inner instruction", async () => {
    for (const t of [
      { kind: "creation", lookup: true },
      { kind: "creation", inner: true },
    ] as Tx[]) {
      const c = chainWith([{ signature: sig("3") }], { [sig("3")]: t });
      expect((await creatingTransaction(c.rpc, AT, creates))?.signature).toBe(sig("3"));
    }
  });

  it("says whether the creation is finalized", async () => {
    const txs: Record<string, Tx> = { [sig("3")]: { kind: "creation" } };
    const final = chainWith([{ signature: sig("3") }], txs);
    expect((await creatingTransaction(final.rpc, AT, creates))?.finalized).toBe(true);
    const recent = chainWith([{ signature: sig("3"), finalized: false }], txs);
    expect(await creatingTransaction(recent.rpc, AT, creates)).toMatchObject({
      signature: sig("3"),
      finalized: false,
    });
  });

  it("gives up within its bounds when no transaction is the creation", async () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      signature: `${sig("6").slice(0, 80)}${String(i).padStart(7, "1")}`,
    }));
    const c = chainWith(
      history,
      Object.fromEntries(history.map((e) => [e.signature, { kind: "transfer" } as Tx])),
    );
    expect(await creatingTransaction(c.rpc, AT, creates)).toBeNull();
    expect(c.fetched().length).toBeLessThanOrEqual(10);
  });
});
