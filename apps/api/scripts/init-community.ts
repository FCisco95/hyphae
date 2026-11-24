// Usage: node --import tsx scripts/init-community.ts plan|send --mint <mint> \
//   --fee-recipient <address> --network devnet|mainnet --rpc <https url> [--ws <wss url>] \
//   --signer file:<keypair.json>|ledger:<derivation path, e.g. 44'/501'/2'/0'> [--gross <lamports>]
// Operator entry point for a community's one-time setup on-chain. `plan` reads the chain and prints
// what `send` would do: the community and vault the admin key derives, the permanent fee recipient,
// and with --gross, what the vault needs for that pot. `send` initializes the community with the
// admin key (a Ledger on mainnet), simulated before the device is asked, and reads it back. It
// writes no database: binding communities.chain_address stays the operator's own step.
// The checks and the instruction are shared with the operator page (src/payout/community-init.ts).
import { decodeCommunity } from "@hyphae/core";
import { type Address, address, getAddressDecoder } from "@solana/kit";
import { solanaChain } from "../src/payout/chain.js";
import {
  type InitTarget,
  initInstructions,
  planCommunityInit,
} from "../src/payout/community-init.js";
import { parseInitArgs, vaultTopUp } from "./init-community-cli.js";
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
const target: InitTarget = { programId, admin: admin.address, mint, feeRecipient };

function refuse(why: string): never {
  console.error(`refused: ${why}`);
  process.exit(1);
}
const sol = (lamports: bigint) => `${lamports} lamports (${Number(lamports) / 1e9} SOL)`;
const account = async (at: Address) =>
  (await rpc.getAccountInfo(at, { encoding: "base64", commitment: "confirmed" }).send()).value;
const rentFor = (bytes: number) => rpc.getMinimumBalanceForRentExemption(BigInt(bytes)).send();

const plan = await planCommunityInit(rpc, target);
if (plan.status === "refused" && plan.reason === "program_missing") refuse(plan.detail);
const community = plan.status === "refused" ? null : plan.community;
const vault = plan.status === "refused" ? null : plan.vault;
console.log(
  [
    `network ${args.network}, program ${programId}`,
    `admin ${admin.address}`,
    `mint ${mint}`,
    ...(community && vault ? [`community ${community}`, `vault ${vault}`] : []),
  ].join("\n"),
);
if (plan.status === "refused") refuse(plan.detail);
const at = plan.community;

// The community as the chain holds it, checked against what the operator named.
function onChain(data: Uint8Array) {
  const c = decodeCommunity(data);
  const decode = getAddressDecoder();
  const read = { mint: decode.decode(c.mint), admin: decode.decode(c.admin) };
  if (read.mint !== mint || read.admin !== admin.address) {
    throw new Error(`the account at ${at} names another mint or admin`);
  }
  const fee = decode.decode(c.feeRecipient);
  if (fee !== feeRecipient) refuse(`the community is initialized with fee recipient ${fee}`);
  return c;
}

let data = await readAccount(plan.community);
if (plan.status === "exists") {
  if (!data) throw new Error(`${plan.community} reads as missing`);
  onChain(data);
  console.log(`already initialized with fee recipient ${feeRecipient}; nothing to send`);
} else {
  console.log(
    [
      `fee recipient ${feeRecipient}, a System-owned wallet; it can never change`,
      `initializing costs the admin ${sol(plan.rentLamports)} in rent, plus the transaction fee; it holds ${sol(plan.adminLamports)}`,
    ].join("\n"),
  );
  if (args.command === "plan") {
    console.log("not initialized yet: send initializes it");
  } else {
    const signature = await send(await initInstructions(target, admin));
    data = await readAccount(plan.community);
    if (!data)
      throw new Error(`initialized in ${signature}, but ${plan.community} reads as missing`);
    onChain(data);
    console.log(`initialized: ${signature}`);
    console.log(
      `bind it: update communities set chain_address = '${plan.community}' where mint = '${mint}' and chain_address is null;`,
    );
  }
}

if (args.grossLamports !== null) {
  if (!data) {
    console.log(
      `once initialized, the vault holds only its rent: send it ${sol(args.grossLamports)}`,
    );
  } else {
    const held = await account(plan.vault);
    if (!held) throw new Error(`the vault ${plan.vault} is missing`);
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
