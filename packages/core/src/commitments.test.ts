import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, concatBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import {
  c14n,
  configHash,
  type DecisionPayload,
  decisionPayloadHash,
  type EpochAuditManifest,
  type EvidencePayload,
  epochAuditHash,
  evidencePayloadHash,
  jcs,
  type MemberEpochManifest,
  memberEpochHash,
  TAGS,
  taggedHash,
} from "./commitments.js";

const H = (n: number) => bytesToHex(sha256(utf8ToBytes(`h${n}`)));
const TS = "2026-10-02T00:00:00.000000Z";
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const WALLET = "3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk";

const evidence: EvidencePayload = {
  community_id: ID(1),
  contribution_id: ID(2),
  member_id: ID(3),
  kind: "text",
  url: null,
  text: "gm",
  capture: { source: "telegram_text", captured_at: TS, limitations: [] },
  raid_id: null,
  intake_accepted_at: TS,
  reentry_of: null,
};

const decision: DecisionPayload = {
  community_id: ID(1),
  epoch_id: ID(4),
  contribution_id: ID(2),
  revision: "1",
  predecessor_hash: null,
  config_hash: H(1),
  evidence_hash: H(2),
  source: "model",
  model: {
    model: "claude-sonnet-5",
    prompt_version: "reward-eval/1",
    prompt_hash: H(3),
    input_hash: H(4),
    output_hash: H(5),
  },
  correction: null,
  nomination_id: null,
  raw_quality: "85",
  credited_quality: "85",
  flags: [],
  effort: "not_nominated",
  effort_criteria: null,
  timing_bps: "10000",
  multiplier_bps: "10000",
  point_units: "8500000000",
  explanation: "Specific to the post.",
  accepted_at: TS,
  affects_allocation: true,
};

const epoch = { id: ID(4), index: "2", opens_at: TS, closes_at: "2026-10-09T00:00:00.000000Z" };

const member: MemberEpochManifest = {
  network: "solana:devnet",
  program_id: "EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E",
  community_id: ID(1),
  mint: "So11111111111111111111111111111111111111112",
  epoch,
  config_hash: H(1),
  member_id: ID(3),
  wallet: WALLET,
  entries: [
    { contribution_id: ID(2), decision_hash: H(6), reason: null, point_units: "8500000000" },
    { contribution_id: ID(7), decision_hash: null, reason: "pending_at_close", point_units: "0" },
  ],
  point_units: "8500000000",
  whole_points: "85",
  settlement: {
    status: "payable",
    reasons: [],
    rules_test: { test_id: "mycel-rules-1", passed_at: TS },
    hold: null,
    uncapped_lamports: "10",
    amount_lamports: "10",
    cap_remainder_lamports: "0",
  },
};

describe("hyphae-c14n/1 (B1)", () => {
  it("sorts keys and writes JSON with no whitespace", () => {
    expect(c14n({ b: "1", a: [null, true, { d: "x", c: false }] })).toBe(
      '{"a":[null,true,{"c":false,"d":"x"}],"b":"1"}',
    );
  });

  it("keeps strings as captured: non-ASCII raw, control characters escaped", () => {
    // A combining accent stays unnormalized, and U+2028 stays raw as JSON.stringify writes it.
    const input = `a\u00e7\u00e3o \u2713 \u{1f344} e\u0301 \u0001 \n \u2028`;
    expect(c14n({ t: input })).toBe(
      `{"t":"a\u00e7\u00e3o \u2713 \u{1f344} e\u0301 \\u0001 \\n \u2028"}`,
    );
  });

  it("refuses numbers, undefined, keys outside [a-z0-9_] and lone surrogates", () => {
    expect(() => c14n({ n: 1 })).toThrow(/number/);
    expect(() => c14n({ n: undefined })).toThrow(/undefined/);
    expect(() => c14n({ camelCase: "x" })).toThrow(/key/);
    expect(() => c14n({ "a-b": "x" })).toThrow(/key/);
    expect(() => c14n({ s: "\ud800" })).toThrow(/surrogate/);
    expect(() => c14n({ s: "\udc00x" })).toThrow(/surrogate/);
    expect(() => c14n({ d: new Date(0) })).toThrow(/plain/);
  });
});

