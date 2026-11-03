import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  databaseLabel,
  parseBindArgs,
  parseInitServerArgs,
  readServerKeypair,
} from "./server-community-cli.js";

const MINT = "So11111111111111111111111111111111111111112";
const FEE = "rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK";
const ADMIN = "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR";
const COMMUNITY = "7dsxLdz2BeakoH3bjB1WzHtK3t6fHC3PoP4hs2Z3C6EQ";
const init = ["--mint", MINT, "--fee-recipient", FEE, "--admin-keypair", "server.json"];

describe("parseInitServerArgs", () => {
  it("is a dry run on a local validator unless --send is given", () => {
    expect(parseInitServerArgs([...init, "--cluster", "localnet"])).toEqual({
      send: false,
      mint: MINT,
      feeRecipient: FEE,
      adminKeypair: "server.json",
      cluster: "localnet",
      network: "solana:devnet",
      local: true,
      rpcUrl: "http://127.0.0.1:8899",
      wsUrl: "ws://127.0.0.1:8900",
    });
    expect(parseInitServerArgs([...init, "--cluster", "localnet", "--send"]).send).toBe(true);
  });

  it("derives the local websocket from a named local RPC port", () => {
    const args = parseInitServerArgs([
      ...init,
      "--cluster",
      "localnet",
      "--rpc",
      "http://localhost:18899",
    ]);
    expect(args.wsUrl).toBe("ws://localhost:18900");
  });

  it("takes devnet on an https RPC with the devnet label", () => {
    const args = parseInitServerArgs([
      ...init,
      "--cluster",
      "devnet",
      "--rpc",
      "https://api.devnet.solana.com",
    ]);
    expect(args).toMatchObject({
      cluster: "devnet",
      network: "solana:devnet",
      local: false,
      wsUrl: "wss://api.devnet.solana.com",
    });
  });

  it("takes mainnet with a server key only when the operator confirms the cluster", () => {
    const mainnet = [...init, "--cluster", "mainnet", "--rpc", "https://r.example"];
    expect(() => parseInitServerArgs(mainnet)).toThrow(/--cluster-confirm mainnet/);
    expect(() => parseInitServerArgs([...mainnet, "--cluster-confirm", "devnet"])).toThrow(
      /--cluster-confirm mainnet/,
    );
    expect(
      parseInitServerArgs([...mainnet, "--cluster-confirm", "mainnet", "--send"]),
    ).toMatchObject({ cluster: "mainnet", network: "solana:mainnet", local: false, send: true });
  });

  it.each([
    ["no cluster", init],
    ["an unknown cluster", [...init, "--cluster", "testnet"]],
    [
      "a remote RPC for a local validator",
      [...init, "--cluster", "localnet", "--rpc", "http://10.0.0.2:8899"],
    ],
    [
      "an http RPC on devnet",
      [...init, "--cluster", "devnet", "--rpc", "http://api.devnet.solana.com"],
    ],
    ["devnet without an RPC", [...init, "--cluster", "devnet"]],
    ["no admin keypair", ["--mint", MINT, "--fee-recipient", FEE, "--cluster", "localnet"]],
    [
      "a fee recipient that is the mint",
      [
        "--mint",
        MINT,
        "--fee-recipient",
        MINT,
        "--admin-keypair",
        "k.json",
        "--cluster",
        "localnet",
      ],
    ],
    [
      "a mint that is not base58",
      [
        "--mint",
        "0OIl",
        "--fee-recipient",
        FEE,
        "--admin-keypair",
        "k.json",
        "--cluster",
        "localnet",
      ],
    ],
    ["a positional command", ["send", ...init, "--cluster", "localnet"]],
  ])("refuses %s", (_what, argv) => {
    expect(() => parseInitServerArgs(argv)).toThrow();
  });
});

const bind = [
  "--mint",
  MINT,
  "--chain-address",
  COMMUNITY,
  "--admin",
  ADMIN,
  "--first-paid-epoch",
  "1",
  "--threshold-volume-lamports",
  "100000000000",
  "--basis",
  "cumulative",
  "--reward-bps-of-volume",
  "100",
  "--auto-publish",
  "on",
  "--effective-from-index",
  "1",
  "--cluster",
  "localnet",
];

