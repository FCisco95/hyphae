import { createPrivateKey, createPublicKey } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { allocate } from "./allocation.js";
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
} from "./commitments.js";
import { buildTree, encodeLeaf, getProof, type Leaf, leafHash, verifyProof } from "./merkle.js";

// The shared H-CONTRACT vectors (B10). This test computes every vector from fixed inputs and
// compares the result with the committed file; the Rust tests in programs/hyphae and
// tests/h_contract_vectors.py read the same file. Regenerating it (UPDATE_VECTORS=1) is a
// reviewed change.
const FILE = new URL("./test-vectors/h-contract-v1.json", import.meta.url);

const MAX_U64 = (1n << 64n) - 1n;
const EPOCH_INDEX = 2n;

// Claim wallets are real ed25519 keys, so the program tests can sign claims for these leaves.
const PKCS8_ED25519 = hexToBytes("302e020100300506032b657004220420");
function walletOf(seed: Uint8Array): Uint8Array {
  const key = createPrivateKey({
    key: Buffer.from(concatBytes(PKCS8_ED25519, seed)),
    format: "der",
    type: "pkcs8",
  });
  const jwk = createPublicKey(key).export({ format: "jwk" });
  return new Uint8Array(Buffer.from(jwk.x as string, "base64url"));
}

const seedOf = (n: number) => new Uint8Array(32).fill(n);
const evidenceOf = (n: number) => sha256(utf8ToBytes(`hyphae vector evidence ${n}`));

const LEAF_INPUTS: { name: string; n: number; score: bigint; amount: bigint }[] = [
  { name: "a", n: 1, score: 255n, amount: 121_250_000n },
  { name: "b", n: 2, score: 85n, amount: 108_486_842n },
  { name: "c", n: 3, score: 40n, amount: 51_052_631n },
  // A member can have score 0 and a positive amount (O5: weight is exact units).
  { name: "d", n: 4, score: 0n, amount: 1n },
  { name: "e", n: 5, score: MAX_U64, amount: 7n },
];

const leafOf = (i: (typeof LEAF_INPUTS)[number]): Leaf => ({
  wallet: walletOf(seedOf(i.n)),
  epochIndex: EPOCH_INDEX,
  score: i.score,
  amount: i.amount,
  evidenceHash: evidenceOf(i.n),
});

const compareBytes = (a: Uint8Array, b: Uint8Array) => {
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return a.length - b.length;
};

function merkleVectors() {
  const leaves = LEAF_INPUTS.map((i) => {
    const leaf = leafOf(i);
    return {
      name: i.name,
      seed: bytesToHex(seedOf(i.n)),
      wallet: bytesToHex(leaf.wallet),
      epoch_index: EPOCH_INDEX.toString(),
      score: i.score.toString(),
      amount: i.amount.toString(),
      evidence_hash: bytesToHex(leaf.evidenceHash),
      encoded: bytesToHex(encodeLeaf(leaf)),
      hash: bytesToHex(leafHash(leaf)),
    };
  });
  const trees = [1, 2, 3, 5].map((size) => {
    // Leaves enter the tree ordered by leaf hash, so the root depends on the leaves alone.
    const members = leaves
      .slice(0, size)
      .sort((x, y) => compareBytes(hexToBytes(x.hash), hexToBytes(y.hash)));
    const tree = buildTree(members.map((m) => hexToBytes(m.hash)));
    return {
      leaves: members.map((m) => m.name),
      root: bytesToHex(tree.root),
      proofs: Object.fromEntries(
        members.map((m, i) => [m.name, getProof(tree, i).map((p) => bytesToHex(p))]),
      ),
    };
  });
  const three = trees[2] as (typeof trees)[number];
  const proofB = three.proofs.b as string[];
  const flipped = hexToBytes(proofB[0] as string);
  flipped[31] = (flipped[31] as number) ^ 0x01;
  return {
    leaves,
    trees,
    tampered: [
      { tree: 3, leaf: "b", proof: [bytesToHex(flipped), ...proofB.slice(1)], valid: false },
    ],
  };
}

