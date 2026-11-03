import { hexToBytes } from "@noble/hashes/utils.js";
import { getAddressDecoder, getAddressEncoder } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  DistributionAuditManifest,
  distributionAuditHash,
  MemberDistributionManifest,
  type MemberEpochManifest,
  memberDistributionHash,
} from "./commitments.js";
import {
  buildDistribution,
  type Distribution,
  type PayoutPolicy,
  type PendingEpoch,
} from "./distribution.js";
import { assembleDistribution, type DistributionEpochEvidence } from "./distribution-manifest.js";
import { leafHash, verifyProof } from "./merkle.js";

// Test lookups that must succeed; a miss fails the test with a clear message.
function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error("expected a value");
  return v;
}

const POINT = 100_000_000n;
const SOL = 1_000_000_000n;
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const wallet = (n: number) => getAddressDecoder().decode(new Uint8Array(32).fill(n)) as string;
const hash = (n: number) => n.toString(16).padStart(2, "0").repeat(32);
const MINT = wallet(200);
const PROGRAM = "EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E";
const policy: PayoutPolicy = {
  thresholdVolumeLamports: 100n * SOL,
  basis: "cumulative",
  rewardBpsOfVolume: 100n,
};

// Three weeks below the threshold on their own; week 2 has nobody payable, so its accrual joins
// week 3's slice.
const weeks: PendingEpoch[] = [
  {
    index: 1n,
    accrualLamports: 400_000_000n,
    volumeLamports: 40n * SOL,
    members: [
      { memberId: uuid(1), pointUnits: 10n * POINT, payable: true, wallet: wallet(1) },
      { memberId: uuid(2), pointUnits: 30n * POINT, payable: true, wallet: wallet(2) },
    ],
  },
  {
    index: 2n,
    accrualLamports: 300_000_000n,
    volumeLamports: 30n * SOL,
    members: [{ memberId: uuid(3), pointUnits: 5n * POINT, payable: false, wallet: null }],
  },
  {
    index: 3n,
    accrualLamports: 300_000_000n,
    volumeLamports: 30n * SOL,
    members: [
      { memberId: uuid(2), pointUnits: 20n * POINT, payable: true, wallet: wallet(2) },
      { memberId: uuid(4), pointUnits: 20n * POINT, payable: true, wallet: wallet(4) },
    ],
  },
];

// The B7 manifests the API builds for each week, carrying that week's slice share.
function evidence(d: Distribution): DistributionEpochEvidence[] {
  return weeks.map((w) => {
    const index = w.index.toString();
    const epoch = {
      id: uuid(100 + Number(w.index)),
      index,
      opens_at: `2026-10-0${w.index}T00:00:00.000000Z`,
      closes_at: `2026-10-0${Number(w.index) + 1}T00:00:00.000000Z`,
    };
    const slice = d.slices.find((s) => s.epochIndex === w.index);
    const members: MemberEpochManifest[] = w.members.map((m, j) => {
      const share = slice?.members[j];
      return {
        network: "solana:mainnet",
        program_id: PROGRAM,
        community_id: uuid(900),
        mint: MINT,
        epoch,
        config_hash: hash(9),
        member_id: m.memberId,
        wallet: m.wallet,
        entries: [
          {
            contribution_id: uuid(500 + Number(w.index) * 10 + j),
            decision_hash: hash(10 + j),
            reason: null,
            point_units: m.pointUnits.toString(),
          },
        ],
        point_units: m.pointUnits.toString(),
        whole_points: (m.pointUnits / POINT).toString(),
        settlement: m.payable
          ? {
              status: "payable",
              reasons: [],
              rules_test: { test_id: "mycel-rules-1", passed_at: "2026-09-30T00:00:00.000000Z" },
              hold: null,
              uncapped_lamports: (share?.uncappedLamports ?? 0n).toString(),
              amount_lamports: (share?.amountLamports ?? 0n).toString(),
              cap_remainder_lamports: (share?.capRemainderLamports ?? 0n).toString(),
            }
          : {
              status: "not_payable",
              reasons: ["below_hold"],
              rules_test: { test_id: "mycel-rules-1", passed_at: null },
              hold: null,
              uncapped_lamports: "0",
              amount_lamports: "0",
              cap_remainder_lamports: "0",
            },
      };
    });
    return {
      epoch,
      configHash: hash(9),
      snapshot: { closed_at: epoch.closes_at, cutoff_assumption: "intake closed at closes_at" },
      entries: members
        .flatMap((m) => m.entries.map((e) => ({ ...e, member_id: m.member_id })))
        .sort((a, b) => (a.contribution_id < b.contribution_id ? -1 : 1)),
      members,
      volumeLamports: w.volumeLamports,
      rulesTestId: "mycel-rules-1",
      hold: { mint: MINT, threshold_raw: "100000000000" },
    };
  });
}

