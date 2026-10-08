import {
  buildTree,
  type ClaimV1,
  epochAddress,
  getProof,
  HYPHAE_PROGRAM_ID,
  leafHash,
  receiptAddress,
  vaultAddress,
} from "@hyphae/core";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { address, getAddressEncoder } from "@solana/kit";

// Test fixture: a claim whose accounts derive and whose proof reaches its root, so the claim
// builder accepts it.

export const WALLET = "SysvarRent111111111111111111111111111111111";
export const OTHER = "SysvarC1ock11111111111111111111111111111111";
export const COMMUNITY = address("3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk");
export const BLOCKHASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

// A published epoch of two leaves, as the claim route serves the first.
export async function servedClaim(): Promise<ClaimV1> {
  const leaf = (wallet: string, amount: bigint, evidence: string) =>
    leafHash({
      wallet: new Uint8Array(getAddressEncoder().encode(address(wallet))),
      epochIndex: 2n,
      score: 255n,
      amount,
      evidenceHash: hexToBytes(evidence),
    });
  // The wallet's leaf first: a tree keeps its leaves in the order given.
  const tree = buildTree([
    leaf(WALLET, 121_250_000n, "c".repeat(64)),
    leaf(OTHER, 7n, "d".repeat(64)),
  ]);
  const epoch = await epochAddress(HYPHAE_PROGRAM_ID, COMMUNITY, 2n);
  return {
    community: { mint: "MintAbc" },
    epoch: { index: 2 },
    wallet: WALLET,
    network: "solana:devnet",
    program_id: HYPHAE_PROGRAM_ID,
    community_address: COMMUNITY,
    vault_address: await vaultAddress(HYPHAE_PROGRAM_ID, COMMUNITY),
    epoch_address: epoch,
    receipt_address: await receiptAddress(HYPHAE_PROGRAM_ID, epoch, address(WALLET)),
    score: "255",
    amount_lamports: "121250000",
    evidence_hash: "c".repeat(64),
    proof: getProof(tree, 0).map(bytesToHex),
    root: bytesToHex(tree.root),
    payment: { status: "claimable", recent_blockhash: BLOCKHASH, last_valid_block_height: "1000" },
    as_of: "2026-10-09T01:00:00.000000Z",
  };
}
