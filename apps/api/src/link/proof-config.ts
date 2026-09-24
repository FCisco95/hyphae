import { formatWalletMessage, type TenantProofConfig } from "@organichub/verify";
import { env } from "../env.js";

// One config for every community: the page and the proof endpoints share the api origin (D4).
export const proofConfig = (): TenantProofConfig => ({
  origin: env.LINK_ORIGIN,
  chain: env.LINK_CHAIN,
  productName: "Hyphae",
  statement: "Link this wallet to your Hyphae member account.",
});

// The SDK rejects a bad config (non-https origin, long statement) as an ordinary invalid proof on
// every request; formatting one message at startup fails the process instead.
export function assertProofConfig(cfg: TenantProofConfig = proofConfig()): void {
  const issuedAt = new Date(0);
  formatWalletMessage(
    {
      walletAddress: "11111111111111111111111111111111",
      origin: cfg.origin,
      chain: cfg.chain,
      requestId: "00000000-0000-4000-8000-000000000000",
      nonce: Buffer.alloc(32).toString("base64url"),
      issuedAt,
      expiresAt: new Date(issuedAt.getTime() + 5 * 60_000),
    },
    cfg,
  );
}
