import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, concatBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { z } from "zod";
import { BASIS_POINTS, type PointUnits, wholePoints } from "./reward-points.js";

// H-CONTRACT Part B commitments (ruled 2026-09-24): the hyphae-c14n/1 profile (B1), tagged
// hashes (B2), and the config, evidence, decision, member-epoch and epoch audit payloads
// (B3–B5, B7, B9). Every payload is validated before it is hashed, so a hash always commits to a
// value that follows the profile.

export const TAGS = {
  config: "hyphae/config/v1",
  evidence: "hyphae/evidence/v1",
  decision: "hyphae/decision/v1",
  memberEpoch: "hyphae/member-epoch/v1",
  epochAudit: "hyphae/epoch-audit/v1",
  // A distribution of one or more rolled-over epochs under one index (B10, B11).
  memberDistribution: "hyphae/member-distribution/v1",
  distributionAudit: "hyphae/distribution-audit/v1",
} as const;
export type Tag = (typeof TAGS)[keyof typeof TAGS];

const KEY = /^[a-z0-9_]+$/;

function checkString(s: string): void {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;
        continue;
      }
      throw new Error("c14n: lone surrogate");
    }
    if (c >= 0xdc00 && c <= 0xdfff) throw new Error("c14n: lone surrogate");
  }
}

function isPlainObject(v: object): v is Record<string, unknown> {
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

// Serialization is JSON.stringify over a sorted copy. For values that pass the walk, that is
// RFC 8785: ECMAScript string escaping and number form, keys sorted by UTF-16 code unit.
function canonical(value: unknown, profile: boolean): string {
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "string") {
      checkString(v);
      return v;
    }
    if (typeof v === "number") {
      if (profile) throw new Error("c14n: a number is not allowed; use a decimal string");
      if (!Number.isFinite(v)) throw new Error("c14n: numbers must be finite");
      return v;
    }
    if (v === undefined) throw new Error("c14n: undefined is not allowed; use null");
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === "object" && isPlainObject(v)) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) {
        checkString(k);
        if (profile && !KEY.test(k)) throw new Error(`c14n: key ${JSON.stringify(k)}`);
        out[k] = walk(v[k]);
      }
      return out;
    }
    throw new Error("c14n: only plain objects, arrays, strings, booleans and null");
  };
  return JSON.stringify(walk(value));
}

// hyphae-c14n/1: no numbers, keys in [a-z0-9_], explicit nulls, strings as captured.
export const c14n = (value: unknown): string => canonical(value, true);
// Full JCS, for the stored config payload, whose rubric weights are decimals (B3).
export const jcs = (value: unknown): string => canonical(value, false);

export function taggedHash(tag: Tag, canonicalJson: string): string {
  return bytesToHex(
    sha256(concatBytes(utf8ToBytes(tag), Uint8Array.of(0), utf8ToBytes(canonicalJson))),
  );
}

export const configHash = (payload: unknown): string => taggedHash(TAGS.config, jcs(payload));

const hash = z.string().regex(/^[0-9a-f]{64}$/, "a hash is 64 lowercase hex characters");
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const dec = z.string().regex(/^(0|[1-9][0-9]*)$/, "an integer is a canonical decimal string");
const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
const base58 = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

const ascending = <T>(values: readonly T[], key: (v: T) => string) =>
  values.every((v, i) => i === 0 || key(values[i - 1] as T) < key(v));

export const EvidencePayload = z.strictObject({
  community_id: uuid,
  contribution_id: uuid,
  member_id: uuid,
  kind: z.enum(["reply", "quote", "post", "text"]),
  url: z.string().nullable(),
  text: z.string(),
  capture: z.strictObject({
    source: z.enum(["x_oembed", "telegram_text"]),
    captured_at: timestamp,
    // Stored order.
    limitations: z.array(z.string()),
  }),
  raid_id: uuid.nullable(),
  intake_accepted_at: timestamp,
  // The original contribution's id, as the read API serves it.
  reentry_of: uuid.nullable(),
});
export type EvidencePayload = z.infer<typeof EvidencePayload>;

