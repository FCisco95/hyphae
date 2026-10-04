import {
  communities,
  contributions,
  type Db,
  members,
  raidLifecycleEvents,
  raidSubmissionReceipts,
  raidSubmissionSessions,
  tasks,
} from "@hyphae/db";
import { and, eq, like } from "drizzle-orm";
import { bindHandle } from "../bot/commands/handles.js";
import { COMMUNITY_ID } from "../raid-alerts/alerts.js";
import { type Clock, dbClock, withCommunityLock } from "../rewards/config.js";
import { artifactKeyFor, capturedEvidence } from "../rewards/intake.js";
import { routeSubmission } from "../rewards/submission.js";
import { parsePostUrl, type XPost } from "../x/oembed.js";

export interface SubmissionDeps {
  membership(chatId: bigint, userId: bigint): Promise<boolean>;
  fetchPost(url: string): Promise<XPost | null>;
  clock?: Clock;
}
export type Session = typeof raidSubmissionSessions.$inferSelect;
export type Receipt = typeof raidSubmissionReceipts.$inferSelect;

export const REFUSALS = {
  unavailable: "That submission is unavailable in your private chat.",
  link_required: "Link your wallet first: send /link in this community's registered group.",
  not_member: "You must currently belong to this raid's registered group.",
  membership_unavailable: "Membership could not be checked. Nothing new was accepted; try again.",
  outside_window:
    "This raid is not active. Its window may have expired or an admin closed or cancelled it.",
  session_expired:
    "This submission prompt expired or was cancelled. Tap Submit on the raid again if it is still active.",
  invalid_url:
    "Send one public X URL for your own reply or quote, using this raid's submission prompt.",
  target_itself: "That is the target post. Submit the URL of your own reply or quote to it.",
  post_unavailable:
    "Could not read that public post. Nothing new was accepted; retry the same prompt.",
  handle_limit:
    "You have reached the existing three-account submission limit. Those recorded handles are not ownership proof.",
  duplicate_artifact:
    "That post was already submitted in this community. No new work was accepted.",
  kind_taken: "You already submitted this kind of work for this raid. Use the original receipt.",
  paused: "Reward intake is paused in this community. Nothing new was accepted.",
  not_open: "The first reward epoch has not opened yet.",
  legacy_epoch: "This community's reward configuration does not accept new intake.",
  before_task_open: "This raid has not opened yet.",
  task_closed: "This raid has closed. Nothing new was accepted.",
  task_expired: "This raid has expired. Its submission deadline has passed.",
  task_cancelled:
    "This raid was cancelled. New submissions are stopped; prior work and credit remain recorded.",
} as const;
export type Refusal = keyof typeof REFUSALS;

async function inactiveReason(
  db: Db,
  task: typeof tasks.$inferSelect | undefined,
  now: Date,
): Promise<Refusal> {
  if (!task) return "outside_window";
  if (task.status === "closed") {
    const cancelled = await db.query.raidLifecycleEvents.findFirst({
      where: and(
        eq(raidLifecycleEvents.communityId, task.communityId),
        eq(raidLifecycleEvents.taskId, task.id),
        eq(raidLifecycleEvents.action, "cancelled"),
      ),
    });
    return cancelled ? "task_cancelled" : "task_closed";
  }
  if (task.closesAt <= now) return "task_expired";
  if (task.opensAt > now) return "before_task_open";
  return "outside_window";
}

async function currentMember(db: Db, communityId: string, userId: bigint, deps: SubmissionDeps) {
  const community = await db.query.communities.findFirst({
    where: eq(communities.id, communityId),
  });
  if (!community || !Number.isSafeInteger(Number(community.telegramChatId)))
    return "unavailable" as const;
  const member = await db.query.members.findFirst({
    where: and(eq(members.communityId, communityId), eq(members.telegramUserId, userId)),
  });
  if (!member) return "link_required" as const;
  try {
    if (!(await deps.membership(community.telegramChatId, userId))) return "not_member" as const;
  } catch {
    return "membership_unavailable" as const;
  }
  return { community, member };
}

