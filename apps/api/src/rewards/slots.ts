import {
  type Db,
  epochs,
  rewardConfigs,
  rewardDecisions,
  rewardDispatches,
  rewardIntakes,
  rewardNominations,
  rewardRetrievals,
  rewardSlots,
} from "@hyphae/db";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { RewardConfigPayload, type RewardDeps, withCommunityLock } from "./config.js";
import type { Capture } from "./intake.js";

export type Nomination = typeof rewardNominations.$inferSelect;
export type Slot = typeof rewardSlots.$inferSelect;

// Gaps whose absence could change an effort judgment (O1). Text-only oEmbed never captures media.
const ESSENTIAL_GAPS = ["post_unavailable", "media_not_captured"] as const;
export const essentialGap = (limitations: readonly string[]): string | null =>
  ESSENTIAL_GAPS.find((g) => limitations.includes(g)) ?? null;

const LIVE_STATES = [
  "pending_evidence",
  "ready",
  "evaluating",
  "pending_reconciliation",
] as const satisfies readonly Nomination["state"][];

export type NominateResult =
  | {
      status: "nominated";
      nomination: Nomination;
      created: boolean;
      nextRetrievalRound: number | null;
    }
  | { status: "slot_in_use" | "already_nominated"; nomination: Nomination }
  | {
      status:
        | "not_admitted"
        | "not_yours"
        | "epoch_closed"
        | "already_effort"
        | "quality_pending"
        | "slot_used"
        | "candidates_exhausted";
    };

export interface NominateInput {
  communityId: string;
  memberId: string;
  contributionId: string;
  idempotencyKey: string;
}

