import {
  configHash,
  type DecisionPayload,
  decisionPayloadHash,
  type EvidencePayload,
  evidencePayloadHash,
} from "@hyphae/core";
import {
  contributions,
  type Db,
  epochs,
  rewardConfigs,
  rewardDecisions,
  rewardDispatches,
  rewardIntakes,
} from "@hyphae/db";
import { asc, eq, inArray, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// H-CONTRACT B3–B6 computed from the stored rows. Configs, intakes, contributions, decisions and
// completed dispatches are insert-only, so a decision made before R6 gets the hash it would have
// had then, and publication can never meet a missing hash (B6).

// Postgres keeps microseconds; a JS Date would drop them (A3).
export const isoUs = (column: AnyPgColumn | SQL) =>
  sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
// A stored capture time in A3's six-digit form. The fraction is kept as text, since a JS Date would
// drop microseconds; the date and time without it must exist, which a Date round trip confirms.
const CAPTURE_TIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/;
function captureTimeUs(stored: string): string {
  const m = CAPTURE_TIME.exec(stored);
  const seconds = m?.[1];
  const valid = seconds !== undefined && Number.isFinite(Date.parse(`${seconds}Z`));
  if (!valid || new Date(`${seconds}Z`).toISOString().slice(0, 19) !== seconds) {
    throw new Error(`commitments: capture time ${JSON.stringify(stored)} is not a UTC (Z) time`);
  }
  return `${seconds}.${(m?.[2] ?? "").padEnd(6, "0")}Z`;
}

type Criteria = Record<
  "originalSubstance" | "inspectableWork" | "communityContribution",
  { met: boolean; note: string }
>;

export interface EpochCommitments {
  configHash: string;
  evidence: Map<string, { payload: EvidencePayload; hash: string }>;
  decisions: Map<string, { payload: DecisionPayload; hash: string }>;
}

export async function epochCommitments(tx: Db, epochId: string): Promise<EpochCommitments> {
  const [epoch] = await tx.select().from(epochs).where(eq(epochs.id, epochId));
  if (!epoch?.rewardConfigId) throw new Error(`commitments: epoch ${epochId} has no reward config`);

  const intakes = await tx
    .select({
      intake: rewardIntakes,
      acceptedAt: isoUs(rewardIntakes.acceptedAt),
      contribution: {
        kind: contributions.kind,
        url: contributions.url,
        text: contributions.text,
      },
    })
    .from(rewardIntakes)
    .innerJoin(contributions, eq(contributions.id, rewardIntakes.contributionId))
    .where(eq(rewardIntakes.epochId, epochId));
  const originals = intakes.flatMap((r) => (r.intake.reentryOf ? [r.intake.reentryOf] : []));
  const originalContribution = new Map(
    (originals.length
      ? await tx
          .select({ id: rewardIntakes.id, contributionId: rewardIntakes.contributionId })
          .from(rewardIntakes)
          .where(inArray(rewardIntakes.id, originals))
      : []
    ).map((r) => [r.id, r.contributionId]),
  );

  const evidence = new Map<string, { payload: EvidencePayload; hash: string }>();
  for (const { intake, acceptedAt, contribution } of intakes) {
    const capture = intake.capture as {
      source: "x_oembed" | "telegram_text";
      capturedAt: string;
      limitations: string[];
    };
    const payload: EvidencePayload = {
      community_id: intake.communityId,
      contribution_id: intake.contributionId,
      member_id: intake.memberId,
      kind: contribution.kind,
      url: contribution.url,
      text: contribution.text,
      capture: {
        source: capture.source,
        captured_at: captureTimeUs(capture.capturedAt),
        limitations: capture.limitations,
      },
      raid_id: intake.taskId,
      intake_accepted_at: acceptedAt,
      reentry_of: intake.reentryOf ? (originalContribution.get(intake.reentryOf) ?? null) : null,
    };
    if (intake.reentryOf && payload.reentry_of === null) {
      throw new Error(`commitments: re-entry ${intake.id} has no original intake`);
    }
    evidence.set(intake.contributionId, { payload, hash: evidencePayloadHash(payload) });
  }

  const lineage = evidence.size
    ? await tx
        .select({ d: rewardDecisions, acceptedAt: isoUs(rewardDecisions.acceptedAt) })
        .from(rewardDecisions)
        .where(inArray(rewardDecisions.contributionId, [...evidence.keys()]))
        .orderBy(asc(rewardDecisions.contributionId), asc(rewardDecisions.revision))
    : [];

  const configIds = [...new Set([epoch.rewardConfigId, ...lineage.map((r) => r.d.configId)])];
  const configHashes = new Map(
    (
      await tx
        .select({ id: rewardConfigs.id, payload: rewardConfigs.payload })
        .from(rewardConfigs)
        .where(inArray(rewardConfigs.id, configIds))
    ).map((c) => [c.id, configHash(c.payload)]),
  );

  const dispatchIds = lineage.flatMap((r) => (r.d.dispatchId ? [r.d.dispatchId] : []));
  const dispatches = new Map(
    (dispatchIds.length
      ? await tx.select().from(rewardDispatches).where(inArray(rewardDispatches.id, dispatchIds))
      : []
    ).map((d) => [d.id, d]),
  );

  const decisions = new Map<string, { payload: DecisionPayload; hash: string }>();
  // Ordered by revision within each contribution, so a predecessor is always hashed first.
  for (const { d, acceptedAt } of lineage) {
    const dispatch = d.dispatchId ? dispatches.get(d.dispatchId) : undefined;
    const isCorrection = d.correctionActor !== null;
    if (!isCorrection && !dispatch?.outputHash) {
      throw new Error(`commitments: decision ${d.id} has no completed dispatch`);
    }
    const predecessor = d.predecessorId ? decisions.get(d.predecessorId) : undefined;
    if (d.predecessorId && !predecessor) {
      throw new Error(`commitments: decision ${d.id} names a predecessor outside its lineage`);
    }
    const criteria = d.effortCriteria as Criteria | null;
    const payload: DecisionPayload = {
      community_id: d.communityId,
      epoch_id: d.epochId,
      contribution_id: d.contributionId,
      revision: d.revision.toString(),
      predecessor_hash: predecessor?.hash ?? null,
      config_hash: configHashes.get(d.configId) as string,
      evidence_hash: evidence.get(d.contributionId)?.hash as string,
      source: isCorrection ? "correction" : "model",
      model:
        !isCorrection && dispatch
          ? {
              model: dispatch.model,
              prompt_version: dispatch.promptVersion,
              prompt_hash: dispatch.promptHash,
              input_hash: dispatch.inputHash,
              output_hash: dispatch.outputHash as string,
            }
          : null,
      correction: isCorrection
        ? {
            actor: d.correctionActor as string,
            // A14: the admin prefix is the only authority in v1, as the read API derives it.
            authority: d.correctionActor?.startsWith("admin:")
              ? "community_admin"
              : "operator_script",
            reason: d.correctionReason ?? "",
            evidence_refs: d.correctionEvidence ?? [],
          }
        : null,
      nomination_id: d.nominationId,
      raw_quality: d.rawQuality.toString(),
      credited_quality: d.creditedQuality.toString(),
      flags: [...(d.flags as string[])].sort(),
      effort: d.effort,
      effort_criteria: criteria
        ? {
            community_contribution: criteria.communityContribution,
            inspectable_work: criteria.inspectableWork,
            original_substance: criteria.originalSubstance,
          }
        : null,
      timing_bps: d.timingBps.toString(),
      multiplier_bps: d.multiplierBps.toString(),
      point_units: d.pointUnits.toString(),
      explanation: d.explanation,
      accepted_at: acceptedAt,
      affects_allocation: d.affectsAllocation,
    };
    decisions.set(d.id, { payload, hash: decisionPayloadHash(payload) });
  }

  return {
    configHash: configHashes.get(epoch.rewardConfigId) as string,
    evidence,
    decisions,
  };
}