describe("parseBindArgs", () => {
  it("reads every value it writes, and is a dry run unless --apply is given", () => {
    expect(parseBindArgs(bind)).toEqual({
      apply: false,
      mint: MINT,
      chainAddress: COMMUNITY,
      admin: ADMIN,
      firstPaidEpoch: 1,
      policy: {
        effectiveFromIndex: 1,
        thresholdVolumeLamports: 100_000_000_000n,
        basis: "cumulative",
        rewardBpsOfVolume: 100,
        autoPublish: true,
      },
      cluster: "localnet",
      network: "solana:devnet",
      local: true,
      rpcUrl: "http://127.0.0.1:8899",
      wsUrl: "ws://127.0.0.1:8900",
    });
    expect(parseBindArgs([...bind, "--apply"]).apply).toBe(true);
  });

  it("takes per_epoch, auto_publish off and a policy from a later index", () => {
    const args = parseBindArgs(
      bind.map((v, i, all) =>
        all[i - 1] === "--basis"
          ? "per_epoch"
          : all[i - 1] === "--auto-publish"
            ? "off"
            : all[i - 1] === "--effective-from-index"
              ? "4"
              : v,
      ),
    );
    expect(args.policy).toMatchObject({
      basis: "per_epoch",
      autoPublish: false,
      effectiveFromIndex: 4,
    });
  });

  const without = (flag: string) => {
    const i = bind.indexOf(flag);
    return [...bind.slice(0, i), ...bind.slice(i + 2)];
  };
  const swap = (flag: string, value: string) =>
    bind.map((v, i, all) => (all[i - 1] === flag ? value : v));

  it.each([
    ["no chain address", without("--chain-address")],
    ["no admin", without("--admin")],
    ["no first paid epoch", without("--first-paid-epoch")],
    ["a zero first paid epoch", swap("--first-paid-epoch", "0")],
    ["no threshold", without("--threshold-volume-lamports")],
    ["a zero threshold", swap("--threshold-volume-lamports", "0")],
    [
      "a threshold past the signed 64-bit column",
      swap("--threshold-volume-lamports", "9223372036854775808"),
    ],
    ["an unknown basis", swap("--basis", "pooled")],
    ["no reward share", without("--reward-bps-of-volume")],
    ["a reward share above 10000", swap("--reward-bps-of-volume", "10001")],
    ["a zero reward share", swap("--reward-bps-of-volume", "0")],
    ["an auto_publish that is not on or off", swap("--auto-publish", "yes")],
    ["no auto_publish", without("--auto-publish")],
    ["a zero effective index", swap("--effective-from-index", "0")],
    ["mainnet without the confirmation", swap("--cluster", "mainnet")],
  ])("refuses %s", (_what, argv) => {
    expect(() => parseBindArgs(argv)).toThrow();
  });
});

describe("readServerKeypair", () => {
  const dir = mkdtempSync(join(tmpdir(), "hyphae-keypair-"));
  const file = (name: string, content: string) => {
    const path = join(dir, name);
    writeFileSync(path, content);
    return path;
  };

  it("reads a solana-keygen file and gives its address", async () => {
    // The 32-byte seed 0..31 followed by its public key, as solana-keygen writes it.
    const seed = Uint8Array.from({ length: 32 }, (_, i) => i);
    const expected = await createKeyPairSignerFromPrivateKeyBytes(seed, true);
    const publicKey = new Uint8Array(
      await crypto.subtle.exportKey("raw", expected.keyPair.publicKey),
    );
    const path = file("ok.json", JSON.stringify([...seed, ...publicKey]));
    expect((await readServerKeypair(path)).address).toBe(expected.address);
  });

  it("never echoes the file's content in its errors", async () => {
    const secret = Array.from({ length: 63 }, (_, i) => 200 + (i % 50));
    const short = file("short.json", JSON.stringify(secret));
    const garbage = file("garbage.json", "secret-bytes-here");
    for (const path of [short, garbage]) {
      const error = (await readServerKeypair(path).then(
        () => null,
        (e: unknown) => e,
      )) as Error;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).not.toMatch(/secret-bytes-here|249|248/);
      expect(error.message).toMatch(/64 bytes/);
    }
    const missing = (await readServerKeypair(join(dir, "missing.json")).then(
      () => null,
      (e: unknown) => e,
    )) as Error;
    expect(missing.message).toMatch(/cannot read/);
  });
});

describe("databaseLabel", () => {
  it("names the host and database without the credentials", () => {
    expect(databaseLabel("postgres://user:hunter2@db.example:5432/hyphae?sslmode=require")).toBe(
      "db.example:5432/hyphae",
    );
    expect(databaseLabel("not a url")).toBe("an unparsable URL");
  });
});
