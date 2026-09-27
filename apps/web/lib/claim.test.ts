import {
  buildTree,
  type ClaimV1,
  claimInstruction,
  epochAddress,
  getProof,
  HYPHAE_PROGRAM_ID,
  leafHash,
  receiptAddress,
  vaultAddress,
} from "@hyphae/core";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import {
  address,
  createNoopSigner,
  getAddressEncoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import { claimTransaction } from "./claim.js";

const WALLET = "SysvarRent111111111111111111111111111111111";
const OTHER = "SysvarC1ock11111111111111111111111111111111";
const COMMUNITY = address("3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk");
const BLOCKHASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

// A published epoch of two leaves, as the claim route serves the first.
async function served(): Promise<ClaimV1> {
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

describe("claimTransaction", () => {
  it("builds the program's claim for the connected wallet, which pays and signs, and nothing else", async () => {
    const claim = await served();
    const tx = getTransactionDecoder().decode(await claimTransaction(claim, WALLET));
    // One signature slot, the wallet's, still empty: the page signs nothing itself.
    expect(Object.entries(tx.signatures)).toEqual([[WALLET, null]]);
    const message = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
    if (!("instructions" in message)) throw new Error("expected a v0 message");
    expect(message.staticAccounts[0]).toBe(WALLET);
    expect(message.lifetimeToken).toBe(BLOCKHASH);
    expect(message.instructions).toHaveLength(1);
    const [ix] = message.instructions;
    expect(message.staticAccounts[ix?.programAddressIndex as number]).toBe(HYPHAE_PROGRAM_ID);
    const expected = claimInstruction({
      programId: HYPHAE_PROGRAM_ID,
      claimant: createNoopSigner(address(WALLET)),
      community: COMMUNITY,
      vault: address(claim.vault_address),
      epoch: address(claim.epoch_address),
      receipt: address(claim.receipt_address),
      score: 255n,
      amount: 121_250_000n,
      evidenceHash: hexToBytes(claim.evidence_hash),
      proof: claim.proof.map(hexToBytes),
    });
    expect(new Uint8Array(ix?.data ?? [])).toEqual(new Uint8Array(expected.data ?? []));
    expect(ix?.accountIndices?.map((i: number) => message.staticAccounts[i])).toEqual(
      expected.accounts?.map((a) => a.address),
    );
  });

  it("refuses to build what it cannot check from public data", async () => {
    const claim = await served();
    const refused = [
      ["another wallet", { ...claim }, OTHER],
      ["another program", { ...claim, program_id: OTHER }, WALLET],
      ["an account that does not derive", { ...claim, receipt_address: OTHER }, WALLET],
      ["an amount the proof does not reach", { ...claim, amount_lamports: "121250001" }, WALLET],
      [
        "a paid leaf",
        { ...claim, payment: { status: "paid", claim_tx: `4${"C".repeat(86)}` } },
        WALLET,
      ],
      [
        "an unconfirmed status",
        { ...claim, payment: { status: "unavailable", reason: "chain_unavailable" } },
        WALLET,
      ],
    ] as const;
    for (const [what, c, wallet] of refused) {
      await expect(claimTransaction(c as ClaimV1, wallet), what).rejects.toThrow(/claim:/);
    }
  });
});
