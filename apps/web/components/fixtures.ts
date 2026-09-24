import type {
  CommunityV1,
  ContributionRowV1,
  ContributionsV1,
  ContributionV1,
  EpochV1,
  LeaderboardV1,
  RevisionV1,
} from "@hyphae/core";

// Test fixtures shaped like the read API's output; views.test.ts checks them against the strict
// schemas so they cannot drift from the contract.

const ts = (day: number, hour = 0) =>
  `2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000000Z`;
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
export const SIGNED = "MAoRk7cS1gnedWa11etAddre55xxxxxxxxxxxVhAB";

export const community: CommunityV1 = {
  mint: "MintAbc",
  name: "Hyphae Lab",
  reward_intake: "open",
  current_epoch: 2,
  epochs: [
    { index: 2, opens_at: ts(2), closes_at: ts(9), status: "open" },
    { index: 1, opens_at: ts(1), closes_at: ts(2), status: "closed" },
  ],
  as_of: ts(3),
};

const baseEpoch: EpochV1 = {
  community: { mint: "MintAbc", name: "Hyphae Lab" },
  index: 1,
  opens_at: ts(1),
  closes_at: ts(2),
  status: "closed",
  closed: true,
  final: true,
  as_of: ts(3),
  config: {
    id: id(90),
    rubric_version: "1.2.0",
    prompt_version: "reward-eval/1",
    effort_multiplier_bps: 30000,
    slot_limit: 1,
    payload: { version: 2 },
  },
  counts: {
    contributions: 3,
    members: 2,
    counted: 2,
    pending: 0,
    pending_at_close: 1,
    pending_reconciliation: 0,
    excluded: 0,
  },
  totals: { point_units: "25500000000", points: "255" },
  snapshot: { status: "frozen", closed_at: ts(2, 1), cutoff_assumption: "clock" },
  allocation: { status: "unavailable", reason: "no_settlement" },
  payment: { status: "unavailable", reason: "no_settlement" },
};
export const finalEpoch = baseEpoch;
export const openEpoch: EpochV1 = {
  ...baseEpoch,
  index: 2,
  opens_at: ts(2),
  closes_at: ts(9),
  status: "open",
  closed: false,
  final: false,
  snapshot: { status: "not_frozen" },
};
export const closingEpoch: EpochV1 = { ...openEpoch, status: "closing", closed: true };

const epochRef = { index: 1, closes_at: ts(2), closed: true, final: true };
export const offTopicRow: ContributionRowV1 = {
  id: id(1),
  epoch: epochRef,
  member_id: id(11),
  wallet: SIGNED,
  wallet_status: "verified",
  kind: "reply",
  url: "https://x.com/a/status/1",
  raid_id: null,
  accepted_at: ts(1, 2),
  state: "counted",
  selected: {
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
    explanation: "Talks about another project.",
    corrected: false,
  },
};
export const upgradedRow: ContributionRowV1 = {
  ...offTopicRow,
  id: id(2),
  selected: {
    revision: 2,
    raw_quality: 85,
    credited_quality: 85,
    credit_rule: "none",
    flags: [],
    effort: "eligible",
    timing_bps: 10000,
    multiplier_bps: 30000,
    point_units: "25500000000",
    points: "255",
    explanation: "Ran the flow and posted the steps.",
    corrected: false,
  },
};
export const pendingRow: ContributionRowV1 = {
  ...offTopicRow,
  id: id(3),
  member_id: id(12),
  wallet: null,
  wallet_status: "unverified",
  kind: "text",
  url: null,
  state: "pending_at_close",
  selected: null,
};

export const contributions: ContributionsV1 = {
  community: { mint: "MintAbc" },
  epoch: { index: 1, closed: true, final: true },
  as_of: ts(3),
  total_contributions: 3,
  offset: 0,
  limit: 50,
  contributions: [upgradedRow, offTopicRow, pendingRow],
};

export const leaderboard: LeaderboardV1 = {
  community: { mint: "MintAbc" },
  epoch: { index: 2, opens_at: ts(2), closes_at: ts(9) },
  closed: false,
  final: false,
  as_of: ts(3),
  total_entries: 2,
  total_contributions: 3,
  offset: 0,
  limit: 50,
  entries: [
    {
      rank: 1,
      member_id: id(11),
      wallet: SIGNED,
      wallet_status: "verified",
      point_units: "12750000000",
      points: "127.5",
      whole_points: "128",
      contributions: 2,
      counted: 2,
      pending: 0,
    },
    {
      rank: 2,
      member_id: id(12),
      wallet: null,
      wallet_status: "unverified",
      point_units: "0",
      points: "0",
      whole_points: "0",
      contributions: 1,
      counted: 0,
      pending: 1,
    },
  ],
};

const revision = (over: Partial<RevisionV1>): RevisionV1 => ({
  revision: 1,
  status: "selected",
  accepted_at: ts(1, 3),
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
  explanation: "Talks about another project.",
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
  ...over,
});

export const offTopic: ContributionV1 = {
  ...offTopicRow,
  community: { mint: "MintAbc" },
  text: "Look at this other coin instead.",
  capture: { source: "x_oembed", captured_at: ts(1, 2), limitations: ["media_not_captured"] },
  reentry_of: null,
  reentered_as: null,
  nomination: null,
  revisions: [
    revision({}),
    revision({
      revision: 2,
      status: "late",
      accepted_at: ts(2, 5),
      affects_allocation: false,
      source: "correction",
      raw_quality: 84,
      credited_quality: 84,
      credit_rule: "none",
      flags: [],
      point_units: "8400000000",
      points: "84",
      explanation: "Re-read as on topic.",
      model: null,
      correction: {
        actor: "admin:cisco",
        authority: "community_admin",
        reason: "On review the reply is about the raid's theme.",
        evidence_refs: ["https://x.com/a/status/9"],
      },
    }),
  ],
};

export const pendingAtClose: ContributionV1 = {
  ...pendingRow,
  community: { mint: "MintAbc" },
  text: "My own test of the claim flow.",
  capture: { source: "telegram_text", captured_at: ts(1, 2), limitations: [] },
  reentry_of: null,
  reentered_as: null,
  nomination: null,
  revisions: [],
};
