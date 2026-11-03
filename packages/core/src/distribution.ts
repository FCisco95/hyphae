import { type AllocationMember, feeOf, type MemberAllocation, shareNet } from "./allocation.js";
import { BASIS_POINTS } from "./reward-points.js";

// Automatic payout with a volume threshold and rollover (Organic design
// 2026-11-03-automatic-epochs-and-rollover-design.md, §6 to §8). Pure: chain reads and gate
// verdicts in, a decision and exact lamports out.
//
// An epoch's accrual is what reached the community's vault for it. An epoch whose volume does not
// reach the threshold is rolled over: nothing is published, so its lamports stay free in the vault,
// which no instruction can withdraw. When the threshold is met, every pending epoch is paid in one
// distribution published under the latest epoch's index, with one leaf per wallet.

const MAX_U64 = (1n << 64n) - 1n;

export interface PayoutPolicy {
  // The minimum trading volume, in lamports of SOL.
  thresholdVolumeLamports: bigint;
  // cumulative: the pending epochs' volume together must reach the threshold.
  // per_epoch: the latest epoch's volume alone must reach it.
  basis: "cumulative" | "per_epoch";
  // fee_derived volume: the share of each traded lamport that reaches the vault, in basis points.
  // Null when unknown, which makes every volume unknown.
  rewardBpsOfVolume: bigint | null;
}

// accrual(N) = free(N) − the accruals of the epochs still pending before N. free is the vault's
// lamports minus its rent-exempt minimum and the community's outstanding allocations, read when N
// is decided. An unread balance accrues nothing now; the lamports count in a later epoch instead.
export function accrualOf(freeLamports: bigint | null, pendingLamports: bigint): bigint {
  if (pendingLamports < 0n) throw new RangeError("distribution: pending lamports are negative");
  if (freeLamports === null) return 0n;
  if (freeLamports < pendingLamports) {
    // The vault only loses lamports through claims of published epochs, which `outstanding`
    // already excludes, so this means a wrong read or a broken ledger. Never guess.
    throw new Error("distribution: the vault holds less than the epochs already rolled over");
  }
  return freeLamports - pendingLamports;
}

// fee_derived volume (§6): the accrual scaled back to the volume that paid it. Unknown when the
// share is unset or when the balance could not be read.
export function feeDerivedVolume(
  accrualLamports: bigint,
  rewardBpsOfVolume: bigint | null,
  balanceRead: boolean,
): bigint | null {
  if (!balanceRead || rewardBpsOfVolume === null || rewardBpsOfVolume <= 0n) return null;
  if (rewardBpsOfVolume > BASIS_POINTS) {
    throw new RangeError("distribution: the reward share cannot exceed the whole volume");
  }
  return (accrualLamports * BASIS_POINTS) / rewardBpsOfVolume;
}

export interface PendingEpoch {
  index: bigint;
  accrualLamports: bigint;
  // Null when the volume is unknown; an unknown volume never meets the threshold.
  volumeLamports: bigint | null;
  // The epoch's gate verdicts. A payable member carries the wallet a payout may use.
  members: readonly DistributionMember[];
}

export interface DistributionMember extends AllocationMember {
  wallet: string | null;
}

export type Decision =
  | { outcome: "rolled_over"; reason: "below_threshold" | "volume_unknown" | "no_payable_member" }
  | { outcome: "distribute"; volumeLamports: bigint };

// §7. `pending` lists every epoch still rolled over, in index order, ending with the epoch being
// decided.
export function decide(policy: PayoutPolicy, pending: readonly PendingEpoch[]): Decision {
  checkOrder(pending);
  const latest = pending[pending.length - 1] as PendingEpoch;
  let volume: bigint | null;
  if (policy.basis === "per_epoch") {
    volume = latest.volumeLamports;
  } else {
    // An unknown week adds nothing, so it delays a payout but cannot block one forever.
    const known = pending.filter((e) => e.volumeLamports !== null);
    volume = known.length ? known.reduce((s, e) => s + (e.volumeLamports as bigint), 0n) : null;
  }
  if (volume === null) return { outcome: "rolled_over", reason: "volume_unknown" };
  if (volume < policy.thresholdVolumeLamports) {
    return { outcome: "rolled_over", reason: "below_threshold" };
  }
  if (!pending.some((e) => e.members.some((m) => m.payable))) {
    return { outcome: "rolled_over", reason: "no_payable_member" };
  }
  return { outcome: "distribute", volumeLamports: volume };
}

