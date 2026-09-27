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
  createNoopSigner,
  createSolanaRpcFromTransport,
  getBase58Decoder,
  type RpcTransport,
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import { programAccount, publishTransaction } from "./chain.js";

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

  // An RPC whose history for the epoch holds `spam` older transactions that only reference it,
  // then the publish_epoch that created it, in the second its account records.
  async function chainWith(spam: number) {
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
    const history = [
      { signature: "P".repeat(87), blockTime: PUBLISHED_AT },
      ...Array.from({ length: spam }, (_, i) => ({
        signature: `${String.fromCharCode(65 + i)}${"s".repeat(86)}`,
        blockTime: PUBLISHED_AT - 100 - i,
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
        result = history.map((h) => ({
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
          signature === history[0]?.signature
            ? listed(publish.data as Uint8Array, keys.length - 1)
            : listed(system, keys.indexOf(SYSTEM));
      }
      return { jsonrpc: "2.0", id, result } as T;
    };
    return { rpc: createSolanaRpcFromTransport(transport), e, fetched, publish: history[0] };
  }

  it("finds the publish behind more older references than its lookup bound", async () => {
    const { rpc, e, fetched, publish } = await chainWith(12);
    expect(await publishTransaction(rpc, e)).toBe(publish?.signature);
    expect(fetched[0]).toBe(publish?.signature);
  });
});
