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
import { operator } from "./commands/operator.js";
import {
  cancelPrivateSubmission,
  privateSubmit,
  submissionButton,
  submissionReply,
  submissionStart,
} from "./commands/private-submit.js";
import { raid } from "./commands/raid.js";
import { cancelRaid, closeRaid } from "./commands/raid-lifecycle.js";
import { closeRaidButton, pickRaidHours, raidsMenu } from "./commands/raid-menu.js";
import { issueCommand, receiptCommand, refreshReceipt } from "./commands/receipts.js";
import { rulesStart, rulesTest } from "./commands/rules.js";
import { setupInGroup, setupLink, setupRefresh, setupStart } from "./commands/setup.js";
import { submit } from "./commands/submit.js";
import { containBotError } from "./errors.js";

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

const commands = bot.errorBoundary(containBotError);

commands.use(chatMigration(db));

commands.command("start", async (ctx) => {
  if (
    ctx.chat.type === "private" &&
    ((await linkStart(ctx)) ||
      (await setupStart(db, ctx)) ||
      (await rulesStart(db, ctx)) ||
      (await raidAlertStart(db, ctx)) ||
      (await submissionStart(db, ctx)))
  ) {
    return;
  }
  return onboardingWelcome(db, ctx, env.PUBLIC_WEB_URL);
});
commands.command("link", (ctx) =>
  ctx.chat.type === "private" ? ctx.reply("Send /link in your community chat.") : linkInGroup(ctx),
);
commands.command("setup", (ctx) =>
  ctx.chat.type === "private"
    ? ctx.reply("Send /setup in your community chat to begin.")
    : setupInGroup(db, ctx),
);
commands.callbackQuery(/^setup_link_/, (ctx) => setupLink(db, ctx));
commands.callbackQuery(/^setup_(?!link_)/, (ctx) => setupRefresh(db, ctx));
commands.command("me", me);
commands.command("help", (ctx) => onboardingHelp(db, ctx, env.PUBLIC_WEB_URL));
commands.command("submit", (ctx) =>
  ctx.chat.type === "private" ? privateSubmit(db, ctx, env.PUBLIC_WEB_URL) : submit(ctx),
);
commands.command("cancel_submission", (ctx) => cancelPrivateSubmission(db, ctx));
commands.command("receipt", (ctx) => receiptCommand(db, ctx, env.PUBLIC_WEB_URL));
commands.command("issue", (ctx) => issueCommand(db, ctx));
commands.callbackQuery(/^receipt_/, (ctx) => refreshReceipt(db, ctx, env.PUBLIC_WEB_URL));
commands.callbackQuery(/^raid_(reply|quote)_/, (ctx) => submissionButton(db, ctx));
commands.command("effort", effort);
commands.command("raid", raid);
commands.command("raids", raidsMenu);
commands.callbackQuery(/^rn:/, pickRaidHours);
commands.callbackQuery(/^cr:/, closeRaidButton);
commands.command("close_raid", closeRaid);
commands.command("cancel_raid", cancelRaid);
commands.command("ops", (ctx) => operator(db, ctx));
commands.command("notifications", (ctx) => notifications(db, ctx));
commands.callbackQuery(/^raids_on_/, (ctx) => enableRaidAlerts(db, ctx));
commands.callbackQuery(/^raids_off_/, (ctx) => stopRaidAlerts(db, ctx));
commands.use(rulesTest(db));
commands.on("message:text", (ctx, next) => submissionReply(db, ctx, next, env.PUBLIC_WEB_URL));
