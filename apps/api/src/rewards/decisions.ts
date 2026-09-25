import { creditedQuality, type RewardFlag, rawQuality, rewardOutputSchema } from "@hyphae/core";
import {
  type Db,
  epochs,
  rewardConfigs,
  rewardDecisions,
  rewardDispatches,
  rewardNominations,
  rewardSlots,
} from "@hyphae/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { RewardConfigPayload, type RewardDeps, withCommunityLock } from "./config.js";
import type { Decision } from "./evaluation.js";

const NO_MULTIPLIER = 10_000;

export interface CorrectionInput {
  communityId: string;
  contributionId: string;
  // The revision the operator reviewed; any other latest revision means someone got there first.
  expectedRevision: number;
  // Underlying classifications only. Credit and points are always re-derived, never typed.
  changes: {
    rawQuality?: number | undefined;
    flags?: RewardFlag[] | undefined;
    effort?: "eligible" | "ineligible" | undefined;
  };
  reason: string;
  evidenceRefs: string[];
  actor: string;
  idempotencyKey: string;
}

export type CorrectionResult =
  | { status: "appended"; decision: Decision; created: boolean }
  | { status: "stale_revision"; current: Decision }
  | { status: "no_decision" | "effort_not_nominated" };

// Append-only correction (O6): a full successor decision naming its predecessor, written under the
// community lock so two corrections of one revision cannot both succeed. Accepted at or after the
// origin epoch's close, it is explanatory only (affects_allocation = false).
export async function appendCorrection(
  db: Db,
  input: CorrectionInput,
  deps: RewardDeps = {},
): Promise<CorrectionResult> {
  const reason = input.reason.trim();
  if (!reason) throw new Error("reward: a correction reason is required");
  if (!input.evidenceRefs.length || input.evidenceRefs.some((ref) => !ref.trim())) {
    throw new Error("reward: a correction needs at least one evidence reference");
  }
  if (Object.values(input.changes).every((v) => v === undefined)) {
    throw new Error("reward: a correction must change something");
  }

  return withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    const [replay] = await tx
      .select()
      .from(rewardDecisions)
      .where(
        and(
          eq(rewardDecisions.communityId, input.communityId),
          eq(rewardDecisions.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (replay) {
      if (replay.contributionId !== input.contributionId) {
        throw new Error(`reward: idempotency key ${input.idempotencyKey} names other work`);
      }
      return { status: "appended", decision: replay, created: false };
    }

    const lineage = await tx
      .select()
      .from(rewardDecisions)
      .where(
        and(
          eq(rewardDecisions.communityId, input.communityId),
          eq(rewardDecisions.contributionId, input.contributionId),
        ),
      )
      .orderBy(asc(rewardDecisions.revision));
    const [root] = lineage;
    const latest = lineage.at(-1);
    if (!root || !latest) return { status: "no_decision" };
    if (latest.revision !== input.expectedRevision) {
      return { status: "stale_revision", current: latest };
    }

    let multiplierBps = latest.multiplierBps;
    let effort = latest.effort;
    if (input.changes.effort) {
      // Only work whose nomination consumed a slot can have its effort judged again (O6).
      const [consumed] = await tx
        .select({ id: rewardNominations.id })
        .from(rewardNominations)
        .innerJoin(rewardSlots, eq(rewardSlots.id, rewardNominations.slotId))
        .where(
          and(
            eq(rewardNominations.contributionId, input.contributionId),
            inArray(rewardNominations.state, ["completed_eligible", "completed_ineligible"]),
            eq(rewardSlots.state, "consumed"),
          ),
        )
        .orderBy(desc(rewardNominations.acceptedAt))
        .limit(1);
      if (!consumed) return { status: "effort_not_nominated" };
      const [config] = await tx
        .select({ payload: rewardConfigs.payload })
        .from(rewardConfigs)
        .where(eq(rewardConfigs.id, latest.configId));
      if (!config) throw new Error(`reward: config ${latest.configId} missing`);
      effort = input.changes.effort;
      multiplierBps =
        effort === "eligible"
          ? RewardConfigPayload.parse(config.payload).effort.multiplierBps
          : NO_MULTIPLIER;
    }

    // Revision 1 always comes from a quality dispatch; its AI-pattern evidence bounds the cap.
    if (!root.dispatchId)
      throw new Error(`reward: revision 1 of ${root.contributionId} has no dispatch`);
    const [dispatch] = await tx
      .select({ purpose: rewardDispatches.purpose, output: rewardDispatches.output })
      .from(rewardDispatches)
      .where(eq(rewardDispatches.id, root.dispatchId));
    const scored = dispatch && rewardOutputSchema(dispatch.purpose).parse(dispatch.output);
    if (!scored || !("aiSlop" in scored)) {
      throw new Error(`reward: dispatch ${root.dispatchId} has no quality output`);
    }

    const raw = input.changes.rawQuality ?? latest.rawQuality;
    const flags = input.changes.flags ?? (latest.flags as RewardFlag[]);
    const credited = creditedQuality({
      rawQuality: rawQuality(BigInt(raw)),
      flags,
      aiSlop: {
        patternCount: BigInt(scored.aiSlop.patterns.length),
        templateRhythm: scored.aiSlop.templateRhythm,
      },
    });
    const [epoch] = await tx
      .select({ closesAt: epochs.closesAt })
      .from(epochs)
      .where(eq(epochs.id, latest.epochId));
    if (!epoch) throw new Error(`reward: epoch ${latest.epochId} missing`);

    const [decision] = await tx
      .insert(rewardDecisions)
      .values({
        communityId: input.communityId,
        contributionId: input.contributionId,
        epochId: latest.epochId,
        configId: latest.configId,
        revision: latest.revision + 1,
        predecessorId: latest.id,
        rawQuality: raw,
        creditedQuality: Number(credited),
        flags,
        effort,
        effortCriteria: latest.effortCriteria,
        timingBps: latest.timingBps,
        multiplierBps,
        pointUnits: credited * BigInt(latest.timingBps) * BigInt(multiplierBps),
        explanation: `Correction: ${reason}`,
        acceptedAt: now,
        affectsAllocation: now.getTime() < epoch.closesAt.getTime(),
        correctionActor: input.actor,
        correctionReason: reason,
        correctionEvidence: input.evidenceRefs,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();
    if (!decision) throw new Error("reward: correction insert returned nothing");
    return { status: "appended", decision, created: true };
  });
}

type Criteria = Record<
  "originalSubstance" | "inspectableWork" | "communityContribution",
  { met: boolean; note: string }
>;

// A decision's effort criteria and correction record as the read API serves them and its
// commitment hashes them (B5).
export function effortCriteriaRecord(d: Decision) {
  const c = d.effortCriteria as Criteria | null;
  return (
    c && {
      original_substance: c.originalSubstance,
      inspectable_work: c.inspectableWork,
      community_contribution: c.communityContribution,
    }
  );
}

export function correctionRecord(d: Decision) {
  if (d.correctionActor === null) return null;
  return {
    actor: d.correctionActor,
    // A14: the admin prefix is the only authority in v1.
    authority: d.correctionActor.startsWith("admin:")
      ? ("community_admin" as const)
      : ("operator_script" as const),
    reason: d.correctionReason ?? "",
    evidence_refs: d.correctionEvidence ?? [],
  };
}
