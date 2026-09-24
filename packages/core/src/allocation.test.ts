import { describe, expect, it } from "vitest";
import { type AllocationMember, allocate } from "./allocation.js";

const POINT = 100_000_000n;
const m = (memberId: string, points: bigint, payable = true): AllocationMember => ({
  memberId,
  pointUnits: points * POINT,
  payable,
});
const of = (a: ReturnType<typeof allocate>, id: string) => a.members.find((x) => x.memberId === id);

describe("allocate (P6, P7, P10, P11)", () => {
  it("reproduces the payment proposal's worked example to the lamport", () => {
    const a = allocate(500_000_000n, [
      m("m1", 255n),
      m("m2", 85n),
      m("m3", 40n),
      m("m4", 60n, false),
    ]);
    expect(a.feeLamports).toBe(15_000_000n);
    expect(a.netLamports).toBe(485_000_000n);
    expect(a.capBps).toBe(2_500n);
    expect(a.capLamports).toBe(121_250_000n);
    expect(a.payableMembers).toBe(3);
    expect(of(a, "m1")).toEqual({
      memberId: "m1",
      uncappedLamports: 325_460_526n,
      amountLamports: 121_250_000n,
      capRemainderLamports: 204_210_526n,
    });
    expect(of(a, "m2")?.amountLamports).toBe(108_486_842n);
    expect(of(a, "m3")?.amountLamports).toBe(51_052_631n);
    expect(of(a, "m4")).toEqual({
      memberId: "m4",
      uncappedLamports: 0n,
      amountLamports: 0n,
      capRemainderLamports: 0n,
    });
    expect(a.allocatedLamports).toBe(280_789_473n);
    expect(a.capRemainderLamports).toBe(204_210_526n);
    expect(a.dustLamports).toBe(1n);
  });

  it("leaves a non-payable member's weight out of the denominator", () => {
    const withIneligible = allocate(1_000_000n, [m("a", 10n), m("b", 10n), m("c", 1000n, false)]);
    const without = allocate(1_000_000n, [m("a", 10n), m("b", 10n)]);
    expect(of(withIneligible, "a")?.uncappedLamports).toBe(of(without, "a")?.uncappedLamports);
    expect(of(withIneligible, "a")?.uncappedLamports).toBe(485_000n);
  });

  it("caps at 25% below 20 payable members and 15% from 20", () => {
    const members = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        m(`m${String(i).padStart(2, "0")}`, i === 0 ? 1000n : 1n),
      );
    const nineteen = allocate(10_000_000n, members(19));
    const twenty = allocate(10_000_000n, members(20));
    expect(nineteen.capBps).toBe(2_500n);
    expect(nineteen.capLamports).toBe(2_425_000n);
    expect(of(nineteen, "m00")?.amountLamports).toBe(2_425_000n);
    expect(twenty.capBps).toBe(1_500n);
    expect(twenty.capLamports).toBe(1_455_000n);
    expect(of(twenty, "m00")?.amountLamports).toBe(1_455_000n);
  });

  it("floors the fee in the contributors' favour", () => {
    const a = allocate(333n, [m("a", 1n)]);
    expect(a.feeLamports).toBe(9n);
    expect(a.netLamports).toBe(324n);
  });

  it("reconciles: allocated + cap remainder + dust is exactly the net pot", () => {
    for (let n = 1; n <= 30; n++) {
      const members = Array.from({ length: n }, (_, i) =>
        m(`m${String(i).padStart(2, "0")}`, BigInt(((i * 7919) % 97) + 1), i % 4 !== 3),
      );
      if (!members.some((x) => x.payable)) continue;
      const gross = 123_456_789n + BigInt(n) * 1_000_003n;
      const a = allocate(gross, members);
      expect(a.feeLamports + a.netLamports).toBe(gross);
      expect(a.allocatedLamports + a.capRemainderLamports + a.dustLamports).toBe(a.netLamports);
      expect(a.members.reduce((s, x) => s + x.amountLamports, 0n)).toBe(a.allocatedLamports);
      for (const x of a.members) expect(x.amountLamports).toBeLessThanOrEqual(a.capLamports);
    }
  });

  it("works in exact point units, not whole points", () => {
    const a = allocate(1_000_000n, [
      { memberId: "a", pointUnits: 1n, payable: true },
      { memberId: "b", pointUnits: 3n, payable: true },
    ]);
    expect(of(a, "a")?.uncappedLamports).toBe(242_500n);
    expect(of(a, "b")?.uncappedLamports).toBe(727_500n);
  });

  it("refuses what the payout gate never passes on", () => {
    expect(() => allocate(1_000n, [m("a", 1n, false)])).toThrow(/no payable member/);
    expect(() => allocate(0n, [m("a", 1n)])).toThrow(/gross/);
    expect(() => allocate(1n << 64n, [m("a", 1n)])).toThrow(/gross/);
    expect(() => allocate(1_000n, [{ memberId: "a", pointUnits: 0n, payable: true }])).toThrow(
      /positive points/,
    );
    expect(() => allocate(1_000n, [m("a", 1n), m("a", 2n)])).toThrow(/twice/);
  });
});
