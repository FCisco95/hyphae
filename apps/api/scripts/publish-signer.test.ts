import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  address,
  appendTransactionMessageInstructions,
  type Blockhash,
  createKeyPairFromPrivateKeyBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  createTransactionMessage,
  getAddressEncoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signBytes,
  signTransactionMessageWithSigners,
  verifySignature,
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import { type LedgerSolana, ledgerSigner, openSigner, usbLedger } from "./publish-signer.js";

const SEED = new Uint8Array(32).fill(7);
const PATH = "44'/501'/0'";

// A device that holds SEED's key and signs whatever bytes it is given, recording them.
async function fakeLedger(tamper = false) {
  const keys = await createKeyPairFromPrivateKeyBytes(SEED);
  const { address: at } = await createKeyPairSignerFromPrivateKeyBytes(SEED);
  const seen: Uint8Array[] = [];
  const app: LedgerSolana = {
    getAddress: async () => ({ address: new Uint8Array(getAddressEncoder().encode(at)) }),
    signTransaction: async (_path, message) => {
      seen.push(message);
      const signed = tamper ? Uint8Array.of(...message, 0) : message;
      return { signature: new Uint8Array(await signBytes(keys.privateKey, signed)) };
    },
  };
  return { app, keys, at, seen };
}

async function signedWith(signer: Awaited<ReturnType<typeof ledgerSigner>>) {
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG" as Blockhash,
          lastValidBlockHeight: 100n,
        },
        m,
      ),
    (m) =>
      appendTransactionMessageInstructions(
        [{ programAddress: address("11111111111111111111111111111111"), data: new Uint8Array(4) }],
        m,
      ),
  );
  return signTransactionMessageWithSigners(message);
}

describe("the Ledger signer", () => {
  it("has the device's address and signs each transaction's exact message bytes on it", async () => {
    const device = await fakeLedger();
    const signer = await ledgerSigner(device.app, PATH);
    expect(signer.address).toBe(device.at);
    const tx = await signedWith(signer);
    expect(device.seen).toEqual([new Uint8Array(tx.messageBytes)]);
    const signature = tx.signatures[device.at];
    if (!signature) throw new Error("unsigned");
    expect(await verifySignature(device.keys.publicKey, signature, tx.messageBytes)).toBe(true);
  });

  it("refuses a device signature that does not verify for the device's own address", async () => {
    const device = await fakeLedger(true);
    const signer = await ledgerSigner(device.app, PATH);
    await expect(signedWith(signer)).rejects.toThrow(/does not verify/);
  });
});

describe("openSigner", () => {
  const keyFile = async () => {
    const { address: at } = await createKeyPairSignerFromPrivateKeyBytes(SEED);
    const path = join(mkdtempSync(join(tmpdir(), "hyphae-signer-")), "admin.json");
    writeFileSync(path, JSON.stringify([...SEED, ...getAddressEncoder().encode(at)]));
    return { path, at };
  };

  it("opens a keypair file on devnet", async () => {
    const { path, at } = await keyFile();
    const signer = await openSigner({ kind: "file", path }, "solana:devnet");
    expect(signer.address).toBe(at);
  });

  it("refuses a keypair file on mainnet: mainnet publishes from a hardware key (Q1)", async () => {
    const { path } = await keyFile();
    await expect(openSigner({ kind: "file", path }, "solana:mainnet")).rejects.toThrow(
      /hardware key \(--signer ledger:<derivation path>\)/,
    );
  });

  it("opens the Ledger for mainnet", async () => {
    const device = await fakeLedger();
    const signer = await openSigner({ kind: "ledger", path: PATH }, "solana:mainnet", async () =>
      Promise.resolve(device.app),
    );
    expect(signer.address).toBe(device.at);
  });
});

describe("the Ledger USB transport", () => {
  // The Solana app over a transport it was given, recording which one.
  const made: FakeApp[] = [];
  class FakeApp {
    constructor(readonly transport: unknown) {
      made.push(this);
    }
    getAddress = async () => ({ address: new Uint8Array(32) });
    signTransaction = async () => ({ signature: new Uint8Array(64) });
  }

  // The no-events transport lists devices synchronously, which trips create()'s own
  // not-yet-initialized variables whether or not a device is connected.
  it("opens the first connected device directly, never through create()", async () => {
    const device = { kind: "device" };
    const opened: string[] = [];
    const Transport = {
      create: async () => {
        throw new ReferenceError("Cannot access 'sub' before initialization");
      },
      open: async (path: string) => {
        opened.push(path);
        return device;
      },
    };
    await usbLedger(Transport, FakeApp);
    expect(opened).toEqual([""]);
    expect(made.at(-1)?.transport).toBe(device);
  });

  it("says what to do when no device is connected", async () => {
    const Transport = {
      open: async () => {
        throw new Error("NoDevice");
      },
    };
    await expect(usbLedger(Transport, FakeApp)).rejects.toThrow(
      /Connect the Ledger, unlock it and open the Solana app/,
    );
  });
});
