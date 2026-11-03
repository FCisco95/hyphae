import { getAddressDecoder, getAddressEncoder } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  accrualOf,
  buildDistribution,
  type Decision,
  type DistributionMember,
  decide,
  feeDerivedVolume,
  type PayoutPolicy,
  type PendingEpoch,
} from "./distribution.js";
import { buildTree, getProof, leafHash, verifyProof } from "./merkle.js";

// Test lookups that must succeed; a miss fails the test with a clear message.
function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error("expected a value");
  return v;
}

const POINT = 100_000_000n;
const SOL = 1_000_000_000n;
const wallet = (n: number) => getAddressDecoder().decode(new Uint8Array(32).fill(n)) as string;
const member = (
  id: string,
  points: bigint,
  w: number | null,
  payable = true,
): DistributionMember => ({
  memberId: id,
  pointUnits: points * POINT,
  payable,
  wallet: w === null ? null : wallet(w),
});

// 1% of every traded lamport reaches the vault; the threshold is 100 SOL of volume (1 SOL of pot).
const policy: PayoutPolicy = {
  thresholdVolumeLamports: 100n * SOL,
  basis: "cumulative",
  rewardBpsOfVolume: 100n,
};

// A small model of the Hyphae vault and the program's rules (publish_epoch.rs:48-82,
// claim.rs:51-77): publish reserves `allocated` out of the free balance and pays the 3% fee; a
// wallet claims its leaf once per index; nothing else moves lamports out.
class Vault {
  lamports = 0n;
  outstanding = 0n;
  readonly rent = 890_880n;
  readonly published = new Map<bigint, { root: Uint8Array; allocated: bigint; claimed: bigint }>();
  readonly receipts = new Set<string>();
  feePaid = 0n;
  deposit(l: bigint) {
    this.lamports += l;
  }
  free() {
    return this.lamports - this.rent - this.outstanding;
  }
  publish(index: bigint, root: Uint8Array, gross: bigint, allocated: bigint) {
    if (this.published.has(index)) throw new Error("epoch already published");
    const fee = (gross * 300n) / 10_000n;
    if (gross <= 0n || allocated <= 0n || allocated > gross - fee) throw new Error("bad amounts");
    if (gross > this.free()) throw new Error("vault cannot cover gross");
    this.lamports -= fee;
    this.feePaid += fee;
    this.outstanding += allocated;
    this.published.set(index, { root, allocated, claimed: 0n });
  }
  claim(index: bigint, leaf: Uint8Array, proof: Uint8Array[], w: string, amount: bigint) {
    const e = this.published.get(index);
    if (!e || !verifyProof(e.root, leaf, proof)) throw new Error("bad proof");
    const key = `${index}:${w}`;
    if (this.receipts.has(key)) throw new Error("already claimed");
    if (e.claimed + amount > e.allocated) throw new Error("over allocated");
    this.receipts.add(key);
    e.claimed += amount;
    this.lamports -= amount;
    this.outstanding -= amount;
  }
}

// The settle loop for one community, as the worker runs it after each epoch's gate is final.
function settle(
  vault: Vault,
  rolled: PendingEpoch[],
  index: bigint,
  members: DistributionMember[],
) {
  const pendingLamports = rolled.reduce((s, e) => s + e.accrualLamports, 0n);
  const accrualLamports = accrualOf(vault.free(), pendingLamports);
  const epoch: PendingEpoch = {
    index,
    accrualLamports,
    volumeLamports: feeDerivedVolume(accrualLamports, policy.rewardBpsOfVolume, true),
    members,
  };
  const pending = [...rolled, epoch];
  const decision = decide(policy, pending);
  if (decision.outcome === "rolled_over") return { decision, rolled: pending };

  const d = buildDistribution(pending);
  const encoder = getAddressEncoder();
  const leaves = d.members.map((m) =>
    leafHash({
      wallet: new Uint8Array(encoder.encode(m.wallet as never)),
      epochIndex: d.index,
      score: m.parts.reduce((s, p) => s + p.pointUnits / POINT, 0n),
      amount: m.amountLamports,
      evidenceHash: new Uint8Array(32).fill(7),
    }),
  );
  const tree = buildTree(leaves);
  vault.publish(d.index, tree.root, d.grossLamports, d.allocatedLamports);
  d.members.forEach((m, i) => {
    vault.claim(d.index, leaves[i] as Uint8Array, getProof(tree, i), m.wallet, m.amountLamports);
  });
  return { decision, rolled: [] as PendingEpoch[], distribution: d };
}

