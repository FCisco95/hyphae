import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type SolanaModule from "@ledgerhq/hw-app-solana";
import type TransportModule from "@ledgerhq/hw-transport-node-hid-noevents";
import {
  createKeyPairSignerFromBytes,
  getAddressDecoder,
  getPublicKeyFromAddress,
  type SignatureBytes,
  type SignatureDictionary,
  type TransactionPartialSigner,
  type TransactionSigner,
  verifySignature,
} from "@solana/kit";

// The publish signer behind one interface, @solana/kit's TransactionSigner: a keypair file on
// devnet, a Ledger on mainnet (Q1, ruled 2026-09-27). The Ledger's key never leaves the device.

export type SignerSpec = { kind: "file"; path: string } | { kind: "ledger"; path: string };

// The two calls of the Ledger Solana app (@ledgerhq/hw-app-solana) a signer needs.
export interface LedgerSolana {
  getAddress(path: string): Promise<{ address: Uint8Array }>;
  signTransaction(path: string, message: Uint8Array): Promise<{ signature: Uint8Array }>;
}

export async function ledgerSigner(
  app: LedgerSolana,
  path: string,
): Promise<TransactionPartialSigner> {
  const address = getAddressDecoder().decode((await app.getAddress(path)).address);
  const publicKey = await getPublicKeyFromAddress(address);
  return {
    address,
    async signTransactions(transactions) {
      const out: SignatureDictionary[] = [];
      // One at a time: the device shows and confirms each transaction.
      for (const transaction of transactions) {
        const { signature } = await app.signTransaction(
          path,
          new Uint8Array(transaction.messageBytes),
        );
        const bytes = new Uint8Array(signature) as SignatureBytes;
        // A device that signed other bytes, or with another key, is refused here, not on-chain.
        if (!(await verifySignature(publicKey, bytes, transaction.messageBytes))) {
          throw new Error(`signer: the Ledger's signature does not verify for ${address}`);
        }
        out.push({ [address]: bytes });
      }
      return out;
    },
  };
}

// USB through node-hid. Loaded as CommonJS: the packages' ESM builds omit file extensions.
async function openUsbLedger(): Promise<LedgerSolana> {
  const require = createRequire(import.meta.url);
  const Transport: (typeof TransportModule)["default"] =
    require("@ledgerhq/hw-transport-node-hid-noevents").default;
  const App: (typeof SolanaModule)["default"] = require("@ledgerhq/hw-app-solana").default;
  let transport: Awaited<ReturnType<typeof Transport.create>>;
  try {
    transport = await Transport.create();
  } catch (cause) {
    throw new Error(
      "signer: no Ledger over USB. node-hid needs its native build (pnpm approve-builds), and the device must be unlocked with the Solana app open",
      { cause },
    );
  }
  const app = new App(transport);
  return {
    getAddress: (path) => app.getAddress(path),
    signTransaction: (path, message) => app.signTransaction(path, Buffer.from(message)),
  };
}

export async function openSigner(
  spec: SignerSpec,
  network: "solana:devnet" | "solana:mainnet",
  openLedger: () => Promise<LedgerSolana> = openUsbLedger,
): Promise<TransactionSigner> {
  if (network === "solana:mainnet" && spec.kind !== "ledger") {
    throw new Error("signer: mainnet publishes only from a hardware key (--signer ledger)");
  }
  if (spec.kind === "ledger") return ledgerSigner(await openLedger(), spec.path);
  const bytes = Uint8Array.from(JSON.parse(readFileSync(spec.path, "utf8")) as number[]);
  return createKeyPairSignerFromBytes(bytes);
}
