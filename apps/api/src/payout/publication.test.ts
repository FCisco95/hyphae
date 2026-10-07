import { readFileSync } from "node:fs";
import {
  buildTree,
  configHash,
  decisionPayloadHash,
  epochAuditHash,
  evidencePayloadHash,
  HYPHAE_PROGRAM_ID,
  leafHash,
  memberEpochHash,
  promptTemplateHash,
  RubricSchema,
  verifyProof,
} from "@hyphae/core";
import {
  communities,
  holdChecks,
  rewardConfigAmendments,
  rewardConfigs,
  rewardDecisions,
  rewardIntakes,
  rulesTestPasses,
} from "@hyphae/db";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { getAddressEncoder } from "@solana/kit";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedAuditDemo } from "../http/demo-seed.js";
import { findOrInsertConfig, RewardConfigPayload } from "../rewards/config.js";
import { createTestDb } from "../rewards/test-db.js";
import { epochCommitments } from "./commitments.js";
import { buildPublication } from "./publication.js";
import { READY_HOLD_THRESHOLD, type ReadyLabel, seedReadyEpoch } from "./ready-seed.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-11-20T12:00:00.000Z");
const vectors = JSON.parse(
  readFileSync(
    new URL("../../../../packages/core/src/test-vectors/h-contract-v1.json", import.meta.url),
    "utf8",
  ),
);
const seededVector = vectors.allocation.find(
  (c: { name: string }) => c.name === "seeded_ready_epoch",
);
const SETTINGS = {
  network: "solana:devnet" as const,
  programId: HYPHAE_PROGRAM_ID,
  feeRecipient: "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR",
};
const GROSS = BigInt(seededVector.gross_lamports);

async function ready() {
  const seed = await seedReadyEpoch(t.db, { now: NOW });
  const publication = await buildPublication(
    t.db,
    { communityId: seed.communityId, epochId: seed.epochId },
    { grossLamports: GROSS, ...SETTINGS },
  );
  if (publication.status !== "ready") throw new Error(`not ready: ${publication.blockers}`);
  const label = (memberId: string) =>
    (Object.entries(seed.members).find(([, id]) => id === memberId)?.[0] ?? "?") as ReadyLabel;
  return { seed, publication, label };
}

