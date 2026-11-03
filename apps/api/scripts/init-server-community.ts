// Usage: node --import tsx scripts/init-server-community.ts --mint <mint> --fee-recipient <address>
//   --admin-keypair <server key file> --cluster devnet|localnet|mainnet [--rpc <url>] [--ws <url>]
//   [--cluster-confirm mainnet] [--send]
// The one-time on-chain setup of a community whose admin is a server publisher key (Organic D-44),
// so the settle loop can publish its distributions without a human. A dry run unless --send: it
// prints the community and vault the key derives, the permanent fee recipient and the rent the
// key pays. Mainnet needs --cluster-confirm mainnet. Only the key's address is ever printed. It
// writes no database: bind-community is the next step.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  communityAddress,
  decodeCommunity,
  initializeCommunityInstruction,
  vaultAddress,
} from "@hyphae/core";
import { type Address, address, getAddressDecoder, getAddressEncoder } from "@solana/kit";
import { solanaChain } from "../src/payout/chain.js";
import { feeRecipientProblem } from "./init-community-cli.js";
import { parseInitServerArgs, readServerKeypair } from "./server-community-cli.js";

export interface InitServerResult {
  admin: string;
  community: string;
  vault: string;
  feeRecipient: string;
  status: "already_initialized" | "would_initialize" | "initialized";
  signature?: string;
}

export async function initServerCommunity(
  argv: string[],
  log: (line: string) => void = console.log,
): Promise<InitServerResult> {
  const args = parseInitServerArgs(argv);
  const admin = await readServerKeypair(args.adminKeypair);
  const { rpc, programId, send, readAccount } = await solanaChain({
    rpcUrl: args.rpcUrl,
    wsUrl: args.wsUrl,
    network: args.network,
    admin,
    ...(args.local && { local: true }),
  });
  const mint = address(args.mint);
  const feeRecipient = address(args.feeRecipient);
  const community = await communityAddress(programId, mint, admin.address);
  const vault = await vaultAddress(programId, community);
  const result = { admin: admin.address, community, vault, feeRecipient };

  const account = async (at: Address) =>
    (await rpc.getAccountInfo(at, { encoding: "base64", commitment: "confirmed" }).send()).value;
  const sol = (lamports: bigint) => `${lamports} lamports (${Number(lamports) / 1e9} SOL)`;
  if (!(await account(programId))?.executable) {
    throw new Error(`refused: the program ${programId} is not deployed on ${args.cluster}`);
  }
  log(
    [
      `cluster ${args.cluster} (${args.rpcUrl}), program ${programId}`,
      `admin ${admin.address} (the server key; its file is not printed)`,
      `mint ${mint}`,
      `community ${community}`,
      `vault ${vault}`,
      `fee recipient ${feeRecipient}`,
    ].join("\n"),
  );

  // The community as the chain holds it must be the one the operator named.
  const check = (data: Uint8Array) => {
    const c = decodeCommunity(data);
    const decode = getAddressDecoder();
    if (decode.decode(c.mint) !== mint || decode.decode(c.admin) !== admin.address) {
      throw new Error(`refused: the account at ${community} names another mint or admin`);
    }
    const fee = decode.decode(c.feeRecipient);
    if (fee !== feeRecipient) {
      throw new Error(`refused: the community is initialized with fee recipient ${fee}`);
    }
  };
  const bindHint = () =>
    log(
      `next: bind-community --mint ${mint} --chain-address ${community} --admin ${admin.address} ...`,
    );

  const existing = await readAccount(community);
  if (existing) {
    check(existing);
    log("already initialized with this fee recipient; nothing to send");
    bindHint();
    return { ...result, status: "already_initialized" };
  }
  const recipient = await account(feeRecipient);
  const problem = feeRecipientProblem(
    recipient && {
      owner: recipient.owner,
      executable: recipient.executable,
      dataLength: Buffer.from(recipient.data[0], "base64").length,
      lamports: recipient.lamports,
    },
  );
  if (problem) throw new Error(`refused: ${problem}`);
  const rentFor = (bytes: number) => rpc.getMinimumBalanceForRentExemption(BigInt(bytes)).send();
  // 8-byte discriminators; Community holds mint, admin and fee recipient, a u64 and two bumps.
  const rent = (await rentFor(8 + 32 * 3 + 8 + 2)) + (await rentFor(8 + 1));
  const balance = (await rpc.getBalance(admin.address, { commitment: "confirmed" }).send()).value;
  log(
    [
      "the fee recipient is a System-owned wallet; it can never change",
      `initializing costs the server key ${sol(rent)} in rent plus the transaction fee; it holds ${sol(balance)}`,
    ].join("\n"),
  );
  if (!args.send) {
    log("dry run: nothing sent; --send initializes it");
    return { ...result, status: "would_initialize" };
  }
  const signature = await send([
    initializeCommunityInstruction({
      programId,
      admin,
      mint,
      community,
      vault,
      feeRecipient: new Uint8Array(getAddressEncoder().encode(feeRecipient)),
    }),
  ]);
  const data = await readAccount(community);
  if (!data) throw new Error(`initialized in ${signature}, but ${community} reads as missing`);
  check(data);
  log(`initialized: ${signature}`);
  bindHint();
  return { ...result, status: "initialized", signature };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  initServerCommunity(process.argv.slice(2)).then(
    () => process.exit(0),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    },
  );
}
