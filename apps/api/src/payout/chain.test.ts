import {
  epochAddress,
  HYPHAE_PROGRAM_ID,
  publishEpochInstruction,
  vaultAddress,
} from "@hyphae/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import {
  address,
  appendTransactionMessageInstructions,
  blockhash,
  createNoopSigner,
  createSolanaRpcFromTransport,
  createTransactionMessage,
  getBase58Decoder,
  getBase64Encoder,
  getTransactionDecoder,
  pipe,
  type RpcTransport,
  type SignatureDictionary,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type TransactionModifyingSigner,
  type TransactionPartialSigner,
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import { programAccount, publishTransaction, signSimulated } from "./chain.js";

const SYSTEM = "11111111111111111111111111111111";
const OTHER = "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR";

const info = (owner: string, bytes: number[], executable = false) => ({
  owner,
  executable,
  data: [Buffer.from(bytes).toString("base64"), "base64"] as const,
});

describe("programAccount", () => {
  it("returns the bytes of an account the program owns", () => {
    expect(programAccount(HYPHAE_PROGRAM_ID, info(HYPHAE_PROGRAM_ID, [7, 8]))).toEqual(
      Uint8Array.of(7, 8),
    );
  });

  it("reads no account, or lamports prefunded to an empty system account, as not created", () => {
    expect(programAccount(HYPHAE_PROGRAM_ID, null)).toBeNull();
    expect(programAccount(HYPHAE_PROGRAM_ID, info(SYSTEM, []))).toBeNull();
  });

  it("refuses another owner, a system account with data, and an executable one", () => {
    for (const other of [info(OTHER, [1]), info(SYSTEM, [0]), info(SYSTEM, [], true)]) {
      expect(() => programAccount(HYPHAE_PROGRAM_ID, other)).toThrow(/not owned by/);
    }
  });
});

describe("publishTransaction", () => {
  const ADMIN = "3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk";
  const PUBLISHED_AT = 1_790_000_000;

  async function expected() {
    const community = address("7rq3hCvp4Kmeo9YQLGnwd4AVMJVEkUjVAbrYVfGCf8M2");
    return {
      programId: HYPHAE_PROGRAM_ID,
      community,
      vault: await vaultAddress(HYPHAE_PROGRAM_ID, community),
      feeRecipient: address(OTHER),
      epoch: await epochAddress(HYPHAE_PROGRAM_ID, community, 1n),
      index: 1n,
      root: new Uint8Array(32).fill(1),
      auditHash: new Uint8Array(32).fill(2),
      grossLamports: 50_000_000n,
      allocatedLamports: 30_000_000n,
    };
  }

  // Distinct base58 signatures.
  const sig = (n: number) => {
    const digits = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let out = "";
    for (let v = n; out.length < 6; v = Math.floor(v / 58)) out += digits[v % 58];
    return out.padEnd(87, "s");
  };

  // An RPC whose history for the epoch holds the publish_epoch that created it, in the second its
  // account records, among transactions that only reference the address: `older` before it (in
  // that same second with `sameSecond`) and `newer` after it.
  async function chainWith(spam: {
    older?: number;
    newer?: number;
    sameSecond?: boolean;
    // A node may list a transaction without its block time.
    untimed?: boolean;
  }) {
    const e = await expected();
    const publish = publishEpochInstruction({ ...e, admin: createNoopSigner(address(ADMIN)) });
    const keys = [ADMIN, ...(publish.accounts ?? []).slice(1).map((a) => a.address)];
    keys.push(HYPHAE_PROGRAM_ID);
    const listed = (data: Uint8Array, program: number) => ({
      slot: 5,
      blockTime: PUBLISHED_AT,
      meta: { err: null, innerInstructions: [], loadedAddresses: { writable: [], readonly: [] } },
      transaction: {
        signatures: ["x"],
        message: {
          accountKeys: keys,
          instructions: [
            {
              programIdIndex: program,
              accounts: keys.slice(0, -1).map((_, i) => i),
              data: getBase58Decoder().decode(data),
            },
          ],
        },
      },
    });
    const created = { signature: sig(0), blockTime: spam.untimed ? null : PUBLISHED_AT };
    // Newest first, as a node lists them.
    const history = [
      ...Array.from({ length: spam.newer ?? 0 }, (_, i) => ({
        signature: sig(1 + i),
        blockTime: PUBLISHED_AT + 1 + i,
      })).reverse(),
      created,
      ...Array.from({ length: spam.older ?? 0 }, (_, i) => ({
        signature: sig(20_000 + i),
        blockTime: spam.untimed ? null : spam.sameSecond ? PUBLISHED_AT : PUBLISHED_AT - 100 - i,
      })),
    ];
    const epochAccount = new Uint8Array(8 + 32 + 8 + 32 + 32 + 8 * 4 + 8 + 1);
    epochAccount.set(sha256(utf8ToBytes("account:Epoch")).subarray(0, 8));
    new DataView(epochAccount.buffer).setBigInt64(144, BigInt(PUBLISHED_AT), true);
    const fetched: string[] = [];
    const transport: RpcTransport = async <T>({ payload }: { payload: unknown }) => {
      const { id, method, params } = payload as { id: number; method: string; params: unknown[] };
      let result: unknown = null;
      if (method === "getAccountInfo") {
        result = {
          context: { slot: 5 },
          value: {
            owner: HYPHAE_PROGRAM_ID,
            executable: false,
            lamports: 1,
            rentEpoch: 0,
            space: epochAccount.length,
            data: [Buffer.from(epochAccount).toString("base64"), "base64"],
          },
        };
      }
      if (method === "getSignaturesForAddress") {
        const { limit, before } = params[1] as { limit: number; before?: string };
        const from = before ? history.findIndex((h) => h.signature === before) + 1 : 0;
        result = history.slice(from, from + limit).map((h) => ({
          signature: h.signature,
          slot: 5,
          err: null,
          memo: null,
          blockTime: h.blockTime,
          confirmationStatus: "finalized",
        }));
      }
      if (method === "getTransaction") {
        const signature = params[0] as string;
        fetched.push(signature);
        const system = Uint8Array.of(2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0);
        result =
          signature === created.signature
            ? listed(publish.data as Uint8Array, keys.length - 1)
            : listed(system, keys.indexOf(SYSTEM));
      }
      return { jsonrpc: "2.0", id, result } as T;
    };
    return { rpc: createSolanaRpcFromTransport(transport), e, fetched, publish: created };
  }

  it("finds the publish behind more older references than its lookup bound", async () => {
    const { rpc, e, fetched, publish } = await chainWith({ older: 12 });
    expect(await publishTransaction(rpc, e)).toBe(publish.signature);
    expect(fetched[0]).toBe(publish.signature);
  });

  // Recovery is an attended operator step, so it may search as long as it needs: an attacker who
  // lands references in the same second, or floods the address afterwards, only slows it down.
  it("finds the publish behind more references from its own second than its lookup bound", async () => {
    const { rpc, e, publish } = await chainWith({ older: 12, sameSecond: true });
    expect(await publishTransaction(rpc, e)).toBe(publish.signature);
  });

  it("tries every transaction when the node lists them without block times", async () => {
    const { rpc, e, publish } = await chainWith({ older: 12, untimed: true });
    expect(await publishTransaction(rpc, e)).toBe(publish.signature);
  });

  it("pages back past more newer references than a public read would", async () => {
    const { rpc, e, publish } = await chainWith({ newer: 10_001 });
    expect(await publishTransaction(rpc, e)).toBe(publish.signature);
  });
});

