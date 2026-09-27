import { HYPHAE_PROGRAM_ID } from "@hyphae/core";
import { describe, expect, it } from "vitest";
import { programAccount } from "./chain.js";

const SYSTEM = "11111111111111111111111111111111";
const OTHER = "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR";

const info = (owner: string, bytes: number[], executable = false) => ({
  owner,
  executable,
  data: [Buffer.from(bytes).toString("base64"), "base64"] as const,
});

describe("programAccount", () => {
  it("returns the bytes of an account the program owns", () => {
    expect(programAccount(HYPHAE_PROGRAM_ID, info(HYPHAE_PROGRAM_ID, [7, 8]))).toEqual(
      Uint8Array.of(7, 8),
    );
  });

  it("reads no account, or lamports prefunded to an empty system account, as not created", () => {
    expect(programAccount(HYPHAE_PROGRAM_ID, null)).toBeNull();
    expect(programAccount(HYPHAE_PROGRAM_ID, info(SYSTEM, []))).toBeNull();
  });

  it("refuses another owner, a system account with data, and an executable one", () => {
    for (const other of [info(OTHER, [1]), info(SYSTEM, [0]), info(SYSTEM, [], true)]) {
      expect(() => programAccount(HYPHAE_PROGRAM_ID, other)).toThrow(/not owned by/);
    }
  });
});
