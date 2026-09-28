// Usage: node --import tsx scripts/init-community.ts plan|send --mint <mint> \
//   --fee-recipient <address> --network devnet|mainnet --rpc <https url> [--ws <wss url>] \
//   --signer file:<keypair.json>|ledger:<derivation path, e.g. 44'/501'/2'/0'> [--gross <lamports>]
// Operator entry point for a community's one-time setup on-chain. `plan` reads the chain and prints
// what `send` would do: the community and vault the admin key derives, the permanent fee recipient,
// and with --gross, what the vault needs for that pot. `send` initializes the community with the
// admin key (a Ledger on mainnet), simulated before the device is asked, and reads it back. It
// writes no database: binding communities.chain_address stays the operator's own step.
import {
  communityAddress,
  decodeCommunity,
  initializeCommunityInstruction,
  vaultAddress,
} from "@hyphae/core";
import { type Address, address, getAddressDecoder, getAddressEncoder } from "@solana/kit";
import { solanaChain } from "../src/payout/chain.js";
import { feeRecipientProblem, parseInitArgs, vaultTopUp } from "./init-community-cli.js";
import { openSigner } from "./publish-signer.js";

const args = parseInitArgs(process.argv.slice(2));
const admin = await openSigner(args.signer, args.network);
// The chain refuses an RPC that is not the named network.
const { rpc, programId, send, readAccount } = await solanaChain({
  rpcUrl: args.rpcUrl,
  wsUrl: args.wsUrl,
  network: args.network,
  admin,
});
const mint = address(args.mint);
const feeRecipient = address(args.feeRecipient);
const community = await communityAddress(programId, mint, admin.address);
const vault = await vaultAddress(programId, community);

function refuse(why: string): never {
  console.error(`refused: ${why}`);
  process.exit(1);
}
const sol = (lamports: bigint) => `${lamports} lamports (${Number(lamports) / 1e9} SOL)`;
const account = async (at: Address) =>
  (await rpc.getAccountInfo(at, { encoding: "base64", commitment: "confirmed" }).send()).value;
const rentFor = (bytes: number) => rpc.getMinimumBalanceForRentExemption(BigInt(bytes)).send();

if (!(await account(programId))?.executable) {
  refuse(`the program ${programId} is not deployed on ${args.network}`);
}
console.log(
  [
    `network ${args.network}, program ${programId}`,
    `admin ${admin.address}`,
    `mint ${mint}`,
    `community ${community}`,
    `vault ${vault}`,
  ].join("\n"),
);

// The community as the chain holds it, checked against what the operator named.
function onChain(data: Uint8Array) {
  const c = decodeCommunity(data);
  const decode = getAddressDecoder();
  const read = { mint: decode.decode(c.mint), admin: decode.decode(c.admin) };
  if (read.mint !== mint || read.admin !== admin.address) {
    throw new Error(`the account at ${community} names another mint or admin`);
  }
  const fee = decode.decode(c.feeRecipient);
  if (fee !== feeRecipient) refuse(`the community is initialized with fee recipient ${fee}`);
  return c;
}

let data = await readAccount(community);
if (data) {
  onChain(data);
  console.log(`already initialized with fee recipient ${feeRecipient}; nothing to send`);
} else {
  const recipient = await account(feeRecipient);
  const problem = feeRecipientProblem(
    recipient && {
      owner: recipient.owner,
      executable: recipient.executable,
      dataLength: Buffer.from(recipient.data[0], "base64").length,
      lamports: recipient.lamports,
    },
  );
  if (problem) refuse(problem);
  // 8-byte discriminators; Community holds mint, admin and fee recipient, a u64 and two bumps.
  const rent = (await rentFor(8 + 32 * 3 + 8 + 2)) + (await rentFor(8 + 1));
  const balance = (await rpc.getBalance(admin.address, { commitment: "confirmed" }).send()).value;
  console.log(
    [
      `fee recipient ${feeRecipient}, a System-owned wallet; it can never change`,
      `initializing costs the admin ${sol(rent)} in rent, plus the transaction fee; it holds ${sol(balance)}`,
    ].join("\n"),
  );
  if (args.command === "plan") {
    console.log("not initialized yet: send initializes it");
  } else {
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
    data = await readAccount(community);
    if (!data) throw new Error(`initialized in ${signature}, but ${community} reads as missing`);
    onChain(data);
    console.log(`initialized: ${signature}`);
    console.log(
      `bind it: update communities set chain_address = '${community}' where mint = '${mint}' and chain_address is null;`,
    );
  }
}

if (args.grossLamports !== null) {
  if (!data) {
    console.log(
      `once initialized, the vault holds only its rent: send it ${sol(args.grossLamports)}`,
    );
  } else {
    const held = await account(vault);
    if (!held) throw new Error(`the vault ${vault} is missing`);
    const { outstandingLamports } = decodeCommunity(data);
    const rentLamports = await rentFor(Buffer.from(held.data[0], "base64").length);
    const topUp = vaultTopUp({
      vaultLamports: held.lamports,
      rentLamports,
      outstandingLamports,
      grossLamports: args.grossLamports,
    });
    console.log(
      [
        `vault holds ${sol(held.lamports)}: rent ${rentLamports}, allocated and unclaimed ${outstandingLamports}`,
        topUp === 0n
          ? `a pot of ${sol(args.grossLamports)} is covered`
          : `for a pot of ${sol(args.grossLamports)}, send the vault ${sol(topUp)}`,
      ].join("\n"),
    );
  }
}
process.exit(0);
