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
import { and, count, eq, gte, isNull, like } from "drizzle-orm";
import { bindHandle } from "../bot/commands/handles.js";
import { COMMUNITY_ID } from "../raid-alerts/alerts.js";
import { type Clock, dbClock, withCommunityLock } from "../rewards/config.js";
import { artifactKeyFor, capturedEvidence } from "../rewards/intake.js";
import { routeSubmission } from "../rewards/submission.js";
import { parsePostUrl, type XPost } from "../x/oembed.js";
import { ensureMember } from "./ensure-member.js";

export interface SubmissionDeps {
  membership(chatId: bigint, userId: bigint): Promise<boolean>;
  fetchPost(url: string): Promise<XPost | null>;
  clock?: Clock;
}
export type Session = typeof raidSubmissionSessions.$inferSelect;
export type Receipt = typeof raidSubmissionReceipts.$inferSelect;

export const REFUSALS = {
  unavailable: "That submission is unavailable in your private chat.",
  prompt_limited:
    "Too many submission prompts in the last hour. Reuse an existing prompt or try again later.",
  link_required: "That submission is unavailable. Tap the raid's Submit button again.",
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

async function memberContext(db: Db, communityId: string, userId: bigint) {
  const community = await db.query.communities.findFirst({
    where: eq(communities.id, communityId),
  });
  if (!community || !Number.isSafeInteger(Number(community.telegramChatId)))
    return "unavailable" as const;
  const member = await db.query.members.findFirst({
    where: and(eq(members.communityId, communityId), eq(members.telegramUserId, userId)),
  });
  if (!member) return "link_required" as const;
  return { community, member };
}

// The caller must be in the community's group now. A group member without a member row gets one
// with no wallet, so they can earn before linking (ruled 2026-10-07).
async function currentMember(db: Db, communityId: string, userId: bigint, deps: SubmissionDeps) {
  const community = await db.query.communities.findFirst({
    where: eq(communities.id, communityId),
  });
  if (!community || !Number.isSafeInteger(Number(community.telegramChatId)))
    return "unavailable" as const;
  try {
    if (!(await deps.membership(community.telegramChatId, userId))) return "not_member" as const;
  } catch {
    return "membership_unavailable" as const;
  }
  const member = await ensureMember(db, {
    communityId,
    telegramUserId: userId,
    telegramUsername: null,
  });
  return { community, member };
}

async function promptLimited(db: Db, communityId: string, userId: bigint, now: Date) {
  const [row] = await db
    .select({ n: count() })
    .from(raidSubmissionSessions)
    .where(
      and(
        eq(raidSubmissionSessions.communityId, communityId),
        eq(raidSubmissionSessions.telegramUserId, userId),
        gte(raidSubmissionSessions.createdAt, new Date(now.getTime() - 3_600_000)),
      ),
    );
  // A technical bound on abandoned prompts; it does not limit reward credit or model spending.
  return (row?.n ?? 0) >= 10;
}

async function duplicateKind(
  db: Db,
  session: Session,
  memberId: string,
  statusId: string,
): Promise<Refusal | undefined> {
  const seen = await db.query.contributions.findFirst({
    where: and(
      eq(contributions.communityId, session.communityId),
      like(contributions.url, `%/status/${statusId}`),
    ),
  });
  if (seen) return "duplicate_artifact";
  const taken = await db.query.contributions.findFirst({
    where: and(
      eq(contributions.communityId, session.communityId),
      eq(contributions.memberId, memberId),
      eq(contributions.taskId, session.taskId),
      eq(contributions.kind, session.kind),
    ),
  });
  return taken ? "kind_taken" : undefined;
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
  if (!task.telegramMessageId || task.telegramMessageId <= 0) return { error: "unavailable" };
  if (
    await promptLimited(
      db,
      task.communityId,
      userId,
      await (deps.clock ?? dbClock)(db, task.communityId),
    )
  )
    return { error: "prompt_limited" };
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
    if (!current.telegramMessageId || current.telegramMessageId <= 0)
      return { error: "unavailable" };
    if (await promptLimited(tx, community.id, userId, now)) return { error: "prompt_limited" };
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

export async function cancelSubmission(
  db: Db,
  sessionId: string,
  userId: bigint,
  clock: Clock = dbClock,
) {
  if (!COMMUNITY_ID.test(sessionId) || userId <= 0n) return false;
  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(raidSubmissionSessions)
      .where(
        and(
          eq(raidSubmissionSessions.id, sessionId),
          eq(raidSubmissionSessions.telegramUserId, userId),
        ),
      )
      .for("update");
    if (!session) return false;
    if (session.cancelledAt) return true;
    const now = await clock(tx, session.communityId);
    await tx
      .update(raidSubmissionSessions)
      .set({ cancelledAt: now })
      .where(
        and(eq(raidSubmissionSessions.id, sessionId), isNull(raidSubmissionSessions.cancelledAt)),
      );
    return true;
  });
}