describe("publication of a ready epoch", () => {
  it("allocates exactly the seeded_ready_epoch vector, to the lamport", async () => {
    const { publication, label } = await ready();
    const a = publication.allocation;
    expect(a.grossLamports.toString()).toBe(seededVector.gross_lamports);
    expect(a.feeLamports.toString()).toBe(seededVector.fee_lamports);
    expect(a.netLamports.toString()).toBe(seededVector.net_lamports);
    expect(a.capLamports.toString()).toBe(seededVector.cap_lamports);
    expect(a.allocatedLamports.toString()).toBe(seededVector.allocated_lamports);
    expect(a.capRemainderLamports.toString()).toBe(seededVector.cap_remainder_lamports);
    expect(a.dustLamports.toString()).toBe(seededVector.dust_lamports);
    const byLabel = Object.fromEntries(
      a.members.map((m) => [
        label(m.memberId),
        {
          uncapped_lamports: m.uncappedLamports.toString(),
          amount_lamports: m.amountLamports.toString(),
          cap_remainder_lamports: m.capRemainderLamports.toString(),
        },
      ]),
    );
    expect(byLabel).toEqual(seededVector.allocations);
    // The vector's inputs are the seeded points and payability.
    for (const m of seededVector.members) {
      const manifest = publication.members.find((x) => label(x.member_id) === m.label);
      expect(manifest?.point_units).toBe(m.point_units);
      expect(manifest?.settlement.status).toBe(m.payable ? "payable" : "not_payable");
    }
  });

  it("gives each payable member one leaf: wallet, whole points, lamports and manifest hash", async () => {
    const { seed, publication, label } = await ready();
    expect(publication.leaves.map((l) => label(l.memberId)).sort()).toEqual([
      "effort",
      "floor",
      "ordinary",
    ]);
    const encoder = getAddressEncoder();
    const hashes: string[] = [];
    for (const leaf of publication.leaves) {
      const manifest = publication.members.find((m) => m.member_id === leaf.memberId);
      if (!manifest) throw new Error("manifest");
      expect(leaf.wallet).toBe(seed.wallets[label(leaf.memberId)]);
      expect(leaf.score.toString()).toBe(manifest.whole_points);
      expect(leaf.amountLamports.toString()).toBe(manifest.settlement.amount_lamports);
      expect(leaf.evidenceHash).toBe(memberEpochHash(manifest));
      const hash = leafHash({
        wallet: new Uint8Array(encoder.encode(leaf.wallet as never)),
        epochIndex: publication.epochIndex,
        score: leaf.score,
        amount: leaf.amountLamports,
        evidenceHash: hexToBytes(leaf.evidenceHash),
      });
      expect(
        verifyProof(
          hexToBytes(publication.root),
          hash,
          leaf.proof.map((p) => hexToBytes(p)),
        ),
      ).toBe(true);
      hashes.push(bytesToHex(hash));
    }
    // Anyone can rebuild the root from the leaves alone: leaf hashes in ascending order.
    expect(bytesToHex(buildTree(hashes.sort().map(hexToBytes)).root)).toBe(publication.root);
  });

  it("anchors every snapshot entry and member in the audit manifest", async () => {
    const { seed, publication } = await ready();
    const audit = publication.audit;
    expect(epochAuditHash(audit)).toBe(publication.auditHash);
    expect(audit.root).toBe(publication.root);
    expect(audit.entries).toHaveLength(4);
    expect(audit.members.map((m) => m.member_id)).toEqual(Object.values(seed.members).sort());
    const unsigned = audit.members.find((m) => m.member_id === seed.members.unsigned);
    expect(unsigned).toMatchObject({ wallet: null, amount_lamports: "0", whole_points: "60" });
    expect(audit.settlement).toMatchObject({
      gross_lamports: seededVector.gross_lamports,
      fee_bps: "300",
      fee_recipient: SETTINGS.feeRecipient,
      payable_members: "3",
      rules_test_id: "mycel-rules-1",
      hold: { mint: seed.mint, threshold_raw: READY_HOLD_THRESHOLD },
    });
    const unsignedManifest = publication.members.find((m) => m.member_id === seed.members.unsigned);
    expect(unsignedManifest?.settlement).toMatchObject({
      status: "not_payable",
      reasons: ["no_rules_test", "no_verified_wallet"],
      hold: null,
      amount_lamports: "0",
    });
    const effort = publication.members.find((m) => m.member_id === seed.members.effort);
    expect(effort?.settlement.hold).toMatchObject({
      status: "holder",
      raw_amount: "150000000000",
      observed_at: expect.stringMatching(/\.\d{6}Z$/),
    });
    expect(effort?.settlement.rules_test.passed_at).toMatch(/\.\d{6}Z$/);
  });

  it("commits the epoch's pilot amendment in the audit manifest, and only when there is one", async () => {
    const plain = await ready();
    expect(plain.publication.audit).not.toHaveProperty("amendments");

    const seed = await seedReadyEpoch(t.db, { now: NOW, amended: true });
    const publication = await buildPublication(
      t.db,
      { communityId: seed.communityId, epochId: seed.epochId },
      { grossLamports: GROSS, ...SETTINGS },
    );
    if (publication.status !== "ready") throw new Error(`not ready: ${publication.blockers}`);
    const [row] = await t.db
      .select()
      .from(rewardConfigAmendments)
      .where(eq(rewardConfigAmendments.epochId, seed.epochId));
    const [to] = await t.db
      .select()
      .from(rewardConfigs)
      .where(eq(rewardConfigs.id, row?.toConfigId as string));
    const us = (d: Date | undefined) => d?.toISOString().replace("Z", "000Z");
    expect(publication.audit.amendments).toEqual([
      {
        effective_at: us(row?.effectiveAt),
        recorded_at: us(row?.recordedAt),
        actor: "script:ready-seed",
        reason: "Pilot testing phase: scoring is less strict.",
        from: {
          config_hash: publication.audit.config_hash,
          prompt_version: "reward-eval/1",
          prompt_template_hash: promptTemplateHash("reward-eval/1"),
        },
        to: {
          config_hash: configHash(to?.payload),
          prompt_version: "reward-eval/2",
          prompt_template_hash: promptTemplateHash("reward-eval/2"),
        },
      },
    ]);
    expect(epochAuditHash(publication.audit)).toBe(publication.auditHash);
    // The prompt changed which text judged two contributions, not the payout math.
    expect(publication.allocation.allocatedLamports).toBe(
      plain.publication.allocation.allocatedLamports,
    );
  });

  it("commits a chain of two amendments, the second starting from the first's result", async () => {
    const seed = await seedReadyEpoch(t.db, { now: NOW, amended: true });
    const [first] = await t.db
      .select()
      .from(rewardConfigAmendments)
      .where(eq(rewardConfigAmendments.epochId, seed.epochId));
    if (!first) throw new Error("no first amendment");
    const [firstTo] = await t.db
      .select()
      .from(rewardConfigs)
      .where(eq(rewardConfigs.id, first.toConfigId));
    const jevPin = { promptVersion: "reward-jev/1", promptTemplateHash: "d".repeat(64) };
    const secondTo = await findOrInsertConfig(t.db, seed.communityId, {
      ...RewardConfigPayload.parse(firstTo?.payload),
      scoring: jevPin,
    });
    await t.db.insert(rewardConfigAmendments).values({
      communityId: seed.communityId,
      epochId: seed.epochId,
      fromConfigId: first.toConfigId,
      toConfigId: secondTo.id,
      fromPromptVersion: first.toPromptVersion,
      fromPromptTemplateHash: first.toPromptTemplateHash,
      toPromptVersion: jevPin.promptVersion,
      toPromptTemplateHash: jevPin.promptTemplateHash,
      effectiveAt: new Date(first.effectiveAt.getTime() + 3_600_000),
      actor: "script:ready-seed",
      reason: "Jev scores quality from here on.",
      recordedAt: new Date(first.effectiveAt.getTime() + 60_000),
    });

    const publication = await buildPublication(
      t.db,
      { communityId: seed.communityId, epochId: seed.epochId },
      { grossLamports: GROSS, ...SETTINGS },
    );
    if (publication.status !== "ready") throw new Error(`not ready: ${publication.blockers}`);
    const chain = publication.audit.amendments ?? [];
    expect(chain.map((x) => x.to.prompt_version)).toEqual(["reward-eval/2", "reward-jev/1"]);
    expect(chain[1]?.from).toEqual(chain[0]?.to);
    expect(chain[0]?.from.config_hash).toBe(publication.audit.config_hash);
    expect(epochAuditHash(publication.audit)).toBe(publication.auditHash);
  });

  it("gives no leaf and no lamports to a signed member who is not payable", async () => {
    const seed = await seedReadyEpoch(t.db, { now: NOW });
    // Passed, but only after the close: that pass does not count and is not shown as one.
    await t.db
      .update(rulesTestPasses)
      .set({ passedAt: new Date(seed.closesAt.getTime() + 60_000) })
      .where(eq(rulesTestPasses.memberId, seed.members.floor));
    const publication = await buildPublication(
      t.db,
      { communityId: seed.communityId, epochId: seed.epochId },
      { grossLamports: GROSS, ...SETTINGS },
    );
    if (publication.status !== "ready") throw new Error("not ready");
    const floor = publication.members.find((m) => m.member_id === seed.members.floor);
    expect(floor).toMatchObject({
      wallet: seed.wallets.floor,
      settlement: {
        status: "not_payable",
        reasons: ["no_rules_test"],
        rules_test: { passed_at: null },
        amount_lamports: "0",
      },
    });
    expect(publication.leaves.map((l) => l.memberId).sort()).toEqual(
      [seed.members.effort, seed.members.ordinary].sort(),
    );
  });

  it("builds the same bytes from the same rows", async () => {
    const { seed, publication } = await ready();
    const again = await buildPublication(
      t.db,
      { communityId: seed.communityId, epochId: seed.epochId },
      { grossLamports: GROSS, ...SETTINGS },
    );
    expect(again.status === "ready" && again.root).toBe(publication.root);
    expect(again.status === "ready" && again.auditHash).toBe(publication.auditHash);
  });

  it("publishes nothing for a blocked epoch", async () => {
    const seed = await seedReadyEpoch(t.db, { now: NOW });
    await t.db
      .update(communities)
      .set({ firstPaidEpoch: null })
      .where(eq(communities.id, seed.communityId));
    const publication = await buildPublication(
      t.db,
      { communityId: seed.communityId, epochId: seed.epochId },
      { grossLamports: GROSS, ...SETTINGS },
    );
    expect(publication).toEqual({ status: "blocked", blockers: ["before_first_paid_epoch"] });
  });

  it("publishes nothing while a member is held", async () => {
    const seed = await seedReadyEpoch(t.db, { now: NOW });
    await t.db
      .update(holdChecks)
      .set({
        status: "uncertain",
        reason: "providers_disagree",
        rawAmount: null,
        decimals: null,
        provider: null,
        slot: null,
        observedAt: null,
      })
      .where(
        and(eq(holdChecks.epochId, seed.epochId), eq(holdChecks.memberId, seed.members.floor)),
      );
    const publication = await buildPublication(
      t.db,
      { communityId: seed.communityId, epochId: seed.epochId },
      { grossLamports: GROSS, ...SETTINGS },
    );
    expect(publication).toEqual({ status: "blocked", blockers: ["hold_checks_pending"] });
  });
});

