import { address, type Rpc, type SolanaRpcApi } from "@solana/kit";
import { GENESIS } from "../payout/chain.js";
import { type Creation, creatingTransaction } from "../payout/evidence.js";
import type { SettlementReader } from "./settlement.js";

// P14's chain reads over one RPC, each bounded by a timeout well inside the read's deadline, so a
// slow node makes a section unavailable instead of hanging the read API. Read-only: it holds no key.

const NETWORK_OF = new Map(
  Object.entries(GENESIS).map(([network, genesis]) => [genesis, network as keyof typeof GENESIS]),
);
const PAGE = 100; // getMultipleAccounts' limit
const PROVEN = 10_000;

export function settlementReader(rpc: Rpc<SolanaRpcApi>, timeoutMs = 1_500): SettlementReader {
  const abortSignal = () => AbortSignal.timeout(timeoutMs);
  let network: Promise<keyof typeof GENESIS> | undefined;
  // A finalized creation never changes, so it is looked up once per account.
  const proven = new Map<string, Creation>();
  return {
    network() {
      network ??= rpc
        .getGenesisHash()
        .send({ abortSignal: abortSignal() })
        .then((genesis) => {
          const found = NETWORK_OF.get(genesis);
          if (!found) throw new Error(`chain: unknown cluster (genesis ${genesis})`);
          return found;
        })
        .catch((error: unknown) => {
          network = undefined;
          throw error;
        });
      return network;
    },
    async accounts(owner, at) {
      const out: (Uint8Array | null)[] = [];
      for (let i = 0; i < at.length; i += PAGE) {
        const { value } = await rpc
          .getMultipleAccounts(at.slice(i, i + PAGE).map(address), {
            encoding: "base64",
            commitment: "confirmed",
          })
          .send({ abortSignal: abortSignal() });
        for (const account of value) {
          if (!account) {
            out.push(null);
            continue;
          }
          if (account.owner !== owner)
            throw new Error(`chain: an account is not owned by ${owner}`);
          out.push(Uint8Array.from(Buffer.from(account.data[0], "base64")));
        }
      }
      return out;
    },
    async creation(at, matches, hint = {}) {
      const known = proven.get(at);
      if (known?.instructions.some(matches)) return known.signature;
      const found = await creatingTransaction(rpc, at, matches, {
        hint: hint.signature ?? null,
        ...(hint.blockTime === undefined ? {} : { blockTime: hint.blockTime }),
        signal: abortSignal,
      });
      if (found?.finalized) {
        if (proven.size >= PROVEN) proven.delete(proven.keys().next().value as string);
        proven.set(at, found);
      }
      return found?.signature ?? null;
    },
    async latestBlockhash() {
      const { value } = await rpc
        .getLatestBlockhash({ commitment: "confirmed" })
        .send({ abortSignal: abortSignal() });
      return { blockhash: value.blockhash, lastValidBlockHeight: value.lastValidBlockHeight };
    },
  };
}