const criterion = z.strictObject({ met: z.boolean(), note: z.string() });

export const DecisionPayload = z
  .strictObject({
    community_id: uuid,
    epoch_id: uuid,
    contribution_id: uuid,
    revision: dec,
    predecessor_hash: hash.nullable(),
    config_hash: hash,
    evidence_hash: hash,
    source: z.enum(["model", "correction"]),
    model: z
      .strictObject({
        model: z.string().min(1),
        prompt_version: z.string().min(1),
        prompt_hash: hash,
        input_hash: hash,
        output_hash: hash,
      })
      .nullable(),
    correction: z
      .strictObject({
        actor: z.string().min(1),
        authority: z.enum(["community_admin", "operator_script"]),
        reason: z.string(),
        // Stored order.
        evidence_refs: z.array(z.string()),
      })
      .nullable(),
    nomination_id: uuid.nullable(),
    raw_quality: dec,
    credited_quality: dec,
    flags: z.array(z.string()).refine((f) => ascending(f, (x) => x), "flags must be sorted"),
    effort: z.enum(["eligible", "ineligible", "not_nominated"]),
    effort_criteria: z
      .strictObject({
        community_contribution: criterion,
        inspectable_work: criterion,
        original_substance: criterion,
      })
      .nullable(),
    timing_bps: dec,
    multiplier_bps: dec,
    point_units: dec,
    explanation: z.string(),
    accepted_at: timestamp,
    affects_allocation: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if ((d.revision === "1") !== (d.predecessor_hash === null)) {
      ctx.addIssue({
        code: "custom",
        message: "revision 1 has no predecessor; every later revision has one",
      });
    }
    const isCorrection = d.source === "correction";
    if (isCorrection !== (d.correction !== null) || isCorrection === (d.model !== null)) {
      ctx.addIssue({
        code: "custom",
        message:
          "a correction carries its correction record and no model; a model decision the reverse",
      });
    }
  });
export type DecisionPayload = z.infer<typeof DecisionPayload>;

const network = z.enum(["solana:devnet", "solana:mainnet"]);
const epochRef = z.strictObject({
  id: uuid,
  index: dec,
  opens_at: timestamp,
  closes_at: timestamp,
});
const reason = z.enum(["pending_at_close", "pending_reconciliation", "excluded"]);
const entryShape = {
  contribution_id: uuid,
  decision_hash: hash.nullable(),
  reason: reason.nullable(),
  point_units: dec,
};
const entry = z.strictObject(entryShape);
const entryIsSelectedOrReason = (e: z.infer<typeof entry>) =>
  (e.decision_hash === null) !== (e.reason === null) &&
  (e.reason === null || e.point_units === "0");

export const MemberEpochManifest = z
  .strictObject({
    network,
    program_id: base58,
    community_id: uuid,
    mint: base58,
    epoch: epochRef,
    config_hash: hash,
    member_id: uuid,
    // walletAt(closes_at) when it is signed, else null (B7, D3).
    wallet: base58.nullable(),
    entries: z.array(entry),
    point_units: dec,
    whole_points: dec,
    // Payment rulings P9, P10, P16.
    settlement: z.strictObject({
      status: z.enum(["payable", "not_payable"]),
      reasons: z.array(z.string()),
      rules_test: z.strictObject({ test_id: z.string().min(1), passed_at: timestamp.nullable() }),
      hold: z
        .strictObject({
          mint: base58,
          threshold_raw: dec,
          status: z.enum(["holder", "below"]),
          raw_amount: dec,
          decimals: dec,
          slot: dec,
          provider: z.string().min(1),
          observed_at: timestamp,
        })
        .nullable(),
      uncapped_lamports: dec,
      amount_lamports: dec,
      cap_remainder_lamports: dec,
    }),
  })
  .superRefine((m, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (!ascending(m.entries, (e) => e.contribution_id))
      fail("entries must be sorted by contribution id");
    if (!m.entries.every(entryIsSelectedOrReason)) {
      fail("an entry has a decision hash or a reason (with zero points), never both");
    }
    const total = m.entries.reduce((s, e) => s + BigInt(e.point_units), 0n);
    if (total !== BigInt(m.point_units)) fail("point_units must be the sum of the entries");
    else if (wholePoints(total as PointUnits).toString() !== m.whole_points) {
      fail("whole_points must be point_units rounded half up once");
    }
    if (!ascending(m.settlement.reasons, (r) => r)) fail("reasons must be sorted");
    const s = m.settlement;
    // P9: payable means a signed wallet, a pass before the close and nothing against it.
    if (
      s.status === "payable" &&
      (m.wallet === null || s.reasons.length > 0 || s.rules_test.passed_at === null)
    ) {
      fail("a payable member has a wallet, a rules-test pass and no reasons");
    }
    if (s.status === "not_payable" && (s.reasons.length === 0 || s.uncapped_lamports !== "0")) {
      fail("a member who is not payable has reasons and no share");
    }
    if (
      BigInt(s.amount_lamports) + BigInt(s.cap_remainder_lamports) !==
      BigInt(s.uncapped_lamports)
    ) {
      fail("amount plus cap remainder must be the uncapped share");
    }
  });
