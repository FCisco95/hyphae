import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { solanaChain } from "../payout/chain.js";
import type { SettleChain } from "../payout/distribution-settle.js";
import { handoffSender } from "../payout/handoff.js";
import { settleChain } from "../payout/settle-chain.js";
import { buildStore } from "./builds.js";
import type { PublishDeps } from "./publish.js";
import { SETUP_RECORDS, type SetupRecord } from "./setup-records.js";

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

// Part B's chain (browser publish and init-community), from the read RPC. No key: the hand-off
// signer stands where a key would, and only signatures made by the admin's wallet are sent.
// Null without an https RPC to derive the websocket from.
export function publishDeps(
  rpcUrl: string,
  network: SettleChain["network"],
  records: readonly SetupRecord[] = SETUP_RECORDS,
): PublishDeps | null {
  if (!rpcUrl.startsWith("https://")) return null;
  const wsUrl = `wss://${rpcUrl.slice("https://".length)}`;
  const rpc = createSolanaRpc(rpcUrl);
  const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);
  const height = () => rpc.getBlockHeight({ commitment: "confirmed" }).send();
  // Read at boot, before any build; a failed read is retried by the next build instead of kept.
  let started: Promise<bigint> | undefined;
  const startHeight = () => {
    started ??= height().catch((error: unknown) => {
      started = undefined;
      throw error;
    });
    return started;
  };
  void startHeight().catch(() => undefined);
  return {
    network,
    chain: (publisher) =>
      settleChain({
        rpcUrl,
        wsUrl,
        network,
        rpc,
        rpcSubscriptions,
        ...(publisher && { publisher }),
      }),
    sending: (signer) =>
      solanaChain({ rpcUrl, wsUrl, network, admin: signer, rpc, rpcSubscriptions }),
    send: handoffSender(rpc, rpcSubscriptions),
    blockHeight: height,
    startHeight,
    builds: buildStore(),
    setupRecords: records,
    log: (line) => console.log(JSON.stringify(line)),
  };
}
