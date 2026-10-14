import { RubricSchema } from "@hyphae/core";
import { communities, type Db, raidCards, raidLifecycleEvents, tasks } from "@hyphae/db";
import { and, asc, eq, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { type Api, GrammyError, type InlineKeyboard } from "grammy";
import { raidStats } from "../raid-alerts/stats.js";
import { dbClock } from "../rewards/config.js";
import { type CardState, cardCaption, cardKeyboard, messageLink, renderHash } from "./render.js";

export interface CardEditor {
  editCaption(
    chatId: bigint,
    messageId: number,
    caption: string,
    keyboard: InlineKeyboard,
  ): Promise<unknown>;
  editText(
    chatId: bigint,
    messageId: number,
    text: string,
    keyboard: InlineKeyboard,
  ): Promise<unknown>;
  unpin(chatId: bigint, messageId: number): Promise<unknown>;
  botUsername(): Promise<string>;
}

export type CardOutcome =
  | "edited"
  | "unchanged"
  | "final"
  | "gone"
  | "rate_limited"
  | "failed"
  | "lost";

const HOLD_MS = 30_000;
const REFRESH_MS = 60_000;

const retryAfter = (e: GrammyError) => {
  const wait = e.parameters.retry_after;
  return (typeof wait === "number" && wait > 0 ? wait : 60) * 1000;
};

const cancelled = sql`exists (select 1 from ${raidLifecycleEvents} where ${raidLifecycleEvents.taskId} = ${tasks.id} and ${raidLifecycleEvents.action} = 'cancelled')`;

// Due when its minute is up, at once when an open card's raid has ended, and at once when an open
// or ended card's raid was cancelled: /cancel_raid accepts a raid whose window is over but that
// nobody closed, so a cancel can land after the card was drawn as ended.
// The claim's hold keeps a crashed or failing card from being retried every second, so it commits
// before anything else is read: a throw after it (a rubric that no longer parses) leaves the hold
// in place instead of rolling it back and starving every other card. It locks only the card row
// and commits before any Telegram call; tasks is read unlocked because the recap holds a share
// lock on a task while it updates the card.
async function claimDueCard(db: Db, now?: Date) {
  const claimed = await db.transaction(async (tx) => {
    const due = now ? sql`${now.toISOString()}::timestamptz` : sql`clock_timestamp()`;
    const [row] = await tx
      .select({ card: raidCards, task: tasks })
      .from(raidCards)
      .innerJoin(tasks, eq(tasks.id, raidCards.taskId))
      .where(
        and(
          or(isNull(raidCards.holdUntil), lte(raidCards.holdUntil, due)),
          or(
            and(
              isNotNull(raidCards.nextRefreshAt),
              or(
                lte(raidCards.nextRefreshAt, due),
                and(
                  eq(raidCards.state, "open"),
                  or(lte(tasks.closesAt, due), eq(tasks.status, "closed")),
                ),
              ),
            ),
            and(inArray(raidCards.state, ["open", "ended"]), cancelled),
          ),
        ),
      )
      .orderBy(asc(raidCards.nextRefreshAt))
      .limit(1)
      .for("update", { of: raidCards, skipLocked: true });
    if (!row) return;
    const at = now ?? (await dbClock(tx, row.card.communityId));
    const lease = new Date(at.getTime() + HOLD_MS);
    await tx
      .update(raidCards)
      .set({ holdUntil: lease })
      .where(eq(raidCards.taskId, row.card.taskId));
    return { ...row, at, lease };
  });
  if (!claimed) return;
  const [community] = await db
    .select({ rubric: communities.rubric })
    .from(communities)
    .where(eq(communities.id, claimed.card.communityId));
  const events = await db
    .select({
      action: raidLifecycleEvents.action,
      reason: raidLifecycleEvents.reason,
      at: raidLifecycleEvents.createdAt,
    })
    .from(raidLifecycleEvents)
    .where(eq(raidLifecycleEvents.taskId, claimed.task.id));
  const stats = (await raidStats(db, [claimed.task.id], claimed.at)).get(claimed.task.id);
  if (!community || !stats) throw new Error("raid card: community or stats missing");
  return { ...claimed, rubric: RubricSchema.parse(community.rubric), events, stats };
}

export async function refreshDueCard(
  db: Db,
  editor: CardEditor,
  now?: Date,
): Promise<CardOutcome | undefined> {
  const claim = await claimDueCard(db, now);
  if (!claim) return;
  const { card, task, at, rubric, events, stats } = claim;
  // Every write after the claim is fenced on its latest lease, and the lease is renewed (compare and
  // set) right before each Telegram call: a claim whose reads outlasted its lease, and so may have
  // been overtaken, sends nothing and writes nothing. The lease is a JS Date, never SQL's clock, so
  // the fence compares exact milliseconds.
  let lease = claim.lease;
  const leased = () => and(eq(raidCards.taskId, card.taskId), eq(raidCards.holdUntil, lease));
  const renew = async () => {
    const fresh = new Date((now ?? (await dbClock(db, card.communityId))).getTime() + HOLD_MS);
    const [kept] = await db
      .update(raidCards)
      .set({ holdUntil: fresh })
      .where(leased())
      .returning({ taskId: raidCards.taskId });
    if (kept) lease = fresh;
    return kept !== undefined;
  };
  const cancel = events.find((e) => e.action === "cancelled");
  const close = events.find((e) => e.action === "closed");
  const state: CardState = cancel
    ? "cancelled"
    : task.status === "closed" || task.closesAt <= at
      ? "ended"
      : "open";
  const end = close && close.at < task.closesAt ? close.at : task.closesAt;
  const caption = cardCaption({
    state,
    handle: task.targetAuthor,
    closesAt: task.closesAt,
    brief: task.brief,
    fullUntilMinutes: rubric.timing.fullUntil,
    stats,
    ranMs: end.getTime() - task.opensAt.getTime(),
    cancelReason: cancel?.reason ?? null,
    now: at,
  });
  const keyboard = cardKeyboard(
    state,
    await editor.botUsername(),
    task.id,
    task.targetUrl ?? "",
    card.resultsMessageId === null ? null : messageLink(card.telegramChatId, card.resultsMessageId),
  );
  const hash = renderHash(caption, keyboard);
  const final = state !== "open";
  const unpin =
    final && card.pinnedAt !== null && card.unpinnedAt === null && card.pinError === null;
  // An unpin is recorded only once Telegram confirms it. A refusal no retry can change (message
  // gone, no rights, bot removed) is recorded instead; anything else keeps the card due.
  const unpinCard = async (): Promise<
    { unpinnedAt?: Date; pinError?: string; retryMs?: number } | "lost"
  > => {
    if (!unpin) return {};
    if (!(await renew())) return "lost";
    try {
      await editor.unpin(card.telegramChatId, card.telegramMessageId);
      return { unpinnedAt: at };
    } catch (e) {
      if (e instanceof GrammyError && e.error_code === 429) return { retryMs: retryAfter(e) };
      if (e instanceof GrammyError && (e.error_code === 400 || e.error_code === 403)) {
        console.warn(JSON.stringify({ card: "unpin_failed", description: e.description }));
        return { pinError: `unpin_${e.error_code}` };
      }
      return { retryMs: REFRESH_MS };
    }
  };
  const hold = (ms: number, marks: { unpinnedAt?: Date; pinError?: string } = {}) =>
    db
      .update(raidCards)
      .set({ holdUntil: new Date(at.getTime() + ms), ...marks })
      .where(leased());
  let outcome: CardOutcome = hash === card.renderedHash ? "unchanged" : "edited";
  if (outcome === "edited") {
    if (!(await renew())) return "lost";
    try {
      if (card.format === "photo")
        await editor.editCaption(card.telegramChatId, card.telegramMessageId, caption, keyboard);
      else await editor.editText(card.telegramChatId, card.telegramMessageId, caption, keyboard);
    } catch (e) {
      const error = e instanceof GrammyError ? e : null;
      if (error?.error_code === 400 && /not modified/i.test(error.description))
        outcome = "unchanged";
      else if (
        error &&
        (error.error_code === 403 ||
          (error.error_code === 400 && /not found|MESSAGE_ID_INVALID/i.test(error.description)))
      ) {
        await db
          .update(raidCards)
          .set({ state: "gone", nextRefreshAt: null, holdUntil: null })
          .where(leased());
        return "gone";
      } else if (error?.error_code === 429) {
        await hold(retryAfter(error));
        return "rate_limited";
      } else {
        // A persistent edit error must not leave a finished card pinned with live buttons.
        const unpinned = await unpinCard();
        if (unpinned === "lost") return "lost";
        const { retryMs = 0, ...marks } = unpinned;
        await hold(Math.max(REFRESH_MS, retryMs), marks);
        return "failed";
      }
    }
  }
  const unpinned = await unpinCard();
  if (unpinned === "lost") return "lost";
  const { retryMs, ...marks } = unpinned;
  // The recap may have posted the results message while this edit was in flight (markResults asks
  // for another draw). A final card stops only if no such request arrived since the claim read it.
  // An unpin still to retry keeps the card due behind a hold, which no Results request cuts short.
  const settledAt = at.toISOString();
  const stopOrAgain = sql`case when ${raidCards.resultsMessageId} is not distinct from ${card.resultsMessageId}::integer then null else ${settledAt}::timestamptz end`;
  await db
    .update(raidCards)
    .set({
      state,
      renderedHash: hash,
      holdUntil: retryMs === undefined ? null : new Date(at.getTime() + retryMs),
      nextRefreshAt: !final
        ? new Date(at.getTime() + REFRESH_MS)
        : retryMs === undefined
          ? stopOrAgain
          : at,
      ...marks,
    })
    .where(leased());
  return final ? "final" : outcome;
}

// Each call ends inside the 30-second lease renewed just before it, so a hung request cannot
// outlive its lease.
const signal = () =>
  AbortSignal.timeout(20_000) as unknown as Parameters<Api["unpinChatMessage"]>[3];

export function telegramCardEditor(api: Api): CardEditor {
  let username: string | undefined;
  return {
    editCaption: (chat, message, caption, keyboard) =>
      api.editMessageCaption(
        Number(chat),
        message,
        { caption, parse_mode: "HTML", reply_markup: keyboard },
        signal(),
      ),
    editText: (chat, message, text, keyboard) =>
      api.editMessageText(
        Number(chat),
        message,
        text,
        { parse_mode: "HTML", reply_markup: keyboard, link_preview_options: { is_disabled: true } },
        signal(),
      ),
    unpin: (chat, message) => api.unpinChatMessage(Number(chat), message, undefined, signal()),
    botUsername: async () => {
      username ??= (await api.getMe()).username;
      return username;
    },
  };
}
