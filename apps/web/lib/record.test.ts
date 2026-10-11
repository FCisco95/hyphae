import { describe, expect, it } from "vitest";
import {
  averageScore,
  payoutView,
  recordDescription,
  tallySentence,
  walletPath,
} from "./record.js";

const W = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const TX = `4${"C".repeat(86)}`;
const allocated = (payment: object) => ({
  status: "allocated" as const,
  network: "solana:mainnet" as const,
  amount_lamports: "121250000",
  payment: payment as { status: "claimable" },
});

describe("walletPath", () => {
  it("is the wallet's record page", () => {
    expect(walletPath(W)).toBe(`/wallet/${W}`);
  });
});

describe("tallySentence", () => {
  it("counts contributions, then those scored and credited", () => {
    expect(tallySentence({ contributions: 3, counted: 2, credited: 1 })).toBe(
      "3 contributions: 2 scored, 1 credited.",
    );
    expect(tallySentence({ contributions: 1, counted: 0, credited: 0 })).toBe(
      "1 contribution: none scored yet.",
    );
  });
});

describe("averageScore", () => {
  it("shows the average as served, and a dash without a scored contribution", () => {
    expect(averageScore(51.67)).toBe("51.67");
    expect(averageScore(85)).toBe("85");
    expect(averageScore(null)).toBe("—");
  });
});

describe("payoutView", () => {
  it("is paid only with the claim transaction", () => {
    expect(
      payoutView({ status: "closed", payout: allocated({ status: "paid", claim_tx: TX }) }),
    ).toEqual({ kind: "paid", amount: "0.12125 SOL", claimTx: TX, network: "solana:mainnet" });
    expect(payoutView({ status: "closed", payout: allocated({ status: "claimable" }) })).toEqual({
      kind: "claimable",
      amount: "0.12125 SOL",
    });
  });

  it("keeps the allocated amount when the payment can't be confirmed, with the reason", () => {
    expect(
      payoutView({
        status: "closed",
        payout: allocated({ status: "unavailable", reason: "chain_unavailable" }),
      }),
    ).toEqual({ kind: "unconfirmed", amount: "0.12125 SOL", reason: "chain_unavailable" });
  });

  it("says why there is no payout", () => {
    const none = (reason: string, status: "open" | "closing" | "closed" = "closed") =>
      payoutView({ status, payout: { status: "unavailable", reason } });
    expect(none("no_allocation")).toEqual({
      kind: "none",
      text: "No allocation for this wallet in this epoch.",
    });
    for (const status of ["open", "closing"] as const) {
      expect(none("no_settlement", status)).toEqual({
        kind: "none",
        text: "No payout before the epoch closes and is published.",
      });
    }
    expect(none("no_settlement")).toEqual({ kind: "unavailable", reason: "no_settlement" });
    expect(none("before_first_paid_epoch")).toEqual({
      kind: "unavailable",
      reason: "before_first_paid_epoch",
    });
  });
});

describe("recordDescription", () => {
  it("summarizes a record, and says plainly when there is none or it can't be read", () => {
    const totals = {
      communities: 2,
      epochs: 3,
      contributions: 5,
      counted: 4,
      credited: 3,
      average_credited_quality: 61.25,
      point_units: "32500000000",
      points: "325",
    };
    expect(recordDescription({ ok: true, data: { totals } })).toBe(
      "3 epochs in 2 communities. 5 contributions: 4 scored, 3 credited. 325 exact points.",
    );
    expect(
      recordDescription({
        ok: true,
        data: { totals: { ...totals, communities: 1, epochs: 1 } },
      }),
    ).toBe("1 epoch in 1 community. 5 contributions: 4 scored, 3 credited. 325 exact points.");
    expect(recordDescription({ ok: false, reason: "not_found" })).toBe(
      "No public record for this wallet.",
    );
    expect(recordDescription({ ok: false, reason: "unavailable" })).toBe(
      "This record can't be read right now.",
    );
  });
});
