import {
  type ClaimV1,
  claimInstruction,
  epochAddress,
  HYPHAE_PROGRAM_ID,
  leafHash,
  receiptAddress,
  vaultAddress,
  verifyProof,
} from "@hyphae/core";
import { hexToBytes } from "@noble/hashes/utils.js";
import {
  address,
  appendTransactionMessageInstructions,
  type Blockhash,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getAddressEncoder,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";

// The claim transaction for the connected wallet, built in the browser from the leaf the API
// served. Every account is re-derived and the proof is checked against the root first, so the
// wallet is only ever asked to sign what this page can rebuild from public data. The wallet pays
// the fee and the receipt's rent, and signs.
export async function claimTransaction(claim: ClaimV1, wallet: string): Promise<Uint8Array> {
  const { payment } = claim;
  if (payment.status !== "claimable") throw new Error("claim: nothing to claim");
  if (claim.wallet !== wallet) throw new Error("claim: the leaf is for another wallet");
  if (claim.program_id !== HYPHAE_PROGRAM_ID) throw new Error("claim: not the Hyphae program");

  const claimant = address(wallet);
  const community = address(claim.community_address);
  const index = BigInt(claim.epoch.index);
  const vault = await vaultAddress(HYPHAE_PROGRAM_ID, community);
  const epoch = await epochAddress(HYPHAE_PROGRAM_ID, community, index);
  const receipt = await receiptAddress(HYPHAE_PROGRAM_ID, epoch, claimant);
  if (
    vault !== claim.vault_address ||
    epoch !== claim.epoch_address ||
    receipt !== claim.receipt_address
  ) {
    throw new Error("claim: an account does not derive from the community");
  }

  const score = BigInt(claim.score);
  const amount = BigInt(claim.amount_lamports);
  const evidenceHash = hexToBytes(claim.evidence_hash);
  const proof = claim.proof.map(hexToBytes);
  const leaf = leafHash({
    wallet: new Uint8Array(getAddressEncoder().encode(claimant)),
    epochIndex: index,
    score,
    amount,
    evidenceHash,
  });
  if (!verifyProof(hexToBytes(claim.root), leaf, proof)) {
    throw new Error("claim: the proof does not reach the root");
  }

  const signer = createNoopSigner(claimant);
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: payment.recent_blockhash as Blockhash,
          lastValidBlockHeight: BigInt(payment.last_valid_block_height),
        },
        m,
      ),
    (m) =>
      appendTransactionMessageInstructions(
        [
          claimInstruction({
            programId: HYPHAE_PROGRAM_ID,
            claimant: signer,
            community,
            vault,
            epoch,
            receipt,
            score,
            amount,
            evidenceHash,
            proof,
          }),
        ],
        m,
      ),
  );
  return new Uint8Array(getTransactionEncoder().encode(compileTransaction(message)));
}

// A read of the claim route for the connected wallet.
export type ClaimRead = { state: "none" | "unavailable" } | { state: "ready"; claim: ClaimV1 };

// One claim attempt. The claim is read again right before signing: its blockhash expires in about
// a minute, and it may have been paid meanwhile. Only a claim still claimable is built and signed.
export async function attemptClaim(
  wallet: string,
  read: () => Promise<ClaimRead>,
  signAndSend: (claim: ClaimV1, transaction: Uint8Array) => Promise<string>,
): Promise<{ read: ClaimRead; signature: string | null }> {
  const fresh = await read();
  if (fresh.state !== "ready" || fresh.claim.payment.status !== "claimable") {
    return { read: fresh, signature: null };
  }
  const transaction = await claimTransaction(fresh.claim, wallet);
  return { read: fresh, signature: await signAndSend(fresh.claim, transaction) };
}

// After a send, the read that shows the receipt paid, or `unresolved` with the last read once
// `polls` reads find none: a wallet can return a signature for a transaction that never lands.
export async function awaitReceipt(
  read: () => Promise<ClaimRead>,
  polls: number,
  wait: () => Promise<void>,
): Promise<{ state: "paid" | "unresolved"; read: ClaimRead }> {
  let last: ClaimRead = { state: "unavailable" };
  for (let i = 0; i < polls; i += 1) {
    await wait();
    last = await read();
    if (last.state === "ready" && last.claim.payment.status === "paid") {
      return { state: "paid", read: last };
    }
  }
  return { state: "unresolved", read: last };
}
