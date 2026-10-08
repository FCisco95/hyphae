import { describe, expect, it } from "vitest";
import { z } from "zod";
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
  payout: { status: "not_payable", reasons: ["no_rules_test"], hold: "at_close" },
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
  amendment: null,
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
  settlement: {
    allocation: { status: "unavailable", reason: "no_settlement" },
    payment: { status: "unavailable", reason: "no_settlement" },
  },
  amendments: [],
};

const community = {
  mint: "Mint1",
  name: "Hyphae Lab",
  reward_intake: "open",
  current_epoch: 1,
  epochs: [{ index: 1, opens_at: ts, closes_at: ts, status: "open" }],
  vault: { status: "unavailable", reason: "community_not_on_chain" },
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
      payout: {
        status: "not_payable",
        reasons: ["no_verified_wallet", "no_rules_test"],
        hold: "at_close",
      },
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
    const vault = {
      status: "available",
      network: "solana:mainnet",
      program_id: at[0],
      community_address: at[1],
      vault_address: at[2],
      admin: at[0],
      fee_recipient: at[1],
      balance_lamports: "1500000000",
      outstanding_lamports: "0",
    };
    expect(ok(ReadApiV1.community, { ...community, vault })).toBe(true);
    // The api must send the vault; a consumer accepts a response from before it was added.
    const { vault: _omit, ...withoutVault } = community;
    expect(ok(ReadApiV1.community, withoutVault)).toBe(false);
    expect(ok(ReadApiV1Loose.community, withoutVault)).toBe(true);
    expect(
      ok(ReadApiV1.community, { ...community, vault: { ...vault, balance_lamports: "-1" } }),
    ).toBe(false);
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

// P14 (ruled 2026-09-24): the settlement sections, filled from the stored publication intent and
// the chain once an epoch is published, and the per-wallet claim route.
const PROGRAM = "EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E";
const at = [
  "3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk",
  "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR",
  "Fcv1xtZ6Em1m9xjGmkfinfA3XQ1sEjeCoxy3UioEv4cM",
  "So11111111111111111111111111111111111111112",
  "SysvarRent111111111111111111111111111111111",
  "SysvarC1ock11111111111111111111111111111111",
  "Stake11111111111111111111111111111111111111",
] as const;
const SIG = `5${"j".repeat(86)}`;

const allocation = {
  status: "published",
  network: "solana:devnet",
  program_id: PROGRAM,
  community_address: at[0],
  vault_address: at[1],
  epoch_address: at[2],
  publish_tx: SIG,
  published_at: ts,
  root: "a".repeat(64),
  audit_hash: "b".repeat(64),
  gross_lamports: "500000000",
  fee_bps: "300",
  fee_lamports: "15000000",
  fee_recipient: at[3],
  net_lamports: "485000000",
  allocated_lamports: "304603658",
  cap_remainder_lamports: "180396341",
  dust_lamports: "1",
  payable_members: "3",
};
const claims = [
  {
    member_id: uuid(2),
    wallet: at[4],
    amount_lamports: "121250000",
    status: "paid",
    receipt_address: at[5],
    claim_tx: SIG,
  },
  {
    member_id: uuid(4),
    wallet: at[5],
    amount_lamports: "100548780",
    status: "claimable",
    receipt_address: at[6],
    claim_tx: null,
  },
  {
    member_id: uuid(5),
    wallet: at[6],
    amount_lamports: "82804878",
    status: "claimable",
    receipt_address: at[4],
    claim_tx: null,
  },
];
const payment = {
  status: "available",
  claimed_lamports: "121250000",
  unclaimed_lamports: "183353658",
  claims,
};
// A4: `allocation` and `payment` keep their first v1 shape, a closed `unavailable`; P14 is additive
// in `settlement`.
const seeSettlement = { status: "unavailable", reason: "see_settlement" };
const settled = {
  ...epoch,
  status: "closed",
  closed: true,
  final: true,
  allocation: seeSettlement,
  payment: seeSettlement,
  settlement: { allocation, payment },
};
const settledWith = (over: Record<string, unknown>) => ({
  ...settled,
  settlement: { ...settled.settlement, ...over },
});

const claim = {
  community: { mint: "Mint1" },
  epoch: { index: 2 },
  wallet: at[4],
  network: "solana:devnet",
  program_id: PROGRAM,
  community_address: at[0],
  vault_address: at[1],
  epoch_address: at[2],
  receipt_address: at[5],
  score: "255",
  amount_lamports: "121250000",
  evidence_hash: "c".repeat(64),
  proof: ["d".repeat(64), "e".repeat(64)],
  root: "a".repeat(64),
  payment: {
    status: "claimable",
    recent_blockhash: at[3],
    last_valid_block_height: "1000",
  },
  as_of: ts,
};

describe("P14 settlement sections", () => {
  it("accept a published allocation with its payments, and each honest unavailable state", () => {
    expect(ok(ReadApiV1.epoch, settled)).toBe(true);
    for (const reason of [
      "no_settlement",
      "before_first_paid_epoch",
      "chain_unconfigured",
      "chain_unavailable",
      "chain_mismatch",
      "chain_transaction_missing",
    ]) {
      const unavailable = { status: "unavailable", reason };
      expect(ok(ReadApiV1.epoch, settledWith({ payment: unavailable })), reason).toBe(true);
      expect(
        ok(ReadApiV1.epoch, settledWith({ allocation: unavailable, payment: unavailable })),
      ).toBe(true);
    }
  });

  it("refuse settlement numbers that do not reconcile", () => {
    const bad = (a: Partial<typeof allocation>) =>
      ok(ReadApiV1.epoch, settledWith({ allocation: { ...allocation, ...a } }));
    expect(bad({ fee_lamports: "15000001" })).toBe(false);
    expect(bad({ net_lamports: "485000001" })).toBe(false);
    expect(bad({ dust_lamports: "2" })).toBe(false);
    expect(bad({ publish_tx: "sig-publish" })).toBe(false);
  });

  it("never show a payment without its receipt transaction, nor claimed and unclaimed that disagree", () => {
    const withClaims = (c: typeof claims, p: Partial<typeof payment> = {}) =>
      ok(ReadApiV1.epoch, settledWith({ payment: { ...payment, ...p, claims: c } }));
    expect(withClaims([{ ...claims[0], claim_tx: null }, ...claims.slice(1)] as never)).toBe(false);
    expect(withClaims([claims[0], { ...claims[1], claim_tx: SIG }, claims[2]] as never)).toBe(
      false,
    );
    expect(withClaims(claims, { claimed_lamports: "0", unclaimed_lamports: "304603658" })).toBe(
      false,
    );
    expect(withClaims(claims, { unclaimed_lamports: "183353657" })).toBe(false);
  });

  it("refuse payments shown for an allocation that is not published", () => {
    expect(
      ok(
        ReadApiV1.epoch,
        settledWith({ allocation: { status: "unavailable", reason: "chain_unavailable" } }),
      ),
    ).toBe(false);
  });

  it("keep the first v1 sections closed, so a consumer that knows only them still parses (A4)", () => {
    // The consumer rule for these two fields before P14: a closed `unavailable` with a reason.
    const unavailable = z.object({ status: z.literal("unavailable"), reason: z.string().min(1) });
    const firstV1 = z.object({ allocation: unavailable, payment: unavailable });
    expect(firstV1.safeParse(settled).success).toBe(true);
    expect(ok(ReadApiV1Loose.epoch, settled)).toBe(true);
    // A published allocation in the first v1 fields would be a new value in a closed enum.
    expect(ok(ReadApiV1.epoch, { ...settled, allocation })).toBe(false);
    expect(ok(ReadApiV1.epoch, { ...settled, payment })).toBe(false);
  });

  it("let a consumer read an api that predates the settlement field", () => {
    const { settlement: _, ...before } = settled;
    expect(ok(ReadApiV1Loose.epoch, before)).toBe(true);
    expect(ok(ReadApiV1.epoch, before)).toBe(false);
  });
});

describe("pilot amendments", () => {
  const amendment = {
    effective_at: ts,
    recorded_at: ts,
    actor: "Cisco (founder)",
    reason: "Pilot testing phase.",
    from: {
      config_id: uuid(3),
      prompt_version: "reward-eval/1",
      prompt_template_hash: "a".repeat(64),
    },
    to: {
      config_id: uuid(4),
      prompt_version: "reward-eval/2",
      prompt_template_hash: "b".repeat(64),
    },
  };

  it("are required of this api on the epoch, and optional for a consumer of an older one", () => {
    expect(ok(ReadApiV1.epoch, { ...epoch, amendments: [amendment] })).toBe(true);
    const { amendments: _, ...before } = epoch;
    expect(ok(ReadApiV1.epoch, before)).toBe(false);
    expect(ok(ReadApiV1Loose.epoch, before)).toBe(true);
    expect(
      ok(ReadApiV1.epoch, {
        ...epoch,
        amendments: [{ ...amendment, effective_at: "2026-10-07T18:00:00Z" }],
      }),
    ).toBe(false);
    expect(
      ok(ReadApiV1.epoch, {
        ...epoch,
        amendments: [{ ...amendment, to: { ...amendment.to, prompt_template_hash: "x" } }],
      }),
    ).toBe(false);
  });

  it("name the one a contribution was admitted under, or null", () => {
    const under = { effective_at: ts, prompt_version: "reward-eval/2" };
    expect(ok(ReadApiV1.contribution, { ...contribution, amendment: under })).toBe(true);
    const { amendment: _, ...before } = contribution;
    expect(ok(ReadApiV1.contribution, before)).toBe(false);
    expect(ok(ReadApiV1Loose.contribution, before)).toBe(true);
  });
});

describe("payout status", () => {
  type Payout = { status: string; reasons?: string[]; hold?: string };
  const v = (status: string, reasons: string[], hold: string): Payout => ({
    status,
    reasons,
    hold,
  });
  const rowAt = (closed: boolean, payout: Payout) => ({
    ...row,
    epoch: { ...row.epoch, closed },
    payout,
  });
  const listOf = (closed: boolean, payout: Payout) => ({
    ...contributions,
    contributions: [rowAt(closed, payout)],
  });
  const entry = leaderboard.entries[0];
  const boardOf = (closed: boolean, payout: Payout) => ({
    ...leaderboard,
    closed,
    entries: [{ ...entry, payout }],
  });
  const accepted = (closed: boolean, payout: Payout) =>
    ok(ReadApiV1.contributions, listOf(closed, payout)) &&
    ok(ReadApiV1.contribution, { ...contribution, ...rowAt(closed, payout) }) &&
    ok(ReadApiV1.leaderboard, boardOf(closed, payout));
  const refused = (closed: boolean, payout: Payout) =>
    !ok(ReadApiV1.contributions, listOf(closed, payout)) &&
    !ok(ReadApiV1.contribution, { ...contribution, ...rowAt(closed, payout) }) &&
    !ok(ReadApiV1.leaderboard, boardOf(closed, payout));

  it("is required of this api on rows, contributions and leaderboard entries, and optional for a consumer", () => {
    const { payout: _r, ...bareRow } = row;
    const { payout: _e, ...bareEntry } = entry ?? { payout: null };
    const bare = {
      list: { ...contributions, contributions: [bareRow] },
      one: { ...contribution, payout: undefined },
      board: { ...leaderboard, entries: [bareEntry] },
    };
    expect(ok(ReadApiV1.contributions, bare.list)).toBe(false);
    expect(ok(ReadApiV1.contribution, bare.one)).toBe(false);
    expect(ok(ReadApiV1.leaderboard, bare.board)).toBe(false);
    expect(ok(ReadApiV1Loose.contributions, bare.list)).toBe(true);
    expect(ok(ReadApiV1Loose.contribution, bare.one)).toBe(true);
    expect(ok(ReadApiV1Loose.leaderboard, bare.board)).toBe(true);
  });

  it("before the close: every verdict the gate can reach, with the hold only ever checked at the close", () => {
    for (const p of [
      v("held", ["hold_pending"], "at_close"),
      v("payable", [], "not_required"),
      v("not_payable", ["no_points"], "at_close"),
      v("not_payable", ["no_verified_wallet"], "at_close"),
      v("not_payable", ["no_rules_test"], "at_close"),
      v("not_payable", ["no_verified_wallet", "no_rules_test"], "at_close"),
      v("not_payable", ["no_points", "no_verified_wallet", "no_rules_test"], "at_close"),
      v("not_payable", ["no_verified_wallet"], "not_required"),
      { status: "unpaid_epoch" },
    ]) {
      expect(accepted(false, p), JSON.stringify(p)).toBe(true);
    }
  });

  it("before the close: refuses a hold result, a pass, or a payable verdict that needs one", () => {
    for (const p of [
      v("payable", [], "holder"),
      v("payable", [], "at_close"),
      v("not_payable", ["below_hold"], "below"),
      v("held", ["hold_pending"], "pending"),
      v("not_payable", ["no_rules_test"], "not_checked"),
      { status: "published" },
    ]) {
      expect(refused(false, p), JSON.stringify(p)).toBe(true);
    }
  });

  it("after the close: the decided hold result, a pending check, or no check for a member who misses another condition", () => {
    for (const p of [
      v("payable", [], "holder"),
      v("payable", [], "not_required"),
      v("held", ["hold_pending"], "pending"),
      v("not_payable", ["below_hold"], "below"),
      v("not_payable", ["no_verified_wallet"], "not_checked"),
      v("not_payable", ["no_points", "no_rules_test"], "not_checked"),
      v("not_payable", ["no_rules_test"], "not_required"),
      { status: "unpaid_epoch" },
      { status: "published" },
    ]) {
      expect(accepted(true, p), JSON.stringify(p)).toBe(true);
    }
  });

  it("refuses a verdict whose status, reasons and hold disagree", () => {
    for (const p of [
      v("payable", ["no_rules_test"], "not_checked"),
      v("not_payable", [], "holder"),
      v("held", ["hold_pending", "no_rules_test"], "pending"),
      v("not_payable", ["hold_pending"], "pending"),
      v("not_payable", ["below_hold"], "holder"),
      v("payable", [], "below"),
      v("not_payable", ["no_verified_wallet"], "holder"),
      v("not_payable", ["no_verified_wallet"], "pending"),
      v("not_payable", ["no_verified_wallet"], "at_close"),
      v("held", ["hold_pending"], "not_required"),
      v("not_payable", ["no_verified_wallet", "no_verified_wallet"], "not_checked"),
      v("not_payable", ["telegram_user"], "not_checked"),
      { status: "unpaid_epoch", reasons: [], hold: "at_close" },
    ]) {
      expect(refused(true, p), JSON.stringify(p)).toBe(true);
    }
  });
});

describe("claim route", () => {
  it("accept a claimable leaf, a paid one and an unavailable status", () => {
    expect(ok(ReadApiV1.claim, claim)).toBe(true);
    expect(ok(ReadApiV1.claim, { ...claim, payment: { status: "paid", claim_tx: SIG } })).toBe(
      true,
    );
    expect(
      ok(ReadApiV1.claim, {
        ...claim,
        payment: { status: "unavailable", reason: "chain_unavailable" },
      }),
    ).toBe(true);
  });

  it("refuse a proof node that is not a hash, and a paid status without its transaction", () => {
    expect(ok(ReadApiV1.claim, { ...claim, proof: ["d".repeat(63)] })).toBe(false);
    expect(ok(ReadApiV1.claim, { ...claim, payment: { status: "paid" } })).toBe(false);
  });
});

describe("wallet record", () => {
  const tally = {
    contributions: 2,
    counted: 1,
    credited: 1,
    average_credited_quality: 85,
    point_units: "25500000000",
    points: "255",
  };
  const entry = {
    community: { mint: "Mint1", name: "Hyphae Lab" },
    index: 1,
    opens_at: ts,
    closes_at: ts,
    status: "closed",
    member_id: uuid(2),
    totals: tally,
    contributions: [
      {
        id: uuid(1),
        kind: "reply",
        accepted_at: ts,
        state: "counted",
        credited_quality: 85,
        point_units: "25500000000",
        points: "255",
      },
      {
        id: uuid(4),
        kind: "text",
        accepted_at: ts,
        state: "pending_at_close",
        credited_quality: null,
        point_units: null,
        points: null,
      },
    ],
    payout: {
      status: "allocated",
      network: "solana:mainnet",
      amount_lamports: "121250000",
      payment: { status: "paid", claim_tx: SIG },
    },
  };
  const record = {
    wallet: at[4],
    as_of: ts,
    totals: { communities: 1, epochs: 1, ...tally },
    communities: [{ mint: "Mint1", name: "Hyphae Lab", totals: { epochs: 1, ...tally } }],
    total_epochs: 1,
    offset: 0,
    limit: 50,
    epochs: [entry],
  };
  const withEntry = (over: Record<string, unknown>) => ({
    ...record,
    epochs: [{ ...entry, ...over }],
  });

  it("accept a record with each payout state, and an epoch without a settlement", () => {
    expect(ok(ReadApiV1.walletRecord, record)).toBe(true);
    for (const payment of [
      { status: "claimable" },
      { status: "unavailable", reason: "chain_unavailable" },
    ]) {
      expect(ok(ReadApiV1.walletRecord, withEntry({ payout: { ...entry.payout, payment } }))).toBe(
        true,
      );
    }
    for (const reason of ["no_settlement", "before_first_paid_epoch", "no_allocation"]) {
      expect(
        ok(ReadApiV1.walletRecord, withEntry({ payout: { status: "unavailable", reason } })),
      ).toBe(true);
    }
  });

  it("never call a payout paid without its claim transaction", () => {
    expect(
      ok(
        ReadApiV1.walletRecord,
        withEntry({ payout: { ...entry.payout, payment: { status: "paid" } } }),
      ),
    ).toBe(false);
    expect(
      ok(
        ReadApiV1.walletRecord,
        withEntry({ payout: { status: "allocated", payment: entry.payout.payment } }),
      ),
    ).toBe(false);
  });

  it("refuse Telegram identifiers, X handles and contribution links", () => {
    expect(ok(ReadApiV1.walletRecord, { ...record, telegram_username: "x" })).toBe(false);
    expect(ok(ReadApiV1.walletRecord, withEntry({ x_handle: "someone" }))).toBe(false);
    expect(
      ok(
        ReadApiV1.walletRecord,
        withEntry({
          contributions: [
            { ...entry.contributions[0], url: "https://x.com/someone/status/1" },
            entry.contributions[1],
          ],
        }),
      ),
    ).toBe(false);
  });

  it("refuse counts that cannot hold, and an average without a counted contribution", () => {
    expect(ok(ReadApiV1.walletRecord, withEntry({ totals: { ...tally, credited: 2 } }))).toBe(
      false,
    );
    expect(ok(ReadApiV1.walletRecord, withEntry({ totals: { ...tally, contributions: 3 } }))).toBe(
      false,
    );
    const none = { ...tally, counted: 0, credited: 0, average_credited_quality: 85 };
    expect(ok(ReadApiV1.walletRecord, withEntry({ totals: none }))).toBe(false);
    expect(ok(ReadApiV1.walletRecord, { ...record, totals: { ...record.totals, epochs: 2 } })).toBe(
      false,
    );
  });

  it("refuse a score on a contribution that is not counted, and a counted one without it", () => {
    const [counted, pending] = entry.contributions;
    expect(
      ok(
        ReadApiV1.walletRecord,
        withEntry({ contributions: [counted, { ...pending, credited_quality: 70 }] }),
      ),
    ).toBe(false);
    expect(
      ok(
        ReadApiV1.walletRecord,
        withEntry({ contributions: [{ ...counted, points: null }, pending] }),
      ),
    ).toBe(false);
  });

  it("the loose variant accepts additive fields, for consumers", () => {
    expect(ok(ReadApiV1Loose.walletRecord, { ...record, badges: [] })).toBe(true);
  });
});
