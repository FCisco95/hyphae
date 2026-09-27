import { parseArgs } from "node:util";
import type { PlanOutcome } from "../src/payout/publish.js";
import type { SignerSpec } from "./publish-signer.js";

export const USAGE =
  "usage: publish-epoch plan|publish --mint <mint> --epoch <index> --gross <lamports> --network devnet|mainnet --rpc <https url> [--ws <wss url>] --signer file:<keypair.json>|ledger[:<derivation path>]";

export interface PublishArgs {
  command: "plan" | "publish";
  mint: string;
  epoch: number;
  grossLamports: bigint;
  network: "solana:devnet" | "solana:mainnet";
  rpcUrl: string;
  wsUrl: string;
  signer: SignerSpec;
}

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_U64 = (1n << 64n) - 1n;
const LEDGER_PATH = "44'/501'/0'";

function fail(why: string): never {
  throw new Error(`${why}\n${USAGE}`);
}

export function parsePublishArgs(argv: string[]): PublishArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      mint: { type: "string" },
      epoch: { type: "string" },
      gross: { type: "string" },
      network: { type: "string" },
      rpc: { type: "string" },
      ws: { type: "string" },
      signer: { type: "string" },
    },
  });
  const [command] = positionals;
  if (command !== "plan" && command !== "publish") fail("plan or publish?");
  const mint = values.mint ?? "";
  if (!BASE58.test(mint)) fail("--mint must be a base58 address");
  if (!/^[1-9]\d{0,8}$/.test(values.epoch ?? "")) fail("--epoch must be a positive index");
  // Digits only: an unset shell variable must not become a pot.
  if (!/^[1-9]\d*$/.test(values.gross ?? "")) fail("--gross must be positive whole lamports");
  const grossLamports = BigInt(values.gross as string);
  if (grossLamports > MAX_U64) fail("--gross must fit a u64");
  const network =
    values.network === "devnet"
      ? "solana:devnet"
      : values.network === "mainnet"
        ? "solana:mainnet"
        : fail("--network must be devnet or mainnet");
  const rpcUrl = values.rpc ?? "";
  if (!rpcUrl.startsWith("https://")) fail("--rpc must be an https URL");
  const wsUrl = values.ws ?? `wss://${rpcUrl.slice("https://".length)}`;
  if (!wsUrl.startsWith("wss://")) fail("--ws must be a wss URL");

  const spec = values.signer ?? "";
  let signer: SignerSpec;
  if (spec.startsWith("file:") && spec.length > "file:".length) {
    signer = { kind: "file", path: spec.slice("file:".length) };
  } else if (spec === "ledger" || spec.startsWith("ledger:")) {
    signer = { kind: "ledger", path: spec.slice("ledger:".length) || LEDGER_PATH };
  } else {
    fail("--signer must be file:<keypair.json> or ledger[:<derivation path>]");
  }
  // Q1: mainnet publishes only from a hardware key.
  if (network === "solana:mainnet" && signer.kind !== "ledger") {
    fail("mainnet publishes only from a hardware key (--signer ledger)");
  }
  return {
    command,
    mint,
    epoch: Number(values.epoch),
    grossLamports,
    network,
    rpcUrl,
    wsUrl,
    signer,
  };
}

// What the operator reads before signing: every number the transaction commits to.
export function summarizePlan(plan: Extract<PlanOutcome, { status: "planned" }>): string {
  const { audit, root, auditHash, leaves } = plan.intent;
  const s = audit.settlement;
  return [
    `network ${audit.network}, program ${audit.program_id}`,
    `community ${plan.community} (mint ${audit.mint}), epoch ${plan.index}`,
    `gross ${s.gross_lamports}, fee ${s.fee_lamports} (${s.fee_bps} bps) to ${s.fee_recipient}, net ${s.net_lamports}`,
    `allocated ${s.allocated_lamports} to ${leaves.length} of ${s.payable_members} payable members, cap remainder ${s.cap_remainder_lamports}, dust ${s.dust_lamports}`,
    `root ${root}`,
    `audit hash ${auditHash}`,
    ...leaves.map((l) => `  leaf ${l.wallet} ${l.amountLamports} lamports, score ${l.score}`),
    plan.onChain ? "already on-chain: publish records it without sending" : "not on-chain yet",
  ].join("\n");
}