export async function beginSubmission(
  db: Db,
  taskId: string,
  userId: bigint,
  kind: "reply" | "quote",
  deps: SubmissionDeps,
): Promise<{ session: Session; target: string; communityName: string } | { error: Refusal }> {
  if (!COMMUNITY_ID.test(taskId) || userId <= 0n || !Number.isSafeInteger(Number(userId)))
    return { error: "unavailable" };
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (task?.kind !== "raid" || !task.targetUrl) return { error: "unavailable" };
  const found = await currentMember(db, task.communityId, userId, deps);
  if (typeof found === "string") return { error: found };
  return withCommunityLock(db, task.communityId, deps, async (tx, community, now) => {
    const current = await tx.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.communityId, community.id)),
    });
    if (current?.status !== "open" || current.opensAt > now || current.closesAt <= now)
      return { error: await inactiveReason(tx, current, now) };
    if (community.telegramChatId !== found.community.telegramChatId)
      return { error: "membership_unavailable" };
    const [session] = await tx
      .insert(raidSubmissionSessions)
      .values({
        communityId: community.id,
        taskId,
        telegramUserId: userId,
        kind,
        expiresAt: new Date(Math.min(now.getTime() + 15 * 60_000, current.closesAt.getTime())),
        createdAt: now,
      })
      .returning();
    if (!session) throw new Error("Submission prompt insert failed");
    return { session, target: task.targetUrl as string, communityName: community.name };
  });
}

export async function cancelSubmission(db: Db, sessionId: string, userId: bigint) {
  if (!COMMUNITY_ID.test(sessionId)) return false;
  const [row] = await db
    .update(raidSubmissionSessions)
    .set({ cancelledAt: new Date() })
    .where(
      and(
        eq(raidSubmissionSessions.id, sessionId),
        eq(raidSubmissionSessions.telegramUserId, userId),
      ),
    )
    .returning();
  return !!row;
}

