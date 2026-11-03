// The settle loop end to end on a local test validator (Organic D-44), opt-in like the devnet run.
// The validator runs the program dumped from mainnet at its own address; every key is a throwaway
// made in a temp dir and deleted afterwards. The run initializes a community whose admin is a
// server key with init-server-community, binds it in a local Postgres with bind-community, funds
// the vault in four steps as the crank would, and lets settleCommunity roll three epochs over and
// publish the fourth as one distribution with that key. One leaf is then claimed, and the vault,
// claimant and fee recipient balances are checked against the distribution's B11 audit.
// Runs only with HYPHAE_LOCALNET_RUN=1 and HYPHAE_LOCALNET_DATABASE_URL on a loopback host; see
// the README for the validator and database commands.
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  claimInstruction,
  decodeClaimReceipt,
  decodeCommunity,
  decodeEpoch,
  epochAddress,
  receiptAddress,
} from "@hyphae/core";
import { communities, createDb, epochPayoutDecisions, epochs, leaves } from "@hyphae/db";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import {
  AccountRole,
  type Address,
  address,
  createKeyPairSignerFromPrivateKeyBytes,
  generateKeyPairSigner,
  getAddressEncoder,
  lamports,
  type TransactionSigner,
} from "@solana/kit";
import { and, asc, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { describe, expect, it } from "vitest";
import { bindCommunity } from "../../scripts/bind-community.js";
import { initServerCommunity } from "../../scripts/init-server-community.js";
import { readServerKeypair } from "../../scripts/server-community-cli.js";
import { solanaChain } from "./chain.js";
import { loadDistributionIntent } from "./distribution-intent.js";
import { type SettleOutcome, settleCommunity } from "./distribution-settle.js";
import { seedRolloverLane } from "./rollover-seed.js";
import { settleChain } from "./settle-chain.js";

const env = process.env;
const RUN = env.HYPHAE_LOCALNET_RUN === "1";
const RPC = env.HYPHAE_LOCALNET_RPC ?? "http://127.0.0.1:8899";
const WS = env.HYPHAE_LOCALNET_WS ?? "ws://127.0.0.1:8900";
const SOL = 1_000_000_000n;
const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
// The contributor share forwarded to the vault before each epoch's decision. Cumulatively the
// first three stay below the threshold (0.75 SOL of accrual is 75 SOL of volume at 1%); the fourth
// passes it (1.25 SOL, 125 SOL of volume).
const STEPS = [200_000_000n, 300_000_000n, 250_000_000n, 500_000_000n];
const THRESHOLD_VOLUME = 100n * SOL;
const REWARD_BPS = 100;

// A keypair file as solana-keygen writes it: the 32-byte seed, then the public key.
async function throwawayKeypair(dir: string, name: string) {
  const seed = new Uint8Array(randomBytes(32));
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed, true);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", signer.keyPair.publicKey));
  const path = join(dir, `${name}.json`);
  writeFileSync(path, JSON.stringify([...seed, ...publicKey]));
  return { path, signer: await readServerKeypair(path) };
}

const u64 = (view: DataView, at: number, value: bigint) => view.setBigUint64(at, value, true);

// System program Transfer: u32 variant 2, then u64 lamports.
function transfer(from: TransactionSigner, to: Address, amount: bigint) {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true);
  u64(view, 4, amount);
  return {
    programAddress: SYSTEM_PROGRAM,
    accounts: [
      { address: from.address, role: AccountRole.WRITABLE_SIGNER, signer: from },
      { address: to, role: AccountRole.WRITABLE },
    ],
    data,
  };
}

// A fresh SPL mint: System CreateAccount (variant 0) of 82 bytes owned by the Token program, then
// Token InitializeMint2 (20) with 6 decimals and no freeze authority.
function createMint(payer: TransactionSigner, mint: TransactionSigner, rent: bigint) {
  const create = new Uint8Array(52);
  const view = new DataView(create.buffer);
  view.setUint32(0, 0, true);
  u64(view, 4, rent);
  u64(view, 12, 82n);
  create.set(getAddressEncoder().encode(TOKEN_PROGRAM), 20);
  const init = new Uint8Array(35);
  init[0] = 20;
  init[1] = 6;
  init.set(getAddressEncoder().encode(payer.address), 2);
  init[34] = 0;
  return [
    {
      programAddress: SYSTEM_PROGRAM,
      accounts: [
        { address: payer.address, role: AccountRole.WRITABLE_SIGNER, signer: payer },
        { address: mint.address, role: AccountRole.WRITABLE_SIGNER, signer: mint },
      ],
      data: create,
    },
    {
      programAddress: TOKEN_PROGRAM,
      accounts: [{ address: mint.address, role: AccountRole.WRITABLE }],
      data: init,
    },
  ];
}

