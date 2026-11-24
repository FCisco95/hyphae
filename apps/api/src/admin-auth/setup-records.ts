// Communities the operator page may initialize on-chain, and with what. A community that is not
// initialized has no on-chain admin to sign in with, so the record names it: the wallet that will
// be its admin and the permanent fee recipient. The record is this file, like payout/holds.ts:
// adding or changing one is a reviewed commit, never a setting. Empty: the page initializes
// nothing until Cisco records a community here.

export interface SetupRecord {
  mint: string;
  network: "solana:mainnet" | "solana:devnet";
  // The admin key the community account will be derived from and signed by.
  admin: string;
  // The fee recipient initialize_community fixes forever.
  feeRecipient: string;
}

export const SETUP_RECORDS: readonly SetupRecord[] = [];

export function setupRecord(
  records: readonly SetupRecord[],
  mint: string,
  network: SetupRecord["network"],
): SetupRecord | null {
  return records.find((r) => r.mint === mint && r.network === network) ?? null;
}
