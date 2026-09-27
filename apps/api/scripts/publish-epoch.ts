// Usage: node --env-file=<abs .env> --import tsx scripts/publish-epoch.ts plan|publish \
//   --mint <mint> --epoch <index> --gross <lamports> --network devnet|mainnet --rpc <https url> \
//   [--ws <wss url>] --signer file:<keypair.json>|ledger[:<derivation path>]
// Operator entry point for R6 publication. `plan` stores the epoch's publication intent (exact
// bytes, before any send) and prints every number it commits to; `publish` sends that intent
// with the community's admin key and records it, or records it if a run already sent it. Run one
// at a time. Mainnet only takes a Ledger (Q1); the key never leaves the device.
import { communities, epochs } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { solanaChain } from "../src/payout/chain.js";
import { planPublication, publishEpoch } from "../src/payout/publish.js";
import { parsePublishArgs, summarizePlan } from "./publish-epoch-cli.js";
import { openSigner } from "./publish-signer.js";

const args = parsePublishArgs(process.argv.slice(2));
// Imported after the arguments are checked: a typo must not reach the environment or a database.
const { db } = await import("../src/db.js");

const [community] = await db
  .select({ id: communities.id })
  .from(communities)
  .where(eq(communities.mint, args.mint));
if (!community) throw new Error(`no community for mint ${args.mint}`);
const [epoch] = await db
  .select({ id: epochs.id })
  .from(epochs)
  .where(and(eq(epochs.communityId, community.id), eq(epochs.index, args.epoch)));
if (!epoch) throw new Error(`no epoch ${args.epoch} for mint ${args.mint}`);

// The chain refuses an RPC that is not the named network; the program refuses a non-admin key.
const admin = await openSigner(args.signer, args.network);
const { chain } = await solanaChain({
  rpcUrl: args.rpcUrl,
  wsUrl: args.wsUrl,
  network: args.network,
  admin,
});
const input = {
  communityId: community.id,
  epochId: epoch.id,
  grossLamports: args.grossLamports,
};

const plan = await planPublication(db, chain, input);
if (plan.status !== "planned") {
  console.error(
    plan.status === "refused"
      ? `refused: ${plan.reason} (is ${admin.address} this community's admin, and is it bound?)`
      : `blocked: ${plan.blockers.join(", ")}`,
  );
  process.exit(1);
}
console.log(summarizePlan(plan));
if (args.command === "plan") process.exit(0);

const out = await publishEpoch(db, chain, input);
if (out.status !== "published") {
  console.error(`not published: ${JSON.stringify(out)}`);
  process.exit(1);
}
console.log(
  `${out.recovered ? "recorded (already on-chain)" : "published"}: ${out.signature}, root ${out.root}, ${out.leaves} leaves`,
);
process.exit(0);