const assemble = () => {
  const distribution = buildDistribution(weeks);
  return assembleDistribution({
    network: "solana:mainnet",
    programId: PROGRAM,
    communityId: uuid(900),
    mint: MINT,
    feeRecipient: wallet(250),
    policy,
    volumeLamports: 100n * SOL,
    distribution,
    epochs: evidence(distribution),
  });
};

describe("assembleDistribution (B10, B11)", () => {
  it("pays three rolled-over weeks in one distribution under the latest index", () => {
    const a = assemble();
    expect(a.audit.distribution.index).toBe("3");
    expect(a.audit.settlement.gross_lamports).toBe("1000000000");
    expect(a.audit.epochs.map((e) => [e.epoch.index, e.merged_into, e.gross_lamports])).toEqual([
      ["1", null, "400000000"],
      ["2", "3", "0"],
      ["3", null, "600000000"],
    ]);
    // Member 2 contributed in weeks 1 and 3 and gets one leaf for both.
    const two = must(a.members.find((m) => m.member_id === uuid(2)));
    expect(two.parts.map((p) => p.epoch_index)).toEqual(["1", "3"]);
    expect(two.whole_points).toBe("50");
    expect(a.leaves).toHaveLength(3);
    expect(new Set(a.leaves.map((l) => l.wallet)).size).toBe(3);
    expect(a.auditHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.auditHash).toBe(distributionAuditHash(a.audit));
  });

  it("builds leaves that prove against the root under the distribution's index", () => {
    const a = assemble();
    const encoder = getAddressEncoder();
    for (const l of a.leaves) {
      const leaf = leafHash({
        wallet: new Uint8Array(encoder.encode(l.wallet as never)),
        epochIndex: 3n,
        score: l.score,
        amount: l.amountLamports,
        evidenceHash: hexToBytes(l.evidenceHash),
      });
      expect(verifyProof(hexToBytes(a.root), leaf, l.proof.map(hexToBytes))).toBe(true);
      const m = must(a.members.find((x) => x.member_id === l.memberId));
      expect(l.evidenceHash).toBe(memberDistributionHash(m));
    }
    const sum = a.leaves.reduce((s, l) => s + l.amountLamports, 0n);
    expect(sum.toString()).toBe(a.audit.settlement.allocated_lamports);
  });

  it("refuses evidence whose shares differ from the distribution", () => {
    const distribution = buildDistribution(weeks);
    const epochs = evidence(distribution);
    const m = must(must(epochs[0]).members[0]);
    m.settlement = { ...m.settlement, amount_lamports: "1", uncapped_lamports: "1" };
    expect(() =>
      assembleDistribution({
        network: "solana:mainnet",
        programId: PROGRAM,
        communityId: uuid(900),
        mint: MINT,
        feeRecipient: wallet(250),
        policy,
        volumeLamports: 100n * SOL,
        distribution,
        epochs,
      }),
    ).toThrow(/carries another share/);
  });
});

describe("DistributionAuditManifest and MemberDistributionManifest", () => {
  const audit = () => structuredClone(assemble().audit);

  it("refuses an audit whose lamports do not reconcile", () => {
    const a = audit();
    a.settlement.allocated_lamports = (BigInt(a.settlement.allocated_lamports) + 1n).toString();
    expect(DistributionAuditManifest.safeParse(a).success).toBe(false);
    const b = audit();
    must(b.epochs[0]).accrual_lamports = "1";
    expect(DistributionAuditManifest.safeParse(b).success).toBe(false);
    const c = audit();
    c.settlement.fee_lamports = "1";
    expect(DistributionAuditManifest.safeParse(c).success).toBe(false);
  });

  it("refuses a distribution below its threshold or published under an earlier index", () => {
    const a = audit();
    a.distribution.volume_lamports = "1";
    expect(DistributionAuditManifest.safeParse(a).success).toBe(false);
    const b = audit();
    b.distribution.index = "2";
    expect(DistributionAuditManifest.safeParse(b).success).toBe(false);
  });

  it("refuses an epoch merged into one outside the distribution", () => {
    const a = audit();
    must(a.epochs[1]).merged_into = "7";
    expect(DistributionAuditManifest.safeParse(a).success).toBe(false);
  });

  it("refuses two leaves for one wallet", () => {
    const a = audit();
    must(a.members[1]).wallet = must(a.members[0]).wallet;
    expect(DistributionAuditManifest.safeParse(a).success).toBe(false);
  });

  it("refuses a member manifest whose parts do not sum", () => {
    const m = structuredClone(must(assemble().members[0]));
    m.amount_lamports = (BigInt(m.amount_lamports) + 1n).toString();
    expect(MemberDistributionManifest.safeParse(m).success).toBe(false);
  });
});

const issues = (a: unknown) =>
  (DistributionAuditManifest.safeParse(a).error?.issues ?? []).map((i) => i.message).join("; ");

