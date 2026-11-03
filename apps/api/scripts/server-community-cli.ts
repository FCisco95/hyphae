import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createKeyPairSignerFromBytes, type KeyPairSigner } from "@solana/kit";
import type { BindRequest } from "../src/payout/bind-community.js";
import { BASE58 } from "./publish-epoch-cli.js";

// Arguments of the two operator scripts for a community whose admin is a server key (Organic
// D-44): init-server-community and bind-community. Both are dry runs unless told otherwise, and
// mainnet needs the cluster named twice.

export const INIT_SERVER_USAGE =
  "usage: init-server-community --mint <mint> --fee-recipient <address> --admin-keypair <path> --cluster devnet|localnet|mainnet [--rpc <url>] [--ws <url>] [--cluster-confirm mainnet] [--send]";
export const BIND_USAGE =
  "usage: DATABASE_URL=... bind-community --mint <mint> --chain-address <community> --admin <address> --first-paid-epoch <n> --threshold-volume-lamports <n> --basis cumulative|per_epoch --reward-bps-of-volume <1..10000> --auto-publish on|off --effective-from-index <n> --cluster devnet|localnet|mainnet [--rpc <url>] [--ws <url>] [--cluster-confirm mainnet] [--apply]";

export interface ClusterArgs {
  cluster: "devnet" | "localnet" | "mainnet";
  // The label the manifests carry; a local validator carries devnet's (clusterProblem).
  network: "solana:devnet" | "solana:mainnet";
  local: boolean;
  rpcUrl: string;
  wsUrl: string;
}

export interface InitServerArgs extends ClusterArgs {
  send: boolean;
  mint: string;
  feeRecipient: string;
  adminKeypair: string;
}

export interface BindArgs extends ClusterArgs, BindRequest {
  apply: boolean;
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
const PG_BIGINT_MAX = 9_223_372_036_854_775_807n;

const clusterOptions = {
  cluster: { type: "string" },
  "cluster-confirm": { type: "string" },
  rpc: { type: "string" },
  ws: { type: "string" },
} as const;

function parseCluster(
  values: { cluster?: string; "cluster-confirm"?: string; rpc?: string; ws?: string },
  refuse: (why: string) => never,
): ClusterArgs {
  const cluster = values.cluster;
  if (cluster !== "devnet" && cluster !== "localnet" && cluster !== "mainnet") {
    refuse("--cluster must be devnet, localnet or mainnet");
  }
  // A server key signs on mainnet only when the operator names the cluster twice (D-44).
  if (cluster === "mainnet" && values["cluster-confirm"] !== "mainnet") {
    refuse("mainnet needs --cluster-confirm mainnet");
  }
  if (cluster === "localnet") {
    const rpcUrl = values.rpc ?? "http://127.0.0.1:8899";
    let url: URL;
    try {
      url = new URL(rpcUrl);
    } catch {
      refuse("--rpc must be a URL");
    }
    if (!LOOPBACK.has(url.hostname)) refuse("localnet: --rpc must be a loopback URL");
    // solana-test-validator serves its websocket on the RPC port plus one.
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80)) + 1;
    const wsUrl =
      values.ws ?? `${url.protocol === "https:" ? "wss" : "ws"}://${url.hostname}:${port}`;
    return { cluster, network: "solana:devnet", local: true, rpcUrl, wsUrl };
  }
  const rpcUrl = values.rpc ?? "";
  if (!rpcUrl.startsWith("https://")) refuse(`${cluster}: --rpc must be an https URL`);
  const wsUrl = values.ws ?? `wss://${rpcUrl.slice("https://".length)}`;
  if (!wsUrl.startsWith("wss://")) refuse(`${cluster}: --ws must be a wss URL`);
  return {
    cluster,
    network: cluster === "mainnet" ? "solana:mainnet" : "solana:devnet",
    local: false,
    rpcUrl,
    wsUrl,
  };
}

const failWith =
  (usage: string) =>
  (why: string): never => {
    throw new Error(`${why}\n${usage}`);
  };

const address = (value: string | undefined, flag: string, refuse: (why: string) => never) => {
  if (!BASE58.test(value ?? "")) refuse(`${flag} must be a base58 address`);
  return value as string;
};

