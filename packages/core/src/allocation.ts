import { BASIS_POINTS } from "./reward-points.js";

// Exact epoch allocation (payment rulings P6, P7, P10, P11; O5): integer lamports, weights in
// exact point units, every division floored, and every lamport of the net pot accounted for as
// allocated, cap remainder or dust.

// P7: the Hyphae fee, 3% of the gross pot. The program computes the same number on-chain.
const FEE_BPS = 300n;
// P10: the per-wallet cap is 25% of the net pot, 15% from 20 paid contributors.
const CAP_BPS = 2_500n;
const CAP_BPS_LARGE = 1_500n;
const LARGE_POPULATION = 20;
const MAX_U64 = (1n << 64n) - 1n;

export interface AllocationMember {
  memberId: string;
  pointUnits: bigint;
  // The payout gate's verdict (P9). Only payable members are weighed.
  payable: boolean;
}

export interface MemberAllocation {
  memberId: string;
  uncappedLamports: bigint;
  amountLamports: bigint;
  capRemainderLamports: bigint;
}

export interface Allocation {
  grossLamports: bigint;
  feeBps: bigint;
  feeLamports: bigint;
  netLamports: bigint;
  capBps: bigint;
  capLamports: bigint;
  payableMembers: number;
  allocatedLamports: bigint;
  capRemainderLamports: bigint;
  dustLamports: bigint;
  // In input order; non-payable members carry zeros.
  members: MemberAllocation[];
}

export function allocate(grossLamports: bigint, members: readonly AllocationMember[]): Allocation {
  if (grossLamports <= 0n || grossLamports > MAX_U64) {
    throw new RangeError("allocation: gross lamports must be a positive u64");
  }
  const seen = new Set<string>();
  for (const m of members) {
    if (seen.has(m.memberId)) throw new Error(`allocation: member ${m.memberId} appears twice`);
    seen.add(m.memberId);
    if (m.payable && m.pointUnits <= 0n) {
      throw new RangeError(`allocation: payable member ${m.memberId} needs positive points`);
    }
  }
  const payable = members.filter((m) => m.payable);
  // PG6: nobody payable publishes nothing, so there is nothing to allocate.
  if (payable.length === 0) throw new Error("allocation: no payable member");

  const feeLamports = (grossLamports * FEE_BPS) / BASIS_POINTS;
  const netLamports = grossLamports - feeLamports;
  const capBps = payable.length >= LARGE_POPULATION ? CAP_BPS_LARGE : CAP_BPS;
  const capLamports = (netLamports * capBps) / BASIS_POINTS;
  const totalUnits = payable.reduce((sum, m) => sum + m.pointUnits, 0n);

  let allocatedLamports = 0n;
  let capRemainderLamports = 0n;
  let uncappedTotal = 0n;
  const out = members.map((m): MemberAllocation => {
    if (!m.payable) {
      return {
        memberId: m.memberId,
        uncappedLamports: 0n,
        amountLamports: 0n,
        capRemainderLamports: 0n,
      };
    }
    const uncappedLamports = (netLamports * m.pointUnits) / totalUnits;
    const amountLamports = uncappedLamports < capLamports ? uncappedLamports : capLamports;
    const remainder = uncappedLamports - amountLamports;
    uncappedTotal += uncappedLamports;
    allocatedLamports += amountLamports;
    capRemainderLamports += remainder;
    return {
      memberId: m.memberId,
      uncappedLamports,
      amountLamports,
      capRemainderLamports: remainder,
    };
  });
  // The program refuses a zero allocation, so a publish always pays someone.
  if (allocatedLamports === 0n) {
    throw new Error("allocation: the net pot pays no payable member a whole lamport");
  }

  return {
    grossLamports,
    feeBps: FEE_BPS,
    feeLamports,
    netLamports,
    capBps,
    capLamports,
    payableMembers: payable.length,
    allocatedLamports,
    capRemainderLamports,
    dustLamports: netLamports - uncappedTotal,
    members: out,
  };
}
