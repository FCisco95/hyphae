import {
  communityAddress,
  decodeCommunity,
  decodeEpoch,
  epochAddress,
  HYPHAE_PROGRAM_ID,
  vaultAddress,
} from "@hyphae/core";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import {
  type Address,
  address,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  getAddressDecoder,
  type Rpc,
  type SolanaRpcApi,
  type TransactionSigner,
} from "@solana/kit";
import { GENESIS, programAccount, publishTransaction, solanaChain } from "./chain.js";
import type { SettleChain } from "./distribution-settle.js";
import type { OnChainEpoch, PublishArgs } from "./publish.js";

// The settle loop's chain on @solana/kit. The reads hold no key; a publish goes through
// solanaChain's simulated send with the publisher key, when the worker holds one. The RPC must
// prove it serves the named cluster, as the publish chain requires.

export async function settleChain(opts: {
  rpcUrl: string;
  wsUrl: string;
  network: SettleChain["network"];
  publisher?: TransactionSigner;
  programId?: Address;
  // Tests inject a transport; production builds one from the URL.
  rpc?: Rpc<SolanaRpcApi>;
}): Promise<SettleChain> {
  const programId = opts.programId ?? HYPHAE_PROGRAM_ID;
  const rpc = opts.rpc ?? createSolanaRpc(opts.rpcUrl);
  const genesis = await rpc.getGenesisHash().send();
  if (genesis !== GENESIS[opts.network]) {
    throw new Error(`chain: the RPC is not ${opts.network} (genesis ${genesis})`);
  }
  const sending = opts.publisher
    ? await solanaChain({
        rpcUrl: opts.rpcUrl,
        wsUrl: opts.wsUrl,
        network: opts.network,
        admin: opts.publisher,
        programId,
      })
    : null;
  const decoder = getAddressDecoder();

  async function accountInfo(at: Address) {
    const { value } = await rpc
      .getAccountInfo(at, { encoding: "base64", commitment: "confirmed" })
      .send();
    return value;
  }
  async function publishing(input: PublishArgs) {
    const community = address(input.community);
    return {
      programId,
      community,
      vault: await vaultAddress(programId, community),
      feeRecipient: address(input.feeRecipient),
      epoch: await epochAddress(programId, community, input.index),
      index: input.index,
      root: hexToBytes(input.root),
      auditHash: hexToBytes(input.auditHash),
      grossLamports: input.grossLamports,
      allocatedLamports: input.allocatedLamports,
    };
  }

  return {
    network: opts.network,
    programId,
    async readCommunity({ mint, address: bound }) {
      const community = address(bound);
      const vault = await vaultAddress(programId, community);
      // One call, one bank state: the outstanding figure and the vault balance belong together.
      // Two confirmed reads could straddle a publication or a claim (review 2026-11-03, P1).
      const {
        value: [communityInfo, vaultInfo],
      } = await rpc
        .getMultipleAccounts([community, vault], { encoding: "base64", commitment: "confirmed" })
        .send();
      const data = programAccount(programId, communityInfo ?? null);
      if (!data) return null;
      const decoded = decodeCommunity(data);
      const admin = decoder.decode(decoded.admin);
      // The bound account must be this mint's community at the address its admin derives.
      if (
        decoder.decode(decoded.mint) !== mint ||
        (await communityAddress(programId, address(mint), admin)) !== bound
      ) {
        return null;
      }
      if (!vaultInfo || vaultInfo.owner !== programId) {
        throw new Error("chain: the vault account is missing or not the program's");
      }
      // The rent-exempt minimum is asked of the cluster for the account's own size, never
      // hard-coded: mainnet rent differs from the textbook figure.
      const dataLength = Buffer.from(vaultInfo.data[0], "base64").length;
      const rentExemptMinimum = await rpc
        .getMinimumBalanceForRentExemption(BigInt(dataLength))
        .send();
      return {
        address: bound,
        admin,
        feeRecipient: decoder.decode(decoded.feeRecipient),
        outstandingLamports: decoded.outstandingLamports,
        vaultLamports: BigInt(vaultInfo.lamports),
        rentExemptMinimum: BigInt(rentExemptMinimum),
      };
    },
    async readEpoch(community, index): Promise<OnChainEpoch | null> {
      const at = await epochAddress(programId, address(community), index);
      const data = programAccount(programId, await accountInfo(at));
      if (!data) return null;
      const e = decodeEpoch(data);
      if (decoder.decode(e.community) !== community || e.index !== index) {
        throw new Error("chain: the epoch account names another community or index");
      }
      return {
        root: bytesToHex(e.root),
        auditHash: bytesToHex(e.auditHash),
        grossLamports: e.grossLamports,
        allocatedLamports: e.allocatedLamports,
      };
    },
    publisher:
      sending && opts.publisher
        ? {
            address: opts.publisher.address,
            publishEpoch: (input) => sending.chain.publishEpoch(input),
          }
        : null,
    publishSignature: async (input) => publishTransaction(rpc, await publishing(input)),
  };
}

// The worker's settle chain from its environment: null without a read RPC. The publisher key is
// optional and read only here; its bytes are never logged. A failed build is retried by the next
// job instead of being cached.
export function settleChainFromEnv(env: {
  READ_RPC_URL?: string | undefined;
  LINK_CHAIN: SettleChain["network"];
  PAYOUT_PUBLISHER_KEYPAIR?: string | undefined;
}): (() => Promise<SettleChain>) | null {
  const rpcUrl = env.READ_RPC_URL;
  if (!rpcUrl) return null;
  const wsUrl = rpcUrl.startsWith("https://") ? `wss://${rpcUrl.slice("https://".length)}` : null;
  const keypair = env.PAYOUT_PUBLISHER_KEYPAIR;
  let built: Promise<SettleChain> | undefined;
  return () => {
    built ??= (async () => {
      const publisher = keypair ? await publisherSigner(keypair) : undefined;
      if (publisher && !wsUrl) {
        throw new Error("settle: a publisher needs an https READ_RPC_URL to derive its websocket");
      }
      return settleChain({
        rpcUrl,
        wsUrl: wsUrl ?? "",
        network: env.LINK_CHAIN,
        ...(publisher && { publisher }),
      });
    })().catch((error: unknown) => {
      built = undefined;
      throw error;
    });
    return built;
  };
}

// The keypair as `solana-keygen` writes it: a JSON array of 64 bytes.
async function publisherSigner(value: string): Promise<TransactionSigner> {
  let bytes: unknown;
  try {
    bytes = JSON.parse(value);
  } catch {
    throw new Error("settle: PAYOUT_PUBLISHER_KEYPAIR is not a JSON byte array");
  }
  if (
    !Array.isArray(bytes) ||
    bytes.length !== 64 ||
    !bytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)
  ) {
    throw new Error("settle: PAYOUT_PUBLISHER_KEYPAIR is not a JSON array of 64 bytes");
  }
  return createKeyPairSignerFromBytes(Uint8Array.from(bytes as number[]));
}
