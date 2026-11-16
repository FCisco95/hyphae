import { parseArgs } from "node:util";
import { BASE58, parseGross } from "./publish-epoch-cli.js";

// The arguments of the read-only payout audit (docs/demo/oct8-audit.mts). Nothing is defaulted:
// an audit of the wrong community or pot would read as a clean one.
export const AUDIT_USAGE = "usage: oct8-audit --mint <mint> --gross <lamports> --epoch <index>";

export interface AuditArgs {
  mint: string;
  grossLamports: bigint;
  epoch: number;
}

function fail(why: string): never {
  throw new Error(`${why}\n${AUDIT_USAGE}`);
}

export function parseAuditArgs(argv: string[]): AuditArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      mint: { type: "string" },
      gross: { type: "string" },
      epoch: { type: "string" },
    },
  });
  if (positionals.length > 0) fail("the epoch is --epoch <index>, not a positional");
  const mint = values.mint ?? "";
  if (!BASE58.test(mint)) fail("--mint must be a base58 address");
  const grossLamports = parseGross(values.gross, fail);
  if (!/^[1-9]\d{0,8}$/.test(values.epoch ?? "")) fail("--epoch must be a positive index");
  return { mint, grossLamports, epoch: Number(values.epoch) };
}
