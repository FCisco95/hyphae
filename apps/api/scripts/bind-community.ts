// Usage: DATABASE_URL=<postgres url> node --import tsx scripts/bind-community.ts --mint <mint>
//   --chain-address <community> --admin <address> --first-paid-epoch <n>
//   --threshold-volume-lamports <n> --basis cumulative|per_epoch --reward-bps-of-volume <1..10000>
//   --auto-publish on|off --effective-from-index <n> --cluster devnet|localnet|mainnet
//   [--rpc <url>] [--ws <url>] [--cluster-confirm mainnet] [--apply]
// Puts a community under the settle loop (Organic D-44): in one transaction, sets
// communities.chain_address and first_paid_epoch and inserts its payout_policies row. A dry run
// unless --apply: it prints exactly what it would write. It refuses a community that already has a
// policy, and a chain address that is not this mint's community under this admin on the named
// cluster. The database URL is read from the environment and never printed.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createDb } from "@hyphae/db";
import {
  applyBind,
  type BindOutcome,
  describeBind,
  planBind,
} from "../src/payout/bind-community.js";
import { settleChain } from "../src/payout/settle-chain.js";
import { databaseLabel, parseBindArgs } from "./server-community-cli.js";

export type BindRun = BindOutcome | { status: "planned"; communityId: string };

export async function bindCommunity(
  argv: string[],
  env: { DATABASE_URL?: string | undefined },
  log: (line: string) => void = console.log,
): Promise<BindRun> {
  const args = parseBindArgs(argv);
  const url = env.DATABASE_URL;
  if (!url) throw new Error("refused: set DATABASE_URL to the database to bind in");
  const chain = await settleChain({
    rpcUrl: args.rpcUrl,
    wsUrl: args.wsUrl,
    network: args.network,
    ...(args.local && { local: true }),
  });
  const db = createDb(url);
  try {
    log(`database ${databaseLabel(url)}, cluster ${args.cluster} (${args.rpcUrl})`);
    const read = chain.readCommunity.bind(chain);
    const plan = await planBind(db, read, args);
    if (plan.status === "refused") {
      log(`refused: ${plan.reason}`);
      return plan;
    }
    for (const line of describeBind(plan, args)) log(line);
    if (!args.apply) {
      log("dry run: nothing written; --apply writes it");
      return { status: "planned", communityId: plan.communityId };
    }
    const out = await applyBind(db, read, args);
    log(
      out.status === "bound"
        ? `bound: community ${out.communityId}, policy ${out.policyId}`
        : `refused: ${out.reason}`,
    );
    return out;
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  bindCommunity(process.argv.slice(2), process.env).then(
    (out) => process.exit(out.status === "refused" ? 1 : 0),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    },
  );
}
