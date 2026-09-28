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

const SYSTEM_PROGRAM = "11111111111111111111111111111111";

// The fee address is permanent: the program has no instruction to change it. Only an existing,
// System-owned wallet account is taken, so a typo, a program, or a program-owned account such as a
// Squads multisig account (whose vault is the address to pass) is refused before anything is signed.
export function feeRecipientProblem(
  account: { owner: string; executable: boolean; dataLength: number; lamports: bigint } | null,
): string | null {
  if (!account) return "the fee recipient does not exist on this network";
  if (account.owner !== SYSTEM_PROGRAM) {
    return `the fee recipient is owned by ${account.owner}, not the System program: pass a wallet or a Squads vault, never a multisig account`;
  }
  if (account.executable || account.dataLength !== 0) {
    return "the fee recipient is a program or holds data, not a wallet";
  }
  return null;
}

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
