import { describe, expect, it } from "vitest";
import { settle, type WalletScore } from "./settle.js";

const ws = (wallet: string, scoreSum: number, stakeUnits = 0n): WalletScore => ({
  wallet,
  scoreSum,
  stakeUnits,
});

describe("settle", () => {
  it("splits the pot proportionally to score when stakeWeight is none", () => {
    const out = settle([ws("a", 30), ws("b", 70)], {
      stakeWeight: "none",
      potLamports: 1_000_000n,
    });
    expect(out.find((r) => r.wallet === "a")?.amountLamports).toBe(300_000n);
    expect(out.find((r) => r.wallet === "b")?.amountLamports).toBe(700_000n);
  });

  it("never pays out more than the pot (rounding goes to the vault)", () => {
    const out = settle([ws("a", 1), ws("b", 1), ws("c", 1)], {
      stakeWeight: "none",
      potLamports: 100n,
    });
    const total = out.reduce((s, r) => s + r.amountLamports, 0n);
    expect(total).toBeLessThanOrEqual(100n);
    expect(total).toBe(99n);
  });

  it("sqrt stake weighting is concave", () => {
    const out = settle([ws("a", 10, 100n), ws("b", 10, 10_000n)], {
      stakeWeight: "sqrt",
      potLamports: 1_100n,
    });
    // sqrt(100)=10, sqrt(10000)=100 → 1:10, not 1:100
    expect(out.find((r) => r.wallet === "a")?.amountLamports).toBe(100n);
    expect(out.find((r) => r.wallet === "b")?.amountLamports).toBe(1_000n);
  });

  it("applies the per-wallet cap and does not redistribute the remainder", () => {
    const out = settle([ws("a", 90), ws("b", 10)], {
      stakeWeight: "none",
      potLamports: 1_000n,
      capLamports: 500n,
    });
    expect(out.find((r) => r.wallet === "a")?.amountLamports).toBe(500n);
    expect(out.find((r) => r.wallet === "b")?.amountLamports).toBe(100n);
  });

  it("drops zero-score wallets", () => {
    const out = settle([ws("a", 0), ws("b", 5)], { stakeWeight: "none", potLamports: 10n });
    expect(out.map((r) => r.wallet)).toEqual(["b"]);
  });
});
