import { describe, expect, it } from "vitest";
import { AUDIT_USAGE, parseAuditArgs } from "./audit-args.js";

const MINT = "So11111111111111111111111111111111111111112";

describe("parseAuditArgs", () => {
  it("takes the mint, the pot and the epoch, with no defaults", () => {
    expect(parseAuditArgs(["--mint", MINT, "--gross", "500000000", "--epoch", "3"])).toEqual({
      mint: MINT,
      grossLamports: 500_000_000n,
      epoch: 3,
    });
  });

  it.each([
    ["no mint", ["--gross", "1", "--epoch", "2"]],
    ["a mint that is not base58", ["--mint", "0OIl", "--gross", "1", "--epoch", "2"]],
    ["no pot", ["--mint", MINT, "--epoch", "2"]],
    ["a zero pot", ["--mint", MINT, "--gross", "0", "--epoch", "2"]],
    ["a fractional pot", ["--mint", MINT, "--gross", "1.5", "--epoch", "2"]],
    ["a pot beyond u64", ["--mint", MINT, "--gross", "18446744073709551616", "--epoch", "2"]],
    ["no epoch", ["--mint", MINT, "--gross", "1"]],
    ["epoch 0", ["--mint", MINT, "--gross", "1", "--epoch", "0"]],
    ["a positional epoch, the old form", ["2", "--mint", MINT, "--gross", "1", "--epoch", "3"]],
  ])("refuses %s, and prints the usage", (_what, argv) => {
    expect(() => parseAuditArgs(argv)).toThrow(AUDIT_USAGE);
  });
});