describe("accrual and volume (§6)", () => {
  it("credits an epoch with what reached the vault since the epochs already pending", () => {
    expect(accrualOf(3n * SOL, SOL)).toBe(2n * SOL);
    expect(accrualOf(null, SOL)).toBe(0n);
    expect(() => accrualOf(SOL - 1n, SOL)).toThrow(/less than the epochs already rolled over/);
  });

  it("derives volume from the accrual, and knows nothing without the share or the read", () => {
    expect(feeDerivedVolume(SOL, 100n, true)).toBe(100n * SOL);
    expect(feeDerivedVolume(SOL, null, true)).toBeNull();
    expect(feeDerivedVolume(SOL, 100n, false)).toBeNull();
    expect(() => feeDerivedVolume(SOL, 10_001n, true)).toThrow(/exceed/);
  });
});

describe("decide (§7)", () => {
  const e = (index: bigint, volume: bigint | null, payable = true): PendingEpoch => ({
    index,
    accrualLamports: SOL,
    volumeLamports: volume,
    members: [member(`m${index}`, 10n, 1, payable)],
  });

  it("distributes an epoch that meets the threshold", () => {
    expect(decide(policy, [e(1n, 100n * SOL)])).toEqual<Decision>({
      outcome: "distribute",
      volumeLamports: 100n * SOL,
    });
  });

  it("rolls over an epoch that misses it, or whose volume is unknown", () => {
    expect(decide(policy, [e(1n, 100n * SOL - 1n)])).toEqual({
      outcome: "rolled_over",
      reason: "below_threshold",
    });
    expect(decide(policy, [e(1n, null)])).toEqual({
      outcome: "rolled_over",
      reason: "volume_unknown",
    });
  });

  it("sums the pending volume on the cumulative basis, and counts an unknown week as nothing", () => {
    expect(decide(policy, [e(1n, 40n * SOL), e(2n, null), e(3n, 60n * SOL)]).outcome).toBe(
      "distribute",
    );
  });

  it("judges the latest epoch alone on the per-epoch basis", () => {
    const perEpoch = { ...policy, basis: "per_epoch" as const };
    expect(decide(perEpoch, [e(1n, 99n * SOL), e(2n, 60n * SOL)]).outcome).toBe("rolled_over");
    expect(decide(perEpoch, [e(1n, 1n), e(2n, 100n * SOL)]).outcome).toBe("distribute");
  });

  it("keeps rolling over while nobody pending is payable", () => {
    expect(decide(policy, [e(1n, 500n * SOL, false)])).toEqual({
      outcome: "rolled_over",
      reason: "no_payable_member",
    });
  });

  it("refuses pending epochs out of order", () => {
    expect(() => decide(policy, [e(2n, SOL), e(1n, SOL)])).toThrow(/increasing index order/);
  });
});

describe("the settle loop through the vault", () => {
  it("pays an epoch that meets the threshold in full", () => {
    const vault = new Vault();
    vault.deposit(vault.rent + 2n * SOL);
    const r = settle(vault, [], 1n, [member("a", 30n, 1), member("b", 10n, 2)]);
    expect(r.decision.outcome).toBe("distribute");
    const d = must(r.distribution);
    expect(d.grossLamports).toBe(2n * SOL);
    expect(d.feeLamports).toBe(60_000_000n);
    // a's 75% is capped at 25% of the net; the cap remainder stays in the vault.
    expect(d.members.map((m) => [m.memberId, m.amountLamports])).toEqual([
      ["a", 485_000_000n],
      ["b", 485_000_000n],
    ]);
    expect(vault.free()).toBe(2n * SOL - d.feeLamports - d.allocatedLamports);
  });

  it("leaves a missed epoch's lamports in the vault, unpublished and unspent", () => {
    const vault = new Vault();
    vault.deposit(vault.rent + SOL / 2n);
    const r = settle(vault, [], 1n, [member("a", 30n, 1)]);
    expect(r.decision).toEqual({ outcome: "rolled_over", reason: "below_threshold" });
    expect(vault.published.size).toBe(0);
    expect(vault.free()).toBe(SOL / 2n);
    expect(r.rolled.map((e) => e.accrualLamports)).toEqual([SOL / 2n]);
  });

  it("accumulates three epochs below the threshold and pays all of them in one distribution", () => {
    const vault = new Vault();
    const week1 = [member("a", 10n, 1), member("b", 10n, 2)];
    const week2 = [member("a", 5n, 1), member("c", 15n, 3)];
    const week3 = [member("b", 20n, 2), member("c", 10n, 3), member("d", 10n, 4)];

    vault.deposit(vault.rent + 400_000_000n);
    let r = settle(vault, [], 1n, week1);
    expect(r.decision.outcome).toBe("rolled_over");
    vault.deposit(300_000_000n);
    r = settle(vault, r.rolled, 2n, week2);
    expect(r.decision.outcome).toBe("rolled_over");
    expect(vault.published.size).toBe(0);
    expect(vault.free()).toBe(700_000_000n);

    vault.deposit(300_000_000n);
    r = settle(vault, r.rolled, 3n, week3);
    expect(r.decision).toEqual({ outcome: "distribute", volumeLamports: 100n * SOL });
    const d = must(r.distribution);

    // One publish, under index 3, for the three weeks' 1 SOL together.
    expect([...vault.published.keys()]).toEqual([3n]);
    expect(d.index).toBe(3n);
    expect(d.grossLamports).toBe(SOL);
    expect(d.slices.map((s) => [s.epochIndex, s.accrualLamports])).toEqual([
      [1n, 400_000_000n],
      [2n, 300_000_000n],
      [3n, 300_000_000n],
    ]);
    // Each week's slice goes to that week's contributors: c earns from weeks 2 and 3 only.
    const c = must(d.members.find((m) => m.memberId === "c"));
    expect(c.parts.map((p) => [p.epochIndex, p.amountLamports])).toEqual([
      [2n, 72_750_000n],
      [3n, 72_750_000n],
    ]);
    expect(c.amountLamports).toBe(145_500_000n);
    // One leaf per wallet; every wallet claimed once and the totals reconcile to the lamport.
    expect(d.members).toHaveLength(4);
    expect(vault.receipts.size).toBe(4);
    expect(d.allocatedLamports + d.capRemainderLamports + d.dustLamports).toBe(d.netLamports);
    expect(vault.feePaid).toBe(d.feeLamports);
    expect(vault.free()).toBe(d.grossLamports - d.feeLamports - d.allocatedLamports);
    // The settle loop starts over: nothing is pending after a distribution.
    expect(r.rolled).toEqual([]);
  });
});

