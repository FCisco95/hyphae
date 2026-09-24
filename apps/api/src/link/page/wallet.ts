import { getWallets } from "@wallet-standard/app";

type Account = { address: string; chains: readonly string[] };
export type MessageWallet = {
  name: string;
  icon: string;
  accounts: readonly Account[];
  features: Record<string, unknown>;
};
type Connect = { connect(): Promise<{ accounts: readonly Account[] }> };
type SignMessage = {
  signMessage(
    ...inputs: { account: Account; message: Uint8Array }[]
  ): Promise<readonly { signature: Uint8Array; signedMessage: Uint8Array }[]>;
};

// The only two wallet features Hyphae ever touches.
const CONNECT = "standard:connect";
const MESSAGE = "solana:signMessage";

// Wallets can register after first paint.
export const onWalletRegister = (fn: () => void) => getWallets().on("register", fn);

export function messageWallets(): MessageWallet[] {
  return (getWallets().get() as unknown as MessageWallet[]).filter(
    (w) => CONNECT in w.features && MESSAGE in w.features,
  );
}

export async function connect(w: MessageWallet): Promise<Account> {
  const { accounts } = await (w.features[CONNECT] as Connect).connect();
  const account = accounts[0];
  if (!account) throw new Error("no account");
  return account;
}

// Refuses a wallet that signed anything other than the exact bytes shown.
export async function sign(w: MessageWallet, account: Account, message: string): Promise<string> {
  const bytes = new TextEncoder().encode(message);
  const [out] = await (w.features[MESSAGE] as SignMessage).signMessage({
    account,
    message: bytes,
  });
  if (
    !out ||
    out.signedMessage.length !== bytes.length ||
    !out.signedMessage.every((b, i) => b === bytes[i])
  ) {
    throw new Error("wallet altered the message");
  }
  let bin = "";
  for (const b of out.signature) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
