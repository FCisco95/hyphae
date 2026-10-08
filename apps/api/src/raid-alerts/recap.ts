import { communities, type Db, raidLifecycleEvents, raidRecaps, tasks } from "@hyphae/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { GrammyError } from "grammy";
import { type Clock, dbClock } from "../rewards/config.js";
import { plural, type RaidStats, raidStats, span } from "./stats.js";

export interface RecapInput {
  closed: boolean;
  handle: string | null;
  url: string | null;
  ranMs: number;
  stats: RaidStats;
  webBase: string;
  mint: string;
}

// Public group text: counts only, never a member name or handle.
export function recapText(r: RecapInput) {
  const s = r.stats;
  const total = s.replies + s.quotes;
  const base = r.webBase.replace(/\/$/, "");
  return [
    `Raid ${r.closed ? "closed" : "ended"} — @${r.handle ?? "?"}:`,
    r.url ?? "No target",
    `Ran for ${span(r.ranMs)}.`,
    ...(total
      ? [
          `${plural(s.members, "member", "members")} took part: ${plural(s.replies, "reply", "replies")}, ${plural(s.quotes, "quote", "quotes")}.`,
          `Credited so far: ${s.credited} of ${total}${s.averageCredited === null ? "" : `, average credited score ${s.averageCredited}`}.`,
          ...(s.scoring ? [`${s.scoring} still being scored and may be credited later.`] : []),
        ]
      : ["No submissions."]),
    ...(s.epochs.length
      ? s.epochs.map((n) => `Epoch ${n} results: ${base}/c/${r.mint}/e/${n}`)
      : [`Results: ${base}/c/${r.mint}`]),
  ].join("\n");
}

export interface RecapClaim {
  taskId: string;
  communityId: string;
  chatId: bigint;
  text: string;
  retryUsed: boolean;
}

const closedAt = sql`(select ${raidLifecycleEvents.createdAt} from ${raidLifecycleEvents} where ${raidLifecycleEvents.taskId} = ${tasks.id} and ${raidLifecycleEvents.action} = 'closed')`;
// least() skips the null of a raid nobody closed, leaving its window end.
const endedAt = sql`least(${tasks.closesAt}, ${closedAt})`;

