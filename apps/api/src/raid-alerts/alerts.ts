import {
  communities,
  type Db,
  raidAnnouncements,
  raidDeliveries,
  raidLifecycleEvents,
  raidSubscriptions,
  tasks,
} from "@hyphae/db";
import { and, asc, eq, gt, lte, sql } from "drizzle-orm";
import { GrammyError } from "grammy";
import { clipMessageText } from "../bot/text.js";
import { type Clock, dbClock } from "../rewards/config.js";
import type { XPost } from "../x/oembed.js";

export const ALERT_PREFIX = "raids_";
export const ENABLE_PREFIX = "raids_on_";
export const STOP_PREFIX = "raids_off_";
export const COMMUNITY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const alertLink = (username: string, communityId: string) =>
  `https://t.me/${username}?start=${ALERT_PREFIX}${communityId}`;

export async function setRaidSubscription(
  db: Db,
  communityId: string,
  telegramUserId: bigint,
  enabled: boolean,
  clock: Clock = dbClock,
) {
  if (telegramUserId <= 0n || !COMMUNITY_ID.test(communityId))
    throw new Error("Invalid subscription identity");
  return db.transaction(async (tx) => {
    const now = await clock(tx, communityId);
    if (!enabled) {
      await tx
        .update(raidSubscriptions)
        .set({ enabled: false, revision: sql`${raidSubscriptions.revision} + 1` })
        .where(
          and(
            eq(raidSubscriptions.communityId, communityId),
            eq(raidSubscriptions.telegramUserId, telegramUserId),
            eq(raidSubscriptions.enabled, true),
          ),
        );
      return;
    }
    await tx
      .insert(raidSubscriptions)
      .values({ communityId, telegramUserId, enabled: true, enabledAt: now })
      .onConflictDoUpdate({
        target: [raidSubscriptions.communityId, raidSubscriptions.telegramUserId],
        set: {
          enabled: true,
          revision: sql`case when ${raidSubscriptions.enabled} then ${raidSubscriptions.revision} else ${raidSubscriptions.revision} + 1 end`,
          enabledAt: sql`case when ${raidSubscriptions.enabled} then ${raidSubscriptions.enabledAt} else ${now.toISOString()}::timestamptz end`,
        },
      });
  });
}

// Each raid carries its own Submit buttons and its own reply/quote cap, so raids do not
// interfere; the ceiling only stops one admin flooding the chat.
export const MAX_OPEN_RAIDS = 3;

export interface OpenRaid {
  communityId: string;
  chatId: bigint;
  actorId: bigint;
  messageId: number;
  hours: number;
  brief: string;
  post: XPost;
}
type RaidResult =
  | { status: "unauthorized" }
  | { status: "limit_reached"; open: (typeof tasks.$inferSelect)[] }
  | { status: "created" | "existing"; task: typeof tasks.$inferSelect };
