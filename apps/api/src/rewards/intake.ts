import { sha256Hex } from "@hyphae/core";
import { contributions, type Db, members, rewardIntakes, tasks } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { ensureEpochAt, latestEpoch, type RewardDeps, withCommunityLock } from "./config.js";

export type RewardIntake = typeof rewardIntakes.$inferSelect;

export interface Capture {
  source: "x_oembed" | "telegram_text";
  capturedAt: string;
  limitations: string[];
}

export interface AdmitInput {
  communityId: string;
  memberId: string;
  taskId?: string | null;
  contribution: Pick<
    typeof contributions.$inferInsert,
    "kind" | "url" | "text" | "oembed" | "telegramMessageId"
  >;
  artifactKey: string;
  idempotencyKey: string;
  capture: Capture;
}

export type AdmitResult =
  | { status: "admitted"; intake: RewardIntake; created: boolean }
  | { status: "duplicate_artifact"; intake: RewardIntake }
  | { status: "paused" | "not_open" | "legacy_epoch" | "before_task_open" };

// Canonical artifact identity (O2): the provider's status id or the text itself, never the URL.
export function artifactKeyFor(ref: { statusId: string } | { text: string }): string {
  return "statusId" in ref ? `x:status:${ref.statusId}` : `text:sha256:${sha256Hex(ref.text)}`;
}

// Immutable admission (O3): one transaction assigns the half-open epoch by server acceptance
// time, pins that epoch's configuration, and records the contribution. Queueing is the caller's.
export async function admitContribution(
  db: Db,
  input: AdmitInput,
  deps: RewardDeps = {},
): Promise<AdmitResult> {
  return withCommunityLock(db, input.communityId, deps, async (tx, community, now) => {
    const [existing] = await tx
      .select()
      .from(rewardIntakes)
      .where(
        and(
          eq(rewardIntakes.communityId, input.communityId),
          eq(rewardIntakes.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (existing) return { status: "admitted", intake: existing, created: false };
    if (community.rewardIntakePausedAt) return { status: "paused" };

    // A legacy community stays legacy: its unpinned epochs are never extended.
    const latest = await latestEpoch(tx, input.communityId);
    if (latest && !latest.rewardConfigId) return { status: "legacy_epoch" };
    const epoch = await ensureEpochAt(tx, input.communityId, now, now);
    if (!epoch) return { status: "not_open" };
    if (!epoch.rewardConfigId) throw new Error("reward: materialized epoch has no pinned config");

    const [member] = await tx
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.id, input.memberId), eq(members.communityId, input.communityId)));
    if (!member) {
      throw new Error(
        `reward: member ${input.memberId} is not a member of community ${input.communityId}`,
      );
    }
    const taskId = input.taskId ?? null;
    if (taskId) {
      const [task] = await tx
        .select({ opensAt: tasks.opensAt })
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.communityId, input.communityId)));
      if (!task) {
        throw new Error(`reward: task ${taskId} is not a task of community ${input.communityId}`);
      }
      if (now.getTime() < task.opensAt.getTime()) return { status: "before_task_open" };
    }

    const [duplicate] = await tx
      .select()
      .from(rewardIntakes)
      .where(
        and(
          eq(rewardIntakes.communityId, input.communityId),
          eq(rewardIntakes.artifactKey, input.artifactKey),
        ),
      );
    if (duplicate) return { status: "duplicate_artifact", intake: duplicate };

    const [contribution] = await tx
      .insert(contributions)
      .values({
        communityId: input.communityId,
        memberId: input.memberId,
        taskId,
        ...input.contribution,
        submittedAt: now,
      })
      .returning({ id: contributions.id });
    if (!contribution) throw new Error("reward: contribution insert returned nothing");
    const [intake] = await tx
      .insert(rewardIntakes)
      .values({
        communityId: input.communityId,
        memberId: input.memberId,
        epochId: epoch.id,
        configId: epoch.rewardConfigId,
        contributionId: contribution.id,
        taskId,
        artifactKey: input.artifactKey,
        idempotencyKey: input.idempotencyKey,
        acceptedAt: now,
        capture: input.capture,
      })
      .returning();
    if (!intake) throw new Error("reward: intake insert returned nothing");
    return { status: "admitted", intake, created: true };
  });
}
