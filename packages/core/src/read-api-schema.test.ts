import { describe, expect, it } from "vitest";
import { ReadApiV1, ReadApiV1Loose } from "./read-api.js";

const ts = "2026-09-25T10:04:05.123456Z";
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

const selected = {
  revision: 1,
  raw_quality: 84,
  credited_quality: 0,
  credit_rule: "hard_zero",
  flags: ["off_topic"],
  effort: "not_nominated",
  timing_bps: 10000,
  multiplier_bps: 10000,
  point_units: "0",
  points: "0",
  explanation: "Off the post's topic.",
  corrected: false,
};

const row = {
  id: uuid(1),
  epoch: { index: 1, closes_at: ts, closed: false, final: false },
  member_id: uuid(2),
  wallet: "MAoRwallet",
  wallet_status: "verified",
  kind: "reply",
  url: "https://x.com/a/status/1",
  raid_id: null,
  accepted_at: ts,
  state: "counted",
  selected,
};

const revision = {
  revision: 1,
  status: "selected",
  accepted_at: ts,
  affects_allocation: true,
  source: "model",
  raw_quality: 84,
  credited_quality: 0,
  credit_rule: "hard_zero",
  flags: ["off_topic"],
  effort: "not_nominated",
  effort_criteria: null,
  timing_bps: 10000,
  multiplier_bps: 10000,
  point_units: "0",
  points: "0",
  explanation: "Off the post's topic.",
  model: {
    model: "claude-sonnet-5",
    prompt_version: "reward-eval/1",
    prompt_hash: "a".repeat(64),
    input_hash: "b".repeat(64),
    output_hash: "c".repeat(64),
    latency_ms: 5210,
    cost_micro_usd: 14000,
  },
  correction: null,
};

const contribution = {
  ...row,
  community: { mint: "Mint1" },
  text: "A real take.",
  capture: { source: "x_oembed", captured_at: ts, limitations: [] },
  reentry_of: null,
  reentered_as: null,
  nomination: null,
  revisions: [revision],
};

const epoch = {
  community: { mint: "Mint1", name: "Hyphae Lab" },
  index: 1,
  opens_at: ts,
  closes_at: ts,
  status: "open",
  closed: false,
  final: false,
  as_of: ts,
  config: {
    id: uuid(3),
    rubric_version: "1.2.0",
    prompt_version: "reward-eval/1",
    effort_multiplier_bps: 30000,
    slot_limit: 1,
    payload: { version: 2 },
  },
  counts: {
    contributions: 1,
    members: 1,
    counted: 1,
    pending: 0,
    pending_at_close: 0,
    pending_reconciliation: 0,
    excluded: 0,
  },
  totals: { point_units: "0", points: "0" },
  snapshot: { status: "not_frozen" },
  allocation: { status: "unavailable", reason: "no_settlement" },
  payment: { status: "unavailable", reason: "no_settlement" },
};

const community = {
  mint: "Mint1",
  name: "Hyphae Lab",
  reward_intake: "open",
  current_epoch: 1,
  epochs: [{ index: 1, opens_at: ts, closes_at: ts, status: "open" }],
  as_of: ts,
};

const leaderboard = {
  community: { mint: "Mint1" },
  epoch: { index: 1, opens_at: ts, closes_at: ts },
  closed: false,
  final: false,
  as_of: ts,
  total_entries: 1,
  total_contributions: 1,
  offset: 0,
  limit: 50,
  entries: [
    {
      rank: 1,
      member_id: uuid(2),
      wallet: null,
      wallet_status: "unverified",
      point_units: "25500000000",
      points: "255",
      whole_points: "255",
      contributions: 1,
      counted: 1,
      pending: 0,
    },
  ],
};

const contributions = {
  community: { mint: "Mint1" },
  epoch: { index: 1, closed: false, final: false },
  as_of: ts,
  total_contributions: 1,
  offset: 0,
  limit: 50,
  contributions: [row],
};

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  schema.safeParse(v).success;

describe("read API v1 schemas", () => {
  it("accept the documented shapes", () => {
    expect(ok(ReadApiV1.community, community)).toBe(true);
    expect(ok(ReadApiV1.epoch, epoch)).toBe(true);
    expect(ok(ReadApiV1.contributions, contributions)).toBe(true);
    expect(ok(ReadApiV1.leaderboard, leaderboard)).toBe(true);
    expect(ok(ReadApiV1.contribution, contribution)).toBe(true);
    expect(ok(ReadApiV1.error, { error: "not_found" })).toBe(true);
  });

  it("refuse numbers where exact integers are strings", () => {
    expect(
      ok(ReadApiV1.contributions, {
        ...contributions,
        contributions: [{ ...row, selected: { ...selected, point_units: 0 } }],
      }),
    ).toBe(false);
  });

  it("refuse millisecond timestamps", () => {
    expect(ok(ReadApiV1.community, { ...community, as_of: "2026-09-25T10:04:05.123Z" })).toBe(
      false,
    );
  });

  it("refuse a wallet address that is not verified, and a verified status without one", () => {
    expect(ok(ReadApiV1.contribution, { ...contribution, wallet_status: "unverified" })).toBe(
      false,
    );
    expect(ok(ReadApiV1.contribution, { ...contribution, wallet: null })).toBe(false);
  });

  it("refuse unknown keys such as Telegram identifiers", () => {
    expect(ok(ReadApiV1.contribution, { ...contribution, telegram_user_id: "1" })).toBe(false);
    expect(
      ok(ReadApiV1.leaderboard, {
        ...leaderboard,
        entries: [{ ...leaderboard.entries[0], telegram_username: "x" }],
      }),
    ).toBe(false);
  });

  it("refuse a selected revision on a row that is not counted, and a counted row without one", () => {
    expect(ok(ReadApiV1.contribution, { ...contribution, state: "pending" })).toBe(false);
    expect(ok(ReadApiV1.contribution, { ...contribution, selected: null })).toBe(false);
  });

  it("refuse an unavailable section without a reason, and a revision whose source and details disagree", () => {
    expect(ok(ReadApiV1.epoch, { ...epoch, payment: { status: "unavailable" } })).toBe(false);
    expect(
      ok(ReadApiV1.contribution, {
        ...contribution,
        revisions: [{ ...revision, source: "correction" }],
      }),
    ).toBe(false);
  });

  it("the loose variant accepts additive fields, for consumers", () => {
    expect(
      ok(ReadApiV1Loose.contribution, { ...contribution, decision_hash: "d".repeat(64) }),
    ).toBe(true);
    expect(ok(ReadApiV1Loose.contribution, { ...contribution, wallet_status: "unverified" })).toBe(
      false,
    );
  });
});