// Anchor's default discriminators: the first 8 bytes of sha256("global:<ix>") and
// sha256("account:<Name>").
const disc = (preimage: string) => sha256(utf8ToBytes(preimage)).slice(0, 8);
const u64 = (v: bigint) => {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, v, true);
  return out;
};
const i64 = (v: bigint) => {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigInt64(0, v, true);
  return out;
};
const u32 = (v: number) => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, v, true);
  return out;
};
const key = (n: number) => walletOf(seedOf(0x40 + n));

function programVectors() {
  const community = {
    mint: bytesToHex(key(1)),
    admin: bytesToHex(key(2)),
    fee_recipient: bytesToHex(key(3)),
    outstanding_lamports: "280789473",
    bump: 254,
    vault_bump: 253,
  };
  const epoch = {
    community: bytesToHex(key(4)),
    index: "2",
    root: bytesToHex(sha256(utf8ToBytes("root"))),
    audit_hash: bytesToHex(sha256(utf8ToBytes("audit"))),
    gross_lamports: "500000000",
    fee_lamports: "15000000",
    allocated_lamports: "280789473",
    claimed_lamports: "121250000",
    published_at: "1791518400",
    bump: 251,
  };
  const receipt = {
    epoch: bytesToHex(key(5)),
    wallet: bytesToHex(key(6)),
    score: "255",
    amount: "121250000",
    evidence_hash: bytesToHex(evidenceOf(1)),
    claimed_at: "1791522000",
    bump: 250,
  };
  const b = (h: string) => hexToBytes(h);
  const proof = [sha256(utf8ToBytes("p1")), sha256(utf8ToBytes("p2"))];
  return {
    instructions: {
      initialize_community: {
        discriminator: bytesToHex(disc("global:initialize_community")),
        accounts: [
          { name: "admin", writable: true, signer: true },
          { name: "mint", writable: false, signer: false },
          { name: "community", writable: true, signer: false },
          { name: "vault", writable: true, signer: false },
          { name: "system_program", writable: false, signer: false },
        ],
        args: { fee_recipient: community.fee_recipient },
        data: bytesToHex(
          concatBytes(disc("global:initialize_community"), b(community.fee_recipient)),
        ),
      },
      publish_epoch: {
        discriminator: bytesToHex(disc("global:publish_epoch")),
        accounts: [
          { name: "admin", writable: true, signer: true },
          { name: "community", writable: true, signer: false },
          { name: "vault", writable: true, signer: false },
          { name: "fee_recipient", writable: true, signer: false },
          { name: "epoch", writable: true, signer: false },
          { name: "system_program", writable: false, signer: false },
        ],
        args: {
          index: epoch.index,
          root: epoch.root,
          audit_hash: epoch.audit_hash,
          gross_lamports: epoch.gross_lamports,
          allocated_lamports: epoch.allocated_lamports,
        },
        data: bytesToHex(
          concatBytes(
            disc("global:publish_epoch"),
            u64(BigInt(epoch.index)),
            b(epoch.root),
            b(epoch.audit_hash),
            u64(BigInt(epoch.gross_lamports)),
            u64(BigInt(epoch.allocated_lamports)),
          ),
        ),
      },
      claim: {
        discriminator: bytesToHex(disc("global:claim")),
        accounts: [
          { name: "claimant", writable: true, signer: true },
          { name: "community", writable: true, signer: false },
          { name: "vault", writable: true, signer: false },
          { name: "epoch", writable: true, signer: false },
          { name: "receipt", writable: true, signer: false },
          { name: "system_program", writable: false, signer: false },
        ],
        args: {
          score: receipt.score,
          amount: receipt.amount,
          evidence_hash: receipt.evidence_hash,
          proof: proof.map((p) => bytesToHex(p)),
        },
        data: bytesToHex(
          concatBytes(
            disc("global:claim"),
            u64(BigInt(receipt.score)),
            u64(BigInt(receipt.amount)),
            b(receipt.evidence_hash),
            u32(proof.length),
            ...proof,
          ),
        ),
      },
    },
    accounts: {
      community: {
        discriminator: bytesToHex(disc("account:Community")),
        fields: community,
        data: bytesToHex(
          concatBytes(
            disc("account:Community"),
            b(community.mint),
            b(community.admin),
            b(community.fee_recipient),
            u64(BigInt(community.outstanding_lamports)),
            Uint8Array.of(community.bump, community.vault_bump),
          ),
        ),
      },
      vault: {
        discriminator: bytesToHex(disc("account:Vault")),
        fields: { bump: 252 },
        data: bytesToHex(concatBytes(disc("account:Vault"), Uint8Array.of(252))),
      },
      epoch: {
        discriminator: bytesToHex(disc("account:Epoch")),
        fields: epoch,
        data: bytesToHex(
          concatBytes(
            disc("account:Epoch"),
            b(epoch.community),
            u64(BigInt(epoch.index)),
            b(epoch.root),
            b(epoch.audit_hash),
            u64(BigInt(epoch.gross_lamports)),
            u64(BigInt(epoch.fee_lamports)),
            u64(BigInt(epoch.allocated_lamports)),
            u64(BigInt(epoch.claimed_lamports)),
            i64(BigInt(epoch.published_at)),
            Uint8Array.of(epoch.bump),
          ),
        ),
      },
      claim_receipt: {
        discriminator: bytesToHex(disc("account:ClaimReceipt")),
        fields: receipt,
        data: bytesToHex(
          concatBytes(
            disc("account:ClaimReceipt"),
            b(receipt.epoch),
            b(receipt.wallet),
            u64(BigInt(receipt.score)),
            u64(BigInt(receipt.amount)),
            b(receipt.evidence_hash),
            i64(BigInt(receipt.claimed_at)),
            Uint8Array.of(receipt.bump),
          ),
        ),
      },
    },
  };
}

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const COMMUNITY = id(1);
const EPOCH = {
  id: id(2),
  index: "2",
  opens_at: "2026-10-02T00:00:00.000000Z",
  closes_at: "2026-10-09T00:00:00.000000Z",
};
const MINT = "So11111111111111111111111111111111111111112";
const PROGRAM_ID = "EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E";
const WALLET_A = "3nVsVs3QSv6Yf1XtRj2d1s2ySSeeNQbtztHwm4VhNgbk";
const FEE_RECIPIENT = "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR";
const COMBINING_ACUTE = String.fromCharCode(0x301);
const BELL = String.fromCharCode(7);