export async function acceptSubmission(
  db: Db,
  input: { sessionId: string; userId: bigint; url: string },
  deps: SubmissionDeps,
): Promise<{ receipt: Receipt; lane: "reward" | "legacy"; replay: boolean } | { error: Refusal }> {
  if (
    !COMMUNITY_ID.test(input.sessionId) ||
    input.userId <= 0n ||
    !Number.isSafeInteger(Number(input.userId))
  )
    return { error: "unavailable" };
  const session = await db.query.raidSubmissionSessions.findFirst({
    where: and(
      eq(raidSubmissionSessions.id, input.sessionId),
      eq(raidSubmissionSessions.telegramUserId, input.userId),
    ),
  });
  if (!session) return { error: "unavailable" };
  const found = await memberContext(db, session.communityId, input.userId);
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
  if (old) {
    if (old.memberId !== found.member.id || old.artifactKey !== artifactKey)
      return { error: "unavailable" };
    const checked = await currentMember(db, session.communityId, input.userId, deps);
    if (typeof checked === "string") return { error: checked };
    return { receipt: old, lane: oldIntake ? "reward" : "legacy", replay: true };
  }
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
  if (!task.telegramMessageId || task.telegramMessageId <= 0) return { error: "unavailable" };
  if (parsePostUrl(task.targetUrl ?? "")?.id === parsed.id) return { error: "target_itself" };
  const duplicate = await duplicateKind(db, session, found.member.id, parsed.id);
  if (duplicate) return { error: duplicate };
  const beforeFetch = await currentMember(db, session.communityId, input.userId, deps);
  if (typeof beforeFetch === "string") return { error: beforeFetch };
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
  // Telegram cannot participate in a DB transaction. Check immediately after retrieval, then
  // revalidate the same registered chat/member/window under the lock without network I/O.
  const checked = await currentMember(db, session.communityId, input.userId, deps);
  if (typeof checked === "string") return { error: checked };
  return withCommunityLock(db, session.communityId, deps, async (tx, community) => {
    const [lockedSession] = await tx
      .select()
      .from(raidSubmissionSessions)
      .where(eq(raidSubmissionSessions.id, session.id))
      .for("update");
    if (community.telegramChatId !== checked.community.telegramChatId)
      return { error: "membership_unavailable" };
    const caller = await memberContext(tx, community.id, input.userId);
    if (typeof caller === "string") return { error: caller };
    if (caller.member.id !== checked.member.id) return { error: "unavailable" };
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
    if (!current.telegramMessageId || current.telegramMessageId <= 0)
      return { error: "unavailable" };
    const duplicate = await duplicateKind(tx, session, caller.member.id, parsed.id);
    if (duplicate) return { error: duplicate };
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
    const captured = capturedEvidence({ post }, current.telegramMessageId, now);
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
    let receivedAt = now;
    if (routed.lane === "reward") {
      if (routed.result.status !== "admitted") return { error: routed.result.status };
      contributionId = routed.result.intake.contributionId;
      receivedAt = routed.result.intake.acceptedAt;
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
        receivedAt,
      })
      .returning();
    if (!receipt) throw new Error("Receipt insert failed");
    return { receipt, lane: routed.lane, replay: false };
  });
}

// The callback must insert its pg-boss job using this transaction's adapter. Job and receipt
// commit together; a lost commit acknowledgement is resolved by rereading this durable row.
export async function queueSubmission(
  db: Db,
  receipt: Receipt,
  enqueue: (tx: Db) => Promise<string | null>,
) {
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(raidSubmissionReceipts)
        .where(
          and(
            eq(raidSubmissionReceipts.id, receipt.id),
            eq(raidSubmissionReceipts.communityId, receipt.communityId),
            eq(raidSubmissionReceipts.memberId, receipt.memberId),
            eq(raidSubmissionReceipts.contributionId, receipt.contributionId),
          ),
        )
        .for("update");
      if (!current) return false;
      if (current.queueStatus === "queued") return true;
      if (!(await enqueue(tx))) throw new Error("Submission queue did not accept job");
      await tx
        .update(raidSubmissionReceipts)
        .set({ queueStatus: "queued" })
        .where(eq(raidSubmissionReceipts.id, current.id));
      return true;
    });
  } catch {
    return false;
  }
}