describe("signSimulated", () => {
  const PAYER = address("3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk");
  const BLOCKHASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

  function setup(err: unknown) {
    const simulated: string[] = [];
    const transport: RpcTransport = async <T>({ payload }: { payload: unknown }) => {
      const { id, method, params } = payload as { id: number; method: string; params: unknown[] };
      if (method !== "simulateTransaction") throw new Error(`unexpected ${method}`);
      simulated.push(params[0] as string);
      const value = { err, logs: ["Program log: refused"], accounts: null, unitsConsumed: 1 };
      return { jsonrpc: "2.0", id, result: { context: { slot: 1 }, value } } as T;
    };
    let signs = 0;
    const signer: TransactionPartialSigner = {
      address: PAYER,
      signTransactions: async (txs) => {
        signs += 1;
        return txs.map(() => ({ [PAYER]: new Uint8Array(64) }) as SignatureDictionary);
      },
    };
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(signer, m),
      (m) =>
        setTransactionMessageLifetimeUsingBlockhash(
          { blockhash: blockhash(BLOCKHASH), lastValidBlockHeight: 10n },
          m,
        ),
      (m) =>
        appendTransactionMessageInstructions(
          [{ programAddress: address(SYSTEM), data: Uint8Array.of(2, 0, 0, 0) }],
          m,
        ),
    );
    return { rpc: createSolanaRpcFromTransport(transport), message, simulated, signs: () => signs };
  }

  it("asks no signer to sign a transaction the chain would refuse", async () => {
    const s = setup({ InstructionError: [0, { Custom: 0 }] });
    await expect(signSimulated(s.rpc, s.message)).rejects.toThrow(/simulation.*refused/s);
    expect(s.signs()).toBe(0);
  });

  // A modifying or sending signer could change or send the transaction after the simulation.
  it("refuses a signer that may change the message after it was simulated", async () => {
    const s = setup(null);
    const modifying: TransactionModifyingSigner = {
      address: PAYER,
      modifyAndSignTransactions: async (txs) => txs as never,
    };
    const message = setTransactionMessageFeePayerSigner(modifying, s.message);
    await expect(signSimulated(s.rpc, message)).rejects.toThrow(/partial signers/);
    expect(s.simulated).toHaveLength(0);
  });

  it("signs exactly the message it simulated", async () => {
    const s = setup(null);
    const signed = await signSimulated(s.rpc, s.message);
    expect(s.signs()).toBe(1);
    const simulated = getTransactionDecoder().decode(
      getBase64Encoder().encode(s.simulated[0] as string),
    );
    expect(signed.messageBytes).toEqual(simulated.messageBytes);
  });
});
