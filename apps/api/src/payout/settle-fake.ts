// A settle chain for tests: the bound community with a fixed admin and fee recipient, a vault
// whose free balance the test sets, and one epoch account per index once one is published. It
// records what the loop asks of it.
import { HYPHAE_PROGRAM_ID } from "@hyphae/core";
import type { SettleChain } from "./distribution-settle.js";
import type { OnChainEpoch, PublishArgs } from "./publish.js";

export const FAKE_ADMIN = "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR";
export const FAKE_FEE_RECIPIENT = "7dsxLdz2BeakoH3bjB1WzHtK3t6fHC3PoP4hs2Z3C6EQ";
// The vault account's rent-exempt minimum as the fake cluster reports it.
export const FAKE_RENT = 953_520n;

export function fakeSettleChain(o: {
  community: string;
  free: bigint;
  outstanding?: bigint;
  // undefined: the publisher is the admin; null: no publisher is configured.
  publisher?: string | null;
}) {
  const state = {
    free: o.free,
    outstanding: o.outstanding ?? 0n,
    onChain: new Map<bigint, OnChainEpoch>(),
  };
  const calls = { read: 0, publish: [] as PublishArgs[], found: [] as PublishArgs[] };
  const publisher = o.publisher === undefined ? FAKE_ADMIN : o.publisher;
  const chain: SettleChain = {
    network: "solana:devnet",
    programId: HYPHAE_PROGRAM_ID,
    // One snapshot: the vault's lamports and the outstanding figure come from the same state.
    readCommunity: async ({ address }) => {
      calls.read += 1;
      if (address !== o.community) return null;
      return {
        address,
        admin: FAKE_ADMIN,
        feeRecipient: FAKE_FEE_RECIPIENT,
        outstandingLamports: state.outstanding,
        vaultLamports: FAKE_RENT + state.outstanding + state.free,
        rentExemptMinimum: FAKE_RENT,
      };
    },
    readEpoch: async (_community, index) => state.onChain.get(index) ?? null,
    publisher:
      publisher === null
        ? null
        : {
            address: publisher,
            publishEpoch: async (input) => {
              // The program creates one epoch account per index.
              if (state.onChain.has(input.index)) throw new Error("account already in use");
              calls.publish.push(input);
              state.onChain.set(input.index, {
                root: input.root,
                auditHash: input.auditHash,
                grossLamports: input.grossLamports,
                allocatedLamports: input.allocatedLamports,
              });
              return "sig-publish";
            },
          },
    publishSignature: async (input) => {
      calls.found.push(input);
      return "sig-found-on-chain";
    },
  };
  return { chain, calls, state };
}
