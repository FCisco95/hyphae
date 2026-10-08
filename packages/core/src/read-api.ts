// Namespace imports let consumer browser bundles discard unused Zod exports.
import * as z from "zod";
import { POINT_UNITS_PER_POINT } from "./reward-points.js";

const DECIMALS = POINT_UNITS_PER_POINT.toString().length - 1;

// Exact points as a decimal string: units / 10^8, never rounded (A3).
export function exactPoints(units: bigint): string {
  if (units < 0n) throw new RangeError("point units must not be negative");
  const whole = units / POINT_UNITS_PER_POINT;
  const fraction = (units % POINT_UNITS_PER_POINT).toString().padStart(DECIMALS, "0");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

export type CreditRule = "none" | "hard_zero" | "ai_cap_mild" | "ai_cap_strong" | "below_floor";

const HARD_ZERO = new Set(["guideline_breach", "spam", "off_topic"]);
const FLOOR = 60;
const AI_CAP_MILD = 79;

// The gate that turned raw quality into credited quality, read back from a stored decision. The
// decision keeps raw, credited and flags; R1's order (hard zero, AI cap, floor) makes these three
// enough. A pair no gate can produce is a bug, so it throws rather than guessing.
export function creditRule(raw: number, flags: readonly string[], credited: number): CreditRule {
  if (credited === raw) return "none";
  if (credited === 0 && flags.some((f) => HARD_ZERO.has(f))) return "hard_zero";
  if (flags.includes("ai_slop")) {
    if (credited === AI_CAP_MILD && raw > AI_CAP_MILD) return "ai_cap_mild";
    if (credited === 0 && raw >= FLOOR) return "ai_cap_strong";
  }
  if (credited === 0 && raw < FLOOR) return "below_floor";
  throw new Error(`read-api: no credit gate turns raw ${raw} into credited ${credited}`);
}

// Public read API v1 response schemas (H-CONTRACT Part A, ruled 2026-09-24). The api checks its
// own output against the strict set; consumers parse with the loose set, which ignores fields
// added later inside v1 (A4) but keeps every rule about the fields it knows.
function readApiSchemas(strict: boolean) {
  const obj = <T extends z.ZodRawShape>(shape: T) =>
    strict ? z.strictObject(shape) : z.object(shape);

  const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
  const uint = z.string().regex(/^(0|[1-9]\d*)$/);
  const decimal = z.string().regex(/^(0|[1-9]\d*)(\.\d*[1-9])?$/);
  const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
  const promptPin = obj({
    config_id: uuid,
    prompt_version: z.string().min(1),
    prompt_template_hash: hex64,
  });
  const count = z.number().int().nonnegative();
  const quality = z.number().int().min(0).max(100);
  const bps = z.number().int().nonnegative();

  const walletShape = {
    wallet: z.string().min(1).nullable(),
    wallet_status: z.enum(["verified", "unverified", "none"]),
  };
  // Only a signed wallet is ever served (A5).
  const walletRule = (o: { wallet: string | null; wallet_status: string }) =>
    (o.wallet_status === "verified") === (o.wallet !== null);

  // scheduled: materialized ahead of its opens_at (a bootstrap creates epoch 1 before it opens).
  const epochStatus = z.enum(["scheduled", "open", "closing", "closed"]);
  const state = z.enum([
    "counted",
    "pending",
    "pending_at_close",
    "pending_reconciliation",
    "excluded",
  ]);
  const unavailable = obj({ status: z.literal("unavailable"), reason: z.string().min(1) });
  const base58 = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  const signature = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/);
  const network = z.enum(["solana:devnet", "solana:mainnet"]);
  const n = (v: string) => BigInt(v);

  // P14: the published allocation, from the stored intent and checked against the epoch account.
  // Every number here comes with the publish transaction.
  const published = obj({
    status: z.literal("published"),
    network,
    program_id: base58,
    community_address: base58,
    vault_address: base58,
    epoch_address: base58,
    publish_tx: signature,
    published_at: iso,
    root: hex64,
    audit_hash: hex64,
    gross_lamports: uint,
    fee_bps: uint,
    fee_lamports: uint,
    fee_recipient: base58,
    net_lamports: uint,
    allocated_lamports: uint,
    cap_remainder_lamports: uint,
    dust_lamports: uint,
    payable_members: uint,
  }).refine(
    (a) =>
      n(a.fee_lamports) === (n(a.gross_lamports) * n(a.fee_bps)) / 10_000n &&
      n(a.net_lamports) === n(a.gross_lamports) - n(a.fee_lamports) &&
      n(a.allocated_lamports) + n(a.cap_remainder_lamports) + n(a.dust_lamports) ===
        n(a.net_lamports),
  );
  // P13: paid means a claim receipt exists on-chain; its transaction is shown with it.
  const claimRow = obj({
    member_id: uuid,
    wallet: base58,
    amount_lamports: uint,
    status: z.enum(["claimable", "paid"]),
    receipt_address: base58,
    claim_tx: signature.nullable(),
  }).refine((c) => (c.status === "paid") === (c.claim_tx !== null));
  const payments = obj({
    status: z.literal("available"),
    claimed_lamports: uint,
    unclaimed_lamports: uint,
    claims: z.array(claimRow),
  }).refine((p) => {
    const paid = p.claims.filter((c) => c.status === "paid");
    const sum = (cs: typeof p.claims) => cs.reduce((s, c) => s + n(c.amount_lamports), 0n);
    return (
      sum(paid) === n(p.claimed_lamports) &&
      sum(p.claims) === n(p.claimed_lamports) + n(p.unclaimed_lamports)
    );
  });
  const settlement = obj({
    allocation: z.union([published, unavailable]),
    payment: z.union([payments, unavailable]),
  }).refine(
    (s) =>
      s.payment.status !== "available" ||
      (s.allocation.status === "published" &&
        n(s.payment.claimed_lamports) + n(s.payment.unclaimed_lamports) ===
          n(s.allocation.allocated_lamports)),
  );
  // One leaf of a published epoch, with every address and the proof a claim needs.
  const leafShape = {
    community: obj({ mint: z.string().min(1) }),
    epoch: obj({ index: count }),
    network,
    program_id: base58,
    community_address: base58,
    vault_address: base58,
    epoch_address: base58,
    receipt_address: base58,
    score: uint,
    amount_lamports: uint,
    evidence_hash: hex64,
    proof: z.array(hex64),
    root: hex64,
  };
  const paid = obj({ status: z.literal("paid"), claim_tx: signature });
  const effort = z.enum(["eligible", "ineligible", "not_nominated"]);
  const creditRules = z.enum(["none", "hard_zero", "ai_cap_mild", "ai_cap_strong", "below_floor"]);

  const selected = obj({
    revision: z.number().int().positive(),
    raw_quality: quality,
    credited_quality: quality,
    credit_rule: creditRules,
    flags: z.array(z.string()),
    effort,
    timing_bps: bps,
    multiplier_bps: bps,
    point_units: uint,
    points: decimal,
    explanation: z.string(),
    corrected: z.boolean(),
  });

  // The payout gate's verdict on a member (P9, P16) as of `as_of`, added inside v1 (A4). Before the
  // close it is the verdict on today's points, signed wallet and rules test, and the hold, read only
  // after the close, is `at_close`. unpaid_epoch: the epoch pays no one (before the community's
  // first paid epoch, or no rules test covers its rubric). published: the settlement is the record.
  const reasons = [
    "no_points",
    "no_verified_wallet",
    "no_rules_test",
    "below_hold",
    "hold_pending",
  ] as const;
  const verdict = obj({
    status: z.enum(["payable", "held", "not_payable"]),
    // Each at most once, in the gate's order.
    reasons: z.array(z.enum(reasons)),
    hold: z.enum(["at_close", "pending", "holder", "below", "not_checked", "not_required"]),
  }).refine((p) => {
    const has = (r: (typeof reasons)[number]) => p.reasons.includes(r);
    const order = p.reasons.map((r) => reasons.indexOf(r));
    return (
      order.every((o, i) => i === 0 || o > (order[i - 1] ?? -1)) &&
      // The gate reads the hold only for a member who meets every other condition.
      (!(has("below_hold") || has("hold_pending")) || p.reasons.length === 1) &&
      (p.status === "payable") === (p.reasons.length === 0) &&
      (p.status === "held") === has("hold_pending") &&
      has("below_hold") === (p.hold === "below") &&
      (p.hold !== "pending" || has("hold_pending")) &&
      (!has("hold_pending") || p.hold === "pending" || p.hold === "at_close") &&
      (p.status !== "payable" || p.hold === "holder" || p.hold === "not_required") &&
      (p.hold !== "holder" || p.status === "payable")
    );
  });
  const payout = z.union([obj({ status: z.enum(["unpaid_epoch", "published"]) }), verdict]);
  // Nothing about the hold is decided before the close, and nothing is published before it.
  const payoutTimeRule = (closed: boolean, p: z.infer<typeof payout> | undefined) =>
    p === undefined ||
    (closed
      ? !("hold" in p) || p.hold !== "at_close"
      : "hold" in p
        ? p.hold === "at_close" || p.hold === "not_required"
        : p.status === "unpaid_epoch");

  const rowShape = {
    id: uuid,
    epoch: obj({ index: count, closes_at: iso, closed: z.boolean(), final: z.boolean() }),
    member_id: uuid,
    ...walletShape,
    kind: z.enum(["reply", "quote", "post", "text"]),
    url: z.string().nullable(),
    raid_id: uuid.nullable(),
    accepted_at: iso,
    state,
    selected: selected.nullable(),
    // Required of this api; optional for a consumer reading an older one.
    payout: payout.optional(),
  };
  const rowRule = (o: {
    state: string;
    selected: unknown;
    epoch: { closed: boolean };
    payout?: z.infer<typeof payout> | undefined;
  }) =>
    (o.state === "counted") === (o.selected !== null) &&
    payoutTimeRule(o.epoch.closed, o.payout) &&
    (!strict || o.payout !== undefined);
  const row = obj(rowShape).refine(walletRule).refine(rowRule);

  const criterion = obj({ met: z.boolean(), note: z.string() });
  const revision = obj({
    revision: z.number().int().positive(),
    status: z.enum(["selected", "superseded", "late"]),
    accepted_at: iso,
    affects_allocation: z.boolean(),
    source: z.enum(["model", "correction"]),
    raw_quality: quality,
    credited_quality: quality,
    credit_rule: creditRules,
    flags: z.array(z.string()),
    effort,
    effort_criteria: obj({
      original_substance: criterion,
      inspectable_work: criterion,
      community_contribution: criterion,
    }).nullable(),
    timing_bps: bps,
    multiplier_bps: bps,
    point_units: uint,
    points: decimal,
    explanation: z.string(),
    model: obj({
      model: z.string(),
      prompt_version: z.string(),
      prompt_hash: hex64,
      input_hash: hex64,
      output_hash: hex64,
      latency_ms: count.nullable(),
      cost_micro_usd: count.nullable(),
    }).nullable(),
    correction: obj({
      actor: z.string().min(1),
      authority: z.enum(["community_admin", "operator_script"]),
      reason: z.string(),
      evidence_refs: z.array(z.string()),
    }).nullable(),
  }).refine(
    (r) =>
      (r.source === "model") === (r.model !== null) &&
      (r.source === "correction") === (r.correction !== null),
  );

  return {
    community: obj({
      mint: z.string().min(1),
      name: z.string(),
      reward_intake: z.enum(["open", "paused"]),
      current_epoch: count.nullable(),
      epochs: z.array(obj({ index: count, opens_at: iso, closes_at: iso, status: epochStatus })),
      // Where to fund the community, from its account on chain, before any epoch is published.
      // Added inside v1 (A4): the api always sends it; consumers accept a response without it.
      vault: z
        .union([
          obj({
            status: z.literal("available"),
            network,
            program_id: base58,
            community_address: base58,
            vault_address: base58,
            admin: base58,
            fee_recipient: base58,
            balance_lamports: uint,
            outstanding_lamports: uint,
          }),
          unavailable,
        ])
        .optional(),
      as_of: iso,
    }).refine((c) => !strict || c.vault !== undefined),
    epoch: obj({
      community: obj({ mint: z.string().min(1), name: z.string() }),
      index: count,
      opens_at: iso,
      closes_at: iso,
      status: epochStatus,
      closed: z.boolean(),
      final: z.boolean(),
      as_of: iso,
      config: obj({
        id: uuid,
        rubric_version: z.string(),
        prompt_version: z.string(),
        effort_multiplier_bps: bps,
        slot_limit: z.number().int().positive(),
        payload: z.record(z.string(), z.unknown()),
      }),
      counts: obj({
        contributions: count,
        members: count,
        counted: count,
        pending: count,
        pending_at_close: count,
        pending_reconciliation: count,
        excluded: count,
      }),
      totals: obj({ point_units: uint, points: decimal }),
      snapshot: z.union([
        obj({ status: z.literal("frozen"), closed_at: iso, cutoff_assumption: z.string() }),
        obj({ status: z.literal("not_frozen") }),
      ]),
      // A4: these keep their first v1 shape, so they stay `unavailable`; P14 is in `settlement`.
      allocation: unavailable,
      payment: unavailable,
      // Required of this api; optional for a consumer reading an older one.
      settlement: settlement.optional(),
      // Pilot amendments of this epoch's scoring prompt: contributions admitted from effective_at
      // on pin `to`. Required of this api; optional for a consumer reading an older one.
      amendments: z
        .array(
          obj({
            effective_at: iso,
            recorded_at: iso,
            actor: z.string().min(1),
            reason: z.string().min(1),
            from: promptPin,
            to: promptPin,
          }),
        )
        .optional(),
    }).refine((e) => !strict || (e.settlement !== undefined && e.amendments !== undefined)),
    contributions: obj({
      community: obj({ mint: z.string().min(1) }),
      epoch: obj({ index: count, closed: z.boolean(), final: z.boolean() }),
      as_of: iso,
      total_contributions: count,
      offset: count,
      limit: z.number().int().min(1).max(100),
      contributions: z.array(row),
    }),
    leaderboard: obj({
      community: obj({ mint: z.string().min(1) }),
      epoch: obj({ index: count, opens_at: iso, closes_at: iso }),
      closed: z.boolean(),
      final: z.boolean(),
      as_of: iso,
      total_entries: count,
      total_contributions: count,
      offset: count,
      limit: z.number().int().min(1).max(100),
      entries: z.array(
        obj({
          rank: z.number().int().positive(),
          member_id: uuid,
          ...walletShape,
          point_units: uint,
          points: decimal,
          whole_points: uint,
          contributions: count,
          counted: count,
          pending: count,
          // Required of this api; optional for a consumer reading an older one.
          payout: payout.optional(),
        })
          .refine(walletRule)
          .refine((e) => !strict || e.payout !== undefined),
      ),
    }).refine((b) => b.entries.every((e) => payoutTimeRule(b.closed, e.payout))),
    contribution: obj({
      ...rowShape,
      community: obj({ mint: z.string().min(1) }),
      text: z.string(),
      capture: obj({
        source: z.enum(["x_oembed", "telegram_text"]),
        captured_at: iso,
        limitations: z.array(z.string()),
      }),
      reentry_of: uuid.nullable(),
      reentered_as: uuid.nullable(),
      nomination: obj({ kind: z.enum(["new_work", "upgrade"]), state: z.string() }).nullable(),
      revisions: z.array(revision),
      // The epoch amendment this contribution was admitted under, if any. Required of this api.
      amendment: obj({ effective_at: iso, prompt_version: z.string().min(1) })
        .nullable()
        .optional(),
    })
      .refine(walletRule)
      .refine(rowRule)
      .refine((c) => !strict || c.amendment !== undefined),
    // One wallet's leaf in a published epoch, with what the claim page needs to build the claim.
    claim: obj({
      ...leafShape,
      wallet: base58,
      payment: z.union([
        obj({
          status: z.literal("claimable"),
          recent_blockhash: base58,
          last_valid_block_height: uint,
        }),
        paid,
        unavailable,
      ]),
      as_of: iso,
    }),
    // Every leaf of one wallet in a published epoch, newest publication first. A claimable leaf
    // carries no blockhash: the epoch's claim route is read again before signing.
    walletClaims: obj({
      wallet: base58,
      as_of: iso,
      total_claims: count,
      offset: count,
      limit: z.number().int().min(1).max(100),
      claims: z.array(
        obj({
          ...leafShape,
          payment: z.union([obj({ status: z.literal("claimable") }), paid, unavailable]),
        }),
      ),
    }),
    error: obj({ error: z.enum(["not_found", "bad_request", "unavailable"]) }),
  };
}