const positive = (
  value: string | undefined,
  flag: string,
  refuse: (why: string) => never,
): number => {
  if (!/^[1-9]\d{0,8}$/.test(value ?? "")) refuse(`${flag} must be a positive whole number`);
  return Number(value);
};

export function parseInitServerArgs(argv: string[]): InitServerArgs {
  const fail: (why: string) => never = failWith(INIT_SERVER_USAGE);
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      mint: { type: "string" },
      "fee-recipient": { type: "string" },
      "admin-keypair": { type: "string" },
      send: { type: "boolean" },
      ...clusterOptions,
    },
  });
  const mint = address(values.mint, "--mint", fail);
  const feeRecipient = address(values["fee-recipient"], "--fee-recipient", fail);
  if (feeRecipient === mint) fail("--fee-recipient is the mint");
  const adminKeypair = values["admin-keypair"] ?? "";
  if (adminKeypair === "") fail("--admin-keypair must name the server key's file");
  return {
    send: values.send ?? false,
    mint,
    feeRecipient,
    adminKeypair,
    ...parseCluster(values, fail),
  };
}

export function parseBindArgs(argv: string[]): BindArgs {
  const fail: (why: string) => never = failWith(BIND_USAGE);
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      mint: { type: "string" },
      "chain-address": { type: "string" },
      admin: { type: "string" },
      "first-paid-epoch": { type: "string" },
      "threshold-volume-lamports": { type: "string" },
      basis: { type: "string" },
      "reward-bps-of-volume": { type: "string" },
      "auto-publish": { type: "string" },
      "effective-from-index": { type: "string" },
      apply: { type: "boolean" },
      ...clusterOptions,
    },
  });
  const threshold = values["threshold-volume-lamports"] ?? "";
  if (!/^[1-9]\d*$/.test(threshold)) fail("--threshold-volume-lamports must be positive lamports");
  const thresholdVolumeLamports = BigInt(threshold);
  // The column is Postgres bigint, signed.
  if (thresholdVolumeLamports > PG_BIGINT_MAX) {
    fail("--threshold-volume-lamports must fit a signed 64-bit integer");
  }
  const basis = values.basis;
  if (basis !== "cumulative" && basis !== "per_epoch") {
    fail("--basis must be cumulative or per_epoch");
  }
  const bps = values["reward-bps-of-volume"] ?? "";
  if (!/^[1-9]\d{0,4}$/.test(bps) || Number(bps) > 10_000) {
    fail("--reward-bps-of-volume must be 1 to 10000");
  }
  const autoPublish = values["auto-publish"];
  if (autoPublish !== "on" && autoPublish !== "off") fail("--auto-publish must be on or off");
  return {
    apply: values.apply ?? false,
    mint: address(values.mint, "--mint", fail),
    chainAddress: address(values["chain-address"], "--chain-address", fail),
    admin: address(values.admin, "--admin", fail),
    firstPaidEpoch: positive(values["first-paid-epoch"], "--first-paid-epoch", fail),
    policy: {
      effectiveFromIndex: positive(values["effective-from-index"], "--effective-from-index", fail),
      thresholdVolumeLamports,
      basis,
      rewardBpsOfVolume: Number(bps),
      autoPublish: autoPublish === "on",
    },
    ...parseCluster(values, fail),
  };
}

// The server key as solana-keygen writes it: a JSON array of 64 bytes. No error repeats any part
// of the file, which is a secret.
export async function readServerKeypair(path: string): Promise<KeyPairSigner> {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(`keypair: cannot read ${path}`);
  }
  let bytes: unknown;
  try {
    bytes = JSON.parse(text);
  } catch {
    bytes = null;
  }
  if (
    !Array.isArray(bytes) ||
    bytes.length !== 64 ||
    !bytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)
  ) {
    throw new Error(`keypair: ${path} is not a JSON array of 64 bytes`);
  }
  try {
    return await createKeyPairSignerFromBytes(Uint8Array.from(bytes as number[]));
  } catch {
    throw new Error(`keypair: ${path} is not a valid Solana keypair`);
  }
}

// Where a DATABASE_URL points, without its credentials.
export function databaseLabel(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return "an unparsable URL";
  }
}
