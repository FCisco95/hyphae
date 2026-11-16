// Usage (a community under a payout policy: plan and publish in one run, one Ledger approval):
//   node --env-file=<abs .env> --import tsx scripts/publish-epoch.ts run //     --mint <mint> --network devnet|mainnet --rpc <https url> [--ws <wss url>] --signer ledger:<path>
// Usage: node --env-file=<abs .env> --import tsx scripts/publish-epoch.ts plan|publish \
//   --mint <mint> --epoch <index> --gross <lamports> --network devnet|mainnet --rpc <https url> \
//   [--ws <wss url>] --signer file:<keypair.json>|ledger:<derivation path, e.g. 44'/501'/2'/0'>
// Operator entry point for R6 publication. `plan` stores the epoch's publication intent (exact
// bytes, before any send) and prints every number it commits to; `publish` sends that intent
// with the community's admin key and records it, or records it if a run already sent it. Run one
// at a time. Mainnet only takes a Ledger (Q1); the key never leaves the device.
import { communities, epochs } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { solanaChain } from "../src/payout/chain.js";
import { operatorPublish } from "../src/payout/operator-publish.js";
import { planPublication, publishEpoch } from "../src/payout/publish.js";
import { settleChain } from "../src/payout/settle-chain.js";
import {
  describeRunOutcome,
  parsePublishArgs,
  summarizeDistribution,
  summarizePlan,
} from "./publish-epoch-cli.js";
import { openSigner } from "./publish-signer.js";

const args = parsePublishArgs(process.argv.slice(2));
// Imported after the arguments are checked: a typo must not reach the environment or a database.
const { db } = await import("../src/db.js");

if (args.command === "run") {
  // The signer is opened first (a Ledger shows no prompt to read its address); every refusal
  // inside operatorPublish happens before anything is planned, and the device is asked once, for
  // the one transaction, after the numbers below are on screen.
  const signer = await openSigner(args.signer, args.network);
  const chain = await settleChain({
    rpcUrl: args.rpcUrl,
    wsUrl: args.wsUrl,
    network: args.network,
    publisher: signer,
  });
  const out = await operatorPublish(
    db,
    chain,
    { mint: args.mint },
    {
      beforeSend: async (summary) => {
        console.log(summarizeDistribution(summary));
        console.log("approve the transaction on the Ledger");
      },
    },
  );
  const { ok, text } = describeRunOutcome(out);
  (ok ? console.log : console.error)(text);
  process.exit(ok ? 0 : 1);
}

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
      ? plan.reason === "community_held"
        ? "refused: community_held (a recorded hold stops this community's payouts: src/payout/holds.ts)"
        : plan.reason === "policy_managed"
          ? "refused: policy_managed (a payout policy is in force for this epoch, or it has a payout decision: the settle loop publishes it)"
          : `refused: ${plan.reason} (is ${admin.address} this community's admin, and is it bound?)`
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
