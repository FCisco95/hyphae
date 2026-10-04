import { Bot } from "grammy";
import { db } from "../db.js";
import { env } from "../env.js";
import { chatMigration } from "./chat-migration.js";
import { effort } from "./commands/effort.js";
import { linkInGroup, linkStart } from "./commands/link.js";
import { me } from "./commands/me.js";
import {
  enableRaidAlerts,
  notifications,
  raidAlertStart,
  stopRaidAlerts,
} from "./commands/notifications.js";
import { onboardingHelp, onboardingWelcome } from "./commands/onboarding.js";
import { raid } from "./commands/raid.js";
import { rulesStart, rulesTest } from "./commands/rules.js";
import { submit } from "./commands/submit.js";
import { containBotError } from "./errors.js";

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

const commands = bot.errorBoundary(containBotError);

commands.use(chatMigration(db));

commands.command("start", async (ctx) => {
  if (
    ctx.chat.type === "private" &&
    ((await linkStart(ctx)) || (await rulesStart(db, ctx)) || (await raidAlertStart(db, ctx)))
  ) {
    return;
  }
  return onboardingWelcome(db, ctx, env.PUBLIC_WEB_URL);
});
commands.command("link", (ctx) =>
  ctx.chat.type === "private" ? ctx.reply("Send /link in your community chat.") : linkInGroup(ctx),
);
commands.command("me", me);
commands.command("help", (ctx) => onboardingHelp(db, ctx, env.PUBLIC_WEB_URL));
commands.command("submit", submit);
commands.command("effort", effort);
commands.command("raid", raid);
commands.command("notifications", (ctx) => notifications(db, ctx));
commands.callbackQuery(/^raids_on_/, (ctx) => enableRaidAlerts(db, ctx));
commands.callbackQuery(/^raids_off_/, (ctx) => stopRaidAlerts(db, ctx));
commands.use(rulesTest(db));