export type MemberEpochManifest = z.infer<typeof MemberEpochManifest>;

const promptPin = z.strictObject({
  config_hash: hash,
  prompt_version: z.string().min(1),
  prompt_template_hash: hash,
});
// A pilot amendment of the epoch's scoring prompt or scorer. The list is present only when the
// epoch has one, so a manifest without an amendment keeps the bytes and hash it always had.
const amendment = z.strictObject({
  effective_at: timestamp,
  recorded_at: timestamp,
  actor: z.string().min(1),
  reason: z.string().min(1),
  from: promptPin,
  to: promptPin,
});

export const EpochAuditManifest = z
  .strictObject({
    network,
    program_id: base58,
    community_id: uuid,
    mint: base58,
    epoch: epochRef,
    config_hash: hash,
    snapshot: z.strictObject({ closed_at: timestamp, cutoff_assumption: z.string() }),
    // Every snapshot entry, including zero, pending and excluded ones (B9).
    entries: z.array(z.strictObject({ ...entryShape, member_id: uuid })),
    members: z.array(
      z.strictObject({
        member_id: uuid,
        manifest_hash: hash,
        wallet: base58.nullable(),
        point_units: dec,
        whole_points: dec,
        amount_lamports: dec,
      }),
    ),
    settlement: z.strictObject({
      gross_lamports: dec,
      fee_bps: dec,
      fee_lamports: dec,
      fee_recipient: base58,
      net_lamports: dec,
      cap_bps: dec,
      cap_lamports: dec,
      payable_members: dec,
      allocated_lamports: dec,
      cap_remainder_lamports: dec,
      dust_lamports: dec,
      rules_test_id: z.string().min(1),
      hold: z.strictObject({ mint: base58, threshold_raw: dec }),
    }),
    root: hash,
    amendments: z.array(amendment).min(1).optional(),
  })
  .superRefine((a, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    // Amendments chain: the first starts from the epoch's config, each later one from the result
    // of the one before, and none returns to the epoch's config.
    let inForce = a.config_hash;
    for (const x of a.amendments ?? []) {
      if (x.effective_at <= x.recorded_at) fail("an amendment takes effect after it is recorded");
      if (x.from.config_hash !== inForce) {
        fail("an amendment starts from the config in force: amendments form a chain");
      }
      if (x.to.config_hash === a.config_hash || x.to.config_hash === x.from.config_hash) {
        fail("an amendment changes the config and never returns to the epoch's config");
      }
      inForce = x.to.config_hash;
    }
    if (a.amendments && !ascending(a.amendments, (x) => x.effective_at)) {
      fail("amendments must be sorted by effective time");
    }
    if (!ascending(a.entries, (e) => e.contribution_id))
      fail("entries must be sorted by contribution id");
    if (!a.entries.every(entryIsSelectedOrReason)) {
      fail("an entry has a decision hash or a reason (with zero points), never both");
    }
    if (!ascending(a.members, (m) => m.member_id)) fail("members must be sorted by member id");
    const s = a.settlement;
    const n = (v: string) => BigInt(v);
    if (n(s.fee_lamports) !== (n(s.gross_lamports) * n(s.fee_bps)) / BASIS_POINTS) {
      fail("fee_lamports must be the floored fee on the gross pot");
    }
    if (n(s.net_lamports) !== n(s.gross_lamports) - n(s.fee_lamports)) {
      fail("net must be gross minus the fee");
    }
    if (
      n(s.allocated_lamports) + n(s.cap_remainder_lamports) + n(s.dust_lamports) !==
      n(s.net_lamports)
    ) {
      fail("allocated, cap remainder and dust must reconcile to the net pot");
    }
    const allocated = a.members.reduce((sum, m) => sum + n(m.amount_lamports), 0n);
    if (allocated !== n(s.allocated_lamports))
      fail("members' amounts must sum to allocated_lamports");
  });