export const ReadApiV1 = readApiSchemas(true);
export const ReadApiV1Loose = readApiSchemas(false);

export type CommunityV1 = z.infer<typeof ReadApiV1.community>;
export type EpochV1 = z.infer<typeof ReadApiV1.epoch>;
export type ContributionsV1 = z.infer<typeof ReadApiV1.contributions>;
export type ContributionRowV1 = ContributionsV1["contributions"][number];
export type LeaderboardV1 = z.infer<typeof ReadApiV1.leaderboard>;
export type LeaderboardEntryV1 = LeaderboardV1["entries"][number];
export type ContributionV1 = z.infer<typeof ReadApiV1.contribution>;
export type RevisionV1 = ContributionV1["revisions"][number];
export type SelectedV1 = NonNullable<ContributionRowV1["selected"]>;
export type ClaimV1 = z.infer<typeof ReadApiV1.claim>;
export type WalletClaimsV1 = z.infer<typeof ReadApiV1.walletClaims>;
export type WalletClaimV1 = WalletClaimsV1["claims"][number];
export type SettlementV1 = NonNullable<EpochV1["settlement"]>;
export type AllocationV1 = SettlementV1["allocation"];
export type PaymentV1 = SettlementV1["payment"];
export type PayoutV1 = NonNullable<ContributionRowV1["payout"]>;
export type PayoutVerdictV1 = Extract<PayoutV1, { reasons: unknown }>;
// What a consumer parses: fields added later inside v1 may be absent from an older api.
export type LooseEpochV1 = z.infer<typeof ReadApiV1Loose.epoch>;