// Explicit effort nomination (O2). Under the community lock: the member's slots in the
// contribution's origin epoch admit at most `slotLimit` reservations and three candidates each,
// and a slot whose one dispatch is spent never takes another candidate.
export async function nominate(
  db: Db,
  input: NominateInput,
  deps: RewardDeps = {},
): Promise<NominateResult> {
  return withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    const [repeat] = await tx
      .select()
      .from(rewardNominations)
      .where(
        and(
          eq(rewardNominations.communityId, input.communityId),
          eq(rewardNominations.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (repeat) {
      return { status: "nominated", nomination: repeat, created: false, nextRetrievalRound: null };
    }

    const [intake] = await tx
      .select()
      .from(rewardIntakes)
      .where(
        and(
          eq(rewardIntakes.communityId, input.communityId),
          eq(rewardIntakes.contributionId, input.contributionId),
        ),
      );
    if (!intake) return { status: "not_admitted" };
    if (intake.memberId !== input.memberId) return { status: "not_yours" };
    const [epoch] = await tx.select().from(epochs).where(eq(epochs.id, intake.epochId));
    if (!epoch) throw new Error(`reward: epoch ${intake.epochId} missing`);
    if (now.getTime() >= epoch.closesAt.getTime()) return { status: "epoch_closed" };

    const [live] = await tx
      .select()
      .from(rewardNominations)
      .where(
        and(
          eq(rewardNominations.contributionId, input.contributionId),
          ne(rewardNominations.state, "withdrawn"),
        ),
      );
    if (live) return { status: "already_nominated", nomination: live };

    const [latest] = await tx
      .select({ effort: rewardDecisions.effort })
      .from(rewardDecisions)
      .where(eq(rewardDecisions.contributionId, input.contributionId))
      .orderBy(desc(rewardDecisions.revision))
      .limit(1);
    if (latest && latest.effort !== "not_nominated") return { status: "already_effort" };
    if (!latest) {
      const [quality] = await tx
        .select({ id: rewardDispatches.id })
        .from(rewardDispatches)
        .where(
          and(
            eq(rewardDispatches.contributionId, input.contributionId),
            eq(rewardDispatches.purpose, "quality"),
            ne(rewardDispatches.state, "not_sent_proven"),
          ),
        );
      if (quality) return { status: "quality_pending" };
    }

    const [config] = await tx
      .select({ payload: rewardConfigs.payload })
      .from(rewardConfigs)
      .where(eq(rewardConfigs.id, intake.configId));
    if (!config) throw new Error(`reward: config ${intake.configId} missing`);
    const { slotLimit, candidatesPerSlot, retrievalRounds } = RewardConfigPayload.parse(
      config.payload,
    ).effort;

    const slots = await tx
      .select()
      .from(rewardSlots)
      .where(and(eq(rewardSlots.epochId, intake.epochId), eq(rewardSlots.memberId, input.memberId)))
      .orderBy(asc(rewardSlots.ordinal));
    const spent = new Set(
      slots.length === 0
        ? []
        : (
            await tx
              .select({ slotId: rewardDispatches.slotId })
              .from(rewardDispatches)
              .where(
                and(
                  inArray(
                    rewardDispatches.slotId,
                    slots.map((s) => s.id),
                  ),
                  ne(rewardDispatches.state, "not_sent_proven"),
                ),
              )
          ).map((d) => d.slotId),
    );
    let slot = slots.find(
      (s) => s.state === "open" && s.candidatesUsed < candidatesPerSlot && !spent.has(s.id),
    );
    if (!slot && slots.length < slotLimit) {
      [slot] = await tx
        .insert(rewardSlots)
        .values({
          communityId: input.communityId,
          memberId: input.memberId,
          epochId: intake.epochId,
          ordinal: slots.length + 1,
        })
        .returning();
    }
    if (!slot) {
      const reserved = slots.find((s) => s.state === "reserved");
      if (reserved) {
        const [holder] = await tx
          .select()
          .from(rewardNominations)
          .where(
            and(
              eq(rewardNominations.slotId, reserved.id),
              inArray(rewardNominations.state, LIVE_STATES),
            ),
          );
        if (holder) return { status: "slot_in_use", nomination: holder };
      }
      const exhausted = slots.some(
        (s) => s.state === "open" && s.candidatesUsed >= candidatesPerSlot,
      );
      return { status: exhausted ? "candidates_exhausted" : "slot_used" };
    }

    const rounds = await tx
      .select()
      .from(rewardRetrievals)
      .where(
        and(
          eq(rewardRetrievals.contributionId, input.contributionId),
          eq(rewardRetrievals.epochId, intake.epochId),
        ),
      )
      .orderBy(desc(rewardRetrievals.round));
    let lastRound = rounds[0];
    if (!lastRound) {
      const limitations = (intake.capture as Capture).limitations;
      [lastRound] = await tx
        .insert(rewardRetrievals)
        .values({
          contributionId: input.contributionId,
          epochId: intake.epochId,
          round: 1,
          outcome: essentialGap(limitations) ?? "complete",
          limitations,
          attemptedAt: now,
        })
        .returning();
      if (!lastRound) throw new Error("reward: retrieval insert returned nothing");
    }
    const gap = lastRound.outcome === "complete" ? null : lastRound.outcome;

    const candidateOrdinal = slot.candidatesUsed + 1;
    await tx
      .update(rewardSlots)
      .set({ state: "reserved", candidatesUsed: candidateOrdinal })
      .where(eq(rewardSlots.id, slot.id));
    const [nomination] = await tx
      .insert(rewardNominations)
      .values({
        communityId: input.communityId,
        memberId: input.memberId,
        epochId: intake.epochId,
        slotId: slot.id,
        candidateOrdinal,
        contributionId: input.contributionId,
        intakeId: intake.id,
        kind: latest ? "upgrade" : "new_work",
        state: gap ? "pending_evidence" : "ready",
        pendingReason: gap,
        idempotencyKey: input.idempotencyKey,
        acceptedAt: now,
        updatedAt: now,
      })
      .returning();
    if (!nomination) throw new Error("reward: nomination insert returned nothing");
    const nextRetrievalRound =
      gap && lastRound.round < retrievalRounds ? lastRound.round + 1 : null;
    return { status: "nominated", nomination, created: true, nextRetrievalRound };
  });
}

export type WithdrawResult =
  | { status: "withdrawn"; nomination: Nomination }
  | { status: "not_live" | "dispatched" };

// Withdrawal releases only a reservation that has never dispatched; counters stay (O2).
export async function withdrawNomination(
  db: Db,
  input: { communityId: string; memberId: string; nominationId: string },
  deps: RewardDeps = {},
): Promise<WithdrawResult> {
  return withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    const [nomination] = await tx
      .select()
      .from(rewardNominations)
      .where(
        and(
          eq(rewardNominations.id, input.nominationId),
          eq(rewardNominations.communityId, input.communityId),
          eq(rewardNominations.memberId, input.memberId),
        ),
      );
    if (!nomination) return { status: "not_live" };
    if (nomination.state === "evaluating" || nomination.state === "pending_reconciliation") {
      return { status: "dispatched" };
    }
    if (nomination.state !== "pending_evidence" && nomination.state !== "ready") {
      return { status: "not_live" };
    }
    const [slot] = await tx.select().from(rewardSlots).where(eq(rewardSlots.id, nomination.slotId));
    if (!slot) throw new Error(`reward: slot ${nomination.slotId} missing`);
    await tx
      .update(rewardSlots)
      .set({ state: "open", generation: slot.generation + 1 })
      .where(eq(rewardSlots.id, slot.id));
    const [withdrawn] = await tx
      .update(rewardNominations)
      .set({ state: "withdrawn", updatedAt: now })
      .where(eq(rewardNominations.id, nomination.id))
      .returning();
    if (!withdrawn) throw new Error("reward: nomination update returned nothing");
    return { status: "withdrawn", nomination: withdrawn };
  });
}

