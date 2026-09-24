import { formatWalletMessage } from "@organichub/verify";
import { describe, expect, it, vi } from "vitest";

vi.mock("../env.js", () => ({
  env: { LINK_ORIGIN: "https://api.hyphae.fun", LINK_CHAIN: "solana:mainnet" },
}));

describe("proofConfig", () => {
  it("is accepted by the SDK message formatter", async () => {
    const { proofConfig } = await import("./proof-config.js");
    const cfg = proofConfig();
    const issuedAt = new Date("2026-10-01T00:00:00.000Z");
    const message = formatWalletMessage(
      {
        walletAddress: "11111111111111111111111111111111",
        origin: cfg.origin,
        chain: cfg.chain,
        requestId: "00000000-0000-4000-8000-000000000000",
        nonce: Buffer.alloc(32, 1).toString("base64url"),
        issuedAt,
        expiresAt: new Date(issuedAt.getTime() + 5 * 60_000),
      },
      cfg,
    );
    expect(message).toContain("api.hyphae.fun");
    expect(message).toContain("Hyphae");
  });

  it("assertProofConfig throws on a statement over 200 characters", async () => {
    const { assertProofConfig, proofConfig } = await import("./proof-config.js");
    expect(() => assertProofConfig()).not.toThrow();
    expect(() => assertProofConfig({ ...proofConfig(), statement: "a".repeat(201) })).toThrow();
  });
});
