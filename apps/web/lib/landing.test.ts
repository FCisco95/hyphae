import type { CommunityV1, LooseEpochV1 } from "@hyphae/core";
import { describe, expect, it } from "vitest";
import * as f from "../components/fixtures.js";
import type { Result } from "./api.js";
import { loadLiveProof } from "./landing.js";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const down = { ok: false, reason: "unavailable" } as const;

function readers(community: Result<CommunityV1>, epochs: Record<number, Result<LooseEpochV1>>) {
  const reads: number[] = [];
  return {
    reads,
    community: async () => community,
    epoch: async (_mint: string, index: number) => {
      reads.push(index);
      return epochs[index] ?? { ok: false as const, reason: "not_found" as const };
    },
  };
}

describe("loadLiveProof", () => {
  it("says so when the site has no community configured", async () => {
    const r = readers(ok(f.community), {});
    expect(await loadLiveProof(undefined, r.community, r.epoch)).toEqual({ state: "unconfigured" });
  });

  it("is unavailable, with no epoch read, when the community can't be read", async () => {
    const r = readers(down, {});
    expect(await loadLiveProof("MintAbc", r.community, r.epoch)).toEqual({ state: "unavailable" });
    expect(r.reads).toEqual([]);
  });

  it("reads the open epoch and the newest closed one", async () => {
    const r = readers(ok(f.community), { 2: ok(f.openEpoch), 1: ok(f.finalEpoch) });
    const live = await loadLiveProof("MintAbc", r.community, r.epoch);
    expect(live).toMatchObject({ state: "ready", epoch: f.openEpoch, closed: f.finalEpoch });
    expect(r.reads.sort()).toEqual([1, 2]);
  });

  it("reads one epoch once when the newest is also the newest closed", async () => {
    const closedOnly = {
      ...f.community,
      current_epoch: null,
      epochs: f.community.epochs.filter((e) => e.status === "closed"),
    };
    const r = readers(ok(closedOnly), { 1: ok(f.finalEpoch) });
    const live = await loadLiveProof("MintAbc", r.community, r.epoch);
    expect(live).toMatchObject({ state: "ready", epoch: f.finalEpoch, closed: f.finalEpoch });
    expect(r.reads).toEqual([1]);
  });

  it("counts an epoch past its close but not yet frozen as closed", async () => {
    const closing = {
      ...f.community,
      current_epoch: null,
      epochs: [
        {
          index: 2,
          opens_at: f.closingEpoch.opens_at,
          closes_at: f.closingEpoch.closes_at,
          status: "closing" as const,
        },
      ],
    };
    const r = readers(ok(closing), { 2: ok(f.closingEpoch) });
    const live = await loadLiveProof("MintAbc", r.community, r.epoch);
    expect(live).toMatchObject({ state: "ready", epoch: f.closingEpoch, closed: f.closingEpoch });
    expect(r.reads).toEqual([2]);
  });

  it("keeps an epoch it couldn't read as unavailable, never as absent", async () => {
    const r = readers(ok(f.community), { 2: down, 1: ok(f.finalEpoch) });
    const live = await loadLiveProof("MintAbc", r.community, r.epoch);
    expect(live).toMatchObject({ state: "ready", epoch: "unavailable", closed: f.finalEpoch });
  });

  it("before any epoch, has nothing to read", async () => {
    const r = readers(ok({ ...f.community, current_epoch: null, epochs: [] }), {});
    const live = await loadLiveProof("MintAbc", r.community, r.epoch);
    expect(live).toMatchObject({ state: "ready", epoch: null, closed: null });
    expect(r.reads).toEqual([]);
  });
});