export type RetrievalResult =
  | { status: "ready"; nomination: Nomination }
  | { status: "pending"; reason: string; nextRound: number | null }
  | { status: "not_pending" | "duplicate_round" | "exhausted" | "epoch_closed" };

// One free retrieval round (O2). Rounds are counted per artifact and epoch, never reset, and stop
// at the pinned bound or the epoch close. Exhaustion stays pending; it is never a rejection.
export async function recordRetrieval(
  db: Db,
  input: { communityId: string; nominationId: string; round: number; limitations: string[] },
  deps: RewardDeps = {},
): Promise<RetrievalResult> {
  return withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    const [nomination] = await tx
      .select()
      .from(rewardNominations)
      .where(
        and(
          eq(rewardNominations.id, input.nominationId),
          eq(rewardNominations.communityId, input.communityId),
        ),
      );
    if (!nomination || nomination.state !== "pending_evidence") return { status: "not_pending" };
    const [epoch] = await tx.select().from(epochs).where(eq(epochs.id, nomination.epochId));
    if (!epoch) throw new Error(`reward: epoch ${nomination.epochId} missing`);
    if (now.getTime() >= epoch.closesAt.getTime()) return { status: "epoch_closed" };
    const [intake] = await tx
      .select({ configId: rewardIntakes.configId })
      .from(rewardIntakes)
      .where(eq(rewardIntakes.id, nomination.intakeId));
    const [config] = intake
      ? await tx
          .select({ payload: rewardConfigs.payload })
          .from(rewardConfigs)
          .where(eq(rewardConfigs.id, intake.configId))
      : [];
    if (!config) throw new Error(`reward: config for nomination ${nomination.id} missing`);
    const { retrievalRounds } = RewardConfigPayload.parse(config.payload).effort;
    if (input.round > retrievalRounds) return { status: "exhausted" };

    const [last] = await tx
      .select({ round: rewardRetrievals.round })
      .from(rewardRetrievals)
      .where(
        and(
          eq(rewardRetrievals.contributionId, nomination.contributionId),
          eq(rewardRetrievals.epochId, nomination.epochId),
        ),
      )
      .orderBy(desc(rewardRetrievals.round))
      .limit(1);
    if (input.round !== (last?.round ?? 0) + 1) return { status: "duplicate_round" };

    const gap = essentialGap(input.limitations);
    await tx.insert(rewardRetrievals).values({
      contributionId: nomination.contributionId,
      epochId: nomination.epochId,
      round: input.round,
      outcome: gap ?? "complete",
      limitations: input.limitations,
      attemptedAt: now,
    });
    if (gap) {
      await tx
        .update(rewardNominations)
        .set({ pendingReason: gap, updatedAt: now })
        .where(eq(rewardNominations.id, nomination.id));
      const nextRound = input.round < retrievalRounds ? input.round + 1 : null;
      return { status: "pending", reason: gap, nextRound };
    }
    const [ready] = await tx
      .update(rewardNominations)
      .set({ state: "ready", pendingReason: null, updatedAt: now })
      .where(eq(rewardNominations.id, nomination.id))
      .returning();
    if (!ready) throw new Error("reward: nomination update returned nothing");
    return { status: "ready", nomination: ready };
  });
}
