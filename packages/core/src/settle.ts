export type StakeWeight = "none" | "sqrt";

export interface WalletScore {
  wallet: string;
  scoreSum: number; // sum of 0–100 scores this epoch, after timing multipliers
  stakeUnits: bigint; // token balance in base units at epoch close; 0n when stakeWeight is none
}

export interface SettleConfig {
  stakeWeight: StakeWeight;
  potLamports: bigint;
  capLamports?: bigint;
}

export interface SettledRow {
  wallet: string;
  score: bigint; // integer score committed to the leaf
  amountLamports: bigint;
}

// Weights are scaled to integers so the split is exact bigint arithmetic; the
// only rounding is the final floor, which leaves dust in the vault by design.
const WEIGHT_SCALE = 1_000_000;

function weightOf(ws: WalletScore, mode: StakeWeight): bigint {
  const stakeFactor = mode === "sqrt" ? Math.sqrt(Number(ws.stakeUnits)) : 1;
  return BigInt(Math.round(ws.scoreSum * stakeFactor * WEIGHT_SCALE));
}

export function settle(scores: WalletScore[], cfg: SettleConfig): SettledRow[] {
  const eligible = scores.filter((s) => s.scoreSum > 0);
  const weights = eligible.map((s) => weightOf(s, cfg.stakeWeight));
  const total = weights.reduce((a, b) => a + b, 0n);
  if (total === 0n) return [];
  return eligible.map((s, i) => {
    const raw = (cfg.potLamports * (weights[i] as bigint)) / total;
    const amount = cfg.capLamports !== undefined && raw > cfg.capLamports ? cfg.capLamports : raw;
    return { wallet: s.wallet, score: BigInt(Math.round(s.scoreSum)), amountLamports: amount };
  });
}
