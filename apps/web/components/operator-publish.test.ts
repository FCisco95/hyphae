import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  blockhash,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getTransactionEncoder,
  type Instruction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import { cliCommand, pollText, signatureFromWallet } from "./operator-publish.js";

const WALLET = "CCgEo8Yzb5vpfuaCixZ8NVJqv8ssAzXmKm5vsfhfmhe2";
const OTHER = "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR";

function message(extra: Instruction[] = []) {
  const payer = createNoopSigner(address(WALLET));
  const ix: Instruction = {
    programAddress: address("EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E"),
    accounts: [{ address: address(WALLET), role: AccountRole.WRITABLE_SIGNER }],
    data: new Uint8Array([1, 2, 3]),
  };
  const m = pipe(
    createTransactionMessage({ version: 0 }),
    (x) => setTransactionMessageFeePayerSigner(payer, x),
    (x) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: blockhash("4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY"),
          lastValidBlockHeight: 1n,
        },
        x,
      ),
    (x) => appendTransactionMessageInstructions([ix, ...extra], x),
  );
  return new Uint8Array(compileTransaction(m).messageBytes);
}
const signed = (bytes: Uint8Array, signatures: Record<string, Uint8Array | null>) =>
  new Uint8Array(
    getTransactionEncoder().encode({
      messageBytes: bytes as never,
      signatures: signatures as never,
    }),
  );

describe("signatureFromWallet", () => {
  it("takes the admin's signature over the exact bytes the API built", () => {
    const bytes = message();
    const out = signatureFromWallet(
      signed(bytes, { [WALLET]: new Uint8Array(64).fill(7) }),
      bytes,
      WALLET,
    );
    expect(out.ok).toBe(true);
  });

  it("refuses a wallet that changed the transaction, signed nothing or is another key", () => {
    const bytes = message();
    const changed = message([
      {
        programAddress: address("ComputeBudget111111111111111111111111111111"),
        data: new Uint8Array([3]),
      },
    ]);
    expect(
      signatureFromWallet(signed(changed, { [WALLET]: new Uint8Array(64) }), bytes, WALLET),
    ).toEqual({ ok: false, code: "wallet_changed" });
    expect(signatureFromWallet(signed(bytes, { [WALLET]: null }), bytes, WALLET).ok).toBe(false);
    expect(signatureFromWallet(new Uint8Array([1, 2]), bytes, WALLET).ok).toBe(false);
    expect(
      signatureFromWallet(signed(bytes, { [WALLET]: new Uint8Array(64) }), bytes, OTHER).ok,
    ).toBe(false);
  });
});

describe("cliCommand", () => {
  it("names the network and the Ledger account the admin key lives on", () => {
    expect(cliCommand("solana:mainnet", "AQID")).toBe(
      `node --import tsx scripts/publish-sign.ts --network mainnet --signer "ledger:44'/501'/2'/0'" --message AQID`,
    );
    expect(cliCommand("solana:devnet", "AQID")).toContain("--network devnet");
  });
});

describe("pollText", () => {
  const base = {
    id: "11111111-2222-4333-8444-555555555555",
    kind: "publish" as const,
    expires_at: "2026-11-24T12:00:00.000Z",
  };
  it("never says a sent transaction did not go through", () => {
    expect(pollText({ ...base, state: "done", signature: "SIG" })).toBe("Published: SIG");
    expect(pollText({ ...base, state: "failed", signature: "SIG" })).toMatch(
      /^Sent \(SIG\) but not recorded yet/,
    );
    expect(pollText({ ...base, state: "failed", signature: null })).toMatch(/did not go through/);
  });
});
