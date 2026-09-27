import {
  communityAddress,
  decodeCommunity,
  decodeEpoch,
  epochAddress,
  HYPHAE_PROGRAM_ID,
  publishEpochInstruction,
  vaultAddress,
} from "@hyphae/core";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import {
  type Address,
  address,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getAddressDecoder,
  getSignatureFromTransaction,
  type Instruction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type TransactionSigner,
} from "@solana/kit";
import type { OnChainEpoch, PublishChain } from "./publish.js";

// The publish job's chain, on @solana/kit. The RPC must prove it serves the named cluster: the
// manifests commit to the network, so a devnet label on a mainnet RPC (or the reverse) is refused.
export const GENESIS: Record<PublishChain["network"], string> = {
  "solana:devnet": "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  "solana:mainnet": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
};

export class SendError extends Error {
  constructor(
    readonly signature: string,
    cause: unknown,
  ) {
    super(
      `chain: transaction ${signature} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      {
        cause,
      },
    );
  }
}

export async function solanaChain(opts: {
  rpcUrl: string;
  wsUrl: string;
  network: PublishChain["network"];
  // P5: the community's admin key, the only one publish accepts.
  admin: TransactionSigner;
  programId?: Address;
}) {
  const programId = opts.programId ?? HYPHAE_PROGRAM_ID;
  const rpc = createSolanaRpc(opts.rpcUrl);
  const rpcSubscriptions = createSolanaRpcSubscriptions(opts.wsUrl);
  const genesis = await rpc.getGenesisHash().send();
  if (genesis !== GENESIS[opts.network]) {
    throw new Error(`chain: the RPC is not ${opts.network} (genesis ${genesis})`);
  }
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

  // skipPreflight lands a failing transaction on-chain, so its failure has a signature too.
  async function send(
    instructions: Instruction[],
    feePayer: TransactionSigner = opts.admin,
    options: { skipPreflight?: boolean } = {},
  ) {
    const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(feePayer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions(instructions, m),
    );
    const transaction = await signTransactionMessageWithSigners(message);
    const signature = getSignatureFromTransaction(transaction);
    try {
      await sendAndConfirm(transaction as Parameters<typeof sendAndConfirm>[0], {
        commitment: "confirmed",
        skipPreflight: options.skipPreflight ?? false,
      });
    } catch (error) {
      throw new SendError(signature, error);
    }
    return signature;
  }

  async function readAccount(at: Address) {
    const { value } = await rpc
      .getAccountInfo(at, { encoding: "base64", commitment: "confirmed" })
      .send();
    if (!value) return null;
    if (value.owner !== programId) throw new Error(`chain: ${at} is not owned by the program`);
    return Uint8Array.from(Buffer.from(value.data[0], "base64"));
  }

  const chain: PublishChain = {
    network: opts.network,
    programId,
    async readCommunity(mint) {
      const at = await communityAddress(programId, address(mint), opts.admin.address);
      const data = await readAccount(at);
      if (!data) return null;
      return {
        address: at,
        feeRecipient: getAddressDecoder().decode(decodeCommunity(data).feeRecipient),
      };
    },
    async readEpoch(community, index): Promise<OnChainEpoch | null> {
      const data = await readAccount(await epochAddress(programId, address(community), index));
      if (!data) return null;
      const e = decodeEpoch(data);
      if (getAddressDecoder().decode(e.community) !== community || e.index !== index) {
        throw new Error("chain: the epoch account names another community or index");
      }
      return {
        root: bytesToHex(e.root),
        auditHash: bytesToHex(e.auditHash),
        grossLamports: e.grossLamports,
        allocatedLamports: e.allocatedLamports,
      };
    },
    async publishEpoch(input) {
      const community = address(input.community);
      return send([
        publishEpochInstruction({
          programId,
          admin: opts.admin,
          community,
          vault: await vaultAddress(programId, community),
          feeRecipient: address(input.feeRecipient),
          epoch: await epochAddress(programId, community, input.index),
          index: input.index,
          root: hexToBytes(input.root),
          auditHash: hexToBytes(input.auditHash),
          grossLamports: input.grossLamports,
          allocatedLamports: input.allocatedLamports,
        }),
      ]);
    },
    async publishSignature(community, index) {
      const epoch = await epochAddress(programId, address(community), index);
      const signatures = await rpc
        .getSignaturesForAddress(epoch, { limit: 1000, commitment: "confirmed" })
        .send();
      // Newest first; the oldest successful one created the account.
      const created = signatures.filter((s) => s.err === null).at(-1);
      if (!created) throw new Error(`chain: no successful transaction for epoch ${index}`);
      return created.signature;
    },
  };
  return { chain, rpc, programId, send, readAccount };
}
