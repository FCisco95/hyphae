import { describe, expect, it } from "vitest";
import { type MessageWallet, sign } from "./page/wallet.js";

const account = { address: "W", chains: ["solana:mainnet"] };
const SIGNATURE = new Uint8Array(64).fill(7);

type Input = { account: unknown; message: unknown };

// A wallet shaped like the Wallet Standard `solana:signMessage` feature: variadic inputs, one
// output per input. `transform` stands in for a wallet that changes the bytes before signing.
function standardWallet(transform: (m: Uint8Array) => Uint8Array = (m) => m) {
  const calls: Input[][] = [];
  const wallet: MessageWallet = {
    name: "Fake",
    icon: "data:,",
    accounts: [account],
    features: {
      "solana:signMessage": {
        async signMessage(...inputs: Input[]) {
          calls.push(inputs);
          return inputs.map((input) => {
            if (!(input.message instanceof Uint8Array)) throw new Error("message must be bytes");
            return { signedMessage: transform(input.message), signature: SIGNATURE };
          });
        },
      },
    },
  };
  return { wallet, calls };
}

describe("sign", () => {
  it("passes one input object, not an array, as the Wallet Standard requires", async () => {
    const { wallet, calls } = standardWallet();
    await sign(wallet, account, "hello");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(1);
    expect(calls[0]?.[0]?.account).toBe(account);
    expect(calls[0]?.[0]?.message).toEqual(new TextEncoder().encode("hello"));
  });

  it("returns the signature as base64url", async () => {
    const { wallet } = standardWallet();
    expect(await sign(wallet, account, "hello")).toBe(Buffer.from(SIGNATURE).toString("base64url"));
  });

  it("refuses a wallet that signed different bytes", async () => {
    const { wallet } = standardWallet((m) => new Uint8Array([0, ...m]));
    await expect(sign(wallet, account, "hello")).rejects.toThrow(/altered/);
  });
});
