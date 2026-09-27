import type { LooseEpochV1 } from "@hyphae/core";
import { describe, expect, it } from "vitest";
import * as f from "../components/fixtures.js";
import type { Result } from "./api.js";
import { claimTarget } from "./settlement.js";

const ok = (data: LooseEpochV1): Result<LooseEpochV1> => ({ ok: true, data });
const unpublished = ok(f.finalEpoch);

// Reads epochs by index from `found`, recording the order asked.
function reads(found: Record<number, Result<LooseEpochV1>>) {
  const asked: number[] = [];
  const read = async (index: number) => {
    asked.push(index);
    return found[index] ?? { ok: false as const, reason: "not_found" as const };
  };
  return { read, asked };
}

describe("where a member claims", () => {
  it("is the newest published epoch, however far back it is", async () => {
    const indexes = [9, 8, 7, 6, 5, 4, 3];
    const r = reads({
      ...Object.fromEntries(indexes.map((i) => [i, unpublished])),
      3: ok(f.settledEpoch),
    });
    expect(await claimTarget(indexes, r.read)).toEqual({ index: 3 });
    expect(r.asked).toEqual(indexes);
  });

  it("is an epoch with a recorded publication even when the chain cannot confirm it now", async () => {
    const r = reads({ 2: ok(f.chainDownEpoch), 1: ok(f.settledEpoch) });
    expect(await claimTarget([2, 1], r.read)).toEqual({ index: 2 });
  });

  it("cannot be told when a read fails, which is never the same as none", async () => {
    const r = reads({ 2: { ok: false, reason: "unavailable" }, 1: ok(f.settledEpoch) });
    expect(await claimTarget([2, 1], r.read)).toBe("unavailable");
  });

  it("is none only when every epoch is read as unpublished, or retained from there back", async () => {
    expect(await claimTarget([2, 1], reads({ 2: unpublished, 1: unpublished }).read)).toBe("none");
    expect(await claimTarget([], reads({}).read)).toBe("none");
    const retained = reads({ 3: unpublished, 2: ok(f.retainedEpoch) });
    expect(await claimTarget([3, 2, 1], retained.read)).toBe("none");
    expect(retained.asked).toEqual([3, 2]);
    expect(await claimTarget([1], reads({ 1: ok(f.firstV1Epoch) }).read)).toBe("none");
  });
});
