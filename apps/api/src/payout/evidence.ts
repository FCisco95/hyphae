import type { ListedInstruction } from "@hyphae/core";
import {
  address,
  type Commitment,
  getBase58Encoder,
  type Rpc,
  type Signature,
  type SolanaRpcApi,
} from "@solana/kit";

// The transaction that created a program account. `init` succeeds once per address, so exactly one
// successful transaction carries the creating instruction; anything else that touched the address
// (lamports sent to it before or after, a later claim against an epoch) is skipped. A node lists
// signatures newest first, so the lookup pages back and tries the oldest successful ones first,
// preferring any from the second the account records as its creation. It gives up past its bounds,
// unless it is `exhaustive`: then it pages to the start of the history and tries every transaction
// from that second, so references an attacker lands there or afterwards only slow it down. Only an
// attended operator step (publish recovery) searches exhaustively; public reads stay bounded.

const PAGE = 1_000;
const MAX_PAGES = 10;
const MAX_TRANSACTIONS = 10;

export interface Creation {
  signature: string;
  finalized: boolean;
  instructions: ListedInstruction[];
}

type Signal = () => AbortSignal;

export async function creatingTransaction(
  rpc: Rpc<SolanaRpcApi>,
  at: string,
  matches: (ix: ListedInstruction) => boolean,
  opts: { hint?: string | null; blockTime?: bigint; signal?: Signal; exhaustive?: boolean } = {},
): Promise<Creation | null> {
  const signal: Signal = opts.signal ?? (() => new AbortController().signal);
  if (opts.hint) {
    const found = await creation(rpc, opts.hint, undefined, matches, signal);
    if (found) return found;
  }
  const history = [];
  let before: Signature | undefined;
  for (let page = 0; opts.exhaustive || page < MAX_PAGES; page += 1) {
    const got = await rpc
      .getSignaturesForAddress(address(at), {
        limit: PAGE,
        commitment: "confirmed",
        ...(before ? { before } : {}),
      })
      .send({ abortSignal: signal() });
    history.push(...got);
    if (got.length < PAGE) break;
    before = got.at(-1)?.signature;
  }
  const candidates = history.filter((e) => e.err === null).reverse();
  const recorded = candidates.filter((e) => e.blockTime === opts.blockTime);
  const others = candidates.filter((e) => e.blockTime !== opts.blockTime);
  const tried = opts.exhaustive
    ? [...recorded, ...others.slice(0, MAX_TRANSACTIONS)]
    : [...recorded, ...others].slice(0, MAX_TRANSACTIONS);
  for (const e of tried) {
    const commitment = e.confirmationStatus === "finalized" ? "finalized" : "confirmed";
    const found = await creation(rpc, e.signature, commitment, matches, signal);
    if (found) return found;
  }
  return null;
}

// The transaction, if it succeeded and carries a matching instruction. Without a known
// commitment it is read as finalized first, so a finalized creation is known to be one.
async function creation(
  rpc: Rpc<SolanaRpcApi>,
  signature: string,
  commitment: Commitment | undefined,
  matches: (ix: ListedInstruction) => boolean,
  signal: Signal,
): Promise<Creation | null> {
  for (const c of commitment ? [commitment] : (["finalized", "confirmed"] as const)) {
    const tx = await rpc
      .getTransaction(signature as Signature, {
        commitment: c,
        encoding: "json",
        maxSupportedTransactionVersion: 0,
      })
      .send({ abortSignal: signal() });
    if (!tx) continue;
    if (tx.meta?.err !== null) return null;
    const instructions = listed(tx);
    return instructions.some(matches)
      ? { signature, finalized: c === "finalized", instructions }
      : null;
  }
  return null;
}

type Compiled = { programIdIndex: number; accounts: readonly number[]; data: string };

// Every instruction, top-level and inner, with its indexes resolved against the static keys and
// then the keys loaded from address lookup tables (writable, then read-only).
function listed(tx: {
  transaction: { message: { accountKeys: readonly string[]; instructions: readonly Compiled[] } };
  meta: {
    innerInstructions?: readonly { instructions: readonly Compiled[] }[] | null;
    loadedAddresses?: { writable: readonly string[]; readonly: readonly string[] };
  } | null;
}): ListedInstruction[] {
  const loaded = tx.meta?.loadedAddresses;
  const keys = [
    ...tx.transaction.message.accountKeys,
    ...(loaded?.writable ?? []),
    ...(loaded?.readonly ?? []),
  ];
  const base58 = getBase58Encoder();
  const one = (i: Compiled): ListedInstruction => ({
    program: keys[Number(i.programIdIndex)] ?? "",
    accounts: i.accounts.map((k) => keys[Number(k)] ?? ""),
    data: Uint8Array.from(base58.encode(i.data)),
  });
  return [
    ...tx.transaction.message.instructions.map(one),
    ...(tx.meta?.innerInstructions ?? []).flatMap((g) => g.instructions.map(one)),
  ];
}
