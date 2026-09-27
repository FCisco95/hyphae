import { getBase58Decoder } from "@solana/kit";
import { getWallets } from "@wallet-standard/app";

// The two wallet-standard features the claim page touches: connect, and sign-and-send. The standard
// does not require a wallet to simulate before approval, and the page has no RPC to simulate with.
// A claim is read fresh right before each signing and the program refuses a bad claim atomically,
// so a failed claim costs the claimant only its fee.

export type Account = { address: string; chains: readonly string[] };
export type ClaimWallet = {
  name: string;
  icon: string;
  accounts: readonly Account[];
  features: Record<string, unknown>;
};
type Connect = { connect(): Promise<{ accounts: readonly Account[] }> };
type SignAndSend = {
  signAndSendTransaction(
    ...inputs: { account: Account; chain: string; transaction: Uint8Array }[]
  ): Promise<readonly { signature: Uint8Array }[]>;
};

const CONNECT = "standard:connect";
const SEND = "solana:signAndSendTransaction";

// Wallets can register after first paint.
export const onWalletRegister = (fn: () => void) => getWallets().on("register", fn);

export function claimWallets(): ClaimWallet[] {
  return (getWallets().get() as unknown as ClaimWallet[]).filter(
    (w) => CONNECT in w.features && SEND in w.features,
  );
}

export async function connect(w: ClaimWallet): Promise<Account> {
  const { accounts } = await (w.features[CONNECT] as Connect).connect();
  const account = accounts[0];
  if (!account) throw new Error("the wallet shared no account");
  return account;
}

export async function signAndSend(
  w: ClaimWallet,
  account: Account,
  chain: string,
  transaction: Uint8Array,
): Promise<string> {
  const [out] = await (w.features[SEND] as SignAndSend).signAndSendTransaction({
    account,
    chain,
    transaction,
  });
  if (!out) throw new Error("the wallet returned no signature");
  return getBase58Decoder().decode(out.signature);
}
