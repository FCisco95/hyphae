import { describe, expect, it } from "vitest";
import { onChainAdminReader } from "./chain.js";

const account = (address: string, admin: string) => ({
  address,
  admin,
  feeRecipient: "F",
  outstandingLamports: 0n,
  vaultLamports: 0n,
  rentExemptMinimum: 0n,
});

describe("on-chain admin reader", () => {
  it("returns the bound community's admin, null for a missing or different account", async () => {
    const read = onChainAdminReader(async () => ({
      readCommunity: async ({ address }) =>
        address === "A" ? account("A", "Admin") : address === "B" ? account("Other", "X") : null,
    }));
    expect(await read({ mint: "M", address: "A" })).toBe("Admin");
    expect(await read({ mint: "M", address: "B" })).toBeNull();
    expect(await read({ mint: "M", address: "C" })).toBeNull();
  });

  it("propagates chain errors and retries a failed build", async () => {
    let builds = 0;
    const read = onChainAdminReader(async () => {
      builds++;
      if (builds === 1) throw new Error("genesis");
      return {
        readCommunity: async () => {
          throw new Error("rpc down");
        },
      };
    });
    await expect(read({ mint: "M", address: "A" })).rejects.toThrow("genesis");
    await expect(read({ mint: "M", address: "A" })).rejects.toThrow("rpc down");
    await read({ mint: "M", address: "A" }).catch(() => undefined);
    expect(builds).toBe(2);
  });
});
