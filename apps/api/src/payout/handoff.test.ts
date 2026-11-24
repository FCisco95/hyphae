import { HYPHAE_PROGRAM_ID } from "@hyphae/core";
import {
  type Address,
  address,
  blockhash,
  generateKeyPairSigner,
  getBase58Decoder,
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  type KeyPairSigner,
  signBytes,
  type TransactionPartialSigner,
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import { publishAccounts, solanaChain } from "./chain.js";
import { initInstructions } from "./community-init.js";
import {
  handoffSigner,
  messageBytesFor,
  messageHash,
  publishMessageBytes,
  SignatureRequired,
  sameBytes,
  verifiedSignature,
} from "./handoff.js";
import type { PublishArgs } from "./publish.js";
import { randomAddress } from "./ready-seed.js";
import { FAKE_BLOCKHASH, FAKE_LAST_VALID, fakeRpc } from "./rpc-fake.js";

class Stop extends Error {}

// The CLI's signer, stopped at the moment it is asked to sign: it records the message bytes the
// chain code compiled (what a Ledger is shown), then refuses, so nothing is sent.
function capturing(kp: KeyPairSigner) {
  const seen: Uint8Array[] = [];
  const signer: TransactionPartialSigner = {
    address: kp.address,
    async signTransactions(txs) {
      for (const tx of txs) seen.push(new Uint8Array(tx.messageBytes));
      throw new Stop();
    },
  };
  return { signer, seen };
}

const chainFor = (admin: TransactionPartialSigner, rpc: ReturnType<typeof fakeRpc>) =>
  solanaChain({
    rpcUrl: "https://rpc.test",
    wsUrl: "wss://rpc.test",
    network: "solana:devnet",
    admin,
    rpc: rpc.rpc,
    rpcSubscriptions: rpc.rpcSubscriptions,
  });

const args = (): PublishArgs => ({
  community: randomAddress(),
  index: 7n,
  root: "11".repeat(32),
  auditHash: "22".repeat(32),
  grossLamports: 5_000_000_000n,
  allocatedLamports: 4_850_000_000n,
  feeRecipient: randomAddress(),
});

async function handedOff(work: Promise<unknown>): Promise<SignatureRequired> {
  const error = await work.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(error instanceof SignatureRequired)) throw new Error(`no hand-off: ${String(error)}`);
  return error;
}

