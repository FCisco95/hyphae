import type { WalletRecordEpochV1, WalletRecordV1 } from "@hyphae/core";
import type { Result } from "./api.js";
import { sol } from "./format.js";

// A wallet's public record in words. Every number is the API's; a payout is paid only with the
// claim transaction the API read from the chain.

export const walletPath = (wallet: string) => `/wallet/${encodeURIComponent(wallet)}`;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Tally = Pick<WalletRecordEpochV1["totals"], "contributions" | "counted" | "credited">;

// "3 contributions: 2 scored, 1 credited."
export function tallySentence(t: Tally): string {
  const head = count(t.contributions, "contribution", "contributions");
  return t.counted === 0
    ? `${head}: none scored yet.`
    : `${head}: ${t.counted} scored, ${t.credited} credited.`;
}

export const averageScore = (average: number | null) => (average === null ? "—" : String(average));

type Network = "solana:devnet" | "solana:mainnet";

export type PayoutView =
  | { kind: "paid"; amount: string; claimTx: string; network: Network }
  | { kind: "claimable"; amount: string }
  | { kind: "unconfirmed"; amount: string; reason: string }
  | { kind: "none"; text: string }
  | { kind: "unavailable"; reason: string };

export function payoutView(e: Pick<WalletRecordEpochV1, "status" | "payout">): PayoutView {
  const p = e.payout;
  if (p.status === "allocated") {
    const amount = sol(p.amount_lamports);
    if (p.payment.status === "paid") {
      return { kind: "paid", amount, claimTx: p.payment.claim_tx, network: p.network };
    }
    if (p.payment.status === "claimable") return { kind: "claimable", amount };
    return { kind: "unconfirmed", amount, reason: p.payment.reason };
  }
  if (p.reason === "no_allocation") {
    return { kind: "none", text: "No allocation for this wallet in this epoch." };
  }
  if (p.reason === "no_settlement" && e.status !== "closed") {
    return { kind: "none", text: "No payout before the epoch closes and is published." };
  }
  return { kind: "unavailable", reason: p.reason };
}

// The record in one line, for its page description and link previews.
export function recordDescription(r: Result<Pick<WalletRecordV1, "totals">>): string {
  if (!r.ok) {
    return r.reason === "not_found"
      ? "No public record for this wallet."
      : "This record can't be read right now.";
  }
  const t = r.data.totals;
  return `${count(t.epochs, "epoch", "epochs")} in ${count(t.communities, "community", "communities")}. ${tallySentence(t)} ${t.points} exact points.`;
}
