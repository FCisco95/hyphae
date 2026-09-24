import type { TenantProofConfig } from "@organichub/verify";
import { getAddressFromPublicKey } from "@solana/kit";

export const testTenant: TenantProofConfig = {
  origin: "https://api.hyphae.test",
  chain: "solana:mainnet",
  productName: "Hyphae",
  statement: "Link this wallet to your Hyphae member account.",
};

// Tests only: a throwaway in-memory Ed25519 key standing in for a member's wallet.
export async function testWallet() {
  const keys = (await crypto.subtle.generateKey("Ed25519", false, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const address: string = await getAddressFromPublicKey(keys.publicKey);
  return {
    address,
    async sign(message: string): Promise<string> {
      const signature = await crypto.subtle.sign(
        "Ed25519",
        keys.privateKey,
        new TextEncoder().encode(message),
      );
      return Buffer.from(signature).toString("base64url");
    },
  };
}
