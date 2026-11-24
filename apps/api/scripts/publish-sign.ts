// Usage (in apps/api): node --import tsx scripts/publish-sign.ts --network devnet|mainnet \
//   --signer "ledger:44'/501'/2'/0'" --message <base64 from the operator page>
// The operator page's sign-and-paste path for a Ledger the browser cannot reach. It shows what
// the message does, asks the Ledger to sign exactly those bytes, verifies the signature and prints
// it (base58) to paste into the page. No database, no RPC, no send: the API sends it.
import { describeMessage, parseSignArgs, signatureText } from "./publish-sign-cli.js";
import { openSigner } from "./publish-signer.js";

const args = parseSignArgs(process.argv.slice(2));
const signer = await openSigner(args.signer, args.network);
const described = describeMessage(args.messageBytes, signer.address);
if (!described.ok) {
  console.error(`refused: ${described.why}`);
  process.exit(1);
}
console.log(described.lines.join("\n"));
console.log(
  "compare these with the operator page, then approve on the Ledger (blind signing must be on)",
);
if (!("signTransactions" in signer)) throw new Error("signer: not a partial signer");
// The Ledger signer verifies the device's signature over these bytes before returning it.
const [signed] = await signer.signTransactions([
  {
    messageBytes: args.messageBytes,
    signatures: { [signer.address]: null },
  } as unknown as Parameters<typeof signer.signTransactions>[0][number],
]);
const signature = signed?.[signer.address];
if (!signature) throw new Error("signer: no signature came back");
console.log(`signature ${signatureText(signature)}`);
process.exit(0);
