import type { ContributionRowV1, SelectedV1 } from "@hyphae/core";

// "2026-10-02T00:00:00.000000Z" -> "2026-10-02 00:00 UTC". Every time on the site is UTC.
export const utc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

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

export const STATE: Record<ContributionRowV1["state"], string> = {
  counted: "Counted.",
  pending: "Not scored yet.",
  pending_at_close: "Not scored before the epoch closed; it earns nothing in this epoch.",
  pending_reconciliation:
    "A model call was still unresolved at the close; it earns nothing in this epoch.",
  excluded: "Scored after the close; shown for the record, it earns nothing.",
};

export const multiplier = (bps: number) => `${bps / 10000}×`;
