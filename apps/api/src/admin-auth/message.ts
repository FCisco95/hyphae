import { createPublicKey, verify } from "node:crypto";
import { getBase58Encoder, type ReadonlyUint8Array } from "@solana/kit";

// The operator sign-in message. One line of printable ASCII, so `solana sign-offchain-message`
// signs it as off-chain format 0 and a Ledger shows it in clear (no blind signing). It proves
// control of a key and nothing else: the text says it approves no transaction.

export interface OperatorMessageFields {
  // The https origin the operator signs in to (an allowed web origin).
  domain: string;
  network: "solana:mainnet" | "solana:devnet";
  mint: string;
  wallet: string;
  // 32 random bytes, base64url.
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}

const MINT = /^[A-Za-z0-9]{1,64}$/;
const WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const NONCE = /^[A-Za-z0-9_-]{43}$/;

export function allowedOrigin(value: string): string {
  const url = new URL(value);
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !local) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "") ||
    !/^[\x21-\x7e]+$/.test(url.origin)
  )
    throw new Error("operator: the sign-in domain must be a bare https origin");
  return url.origin;
}

export function operatorMessage(f: OperatorMessageFields): string {
  const origin = allowedOrigin(f.domain);
  if (origin !== f.domain.replace(/\/$/, "")) throw new Error("operator: domain is not an origin");
  if (!MINT.test(f.mint) || !WALLET.test(f.wallet) || !NONCE.test(f.nonce))
    throw new Error("operator: malformed sign-in field");
  const host = new URL(origin).host;
  return [
    `${host} asks you to sign in to the Hyphae operator page.`,
    "This proves you control this wallet; it approves no transaction and moves no funds.",
    "Purpose: hyphae-operator-login;",
    `Domain: ${origin};`,
    `Network: ${f.network};`,
    `Community: ${f.mint};`,
    `Wallet: ${f.wallet};`,
    `Nonce: ${f.nonce};`,
    `Issued At: ${f.issuedAt.toISOString()};`,
    `Expires At: ${f.expiresAt.toISOString()}`,
  ].join(" ");
}

const SPKI_ED25519 = Buffer.from("302a300506032b6570032100", "hex");
const OFFCHAIN_DOMAIN = Buffer.concat([Buffer.from([0xff]), Buffer.from("solana offchain")]);

// Solana's legacy off-chain message envelope, version 0: what the Solana CLI and the Ledger app
// sign. Format 0 is restricted ASCII, 1 limited UTF-8; the same bytes either way.
function envelope(body: Buffer, format: 0 | 1): Buffer {
  const length = Buffer.alloc(2);
  length.writeUInt16LE(body.length);
  return Buffer.concat([OFFCHAIN_DOMAIN, Buffer.from([0, format]), length, body]);
}

// True when `signature` is the wallet's ed25519 signature over the message, either raw (a
// browser wallet's signMessage) or inside the off-chain envelope. Anything malformed is false.
export function signedBy(
  message: string,
  signature: Uint8Array | ReadonlyUint8Array,
  wallet: string,
): boolean {
  try {
    if (signature.length !== 64 || !WALLET.test(wallet)) return false;
    const publicBytes = getBase58Encoder().encode(wallet);
    if (publicBytes.length !== 32) return false;
    const key = createPublicKey({
      key: Buffer.concat([SPKI_ED25519, Buffer.from(publicBytes)]),
      format: "der",
      type: "spki",
    });
    const body = Buffer.from(message, "utf8");
    if (body.length > 0xffff) return false;
    return [body, envelope(body, 0), envelope(body, 1)].some((bytes) =>
      verify(null, bytes, key, Buffer.from(signature)),
    );
  } catch {
    return false;
  }
}
