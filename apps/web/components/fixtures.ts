import type {
  ClaimV1,
  CommunityV1,
  ContributionRowV1,
  ContributionsV1,
  ContributionV1,
  EpochV1,
  LeaderboardV1,
  LooseEpochV1,
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
  vault: { status: "unavailable", reason: "community_not_on_chain" },
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
  settlement: {
    allocation: { status: "unavailable", reason: "no_settlement" },
    payment: { status: "unavailable", reason: "no_settlement" },
  },
  amendments: [],
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
export const AMENDED_AT = "2026-10-07T18:00:00.000000Z";
export const amendedEpoch: EpochV1 = {
  ...openEpoch,
  amendments: [
    {
      effective_at: AMENDED_AT,
      recorded_at: "2026-10-07T16:30:00.000000Z",
      actor: "Cisco (founder)",
      reason: "Pilot testing phase: scoring is less strict while members learn the rules.",
      from: {
        config_id: id(90),
        prompt_version: "reward-eval/1",
        prompt_template_hash: "a".repeat(64),
      },
      to: {
        config_id: id(91),
        prompt_version: "reward-eval/2",
        prompt_template_hash: "b".repeat(64),
      },
    },
  ],
};

export const PROGRAM = "EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E";
export const PUBLISH_TX = `5${"P".repeat(86)}`;
export const CLAIM_TX = `4${"C".repeat(86)}`;
const addr = [
  "3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk",
  "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR",
  "Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM",
  "So11111111111111111111111111111111111111112",
  "SysvarRent111111111111111111111111111111111",
  "SysvarC1ock11111111111111111111111111111111",
] as const;
// A published, partly claimed epoch: the seeded_ready_epoch numbers.
const seeSettlement = { status: "unavailable", reason: "see_settlement" } as const;
export const settledEpoch: EpochV1 = {
  ...baseEpoch,
  index: 2,
  allocation: seeSettlement,
  payment: seeSettlement,
  settlement: {
    allocation: {
      status: "published",
      network: "solana:devnet",
      program_id: PROGRAM,
      community_address: addr[0],
      vault_address: addr[1],
      epoch_address: addr[2],
      publish_tx: PUBLISH_TX,
      published_at: ts(9, 1),
      root: "a".repeat(64),
      audit_hash: "b".repeat(64),
      gross_lamports: "500000000",
      fee_bps: "300",
      fee_lamports: "15000000",
      fee_recipient: addr[3],
      net_lamports: "485000000",
      allocated_lamports: "304603658",
      cap_remainder_lamports: "180396341",
      dust_lamports: "1",
      payable_members: "3",
    },
    payment: {
      status: "available",
      claimed_lamports: "121250000",
      unclaimed_lamports: "183353658",
      claims: [
        {
          member_id: id(11),
          wallet: addr[4],
          amount_lamports: "121250000",
          status: "paid",
          receipt_address: addr[5],
          claim_tx: CLAIM_TX,
        },
        {
          member_id: id(12),
          wallet: addr[5],
          amount_lamports: "183353658",
          status: "claimable",
          receipt_address: addr[4],
          claim_tx: null,
        },
      ],
    },
  },
};
const unavailableEpoch = (reason: string): EpochV1 => ({
  ...baseEpoch,
  allocation: { status: "unavailable", reason },
  payment: { status: "unavailable", reason },
  settlement: {
    allocation: { status: "unavailable", reason },
    payment: { status: "unavailable", reason },
  },
});
export const retainedEpoch = unavailableEpoch("before_first_paid_epoch");
export const chainDownEpoch = { ...unavailableEpoch("chain_unavailable"), index: 2 };
// An epoch from an api that predates the settlement field: only the first v1 sections.
const { settlement: _, amendments: _amendments, ...firstV1 } = baseEpoch;
export const firstV1Epoch: LooseEpochV1 = firstV1;

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
  amendment: null,
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
  amendment: null,
  revisions: [],
};
export const amendedContribution: ContributionV1 = {
  ...pendingAtClose,
  amendment: { effective_at: AMENDED_AT, prompt_version: "reward-eval/2" },
};

export const claim: ClaimV1 = {
  community: { mint: "MintAbc" },
  epoch: { index: 2 },
  wallet: addr[4],
  network: "solana:devnet",
  program_id: PROGRAM,
  community_address: addr[0],
  vault_address: addr[1],
  epoch_address: addr[2],
  receipt_address: addr[5],
  score: "255",
  amount_lamports: "121250000",
  evidence_hash: "c".repeat(64),
  proof: ["d".repeat(64)],
  root: "a".repeat(64),
  payment: { status: "claimable", recent_blockhash: addr[3], last_valid_block_height: "1000" },
  as_of: ts(9, 2),
};
