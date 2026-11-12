import { readFileSync } from "node:fs";
import type { CommunityStatsV1, PublicRaids } from "@hyphae/core";
import { describe, expect, it } from "vitest";
import {
  HOLD_WINDOW_MS,
  nextRaidEnd,
  PHASES,
  phaseOf,
  remaining,
  shownEpoch,
} from "./epoch-phase.js";

const H = 3_600_000;
const T = (iso: string) => Date.parse(iso);
const epoch = {
  index: 7,
  opens_at: "2026-11-07T00:00:00.000000Z",
  closes_at: "2026-11-14T00:00:00.000000Z",
  status: "open" as const,
};
const available = (over: Partial<Extract<CommunityStatsV1["payouts"], { status: "available" }>>) =>
  ({
    status: "available",
    network: "solana:mainnet",
    program_id: "EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E",
    epochs_paid: 1,
    gross_lamports: "1",
    fee_lamports: "0",
    allocated_lamports: "1",
    claimed_lamports: "0",
    unclaimed_lamports: "1",
    publications: [],
    ...over,
  }) as CommunityStatsV1["payouts"];

describe("the hold window", () => {
  it("is the api's", () => {
    const gate = readFileSync(new URL("../../api/src/payout/gate.ts", import.meta.url), "utf8");
    expect(gate).toMatch(/export const HOLD_WINDOW_MS = 24 \* 3_600_000;/);
    expect(HOLD_WINDOW_MS).toBe(24 * H);
  });
});

describe("the phase of an epoch", () => {
  it("is not started before it opens, earning until it closes, then checking holders for a day", () => {
    expect(phaseOf(epoch, T("2026-11-06T12:00:00Z"))).toMatchObject({
      step: -1,
      until: T(epoch.opens_at),
    });
    expect(phaseOf(epoch, T("2026-11-10T00:00:00Z"))).toMatchObject({
      step: 0,
      until: T(epoch.closes_at),
    });
    expect(phaseOf(epoch, T("2026-11-14T00:00:00Z"))).toMatchObject({
      step: 1,
      until: T(epoch.closes_at) + 24 * H,
    });
    expect(phaseOf(epoch, T("2026-11-14T23:59:59Z")).step).toBe(1);
  });

  it("waits for publication with no clock to count down, never claiming before the chain says so", () => {
    const after = T("2026-11-15T00:00:00Z");
    expect(phaseOf(epoch, after)).toEqual({ epoch: 7, step: 2, until: null, note: null });
    // Stats that are unavailable say nothing about publication.
    expect(phaseOf(epoch, after, { status: "unavailable", reason: "chain_unavailable" }).step).toBe(
      2,
    );
    expect(phaseOf(epoch, after, available({ publications: [] })).step).toBe(2);
  });

  it("claims once a publication for this epoch is confirmed, and is done when nothing is unclaimed", () => {
    const after = T("2026-11-16T00:00:00Z");
    const publication = {
      index: 7,
      epoch_address: "11111111111111111111111111111111",
      publish_tx: "5".repeat(87),
      published_at: "2026-11-15T01:00:00.000000Z",
      root: "a".repeat(64),
      allocated_lamports: "1",
      claimed_lamports: "0",
    };
    expect(phaseOf(epoch, after, available({ publications: [publication] })).step).toBe(3);
    expect(
      phaseOf(epoch, after, available({ publications: [publication], unclaimed_lamports: "0" }))
        .step,
    ).toBe(PHASES.length);
    // Another epoch's publication is not this one's.
    expect(
      phaseOf(epoch, after, available({ publications: [{ ...publication, index: 6 }] })).step,
    ).toBe(2);
  });

  it("follows the settle loop's decision for a rolled-over or distributed epoch", () => {
    const after = T("2026-11-16T00:00:00Z");
    const rolled = phaseOf(
      { ...epoch, payout: { status: "rolled_over", distributed_in: null } },
      after,
    );
    expect(rolled.step).toBe(2);
    expect(rolled.note).toMatch(/later distribution/);
    expect(
      phaseOf({ ...epoch, payout: { status: "distributed", distributed_in: 8 } }, after).step,
    ).toBe(3);
  });
});

describe("the epoch shown", () => {
  const community = {
    mint: "m",
    name: "n",
    reward_intake: "open" as const,
    current_epoch: null,
    epochs: [
      { ...epoch, index: 8, status: "closed" as const },
      { ...epoch, index: 7, status: "closed" as const },
    ],
    as_of: "2026-11-20T00:00:00.000000Z",
  };
  it("is the current one, else the open one, else the newest", () => {
    expect(shownEpoch({ ...community, current_epoch: 7 })?.index).toBe(7);
    expect(shownEpoch(community)?.index).toBe(8);
    expect(
      shownEpoch({
        ...community,
        epochs: [{ ...epoch, index: 5, status: "open" }, ...community.epochs],
      })?.index,
    ).toBe(5);
    expect(shownEpoch({ ...community, epochs: [] })).toBeUndefined();
  });
});

describe("remaining time", () => {
  it("uses the largest units that fit and never goes negative", () => {
    expect(remaining(2 * 86_400_000 + 3 * H + 14 * 60_000 + 9_000)).toBe("2d 03h 14m");
    expect(remaining(3 * H + 5 * 60_000 + 9_000)).toBe("3h 05m 09s");
    expect(remaining(65_000)).toBe("1m 05s");
    expect(remaining(42_900)).toBe("42s");
    expect(remaining(-5_000)).toBe("0s");
  });
});

describe("the next raid to end", () => {
  const raid = (id: string, status: "open" | "scheduled" | "closed", closes_at: string) => ({
    id: `00000000-0000-4000-8000-00000000000${id}`,
    status,
    opens_at: "2026-11-01T00:00:00Z",
    closes_at,
    brief: "",
    post: null,
  });
  const feed = (...raids: ReturnType<typeof raid>[]) =>
    ({
      community: { mint: "m" },
      reward_intake: "open",
      as_of: "2026-11-12T00:00:00Z",
      raids,
    }) as unknown as PublicRaids;
  it("is the earliest open raid still running, and null when there is none", () => {
    const now = T("2026-11-12T10:00:00Z");
    expect(
      nextRaidEnd(
        feed(
          raid("1", "open", "2026-11-13T00:00:00Z"),
          raid("2", "open", "2026-11-12T20:00:00Z"),
          raid("3", "open", "2026-11-12T09:00:00Z"),
          raid("4", "scheduled", "2026-11-12T11:00:00Z"),
          raid("5", "closed", "2026-11-12T10:30:00Z"),
        ),
        now,
      ),
    ).toBe("2026-11-12T20:00:00Z");
    expect(nextRaidEnd(feed(), now)).toBeNull();
    expect(nextRaidEnd(null, now)).toBeNull();
  });
});
