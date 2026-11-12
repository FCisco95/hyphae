import type { CommunityStatsV1, CommunityV1, PublicRaids } from "@hyphae/core";

// Where an epoch is in its week, from what the read API already says. The hold window is the
// api's `HOLD_WINDOW_MS` (apps/api/src/payout/gate.ts); epoch-phase.test.ts reads that file so the
// two cannot drift apart.
export const HOLD_WINDOW_MS = 24 * 3_600_000;

export const PHASES = [
  { key: "earn", label: "Earning", hint: "Contributions count until the epoch closes." },
  {
    key: "checks",
    label: "Holder checks",
    hint: "A member's balance is read for 24 hours after the close.",
  },
  { key: "publish", label: "Publishing", hint: "The payout list is published on Solana." },
  {
    key: "claim",
    label: "Claiming",
    hint: "Each member claims their share with their own wallet.",
  },
] as const;

type Epoch = CommunityV1["epochs"][number];
type Payouts = CommunityStatsV1["payouts"];

export interface Phase {
  epoch: number;
  // Index into PHASES of the step the epoch is in; -1 before it opens; PHASES.length once every
  // allocated lamport is claimed.
  step: number;
  // The next change of step, UTC ms; null when it depends on something other than the clock.
  until: number | null;
  // Why a step waits on something other than the clock.
  note: string | null;
}

// The epoch to show: the open one, else the newest the community has.
export function shownEpoch(community: CommunityV1): Epoch | undefined {
  return (
    community.epochs.find((e) => e.index === community.current_epoch) ??
    community.epochs.find((e) => e.status === "open") ??
    community.epochs[0]
  );
}

export function phaseOf(epoch: Epoch, nowMs: number, payouts?: Payouts): Phase {
  const opens = Date.parse(epoch.opens_at);
  const closes = Date.parse(epoch.closes_at);
  const base = { epoch: epoch.index, note: null };
  if (nowMs < opens) return { ...base, step: -1, until: opens };
  if (nowMs < closes) return { ...base, step: 0, until: closes };
  if (nowMs < closes + HOLD_WINDOW_MS) return { ...base, step: 1, until: closes + HOLD_WINDOW_MS };
  if (epoch.payout?.status === "rolled_over") {
    return {
      ...base,
      step: 2,
      until: null,
      note: "This epoch's accrual waits for a later distribution.",
    };
  }
  const published =
    epoch.payout?.status === "distributed" ||
    (payouts?.status === "available" && payouts.publications.some((p) => p.index === epoch.index));
  if (!published) return { ...base, step: 2, until: null, note: null };
  // Claiming ends only when the chain says nothing is left, which the stats read can say.
  const done = payouts?.status === "available" && payouts.unclaimed_lamports === "0";
  return { ...base, step: done ? PHASES.length : 3, until: null, note: null };
}

// "2d 03h 14m", "3h 05m 09s", "42s": the largest units that still fit, to the second under a day.
export function remaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3_600);
  const m = Math.floor((total % 3_600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${two(h)}h ${two(m)}m`;
  if (h > 0) return `${h}h ${two(m)}m ${two(s)}s`;
  if (m > 0) return `${m}m ${two(s)}s`;
  return `${s}s`;
}

// The open raid that ends first, if any, as its UTC close time.
export function nextRaidEnd(raids: PublicRaids | null | undefined, nowMs: number): string | null {
  const open = (raids?.raids ?? [])
    .filter((r) => r.status === "open" && Date.parse(r.closes_at) > nowMs)
    .sort((a, b) => Date.parse(a.closes_at) - Date.parse(b.closes_at));
  return open[0]?.closes_at ?? null;
}
