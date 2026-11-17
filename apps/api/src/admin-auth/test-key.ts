import { generateKeyPairSync, sign } from "node:crypto";
import { getBase58Decoder } from "@solana/kit";

// A throwaway ed25519 key for tests: its wallet address and a raw-bytes signer (base58 out).
export function testKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(12);
  return {
    wallet: getBase58Decoder().decode(raw),
    signRaw: (message: string | Uint8Array) =>
      getBase58Decoder().decode(sign(null, Buffer.from(message), privateKey)),
  };
}
