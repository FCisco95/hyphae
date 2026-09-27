import {
  communityAddress,
  decodeCommunity,
  decodeEpoch,
  epochAddress,
  HYPHAE_PROGRAM_ID,
  isPublishEpoch,
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
import { creatingTransaction } from "./evidence.js";
import type { OnChainEpoch, PublishArgs, PublishChain } from "./publish.js";

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

const SYSTEM_PROGRAM = "11111111111111111111111111111111";

// A program account's bytes, or null where the program has created none. Anyone can send lamports
// to a future PDA, which leaves an empty System-owned account there; the program's `init` still
// creates the account (Anchor tops up rent, allocates and assigns), so it reads as not created.
// Any other owner is refused.
export function programAccount(
  programId: string,
  value: { owner: string; executable: boolean; data: readonly [string, string] } | null,
): Uint8Array | null {
  if (!value) return null;
  const bytes = Uint8Array.from(Buffer.from(value.data[0], "base64"));
  if (value.owner === programId) return bytes;
  if (value.owner === SYSTEM_PROGRAM && !value.executable && bytes.length === 0) return null;
  throw new Error(`chain: an account is not owned by ${programId}`);
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
    return programAccount(programId, value);
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
      return send([publishEpochInstruction({ admin: opts.admin, ...(await publishing(input)) })]);
    },
    async publishSignature(input) {
      const expected = await publishing(input);
      const found = await creatingTransaction(rpc, expected.epoch, (ix) =>
        isPublishEpoch(ix, expected),
      );
      if (!found) throw new Error(`chain: no publish_epoch transaction for epoch ${input.index}`);
      return found.signature;
    },
  };
  return { chain, rpc, programId, send, readAccount };
}