export async function openRaid(
  db: Db,
  input: OpenRaid,
  clock: Clock = dbClock,
): Promise<RaidResult> {
  return db.transaction(async (tx) => {
    const [community] = await tx
      .select()
      .from(communities)
      .where(eq(communities.id, input.communityId))
      .for("no key update");
    if (
      !community ||
      community.telegramChatId !== input.chatId ||
      community.adminTelegramUserId !== input.actorId
    )
      return { status: "unauthorized" };
    // A webhook retry reuses the original event; a migrated chat has a different source key.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`raid:${input.communityId}:${input.chatId}:${input.messageId}`}))`,
    );
    const old = await tx
      .select({ task: tasks })
      .from(raidAnnouncements)
      .innerJoin(tasks, eq(tasks.id, raidAnnouncements.taskId))
      .where(
        and(
          eq(raidAnnouncements.communityId, input.communityId),
          eq(raidAnnouncements.telegramChatId, input.chatId),
          eq(raidAnnouncements.telegramMessageId, input.messageId),
        ),
      );
    if (old[0]) return { status: "existing", task: old[0].task };
    const now = await clock(tx, input.communityId);
    const active = await tx.query.tasks.findMany({
      where: and(
        eq(tasks.communityId, community.id),
        eq(tasks.status, "open"),
        gt(tasks.closesAt, now),
      ),
      limit: MAX_OPEN_RAIDS,
    });
    if (active.length >= MAX_OPEN_RAIDS) return { status: "limit_reached", open: active };
    const [task] = await tx
      .insert(tasks)
      .values({
        communityId: input.communityId,
        kind: "raid",
        status: "open",
        targetUrl: input.post.url,
        targetText: input.post.text,
        targetAuthor: input.post.handle,
        brief: input.brief,
        opensAt: now,
        closesAt: new Date(now.getTime() + input.hours * 3_600_000),
        telegramMessageId: input.messageId,
      })
      .returning();
    if (!task) throw new Error("Raid creation failed");
    await tx.insert(raidLifecycleEvents).values({
      communityId: community.id,
      taskId: task.id,
      actorTelegramUserId: input.actorId,
      action: "opened",
      reason: input.brief || "Raid opened",
      telegramMessageId: input.messageId,
      createdAt: now,
    });
    const [event] = await tx
      .insert(raidAnnouncements)
      .values({
        communityId: input.communityId,
        telegramChatId: input.chatId,
        telegramMessageId: input.messageId,
        taskId: task.id,
      })
      .returning();
    if (!event) throw new Error("Raid announcement failed");
    const subscribers = await tx
      .select()
      .from(raidSubscriptions)
      .where(
        and(
          eq(raidSubscriptions.communityId, input.communityId),
          eq(raidSubscriptions.enabled, true),
          lte(raidSubscriptions.enabledAt, now),
        ),
      );
    for (let i = 0; i < subscribers.length; i += 500) {
      await tx.insert(raidDeliveries).values(
        subscribers.slice(i, i + 500).map((s) => ({
          announcementId: event.id,
          telegramUserId: s.telegramUserId,
          subscriptionRevision: s.revision,
          nextAttemptAt: now,
        })),
      );
    }
    return { status: "created", task };
  });
}

// Claims interrupted before dispatch may recover. Started sends stay uncertain and are never blindly resent.
export async function claimRaidAlert(db: Db, now?: Date) {
  return db.transaction(async (tx) => {
    const due = now ? sql`${now.toISOString()}::timestamptz` : sql`clock_timestamp()`;
    await tx
      .update(raidDeliveries)
      .set({
        status: sql`case when ${raidDeliveries.dispatchStarted} then 'uncertain'::raid_delivery_status else 'pending'::raid_delivery_status end`,
        reason: sql`case when ${raidDeliveries.dispatchStarted} then 'interrupted_send' else 'claim_recovered' end`,
        nextAttemptAt: due,
      })
      .where(
        and(
          eq(raidDeliveries.status, "sending"),
          sql`${raidDeliveries.attemptedAt} < ${due} - interval '60 seconds'`,
        ),
      );
    const [row] = await tx
      .select()
      .from(raidDeliveries)
      .where(
        and(eq(raidDeliveries.status, "pending"), sql`${raidDeliveries.nextAttemptAt} <= ${due}`),
      )
      .orderBy(asc(raidDeliveries.nextAttemptAt), asc(raidDeliveries.id))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!row) return;
    const [claimed] = await tx
      .update(raidDeliveries)
      .set({ status: "sending", attemptedAt: due })
      .where(eq(raidDeliveries.id, row.id))
      .returning();
    return claimed;
  });
}

