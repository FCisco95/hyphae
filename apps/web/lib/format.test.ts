import type { PayoutV1 } from "@hyphae/core";
import { describe, expect, it } from "vitest";
import { payoutSentence, rowState } from "./format.js";

type Verdict = Extract<PayoutV1, { reasons: unknown }>;
const v = (status: Verdict["status"], reasons: Verdict["reasons"], hold: Verdict["hold"]) => ({
  status,
  reasons,
  hold,
});

describe("payoutSentence", () => {
  it("before the close: what is done and what is missing, and the hold left to after the close", () => {
    const open = (p: PayoutV1) => payoutSentence(p, false);
    expect(open(v("held", ["hold_pending"], "at_close"))).toBe(
      "Wallet and rules test done. The hold is checked after the close.",
    );
    expect(open(v("payable", [], "not_required"))).toBe("Wallet and rules test done.");
    expect(open(v("not_payable", ["no_verified_wallet"], "at_close"))).toBe(
      "Not payable yet: link a wallet by signing.",
    );
    expect(open(v("not_payable", ["no_rules_test"], "at_close"))).toBe(
      "Not payable yet: pass the rules test.",
    );
    expect(open(v("not_payable", ["no_verified_wallet", "no_rules_test"], "at_close"))).toBe(
      "Not payable yet: link a wallet by signing and pass the rules test.",
    );
    expect(open(v("not_payable", ["no_points"], "at_close"))).toBe("Not payable yet: earn points.");
    expect(
      open(v("not_payable", ["no_points", "no_verified_wallet", "no_rules_test"], "at_close")),
    ).toBe("Not payable yet: link a wallet by signing, pass the rules test and earn points.");
  });

  it("never says the hold is met before the close", () => {
    for (const p of [
      v("held", ["hold_pending"], "at_close"),
      v("not_payable", ["no_rules_test"], "at_close"),
    ]) {
      expect(payoutSentence(p, false)).not.toMatch(/payable:|confirmed|holds? enough/i);
    }
  });

  it("after the close: the gate's result, including a pending hold check", () => {
    const closed = (p: PayoutV1) => payoutSentence(p, true);
    expect(closed(v("payable", [], "holder"))).toBe(
      "Payable: wallet, rules test and hold confirmed.",
    );
    expect(closed(v("payable", [], "not_required"))).toBe(
      "Payable: wallet and rules test confirmed.",
    );
    expect(closed(v("held", ["hold_pending"], "pending"))).toBe("Waiting for the hold check.");
    expect(closed(v("not_payable", ["below_hold"], "below"))).toBe(
      "Not payable: the wallet held less than the minimum after the close.",
    );
    expect(closed(v("not_payable", ["no_verified_wallet"], "not_checked"))).toBe(
      "Not payable: no wallet was signed by the close.",
    );
    expect(closed(v("not_payable", ["no_points", "no_rules_test"], "not_checked"))).toBe(
      "Not payable: the rules test was not passed by the close; no points.",
    );
  });

  it("defers to the epoch when it pays no one or is published", () => {
    for (const closed of [false, true]) {
      expect(payoutSentence({ status: "unpaid_epoch" }, closed)).toBe("This epoch has no payout.");
    }
    expect(payoutSentence({ status: "published" }, true)).toBe(
      "See the epoch's settlement for this payout.",
    );
  });
});

describe("rowState", () => {
  const row = {
    state: "counted" as const,
    epoch: { closed: false },
    payout: v("not_payable", ["no_verified_wallet"], "at_close"),
  };

  it("a scored row says whether its member can be paid, never just Counted", () => {
    expect(rowState(row)).toBe("Scored. Not payable yet: link a wallet by signing.");
  });

  it("an api without payout status says only that the row is scored", () => {
    expect(rowState({ ...row, payout: undefined })).toBe("Scored.");
  });

  it("a row that is not scored keeps its state", () => {
    expect(rowState({ ...row, state: "pending" })).toBe("Not scored yet.");
  });
});
