import { parseArgs } from "node:util";
import { BASE58, type ChainArgs, parseChainArgs, parseGross } from "./publish-epoch-cli.js";

export const INIT_USAGE =
  "usage: init-community plan|send --mint <mint> --fee-recipient <address> --network devnet|mainnet --rpc <https url> [--ws <wss url>] --signer file:<keypair.json>|ledger:<derivation path, e.g. 44'/501'/2'/0'> [--gross <lamports>]";

export interface InitArgs extends ChainArgs {
  command: "plan" | "send";
  mint: string;
  feeRecipient: string;
  // With a pot, the plan also says how much the vault needs to fund it.
  grossLamports: bigint | null;
}

function fail(why: string): never {
  throw new Error(`${why}\n${INIT_USAGE}`);
}

export function parseInitArgs(argv: string[]): InitArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      mint: { type: "string" },
      "fee-recipient": { type: "string" },
      gross: { type: "string" },
      network: { type: "string" },
      rpc: { type: "string" },
      ws: { type: "string" },
      signer: { type: "string" },
    },
  });
  const [command] = positionals;
  if (command !== "plan" && command !== "send") fail("plan or send?");
  const mint = values.mint ?? "";
  if (!BASE58.test(mint)) fail("--mint must be a base58 address");
  const feeRecipient = values["fee-recipient"] ?? "";
  if (!BASE58.test(feeRecipient)) fail("--fee-recipient must be a base58 address");
  if (feeRecipient === mint) fail("--fee-recipient is the mint");
  return {
    command,
    mint,
    feeRecipient,
    grossLamports: values.gross === undefined ? null : parseGross(values.gross, fail),
    ...parseChainArgs(values, fail),
  };
}

// Shared with the operator page: src/payout/community-init.ts.
export { feeRecipientProblem } from "../src/payout/community-init.js";

// What to send the vault so that its unassigned balance covers a pot of `grossLamports`. As in
// publish_epoch (P6), the vault's own rent and every allocated, unclaimed lamport stay reserved.
export function vaultTopUp(v: {
  vaultLamports: bigint;
  rentLamports: bigint;
  outstandingLamports: bigint;
  grossLamports: bigint;
}): bigint {
  const unassigned = v.vaultLamports - v.rentLamports - v.outstandingLamports;
  return v.grossLamports > unassigned ? v.grossLamports - unassigned : 0n;
}