// Claims one raid that ended (admin close or window over) within the last hour and is not
// cancelled. Older raids never get a recap, so a release or an outage does not replay history.
export async function claimRaidRecap(
  db: Db,
  webBase: string,
  now?: Date,
): Promise<RecapClaim | undefined> {
  return db.transaction(async (tx) => {
    const due = now ? sql`${now.toISOString()}::timestamptz` : sql`clock_timestamp()`;
    // A close or cancel in flight holds NO KEY UPDATE on the task: skip it and read its outcome
    // on the next pass, so a raid being cancelled is never recapped.
    const [task] = await tx
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.kind, "raid"),
          inArray(tasks.status, ["open", "closed"]),
          sql`${endedAt} <= ${due}`,
          sql`${endedAt} > ${due} - interval '1 hour'`,
          sql`not exists (select 1 from ${raidLifecycleEvents} where ${raidLifecycleEvents.taskId} = ${tasks.id} and ${raidLifecycleEvents.action} = 'cancelled')`,
          sql`not exists (select 1 from ${raidRecaps} where ${raidRecaps.taskId} = ${tasks.id} and not (${raidRecaps.status} = 'pending' and ${raidRecaps.nextAttemptAt} <= ${due}))`,
        ),
      )
      .orderBy(asc(endedAt), asc(tasks.id))
      .limit(1)
      .for("share", { of: tasks, skipLocked: true });
    if (!task) return;
    const [claimed] = await tx
      .insert(raidRecaps)
      .values({
        taskId: task.id,
        communityId: task.communityId,
        status: "sending",
        nextAttemptAt: due,
        attemptedAt: due,
      })
      .onConflictDoUpdate({
        target: raidRecaps.taskId,
        // Only a 429 leaves a row pending, so this claim is its one retry. The deadline is
        // rechecked on the conflicting row: another process may have deferred it after our SELECT.
        set: { status: "sending", attemptedAt: due, retryUsed: true },
        setWhere: sql`${raidRecaps.status} = 'pending' and ${raidRecaps.nextAttemptAt} <= ${due}`,
      })
      .returning({ taskId: raidRecaps.taskId, retryUsed: raidRecaps.retryUsed });
    if (!claimed) return;
    const [community] = await tx
      .select({ chatId: communities.telegramChatId, mint: communities.mint })
      .from(communities)
      .where(eq(communities.id, task.communityId));
    if (!community) throw new Error("Raid recap community missing");
    const [close] = await tx
      .select({ at: raidLifecycleEvents.createdAt })
      .from(raidLifecycleEvents)
      .where(
        and(eq(raidLifecycleEvents.taskId, task.id), eq(raidLifecycleEvents.action, "closed")),
      );
    const closed = close !== undefined && close.at < task.closesAt;
    const at = now ?? (await dbClock(tx, task.communityId));
    const stats = (await raidStats(tx, [task.id], at)).get(task.id);
    if (!stats) throw new Error("Raid recap stats missing");
    return {
      taskId: task.id,
      communityId: task.communityId,
      chatId: community.chatId,
      retryUsed: claimed.retryUsed,
      text: recapText({
        closed,
        handle: task.targetAuthor,
        url: task.targetUrl,
        ranMs: (closed ? close.at : task.closesAt).getTime() - task.opensAt.getTime(),
        stats,
        webBase,
        mint: community.mint,
      }),
    };
  });
}

export interface RecapSender {
  clock?: Clock;
  send(chatId: bigint, text: string): Promise<{ message_id: number }>;
}
export async function deliverRaidRecap(db: Db, claim: RecapClaim, deps: RecapSender) {
  return db.transaction(async (tx) => {
    const finish = async (
      status: (typeof raidRecaps.$inferSelect)["status"],
      reason: string | null,
      extra: Partial<typeof raidRecaps.$inferInsert> = {},
    ) => {
      await tx
        .update(raidRecaps)
        .set({ status, reason, ...extra })
        .where(eq(raidRecaps.taskId, claim.taskId));
      return status;
    };
    const clock = () => (deps.clock ?? dbClock)(tx, claim.communityId);
    // The task lock is held through the bounded send: /cancel_raid waits for it, and once a
    // cancellation has committed no recap send can start. The community lock is never taken here.
    await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, claim.taskId)).for("share");
    const [cancelled] = await tx
      .select({ taskId: raidLifecycleEvents.taskId })
      .from(raidLifecycleEvents)
      .where(
        and(
          eq(raidLifecycleEvents.taskId, claim.taskId),
          eq(raidLifecycleEvents.action, "cancelled"),
        ),
      );
    if (cancelled) return finish("skipped", "raid_cancelled");
    try {
      const message = await deps.send(claim.chatId, claim.text);
      return finish("sent", null, { sentAt: await clock(), telegramMessageId: message.message_id });
    } catch (err) {
      if (err instanceof GrammyError && err.error_code === 429) {
        if (claim.retryUsed) return finish("failed", "rate_limit_retry_exhausted");
        const delay = err.parameters.retry_after;
        const seconds =
          typeof delay === "number" && Number.isSafeInteger(delay) && delay > 0 ? delay : 60;
        return finish("pending", "telegram_rate_limit", {
          nextAttemptAt: new Date((await clock()).getTime() + seconds * 1000),
        });
      }
      if (err instanceof GrammyError && (err.error_code === 400 || err.error_code === 403))
        return finish("failed", "telegram_rejected");
      // Network errors and 5xx can follow acceptance, so the recap is never sent twice.
      return finish("uncertain", "send_unknown");
    }
  });
}