describe("commitments over stored rows (the B6 backfill, computed)", () => {
  it("pins the MYCEL 1.2.0 config vector to the published rubric", () => {
    const read = (path: string) =>
      JSON.parse(readFileSync(new URL(`../../../../${path}`, import.meta.url), "utf8"));
    const fixture = read("packages/core/src/test-vectors/mycel-1.2.0-config.json");
    expect(RewardConfigPayload.parse(fixture)).toEqual(fixture);
    expect(fixture.rubric).toEqual(RubricSchema.parse(read("docs/rubrics/mycel-1.2.0.json")));
    expect(configHash(fixture)).toBe(vectors.commitments.config[0].hash);
  });

  it("hashes every decision of an epoch, chaining each revision to its predecessor", async () => {
    const seed = await seedReadyEpoch(t.db, { now: NOW });
    const c = await epochCommitments(t.db, seed.epochId);
    const lineage = await t.db
      .select()
      .from(rewardDecisions)
      .where(eq(rewardDecisions.epochId, seed.epochId))
      .orderBy(asc(rewardDecisions.contributionId), asc(rewardDecisions.revision));
    expect(c.decisions.size).toBe(lineage.length);
    for (const d of lineage) {
      const entry = c.decisions.get(d.id);
      expect(entry?.hash).toBe(decisionPayloadHash(entry?.payload as never));
      expect(entry?.payload.config_hash).toBe(c.configHash);
      expect(entry?.payload.evidence_hash).toBe(c.evidence.get(d.contributionId)?.hash);
      if (d.predecessorId) {
        expect(entry?.payload.predecessor_hash).toBe(c.decisions.get(d.predecessorId)?.hash);
      } else {
        expect(entry?.payload.predecessor_hash).toBeNull();
      }
    }
    for (const [, e] of c.evidence) expect(e.hash).toBe(evidencePayloadHash(e.payload));
    const upgrade = lineage.find((d) => d.revision === 2);
    expect(c.decisions.get(upgrade?.id as string)?.payload).toMatchObject({
      revision: "2",
      effort: "eligible",
      multiplier_bps: "30000",
      point_units: "25500000000",
      source: "model",
    });
  });

  it("commits a capture time exactly as stored, microseconds included", async () => {
    const seed = await seedReadyEpoch(t.db, { now: NOW });
    const [intake] = await t.db
      .select()
      .from(rewardIntakes)
      .where(eq(rewardIntakes.memberId, seed.members.floor));
    if (!intake) throw new Error("intake");
    const capture = intake.capture as Record<string, unknown>;
    await t.db
      .update(rewardIntakes)
      .set({ capture: { ...capture, capturedAt: "2026-10-03T10:04:05.123456Z" } })
      .where(eq(rewardIntakes.id, intake.id));
    const c = await epochCommitments(t.db, seed.epochId);
    expect(c.evidence.get(intake.contributionId)?.payload.capture.captured_at).toBe(
      "2026-10-03T10:04:05.123456Z",
    );
    // A time that is not UTC with a Z is refused, not reinterpreted.
    await t.db
      .update(rewardIntakes)
      .set({ capture: { ...capture, capturedAt: "2026-10-03T10:04:05+01:00" } })
      .where(eq(rewardIntakes.id, intake.id));
    await expect(epochCommitments(t.db, seed.epochId)).rejects.toThrow(/capture time/);
    // So is a time that does not exist.
    for (const impossible of ["2026-10-03T25:04:05.123456Z", "2026-02-30T10:00:00.000000Z"]) {
      await t.db
        .update(rewardIntakes)
        .set({ capture: { ...capture, capturedAt: impossible } })
        .where(eq(rewardIntakes.id, intake.id));
      await expect(epochCommitments(t.db, seed.epochId)).rejects.toThrow(/capture time/);
    }
  });

  it("hashes corrections and late decisions with the audit demo's rows", async () => {
    const demo = await seedAuditDemo(t.db, NOW);
    const [epoch] = await t.db
      .select({ epochId: rewardDecisions.epochId })
      .from(rewardDecisions)
      .where(eq(rewardDecisions.contributionId, demo.contributions.offTopic));
    const c = await epochCommitments(t.db, epoch?.epochId as string);
    const payloads = [...c.decisions.values()].map((d) => d.payload);
    const correction = payloads.find((p) => p.source === "correction");
    expect(correction).toMatchObject({
      contribution_id: demo.contributions.offTopic,
      revision: "2",
      model: null,
      correction: { actor: "admin:cisco", authority: "community_admin" },
      affects_allocation: false,
    });
    const late = payloads.find((p) => p.contribution_id === demo.contributions.late);
    expect(late).toMatchObject({ affects_allocation: false, source: "model" });
    expect(late?.model?.output_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