export interface AlertSender {
  clock?: Clock;
  membership(chatId: bigint, userId: bigint): Promise<boolean>;
  send(
    userId: bigint,
    text: string,
    target: string,
    stop: string,
    taskId: string,
  ): Promise<unknown>;
}
export async function deliverRaidAlert(db: Db, id: string, deps: AlertSender) {
  const [started] = await db
    .update(raidDeliveries)
    .set({ dispatchStarted: true })
    .where(
      and(
        eq(raidDeliveries.id, id),
        eq(raidDeliveries.status, "sending"),
        eq(raidDeliveries.dispatchStarted, false),
      ),
    )
    .returning({ id: raidDeliveries.id });
  if (!started) {
    const [existing] = await db
      .select({ status: raidDeliveries.status })
      .from(raidDeliveries)
      .where(eq(raidDeliveries.id, id));
    return existing?.status;
  }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(raidDeliveries)
      .where(eq(raidDeliveries.id, id))
      .for("update");
    if (row?.status !== "sending") return row?.status;
    const [context] = await tx
      .select({ event: raidAnnouncements, task: tasks, community: communities })
      .from(raidAnnouncements)
      .innerJoin(tasks, eq(tasks.id, raidAnnouncements.taskId))
      .innerJoin(communities, eq(communities.id, raidAnnouncements.communityId))
      .where(eq(raidAnnouncements.id, row.announcementId));
    if (!context) throw new Error("Raid delivery context missing");
    const { task, community } = context;
    // The consent row stays locked through the bounded send: a successful Stop cannot race it.
    const [sub] = await tx
      .select()
      .from(raidSubscriptions)
      .where(
        and(
          eq(raidSubscriptions.communityId, community.id),
          eq(raidSubscriptions.telegramUserId, row.telegramUserId),
        ),
      )
      .for("update");
    const clock = deps.clock ?? dbClock;
    const finish = async (
      status: (typeof raidDeliveries.$inferSelect)["status"],
      reason: string | null,
      retrySeconds?: number,
    ) => {
      const now = await clock(tx, community.id);
      await tx
        .update(raidDeliveries)
        .set({
          status,
          reason,
          ...(status === "pending" && { dispatchStarted: false }),
          ...(status === "sent" && { sentAt: now }),
          ...(retrySeconds !== undefined && {
            nextAttemptAt: new Date(now.getTime() + retrySeconds * 1000),
          }),
        })
        .where(eq(raidDeliveries.id, row.id));
      return status;
    };
    const disable = async () => {
      await tx
        .update(raidSubscriptions)
        .set({ enabled: false, revision: sql`${raidSubscriptions.revision} + 1` })
        .where(
          and(
            eq(raidSubscriptions.communityId, community.id),
            eq(raidSubscriptions.telegramUserId, row.telegramUserId),
          ),
        );
    };
    if (
      !Number.isSafeInteger(Number(row.telegramUserId)) ||
      !Number.isSafeInteger(Number(community.telegramChatId))
    )
      return finish("skipped", "invalid_identity");
    if (!sub?.enabled || sub.revision !== row.subscriptionRevision)
      return finish("skipped", "consent_changed");
    const target = task.targetUrl;
    if (
      task.communityId !== community.id ||
      task.kind !== "raid" ||
      task.status !== "open" ||
      !target ||
      !/^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/\d+$/.test(target)
    )
      return finish("skipped", "invalid_task");
    const beforeLookup = await clock(tx, community.id);
    if (task.opensAt > beforeLookup || task.closesAt <= beforeLookup)
      return finish("skipped", "outside_window");
    let member: boolean;
    try {
      member = await deps.membership(community.telegramChatId, row.telegramUserId);
    } catch {
      return finish("pending", "membership_unavailable", 60);
    }
    if (!member) {
      await disable();
      return finish("skipped", "not_member");
    }
    // Close/cancel waits for an in-flight alert; after confirmation no new send may start.
    const [liveTask] = await tx.select().from(tasks).where(eq(tasks.id, task.id)).for("share");
    if (!liveTask || liveTask.communityId !== community.id || liveTask.status !== "open")
      return finish("skipped", "invalid_task");
    const now = await clock(tx, community.id);
    if (task.opensAt > now || task.closesAt <= now) return finish("skipped", "outside_window");
    const text = [
      `New raid · ${clipMessageText(community.name, 200)}`,
      task.targetUrl,
      ...(task.targetText ? [`Post: ${clipMessageText(task.targetText, 400)}`] : []),
      task.brief
        ? `Brief: ${clipMessageText(task.brief, 1000)}`
        : "Reply or quote with your own view.",
      `Closes ${task.closesAt.toISOString()} (UTC).`,
      "Tap Reply on X or Quote on X and post it, then tap Submit my reply or Submit my quote below. Your private submission is bound to this exact raid; /submit never chooses a raid for you.",
      "A raid window does not extend the reward epoch’s intake deadline. Check /help brief in the group.",
      "Points do not promise payment. You can stop this community's alerts below.",
    ].join("\n\n");
    try {
      await deps.send(row.telegramUserId, text, target, `${STOP_PREFIX}${community.id}`, task.id);
    } catch (err) {
      if (err instanceof GrammyError && err.error_code === 429) {
        const delay = err.parameters.retry_after;
        return finish(
          "pending",
          "telegram_rate_limit",
          typeof delay === "number" && Number.isSafeInteger(delay) && delay > 0 ? delay : 60,
        );
      }
      if (err instanceof GrammyError && (err.error_code === 400 || err.error_code === 403)) {
        if (err.error_code === 403) await disable();
        return finish("failed", "telegram_rejected");
      }
      // Network errors and 5xx can follow acceptance. Save no raw errors, tokens or payloads.
      return finish("uncertain", "send_unknown");
    }
    return finish("sent", null);
  });
}
