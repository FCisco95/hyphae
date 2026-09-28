import { parseArgs } from "node:util";
import type { PlanOutcome } from "../src/payout/publish.js";
import type { SignerSpec } from "./publish-signer.js";

export const USAGE =
  "usage: publish-epoch plan|publish --mint <mint> --epoch <index> --gross <lamports> --network devnet|mainnet --rpc <https url> [--ws <wss url>] --signer file:<keypair.json>|ledger:<derivation path, e.g. 44'/501'/2'/0'>";

// Where, and as whom, an operator command signs.
export interface ChainArgs {
  network: "solana:devnet" | "solana:mainnet";
  rpcUrl: string;
  wsUrl: string;
  signer: SignerSpec;
}

export interface PublishArgs extends ChainArgs {
  command: "plan" | "publish";
  mint: string;
  epoch: number;
  grossLamports: bigint;
}

export const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_U64 = (1n << 64n) - 1n;
// A hardened Solana account path, as the Ledger's Solana app takes it: 44'/501'/a' or 44'/501'/a'/c'.
const LEDGER_PATH = /^44'\/501'(\/\d{1,10}'){1,2}$/;
const MAX_HARDENED_INDEX = 0x7fffffff;

function isLedgerPath(path: string): boolean {
  if (!LEDGER_PATH.test(path)) return false;
  return path
    .split("/")
    .slice(2)
    .every((index) => Number(index.slice(0, -1)) <= MAX_HARDENED_INDEX);
}

function fail(why: string): never {
  throw new Error(`${why}\n${USAGE}`);
}

// Digits only: an unset shell variable must not become a pot.
export function parseGross(value: string | undefined, refuse: (why: string) => never): bigint {
  if (!/^[1-9]\d*$/.test(value ?? "")) refuse("--gross must be positive whole lamports");
  const lamports = BigInt(value as string);
  if (lamports > MAX_U64) refuse("--gross must fit a u64");
  return lamports;
}

export function parseChainArgs(
  values: { network?: string; rpc?: string; ws?: string; signer?: string },
  refuse: (why: string) => never,
): ChainArgs {
  const network =
    values.network === "devnet"
      ? "solana:devnet"
      : values.network === "mainnet"
        ? "solana:mainnet"
        : refuse("--network must be devnet or mainnet");
  const rpcUrl = values.rpc ?? "";
  if (!rpcUrl.startsWith("https://")) refuse("--rpc must be an https URL");
  const wsUrl = values.ws ?? `wss://${rpcUrl.slice("https://".length)}`;
  if (!wsUrl.startsWith("wss://")) refuse("--ws must be a wss URL");

  const spec = values.signer ?? "";
  let signer: SignerSpec;
  if (spec.startsWith("file:") && spec.length > "file:".length) {
    signer = { kind: "file", path: spec.slice("file:".length) };
  } else if (spec === "ledger" || spec.startsWith("ledger:")) {
    // No default: the device's first account can be the operator's everyday wallet, and the
    // admin key is part of the community's address, so the operator names it every time.
    const path = spec.slice("ledger:".length);
    if (path === "") refuse("--signer ledger: name the Ledger account, e.g. ledger:44'/501'/2'/0'");
    if (!isLedgerPath(path)) refuse("--signer ledger: the path must look like 44'/501'/2'/0'");
    signer = { kind: "ledger", path };
  } else {
    refuse("--signer must be file:<keypair.json> or ledger:<derivation path>");
  }
  // Q1: mainnet signs only with a hardware key.
  if (network === "solana:mainnet" && signer.kind !== "ledger") {
    refuse("mainnet signs only with a hardware key (--signer ledger:<derivation path>)");
  }
  return { network, rpcUrl, wsUrl, signer };
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
  const grossLamports = parseGross(values.gross, fail);
  return {
    command,
    mint,
    epoch: Number(values.epoch),
    grossLamports,
    ...parseChainArgs(values, fail),
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
