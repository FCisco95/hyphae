import type { SettleChain } from "../payout/distribution-settle.js";
import { settleChain } from "../payout/settle-chain.js";

// The on-chain admin of a bound community, through the settle loop's own validated read (owner,
// mint and the address the admin derives). Built without a publisher: this process never holds
// a key. A failed build is retried on the next call instead of being cached.
export function onChainAdminReader(
  build: () => Promise<Pick<SettleChain, "readCommunity">>,
): (input: { mint: string; address: string }) => Promise<string | null> {
  let built: Promise<Pick<SettleChain, "readCommunity">> | undefined;
  return async (input) => {
    built ??= build().catch((error: unknown) => {
      built = undefined;
      throw error;
    });
    const community = await (await built).readCommunity(input);
    return community && community.address === input.address ? community.admin : null;
  };
}

// One read-only settle chain per process, rebuilt after a failed build. No `publisher`:
// settleChain then holds no signer and cannot send.
export function readOnlyChain(
  rpcUrl: string,
  network: SettleChain["network"],
): () => Promise<SettleChain> {
  let built: Promise<SettleChain> | undefined;
  return () => {
    built ??= settleChain({ rpcUrl, wsUrl: "", network }).catch((error: unknown) => {
      built = undefined;
      throw error;
    });
    return built;
  };
}
