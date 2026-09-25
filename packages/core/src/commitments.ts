import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, concatBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { z } from "zod";
import { type PointUnits, wholePoints } from "./reward-points.js";

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
type Entry = { decision_hash: string | null; reason: string | null; point_units: string };
const entryIsSelectedOrReason = (e: Entry) =>
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
    entries: z.array(z.strictObject(entryShape)),
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
  })
  .superRefine((a, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (!ascending(a.entries, (e) => e.contribution_id))
      fail("entries must be sorted by contribution id");
    if (!a.entries.every(entryIsSelectedOrReason)) {
      fail("an entry has a decision hash or a reason (with zero points), never both");
    }
    if (!ascending(a.members, (m) => m.member_id)) fail("members must be sorted by member id");
    const s = a.settlement;
    const n = (v: string) => BigInt(v);
    if (n(s.fee_lamports) !== (n(s.gross_lamports) * n(s.fee_bps)) / 10_000n) {
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
