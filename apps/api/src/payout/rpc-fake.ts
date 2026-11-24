// An RPC for tests: the devnet genesis, a fixed latest blockhash, a passing simulation, and the
// accounts and balances a test sets. It records the transactions it simulated and was sent.
import {
  createSolanaRpcFromTransport,
  type RpcSubscriptions,
  type RpcTransport,
  type SolanaRpcSubscriptionsApi,
} from "@solana/kit";
import { GENESIS } from "./chain.js";

export const FAKE_BLOCKHASH = "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY";
export const FAKE_LAST_VALID = 1_000n;

export interface FakeAccount {
  owner: string;
  executable?: boolean;
  data?: Uint8Array;
  lamports?: bigint;
}

export function fakeRpc(
  o: {
    accounts?: Map<string, FakeAccount>;
    balances?: Map<string, bigint>;
    blockhash?: string;
    blockHeight?: bigint;
    simulationError?: unknown;
  } = {},
) {
  const accounts = o.accounts ?? new Map<string, FakeAccount>();
  const seen = { simulated: [] as string[], sent: [] as string[], blockhashes: 0 };
  let blockhash = o.blockhash ?? FAKE_BLOCKHASH;
  const info = (at: string) => {
    const a = accounts.get(at);
    if (!a) return null;
    return {
      owner: a.owner,
      executable: a.executable ?? false,
      lamports: a.lamports ?? 1_000_000n,
      data: [Buffer.from(a.data ?? new Uint8Array()).toString("base64"), "base64"],
      rentEpoch: 0n,
      space: BigInt(a.data?.length ?? 0),
    };
  };
  const transport: RpcTransport = async <T>({ payload }: { payload: unknown }) => {
    const { id, method, params } = payload as { id: number; method: string; params: unknown[] };
    const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result }) as T;
    const context = { slot: 1 };
    switch (method) {
      case "getGenesisHash":
        return ok(GENESIS["solana:devnet"]);
      case "getLatestBlockhash":
        seen.blockhashes += 1;
        return ok({ context, value: { blockhash, lastValidBlockHeight: FAKE_LAST_VALID } });
      case "getBlockHeight":
        return ok(o.blockHeight ?? 10n);
      case "simulateTransaction":
        seen.simulated.push(params[0] as string);
        return ok({
          context,
          value: { err: o.simulationError ?? null, logs: [], accounts: null, unitsConsumed: 1 },
        });
      case "sendTransaction":
        seen.sent.push(params[0] as string);
        return ok("sent");
      case "getAccountInfo":
        return ok({ context, value: info(params[0] as string) });
      case "getMultipleAccounts":
        return ok({ context, value: (params[0] as string[]).map(info) });
      case "getBalance":
        return ok({ context, value: o.balances?.get(params[0] as string) ?? 0n });
      case "getMinimumBalanceForRentExemption":
        return ok(890_880n + BigInt(params[0] as number) * 6_960n);
      default:
        throw new Error(`fake rpc: unexpected ${method}`);
    }
  };
  return {
    rpc: createSolanaRpcFromTransport(transport),
    // Never used by a build: a hand-off is not sent through the chain code.
    rpcSubscriptions: {} as RpcSubscriptions<SolanaRpcSubscriptionsApi>,
    accounts,
    seen,
    setBlockhash: (next: string) => {
      blockhash = next;
    },
  };
}