function checkOrder(pending: readonly PendingEpoch[]): void {
  if (pending.length === 0) throw new Error("distribution: nothing is pending");
  for (let i = 0; i < pending.length; i++) {
    const e = pending[i] as PendingEpoch;
    if (e.accrualLamports < 0n) throw new RangeError("distribution: a negative accrual");
    if (i > 0 && (pending[i - 1] as PendingEpoch).index >= e.index) {
      throw new Error("distribution: pending epochs must be in increasing index order");
    }
  }
}

export interface DistributionSlice {
  epochIndex: bigint;
  accrualLamports: bigint;
  // The accrual plus any slice merged into it from an epoch with nobody payable.
  grossLamports: bigint;
  // Indices whose accrual this slice carries for lack of a payable member there.
  mergedFrom: bigint[];
  netLamports: bigint;
  capBps: bigint;
  capLamports: bigint;
  payableMembers: number;
  allocatedLamports: bigint;
  capRemainderLamports: bigint;
  dustLamports: bigint;
  // In the epoch's member order.
  members: MemberAllocation[];
}

export interface DistributionPart {
  epochIndex: bigint;
  pointUnits: bigint;
  amountLamports: bigint;
}

export interface DistributedMember {
  memberId: string;
  // The wallet from the latest epoch whose part pays the member (B11 checks the same rule).
  wallet: string;
  amountLamports: bigint;
  // One part per pending epoch the member appears in, by epoch index.
  parts: DistributionPart[];
}

export interface DistributionEpoch {
  index: bigint;
  accrualLamports: bigint;
  // The epoch whose slice carries this accrual when nobody here was payable, else null.
  mergedInto: bigint | null;
}

export interface Distribution {
  // The on-chain epoch index the distribution is published under: the latest pending epoch.
  index: bigint;
  // Every pending epoch, in index order.
  epochs: DistributionEpoch[];
  grossLamports: bigint;
  feeLamports: bigint;
  netLamports: bigint;
  allocatedLamports: bigint;
  capRemainderLamports: bigint;
  dustLamports: bigint;
  slices: DistributionSlice[];
  // Members with a positive amount, by member id.
  members: DistributedMember[];
}

