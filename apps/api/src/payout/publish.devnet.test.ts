// The devnet run (step 6 of the R6 + Anchor arc): deploy is done beforehand with the Solana CLI;
// this initializes the community if needed, funds its vault, publishes a seeded ready epoch
// through publishEpoch, claims one leaf, and checks that a second claim of it fails. It only runs
// when HYPHAE_DEVNET_RUN=1, against devnet, with throwaway keys; never a mainnet key.
import { readFileSync, writeFileSync } from "node:fs";
import { leaves } from "@hyphae/db";
import { hexToBytes } from "@noble/hashes/utils.js";
import {
  AccountRole,
  type Address,
  address,
  createKeyPairSignerFromBytes,
  getAddressEncoder,
} from "@solana/kit";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../rewards/test-db.js";
import { SendError, solanaChain } from "./chain.js";
import {
  claimInstruction,
  communityAddress,
  decodeClaimReceipt,
  decodeCommunity,
  epochAddress,
  initializeCommunityInstruction,
  receiptAddress,
  vaultAddress,
} from "./program.js";
import { publishEpoch } from "./publish.js";
import { seedReadyEpoch } from "./ready-seed.js";

const env = process.env;
const RUN = env.HYPHAE_DEVNET_RUN === "1";
const GROSS = 50_000_000n;

const signerFromFile = async (path: string) =>
  createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));

// System program Transfer: u32 variant 2, then u64 lamports.
function transfer(from: Awaited<ReturnType<typeof signerFromFile>>, to: Address, lamports: bigint) {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true);
  view.setBigUint64(4, lamports, true);
  return {
    programAddress: address("11111111111111111111111111111111"),
    accounts: [
      { address: from.address, role: AccountRole.WRITABLE_SIGNER, signer: from },
      { address: to, role: AccountRole.WRITABLE },
    ],
    data,
  };
}

describe.skipIf(!RUN)("devnet run", () => {
  it("publishes a seeded epoch, pays one claim, and refuses a second claim", async () => {
    const admin = await signerFromFile(env.HYPHAE_DEVNET_ADMIN_KEYPAIR as string);
    const claimant = await signerFromFile(env.HYPHAE_DEVNET_CLAIMANT_KEYPAIR as string);
    const feeRecipient = address(env.HYPHAE_DEVNET_FEE_RECIPIENT as string);
    const mint = address(env.HYPHAE_DEVNET_MINT as string);
    const { chain, rpc, programId, send, readAccount } = await solanaChain({
      rpcUrl: env.HYPHAE_DEVNET_RPC ?? "https://api.devnet.solana.com",
      wsUrl: env.HYPHAE_DEVNET_WS ?? "wss://api.devnet.solana.com",
      network: "solana:devnet",
      admin,
    });
    const report: Record<string, unknown> = {
      program: programId,
      admin: admin.address,
      claimant: claimant.address,
      feeRecipient,
      mint,
    };

    const community = await communityAddress(programId, mint, admin.address);
    const vault = await vaultAddress(programId, community);
    report.community = community;
    report.vault = vault;
    if (!(await readAccount(community))) {
      report.initialize = await send([
        initializeCommunityInstruction({
          programId,
          admin,
          mint,
          community,
          vault,
          feeRecipient: new Uint8Array(getAddressEncoder().encode(feeRecipient)),
        }),
      ]);
    }
    const outstanding = decodeCommunity(
      (await readAccount(community)) as Uint8Array,
    ).outstandingLamports;
    const vaultBalance = (await rpc.getBalance(vault, { commitment: "confirmed" }).send()).value;
    const rent = await rpc.getMinimumBalanceForRentExemption(9n).send();
    const unassigned = vaultBalance - rent - outstanding;
    if (unassigned < GROSS) {
      report.deposit = await send([transfer(admin, vault, GROSS - unassigned)]);
    }
    report.fundClaimant = await send([transfer(admin, claimant.address, 10_000_000n)]);

    const t = await createTestDb();
    try {
      const seed = await seedReadyEpoch(t.db, {
        now: new Date(),
        mint,
        wallets: { effort: claimant.address },
        chainAddress: community,
      });
      const published = await publishEpoch(t.db, chain, {
        communityId: seed.communityId,
        epochId: seed.epochId,
        grossLamports: GROSS,
      });
      expect(published.status).toBe("published");
      if (published.status !== "published") return;
      report.publish = published.signature;
      report.root = published.root;
      report.auditHash = published.auditHash;

      const [leaf] = await t.db
        .select()
        .from(leaves)
        .where(eq(leaves.memberId, seed.members.effort));
      if (!leaf) throw new Error("devnet: no leaf for the claimant");
      const epoch = await epochAddress(programId, community, 1n);
      const receipt = await receiptAddress(programId, epoch, claimant.address);
      const claim = claimInstruction({
        programId,
        claimant,
        community: community,
        vault,
        epoch,
        receipt,
        score: leaf.score,
        amount: leaf.amountLamports,
        evidenceHash: hexToBytes(leaf.evidenceHash),
        proof: (leaf.proof as string[]).map(hexToBytes),
      });
      const before = (await rpc.getBalance(vault, { commitment: "confirmed" }).send()).value;
      report.claim = await send([claim], claimant);
      const after = (await rpc.getBalance(vault, { commitment: "confirmed" }).send()).value;
      expect(before - after).toBe(leaf.amountLamports);
      const r = decodeClaimReceipt((await readAccount(receipt)) as Uint8Array);
      expect(r.amount).toBe(leaf.amountLamports);
      report.claimedLamports = leaf.amountLamports.toString();
      report.receipt = receipt;

      // Sent past the preflight, so the refusal is a failed transaction on-chain.
      const second = await send([claim], claimant, { skipPreflight: true }).then(
        (signature) => ({ landed: signature }),
        (error: unknown) =>
          error instanceof SendError
            ? { failed: error.signature, error: error.message }
            : { notSent: String(error) },
      );
      report.secondClaim = second;
      expect(second).toHaveProperty("failed");
      const unchanged = (await rpc.getBalance(vault, { commitment: "confirmed" }).send()).value;
      expect(unchanged).toBe(after);
    } finally {
      await t.close();
      const out = JSON.stringify(report, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
      console.log(out);
      if (env.HYPHAE_DEVNET_REPORT) writeFileSync(env.HYPHAE_DEVNET_REPORT, `${out}\n`);
    }
  }, 600_000);
});
