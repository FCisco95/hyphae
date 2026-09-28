import { describe, expect, it } from "vitest";
import { feeRecipientProblem, parseInitArgs, vaultTopUp } from "./init-community-cli.js";

const MINT = "So11111111111111111111111111111111111111112";
const VAULT = "rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK";
const base = ["--mint", MINT, "--fee-recipient", VAULT];
const LEDGER = "ledger:44'/501'/2'/0'";
const rpc = ["--network", "devnet", "--rpc", "https://api.devnet.solana.com"];

describe("parseInitArgs", () => {
  it("reads a devnet plan with a keypair file and a pot to fund", () => {
    const args = parseInitArgs([
      "plan",
      ...base,
      ...rpc,
      "--signer",
      "file:admin.json",
      "--gross",
      "500000000",
    ]);
    expect(args).toEqual({
      command: "plan",
      mint: MINT,
      feeRecipient: VAULT,
      grossLamports: 500_000_000n,
      network: "solana:devnet",
      rpcUrl: "https://api.devnet.solana.com",
      wsUrl: "wss://api.devnet.solana.com",
      signer: { kind: "file", path: "admin.json" },
    });
  });

  it("reads a mainnet send on the Ledger account the operator names, with no pot", () => {
    const args = parseInitArgs([
      "send",
      ...base,
      "--network",
      "mainnet",
      "--rpc",
      "https://r.example/?api-key=k",
      "--ws",
      "wss://w.example",
      "--signer",
      LEDGER,
    ]);
    expect(args.command).toBe("send");
    expect(args.network).toBe("solana:mainnet");
    expect(args.wsUrl).toBe("wss://w.example");
    expect(args.signer).toEqual({ kind: "ledger", path: "44'/501'/2'/0'" });
    expect(args.grossLamports).toBeNull();
  });

  it("points a mainnet file signer at a named Ledger account", () => {
    const argv = ["plan", ...base, "--network", "mainnet", "--rpc", "https://r.example"];
    expect(() => parseInitArgs([...argv, "--signer", "file:k.json"])).toThrow(
      /--signer ledger:<derivation path>/,
    );
  });

  it("names no Ledger account for the operator", () => {
    expect(() => parseInitArgs(["plan", ...base, ...rpc, "--signer", "ledger"])).toThrow(
      /name the Ledger account/,
    );
  });

  it.each([
    ["no command", [...base, ...rpc, "--signer", LEDGER]],
    ["publish, which is another script's", ["publish", ...base, ...rpc, "--signer", LEDGER]],
    ["no fee recipient", ["plan", "--mint", MINT, ...rpc, "--signer", LEDGER]],
    [
      "a fee recipient that is not base58",
      ["plan", "--mint", MINT, "--fee-recipient", "0OIl", ...rpc, "--signer", LEDGER],
    ],
    [
      "the mint as its own fee recipient",
      ["plan", "--mint", MINT, "--fee-recipient", MINT, ...rpc, "--signer", LEDGER],
    ],
    ["no signer", ["plan", ...base, ...rpc]],
    ["a zero pot", ["plan", ...base, ...rpc, "--signer", LEDGER, "--gross", "0"]],
    ["a fractional pot", ["plan", ...base, ...rpc, "--signer", LEDGER, "--gross", "0.5"]],
    [
      "an http RPC",
      [
        "plan",
        ...base,
        "--network",
        "devnet",
        "--rpc",
        "http://api.devnet.solana.com",
        "--signer",
        LEDGER,
      ],
    ],
  ])("refuses %s", (_what, argv) => {
    expect(() => parseInitArgs(argv)).toThrow();
  });
});

describe("feeRecipientProblem", () => {
  const SYSTEM = "11111111111111111111111111111111";
  const SQUADS = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";

  it("takes a System-owned wallet with no data, such as a Squads vault", () => {
    expect(
      feeRecipientProblem({
        owner: SYSTEM,
        executable: false,
        dataLength: 0,
        lamports: 1_000_000n,
      }),
    ).toBeNull();
  });

  it("refuses an address with no account: a typo would lose every fee for good", () => {
    expect(feeRecipientProblem(null)).toMatch(/does not exist/);
  });

  it("refuses a Squads multisig account: fees must go to its vault", () => {
    expect(
      feeRecipientProblem({
        owner: SQUADS,
        executable: false,
        dataLength: 400,
        lamports: 3_000_000n,
      }),
    ).toMatch(new RegExp(`owned by ${SQUADS}`));
  });

  it("refuses a program and an account holding data", () => {
    expect(
      feeRecipientProblem({ owner: SYSTEM, executable: true, dataLength: 0, lamports: 1n }),
    ).not.toBeNull();
    expect(
      feeRecipientProblem({ owner: SYSTEM, executable: false, dataLength: 8, lamports: 1n }),
    ).not.toBeNull();
  });
});

describe("vaultTopUp", () => {
  const rent = 953_520n;

  it("asks for the whole pot when the vault holds only its rent", () => {
    expect(
      vaultTopUp({
        vaultLamports: rent,
        rentLamports: rent,
        outstandingLamports: 0n,
        grossLamports: 500_000_000n,
      }),
    ).toBe(500_000_000n);
  });

  it("counts only the unassigned balance: unclaimed allocations stay reserved", () => {
    expect(
      vaultTopUp({
        vaultLamports: rent + 18_335_365n + 50_000_000n,
        rentLamports: rent,
        outstandingLamports: 18_335_365n,
        grossLamports: 500_000_000n,
      }),
    ).toBe(450_000_000n);
  });

  it("asks for nothing when the pot is already covered", () => {
    expect(
      vaultTopUp({
        vaultLamports: rent + 600_000_000n,
        rentLamports: rent,
        outstandingLamports: 0n,
        grossLamports: 500_000_000n,
      }),
    ).toBe(0n);
  });
});