const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// §8, split per_epoch: each epoch's accrual is its slice of one gross, each slice is shared among
// that epoch's payable members with that epoch's cap, and a member's leaf is the sum of their
// slices. The program charges its fee once on the whole gross, so the slices share one net: every
// slice takes the floor of its pro-rata part and the last slice takes what is left, so the
// allocation can never exceed the net the program allows.
export function buildDistribution(pending: readonly PendingEpoch[]): Distribution {
  checkOrder(pending);
  const grossLamports = pending.reduce((s, e) => s + e.accrualLamports, 0n);
  if (grossLamports <= 0n || grossLamports > MAX_U64) {
    throw new RangeError("distribution: the gross must be a positive u64");
  }

  // An epoch with nobody payable passes its accrual to the nearest later epoch with someone
  // payable, or else to the nearest earlier one, so no slice is stranded.
  const hasPayable = pending.map((e) => e.members.some((m) => m.payable));
  if (!hasPayable.some(Boolean)) throw new Error("distribution: no pending epoch pays anyone");
  const extra = pending.map(() => 0n);
  const mergedFrom: bigint[][] = pending.map(() => []);
  const mergedInto: (bigint | null)[] = pending.map(() => null);
  pending.forEach((e, i) => {
    if (hasPayable[i]) return;
    let target = hasPayable.findIndex((p, j) => p && j > i);
    if (target === -1) target = hasPayable.lastIndexOf(true);
    extra[target] = (extra[target] as bigint) + e.accrualLamports;
    (mergedFrom[target] as bigint[]).push(e.index);
    mergedInto[i] = (pending[target] as PendingEpoch).index;
  });

  const feeLamports = feeOf(grossLamports);
  const netLamports = grossLamports - feeLamports;
  const paying = pending.flatMap((e, i) =>
    hasPayable[i] ? [{ epoch: e, gross: e.accrualLamports + (extra[i] as bigint), i }] : [],
  );
  let netLeft = netLamports;
  const slices: DistributionSlice[] = paying.map(({ epoch, gross, i }, k) => {
    const last = k === paying.length - 1;
    const sliceNet = last ? netLeft : (netLamports * gross) / grossLamports;
    netLeft -= sliceNet;
    const share = shareNet(sliceNet, epoch.members);
    return {
      epochIndex: epoch.index,
      accrualLamports: epoch.accrualLamports,
      grossLamports: gross,
      mergedFrom: [...(mergedFrom[i] as bigint[])].sort((a, b) => (a < b ? -1 : 1)),
      netLamports: sliceNet,
      capBps: share.capBps,
      capLamports: share.capLamports,
      payableMembers: share.payableMembers,
      allocatedLamports: share.allocatedLamports,
      capRemainderLamports: share.capRemainderLamports,
      dustLamports: share.dustLamports,
      members: share.members,
    };
  });

  // One leaf per wallet (the program keeps one claim receipt per wallet and epoch index).
  const byMember = new Map<string, DistributedMember>();
  pending.forEach((epoch) => {
    const slice = slices.find((s) => s.epochIndex === epoch.index);
    epoch.members.forEach((m, j) => {
      const amount = slice ? (slice.members[j] as MemberAllocation).amountLamports : 0n;
      let entry = byMember.get(m.memberId);
      if (!entry) {
        entry = { memberId: m.memberId, wallet: "", amountLamports: 0n, parts: [] };
        byMember.set(m.memberId, entry);
      }
      entry.parts.push({
        epochIndex: epoch.index,
        pointUnits: m.pointUnits,
        amountLamports: amount,
      });
      entry.amountLamports += amount;
      if (amount > 0n) {
        if (m.wallet === null) throw new Error(`distribution: payable ${m.memberId} has no wallet`);
        entry.wallet = m.wallet;
      }
    });
  });
  const members = [...byMember.values()]
    .filter((m) => m.amountLamports > 0n)
    .sort((a, b) => byKey(a.memberId, b.memberId));
  const wallets = new Set<string>();
  for (const m of members) {
    // Two people resolving to one wallet would share one receipt: refuse rather than merge.
    if (wallets.has(m.wallet)) throw new Error(`distribution: wallet ${m.wallet} is shared`);
    wallets.add(m.wallet);
  }

  const allocatedLamports = slices.reduce((s, x) => s + x.allocatedLamports, 0n);
  if (allocatedLamports === 0n) {
    throw new Error("distribution: the net pot pays no payable member a whole lamport");
  }
  const capRemainderLamports = slices.reduce((s, x) => s + x.capRemainderLamports, 0n);
  const dustLamports = slices.reduce((s, x) => s + x.dustLamports, 0n);
  // Every lamport of the net is allocated, cap remainder or dust; the program needs allocated ≤ net.
  if (allocatedLamports + capRemainderLamports + dustLamports !== netLamports) {
    throw new Error("distribution: the slices do not reconcile to the net");
  }

  return {
    index: (pending[pending.length - 1] as PendingEpoch).index,
    epochs: pending.map((e, i) => ({
      index: e.index,
      accrualLamports: e.accrualLamports,
      mergedInto: mergedInto[i] as bigint | null,
    })),
    grossLamports,
    feeLamports,
    netLamports,
    allocatedLamports,
    capRemainderLamports,
    dustLamports,
    slices,
    members,
  };
}
