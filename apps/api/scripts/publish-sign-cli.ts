import { parseArgs } from "node:util";
import { HYPHAE_PROGRAM_ID } from "@hyphae/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import {
  getAddressDecoder,
  getBase58Decoder,
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
} from "@solana/kit";
import { messageHash } from "../src/payout/handoff.js";
import { type ChainArgs, parseChainArgs } from "./publish-epoch-cli.js";

// The operator page's sign-and-paste path for a Ledger the browser cannot reach: the page shows
// the message it built, this command shows what that message does and asks the Ledger to sign
// it, and the operator pastes the signature back. It reads no database and no RPC. It signs only
// one Hyphae publish_epoch or initialize_community paid for and signed by the Ledger's account:
// a relayed or edited message for anything else is refused before the device is asked.

export const SIGN_USAGE =
  "usage: publish-sign --network devnet|mainnet --signer ledger:<derivation path, e.g. 44'/501'/2'/0'>|file:<keypair.json> --message <base64 from the operator page>";

export interface SignArgs {
  network: ChainArgs["network"];
  signer: ChainArgs["signer"];
  messageBytes: Uint8Array;
}

function fail(why: string): never {
  throw new Error(`${why}\n${SIGN_USAGE}`);
}

export function parseSignArgs(argv: string[]): SignArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      network: { type: "string" },
      signer: { type: "string" },
      message: { type: "string" },
    },
  });
  if (positionals.length > 0) fail("no positional arguments");
  const text = values.message ?? "";
  if (!/^[A-Za-z0-9+/]{1,2048}={0,2}$/.test(text)) fail("--message must be base64");
  // Signing reads no RPC; parseChainArgs is reused for its network and signer rules (mainnet
  // signs only with a Ledger), with a placeholder URL it never contacts.
  const { network, signer } = parseChainArgs(
    {
      ...(values.network !== undefined && { network: values.network }),
      ...(values.signer !== undefined && { signer: values.signer }),
      rpc: "https://unused.invalid",
    },
    fail,
  );
  return { network, signer, messageBytes: new Uint8Array(getBase64Encoder().encode(text)) };
}

const discriminator = (name: string) =>
  bytesToHex(sha256(utf8ToBytes(`global:${name}`)).slice(0, 8));
const SYSTEM_PROGRAM = "11111111111111111111111111111111";

function u64(bytes: Uint8Array, at: number): bigint {
  return new DataView(bytes.buffer, bytes.byteOffset + at, 8).getBigUint64(0, true);
}

// What the message does, line by line, or why it is refused. `signer` is the Ledger's address.
export function describeMessage(
  messageBytes: Uint8Array,
  signer: string,
  programId: string = HYPHAE_PROGRAM_ID,
): { ok: true; lines: string[] } | { ok: false; why: string } {
  let decoded: ReturnType<ReturnType<typeof getCompiledTransactionMessageDecoder>["decode"]>;
  try {
    decoded = getCompiledTransactionMessageDecoder().decode(messageBytes);
  } catch {
    return { ok: false, why: "not a Solana transaction message" };
  }
  if (decoded.version !== 0) return { ok: false, why: "not a v0 message" };
  const m = decoded;
  if (m.addressTableLookups && m.addressTableLookups.length > 0)
    return { ok: false, why: "the message uses address lookup tables" };
  if (m.header.numSignerAccounts !== 1 || m.staticAccounts[0] !== signer)
    return { ok: false, why: `the only signer and fee payer must be ${signer}` };
  if (m.instructions.length !== 1) return { ok: false, why: "the message is not one instruction" };
  const [ix] = m.instructions;
  if (!ix || m.staticAccounts[ix.programAddressIndex] !== programId)
    return { ok: false, why: `the instruction is not the Hyphae program's (${programId})` };
  const data = new Uint8Array(ix.data ?? new Uint8Array());
  const accounts = (ix.accountIndices ?? []).map((i: number) => m.staticAccounts[i]);
  const head = bytesToHex(data.slice(0, 8));
  const common = [
    `fee payer and signer ${signer}`,
    `blockhash ${m.lifetimeToken}`,
    `message hash ${messageHash(messageBytes)} (the Ledger shows this when it blind-signs)`,
  ];
  if (head === discriminator("publish_epoch")) {
    if (data.length !== 8 + 8 + 32 + 32 + 8 + 8 || accounts.length !== 6)
      return { ok: false, why: "a malformed publish_epoch" };
    if (accounts[0] !== signer || accounts[5] !== SYSTEM_PROGRAM)
      return { ok: false, why: "publish_epoch's admin or system account is not as built" };
    return {
      ok: true,
      lines: [
        "publish_epoch",
        `epoch index ${u64(data, 8)}`,
        `root ${bytesToHex(data.slice(16, 48))}`,
        `audit hash ${bytesToHex(data.slice(48, 80))}`,
        `gross ${u64(data, 80)} lamports, allocated ${u64(data, 88)} lamports`,
        `community ${accounts[1]}`,
        `vault ${accounts[2]}`,
        `fee recipient ${accounts[3]}`,
        `epoch account ${accounts[4]}`,
        ...common,
      ],
    };
  }
  if (head === discriminator("initialize_community")) {
    if (data.length !== 8 + 32 || accounts.length !== 5)
      return { ok: false, why: "a malformed initialize_community" };
    if (accounts[0] !== signer || accounts[4] !== SYSTEM_PROGRAM)
      return { ok: false, why: "initialize_community's admin or system account is not as built" };
    return {
      ok: true,
      lines: [
        "initialize_community",
        `mint ${accounts[1]}`,
        `community ${accounts[2]}`,
        `vault ${accounts[3]}`,
        `fee recipient ${getAddressDecoder().decode(data.slice(8, 40))} (permanent)`,
        ...common,
      ],
    };
  }
  return { ok: false, why: "the instruction is neither publish_epoch nor initialize_community" };
}

export const signatureText = (signature: Uint8Array) => getBase58Decoder().decode(signature);