function localDatabaseUrl(): string {
  const url = env.HYPHAE_LOCALNET_DATABASE_URL ?? "";
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  // A disposable local database only, never Neon.
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("localnet: HYPHAE_LOCALNET_DATABASE_URL must be a local Postgres");
  }
  return url;
}

describe.skipIf(!RUN)("localnet settle run", () => {
  it("rolls three epochs over and pays them with the fourth in one distribution", async () => {
    const dbUrl = localDatabaseUrl();
    const dir = mkdtempSync(join(tmpdir(), "hyphae-localnet-"));
    const report: Record<string, unknown> = { rpc: RPC };
    const db = createDb(dbUrl);
    try {
      const admin = await throwawayKeypair(dir, "server-admin");
      const funder = await throwawayKeypair(dir, "funder");
      const claimant = await throwawayKeypair(dir, "claimant");
      const feeRecipient = await throwawayKeypair(dir, "fee-recipient");
      const mint = await generateKeyPairSigner();
      // The funder's chain sends the setup transactions; it never publishes.
      const { rpc, send } = await solanaChain({
        rpcUrl: RPC,
        wsUrl: WS,
        network: "solana:devnet",
        admin: funder.signer,
        local: true,
      });
      const balance = async (at: Address) =>
        (await rpc.getBalance(at, { commitment: "confirmed" }).send()).value;
      async function airdrop(to: Address, amount: bigint) {
        const start = await balance(to);
        await rpc.requestAirdrop(to, lamports(amount), { commitment: "confirmed" }).send();
        for (let i = 0; i < 60 && (await balance(to)) < start + amount; i += 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
        if ((await balance(to)) < start + amount) throw new Error(`localnet: airdrop to ${to}`);
      }
      await airdrop(funder.signer.address, 10n * SOL);
      await airdrop(admin.signer.address, SOL);
      await airdrop(claimant.signer.address, SOL / 10n);
      // The fee recipient must be an existing System wallet.
      await airdrop(feeRecipient.signer.address, SOL / 100n);
      const mintRent = await rpc.getMinimumBalanceForRentExemption(82n).send();
      report.createMint = await send(createMint(funder.signer, mint, mintRent));
      Object.assign(report, {
        admin: admin.signer.address,
        claimant: claimant.signer.address,
        feeRecipient: feeRecipient.signer.address,
        mint: mint.address,
      });

      // Script 4a: a dry run sends nothing, then --send initializes the community.
      const initArgs = [
        "--mint",
        mint.address,
        "--fee-recipient",
        feeRecipient.signer.address,
        "--admin-keypair",
        admin.path,
        "--cluster",
        "localnet",
        "--rpc",
        RPC,
        "--ws",
        WS,
      ];
      const log: string[] = [];
      const dry = await initServerCommunity(initArgs, (l) => log.push(l));
      expect(dry.status).toBe("would_initialize");
      expect(
        await rpc.getAccountInfo(address(dry.community), { encoding: "base64" }).send(),
      ).toMatchObject({
        value: null,
      });
      const init = await initServerCommunity([...initArgs, "--send"], (l) => log.push(l));
      expect(init).toMatchObject({ status: "initialized", community: dry.community });
      // The server key's file is a secret: no line of either run repeats it.
      const keyText = readFileSync(admin.path, "utf8");
      expect(log.join("\n")).not.toContain(keyText.slice(1, 40));
      const community = address(init.community);
      const vault = address(init.vault);
      Object.assign(report, { community, vault, initialize: init.signature });

      // A community with four closed epochs, unbound, with the claimant as the effort member.
      await migrate(db, {
        migrationsFolder: fileURLToPath(
          new URL("../../../../packages/db/drizzle", import.meta.url),
        ),
      });
      const now = new Date();
      const seed = await seedRolloverLane(db, {
        now,
        chainAddress: null,
        mint: mint.address,
        wallets: { effort: claimant.signer.address },
        plan: [
          ["effort", "ordinary"],
          ["floor", "effort"],
          ["ordinary", "effort"],
        ],
      });
      await db
        .update(communities)
        .set({ firstPaidEpoch: null })
        .where(eq(communities.id, seed.communityId));
      expect(seed.epochs.map((e) => e.index)).toEqual([1, 2, 3, 4]);

      // Script 4b: a dry run writes nothing, then --apply binds address, first epoch and policy.
      const bindArgs = [
        "--mint",
        mint.address,
        "--chain-address",
        community,
        "--admin",
        admin.signer.address,
        "--first-paid-epoch",
        "1",
        "--threshold-volume-lamports",
        THRESHOLD_VOLUME.toString(),
        "--basis",
        "cumulative",
        "--reward-bps-of-volume",
        String(REWARD_BPS),
        "--auto-publish",
        "on",
        "--effective-from-index",
        "1",
        "--cluster",
        "localnet",
        "--rpc",
        RPC,
        "--ws",
        WS,
      ];
      const bindLog: string[] = [];
      const planned = await bindCommunity(bindArgs, { DATABASE_URL: dbUrl }, (l) =>
        bindLog.push(l),
      );
      expect(planned.status).toBe("planned");
      const unbound = await db
        .select({ chainAddress: communities.chainAddress })
        .from(communities)
        .where(eq(communities.id, seed.communityId));
      expect(unbound).toEqual([{ chainAddress: null }]);
      const bound = await bindCommunity([...bindArgs, "--apply"], { DATABASE_URL: dbUrl }, (l) =>
        bindLog.push(l),
      );
      expect(bound.status).toBe("bound");
      expect(bindLog.join("\n")).not.toContain(dbUrl);
      report.bindPlan = bindLog;

      // The worker's settle chain, with the server key as its publisher.
      const chain = await settleChain({
        rpcUrl: RPC,
        wsUrl: WS,
        network: "solana:devnet",
        publisher: admin.signer,
        local: true,
      });
      const funding: string[] = [];
      const outcomes: SettleOutcome[] = [];
      let before = { vault: 0n, feeRecipient: 0n, admin: 0n };
      for (const [i, step] of STEPS.entries()) {
        funding.push(await send([transfer(funder.signer, vault, step)]));
        if (i === STEPS.length - 1) {
          before = {
            vault: await balance(vault),
            feeRecipient: await balance(feeRecipient.signer.address),
            admin: await balance(admin.signer.address),
          };
        }
        outcomes.push(
          await settleCommunity(db, chain, { communityId: seed.communityId }, { clock: () => now }),
        );
      }
      report.funding = funding;
      report.outcomes = outcomes;

      for (const [i, out] of outcomes.slice(0, 3).entries()) {
        expect(out).toEqual({
          status: "rolled_over",
          epochIndex: i + 1,
          reason: "below_threshold",
          accrualLamports: STEPS[i],
          volumeLamports: ((STEPS[i] as bigint) * 10_000n) / BigInt(REWARD_BPS),
        });
      }
      const last = outcomes[3];
      if (last?.status !== "published") throw new Error(`not published: ${String(last?.status)}`);
      const gross = STEPS.reduce((s, x) => s + x, 0n);
      expect(last).toMatchObject({
        epochIndex: 4,
        epochs: 4,
        grossLamports: gross,
        recovered: false,
      });
      report.publish = last.signature;

      // The distribution's B11 audit, as stored before the send.
      const epoch4 = seed.epochs[3] as (typeof seed.epochs)[number];
      const intent = await loadDistributionIntent(db, epoch4.id);
      if (!intent) throw new Error("localnet: no stored distribution intent");
      const s = intent.audit.settlement;
      report.audit = s;
      expect(intent.audit.epochs.map((e) => BigInt(e.accrual_lamports))).toEqual(STEPS);
      expect(BigInt(s.gross_lamports)).toBe(gross);
      expect(s.fee_recipient).toBe(feeRecipient.signer.address);

      // On chain: one epoch account, at index 4 only, with the audit's commitments.
      const epochAt = await epochAddress(chain.programId as Address, community, 4n);
      const onChain = decodeEpoch(
        Buffer.from(
          ((await rpc.getAccountInfo(epochAt, { encoding: "base64" }).send()).value?.data[0] ??
            "") as string,
          "base64",
        ),
      );
      expect(bytesToHex(onChain.root)).toBe(intent.root);
      expect(bytesToHex(onChain.auditHash)).toBe(intent.auditHash);
      expect(onChain.grossLamports).toBe(gross);
      expect(onChain.allocatedLamports).toBe(BigInt(s.allocated_lamports));
      for (const index of [1n, 2n, 3n]) {
        const at = await epochAddress(chain.programId as Address, community, index);
        expect((await rpc.getAccountInfo(at, { encoding: "base64" }).send()).value).toBeNull();
      }

      const afterPublish = {
        vault: await balance(vault),
        feeRecipient: await balance(feeRecipient.signer.address),
        admin: await balance(admin.signer.address),
      };
      // The fee moved from the vault to the fee recipient; the admin paid only the epoch rent and
      // the transaction fee.
      expect(before.vault - afterPublish.vault).toBe(BigInt(s.fee_lamports));
      expect(afterPublish.feeRecipient - before.feeRecipient).toBe(BigInt(s.fee_lamports));
      const communityAfter = decodeCommunity(
        Buffer.from(
          ((await rpc.getAccountInfo(community, { encoding: "base64" }).send()).value?.data[0] ??
            "") as string,
          "base64",
        ),
      );
      expect(communityAfter.outstandingLamports).toBe(BigInt(s.allocated_lamports));

      // Every decision is now distributed in epoch 4.
      const decisions = await db
        .select({ outcome: epochPayoutDecisions.outcome, index: epochs.index })
        .from(epochPayoutDecisions)
        .innerJoin(epochs, eq(epochs.id, epochPayoutDecisions.epochId))
        .where(eq(epochPayoutDecisions.communityId, seed.communityId))
        .orderBy(asc(epochs.index));
      expect(decisions.map((d) => d.outcome)).toEqual([
        "distributed",
        "distributed",
        "distributed",
        "distributed",
      ]);

      // One claim, by the claimant's leaf.
      const [leaf] = await db
        .select()
        .from(leaves)
        .where(and(eq(leaves.epochId, epoch4.id), eq(leaves.memberId, seed.members.effort)));
      if (!leaf) throw new Error("localnet: no leaf for the claimant");
      expect(leaf.wallet).toBe(claimant.signer.address);
      const audited = intent.audit.members.find((m) => m.wallet === claimant.signer.address);
      expect(BigInt(audited?.amount_lamports ?? "0")).toBe(leaf.amountLamports);
      const receipt = await receiptAddress(
        chain.programId as Address,
        epochAt,
        claimant.signer.address,
      );
      const claimantBefore = await balance(claimant.signer.address);
      const vaultBefore = await balance(vault);
      const claimChain = await solanaChain({
        rpcUrl: RPC,
        wsUrl: WS,
        network: "solana:devnet",
        admin: claimant.signer,
        local: true,
      });
      const claimSignature = await claimChain.send([
        claimInstruction({
          programId: chain.programId as Address,
          claimant: claimant.signer,
          community,
          vault,
          epoch: epochAt,
          receipt,
          score: leaf.score,
          amount: leaf.amountLamports,
          evidenceHash: hexToBytes(leaf.evidenceHash),
          proof: (leaf.proof as string[]).map(hexToBytes),
        }),
      ]);
      report.claim = claimSignature;
      const claimTx = await rpc
        .getTransaction(claimSignature, {
          commitment: "confirmed",
          encoding: "json",
          maxSupportedTransactionVersion: 0,
        })
        .send();
      const txFee = BigInt(claimTx?.meta?.fee ?? 0n);
      const receiptRent =
        (await rpc.getAccountInfo(receipt, { encoding: "base64" }).send()).value?.lamports ?? 0n;
      const claimantAfter = await balance(claimant.signer.address);
      const vaultAfter = await balance(vault);
      expect(vaultBefore - vaultAfter).toBe(leaf.amountLamports);
      expect(claimantAfter - claimantBefore).toBe(
        leaf.amountLamports - txFee - BigInt(receiptRent),
      );
      const r = decodeClaimReceipt(
        Buffer.from(
          ((await rpc.getAccountInfo(receipt, { encoding: "base64" }).send()).value?.data[0] ??
            "") as string,
          "base64",
        ),
      );
      expect(r.amount).toBe(leaf.amountLamports);

      // The vault keeps exactly what the audit left in it: allocated but unclaimed, cap remainder
      // and dust, on top of its rent.
      const vaultRent = await rpc.getMinimumBalanceForRentExemption(9n).send();
      expect(vaultAfter - vaultRent).toBe(
        BigInt(s.allocated_lamports) -
          leaf.amountLamports +
          BigInt(s.cap_remainder_lamports) +
          BigInt(s.dust_lamports),
      );
      report.balances = {
        beforePublish: before,
        afterPublish,
        claim: {
          claimantBefore,
          claimantAfter,
          vaultBefore,
          vaultAfter,
          amount: leaf.amountLamports,
          txFee,
          receiptRent,
        },
      };
    } finally {
      await db.$client.end();
      rmSync(dir, { recursive: true, force: true });
      console.log(JSON.stringify(report, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
    }
  }, 600_000);
});