// Built by buildRewardConfigPayload from docs/rubrics/mycel-1.2.0.json with prompt reward-eval/1,
// the code that bootstrapped MYCEL epoch 1. It is not read back from the production database.
const MYCEL_CONFIG = JSON.parse(
  readFileSync(new URL("./test-vectors/mycel-1.2.0-config.json", import.meta.url), "utf8"),
);

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Decode(s: string): Uint8Array {
  let n = 0n;
  for (const ch of s) n = n * 58n + BigInt(BASE58.indexOf(ch));
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

const hashed = <T>(payload: T, hash: (p: T) => string) => ({
  payload,
  c14n: c14n(payload),
  hash: hash(payload),
});

function commitmentVectors() {
  const configs = [
    { name: "mycel_1_2_0", payload: MYCEL_CONFIG },
    {
      name: "non_ascii",
      payload: {
        version: 2,
        rubric: { community: "Hyphae Lab ação ✓", weights: [0.35, 0.3, 1e21] },
        note: `cafe${COMBINING_ACUTE} 🍄`,
      },
    },
  ].map((c) => ({ ...c, jcs: jcs(c.payload), hash: configHash(c.payload) }));
  const configH = (configs[0] as (typeof configs)[number]).hash;

  const evidence: Record<string, EvidencePayload> = {
    x_post: {
      community_id: COMMUNITY,
      contribution_id: id(10),
      member_id: id(20),
      kind: "reply",
      url: "https://x.com/hyphae/status/1971234567890123456",
      text: "Interesting that the claim is one receipt per wallet; how does that scale past 1k members?",
      capture: {
        source: "x_oembed",
        captured_at: "2026-10-03T10:04:05.123000Z",
        limitations: ["media_not_captured", "quoted_post_not_captured"],
      },
      raid_id: id(30),
      intake_accepted_at: "2026-10-03T10:04:05.456789Z",
      reentry_of: null,
    },
    submit_text: {
      community_id: COMMUNITY,
      contribution_id: id(11),
      member_id: id(20),
      kind: "text",
      url: null,
      text: `Wrote a guide 🍄 for the cafe${COMBINING_ACUTE} crowd${BELL}\n"quoted" \\ done`,
      capture: {
        source: "telegram_text",
        captured_at: "2026-10-04T08:00:00.000000Z",
        limitations: [],
      },
      raid_id: null,
      intake_accepted_at: "2026-10-04T08:00:00.000001Z",
      reentry_of: null,
    },
    reentry: {
      community_id: COMMUNITY,
      contribution_id: id(12),
      member_id: id(21),
      kind: "post",
      url: "https://x.com/hyphae/status/1971234567890123999",
      text: "Thread: how the vault pays each leaf once.",
      capture: { source: "x_oembed", captured_at: "2026-10-05T12:00:00.000000Z", limitations: [] },
      raid_id: null,
      intake_accepted_at: "2026-10-05T12:00:00.000000Z",
      reentry_of: id(13),
    },
  };
  const evidenceOut = Object.fromEntries(
    Object.entries(evidence).map(([k, p]) => [k, hashed(p, evidencePayloadHash)]),
  );

  const model: DecisionPayload = {
    community_id: COMMUNITY,
    epoch_id: EPOCH.id,
    contribution_id: id(10),
    revision: "1",
    predecessor_hash: null,
    config_hash: configH,
    evidence_hash: evidenceOut.x_post?.hash as string,
    source: "model",
    model: {
      model: "claude-sonnet-5",
      prompt_version: "reward-eval/1",
      prompt_hash: bytesToHex(sha256(utf8ToBytes("prompt"))),
      input_hash: bytesToHex(sha256(utf8ToBytes("input"))),
      output_hash: bytesToHex(sha256(utf8ToBytes("output"))),
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
    explanation: "Specific to the post, with a real question.",
    accepted_at: "2026-10-03T10:04:09.000100Z",
    affects_allocation: true,
  };
  const upgrade: DecisionPayload = {
    ...model,
    revision: "2",
    predecessor_hash: decisionPayloadHash(model),
    model: {
      ...(model.model as NonNullable<DecisionPayload["model"]>),
      input_hash: bytesToHex(sha256(utf8ToBytes("effort input"))),
    },
    nomination_id: id(40),
    effort: "eligible",
    effort_criteria: {
      community_contribution: { met: true, note: "answers a question holders keep asking" },
      inspectable_work: { met: true, note: "steps linked" },
      original_substance: { met: true, note: "own walkthrough" },
    },
    multiplier_bps: "30000",
    point_units: "25500000000",
    explanation: "Effort confirmed: an original walkthrough others can check.",
    accepted_at: "2026-10-05T09:00:00.000000Z",
  };
  const lateCorrection: DecisionPayload = {
    ...upgrade,
    revision: "3",
    predecessor_hash: decisionPayloadHash(upgrade),
    source: "correction",
    model: null,
    correction: {
      actor: "admin:cisco",
      authority: "community_admin",
      reason: "The linked steps were copied from another member.",
      evidence_refs: ["https://x.com/hyphae/status/1971234567890123000", "tg:message:77"],
    },
    raw_quality: "85",
    credited_quality: "0",
    flags: ["guideline_breach", "spam"],
    point_units: "0",
    explanation: "Corrected after the close; explanatory only.",
    accepted_at: "2026-10-09T00:00:00.000000Z",
    affects_allocation: false,
  };
  const decisions = {
    model_revision_1: hashed(model, decisionPayloadHash),
    effort_upgrade_revision_2: hashed(upgrade, decisionPayloadHash),
    late_correction_revision_3: hashed(lateCorrection, decisionPayloadHash),
  };

  const base = {
    network: "solana:devnet" as const,
    program_id: PROGRAM_ID,
    community_id: COMMUNITY,
    mint: MINT,
    epoch: EPOCH,
    config_hash: configH,
  };
  const memberA: MemberEpochManifest = {
    ...base,
    member_id: id(20),
    wallet: WALLET_A,
    entries: [
      {
        contribution_id: id(10),
        decision_hash: decisions.effort_upgrade_revision_2.hash,
        reason: null,
        point_units: "25500000000",
      },
      {
        contribution_id: id(11),
        decision_hash: null,
        reason: "pending_at_close",
        point_units: "0",
      },
      { contribution_id: id(14), decision_hash: null, reason: "excluded", point_units: "0" },
    ],
    point_units: "25500000000",
    whole_points: "255",
    settlement: {
      status: "payable",
      reasons: [],
      rules_test: { test_id: "mycel-rules-1", passed_at: "2026-10-02T11:22:33.444555Z" },
      hold: {
        mint: MINT,
        threshold_raw: "100000000000",
        status: "holder",
        raw_amount: "150000000000",
        decimals: "6",
        slot: "412345678",
        provider: "consensus",
        observed_at: "2026-10-09T00:05:00.123000Z",
      },
      uncapped_lamports: "485000000",
      amount_lamports: "121250000",
      cap_remainder_lamports: "363750000",
    },
  };
  const memberB: MemberEpochManifest = {
    ...base,
    member_id: id(21),
    wallet: null,
    entries: [
      {
        contribution_id: id(12),
        decision_hash: decisions.model_revision_1.hash,
        reason: null,
        point_units: "6000000000",
      },
    ],
    point_units: "6000000000",
    whole_points: "60",
    settlement: {
      status: "not_payable",
      reasons: ["no_rules_test", "no_verified_wallet"],
      rules_test: { test_id: "mycel-rules-1", passed_at: null },
      hold: null,
      uncapped_lamports: "0",
      amount_lamports: "0",
      cap_remainder_lamports: "0",
    },
  };
  const members = {
    counted_pending_excluded: hashed(memberA, memberEpochHash),
    no_verified_wallet: hashed(memberB, memberEpochHash),
  };
  const leafA = leafHash({
    wallet: base58Decode(WALLET_A),
    epochIndex: 2n,
    score: 255n,
    amount: 121_250_000n,
    evidenceHash: hexToBytes(members.counted_pending_excluded.hash),
  });
  const audit: EpochAuditManifest = {
    ...base,
    snapshot: {
      closed_at: "2026-10-09T00:00:04.000321Z",
      cutoff_assumption: "decisions accepted strictly before closes_at",
    },
    entries: [
      ...memberA.entries.map((e) => ({ ...e, member_id: id(20) })),
      ...memberB.entries.map((e) => ({ ...e, member_id: id(21) })),
    ].sort((x, y) => (x.contribution_id < y.contribution_id ? -1 : 1)),
    members: [
      {
        member_id: id(20),
        manifest_hash: members.counted_pending_excluded.hash,
        wallet: WALLET_A,
        point_units: "25500000000",
        whole_points: "255",
        amount_lamports: "121250000",
      },
      {
        member_id: id(21),
        manifest_hash: members.no_verified_wallet.hash,
        wallet: null,
        point_units: "6000000000",
        whole_points: "60",
        amount_lamports: "0",
      },
    ],
    settlement: {
      gross_lamports: "500000000",
      fee_bps: "300",
      fee_lamports: "15000000",
      fee_recipient: FEE_RECIPIENT,
      net_lamports: "485000000",
      cap_bps: "2500",
      cap_lamports: "121250000",
      payable_members: "1",
      allocated_lamports: "121250000",
      cap_remainder_lamports: "363750000",
      dust_lamports: "0",
      rules_test_id: "mycel-rules-1",
      hold: { mint: MINT, threshold_raw: "100000000000" },
    },
    root: bytesToHex(buildTree([leafA]).root),
  };

  return {
    config: configs,
    evidence: evidenceOut,
    decisions,
    member_epoch: members,
    epoch_audit: hashed(audit, epochAuditHash),
  };
}

// Allocation inputs are labelled members with exact point units; the api's seeded ready epoch
// reproduces seeded_ready_epoch from real rows.
function allocationVectors() {
  const units = (points: bigint) => points * 100_000_000n;
  const cases = [
    {
      name: "worked_example",
      gross_lamports: 500_000_000n,
      members: [
        { label: "m1", point_units: units(255n), payable: true },
        { label: "m2", point_units: units(85n), payable: true },
        { label: "m3", point_units: units(40n), payable: true },
        { label: "m4", point_units: units(60n), payable: false },
      ],
    },
    {
      name: "seeded_ready_epoch",
      gross_lamports: 500_000_000n,
      members: [
        { label: "effort", point_units: units(255n), payable: true },
        { label: "ordinary", point_units: units(85n), payable: true },
        { label: "floor", point_units: units(70n), payable: true },
        { label: "unsigned", point_units: units(60n), payable: false },
      ],
    },
  ];
  return cases.map((c) => {
    const a = allocate(
      c.gross_lamports,
      c.members.map((m) => ({ memberId: m.label, pointUnits: m.point_units, payable: m.payable })),
    );
    return {
      name: c.name,
      gross_lamports: c.gross_lamports.toString(),
      members: c.members.map((m) => ({ ...m, point_units: m.point_units.toString() })),
      fee_lamports: a.feeLamports.toString(),
      net_lamports: a.netLamports.toString(),
      cap_bps: a.capBps.toString(),
      cap_lamports: a.capLamports.toString(),
      allocated_lamports: a.allocatedLamports.toString(),
      cap_remainder_lamports: a.capRemainderLamports.toString(),
      dust_lamports: a.dustLamports.toString(),
      allocations: Object.fromEntries(
        a.members.map((m) => [
          m.memberId,
          {
            uncapped_lamports: m.uncappedLamports.toString(),
            amount_lamports: m.amountLamports.toString(),
            cap_remainder_lamports: m.capRemainderLamports.toString(),
          },
        ]),
      ),
    };
  });
}

function computeVectors() {
  return {
    version: "h-contract-v1",
    merkle: merkleVectors(),
    program: programVectors(),
    commitments: commitmentVectors(),
    allocation: allocationVectors(),
  };
}

type Vectors = ReturnType<typeof computeVectors>;

describe("H-CONTRACT v1 vectors", () => {
  const computed = computeVectors();
  if (process.env.UPDATE_VECTORS === "1") {
    writeFileSync(FILE, `${JSON.stringify(computed, null, 2)}\n`);
  }
  const committed = JSON.parse(readFileSync(FILE, "utf8")) as Vectors;

  it("the committed file is what the code computes", () => {
    expect(committed).toEqual(computed);
  });

  it("leaves are 89 bytes with the 0x00 prefix, and wallets are the seeds' ed25519 keys", () => {
    for (const l of committed.merkle.leaves) {
      const bytes = hexToBytes(l.encoded);
      expect(bytes.length).toBe(89);
      expect(bytes[0]).toBe(0x00);
      expect(bytesToHex(sha256(bytes))).toBe(l.hash);
    }
    // RFC 8032 test 1's key pair, so walletOf is ed25519 and not an accident of this file.
    const rfc8032 = hexToBytes("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60");
    expect(bytesToHex(walletOf(rfc8032))).toBe(
      "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
    );
  });

  it("every proof verifies against its tree's root", () => {
    const hashOf = new Map(committed.merkle.leaves.map((l) => [l.name, hexToBytes(l.hash)]));
    for (const tree of committed.merkle.trees) {
      for (const name of tree.leaves) {
        const proof = (tree.proofs as Record<string, string[]>)[name] as string[];
        expect(
          verifyProof(
            hexToBytes(tree.root),
            hashOf.get(name) as Uint8Array,
            proof.map((p) => hexToBytes(p)),
          ),
        ).toBe(true);
      }
    }
  });

  it("a tampered proof fails", () => {
    const hashOf = new Map(committed.merkle.leaves.map((l) => [l.name, hexToBytes(l.hash)]));
    for (const t of committed.merkle.tampered) {
      const tree = committed.merkle.trees.find((x) => x.leaves.length === t.tree);
      expect(
        verifyProof(
          hexToBytes(tree?.root as string),
          hashOf.get(t.leaf) as Uint8Array,
          t.proof.map((p) => hexToBytes(p)),
        ),
      ).toBe(t.valid);
    }
  });
});
