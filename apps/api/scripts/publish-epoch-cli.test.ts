import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { planPublication } from "../src/payout/publish.js";
import { randomAddress, seedReadyEpoch } from "../src/payout/ready-seed.js";
import { createTestDb } from "../src/rewards/test-db.js";
import {
  describeRunOutcome,
  parsePublishArgs,
  summarizeDistribution,
  summarizePlan,
} from "./publish-epoch-cli.js";

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

  it("takes every hardened index the device can derive, up to 2^31 - 1", () => {
    const argv = ["plan", ...base, "--network", "devnet", "--rpc", "https://r.example", "--signer"];
    expect(parsePublishArgs([...argv, "ledger:44'/501'/2147483647'/0'"]).signer).toEqual({
      kind: "ledger",
      path: "44'/501'/2147483647'/0'",
    });
  });

  it("points a mainnet file signer at a named Ledger account", () => {
    const argv = ["plan", ...base, "--network", "mainnet", "--rpc", "https://r.example"];
    expect(() => parsePublishArgs([...argv, "--signer", "file:k.json"])).toThrow(
      /--signer ledger:<derivation path>/,
    );
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
    [
      "a Ledger index past 2^31 - 1",
      ["plan", ...base, ...rpc, "--signer", "ledger:44'/501'/2147483648'"],
    ],
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

describe("parsePublishArgs run", () => {
  const rpc = ["--network", "devnet", "--rpc", "https://api.devnet.solana.com"];
  it("reads the one-command run: a mint, a chain and a signer, no epoch and no pot", () => {
    expect(
      parsePublishArgs(["run", "--mint", MINT, ...rpc, "--signer", "file:C:/keys/admin.json"]),
    ).toEqual({
      command: "run",
      mint: MINT,
      network: "solana:devnet",
      rpcUrl: "https://api.devnet.solana.com",
      wsUrl: "wss://api.devnet.solana.com",
      signer: { kind: "file", path: "C:/keys/admin.json" },
    });
  });

  it.each([
    ["a pot", ["--gross", "500000000"]],
    ["an epoch", ["--epoch", "2"]],
  ])("refuses %s: the distribution decides both", (_what, extra) => {
    expect(() =>
      parsePublishArgs(["run", "--mint", MINT, ...extra, ...rpc, "--signer", LEDGER]),
    ).toThrow(/run takes no --epoch or --gross/);
  });

  it("signs mainnet only on a Ledger, like plan and publish", () => {
    expect(() =>
      parsePublishArgs([
        "run",
        "--mint",
        MINT,
        "--network",
        "mainnet",
        "--rpc",
        "https://r.example",
        "--signer",
        "file:k.json",
      ]),
    ).toThrow(/--signer ledger:<derivation path>/);
  });

  it("refuses a mint that is not base58", () => {
    expect(() => parsePublishArgs(["run", "--mint", "0OIl", ...rpc, "--signer", LEDGER])).toThrow(
      /--mint/,
    );
  });
});

describe("summarizeDistribution", () => {
  it("shows the numbers the Ledger approval will commit to", () => {
    const text = summarizeDistribution({
      epochIndex: 3,
      grossLamports: 2_000_000_000n,
      allocatedLamports: 1_900_000_000n,
      leaves: 4,
      epochs: 2,
      root: "ab".repeat(32),
      auditHash: "cd".repeat(32),
    });
    expect(text).toContain("epoch 3");
    expect(text).toContain("2 epochs");
    expect(text).toContain("gross 2000000000");
    expect(text).toContain("allocated 1900000000 to 4 members");
    expect(text).toContain("ab".repeat(32));
    expect(text).toContain("cd".repeat(32));
  });
});

describe("describeRunOutcome", () => {
  const summary = {
    epochIndex: 3,
    grossLamports: 5n,
    allocatedLamports: 4n,
    leaves: 2,
    epochs: 1,
    root: "ab".repeat(32),
    auditHash: "cd".repeat(32),
  };
  it("is a failure for every refusal and says why", () => {
    for (const reason of [
      "community_unknown",
      "community_held",
      "no_payout_policy",
      "community_not_on_chain",
      "no_signer",
      "publisher_not_admin",
    ] as const) {
      const out = describeRunOutcome({ status: "refused", reason });
      expect(out.ok).toBe(false);
      expect(out.text).toContain(reason);
    }
    expect(
      describeRunOutcome({ status: "refused", reason: "community_held", detail: "held by ruling" })
        .text,
    ).toContain("held by ruling");
  });

  it("succeeds on a publication and on a rollover, and names the transaction", () => {
    const published = describeRunOutcome({
      status: "published",
      signature: "SIG",
      recovered: false,
      ...summary,
    });
    expect(published).toMatchObject({ ok: true });
    expect(published.text).toContain("published: SIG");
    expect(
      describeRunOutcome({
        status: "published",
        signature: "SIG",
        recovered: true,
        ...summary,
      }).text,
    ).toContain("already on-chain");
    const rolled = describeRunOutcome({
      status: "rolled_over",
      epochIndex: 3,
      reason: "below_threshold",
      accrualLamports: 5n,
      volumeLamports: 9n,
    });
    expect(rolled.ok).toBe(true);
    expect(rolled.text).toContain("rolled over");
  });

  it("is a failure when nothing was sent because the epoch waits or is not due", () => {
    expect(
      describeRunOutcome({ status: "waiting", epochIndex: 3, blockers: ["not_final"] }).ok,
    ).toBe(false);
    expect(describeRunOutcome({ status: "nothing_due" }).ok).toBe(false);
    expect(describeRunOutcome({ status: "planned", reason: "no_publisher", ...summary }).ok).toBe(
      false,
    );
  });
});
