import type { ContributionRowV1, PayoutV1, SelectedV1 } from "@hyphae/core";

// "2026-10-02T00:00:00.000000Z" -> "2026-10-02 00:00 UTC". Every time on the site is UTC.
export const utc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
// A boundary that decides something: shown to the minute only when that is exact.
export const utcExact = (iso: string) =>
  iso.slice(16) === ":00.000000Z" ? utc(iso) : `${iso.slice(0, 10)} ${iso.slice(11, 26)} UTC`;

export const shortWallet = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;
export const shortId = (id: string) => id.slice(0, 8);

const FLAG: Record<string, string> = {
  off_topic: "off-topic",
  spam: "spam",
  guideline_breach: "a guideline breach",
};

type Credit = Pick<SelectedV1, "raw_quality" | "credited_quality" | "credit_rule" | "flags">;

// "Raw 84, credited 0: off-topic is a hard zero." The why behind every score.
export function creditSentence(d: Credit): string {
  const head = `Raw ${d.raw_quality}, credited ${d.credited_quality}`;
  switch (d.credit_rule) {
    case "none":
      return `${head}.`;
    case "hard_zero": {
      const flag = d.flags.find((f) => f in FLAG);
      return `${head}: ${flag ? FLAG[flag] : "a hard flag"} is a hard zero.`;
    }
    case "ai_cap_mild":
      return `${head}: text that reads as AI-written is capped at 79.`;
    case "ai_cap_strong":
      return `${head}: strongly AI-patterned text is capped at 40, under the floor of 60.`;
    case "below_floor":
      return `${head}: under the floor of 60.`;
  }
}

type Reason = Extract<PayoutV1, { reasons: unknown }>["reasons"][number];

const list = (items: string[]) =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

const TO_DO: [Reason, string][] = [
  ["no_verified_wallet", "link a wallet by signing"],
  ["no_rules_test", "pass the rules test"],
  ["no_points", "earn points"],
];
const MISSED: [Reason, string][] = [
  ["no_verified_wallet", "no wallet was signed by the close"],
  ["no_rules_test", "the rules test was not passed by the close"],
  ["no_points", "no points"],
];

// Whether a member can be paid, as the payout gate sees it as of the read. The hold is read only
// after the close, so before it the hold is never presented as met.
export function payoutSentence(p: PayoutV1, closed: boolean): string {
  if (!("reasons" in p)) {
    return p.status === "unpaid_epoch"
      ? "This epoch has no payout."
      : "See the epoch's settlement for this payout.";
  }
  const has = (r: Reason) => p.reasons.includes(r);
  const named = (phrases: [Reason, string][]) => phrases.filter(([r]) => has(r)).map(([, s]) => s);
  if (!closed) {
    if (p.status === "not_payable") return `Not payable yet: ${list(named(TO_DO))}.`;
    return p.hold === "at_close"
      ? "Wallet and rules test done. The hold is checked after the close."
      : "Wallet and rules test done.";
  }
  if (p.status === "payable") {
    return p.hold === "holder"
      ? "Payable: wallet, rules test and hold confirmed."
      : "Payable: wallet and rules test confirmed.";
  }
  if (p.status === "held") return "Waiting for the hold check.";
  if (has("below_hold"))
    return "Not payable: the wallet held less than the minimum after the close.";
  return `Not payable: ${named(MISSED).join("; ")}.`;
}

export const STATE: Record<ContributionRowV1["state"], string> = {
  counted: "Scored.",
  pending: "Not scored yet.",
  pending_at_close: "Not scored before the epoch closed; it earns nothing in this epoch.",
  pending_reconciliation:
    "A model call was still unresolved at the close; it earns nothing in this epoch.",
  excluded: "Scored after the close; shown for the record, it earns nothing.",
};

export const multiplier = (bps: number) => `${bps / 10000}×`;

// Exact lamports as SOL, never rounded: "304603658" -> "0.304603658 SOL".
export function sol(lamports: string): string {
  const v = BigInt(lamports);
  const whole = v / 1_000_000_000n;
  const fraction = (v % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} SOL`;
}

export const networkName = (n: "solana:devnet" | "solana:mainnet") =>
  n === "solana:devnet" ? "devnet" : "mainnet";

export const explorerTx = (signature: string, network: "solana:devnet" | "solana:mainnet") =>
  `https://explorer.solana.com/tx/${signature}${network === "solana:devnet" ? "?cluster=devnet" : ""}`;

export const explorerAddress = (account: string, network: "solana:devnet" | "solana:mainnet") =>
  `https://explorer.solana.com/address/${account}${network === "solana:devnet" ? "?cluster=devnet" : ""}`;

// A row's state; a scored one also says whether its member can be paid.
export function rowState(
  r: Pick<ContributionRowV1, "state" | "payout"> & { epoch: { closed: boolean } },
): string {
  if (r.state !== "counted" || !r.payout) return STATE[r.state];
  return `${STATE.counted} ${payoutSentence(r.payout, r.epoch.closed)}`;
}
