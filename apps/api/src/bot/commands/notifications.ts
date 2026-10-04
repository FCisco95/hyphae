import { communities, type Db, raidSubscriptions } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { type CommandContext, type Context, InlineKeyboard } from "grammy";
import {
  ALERT_PREFIX,
  alertLink,
  COMMUNITY_ID,
  ENABLE_PREFIX,
  STOP_PREFIX,
  setRaidSubscription,
} from "../../raid-alerts/alerts.js";
import { isMemberStatus } from "../membership.js";
import { reply } from "../reply.js";

const privateUser = (ctx: Context) => {
  const user = ctx.from;
  if (
    !user ||
    user.is_bot ||
    !Number.isSafeInteger(user.id) ||
    user.id <= 0 ||
    ctx.chat?.type !== "private" ||
    ctx.chat.id !== user.id
  )
    return;
  return user.id;
};

export async function raidAlertStart(db: Db, ctx: CommandContext<Context>): Promise<boolean> {
  if (!ctx.match.startsWith(ALERT_PREFIX)) return false;
  const id = ctx.match.slice(ALERT_PREFIX.length);
  const userId = privateUser(ctx);
  if (userId === undefined || !COMMUNITY_ID.test(id)) {
    await ctx.reply("Open the raid-alert link in your own private chat with this bot.");
    return true;
  }
  const community = await db.query.communities.findFirst({ where: eq(communities.id, id) });
  if (!community) {
    await ctx.reply("That community is not registered with Hyphae.");
    return true;
  }
  if (!Number.isSafeInteger(Number(community.telegramChatId))) {
    await ctx.reply(
      "Community configuration is unavailable. Ask its owner before enabling alerts.",
    );
    return true;
  }
  await ctx.reply(
    `Receive future raid alerts for ${community.name} here privately? Alerts are optional and can be stopped at any time.`,
    {
      reply_markup: new InlineKeyboard().text("Enable raid alerts", `${ENABLE_PREFIX}${id}`),
    },
  );
  return true;
}

export async function enableRaidAlerts(db: Db, ctx: Context) {
  const data = ctx.callbackQuery?.data ?? "";
  const id = data.slice(ENABLE_PREFIX.length);
  const userId = privateUser(ctx);
  if (!data.startsWith(ENABLE_PREFIX) || !COMMUNITY_ID.test(id) || userId === undefined) {
    await ctx.answerCallbackQuery({ text: "Enable alerts from your own private bot chat." });
    return;
  }
  await ctx.answerCallbackQuery({ text: "Checking membership…" });
  const community = await db.query.communities.findFirst({ where: eq(communities.id, id) });
  if (!community || !Number.isSafeInteger(Number(community.telegramChatId))) {
    await ctx.reply("Community configuration is unavailable. Alerts were not enabled.");
    return;
  }
  let member: Awaited<ReturnType<Context["api"]["getChatMember"]>>;
  try {
    member = await ctx.api.getChatMember(
      Number(community.telegramChatId),
      userId,
      // grammY types a polyfill signal; installed node-fetch also accepts the native Node signal.
      AbortSignal.timeout(4_000) as unknown as Parameters<Context["api"]["getChatMember"]>[2],
    );
  } catch {
    await ctx.reply("Membership could not be checked. Alerts were not enabled; try again later.");
    return;
  }
  if (!isMemberStatus(member)) {
    await ctx.reply(
      `Join ${community.name} first, then send /notifications in its registered group.`,
    );
    return;
  }
  await setRaidSubscription(db, id, BigInt(userId), true);
  await ctx.reply(
    `Raid alerts enabled for ${community.name}. Future raids will arrive here privately. This does not link a wallet or register work for rewards.`,
    {
      reply_markup: new InlineKeyboard().text("Stop these alerts", `${STOP_PREFIX}${id}`),
    },
  );
}

export async function notifications(db: Db, ctx: CommandContext<Context>) {
  if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
    const community = await db.query.communities.findFirst({
      where: eq(communities.telegramChatId, BigInt(ctx.chat.id)),
    });
    if (!community) return reply(ctx, "This chat is not a registered Hyphae community.");
    return ctx.reply(
      `Choose private raid alerts for ${community.name}. Open the bot, press Start, then choose Enable raid alerts.`,
      {
        reply_parameters: { message_id: ctx.msg.message_id },
        reply_markup: new InlineKeyboard().url(
          "Get raid alerts privately",
          alertLink(ctx.me.username, community.id),
        ),
        link_preview_options: { is_disabled: true },
      },
    );
  }
  const userId = privateUser(ctx);
  if (userId === undefined) return;
  const rows = await db
    .select({ id: communities.id, name: communities.name })
    .from(raidSubscriptions)
    .innerJoin(communities, eq(communities.id, raidSubscriptions.communityId))
    .where(
      and(
        eq(raidSubscriptions.telegramUserId, BigInt(userId)),
        eq(raidSubscriptions.enabled, true),
      ),
    )
    .limit(20);
  if (!rows.length)
    return ctx.reply(
      "No raid alerts enabled. Send /notifications in a registered group to choose that community's private alerts.",
    );
  const keyboard = new InlineKeyboard();
  for (const row of rows)
    keyboard.text(`Stop: ${row.name.slice(0, 40)}`, `${STOP_PREFIX}${row.id}`).row();
  return ctx.reply(
    "Your private raid alerts. Each button stops only that community. You can also use the Stop button on any raid alert.",
    { reply_markup: keyboard },
  );
}

export async function stopRaidAlerts(db: Db, ctx: Context) {
  const data = ctx.callbackQuery?.data ?? "";
  const id = data.slice(STOP_PREFIX.length);
  const userId = privateUser(ctx);
  if (!data.startsWith(STOP_PREFIX) || !COMMUNITY_ID.test(id) || userId === undefined) {
    await ctx.answerCallbackQuery({ text: "Use the Stop button in your own private bot chat." });
    return;
  }
  const community = await db.query.communities.findFirst({ where: eq(communities.id, id) });
  if (!community) {
    await ctx.answerCallbackQuery({ text: "Community unavailable." });
    return;
  }
  await ctx.answerCallbackQuery({ text: "Stopping alerts…" });
  await setRaidSubscription(db, id, BigInt(userId), false);
  const message = ctx.callbackQuery?.message;
  const keyboard =
    message && "reply_markup" in message ? message.reply_markup?.inline_keyboard : undefined;
  const remaining = (keyboard ?? [])
    .map((row) =>
      row.filter((button) => !("callback_data" in button && button.callback_data === data)),
    )
    .filter((row) => row.length > 0);
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: remaining } });
  } catch {
    /* An old/double-tapped keyboard cannot undo consent or suppress confirmation. */
  }
  await ctx.reply(
    `Raid alerts stopped for ${community.name}. Other communities are unchanged. To enable these again, send /notifications in that group.`,
  );
}