describe("full JCS for the config payload (B3)", () => {
  it("accepts decimal numbers and any key, in ECMAScript number form", () => {
    expect(jcs({ weight: 0.35, n: 1, big: 1e21, camelCase: [1.5, -0] })).toBe(
      '{"big":1e+21,"camelCase":[1.5,0],"n":1,"weight":0.35}',
    );
  });

  it("refuses non-finite numbers, undefined and lone surrogates", () => {
    expect(() => jcs({ x: Number.NaN })).toThrow(/finite/);
    expect(() => jcs({ x: Number.POSITIVE_INFINITY })).toThrow(/finite/);
    expect(() => jcs({ x: undefined })).toThrow(/undefined/);
    expect(() => jcs({ x: "\ud800" })).toThrow(/surrogate/);
  });

  it("hashes the same payload the same whatever its key order", () => {
    expect(configHash({ a: 1, b: { c: 0.35 } })).toBe(configHash({ b: { c: 0.35 }, a: 1 }));
  });
});

describe("tagged hashes (B2)", () => {
  it("is sha256(utf8(tag) ‖ 0x00 ‖ c14n bytes), lowercase hex", () => {
    const body = c14n({ a: "1" });
    expect(taggedHash(TAGS.evidence, body)).toBe(
      bytesToHex(
        sha256(concatBytes(utf8ToBytes(TAGS.evidence), Uint8Array.of(0), utf8ToBytes(body))),
      ),
    );
  });

  it("separates domains: the same body under another tag is another hash", () => {
    const body = c14n({ a: "1" });
    const hashes = new Set(Object.values(TAGS).map((tag) => taggedHash(tag, body)));
    expect(hashes.size).toBe(5);
    // A tagged preimage starts with "h" (0x68), never a leaf (0x00) or node (0x01) prefix.
    for (const tag of Object.values(TAGS)) expect(tag.charCodeAt(0)).toBe(0x68);
  });
});

const auditFixture = (): EpochAuditManifest => ({
  network: member.network,
  program_id: member.program_id,
  community_id: member.community_id,
  mint: member.mint,
  epoch,
  config_hash: H(1),
  snapshot: { closed_at: TS, cutoff_assumption: "closes_at is exclusive" },
  entries: member.entries.map((e) => ({ ...e, member_id: ID(3) })),
  members: [
    {
      member_id: ID(3),
      manifest_hash: H(11),
      wallet: WALLET,
      point_units: "8500000000",
      whole_points: "85",
      amount_lamports: "10",
    },
    {
      member_id: ID(8),
      manifest_hash: H(12),
      wallet: null,
      point_units: "0",
      whole_points: "0",
      amount_lamports: "0",
    },
  ],
  settlement: {
    gross_lamports: "100",
    fee_bps: "300",
    fee_lamports: "3",
    fee_recipient: WALLET,
    net_lamports: "97",
    cap_bps: "2500",
    cap_lamports: "24",
    payable_members: "1",
    allocated_lamports: "10",
    cap_remainder_lamports: "0",
    dust_lamports: "87",
    rules_test_id: "mycel-rules-1",
    hold: { mint: member.mint, threshold_raw: "100000000000" },
  },
  root: H(13),
});