describe("buildDistribution (§8)", () => {
  it("passes the accrual of a week with nobody payable to the next week that pays someone", () => {
    const d = buildDistribution([
      {
        index: 1n,
        accrualLamports: SOL,
        volumeLamports: null,
        members: [member("a", 5n, 1, false)],
      },
      { index: 2n, accrualLamports: SOL, volumeLamports: null, members: [member("b", 5n, 2)] },
    ]);
    expect(d.slices).toHaveLength(1);
    expect(d.slices[0]).toMatchObject({
      epochIndex: 2n,
      grossLamports: 2n * SOL,
      mergedFrom: [1n],
    });
  });

  it("passes a final week with nobody payable back to the latest week that pays someone", () => {
    const d = buildDistribution([
      { index: 4n, accrualLamports: SOL, volumeLamports: null, members: [member("a", 5n, 1)] },
      { index: 5n, accrualLamports: SOL, volumeLamports: null, members: [] },
    ]);
    expect(d.index).toBe(5n);
    expect(d.slices[0]).toMatchObject({
      epochIndex: 4n,
      grossLamports: 2n * SOL,
      mergedFrom: [5n],
    });
  });

  it("never allocates more than the program's net, however the slices round", () => {
    // Odd accruals make every slice's floor lose a lamport; the last slice absorbs the rest.
    const weeks = [333_333_337n, 333_333_331n, 333_333_339n].map((accrual, i) => ({
      index: BigInt(i + 1),
      accrualLamports: accrual,
      volumeLamports: null,
      members: [member(`m${i}`, 7n, i + 1), member(`n${i}`, 3n, i + 11)],
    }));
    const d = buildDistribution(weeks);
    expect(d.netLamports).toBe(d.grossLamports - (d.grossLamports * 300n) / 10_000n);
    expect(d.slices.reduce((s, x) => s + x.netLamports, 0n)).toBe(d.netLamports);
    expect(d.allocatedLamports).toBeLessThanOrEqual(d.netLamports);
  });

  it("refuses two members who resolve to one wallet", () => {
    expect(() =>
      buildDistribution([
        {
          index: 1n,
          accrualLamports: SOL,
          volumeLamports: null,
          members: [member("a", 5n, 1), member("b", 5n, 1)],
        },
      ]),
    ).toThrow(/is shared/);
  });

  it("pays a member at the wallet of the latest week they are payable in", () => {
    const d = buildDistribution([
      { index: 1n, accrualLamports: SOL, volumeLamports: null, members: [member("a", 5n, 1)] },
      { index: 2n, accrualLamports: SOL, volumeLamports: null, members: [member("a", 5n, 9)] },
    ]);
    expect(d.members[0]?.wallet).toBe(wallet(9));
  });
});