// Regressions from the Codex review of 5e63281 (docs/reviews/2026-11-03-distribution-core-codex.md).
describe("review R1 to R5", () => {
  const withEvidence = (
    edit: (epochs: DistributionEpochEvidence[]) => void,
    volume = 100n * SOL,
  ) => {
    const distribution = buildDistribution(weeks);
    const epochs = evidence(distribution);
    edit(epochs);
    return () =>
      assembleDistribution({
        network: "solana:mainnet",
        programId: PROGRAM,
        communityId: uuid(900),
        mint: MINT,
        feeRecipient: wallet(250),
        policy,
        volumeLamports: volume,
        distribution,
        epochs,
      });
  };
  const memberOf = (epochs: DistributionEpochEvidence[], epoch: number, id: string) =>
    must(must(epochs[epoch]).members.find((m) => m.member_id === id));

  it("R1: refuses B7 evidence whose wallet differs from the distribution's", () => {
    expect(
      withEvidence((epochs) => {
        memberOf(epochs, 2, uuid(2)).wallet = wallet(9);
      }),
    ).toThrow(/does not follow from its evidence/);
  });

  it("R1: refuses B7 evidence whose points differ from the distribution's", () => {
    expect(
      withEvidence((epochs) => {
        const m = memberOf(epochs, 2, uuid(2));
        m.point_units = "100000000";
        m.whole_points = "1";
        must(m.entries[0]).point_units = "100000000";
      }),
    ).toThrow(/does not follow from its evidence/);
  });

  it("R1: refuses B7 evidence from another config, program or epoch", () => {
    expect(
      withEvidence((epochs) => {
        memberOf(epochs, 0, uuid(1)).config_hash = hash(8);
      }),
    ).toThrow(/another epoch, config or program/);
    expect(
      withEvidence((epochs) => {
        const m = memberOf(epochs, 0, uuid(1));
        m.epoch = { ...m.epoch, opens_at: "2026-09-01T00:00:00.000000Z" };
      }),
    ).toThrow(/another epoch, config or program/);
  });

  it("R5: refuses a decision volume its own policy would not produce", () => {
    expect(withEvidence(() => {}, 101n * SOL)).toThrow(/decision volume/);
  });

  it("R2: refuses an audit that moves a lamport between two members", () => {
    const a = structuredClone(assemble().audit);
    const [x, y] = [must(a.members[0]), must(a.members[1])];
    x.amount_lamports = (BigInt(x.amount_lamports) + 1n).toString();
    y.amount_lamports = (BigInt(y.amount_lamports) - 1n).toString();
    expect(DistributionAuditManifest.safeParse(a).success).toBe(false);
  });

  it("R2: refuses an audit whose member points or wallet differ from the epochs'", () => {
    const a = structuredClone(assemble().audit);
    must(a.members[0]).whole_points = "1";
    expect(DistributionAuditManifest.safeParse(a).success).toBe(false);
    const b = structuredClone(assemble().audit);
    must(b.members[0]).wallet = wallet(77);
    expect(DistributionAuditManifest.safeParse(b).success).toBe(false);
  });

  it("R3: refuses any fee but the program's 300 basis points", () => {
    const a = structuredClone(assemble().audit);
    a.settlement.fee_bps = "0";
    expect(issues(a)).toMatch(/300 basis points/);
  });

  it("R3: refuses lamport fields above u64", () => {
    const a = structuredClone(assemble().audit);
    a.settlement.dust_lamports = (1n << 64n).toString();
    expect(issues(a)).toMatch(/u64/);
  });

  it("R4: refuses a summed score that does not fit the claim's u64", () => {
    const max = (1n << 64n) - 1n;
    const big: PendingEpoch[] = [1n, 2n].map((index) => ({
      index,
      accrualLamports: 1_000n,
      volumeLamports: 100n * SOL,
      members: [{ memberId: uuid(1), pointUnits: max * POINT, payable: true, wallet: wallet(1) }],
    }));
    expect(buildDistribution(big).members[0]?.amountLamports).toBe(484n);
    expect(() =>
      MemberDistributionManifest.parse({
        network: "solana:mainnet",
        program_id: PROGRAM,
        community_id: uuid(900),
        mint: MINT,
        distribution_index: "2",
        member_id: uuid(1),
        wallet: wallet(1),
        parts: [
          {
            epoch_index: "1",
            member_epoch_hash: hash(1),
            whole_points: max.toString(),
            amount_lamports: "242",
          },
          {
            epoch_index: "2",
            member_epoch_hash: hash(2),
            whole_points: max.toString(),
            amount_lamports: "242",
          },
        ],
        whole_points: (2n * max).toString(),
        amount_lamports: "484",
      }),
    ).toThrow(/u64/);
  });
});

describe("leaf encoding", () => {
  it("refuses a u64 field out of range instead of wrapping it", () => {
    const base = {
      wallet: new Uint8Array(32),
      epochIndex: 1n,
      score: 1n,
      amount: 1n,
      evidenceHash: new Uint8Array(32),
    };
    expect(() => leafHash({ ...base, score: 1n << 64n })).toThrow(/u64/);
    expect(() => leafHash({ ...base, amount: -1n })).toThrow(/u64/);
  });
});
