import { HYPHAE_PROGRAM_ID } from "@hyphae/core";
import {
  type Address,
  address,
  blockhash,
  compileTransaction,
  createNoopSigner,
  getBase64Decoder,
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import { publishInstructions, sendMessage } from "../src/payout/chain.js";
import { initInstructions } from "../src/payout/community-init.js";
import { randomAddress } from "../src/payout/ready-seed.js";
import { describeMessage, parseSignArgs } from "./publish-sign-cli.js";

const lifetime = {
  blockhash: blockhash("4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY"),
  lastValidBlockHeight: 100n,
};
const args = {
  community: randomAddress(),
  index: 9n,
  root: "ab".repeat(32),
  auditHash: "cd".repeat(32),
  grossLamports: 3_000_000_000n,
  allocatedLamports: 2_910_000_000n,
  feeRecipient: randomAddress(),
};

async function publishMessage(admin: string, extra: Parameters<typeof sendMessage>[2] = []) {
  const payer = createNoopSigner(address(admin));
  const ixs = [...(await publishInstructions(HYPHAE_PROGRAM_ID, payer, args)), ...extra];
  return new Uint8Array(compileTransaction(sendMessage(payer, lifetime, ixs)).messageBytes);
}

describe("describeMessage", () => {
  it("spells out a publish_epoch the page built, for its admin", async () => {
    const admin = randomAddress();
    const out = describeMessage(await publishMessage(admin), admin);
    if (!out.ok) throw new Error(out.why);
    const text = out.lines.join("\n");
    expect(text).toContain("publish_epoch");
    expect(text).toContain("epoch index 9");
    expect(text).toContain(`root ${"ab".repeat(32)}`);
    expect(text).toContain(`audit hash ${"cd".repeat(32)}`);
    expect(text).toContain("gross 3000000000 lamports, allocated 2910000000 lamports");
    expect(text).toContain(`fee recipient ${args.feeRecipient}`);
    expect(text).toContain(`community ${args.community}`);
    expect(text).toMatch(/message hash [1-9A-HJ-NP-Za-km-z]{43,44}/);
  });

  it("spells out an initialize_community and its permanent fee recipient", async () => {
    const admin = randomAddress();
    const target = {
      programId: HYPHAE_PROGRAM_ID as Address,
      admin,
      mint: randomAddress(),
      feeRecipient: randomAddress(),
    };
    const payer = createNoopSigner(address(admin));
    const bytes = new Uint8Array(
      compileTransaction(sendMessage(payer, lifetime, await initInstructions(target, payer)))
        .messageBytes,
    );
    const out = describeMessage(bytes, admin);
    if (!out.ok) throw new Error(out.why);
    expect(out.lines.join("\n")).toContain(`fee recipient ${target.feeRecipient} (permanent)`);
    expect(out.lines.join("\n")).toContain(`mint ${target.mint}`);
  });

  it("refuses another signer, an extra instruction, another program and garbage", async () => {
    const admin = randomAddress();
    const message = await publishMessage(admin);
    expect(describeMessage(message, randomAddress())).toMatchObject({ ok: false });
    const memo = {
      programAddress: address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: new Uint8Array([1]),
    };
    expect(describeMessage(await publishMessage(admin, [memo]), admin)).toMatchObject({
      ok: false,
      why: "the message is not one instruction",
    });
    expect(describeMessage(message, admin, randomAddress())).toMatchObject({ ok: false });
    expect(describeMessage(new Uint8Array([1, 2, 3]), admin)).toMatchObject({ ok: false });
  });
});

describe("parseSignArgs", () => {
  it("takes base64 and refuses a file signer on mainnet", async () => {
    const message = getBase64Decoder().decode(await publishMessage(randomAddress()));
    expect(
      parseSignArgs(["--network", "devnet", "--signer", "file:/k.json", "--message", message])
        .messageBytes.length,
    ).toBeGreaterThan(100);
    expect(() =>
      parseSignArgs(["--network", "mainnet", "--signer", "file:/k.json", "--message", message]),
    ).toThrow(/hardware key/);
    expect(() =>
      parseSignArgs([
        "--network",
        "devnet",
        "--signer",
        "file:/k.json",
        "--message",
        "not base64!",
      ]),
    ).toThrow(/base64/);
  });
});