describe("payload validation", () => {
  it("hashes evidence independently of key order", () => {
    const reordered = Object.fromEntries(Object.entries(evidence).reverse()) as EvidencePayload;
    expect(evidencePayloadHash(reordered)).toBe(evidencePayloadHash(evidence));
  });

  it("refuses a missing field, a millisecond timestamp and an upper-case hash", () => {
    const { raid_id: _, ...missing } = evidence;
    expect(() => evidencePayloadHash(missing as EvidencePayload)).toThrow();
    expect(() =>
      evidencePayloadHash({ ...evidence, intake_accepted_at: "2026-10-02T00:00:00.000Z" }),
    ).toThrow();
    expect(() => decisionPayloadHash({ ...decision, config_hash: H(1).toUpperCase() })).toThrow();
  });

  it("binds a revision to its predecessor", () => {
    expect(() => decisionPayloadHash({ ...decision, predecessor_hash: H(9) })).toThrow(
      /revision 1/,
    );
    expect(() => decisionPayloadHash({ ...decision, revision: "2" })).toThrow(/predecessor/);
    const second = { ...decision, revision: "2", predecessor_hash: H(9) };
    expect(decisionPayloadHash(second)).not.toBe(
      decisionPayloadHash({ ...second, predecessor_hash: H(10) }),
    );
  });

  it("requires a correction to carry its actor and no model", () => {
    const correction: DecisionPayload = {
      ...decision,
      revision: "2",
      predecessor_hash: H(9),
      source: "correction",
      model: null,
      correction: {
        actor: "admin:cisco",
        authority: "community_admin",
        reason: "Off topic after all.",
        evidence_refs: ["https://x.com/a/status/1"],
      },
    };
    expect(decisionPayloadHash(correction)).toMatch(/^[0-9a-f]{64}$/);
    expect(() => decisionPayloadHash({ ...correction, correction: null })).toThrow(/correction/);
    expect(() => decisionPayloadHash({ ...decision, correction: correction.correction })).toThrow(
      /correction/,
    );
  });

  it("requires flags in ascending order", () => {
    expect(() => decisionPayloadHash({ ...decision, flags: ["spam", "off_topic"] })).toThrow(
      /sorted/,
    );
    expect(decisionPayloadHash({ ...decision, flags: ["off_topic", "spam"] })).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  it("requires a member's entries sorted and summed, and whole points rounded once", () => {
    expect(memberEpochHash(member)).toMatch(/^[0-9a-f]{64}$/);
    expect(() => memberEpochHash({ ...member, entries: [...member.entries].reverse() })).toThrow(
      /sorted/,
    );
    expect(() => memberEpochHash({ ...member, point_units: "1" })).toThrow(/sum/);
    expect(() => memberEpochHash({ ...member, whole_points: "84" })).toThrow(/whole/);
    // An entry has a decision hash or a reason, never both and never neither.
    const both = {
      ...member.entries[1],
      decision_hash: H(8),
    } as MemberEpochManifest["entries"][number];
    expect(() =>
      memberEpochHash({ ...member, entries: [member.entries[0], both] as never }),
    ).toThrow(/decision hash or a reason/);
  });

  it("keeps a member's settlement consistent with its status", () => {
    const payable = member.settlement;
    const with_ = (settlement: Partial<MemberEpochManifest["settlement"]>, extra = {}) => ({
      ...member,
      ...extra,
      settlement: { ...payable, ...settlement },
    });
    expect(() => memberEpochHash(with_({}, { wallet: null }))).toThrow(/payable/);
    expect(() => memberEpochHash(with_({ reasons: ["below_hold"] }))).toThrow(/payable/);
    expect(() =>
      memberEpochHash(with_({ rules_test: { test_id: "mycel-rules-1", passed_at: null } })),
    ).toThrow(/payable/);
    const notPayable = {
      status: "not_payable" as const,
      reasons: ["no_rules_test"],
      uncapped_lamports: "0",
      amount_lamports: "0",
      cap_remainder_lamports: "0",
    };
    expect(memberEpochHash(with_(notPayable))).toMatch(/^[0-9a-f]{64}$/);
    expect(() => memberEpochHash(with_({ ...notPayable, reasons: [] }))).toThrow(/not payable/);
    expect(() =>
      memberEpochHash(with_({ ...notPayable, amount_lamports: "1", uncapped_lamports: "1" })),
    ).toThrow(/not payable/);
  });

  it("requires audit members sorted by member id", () => {
    const audit = auditFixture();
    expect(epochAuditHash(audit)).toMatch(/^[0-9a-f]{64}$/);
    expect(() =>
      epochAuditHash({ ...audit, settlement: { ...audit.settlement, dust_lamports: "86" } }),
    ).toThrow(/reconcile/);
    expect(() =>
      epochAuditHash({ ...audit, settlement: { ...audit.settlement, fee_lamports: "2" } }),
    ).toThrow(/fee/);
    expect(() =>
      epochAuditHash({
        ...audit,
        members: audit.members.map((m, i) => (i === 0 ? { ...m, amount_lamports: "9" } : m)),
      }),
    ).toThrow(/allocated/);
    expect(() => epochAuditHash({ ...audit, members: [...audit.members].reverse() })).toThrow(
      /sorted/,
    );
  });
});

describe("pilot amendments in the epoch audit manifest", () => {
  const amendment = {
    effective_at: "2026-10-07T18:00:00.000000Z",
    recorded_at: "2026-10-07T16:30:00.000000Z",
    actor: "Cisco (founder)",
    reason: "Pilot testing phase: scoring is less strict while members learn the rules.",
    from: { config_hash: H(1), prompt_version: "reward-eval/1", prompt_template_hash: H(21) },
    to: { config_hash: H(22), prompt_version: "reward-eval/2", prompt_template_hash: H(23) },
  };

  it("keeps the bytes of a manifest without an amendment and commits one when present", () => {
    const plain = auditFixture();
    expect(c14n(plain)).not.toContain("amendments");
    const amended = epochAuditHash({ ...plain, amendments: [amendment] });
    expect(amended).not.toBe(epochAuditHash(plain));
    expect(epochAuditHash({ ...plain, amendments: [{ ...amendment, reason: "other" }] })).not.toBe(
      amended,
    );
  });

  it("refuses an empty list, a retroactive entry, or one that does not start from the epoch's config", () => {
    const plain = auditFixture();
    expect(() => epochAuditHash({ ...plain, amendments: [] })).toThrow();
    expect(() =>
      epochAuditHash({
        ...plain,
        amendments: [{ ...amendment, effective_at: amendment.recorded_at }],
      }),
    ).toThrow(/after/);
    expect(() =>
      epochAuditHash({
        ...plain,
        amendments: [{ ...amendment, from: { ...amendment.from, config_hash: H(9) } }],
      }),
    ).toThrow(/config/);
    expect(() =>
      epochAuditHash({
        ...plain,
        amendments: [{ ...amendment, to: { ...amendment.to, config_hash: H(1) } }],
      }),
    ).toThrow(/config/);
  });

  describe("a chain of amendments", () => {
    const second = {
      ...amendment,
      effective_at: "2026-10-07T20:00:00.000000Z",
      recorded_at: "2026-10-07T18:30:00.000000Z",
      from: { ...amendment.to },
      to: { config_hash: H(31), prompt_version: "reward-jev/1", prompt_template_hash: H(32) },
    };

    it("commits two amendments, each starting from the config in force", () => {
      const plain = auditFixture();
      const one = epochAuditHash({ ...plain, amendments: [amendment] });
      const two = epochAuditHash({ ...plain, amendments: [amendment, second] });
      expect(two).not.toBe(one);
    });

    it("refuses a second amendment that does not start from the first one's result", () => {
      const plain = auditFixture();
      expect(() =>
        epochAuditHash({
          ...plain,
          amendments: [amendment, { ...second, from: { ...second.from, config_hash: H(1) } }],
        }),
      ).toThrow(/chain/);
    });

    it("refuses a second amendment that returns to the epoch's config", () => {
      const plain = auditFixture();
      expect(() =>
        epochAuditHash({
          ...plain,
          amendments: [amendment, { ...second, to: { ...second.to, config_hash: H(1) } }],
        }),
      ).toThrow(/config/);
    });

    it("commits the way back to an earlier amendment's config", () => {
      const plain = auditFixture();
      const back = {
        ...second,
        effective_at: "2026-10-07T22:00:00.000000Z",
        recorded_at: "2026-10-07T20:30:00.000000Z",
        from: { ...second.to },
        to: { ...amendment.to },
      };
      expect(() =>
        epochAuditHash({ ...plain, amendments: [amendment, second, back] }),
      ).not.toThrow();
    });

    it("refuses amendments out of order", () => {
      const plain = auditFixture();
      expect(() => epochAuditHash({ ...plain, amendments: [second, amendment] })).toThrow(/sorted/);
    });
  });
});