export type EpochAuditManifest = z.infer<typeof EpochAuditManifest>;

const hashOf =
  <T>(tag: Tag, schema: z.ZodType<T>) =>
  (payload: T): string =>
    taggedHash(tag, c14n(schema.parse(payload)));

export const evidencePayloadHash = hashOf(TAGS.evidence, EvidencePayload);
export const decisionPayloadHash = hashOf(TAGS.decision, DecisionPayload);
export const memberEpochHash = hashOf(TAGS.memberEpoch, MemberEpochManifest);
export const epochAuditHash = hashOf(TAGS.epochAudit, EpochAuditManifest);

// B10 and B11 (Organic design 2026-11-03, §8): one distribution pays every epoch rolled over
// since the last one, under the latest epoch's index. Each epoch keeps its own B7 member-epoch
// manifests, with the member's share of that epoch's slice; B10 is the leaf's evidence and sums a
// member's parts; B11 is the on-chain audit hash and reconciles every lamport across the slices.

// Fields the program reads as u64, and the sums that feed them.
const MAX_U64 = (1n << 64n) - 1n;
const u64 = dec.refine((v) => BigInt(v) <= MAX_U64, "a field does not fit a u64");

const ascendingDec = <T>(values: readonly T[], key: (v: T) => string) =>
  values.every((v, i) => i === 0 || BigInt(key(values[i - 1] as T)) < BigInt(key(v)));

export const MemberDistributionManifest = z
  .strictObject({
    network,
    program_id: base58,
    community_id: uuid,
    mint: base58,
    distribution_index: u64,
    member_id: uuid,
    wallet: base58,
    parts: z
      .array(
        z.strictObject({
          epoch_index: u64,
          // The B7 manifest of this member in that epoch.
          member_epoch_hash: hash,
          whole_points: u64,
          amount_lamports: u64,
        }),
      )
      .min(1),
    whole_points: u64,
    amount_lamports: u64,
  })
  .superRefine((m, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (!ascendingDec(m.parts, (p) => p.epoch_index)) fail("parts must be sorted by epoch index");
    const last = m.parts[m.parts.length - 1];
    if (last && BigInt(last.epoch_index) > BigInt(m.distribution_index)) {
      fail("a part cannot come from an epoch after the distribution");
    }
    const points = m.parts.reduce((s, p) => s + BigInt(p.whole_points), 0n);
    const amount = m.parts.reduce((s, p) => s + BigInt(p.amount_lamports), 0n);
    if (points !== BigInt(m.whole_points)) fail("whole_points must sum the parts");
    if (amount !== BigInt(m.amount_lamports)) fail("amount must sum the parts");
    if (m.amount_lamports === "0") fail("a distributed member is paid a positive amount");
  });
export type MemberDistributionManifest = z.infer<typeof MemberDistributionManifest>;

