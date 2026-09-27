import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { planPublication } from "../src/payout/publish.js";
import { randomAddress, seedReadyEpoch } from "../src/payout/ready-seed.js";
import { createTestDb } from "../src/rewards/test-db.js";
import { parsePublishArgs, summarizePlan } from "./publish-epoch-cli.js";

const MINT = "So11111111111111111111111111111111111111112";
const base = ["--mint", MINT, "--epoch", "2", "--gross", "500000000"];
// Any named hardened Solana account; which one is Hyphae's admin is the operator's call.
const LEDGER = "ledger:44'/501'/2'/0'";

describe("parsePublishArgs", () => {
  it("reads a devnet plan with a keypair file, deriving the websocket from the RPC", () => {
    expect(
      parsePublishArgs([
        "plan",
        ...base,
        "--network",
        "devnet",
        "--rpc",
        "https://api.devnet.solana.com",
        "--signer",
        "file:C:/keys/admin.json",
      ]),
    ).toEqual({
      command: "plan",
      mint: MINT,
      epoch: 2,
      grossLamports: 500_000_000n,
      network: "solana:devnet",
      rpcUrl: "https://api.devnet.solana.com",
      wsUrl: "wss://api.devnet.solana.com",
      signer: { kind: "file", path: "C:/keys/admin.json" },
    });
  });

  it("reads a mainnet publish on the Ledger account the operator names", () => {
    expect(
      parsePublishArgs([
        "publish",
        ...base,
        "--network",
        "mainnet",
        "--rpc",
        "https://rpc.example/?key=1",
        "--ws",
        "wss://ws.example/?key=1",
        "--signer",
        LEDGER,
      ]),
    ).toMatchObject({
      command: "publish",
      network: "solana:mainnet",
      wsUrl: "wss://ws.example/?key=1",
      signer: { kind: "ledger", path: "44'/501'/2'/0'" },
    });
    expect(
      parsePublishArgs([
        "plan",
        ...base,
        ...["--network", "devnet", "--rpc", "https://r.example"],
        "--signer",
        "ledger:44'/501'/7'",
      ]).signer,
    ).toEqual({ kind: "ledger", path: "44'/501'/7'" });
  });

  it("names no Ledger account for the operator: the device's first account may be an everyday wallet", () => {
    const argv = ["plan", ...base, "--network", "devnet", "--rpc", "https://r.example", "--signer"];
    expect(() => parsePublishArgs([...argv, "ledger"])).toThrow(/name the Ledger account/);
    expect(() => parsePublishArgs([...argv, "ledger:"])).toThrow(/name the Ledger account/);
  });

  const rpc = ["--network", "devnet", "--rpc", "https://api.devnet.solana.com"];
  it.each([
    ["no command", [...base, ...rpc, "--signer", LEDGER]],
    ["an unknown command", ["send", ...base, ...rpc, "--signer", LEDGER]],
    [
      "a keypair file on mainnet",
      [
        "plan",
        ...base,
        "--network",
        "mainnet",
        "--rpc",
        "https://r.example",
        "--signer",
        "file:k.json",
      ],
    ],
    ["no signer", ["plan", ...base, ...rpc]],
    [
      "a Ledger path that is not hardened",
      ["plan", ...base, ...rpc, "--signer", "ledger:44/501/0"],
    ],
    [
      "a Ledger path outside Solana's coin type",
      ["plan", ...base, ...rpc, "--signer", "ledger:44'/60'/0'"],
    ],
    [
      "a Ledger path with an m/ prefix",
      ["plan", ...base, ...rpc, "--signer", "ledger:m/44'/501'/0'"],
    ],
    [
      "a Ledger path that is not numeric",
      ["plan", ...base, ...rpc, "--signer", "ledger:44'/501'/x'"],
    ],
    ["a Ledger path too deep", ["plan", ...base, ...rpc, "--signer", "ledger:44'/501'/0'/0'/0'"]],
    ["an unknown signer", ["plan", ...base, ...rpc, "--signer", "env:KEY"]],
    [
      "a zero pot",
      ["plan", "--mint", MINT, "--epoch", "2", "--gross", "0", ...rpc, "--signer", LEDGER],
    ],
    [
      "a fractional pot",
      ["plan", "--mint", MINT, "--epoch", "2", "--gross", "1.5", ...rpc, "--signer", LEDGER],
    ],
    [
      "a pot beyond u64",
      [
        "plan",
        "--mint",
        MINT,
        "--epoch",
        "2",
        "--gross",
        "18446744073709551616",
        ...rpc,
        "--signer",
        LEDGER,
      ],
    ],
    [
      "epoch 0",
      ["plan", "--mint", MINT, "--epoch", "0", "--gross", "1", ...rpc, "--signer", LEDGER],
    ],
    [
      "a mint that is not base58",
      ["plan", "--mint", "0OIl", "--epoch", "2", "--gross", "1", ...rpc, "--signer", LEDGER],
    ],
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
    expect(() => parsePublishArgs(argv)).toThrow();
  });
});

describe("summarizePlan", () => {
  it("shows the operator every number the transaction commits to, before it is signed", async () => {
    const t = await createTestDb();
    try {
      const community = randomAddress();
      const seed = await seedReadyEpoch(t.db, {
        now: new Date("2026-11-20T12:00:00.000Z"),
        chainAddress: community,
      });
      const plan = await planPublication(
        t.db,
        {
          network: "solana:devnet",
          programId: "EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E",
          readCommunity: async () => ({
            address: community,
            feeRecipient: "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR",
          }),
          readEpoch: async () => null,
          publishEpoch: async () => {
            throw new Error("a plan never sends");
          },
          publishSignature: async () => "none",
        },
        { communityId: seed.communityId, epochId: seed.epochId, grossLamports: 500_000_000n },
      );
      if (plan.status !== "planned") throw new Error(plan.status);
      const [row] = await t.db
        .select({ mint: communities.mint })
        .from(communities)
        .where(eq(communities.id, seed.communityId));
      const text = summarizePlan(plan);
      for (const expected of [
        "solana:devnet",
        community,
        row?.mint as string,
        "epoch 1",
        "gross 500000000",
        "fee 15000000 (300 bps) to AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR",
        "allocated 304603658",
        "cap remainder 180396341",
        "dust 1",
        plan.intent.root,
        plan.intent.auditHash,
        "not on-chain yet",
      ]) {
        expect(text).toContain(expected);
      }
      for (const leaf of plan.intent.leaves) {
        expect(text).toContain(`${leaf.wallet} ${leaf.amountLamports}`);
      }
    } finally {
      await t.close();
    }
  }, 30_000);
});
