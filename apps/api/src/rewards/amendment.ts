import { type Db, rewardConfigAmendments, rewardConfigs } from "@hyphae/db";
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { isoUs } from "../pg.js";
import { type JevRegistry, pinHash } from "../scoring/scorers.js";
import {
  type Epoch,
  ensureEpochAt,
  findOrInsertConfig,
  RewardConfigPayload,
  type RewardDeps,
  withCommunityLock,
} from "./config.js";

export type Amendment = typeof rewardConfigAmendments.$inferSelect;

export interface AmendInput {
  communityId: string;
  epochIndex: number;
  promptVersion: string;
  // Jev scorers this build knows; without it only Anthropic prompt versions can be pinned.
  registry?: JevRegistry;
  effectiveAt: Date;
  actor: string;
  reason: string;
}

// Pilot amendment: from effectiveAt on, contributions admitted in the open epoch are judged by
// another registered prompt or scorer; nothing else in the configuration may differ. Recording
// holds the community lock and requires a future effectiveAt, so no contribution admitted before
// the record can fall under it, and no earlier intake, dispatch or decision is touched. An epoch
// may be amended again once the previous amendment is in effect; each starts from the config in
// force, so the amendments of an epoch form a chain.
export async function amendEpochPrompt(
  db: Db,
  input: AmendInput,
  deps: RewardDeps = {},
): Promise<Amendment> {
  return withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    const actor = input.actor.trim();
    const reason = input.reason.trim();
    if (!actor) throw new Error("reward: an amendment needs an actor");
    if (!reason) throw new Error("reward: an amendment needs a public reason");

    const epoch = await ensureEpochAt(tx, input.communityId, now, now);
    if (!epoch?.rewardConfigId || epoch.index !== input.epochIndex) {
      throw new Error(`reward: epoch ${input.epochIndex} is not the epoch open now`);
    }
    const effective = input.effectiveAt.getTime();
    // Announced times are whole minutes, so the minute shown on every page is the exact boundary.
    if (effective % 60_000 !== 0) throw new Error("reward: effectiveAt must be a whole minute");
    if (effective <= now.getTime()) {
      throw new Error(
        "reward: effectiveAt must be in the future; amendments are never retroactive",
      );
    }
    if (effective >= epoch.closesAt.getTime()) {
      throw new Error("reward: effectiveAt must be before the epoch's close");
    }
    const [latest] = await tx
      .select()
      .from(rewardConfigAmendments)
      .where(eq(rewardConfigAmendments.epochId, epoch.id))
      .orderBy(desc(rewardConfigAmendments.effectiveAt))
      .limit(1);
    if (latest && latest.effectiveAt.getTime() > now.getTime()) {
      throw new Error(
        `reward: the previous amendment of epoch ${epoch.index} is not yet in effect`,
      );
    }
    const fromConfigId = latest?.toConfigId ?? epoch.rewardConfigId;

    const [from] = await tx
      .select({ payload: rewardConfigs.payload })
      .from(rewardConfigs)
      .where(eq(rewardConfigs.id, fromConfigId));
    if (!from) throw new Error(`reward: config ${fromConfigId} missing`);
    const fromPayload = RewardConfigPayload.parse(from.payload);
    const hash = pinHash(input.promptVersion, input.registry);
    if (!hash) throw new Error(`reward: prompt ${input.promptVersion} is not registered`);
    if (input.promptVersion === fromPayload.scoring.promptVersion) {
      throw new Error(`reward: ${input.promptVersion} is already the epoch's prompt`);
    }
    const to = await findOrInsertConfig(tx, input.communityId, {
      ...fromPayload,
      scoring: { promptVersion: input.promptVersion, promptTemplateHash: hash },
    });
    // The way back to an amendment's config is allowed (Jev to the first amendment's prompt, as an
    // emergency exit); the epoch's own config never is, and the database lets a config be left once.
    if (to.id === epoch.rewardConfigId) {
      throw new Error(`reward: ${input.promptVersion} is already used by epoch ${epoch.index}`);
    }

    const [row] = await tx
      .insert(rewardConfigAmendments)
      .values({
        communityId: input.communityId,
        epochId: epoch.id,
        fromConfigId,
        toConfigId: to.id,
        fromPromptVersion: fromPayload.scoring.promptVersion,
        fromPromptTemplateHash: fromPayload.scoring.promptTemplateHash,
        toPromptVersion: input.promptVersion,
        toPromptTemplateHash: hash,
        effectiveAt: input.effectiveAt,
        actor,
        reason,
        recordedAt: now,
      })
      .returning();
    if (!row) throw new Error("reward: amendment insert returned nothing");
    return row;
  });
}

// The configuration a contribution admitted into `epoch` at `now` pins. Callers hold the lock.
export async function admissionConfigId(tx: Db, epoch: Epoch, now: Date): Promise<string> {
  if (!epoch.rewardConfigId) throw new Error("reward: materialized epoch has no pinned config");
  const [amendment] = await tx
    .select({ toConfigId: rewardConfigAmendments.toConfigId })
    .from(rewardConfigAmendments)
    .where(
      and(
        eq(rewardConfigAmendments.epochId, epoch.id),
        lte(rewardConfigAmendments.effectiveAt, now),
      ),
    )
    .orderBy(desc(rewardConfigAmendments.effectiveAt))
    .limit(1);
  return amendment?.toConfigId ?? epoch.rewardConfigId;
}

export interface AmendmentRecord {
  row: Amendment;
  // A3 microsecond times, as the read API and the audit manifest commit them.
  effectiveAtUs: string;
  recordedAtUs: string;
}

export const amendmentsOf = (tx: Db, epochId: string): Promise<AmendmentRecord[]> =>
  tx
    .select({
      row: rewardConfigAmendments,
      effectiveAtUs: isoUs(rewardConfigAmendments.effectiveAt),
      recordedAtUs: isoUs(rewardConfigAmendments.recordedAt),
    })
    .from(rewardConfigAmendments)
    .where(eq(rewardConfigAmendments.epochId, epochId))
    .orderBy(asc(rewardConfigAmendments.effectiveAt));