const distributionEpoch = z.strictObject({
  epoch: epochRef,
  config_hash: hash,
  snapshot: z.strictObject({ closed_at: timestamp, cutoff_assumption: z.string() }),
  entries: z.array(z.strictObject({ ...entryShape, member_id: uuid })),
  members: z.array(
    z.strictObject({
      member_id: uuid,
      manifest_hash: hash,
      wallet: base58.nullable(),
      point_units: dec,
      whole_points: u64,
      amount_lamports: u64,
    }),
  ),
  accrual_lamports: u64,
  // Null when the volume was unknown at the decision.
  volume_lamports: u64.nullable(),
  // The epoch whose slice carries this accrual when nobody here was payable, else null.
  merged_into: dec.nullable(),
  gross_lamports: u64,
  net_lamports: u64,
  cap_bps: dec,
  cap_lamports: u64,
  payable_members: dec,
  allocated_lamports: u64,
  cap_remainder_lamports: u64,
  dust_lamports: u64,
  rules_test_id: z.string().min(1),
  hold: z.strictObject({ mint: base58, threshold_raw: dec }),
});
type DistributionEpoch = z.infer<typeof distributionEpoch>;
type LamportKey =
  | "accrual_lamports"
  | "gross_lamports"
  | "net_lamports"
  | "allocated_lamports"
  | "cap_remainder_lamports"
  | "dust_lamports";