describe("the hand-off signer and the CLI signer", () => {
  it("are given the same publish_epoch message, simulated first, for the same plan", async () => {
    const kp = await generateKeyPairSigner();
    const input = args();
    const rpc = fakeRpc();
    const cli = capturing(kp);
    await expect((await chainFor(cli.signer, rpc)).chain.publishEpoch(input)).rejects.toThrow(Stop);
    const handoff = await handedOff(
      (await chainFor(handoffSigner(kp.address), rpc)).chain.publishEpoch(input),
    );
    expect(cli.seen).toHaveLength(1);
    expect(sameBytes(handoff.messageBytes, cli.seen[0] as Uint8Array)).toBe(true);
    // Both were simulated before any signer was asked; neither was sent.
    expect(rpc.seen.simulated).toHaveLength(2);
    expect(rpc.seen.sent).toEqual([]);
    const simulated = getTransactionDecoder().decode(
      getBase64Encoder().encode(rpc.seen.simulated[1] as string),
    );
    expect(sameBytes(new Uint8Array(simulated.messageBytes), handoff.messageBytes)).toBe(true);
    expect(handoff.lifetime).toEqual({
      blockhash: FAKE_BLOCKHASH,
      lastValidBlockHeight: FAKE_LAST_VALID,
    });
  });

  it("names the admin as the only signer and fee payer, and publish_epoch's accounts in order", async () => {
    const kp = await generateKeyPairSigner();
    const input = args();
    const { messageBytes } = await handedOff(
      (await chainFor(handoffSigner(kp.address), fakeRpc())).chain.publishEpoch(input),
    );
    const decoded = getCompiledTransactionMessageDecoder().decode(messageBytes);
    if (decoded.version !== 0) throw new Error("not a v0 message");
    const message = decoded;
    const a = await publishAccounts(HYPHAE_PROGRAM_ID, input);
    expect(message.header.numSignerAccounts).toBe(1);
    expect(message.staticAccounts[0]).toBe(kp.address);
    expect(message.instructions).toHaveLength(1);
    const [ix] = message.instructions;
    const keys = (ix?.accountIndices ?? []).map((i: number) => message.staticAccounts[i]);
    expect(message.staticAccounts[ix?.programAddressIndex ?? -1]).toBe(HYPHAE_PROGRAM_ID);
    expect(keys).toEqual([
      kp.address,
      a.community,
      a.vault,
      a.feeRecipient,
      a.epoch,
      "11111111111111111111111111111111",
    ]);
    expect(message.lifetimeToken).toBe(FAKE_BLOCKHASH);
  });

  it("recomputes the same bytes from the plan and the lifetime, and other bytes from any change", async () => {
    const kp = await generateKeyPairSigner();
    const input = args();
    const { messageBytes, lifetime } = await handedOff(
      (await chainFor(handoffSigner(kp.address), fakeRpc())).chain.publishEpoch(input),
    );
    const again = await publishMessageBytes(HYPHAE_PROGRAM_ID, kp.address, input, lifetime);
    expect(sameBytes(again, messageBytes)).toBe(true);
    const other = await generateKeyPairSigner();
    for (const [what, bytes] of [
      ["root", { ...input, root: "33".repeat(32) }],
      ["gross", { ...input, grossLamports: input.grossLamports + 1n }],
      ["allocated", { ...input, allocatedLamports: input.allocatedLamports - 1n }],
      ["index", { ...input, index: 8n }],
      ["fee recipient", { ...input, feeRecipient: randomAddress() }],
    ] as const) {
      const changed = await publishMessageBytes(HYPHAE_PROGRAM_ID, kp.address, bytes, lifetime);
      expect(sameBytes(changed, messageBytes), what).toBe(false);
    }
    expect(
      sameBytes(
        await publishMessageBytes(HYPHAE_PROGRAM_ID, other.address, input, lifetime),
        messageBytes,
      ),
    ).toBe(false);
    expect(
      sameBytes(
        await publishMessageBytes(HYPHAE_PROGRAM_ID, kp.address, input, {
          ...lifetime,
          blockhash: blockhash("EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"),
        }),
        messageBytes,
      ),
    ).toBe(false);
  });

  it("never hands off a transaction the simulation refuses", async () => {
    const kp = await generateKeyPairSigner();
    const rpc = fakeRpc({ simulationError: { InstructionError: [0, { Custom: 6000 }] } });
    const out = await (await chainFor(handoffSigner(kp.address), rpc)).chain
      .publishEpoch(args())
      .catch((e: unknown) => e);
    expect(out).not.toBeInstanceOf(SignatureRequired);
    expect(String(out)).toMatch(/simulation failed/);
  });

  it("hands off the same initialize_community message the CLI signer is asked to sign", async () => {
    const kp = await generateKeyPairSigner();
    const target = {
      programId: HYPHAE_PROGRAM_ID as Address,
      admin: kp.address,
      mint: randomAddress(),
      feeRecipient: randomAddress(),
    };
    const rpc = fakeRpc();
    const cli = capturing(kp);
    await expect(
      (await chainFor(cli.signer, rpc)).send(await initInstructions(target, cli.signer)),
    ).rejects.toThrow(Stop);
    const handoffKey = handoffSigner(kp.address);
    const handoff = await handedOff(
      (await chainFor(handoffKey, rpc)).send(await initInstructions(target, handoffKey)),
    );
    expect(sameBytes(handoff.messageBytes, cli.seen[0] as Uint8Array)).toBe(true);
    const again = await messageBytesFor(kp.address, handoff.lifetime, (payer) =>
      initInstructions(target, payer),
    );
    expect(sameBytes(again, handoff.messageBytes)).toBe(true);
    // The admin named in the target must be the one signing.
    await expect(initInstructions(target, handoffSigner(randomAddress()))).rejects.toThrow(
      /not the named admin/,
    );
  });
});

describe("verifiedSignature", () => {
  it("takes the wallet's signature over exactly these bytes, and nothing else", async () => {
    const kp = await generateKeyPairSigner();
    const other = await generateKeyPairSigner();
    const { messageBytes } = await handedOff(
      (await chainFor(handoffSigner(kp.address), fakeRpc())).chain.publishEpoch(args()),
    );
    const b58 = getBase58Decoder();
    const good = b58.decode(await signBytes(kp.keyPair.privateKey, messageBytes));
    expect(await verifiedSignature(messageBytes, kp.address, good)).not.toBeNull();
    // Another key, other bytes (a wallet that added an instruction), and malformed input.
    const byOther = b58.decode(await signBytes(other.keyPair.privateKey, messageBytes));
    expect(await verifiedSignature(messageBytes, kp.address, byOther)).toBeNull();
    const altered = Uint8Array.from(messageBytes);
    altered[altered.length - 1] = (altered[altered.length - 1] as number) ^ 1;
    const overAltered = b58.decode(await signBytes(kp.keyPair.privateKey, altered));
    expect(await verifiedSignature(messageBytes, kp.address, overAltered)).toBeNull();
    expect(await verifiedSignature(messageBytes, kp.address, "not-base58-0OIl")).toBeNull();
    expect(await verifiedSignature(messageBytes, kp.address, good.slice(0, -2))).toBeNull();
    expect(await verifiedSignature(messageBytes, address(other.address), good)).toBeNull();
  });

  it("names the message by the hash a blind-signing Ledger shows", () => {
    expect(messageHash(new Uint8Array([1, 2, 3]))).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
  });
});