export async function acceptSubmission(
  db: Db,
  input: { sessionId: string; userId: bigint; url: string },
  deps: SubmissionDeps,
): Promise<{ receipt: Receipt; lane: "reward" | "legacy"; replay: boolean } | { error: Refusal }> {
  if (!COMMUNITY_ID.test(input.sessionId) || input.userId <= 0n) return { error: "unavailable" };
  const session = await db.query.raidSubmissionSessions.findFirst({
    where: and(
      eq(raidSubmissionSessions.id, input.sessionId),
      eq(raidSubmissionSessions.telegramUserId, input.userId),
    ),
  });
  if (!session) return { error: "unavailable" };
  const found = await currentMember(db, session.communityId, input.userId, deps);
  if (typeof found === "string") return { error: found };
  const parsed = parsePostUrl(input.url);
  if (!parsed || /\s/.test(input.url)) return { error: "invalid_url" };
  const artifactKey = artifactKeyFor({ statusId: parsed.id });
  // Replays resolve the original receipt, without another provider read or handle binding.
  const old = await db.query.raidSubmissionReceipts.findFirst({
    where: eq(raidSubmissionReceipts.sessionId, session.id),
  });
  const oldIntake = old
    ? await db.query.rewardIntakes.findFirst({
        where: (r, { eq }) => eq(r.contributionId, old.contributionId),
      })
    : undefined;
  if (old)
    return old.memberId === found.member.id && old.artifactKey === artifactKey
      ? { receipt: old, lane: oldIntake ? "reward" : "legacy", replay: true }
      : { error: "unavailable" };
  const before = await (deps.clock ?? dbClock)(db, session.communityId);
  if (session.cancelledAt || session.expiresAt <= before) return { error: "session_expired" };
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, session.taskId), eq(tasks.communityId, session.communityId)),
  });
  if (
    task?.kind !== "raid" ||
    task.status !== "open" ||
    task.opensAt > before ||
    task.closesAt <= before
  )
    return { error: await inactiveReason(db, task, before) };
  if (parsePostUrl(task.targetUrl ?? "")?.id === parsed.id) return { error: "target_itself" };
  let post: XPost | null;
  try {
    post = await deps.fetchPost(input.url);
  } catch {
    return { error: "post_unavailable" };
  }
  if (
    !post ||
    post.id !== parsed.id ||
    !/^[A-Za-z0-9_]{1,15}$/.test(post.handle) ||
    parsePostUrl(post.url)?.id !== parsed.id
  )
    return { error: "post_unavailable" };
  // Serialize with task lifecycle and existing reward admission; recheck membership after retrieval.
  return withCommunityLock(db, session.communityId, deps, async (tx, community) => {
    const [lockedSession] = await tx
      .select()
      .from(raidSubmissionSessions)
      .where(eq(raidSubmissionSessions.id, session.id))
      .for("update");
    const caller = await currentMember(tx, community.id, input.userId, deps);
    if (typeof caller === "string") return { error: caller };
    const now = await (deps.clock ?? dbClock)(tx, community.id);
    const existing = await tx.query.raidSubmissionReceipts.findFirst({
      where: eq(raidSubmissionReceipts.sessionId, session.id),
    });
    if (existing) {
      if (existing.memberId !== caller.member.id || existing.artifactKey !== artifactKey)
        return { error: "unavailable" };
      const intake = await tx.query.rewardIntakes.findFirst({
        where: (r, { eq }) => eq(r.contributionId, existing.contributionId),
      });
      return { receipt: existing, lane: intake ? "reward" : "legacy", replay: true };
    }
    if (!lockedSession || lockedSession.cancelledAt || lockedSession.expiresAt <= now)
      return { error: "session_expired" };
    const current = await tx.query.tasks.findFirst({
      where: and(eq(tasks.id, session.taskId), eq(tasks.communityId, community.id)),
    });
    if (
      current?.kind !== "raid" ||
      current.status !== "open" ||
      current.opensAt > now ||
      current.closesAt <= now
    )
      return { error: await inactiveReason(tx, current, now) };
    const seen = await tx.query.contributions.findFirst({
      where: and(
        eq(contributions.communityId, community.id),
        like(contributions.url, `%/status/${parsed.id}`),
      ),
    });
    if (seen) return { error: "duplicate_artifact" };
    const taken = await tx.query.contributions.findFirst({
      where: and(
        eq(contributions.communityId, community.id),
        eq(contributions.memberId, caller.member.id),
        eq(contributions.taskId, current.id),
        eq(contributions.kind, session.kind),
      ),
    });
    if (taken) return { error: "kind_taken" };
    // A handle is an unverified claim with the existing cap, never proof of ownership.
    const [lockedMember] = await tx
      .select()
      .from(members)
      .where(and(eq(members.id, caller.member.id), eq(members.communityId, community.id)))
      .for("no key update");
    if (!lockedMember) return { error: "link_required" };
    const binding = bindHandle(lockedMember.xHandles, post.handle);
    if (!binding.ok) return { error: "handle_limit" };
    // The frozen worker replies in the group. Never give it a private-chat message identifier.
    const captured = capturedEvidence({ post }, current.telegramMessageId ?? 0, now);
    captured.capture.limitations.push("target_relation_unverified", "account_ownership_unverified");
    const admission = {
      communityId: community.id,
      memberId: caller.member.id,
      taskId: current.id,
      idempotencyKey: `raid-session:${session.id}`,
      artifactKey,
      contribution: { ...captured.contribution, kind: session.kind },
      capture: captured.capture,
    };
    const routed = await routeSubmission(tx, admission, deps);
    let contributionId: string;
    if (routed.lane === "reward") {
      if (routed.result.status !== "admitted") return { error: routed.result.status };
      contributionId = routed.result.intake.contributionId;
    } else {
      if (community.rewardIntakePausedAt) return { error: "paused" };
      const [row] = await tx
        .insert(contributions)
        .values({
          ...admission.contribution,
          communityId: community.id,
          memberId: caller.member.id,
          taskId: current.id,
          submittedAt: now,
        })
        .returning();
      if (!row) throw new Error("Contribution insert failed");
      contributionId = row.id;
    }
    if (binding.bound)
      await tx
        .update(members)
        .set({ xHandles: binding.handles })
        .where(eq(members.id, caller.member.id));
    const [receipt] = await tx
      .insert(raidSubmissionReceipts)
      .values({
        sessionId: session.id,
        communityId: community.id,
        memberId: caller.member.id,
        taskId: current.id,
        contributionId,
        artifactKey,
        receivedAt: now,
      })
      .returning();
    if (!receipt) throw new Error("Receipt insert failed");
    return { receipt, lane: routed.lane, replay: false };
  });
}

// Queue failure never erases durable intake or turns it into a second contribution.
export async function queueSubmission(db: Db, receipt: Receipt, enqueue: () => Promise<unknown>) {
  if (receipt.queueStatus === "queued") return true;
  try {
    await enqueue();
    await db
      .update(raidSubmissionReceipts)
      .set({ queueStatus: "queued" })
      .where(eq(raidSubmissionReceipts.id, receipt.id));
    return true;
  } catch {
    return false;
  }
}
