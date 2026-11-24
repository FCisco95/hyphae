import { sha256 } from "@noble/hashes/sha2.js";
import {
  type Address,
  address,
  compileTransaction,
  createNoopSigner,
  getBase58Decoder,
  getBase58Encoder,
  getPublicKeyFromAddress,
  type Instruction,
  type Rpc,
  type RpcSubscriptions,
  type SignatureBytes,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
  sendAndConfirmTransactionFactory,
  type TransactionPartialSigner,
  blockhash as toBlockhash,
  verifySignature,
} from "@solana/kit";
import { type BlockhashLifetime, publishInstructions, SendError, sendMessage } from "./chain.js";
import type { PublishArgs } from "./publish.js";

// The operator page's signer (roadmap item 3 part B). The browser's wallet holds the admin key,
// so the API cannot sign. This signer stands where the CLI's Ledger signer stands: the chain code
// builds and simulates the exact transaction the CLI run would, then hands this signer the
// compiled message, and the signer hands it on instead of signing. Nothing is ever signed or
// sent here. The wallet's signature comes back later and is checked against these bytes only.

export class SignatureRequired extends Error {
  constructor(
    readonly messageBytes: Uint8Array,
    readonly lifetime: BlockhashLifetime,
  ) {
    super("handoff: the transaction waits for the admin wallet's signature");
  }
}

export function handoffSigner(wallet: string): TransactionPartialSigner {
  return {
    address: address(wallet),
    async signTransactions(transactions) {
      const [transaction] = transactions;
      if (!transaction || transactions.length !== 1) {
        throw new Error("handoff: exactly one transaction is handed to the wallet");
      }
      const lifetime = (transaction as { lifetimeConstraint?: Partial<BlockhashLifetime> })
        .lifetimeConstraint;
      if (
        typeof lifetime?.blockhash !== "string" ||
        typeof lifetime.lastValidBlockHeight !== "bigint"
      ) {
        throw new Error("handoff: the transaction has no blockhash lifetime");
      }
      throw new SignatureRequired(new Uint8Array(transaction.messageBytes), {
        blockhash: lifetime.blockhash,
        lastValidBlockHeight: lifetime.lastValidBlockHeight,
      });
    },
  };
}

// The message bytes the chain code compiles for these instructions, fee payer and lifetime: what
// the hand-off signer was given. Recomputed at submit and compared with the stored bytes.
export function messageBytesFor(
  feePayer: string,
  lifetime: BlockhashLifetime,
  instructions: (payer: ReturnType<typeof createNoopSigner>) => Promise<Instruction[]>,
): Promise<Uint8Array> {
  const payer = createNoopSigner(address(feePayer));
  return instructions(payer).then(
    (ixs) =>
      new Uint8Array(
        compileTransaction(
          sendMessage(
            payer,
            {
              blockhash: toBlockhash(lifetime.blockhash),
              lastValidBlockHeight: lifetime.lastValidBlockHeight,
            },
            ixs,
          ),
        ).messageBytes,
      ),
  );
}

export const publishMessageBytes = (
  programId: Address,
  admin: string,
  args: PublishArgs,
  lifetime: BlockhashLifetime,
) => messageBytesFor(admin, lifetime, (payer) => publishInstructions(programId, payer, args));

export const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

// What the Ledger Solana app shows when it blind-signs: base58(sha256(message)).
export const messageHash = (messageBytes: Uint8Array) =>
  getBase58Decoder().decode(sha256(messageBytes));

// The wallet's 64-byte signature over exactly these bytes, or null: malformed, another key or
// other bytes. base58, as wallets and `solana` print signatures.
export async function verifiedSignature(
  messageBytes: Uint8Array,
  wallet: string,
  signature: string,
): Promise<SignatureBytes | null> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(getBase58Encoder().encode(signature));
  } catch {
    return null;
  }
  if (bytes.length !== 64) return null;
  try {
    const key = await getPublicKeyFromAddress(address(wallet));
    return (await verifySignature(key, bytes as SignatureBytes, messageBytes))
      ? (bytes as SignatureBytes)
      : null;
  } catch {
    return null;
  }
}

// The one transaction the wallet signed: the stored bytes with its one signature, and the
// blockhash lifetime the chain code built it with. The transaction's signature is the wallet's.
export function signedTransaction(
  messageBytes: Uint8Array,
  wallet: string,
  signature: SignatureBytes,
  lifetime: BlockhashLifetime,
) {
  return {
    messageBytes: messageBytes as never,
    signatures: { [address(wallet)]: signature },
    lifetimeConstraint: {
      blockhash: toBlockhash(lifetime.blockhash),
      lastValidBlockHeight: lifetime.lastValidBlockHeight,
    },
  };
}

export type SignedHandoff = ReturnType<typeof signedTransaction>;

// Sends a signed hand-off with the RPC's preflight and waits for its confirmation, as the chain
// code's own send does. Returns the transaction signature (the wallet's signature, base58).
export function handoffSender(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
) {
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  return async (transaction: SignedHandoff): Promise<string> => {
    const [signature] = Object.values(transaction.signatures);
    if (!signature || Object.keys(transaction.signatures).length !== 1) {
      throw new Error("handoff: a hand-off carries exactly one signature");
    }
    const text = getBase58Decoder().decode(signature);
    try {
      await sendAndConfirm(transaction as unknown as Parameters<typeof sendAndConfirm>[0], {
        commitment: "confirmed",
        skipPreflight: false,
      });
    } catch (error) {
      throw new SendError(text, error);
    }
    return text;
  };
}
