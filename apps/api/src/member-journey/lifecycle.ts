import { communities, type Db, raidLifecycleEvents, tasks } from "@hyphae/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { type Clock, dbClock } from "../rewards/config.js";

type Task = typeof tasks.$inferSelect;
type LifecycleEvent = typeof raidLifecycleEvents.$inferSelect;
export type RaidState =
  | "active"
  | "upcoming"
  | "expired"
  | "closed"
  | "cancelled"
  | "proposed"
  | "rejected";

export function raidState(
  task: Pick<Task, "status" | "opensAt" | "closesAt">,
  terminalEvent?: Pick<LifecycleEvent, "action"> | null,
  now = new Date(),
): RaidState {
  if (terminalEvent?.action === "cancelled") return "cancelled";
  if (terminalEvent?.action === "closed") return "closed";
  if (task.status !== "open") return task.status;
  if (now >= task.closesAt) return "expired";
  if (now < task.opensAt) return "upcoming";
  return "active";
}

const TransitionInput = z
  .object({
    communityId: z.uuid(),
    taskId: z.uuid(),
    chatId: z.bigint().negative(),
    actorId: z.bigint().positive(),
    messageId: z.number().int().positive(),
    action: z.enum(["closed", "cancelled"]),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export type RaidTransition = z.infer<typeof TransitionInput>;
export type RaidTransitionResult =
  | { status: "invalid" }
  | { status: "unauthorized" }
  | { status: "not_found" }
  | { status: "terminal"; state: RaidState }
  | { status: "changed" | "existing"; task: Task; event: LifecycleEvent; state: RaidState };

export async function transitionRaid(
  db: Db,
  input: RaidTransition,
  clock: Clock = dbClock,
): Promise<RaidTransitionResult> {
  const parsed = TransitionInput.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const value = parsed.data;
  return db.transaction(async (tx) => {
    // Share the open/intake lock order so authority changes and terminal actions serialize.
    const [community] = await tx
      .select()
      .from(communities)
      .where(eq(communities.id, value.communityId))
      .for("no key update");
    if (
      !community ||
      community.telegramChatId !== value.chatId ||
      community.adminTelegramUserId !== value.actorId
    )
      return { status: "unauthorized" };
    const [task] = await tx
      .select()
      .from(tasks)
      // Historical open briefs also hold the one-active-brief gate and need the same audited exit.
      .where(and(eq(tasks.id, value.taskId), eq(tasks.communityId, value.communityId)))
      .for("update");
    if (!task) return { status: "not_found" };
    const [previous] = await tx
      .select()
      .from(raidLifecycleEvents)
      .where(
        and(
          eq(raidLifecycleEvents.communityId, value.communityId),
          eq(raidLifecycleEvents.taskId, value.taskId),
          inArray(raidLifecycleEvents.action, ["closed", "cancelled"]),
        ),
      )
      .orderBy(desc(raidLifecycleEvents.createdAt))
      .limit(1);
    const now = await clock(tx, value.communityId);
    const state = raidState(task, previous, now);
    if (previous?.action === value.action)
      return { status: "existing", task, event: previous, state };
    if (previous || task.status !== "open") return { status: "terminal", state };

    // Keep the frozen worker's status contract. Cancellation is an audit event, never a score edit.
    const [closed] = await tx
      .update(tasks)
      .set({ status: "closed" })
      .where(and(eq(tasks.id, task.id), eq(tasks.communityId, value.communityId)))
      .returning();
    const [event] = await tx
      .insert(raidLifecycleEvents)
      .values({
        communityId: value.communityId,
        taskId: task.id,
        actorTelegramUserId: value.actorId,
        action: value.action,
        reason: value.reason,
        telegramMessageId: value.messageId,
        createdAt: now,
      })
      .returning();
    if (!closed || !event) throw new Error("Raid transition failed");
    return { status: "changed", task: closed, event, state: value.action };
  });
}