export const DistributionAuditManifest = z
  .strictObject({
    network,
    program_id: base58,
    community_id: uuid,
    mint: base58,
    distribution: z.strictObject({
      index: u64,
      policy: z.strictObject({
        threshold_volume_lamports: u64,
        basis: z.enum(["cumulative", "per_epoch"]),
        split: z.literal("per_epoch"),
        volume_source: z.literal("fee_derived"),
        reward_bps_of_volume: dec.nullable(),
      }),
      // The volume the decision compared with the threshold.
      volume_lamports: u64,
    }),
    epochs: z.array(distributionEpoch).min(1),
    members: z
      .array(
        z.strictObject({
          member_id: uuid,
          manifest_hash: hash,
          wallet: base58,
          whole_points: u64,
          amount_lamports: u64,
        }),
      )
      .min(1),
    settlement: z.strictObject({
      gross_lamports: u64,
      fee_bps: dec,
      fee_lamports: u64,
      fee_recipient: base58,
      net_lamports: u64,
      allocated_lamports: u64,
      cap_remainder_lamports: u64,
      dust_lamports: u64,
    }),
    root: hash,
  })
  .superRefine((a, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const n = (v: string) => BigInt(v);
    const total = (key: LamportKey) =>
      a.epochs.reduce((s, e: DistributionEpoch) => s + n(e[key]), 0n);
    if (!ascendingDec(a.epochs, (e) => e.epoch.index)) fail("epochs must be sorted by index");
    const last = a.epochs[a.epochs.length - 1];
    if (last && last.epoch.index !== a.distribution.index) {
      fail("a distribution is published under its latest epoch's index");
    }
    // The decision volume follows from the recorded volumes exactly as decide() computes it.
    const known = a.epochs.flatMap((e) =>
      e.volume_lamports === null ? [] : [n(e.volume_lamports)],
    );
    const decided =
      a.distribution.policy.basis === "per_epoch"
        ? last?.volume_lamports == null
          ? null
          : n(last.volume_lamports)
        : known.length
          ? known.reduce((x, y) => x + y, 0n)
          : null;
    if (decided === null || decided !== n(a.distribution.volume_lamports)) {
      fail("the decision volume must follow from the epochs' volumes and the basis");
    }
    if (n(a.distribution.volume_lamports) < n(a.distribution.policy.threshold_volume_lamports)) {
      fail("a distribution's volume meets the threshold");
    }
    const indices = new Set(a.epochs.map((e) => e.epoch.index));
    for (const e of a.epochs) {
      if (!ascending(e.entries, (x) => x.contribution_id)) {
        fail("entries must be sorted by contribution id");
      }
      if (!e.entries.every(entryIsSelectedOrReason)) {
        fail("an entry has a decision hash or a reason (with zero points), never both");
      }
      if (!ascending(e.members, (m) => m.member_id)) fail("members must be sorted by member id");
      const merged = a.epochs
        .filter((x) => x.merged_into === e.epoch.index)
        .reduce((s, x) => s + n(x.accrual_lamports), 0n);
      if (e.merged_into !== null) {
        if (!indices.has(e.merged_into) || e.merged_into === e.epoch.index) {
          fail("an epoch merges into another epoch of the distribution");
        }
        if (merged !== 0n || e.gross_lamports !== "0" || e.net_lamports !== "0") {
          fail("an epoch merged away has no slice");
        }
        if (e.payable_members !== "0") fail("an epoch merged away has nobody payable");
      } else if (n(e.gross_lamports) !== n(e.accrual_lamports) + merged) {
        fail("a slice's gross is its accrual plus the accruals merged into it");
      }
      if (
        n(e.allocated_lamports) + n(e.cap_remainder_lamports) + n(e.dust_lamports) !==
        n(e.net_lamports)
      ) {
        fail("a slice's allocated, cap remainder and dust must reconcile to its net");
      }
      const paid = e.members.reduce((s, m) => s + n(m.amount_lamports), 0n);
      if (paid !== n(e.allocated_lamports)) fail("a slice's members must sum to its allocation");
    }
    const s = a.settlement;
    // P7: the program charges 300 basis points; any other fee would let allocated exceed its net.
    if (s.fee_bps !== "300") fail("the fee is the program's 300 basis points");
    if (n(s.gross_lamports) === 0n || n(s.allocated_lamports) === 0n) {
      fail("a distribution has a positive gross and allocation");
    }
    if (total("accrual_lamports") !== n(s.gross_lamports)) fail("gross must sum the accruals");
    if (total("gross_lamports") !== n(s.gross_lamports)) fail("gross must sum the slices");
    if (n(s.fee_lamports) !== (n(s.gross_lamports) * n(s.fee_bps)) / BASIS_POINTS) {
      fail("fee_lamports must be the floored fee on the gross pot");
    }
    if (n(s.net_lamports) !== n(s.gross_lamports) - n(s.fee_lamports)) {
      fail("net must be gross minus the fee");
    }
    if (total("net_lamports") !== n(s.net_lamports)) fail("the slices must share the net exactly");
    if (total("allocated_lamports") !== n(s.allocated_lamports)) {
      fail("allocated must sum the slices");
    }
    if (total("cap_remainder_lamports") !== n(s.cap_remainder_lamports)) {
      fail("cap remainder must sum the slices");
    }
    if (total("dust_lamports") !== n(s.dust_lamports)) fail("dust must sum the slices");
    if (!ascending(a.members, (m) => m.member_id)) fail("members must be sorted by member id");
    if (new Set(a.members.map((m) => m.wallet)).size !== a.members.length) {
      fail("each wallet has one leaf");
    }
    const distributed = a.members.reduce((sum, m) => sum + n(m.amount_lamports), 0n);
    if (distributed !== n(s.allocated_lamports)) {
      fail("members' amounts must sum to allocated_lamports");
    }
    // Each member's leaf is the sum of their epoch rows, with the wallet of the latest epoch that
    // pays them; equal grand totals must not hide a lamport moved from one person to another.
    const expected = new Map<string, { amount: bigint; points: bigint; wallet: string | null }>();
    for (const e of a.epochs) {
      for (const m of e.members) {
        const x = expected.get(m.member_id) ?? { amount: 0n, points: 0n, wallet: null };
        x.amount += n(m.amount_lamports);
        x.points += n(m.whole_points);
        if (n(m.amount_lamports) > 0n) x.wallet = m.wallet;
        expected.set(m.member_id, x);
      }
    }
    const paid = [...expected].filter(([, x]) => x.amount > 0n);
    if (paid.length !== a.members.length) fail("every paid member has exactly one summary row");
    for (const m of a.members) {
      const x = expected.get(m.member_id);
      if (
        !x ||
        x.amount !== n(m.amount_lamports) ||
        x.points !== n(m.whole_points) ||
        x.wallet !== m.wallet
      ) {
        fail("a member's summary must equal the sum of their epoch rows");
      }
    }
  });
export type DistributionAuditManifest = z.infer<typeof DistributionAuditManifest>;

export const memberDistributionHash = hashOf(TAGS.memberDistribution, MemberDistributionManifest);
export const distributionAuditHash = hashOf(TAGS.distributionAudit, DistributionAuditManifest);
