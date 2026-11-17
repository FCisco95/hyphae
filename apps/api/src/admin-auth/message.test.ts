import { getBase58Encoder } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { operatorMessage, signedBy } from "./message.js";
import { testKey } from "./test-key.js";

// A real `solana sign-offchain-message` signature (solana-cli 3.1.10, throwaway key, 2026-11-17):
// the CLI signs the legacy off-chain envelope, format 0 (restricted ASCII), of this exact text.
const CLI = {
  wallet: "CCgEo8Yzb5vpfuaCixZ8NVJqv8ssAzXmKm5vsfhfmhe2",
  signature:
    "36D2py4skfwSxRVxpnrkhn3BDpMUzgWtawnexPhYvNAttrb6v6Ys1EhDCwnPio7mhJiPea6hECCDz2kTR63i9rkG",
  fields: {
    domain: "https://hyphae.test",
    network: "solana:devnet" as const,
    mint: "DemoMint111",
    wallet: "CCgEo8Yzb5vpfuaCixZ8NVJqv8ssAzXmKm5vsfhfmhe2",
    nonce: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8",
    issuedAt: new Date("2026-11-17T12:00:00.000Z"),
    expiresAt: new Date("2026-11-17T12:05:00.000Z"),
  },
};

const b58 = (s: string) => getBase58Encoder().encode(s);

describe("operator sign-in message", () => {
  it("is one restricted-ASCII line that names purpose, domain, network, community, wallet, nonce and times", () => {
    const text = operatorMessage(CLI.fields);
    expect(text).toBe(
      "hyphae.test asks you to sign in to the Hyphae operator page. This proves you control this wallet; it approves no transaction and moves no funds. Purpose: hyphae-operator-login; Domain: https://hyphae.test; Network: solana:devnet; Community: DemoMint111; Wallet: CCgEo8Yzb5vpfuaCixZ8NVJqv8ssAzXmKm5vsfhfmhe2; Nonce: AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8; Issued At: 2026-11-17T12:00:00.000Z; Expires At: 2026-11-17T12:05:00.000Z",
    );
    expect(text).toMatch(/^[\x20-\x7e]+$/);
    expect(text.length).toBeLessThanOrEqual(1212);
  });

  it("accepts the Solana CLI's off-chain envelope signature (what a Ledger signs)", () => {
    expect(signedBy(operatorMessage(CLI.fields), b58(CLI.signature), CLI.wallet)).toBe(true);
  });

  it("accepts a raw signMessage signature over the same bytes", () => {
    const key = testKey();
    const text = operatorMessage({ ...CLI.fields, wallet: key.wallet });
    expect(signedBy(text, b58(key.signRaw(text)), key.wallet)).toBe(true);
  });

  it("refuses another key, another message, a truncated signature and a bad wallet", () => {
    const text = operatorMessage(CLI.fields);
    const other = testKey();
    expect(signedBy(text, b58(CLI.signature), other.wallet)).toBe(false);
    expect(signedBy(`${text} `, b58(CLI.signature), CLI.wallet)).toBe(false);
    expect(
      signedBy(
        operatorMessage({ ...CLI.fields, nonce: "B".repeat(43) }),
        b58(CLI.signature),
        CLI.wallet,
      ),
    ).toBe(false);
    expect(signedBy(text, b58(CLI.signature).subarray(0, 63), CLI.wallet)).toBe(false);
    expect(signedBy(text, b58(CLI.signature), "not-a-wallet")).toBe(false);
    // A signature over the wrong envelope format byte is not this message.
    const key = testKey();
    const body = Buffer.from(operatorMessage({ ...CLI.fields, wallet: key.wallet }));
    const len = Buffer.alloc(2);
    len.writeUInt16LE(body.length);
    const domain = Buffer.concat([Buffer.from([0xff]), Buffer.from("solana offchain")]);
    const wrong = Buffer.concat([domain, Buffer.from([0, 2]), len, body]);
    expect(signedBy(body.toString(), b58(key.signRaw(wrong)), key.wallet)).toBe(false);
  });

  it("refuses a field that would break the one-line format", () => {
    expect(() => operatorMessage({ ...CLI.fields, mint: "Mint;Wallet: x" })).toThrow();
    expect(() => operatorMessage({ ...CLI.fields, domain: "https://hyphae.test/path" })).toThrow();
    expect(() => operatorMessage({ ...CLI.fields, domain: "http://hyphae.test" })).toThrow();
  });
});
